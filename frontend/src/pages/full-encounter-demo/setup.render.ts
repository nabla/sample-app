import type { AudioSource } from "../../audio/audio-source.js";

export function markup(): string {
	return `
    <div class="bg-white rounded-xl border border-grey-200 p-6 max-w-xl">
      <h2 class="font-semibold text-grey-400 mb-1">Start Encounter</h2>
      <p class="text-xs text-grey-300 mb-5">Choose how you'll capture the encounter audio.</p>

      <label class="block text-xs font-medium text-grey-300 mb-1.5">Audio source</label>
      <select id="audio-source" class="w-full px-3 py-1.5 text-sm border border-grey-200 rounded-lg bg-white mb-6">
        <option value="mock">Mock audio — primary_care.wav</option>
        <option value="mic">Live microphone</option>
      </select>

      <button id="setup-next-btn" class="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors">
        Next →
      </button>
    </div>`;
}

export function readAudioSource(root: HTMLElement): AudioSource {
	const value = (root.querySelector("#audio-source") as HTMLSelectElement)
		.value;
	return value === "mic" ? "microphone" : "wav-file";
}
