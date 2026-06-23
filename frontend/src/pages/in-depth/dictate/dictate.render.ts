import { DICTATE_LOCALES, type DictationLocale } from "../../../api/dictate.js";

export { renderCodeSnippets } from "../../../shared/codeSnippets.js";
// The WebSocket log and code-snippet rendering are generic and shared with the
// transcribe page.
export {
	addWsMessage,
	resetLog,
	switchWsTab,
	updateWsStatus,
} from "../../../shared/wsLog.js";

export function renderLocaleOptions(): void {
	const select = document.getElementById(
		"dictate-locale",
	) as HTMLSelectElement | null;
	if (!select) {
		return;
	}
	select.innerHTML = DICTATE_LOCALES.map(
		(locale) => `<option value="${locale.value}">${locale.label}</option>`,
	).join("");
}

export function readLocaleSelection(): DictationLocale {
	return (document.getElementById("dictate-locale") as HTMLSelectElement)
		.value as DictationLocale;
}

export function getNoteText(): string {
	return (document.getElementById("dictation-note") as HTMLTextAreaElement)
		.value;
}

// dictate-ws emits DICTATED_TEXT segments that must be appended verbatim — no extra
// spaces, punctuation, or formatting (the server already handles those).
export function appendDictatedText(text: string): void {
	const note = document.getElementById("dictation-note") as HTMLTextAreaElement;
	note.value += text;
	note.scrollTop = note.scrollHeight;
}

export function clearNote(): void {
	(document.getElementById("dictation-note") as HTMLTextAreaElement).value = "";
}

export function setLoadingState(): void {
	const startButton = document.getElementById("start-btn") as HTMLButtonElement;
	startButton.textContent = "Connecting…";
	startButton.disabled = true;
}

export function setRecordingState(): void {
	document.getElementById("start-btn")?.classList.add("hidden");
	document.getElementById("pause-btn")?.classList.remove("hidden");
	document.getElementById("recording-dot")?.classList.remove("hidden");
	(document.getElementById("dictate-locale") as HTMLSelectElement).disabled =
		true;
	(document.getElementById("dictation-note") as HTMLTextAreaElement).readOnly =
		true;
}

export function setIdleState(): void {
	const startButton = document.getElementById("start-btn") as HTMLButtonElement;
	startButton.textContent = "Start";
	startButton.disabled = false;
	startButton.classList.remove("hidden");
	document.getElementById("pause-btn")?.classList.add("hidden");
	document.getElementById("recording-dot")?.classList.add("hidden");
	(document.getElementById("dictate-locale") as HTMLSelectElement).disabled =
		false;
	(document.getElementById("dictation-note") as HTMLTextAreaElement).readOnly =
		false;
}
