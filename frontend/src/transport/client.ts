import { API_VERSION } from "../api/version.js";
import { getAccessToken } from "./auth.js";

export const BACKEND_URL = "";

export interface BackendStatus {
	host: string | null;
	clientUuid: string | null;
	configured: boolean;
}

// The backend's status/config — the single place anything reads `/api/status`.
// Fetched once per page and cached; the cache is cleared on a failed fetch so a
// transient backend hiccup can be retried.
let statusPromise: Promise<BackendStatus> | null = null;

export function fetchBackendStatus(): Promise<BackendStatus> {
	if (!statusPromise) {
		statusPromise = fetch(`${BACKEND_URL}/api/status`)
			.then((response) => response.json() as Promise<BackendStatus>)
			.catch((error) => {
				statusPromise = null; // let the next call retry
				throw error;
			});
	}
	return statusPromise;
}

// The backend tells us which Nabla host to call, so callers never thread it
// around. A host may include a scheme (e.g. http://localhost:8080 for a local
// proxy); a bare hostname defaults to https/wss.
export async function getHost(): Promise<string> {
	const status = await fetchBackendStatus();
	if (!status.configured || !status.host) {
		throw new Error("Backend not configured — complete Setup first.");
	}
	return status.host;
}

export function httpUrl(host: string, path: string): string {
	const base = host.includes("://") ? host : `https://${host}`;
	return `${base}${path}`;
}

function webSocketUrl(host: string, path: string): string {
	const base = host.includes("://")
		? host.replace(/^http/, "ws")
		: `wss://${host}`;
	return `${base}${path}`;
}

export async function nablaFetch(
	path: string,
	options: RequestInit = {},
): Promise<Response> {
	const [host, accessToken] = await Promise.all([getHost(), getAccessToken()]);
	const response = await fetch(httpUrl(host, path), {
		...options,
		headers: {
			"Content-Type": "application/json",
			...(options.headers as Record<string, string> | undefined),
			// Auth and API version are managed here and always win over caller headers.
			Authorization: `Bearer ${accessToken}`,
			"X-Nabla-Api-Version": API_VERSION,
		},
	});
	// Turn HTTP failures into thrown errors so callers never parse an error body
	// as if it were a success. Read the body as text — an error response isn't
	// guaranteed to be JSON.
	if (!response.ok) {
		const body = await response.text();
		throw new Error(`Nabla API ${response.status} on ${path}: ${body}`);
	}
	return response;
}

// #region nabla-websocket
export async function nablaWebSocket(
	path: string,
	protocol: string,
): Promise<WebSocket> {
	const [host, accessToken] = await Promise.all([getHost(), getAccessToken()]);
	const webSocket = new WebSocket(
		webSocketUrl(host, `${path}?nabla-api-version=${API_VERSION}`),
		[protocol, `jwt-${accessToken}`],
	);
	await new Promise<void>((resolve, reject) => {
		webSocket.onopen = () => resolve();
		webSocket.onerror = () => reject(new Error("WebSocket failed to connect"));
	});
	return webSocket;
}
// #endregion nabla-websocket
