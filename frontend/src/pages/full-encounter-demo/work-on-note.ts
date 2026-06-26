import {
	listNoteTemplates,
	type NoteLocale,
	updateNoteSettings,
} from "../../api/note-settings.js";
import { generateNormalizedData as apiGenerateNormalizedData } from "../../api/normalize.js";
import { generateNote as apiGenerateNote } from "../../api/note.js";
import { generatePatientInstructions as apiGeneratePatientInstructions } from "../../api/patient-instructions.js";
import type { TranscriptItem } from "../../api/transcribe.js";
import { mountStep, type StepTeardown, showError } from "./step.js";
import {
	markup,
	readInstructionsLocale,
	readNoteDraft,
	readNoteTemplateKey,
	readRecipientType,
	renderConditions,
	renderInstructions,
	renderNote,
	renderTemplateOptions,
	resetInstructionsButton,
	resetNoteGenerating,
	resetNormalizeButton,
	setInstructionsLoading,
	setNoteGenerating,
	setNormalizeLoading,
} from "./work-on-note.render.js";

// The note locale is set alongside the template; kept fixed here for simplicity.
const NOTE_LOCALE: NoteLocale = "ENGLISH_US";

interface WorkOnNoteOptions {
	transcript: TranscriptItem[];
	patientContext: string;
}

export function startStep(
	rootSelector: string,
	{ transcript, patientContext }: WorkOnNoteOptions,
): StepTeardown {
	return mountStep(rootSelector, markup(), ({ root, signal }) => {

		// Load the template library, then generate an initial note with the first one.
		void init();

		async function init(): Promise<void> {
			try {
				renderTemplateOptions(await listNoteTemplates());
			} catch (error) {
				showError(error);
				return;
			}
			await generateNote();
		}

		// Set the chosen template as the user's note settings, then generate the note.
		// Clears the derived outputs, which belonged to the previous note.
		async function generateNote(): Promise<void> {
			setNoteGenerating();
			try {
				await updateNoteSettings({
					noteTemplateKey: readNoteTemplateKey(),
					noteLocale: NOTE_LOCALE,
				});
				renderNote(
					await apiGenerateNote({ transcriptItems: transcript, patientContext }),
				);
			} catch (error) {
				showError(error);
			} finally {
				resetNoteGenerating();
			}
		}

		async function generateNormalizedData(): Promise<void> {
			setNormalizeLoading();
			try {
				// Generate the normalized data using the generated note
				renderConditions(await apiGenerateNormalizedData(readNoteDraft()));
			} catch (error) {
				showError(error);
			} finally {
				resetNormalizeButton();
			}
		}

		async function generatePatientInstructions(): Promise<void> {
			setInstructionsLoading();
			try {
				renderInstructions(
					// Generate the patient instructions using the generated note
					await apiGeneratePatientInstructions({
						note: readNoteDraft(),
						instructions_locale: readInstructionsLocale(),
						recipient_type: readRecipientType(),
					}),
				);
			} catch (error) {
				showError(error);
			} finally {
				resetInstructionsButton();
			}
		}

		root
			.querySelector("#note-generate-btn")
			?.addEventListener("click", () => void generateNote(), { signal });
		root
			.querySelector("#generate-normalized-btn")
			?.addEventListener("click", () => void generateNormalizedData(), { signal });
		root
			.querySelector("#generate-instructions-btn")
			?.addEventListener("click", () => void generatePatientInstructions(), { signal });
	});
}
