import { initPageChrome } from "../../shared/page-chrome.js";
import { saveSession } from "../../transport/auth.js";
import { BACKEND_URL, fetchBackendStatus } from "../../transport/client.js";
import {
	goToStep,
	readClientUuid,
	readHost,
	resetCopyButton,
	resetGenerateKeypairButton,
	resetGenerateServerTokenButton,
	resetProvisionUserButton,
	restoreClientUuid,
	restoreHost,
	setGenerateKeypairLoading,
	setGenerateServerTokenError,
	setGenerateServerTokenLoading,
	setProvisionUserError,
	setProvisionUserLoading,
	showCopyConfirmation,
	showKeypairDisplay,
	showServerTokenResponse,
	showUserTokenResponse,
} from "./onboarding.render.js";

interface ExistingKeypairResponse {
	publicKeyPem: string;
}

interface GenerateKeypairResponse {
	publicKeyPem?: string;
	error?: string;
}

interface ConfigureResponse {
	ok?: boolean;
	error?: string;
}

interface ServerTokenResponse {
	ok?: boolean;
	expiresAt?: number;
	error?: string;
}

interface ProvisionUserResponse {
	access_token?: string;
	refresh_token?: string;
	nabla_user_id?: string;
	error?: string;
}

let currentPublicKey = "";

function main(): void {
	initPageChrome();
	loadExistingConfig();
	loadExistingKeypair();
	exposePageHandlers();
}

// The backend is the single source of truth for config — pre-fill the form from
// it (not localStorage), so deleting the backend's `.cache/` truly resets Setup.
function loadExistingConfig(): void {
	fetchBackendStatus()
		.then((status) => {
			restoreClientUuid(status.clientUuid ?? "");
			if (status.host) {
				restoreHost(status.host);
			}
		})
		.catch(() => {});
}

function exposePageHandlers(): void {
	const windowHandlers = window as unknown as Record<string, unknown>;
	windowHandlers.goToStep = goToStep;
	windowHandlers.submitConfig = submitConfig;
	windowHandlers.generateKeypair = generateKeypair;
	windowHandlers.copyPublicKey = copyPublicKey;
	windowHandlers.generateServerToken = generateServerToken;
	windowHandlers.provisionUser = provisionUser;
}

function loadExistingKeypair(): void {
	fetch(`${BACKEND_URL}/api/keypair`)
		.then((response) =>
			response.ok
				? (response.json() as Promise<ExistingKeypairResponse>)
				: Promise.reject(),
		)
		.then(({ publicKeyPem }) => onKeypairGenerated(publicKeyPem))
		.catch(() => {});
}

main();

export async function generateKeypair(): Promise<void> {
	setGenerateKeypairLoading();
	try {
		const response = await fetch(`${BACKEND_URL}/api/generate-keypair`, {
			method: "POST",
		});
		const data = (await response.json()) as GenerateKeypairResponse;
		if (data.error || !data.publicKeyPem) {
			throw new Error(data.error ?? "Unknown error");
		}
		onKeypairGenerated(data.publicKeyPem);
	} catch (error) {
		alert(error instanceof Error ? error.message : "Could not reach backend");
		resetGenerateKeypairButton();
	}
}

export function copyPublicKey(): void {
	navigator.clipboard.writeText(currentPublicKey).then(() => {
		showCopyConfirmation();
		setTimeout(resetCopyButton, 2000);
	});
}

export async function submitConfig(): Promise<void> {
	const clientUuid = readClientUuid();
	const host = readHost();
	if (!clientUuid || !host) {
		alert("Please fill in all required fields");
		return;
	}
	if (!currentPublicKey) {
		alert("Generate a key pair first");
		return;
	}
	try {
		const response = await fetch(`${BACKEND_URL}/api/configure`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				clientUuid,
				host,
			}),
		});
		const data = (await response.json()) as ConfigureResponse;
		if (data.error) {
			throw new Error(data.error);
		}
		goToStep(2);
	} catch (error) {
		alert(error instanceof Error ? error.message : "Configuration failed");
	}
}

export async function generateServerToken(): Promise<void> {
	setGenerateServerTokenLoading();
	try {
		const response = await fetch(`${BACKEND_URL}/api/server-token`, {
			method: "POST",
		});
		const data = (await response.json()) as ServerTokenResponse;
		if (data.error) {
			throw new Error(data.error);
		}
		showServerTokenResponse();
		resetGenerateServerTokenButton();
	} catch (error) {
		alert(error instanceof Error ? error.message : "Token generation failed");
		setGenerateServerTokenError();
	}
}

export async function provisionUser(): Promise<void> {
	setProvisionUserLoading();
	try {
		const response = await fetch(`${BACKEND_URL}/api/provision-user`, {
			method: "POST",
		});
		const data = (await response.json()) as ProvisionUserResponse;
		if (data.error) {
			throw new Error(data.error);
		}
		if (data.access_token && data.refresh_token) {
			saveSession({
				access_token: data.access_token,
				refresh_token: data.refresh_token,
			});
		}
		showUserTokenResponse(data);
		resetProvisionUserButton();
	} catch (error) {
		alert(error instanceof Error ? error.message : "User provisioning failed");
		setProvisionUserError();
	}
}

function onKeypairGenerated(publicKeyPem: string): void {
	currentPublicKey = publicKeyPem;
	showKeypairDisplay(publicKeyPem);
}
