import { API_VERSION } from "../api/version.js";
import { BACKEND_URL, getHost, httpUrl } from "./client.js";

// ── User session ─────────────────────────────────────────────────────────────
// Per the Nabla auth guide, the browser owns its user access + refresh tokens.
// It renews the short-lived access token itself with the refresh token; if the
// refresh token has also expired, it asks the backend to provision a fresh pair.
// Only the privileged server token ever stays secret on the backend.
// Setup seeds the first pair via `saveSession`.

interface SessionTokens {
	access_token: string;
	refresh_token: string;
}

interface AccessTokenClaims {
	exp: number;
}

interface ProvisionResponse {
	access_token?: string;
	refresh_token?: string;
	error?: string;
}

const ACCESS_TOKEN_KEY = "nabla_access_token";
const REFRESH_TOKEN_KEY = "nabla_refresh_token";

export function saveSession(tokens: SessionTokens): void {
	localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
	localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
}

// Access tokens last ~5 minutes; refresh a little early so a call never lands
// right on the expiry boundary. Only `exp` is part of the API contract.
function isExpiringSoon(accessToken: string): boolean {
	try {
		const base64 = accessToken
			.split(".")[1]
			.replace(/-/g, "+")
			.replace(/_/g, "/");
		const { exp } = JSON.parse(atob(base64)) as AccessTokenClaims;
		return exp < Date.now() / 1000 + 30;
	} catch {
		return true;
	}
}

let renewalPromise: Promise<string> | null = null;

export async function getAccessToken(): Promise<string> {
	const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
	if (accessToken && !isExpiringSoon(accessToken)) {
		return accessToken;
	}
	// Coalesce concurrent callers onto a single renewal (refresh tokens rotate).
	if (!renewalPromise) {
		renewalPromise = renewSession().finally(() => {
			renewalPromise = null;
		});
	}
	return renewalPromise;
}

// Get a fresh access token: refresh with our refresh token if we can, otherwise
// fall back to the backend, which re-provisions the user (mint server token →
// authenticate the user) and hands us a brand-new token pair.
async function renewSession(): Promise<string> {
	return (await refreshWithRefreshToken()) ?? (await reprovisionViaBackend());
}

async function refreshWithRefreshToken(): Promise<string | null> {
	const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
	if (!refreshToken) {
		return null;
	}
	const host = await getHost();
	// No auth header — the refresh token itself authenticates this call.
	const response = await fetch(httpUrl(host, "/v1/core/user/jwt/refresh"), {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"X-Nabla-Api-Version": API_VERSION,
		},
		body: JSON.stringify({
			refresh_token: refreshToken,
		}),
	});
	if (!response.ok) {
		return null; // refresh token expired (30 days) or revoked
	}
	const tokens = (await response.json()) as SessionTokens;
	saveSession(tokens);
	return tokens.access_token;
}

async function reprovisionViaBackend(): Promise<string> {
	const response = await fetch(`${BACKEND_URL}/api/provision-user`, {
		method: "POST",
	});
	const provisionResult = (await response.json()) as ProvisionResponse;
	if (
		!response.ok ||
		!provisionResult.access_token ||
		!provisionResult.refresh_token
	) {
		throw new Error(
			provisionResult.error ?? "No session — complete Setup first.",
		);
	}
	saveSession({
		access_token: provisionResult.access_token,
		refresh_token: provisionResult.refresh_token,
	});
	return provisionResult.access_token;
}
