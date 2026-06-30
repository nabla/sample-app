import type { TranscriptItem } from "../../api/transcribe.js";
import { initPageChrome } from "../../shared/page-chrome.js";
import type { AudioSource } from "../../audio/audio-source.js";
import * as record from "./record.js";
import * as setup from "./setup.js";
import * as workOnNote from "./work-on-note.js";

// One encounter = setup → record → work-on-note. Each step renders into #encounter-root
// and calls back when it's done; this orchestrator is just the wiring between them.
// Entering a step tears down the previous one (its listeners detach, its DOM clears).

const ROOT = "#encounter-root";

let exitStep: () => void = () => {};

function main(): void {
  initPageChrome();
  document.getElementById("restart-link")?.addEventListener("click", goToSetup);
  goToSetup();
}

main();

function goToSetup(): void {
  setRestartVisible(false); // nothing to go back to from the first step
  exitStep();
  // Setup step allows the user to choose the audio source (microphone or mock audio file)
  exitStep = setup.startStep(ROOT, { onNext: goToRecord });
}

function goToRecord(audioSource: AudioSource): void {
  setRestartVisible(true);
  exitStep();
  // Record step allows the user to record an encounter and generate a transcript
  exitStep = record.startStep(ROOT, { audioSource, onNext: goToWorkOnNote });
}

function goToWorkOnNote(result: {
  transcript: TranscriptItem[];
  patientContext: string;
}): void {
  exitStep();
  // Work on note will first generate the note from the transcript and patient context
  // then allow the user to generate ICD-10 / LOINC Codes and patient instructions
  exitStep = workOnNote.startStep(ROOT, result);
}

function setRestartVisible(visible: boolean): void {
  document.getElementById("restart-link")?.classList.toggle("hidden", !visible);
}
