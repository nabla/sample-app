import { generateNormalizedData as apiGenerateNormalizedData } from "../../api/normalize.js";
import { generateNote as apiGenerateNote } from "../../api/note.js";
import { generatePatientInstructions as apiGeneratePatientInstructions } from "../../api/patient-instructions.js";
import type { TranscriptItem } from "../../api/transcribe.js";
import { mountStep, type StepTeardown, showError } from "./step.js";
import {
	markup,
	readInstructionsLocale,
	readNoteDraft,
	readRecipientType,
	renderConditions,
	renderInstructions,
	renderNote,
	resetInstructionsButton,
	resetNormalizeButton,
	setInstructionsLoading,
	setNormalizeLoading,
} from "./work-on-note.render.js";

interface WorkOnNoteOptions {
	transcript: TranscriptItem[];
	patientContext: string;
}

export function startStep(
	rootSelector: string,
	{ transcript, patientContext }: WorkOnNoteOptions,
): StepTeardown {
	return mountStep(rootSelector, markup(), ({ root, signal }) => {

		// Generate the note on entry; it replaces the loader and enables the derivations.
		void generateNote();

		async function generateNote(): Promise<void> {
			try {
				renderNote(
					// Generate the note using the generated transcript and patient context
					await apiGenerateNote({
						transcriptItems: transcript,
						patientContext,
					}),
				);
			} catch (error) {
				showError(error);
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
			.querySelector("#generate-normalized-btn")
			?.addEventListener("click", () => void generateNormalizedData(), { signal });
		root
			.querySelector("#generate-instructions-btn")
			?.addEventListener("click", () => void generatePatientInstructions(), { signal });
	});
}
