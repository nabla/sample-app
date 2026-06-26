import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, '../../.cache');
const CONFIG_FILE = path.join(CACHE_DIR, 'config.json');
const TOKENS_FILE = path.join(CACHE_DIR, 'tokens.json');
const KEYPAIR_FILE = path.join(CACHE_DIR, 'keypair.json');

export interface Config {
  clientUuid: string;
  host: string;
  nablaUserId?: string; // Nabla-assigned UUID, set after first provision
}

// A configured `host` may include a scheme (e.g. http://localhost:8080 for a
// local proxy); a bare hostname like us.api.nabla.com defaults to https.
export function apiBaseUrl(host: string): string {
  return host.includes('://') ? host : `https://${host}`;
}

export interface Keypair {
  privateKeyPem: string;
  publicKeyPem: string;
}

export interface Tokens {
  serverToken: string | null;
  serverTokenExpiresAt: number;
}

// Renew this many seconds before the real expiry, so a token never lapses mid-request.
const SERVER_TOKEN_RENEW_MARGIN_SECONDS = 30;

// True when the given expiry (epoch seconds) is within the renew margin.
export function expiresSoon(serverTokenExpiresAt: number): boolean {
  const nowSeconds = Date.now() / 1000;
  return nowSeconds >= serverTokenExpiresAt - SERVER_TOKEN_RENEW_MARGIN_SECONDS;
}

function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
}

export function loadConfig(): Config | null {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')) as Config;
  } catch {
    return null;
  }
}

export function saveConfig(config: Config): void {
  ensureCacheDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function loadTokens(): Tokens {
  try {
    return JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf-8')) as Tokens;
  } catch {
    return { serverToken: null, serverTokenExpiresAt: 0 };
  }
}

export function saveTokens(tokens: Tokens): void {
  ensureCacheDir();
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2));
}

export function clearTokens(): void {
  saveTokens({ serverToken: null, serverTokenExpiresAt: 0 });
}

export function loadKeypair(): Keypair | null {
  try {
    return JSON.parse(fs.readFileSync(KEYPAIR_FILE, 'utf-8')) as Keypair;
  } catch {
    return null;
  }
}

export function saveKeypair(keypair: Keypair): void {
  ensureCacheDir();
  fs.writeFileSync(KEYPAIR_FILE, JSON.stringify(keypair, null, 2));
}
