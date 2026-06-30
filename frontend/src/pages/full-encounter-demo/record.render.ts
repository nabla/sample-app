import type { TranscriptItem } from "../../api/transcribe.js";
import { DOCUMENTATION_LINKS } from "../../shared/documentationLinks.js";

function setHidden(id: string, hidden: boolean): void {
  document.getElementById(id)?.classList.toggle("hidden", hidden);
}

function setDisabled(id: string, disabled: boolean): void {
  const button = document.getElementById(id) as HTMLButtonElement | null;
  if (button) {
    button.disabled = disabled;
  }
}

function setButton(id: string, label: string, disabled: boolean): void {
  const button = document.getElementById(id) as HTMLButtonElement | null;
  if (!button) {
    return;
  }
  button.textContent = label;
  button.disabled = disabled;
}

function formatMs(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

export function markup(): string {
  return `
    <div id="encounter-card" class="bg-white rounded-xl border border-grey-200 p-6">
      <div class="flex items-center gap-2 mb-4">
        <h2 class="font-semibold text-grey-400">Encounter</h2>
        <a href="${DOCUMENTATION_LINKS.transcribeWs}" target="_blank" rel="noopener" class="text-xs font-mono text-grey-250 hover:text-primary-600 bg-grey-100 hover:bg-primary-50 px-2 py-0.5 rounded transition-colors">transcribe-ws ↗</a>
      </div>

      <label class="block text-xs font-medium text-grey-300 mb-1.5">Patient context <span class="text-grey-250 font-normal">(optional)</span></label>
      <textarea id="patient-context" rows="2" placeholder="e.g. 45yo female with history of hypertension" class="w-full px-3 py-2 text-sm border border-grey-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none mb-5"></textarea>

      <div class="text-xs font-semibold text-grey-300 mb-2">Transcript</div>
      <div id="transcript-items" class="bg-grey-50 border border-grey-200 rounded-lg p-4 space-y-1.5 font-mono text-xs text-grey-300 min-h-[120px] max-h-[320px] overflow-y-auto">
        <div id="transcript-placeholder" class="text-grey-250 italic">Transcript will appear here…</div>
      </div>

      <div class="flex items-center gap-2 mt-5">
        <button id="start-btn" class="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          Start recording
        </button>
        <button id="stop-btn" class="hidden bg-white border border-error-100 hover:border-error-200 text-error-300 text-sm px-4 py-2 rounded-lg transition-colors">
          ⏹ Stop
        </button>
        <span id="recording-dot" class="hidden flex items-center gap-1.5 text-xs text-error-200">
          <span class="w-2 h-2 rounded-full bg-error-200 blink"></span> Recording
        </span>
        <span id="finishing-msg" class="hidden flex items-center gap-1.5 text-xs text-grey-300">
          <span class="w-3 h-3 rounded-full border-2 border-grey-250 border-t-grey-300 spin"></span>
          Waiting for the remaining transcript items…
        </span>
        <div class="ml-auto flex items-center gap-3">
          <button id="fill-mock-btn" class="text-xs text-primary-600 hover:text-primary-700">
            Fill transcription with mock items
          </button>
          <button id="generate-note-btn" disabled class="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            Generate note →
          </button>
        </div>
      </div>
    </div>`;
}

// ── Capture states ─────────────────────────────────────────────────────────────────

export function setReviewState(hasTranscript: boolean): void {
  setHidden("start-btn", false);
  setHidden("stop-btn", true);
  setHidden("recording-dot", true);
  setHidden("fill-mock-btn", false);
  setHidden("finishing-msg", true);
  setButton(
    "start-btn",
    hasTranscript ? "Re-record" : "Start recording",
    false,
  );
  setHidden("generate-note-btn", false);
  setDisabled("generate-note-btn", !hasTranscript);
}

export function setRecordingState(): void {
  setHidden("start-btn", true);
  setHidden("stop-btn", false);
  setHidden("recording-dot", false);
  setHidden("fill-mock-btn", true);
  setHidden("finishing-msg", true);
  setHidden("generate-note-btn", false);
  setDisabled("generate-note-btn", false);
}

export function setFinishingState(): void {
  setHidden("stop-btn", true);
  setHidden("recording-dot", true);
  setHidden("fill-mock-btn", true);
  setDisabled("generate-note-btn", true);
  setHidden("finishing-msg", false);
}

// ── Transcript ───────────────────────────────────────────────────────────────────

export function renderFullTranscript(items: TranscriptItem[]): void {
  const container = document.getElementById("transcript-items");
  if (container) {
    container.innerHTML = "";
  }
  items.forEach(renderTranscriptItem);
}

export function renderTranscriptItem(item: TranscriptItem): void {
  const container = document.getElementById("transcript-items");
  if (!container) {
    return;
  }
  document.getElementById("transcript-placeholder")?.remove();
  const element = document.createElement("div");
  element.id = `ti-${item.id}`;
  element.className = item.is_final ? "text-grey-400" : "text-grey-250 italic";
  const speaker =
    item.speaker_type === "DOCTOR"
      ? "Doctor> "
      : item.speaker_type === "PATIENT"
        ? "Patient> "
        : "";
  element.textContent = `[${formatMs(item.start_offset_ms)}..${formatMs(item.end_offset_ms)}] ${speaker}${item.text}`;
  container.appendChild(element);
  container.scrollTop = container.scrollHeight;
}

export function readPatientContext(): string {
  return (document.getElementById("patient-context") as HTMLTextAreaElement)
    .value;
}
