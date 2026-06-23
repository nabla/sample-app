import { startMicrophoneStream } from "./mic-stream.js";
import { loadWavFile, streamWavChunks } from "./wav-stream.js";

// Where the encounter audio comes from. The only place this discriminates is the
// registry below — everything downstream consumes the uniform AudioStream.
export type AudioSource = "microphone" | "wav-file";

// A running audio source, pushing PCM-16 chunks to the callback it was opened with.
// `completed` resolves when no more audio will come — for a WAV when the file is
// exhausted, for the microphone when stop() is called (the mic never ends on its own).
export interface AudioStream {
	stop(): void;
	completed: Promise<void>;
}

type AudioStreamFactory = (
	onChunk: (pcm: Int16Array) => void,
) => Promise<AudioStream>;

const openMicrophoneStream: AudioStreamFactory = async (onChunk) => {
	let resolveCompleted = () => {};
	const completed = new Promise<void>((resolve) => {
		resolveCompleted = resolve;
	});
	const microphone = await startMicrophoneStream(onChunk);
	return {
		stop: () => {
			microphone.stop();
			resolveCompleted();
		},
		completed,
	};
};

const openWavFileStream: AudioStreamFactory = async (onChunk) => {
	const wavFile = await loadWavFile();
	let stopped = false;
	const completed = (async () => {
		for await (const chunk of streamWavChunks(wavFile)) {
			if (stopped) {
				break;
			}
			onChunk(chunk);
		}
	})();
	return {
		stop: () => {
			stopped = true;
		},
		completed,
	};
};

// Adding a source = one entry here + its factory. No consumer changes, no `if`.
const AUDIO_SOURCES: Record<AudioSource, AudioStreamFactory> = {
	microphone: openMicrophoneStream,
	"wav-file": openWavFileStream,
};

export function openAudioStream(
	source: AudioSource,
	onChunk: (pcm: Int16Array) => void,
): Promise<AudioStream> {
	return AUDIO_SOURCES[source](onChunk);
}
