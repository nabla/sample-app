import type { TranscriptItem } from "../../api/transcribe.js";
import {
	type LiveTranscription,
	startTranscription,
} from "../../audio/transcription.js";
import { saveTranscriptItems } from "../../shared/storage.js";
import type { AudioSource } from "../../audio/audio-source.js";
import {
	markup,
	readPatientContext,
	renderFullTranscript,
	renderTranscriptItem,
	resetTranscriptArea,
	setFinishingState,
	setRecordingState,
	setReviewState,
} from "./record.render.js";
import { mountStep, type StepTeardown, showError } from "./step.js";

interface RecordOptions {
	audioSource: AudioSource;
	onNext: (result: {
		transcript: TranscriptItem[];
		patientContext: string;
	}) => void;
}

// Record step allows the user to record an encounter and generate a transcript
export function startStep(
	rootSelector: string,
	{ audioSource, onNext }: RecordOptions,
): StepTeardown {
	return mountStep(rootSelector, markup(), ({ root, signal }) => {
		// Per-mount state — re-entering the step (via restart) gets a fresh closure.
		let transcript: TranscriptItem[] = [];
		let live: LiveTranscription | null = null;
		let recordingAbort: AbortController | null = null;

		async function startRecording(): Promise<void> {
			try {
				resetTranscriptArea();
				recordingAbort = new AbortController();
				
				// Start the transcription session
				// This will call us back with each transcript item as it arrives
				// The callback will render the transcript items in the UI
				const session = await startTranscription(
					audioSource,
					renderTranscriptItem,
					recordingAbort.signal,
				);
				live = session;
				setRecordingState();
				
				void session.audioComplete.then(() => {
					if (live === session) {
						void finishTake(false);
					}
				});
			} catch (error) {
				showError(error);
			}
		}

		// Ends the active recording and either proceeds to the note or returns to review.
		async function finishTake(proceed: boolean): Promise<void> {
			const session = live;
			if (!session) {
				return;
			}
			live = null;
			recordingAbort = null;
			setFinishingState();
			try {
				// We need to wait to get all the transcript items from the server
				transcript = await session.finish();
				if (proceed) {
					proceedToNote();
				} else {
					setReviewState(transcript.length > 0);
				}
			} catch (error) {
				showError(error);
			}
		}

		async function fillMock(): Promise<void> {
			try {
				transcript = await loadMockTranscript();
				renderFullTranscript(transcript);
				setReviewState(true);
			} catch (error) {
				showError(error);
			}
		}

		// While recording, Generate ends the take then moves on; otherwise we already
		// have a transcript (a finished take or mock) and go straight to the note.
		function generate(): void {
			if (live) {
				void finishTake(true);
			} else if (transcript.length > 0) {
				proceedToNote();
			}
		}

		function proceedToNote(): void {
			saveTranscriptItems(transcript);
			// When we have a transcript, we can proceed to note generation
			onNext({ transcript, patientContext: readPatientContext() });
		}

		root
			.querySelector("#start-btn")
			?.addEventListener("click", () => void startRecording(), { signal });
		root
			.querySelector("#stop-btn")
			?.addEventListener("click", () => void finishTake(false), { signal });
		root
			.querySelector("#fill-mock-btn")
			?.addEventListener("click", () => void fillMock(), { signal });
		root
			.querySelector("#generate-note-btn")
			?.addEventListener("click", generate, { signal });
		setReviewState(false);
		// Leaving the step mid-recording abandons the live session's socket/mic.
		signal.addEventListener("abort", () => recordingAbort?.abort());
	});
}

async function loadMockTranscript(): Promise<TranscriptItem[]> {
	const response = await fetch("/transcript_items.json");
	return response.json() as Promise<TranscriptItem[]>;
}
