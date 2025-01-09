/**
 *
 * This script simulates the backend server of a Nabla CORE API customer which would:
 * - Authenticate to the CORE API (by constructing a JWT client assertion with its OAuth UUID and private key)
 * - Create a new API user
 * - Authenticate the API user, to provide him its initial access and refresh tokens
 * For convenience, the user tokens generated are stored in a JSON file.
 *
 */

const OAUTH_CLIENT_UUID = "<YOUR_OAUTH_CLIENT_UUID>";
const OAUTH_CLIENT_PRIVATE_KEY = "<YOUR_OAUTH_CLIENT_PRIVATE_KEY>";
const REGION = "<YOUR_REGION>"; // "us" or "eu"

const fs = require('fs');
// Jsrassign is provided in the repository source code for convenience
const jsrasignCode = fs.readFileSync(path.join(__dirname, 'lib/jsrasign-all-min.js'), 'utf8');
eval(jsrasignCode);

async function main() {
    try {
        const serverAccessToken = await fetchServerAccessToken();
        const userId = await createUser(serverAccessToken);
        const { userRefreshToken, userAccessToken } = await authenticateUser(serverAccessToken, userId);

        const tokenData = {
            userId: userId,
            accessToken: userAccessToken,
            refreshToken: userRefreshToken,
            generatedAt: new Date().toISOString(),
        };
        fs.writeFileSync('userTokens.json', JSON.stringify(tokenData, null, 2), 'utf8');

        console.log("Successfully generated user tokens. See 'userTokens.json' file.");
    } catch (err) {
        console.error("Error during server authentication flow:", err);
    }
}

const fetchServerAccessToken = async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const assertionHeader = { alg: "RS256", typ: "JWT" };
    const payload = {
        sub: OAUTH_CLIENT_UUID,
        iss: OAUTH_CLIENT_UUID,
        aud: `https://${REGION}.api.nabla.com/v1/core/server/oauth/token`,
        exp: nowSeconds + 60,
        iat: nowSeconds,
    };

    const jwtAssertion = KJUR.jws.JWS.sign(
        assertionHeader.alg,
        JSON.stringify(assertionHeader),
        JSON.stringify(payload),
        OAUTH_CLIENT_PRIVATE_KEY,
    );

    const response = await fetch(`https://${REGION}.api.nabla.com/v1/core/server/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            grant_type: "client_credentials",
            client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
            client_assertion: jwtAssertion,
        }),
    });

    if (!response.ok) {
        throw new Error(`Could not get server access token (status: ${response.status})`);
    }

    const data = await response.json();
    return data.access_token;
};

const createUser = async (serverAccessToken) => {
    const response = await fetch(`https://${REGION}.api.nabla.com/v1/core/server/users`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serverAccessToken}`
        },
        body: JSON.stringify({}),
    });
    if (!response.ok) {
        throw new Error(`Unexpected error during user creation (status: ${response.status})`);
    }
    const data = await response.json();
    return data.id;
};

const authenticateUser = async (serverAccessToken, userId) => {
    const response = await fetch(
        `https://${REGION}.api.nabla.com/v1/core/server/jwt/authenticate/${userId}`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${serverAccessToken}`
            },
            body: JSON.stringify({}),
        }
    );
    if (!response.ok) {
        throw new Error(`Error retrieving initial user tokens (status: ${response.status})`);
    }
    const data = await response.json();
    return {
        userRefreshToken : data.refresh_token,
        userAccessToken : data.access_token,
    };
};

// Run the script
main();
