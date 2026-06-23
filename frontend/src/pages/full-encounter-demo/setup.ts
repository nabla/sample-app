import type { AudioSource } from "../../audio/audio-source.js";
import { markup, readAudioSource } from "./setup.render.js";
import { mountStep, type StepTeardown } from "./step.js";

interface SetupOptions {
	onNext: (audioSource: AudioSource) => void;
}

// Setup step allows the user to choose the audio source (microphone or mock audio file)
export function startStep(
	rootSelector: string,
	{ onNext }: SetupOptions,
): StepTeardown {
	return mountStep(rootSelector, markup(), ({ root, signal }) => {
		root
			.querySelector("#setup-next-btn")
			?.addEventListener("click", () => onNext(readAudioSource(root)), {
				signal,
			});
	});
}
