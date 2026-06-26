import type { TranscriptItem } from "../../api/transcribe.js";
import {
  type AudioSource,
  type AudioStream,
  openAudioStream,
} from "../../audio/audio-source.js";
import { saveTranscriptItems } from "../../shared/storage.js";
import { TranscriptionSession } from "../../transcribe/transcription-session.js";
import {
  markup,
  readPatientContext,
  renderFullTranscript,
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

// Record step: capture an encounter and produce a transcript, then hand it to the note step.
export function startStep(
  rootSelector: string,
  { audioSource, onNext }: RecordOptions,
): StepTeardown {
  return mountStep(rootSelector, markup(), ({ root, signal }) => {
    // One session for the whole step; each take is a start()/stop() on it. `audio`
    // being non-null means a take is in progress. Per-mount closure, so re-entering
    // the step (via restart) starts fresh.
    const transcriptionSession = new TranscriptionSession();
    let audio: AudioStream | null = null;

    // Re-render the live transcript from the session as items arrive (wired once).
    transcriptionSession.onTranscriptItem(() =>
      renderFullTranscript(transcriptionSession.items()),
    );

    async function startRecording(): Promise<void> {
      setRecordingState();
      // "Record" continues the same transcript — the session keeps prior items
      // across start()/stop(), so a new take appends rather than replacing.
      await transcriptionSession.start();
      // The page bridges audio → session; neither side knows about the other.
      audio = await openAudioStream(audioSource, (pcm) =>
        transcriptionSession.sendAudio(pcm),
      );
    }

    // Stop button: end the take and return to the review state.
    async function stopRecording(): Promise<void> {
      await stopRecordingAndWaitForItems();
      setReviewState(transcriptionSession.items().length > 0);
    }

    // Generate ends any active take first, then hands the accumulated transcript
    // (live, mock, or both) to the note step.
    async function generate(): Promise<void> {
      await stopRecordingAndWaitForItems();
      proceedToNote();
    }

    // Stop the take and wait for the server's remaining transcript items.
    async function stopRecordingAndWaitForItems(): Promise<void> {
      audio?.stop();
      audio = null;
      setFinishingState();
      await transcriptionSession.stop();
    }

    function proceedToNote(): void {
      const transcript = transcriptionSession.items();
      saveTranscriptItems(transcript);
      onNext({ transcript, patientContext: readPatientContext() });
    }

    async function fillMock(): Promise<void> {
      transcriptionSession.clear();
      transcriptionSession.addItems(await loadMockTranscript());
      renderFullTranscript(transcriptionSession.items());
      setReviewState(true);
    }

    root
      .querySelector("#start-btn")
      ?.addEventListener("click", handle(startRecording), { signal });
    root
      .querySelector("#stop-btn")
      ?.addEventListener("click", handle(stopRecording), { signal });
    root
      .querySelector("#fill-mock-btn")
      ?.addEventListener("click", handle(fillMock), { signal });
    root
      .querySelector("#generate-note-btn")
      ?.addEventListener("click", handle(generate), { signal });
    setReviewState(false);
    // Leaving the step mid-recording abandons the connection + mic.
    signal.addEventListener("abort", () => {
      audio?.stop();
      transcriptionSession.disconnect();
    });
  });
}

// Run an async click handler, surfacing failures via showError
const handle = (action: () => Promise<void>) =>
  (): void => {
    void action().catch(showError);
  };

async function loadMockTranscript(): Promise<TranscriptItem[]> {
  const response = await fetch("/transcript_items.json");
  return response.json() as Promise<TranscriptItem[]>;
}
