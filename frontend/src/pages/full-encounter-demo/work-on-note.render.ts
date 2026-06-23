import type { NormalizedData } from "../../api/normalize.js";
import type { ClinicalNote } from "../../api/note.js";
import type { RecipientType } from "../../api/patient-instructions.js";

function show(id: string): void {
	document.getElementById(id)?.classList.remove("hidden");
}
function hide(id: string): void {
	document.getElementById(id)?.classList.add("hidden");
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

// The step mounts in its loading state: the Note zone shows a loader and the
// derivations are disabled until renderNote() arrives with the generated note.
export function markup(): string {
	return `
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">

      <!-- Left: the note as editable JSON -->
      <div class="bg-white rounded-xl border border-grey-200 p-5">
        <div class="flex items-center gap-2 mb-3">
          <h2 class="font-semibold text-grey-400">Note</h2>
          <a href="https://docs.nabla.com/user/generate-note" target="_blank" rel="noopener" class="text-xs font-mono text-grey-250 hover:text-primary-600 bg-grey-100 hover:bg-primary-50 px-2 py-0.5 rounded transition-colors">POST /generate-note ↗</a>
        </div>
        <p class="text-xs text-grey-300 mb-2">Edit the note here — the generators on the right use the note below. In a real integration, you might want to allow users per-section edits.</p>
        <div id="note-loading" class="flex items-center gap-3 bg-grey-50 border border-grey-200 rounded-lg p-4 min-h-[200px]">
          <span class="w-5 h-5 rounded-full border-2 border-grey-200 border-t-primary-600 spin"></span>
          <span class="text-sm text-grey-300">Generating note from transcript and patient context…</span>
        </div>
        <textarea id="note-json" rows="22" spellcheck="false" class="hidden w-full px-3 py-2 text-xs font-mono border border-grey-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-y bg-grey-50 text-grey-400"></textarea>
      </div>

      <!-- Right: derived artifacts -->
      <div class="space-y-4">

        <!-- Normalize Data -->
        <div class="bg-white rounded-xl border border-grey-200 p-5">
          <div class="flex items-center gap-2 mb-1">
            <h3 class="font-semibold text-grey-400">Normalize Data</h3>
            <a href="https://docs.nabla.com/user/generate-normalized-data" target="_blank" rel="noopener" class="text-xs font-mono text-grey-250 hover:text-primary-600 bg-grey-100 hover:bg-primary-50 px-2 py-0.5 rounded transition-colors">POST /generate-normalized-data ↗</a>
          </div>
          <p class="text-xs text-grey-300 mb-4">Extract ICD-10 / LOINC codes in FHIR format from the note.</p>
          <button id="generate-normalized-btn" disabled class="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            Extract normalized data
          </button>
          <div id="normalized-output" class="hidden mt-4 bg-grey-50 border border-grey-200 rounded-lg p-4 text-sm">
            <div id="normalized-conditions" class="space-y-2"></div>
          </div>
        </div>

        <!-- Patient Instructions -->
        <div class="bg-white rounded-xl border border-grey-200 p-5">
          <div class="flex items-center gap-2 mb-1">
            <h3 class="font-semibold text-grey-400">Patient Instructions</h3>
            <a href="https://docs.nabla.com/user/generate-patient-instructions" target="_blank" rel="noopener" class="text-xs font-mono text-grey-250 hover:text-primary-600 bg-grey-100 hover:bg-primary-50 px-2 py-0.5 rounded transition-colors">POST /generate-patient-instructions ↗</a>
          </div>
          <p class="text-xs text-grey-300 mb-4">Generate plain-language post-visit instructions from the note.</p>
          <div class="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label class="block text-xs font-medium text-grey-300 mb-1.5">Language</label>
              <select id="instructions-locale" class="w-full px-3 py-1.5 text-sm border border-grey-200 rounded-lg bg-white">
                <option value="ENGLISH_US">English (US)</option>
                <option value="ENGLISH_UK">English (UK)</option>
                <option value="SPANISH_ES">Spanish (ES)</option>
                <option value="SPANISH_MX">Spanish (MX)</option>
                <option value="FRENCH_FR">French (FR)</option>
                <option value="ARABIC_EG">Arabic (EG)</option>
                <option value="MANDARIN_CN">Mandarin</option>
                <option value="PORTUGUESE_PT">Portuguese</option>
                <option value="RUSSIAN_RU">Russian</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-grey-300 mb-1.5">Recipient</label>
              <select id="recipient-type" class="w-full px-3 py-1.5 text-sm border border-grey-200 rounded-lg bg-white">
                <option value="PATIENT">Patient</option>
                <option value="PARENT">Parent / Guardian</option>
              </select>
            </div>
          </div>
          <button id="generate-instructions-btn" disabled class="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            Generate instructions
          </button>
          <div id="instructions-output" class="hidden mt-4 bg-grey-50 border border-grey-200 rounded-lg p-4 text-sm text-grey-300 leading-relaxed whitespace-pre-wrap"></div>
        </div>

      </div>
    </div>`;
}

export function renderNote(note: ClinicalNote): void {
	const textarea = document.getElementById(
		"note-json",
	) as HTMLTextAreaElement | null;
	if (textarea) {
		textarea.value = JSON.stringify(note, null, 2);
	}
	hide("note-loading");
	show("note-json");
	setDisabled("generate-normalized-btn", false);
	setDisabled("generate-instructions-btn", false);
}

// The note JSON is editable, so the textarea is the source of truth for the
// downstream calls. Throws if the user has made it invalid JSON.
export function readNoteDraft(): ClinicalNote {
	const rawJson = (document.getElementById("note-json") as HTMLTextAreaElement)
		.value;
	return JSON.parse(rawJson) as ClinicalNote;
}

export function readInstructionsLocale(): string {
	return (document.getElementById("instructions-locale") as HTMLSelectElement)
		.value;
}

export function readRecipientType(): RecipientType {
	return (document.getElementById("recipient-type") as HTMLSelectElement)
		.value as RecipientType;
}

export function setNormalizeLoading(): void {
	setButton("generate-normalized-btn", "Extracting…", true);
}
export function resetNormalizeButton(): void {
	setButton("generate-normalized-btn", "Extract normalized data", false);
}
export function setInstructionsLoading(): void {
	setButton("generate-instructions-btn", "Generating…", true);
}
export function resetInstructionsButton(): void {
	setButton("generate-instructions-btn", "Generate instructions", false);
}

export function renderConditions(normalizedData: NormalizedData): void {
	const container = document.getElementById("normalized-conditions");
	if (container) {
		container.innerHTML =
			normalizedData.conditions.length === 0
				? '<p class="text-xs text-grey-250 italic">No conditions extracted.</p>'
				: normalizedData.conditions
						.map(
							(condition) =>
								`<div class="flex items-center gap-3 text-xs">
            <span class="bg-primary-100 text-primary-700 px-2 py-0.5 rounded font-mono shrink-0">${condition.coding.code}</span>
            <span class="text-grey-400">${condition.coding.display}</span>
            <span class="ml-auto text-grey-250 shrink-0">${condition.clinical_status ?? ""}</span>
          </div>`,
						)
						.join("");
	}
	show("normalized-output");
}

export function renderInstructions(text: string): void {
	const output = document.getElementById("instructions-output");
	if (output) {
		output.textContent = text;
	}
	show("instructions-output");
}
