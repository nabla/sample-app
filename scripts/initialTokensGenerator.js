/**
 *
 * This script simulates the backend server of a Nabla Core API customer which would:
 * - Authenticate to the Core API (by constructing a JWT client assertion with its OAuth UUID and private key)
 * - Create a new API user
 * - Authenticate the API user, to provide him its initial access and refresh tokens
 * For convenience, the tokens generated are stored in a JSON file.
 * 
 * Usage:
 * node initialTokensGenerator.js [--type=server|user]
 * 
 * Options:
 *   --type=server  Generate server access token
 *   --type=user    Generate user access/refresh tokens (default)
 *
 */

const OAUTH_CLIENT_UUID = "<YOUR_OAUTH_CLIENT_UUID>";
const OAUTH_CLIENT_PRIVATE_KEY = `<YOUR_OAUTH_CLIENT_PRIVATE_KEY>`;
const REGION = "<YOUR_REGION>"; // "us" or "eu"

const fs = require('fs');
const path = require('path');
// Jsrsasign is provided in the repository source code for convenience
const jsrsasignCode = fs.readFileSync(path.join(__dirname, 'lib/jsrsasign.js'), 'utf8');
eval(jsrsasignCode);

const CORE_API_HOST = `${REGION}.api.nabla.com`;

// Parse command line arguments
const parseArgs = () => {
    const args = process.argv.slice(2);
    const options = {
        type: 'user' // Default to user tokens
    };

    for (const arg of args) {
        if (arg.startsWith('--type=')) {
            const value = arg.split('=')[1];
            if (value === 'server' || value === 'user') {
                options.type = value;
            } else {
                console.warn(`Invalid value for --type: ${value}. Using default 'user'.`);
            }
        }
    }

    return options;
};

async function main() {
    try {
        const options = parseArgs();

        if (options.type === 'server') {
            // Generate server token only
            const serverTokens = await fetchServerAccessToken();

            const tokenData = {
                accessToken: serverTokens.accessToken
            };

            const filename = 'serverTokens.json';
            fs.writeFileSync(filename, JSON.stringify(tokenData, null, 2), 'utf8');

            console.log(`Successfully generated server token. See '${filename}' file.`);
        } else {
            // Generate user tokens (default)
            const serverTokens = await fetchServerAccessToken();
            const userId = await createUser(serverTokens.accessToken);
            const { userRefreshToken, userAccessToken } = await authenticateUser(serverTokens.accessToken, userId);

            const tokenData = {
                accessToken: userAccessToken,
                refreshToken: userRefreshToken,
            };

            const filename = 'userTokens.json';
            fs.writeFileSync(filename, JSON.stringify(tokenData, null, 2), 'utf8');

            console.log(`Successfully generated user tokens. See '${filename}' file.`);
        }
    } catch (err) {
        console.error("Error during authentication flow. You maybe forgot to provide OAuth UUID " +
            "and private key in the source code.", err);
    }
}

const fetchServerAccessToken = async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const assertionHeader = { alg: "RS256", typ: "JWT" };
    const payload = {
        sub: OAUTH_CLIENT_UUID,
        iss: OAUTH_CLIENT_UUID,
        aud: `https://${CORE_API_HOST}/v1/core/server/oauth/token`,
        exp: nowSeconds + 60,
        iat: nowSeconds,
    };

    const jwtAssertion = KJUR.jws.JWS.sign(
        assertionHeader.alg,
        JSON.stringify(assertionHeader),
        JSON.stringify(payload),
        OAUTH_CLIENT_PRIVATE_KEY,
    );

    const response = await fetch(`https://${CORE_API_HOST}/v1/core/server/oauth/token`, {
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
    return {
        accessToken: data.access_token
    };
};

const createUser = async (serverAccessToken) => {
    const response = await fetch(`https://${CORE_API_HOST}/v1/core/server/users`, {
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
        `https://${CORE_API_HOST}/v1/core/server/jwt/authenticate/${userId}`,
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
