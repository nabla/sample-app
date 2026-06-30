import { Router } from 'express';
import { importPKCS8, SignJWT, generateKeyPair, exportPKCS8, exportSPKI } from 'jose';
import { loadConfig, saveConfig, loadTokens, saveTokens, clearTokens, loadKeypair, saveKeypair, apiBaseUrl, expiresSoon, type Config } from './store.ts';
import { API_VERSION } from './version.ts';

export const authRouter = Router();

// Obtain a valid server token (client_credentials), using the cache when fresh.
// SECURITY: the value this returns is the server token and must NEVER be sent in
// an HTTP response to the frontend.
async function getServerToken(): Promise<string> {
  const config = loadConfig();
  if (!config) {
    throw new Error('Not configured — POST /api/configure first');
  }

  const keypair = loadKeypair();
  if (!keypair) {
    throw new Error('No keypair — POST /api/generate-keypair first');
  }

  const cached = loadTokens();
  if (cached.serverToken && !expiresSoon(cached.serverTokenExpiresAt)) {
    return cached.serverToken;
  }

  const privateKey = await importPKCS8(keypair.privateKeyPem, 'RS256');
  const oauthUrl = `${apiBaseUrl(config.host)}/v1/core/server/oauth/token`;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const clientAssertion = await new SignJWT({})
    .setProtectedHeader({ alg: 'RS256' })
    .setSubject(config.clientUuid)
    .setIssuer(config.clientUuid)
    .setAudience(oauthUrl)
    .setExpirationTime(nowSeconds + 300)
    .setIssuedAt(nowSeconds)
    .setJti(crypto.randomUUID())
    .sign(privateKey);

  const response = await fetch(oauthUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      client_assertion: clientAssertion,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText);
  }

  const tokenResponse = await response.json() as { access_token: string; expires_in: number };
  const serverTokenExpiresAt = nowSeconds + tokenResponse.expires_in;
  saveTokens({ serverToken: tokenResponse.access_token, serverTokenExpiresAt });
  return tokenResponse.access_token;
}

authRouter.post('/generate-keypair', async (_request, response) => {
  const { privateKey, publicKey } = await generateKeyPair('RS256', { modulusLength: 2048 });
  const privateKeyPem = await exportPKCS8(privateKey);
  const publicKeyPem = await exportSPKI(publicKey);
  saveKeypair({ privateKeyPem, publicKeyPem });
  response.json({ publicKeyPem });
});

authRouter.get('/keypair', (_request, response) => {
  const keypair = loadKeypair();
  if (!keypair) {
    response.status(404).json({ error: 'No keypair — POST /api/generate-keypair first' });
    return;
  }
  response.json({ publicKeyPem: keypair.publicKeyPem });
});

authRouter.post('/configure', (request, response) => {
  const { clientUuid, host } = request.body as Config;
  if (!clientUuid || !host) {
    response.status(400).json({ error: 'Missing required fields: clientUuid, host' });
    return;
  }
  if (!loadKeypair()) {
    response.status(400).json({ error: 'No keypair — POST /api/generate-keypair first' });
    return;
  }
  saveConfig({ clientUuid, host });
  // Config changed (possibly a new host/client): drop the cached server token so the
  // next call re-mints it against the new config instead of reusing a stale one.
  clearTokens();
  response.json({ ok: true });
});

authRouter.post('/server-token', async (_request, response) => {
  const config = loadConfig();
  const keypair = loadKeypair();
  if (!config || !keypair) {
    const errorMessage = !config
      ? 'Not configured — POST /api/configure first'
      : 'No keypair — POST /api/generate-keypair first';
    response.status(400).json({ error: errorMessage });
    return;
  }

  try {
    await getServerToken();
    // Read back the (possibly cached) expiry — the token itself is NEVER returned.
    const { serverTokenExpiresAt } = loadTokens();
    response.json({ ok: true, expiresAt: serverTokenExpiresAt });
  } catch (error) {
    response.status(500).json({ error: String(error) });
  }
});

authRouter.post('/provision-user', async (_request, response) => {
  let config = loadConfig();
  if (!config) {
    response.status(400).json({ error: 'Not configured' });
    return;
  }

  let serverToken: string;
  try {
    serverToken = await getServerToken();
  } catch (error) {
    response.status(500).json({ error: String(error) });
    return;
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${serverToken}`,
    'X-Nabla-Api-Version': API_VERSION,
  };

  try {
    let nablaUserId = config.nablaUserId;

    if (!nablaUserId) {
      const createUserResponse = await fetch(`${apiBaseUrl(config.host)}/v1/core/server/users`, {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      });
      if (!createUserResponse.ok) {
        const errorText = await createUserResponse.text();
        response.status(createUserResponse.status).json({ error: errorText });
        return;
      }
      const createdUser = await createUserResponse.json() as { id: string };
      nablaUserId = createdUser.id;
      config = { ...config, nablaUserId };
      saveConfig(config);
    }

    const authenticateResponse = await fetch(
      `${apiBaseUrl(config.host)}/v1/core/server/jwt/authenticate/${encodeURIComponent(nablaUserId)}`,
      { method: 'POST', headers }
    );

    if (!authenticateResponse.ok) {
      const errorText = await authenticateResponse.text();
      response.status(authenticateResponse.status).json({ error: errorText });
      return;
    }

    // These user tokens are SUPPOSED to go to the frontend; it now owns refresh.
    const userTokens = await authenticateResponse.json() as { access_token: string; refresh_token: string };
    response.json({ access_token: userTokens.access_token, refresh_token: userTokens.refresh_token, nabla_user_id: nablaUserId });
  } catch (error) {
    response.status(500).json({ error: String(error) });
  }
});
