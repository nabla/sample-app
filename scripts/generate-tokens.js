/**
 *
 * This script simulates the backend server of a Nabla Core API customer which would:
 * - Authenticate to the Core API (by constructing a JWT client assertion with its OAuth UUID and private key)
 * - Create a new API user
 * - Authenticate the API user, to provide him its initial access and refresh tokens
 *
 * Usage:
 * node generate-tokens.js --uuid=<oauth-uuid> --private-key=<private-key-file> --hostname=<api-hostname> [--type=server|user]
 *
 * Required Arguments:
 *   --uuid=<oauth-uuid>        OAuth UUID for authentication
 *   --private-key=<file>       Path to the private key file
 *   --hostname=<hostname>      API hostname (e.g., eu.api.nabla.com)
 *
 * Optional Arguments:
 *   --type=server              Generate server access token only
 *   --type=user                Generate user access/refresh tokens (default)
 *
 */

import fs from 'node:fs';
import { parseArgs } from 'node:util';

import { KJUR } from 'jsrsasign';

const REQUIRED_ARGUMENTS = ['uuid', 'private-key', 'hostname'];
const SUPPORTED_TYPES = new Set(['server', 'user']);

function parseArguments() {
    const { values } = parseArgs({
        args: process.argv.slice(2),
        options: {
            uuid: {
                type: 'string',
            },
            'private-key': {
                type: 'string',
            },
            hostname: {
                type: 'string',
            },
            type: {
                type: 'string',
                default: 'user',
            }
        }
    });

    for (const argument of REQUIRED_ARGUMENTS) {
        if (!values[argument]) {
            console.error(`Missing required argument --${argument}`);
            process.exit(1);
        }
    }

    if (values.type && !SUPPORTED_TYPES.has(values.type)) {
        console.error(`Invalid value for --type: ${values.type}.`);
        process.exit(1);
    }

    return {
        type: values.type ?? 'user',
        privateKeyFilename: values['private-key'],
        uuid: values.uuid,
        hostname: values.hostname,
    };
};

async function main() {
    try {
        const options = parseArguments();
        const serverTokens = await fetchServerAccessToken(options);

        if (options.type === 'server') {
            console.log(bold('Server access token: '), serverTokens.accessToken);
        } else {
            const userId = await createUser(serverTokens.accessToken, options);
            const { userRefreshToken, userAccessToken } = await authenticateUser(serverTokens.accessToken, userId, options);

            console.log(bold('User access token: '), userAccessToken);
            console.log(bold('User refresh token: '), userRefreshToken);
        }
    } catch (err) {
        console.error("Error during authentication flow. You maybe forgot to provide OAuth UUID " +
            "and private key in the source code.", err);
    }
}

async function fetchServerAccessToken(options) {
    const { uuid, privateKeyFilename, hostname } = options;

    const nowSeconds = Math.floor(Date.now() / 1000);
    const assertionHeader = { alg: "RS256", typ: "JWT" };
    const payload = {
        sub: uuid,
        iss: uuid,
        aud: `https://${hostname}/v1/core/server/oauth/token`,
        exp: nowSeconds + 60,
        iat: nowSeconds,
    };

    const privateKey = fs.readFileSync(privateKeyFilename, 'utf8');

    const jwtAssertion = KJUR.jws.JWS.sign(
        assertionHeader.alg,
        JSON.stringify(assertionHeader),
        JSON.stringify(payload),
        privateKey,
    );

    const response = await fetch(`https://${hostname}/v1/core/server/oauth/token`, {
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
}

async function createUser(serverAccessToken, options) {
    const { hostname } = options;

    const response = await fetch(`https://${hostname}/v1/core/server/users`, {
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
}

async function authenticateUser(serverAccessToken, userId, options) {
    const { hostname } = options;

    const response = await fetch(
        `https://${hostname}/v1/core/server/jwt/authenticate/${userId}`,
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

function bold(text) {
    return `\x1b[1m${text}\x1b[0m`;
}

// Run the script
main();
