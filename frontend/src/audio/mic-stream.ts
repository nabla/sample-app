import { TRANSCRIBE_SAMPLE_RATE_HZ } from "../api/transcribe.js";

// The AudioWorklet must be loaded as a JS module by URL. `new URL(..., import.meta.url)`
// lets Vite emit it as a hashed asset and resolve the URL, so it can live next to
// this file instead of in `public/`.
const rawPcm16ProcessorUrl = new URL("./rawPcm16Processor.js", import.meta.url)
	.href;

// #region microphone-stream
export async function startMicrophoneStream(
	onChunk: (chunk: Int16Array) => void,
): Promise<{
	stop: () => void;
	audioCtx: AudioContext;
}> {
	const stream = await navigator.mediaDevices.getUserMedia({
		audio: {
			sampleRate: TRANSCRIBE_SAMPLE_RATE_HZ,
			channelCount: 1,
			echoCancellation: false,
			noiseSuppression: false,
		},
	});

	const audioCtx = new AudioContext({
		sampleRate: TRANSCRIBE_SAMPLE_RATE_HZ,
	});
	await audioCtx.audioWorklet.addModule(rawPcm16ProcessorUrl);

	const mediaStreamSource = audioCtx.createMediaStreamSource(stream);
	const worklet = new AudioWorkletNode(audioCtx, "rawPcm16Processor");

	const CHUNK_SAMPLES = TRANSCRIBE_SAMPLE_RATE_HZ / 10; // 100 ms of audio
	let pendingSamples = new Int16Array(0);

	worklet.port.onmessage = ({
		data: incomingSamples,
	}: MessageEvent<Int16Array>) => {
		const combinedSamples = new Int16Array(
			pendingSamples.length + incomingSamples.length,
		);
		combinedSamples.set(pendingSamples);
		combinedSamples.set(incomingSamples, pendingSamples.length);
		pendingSamples = combinedSamples;
		while (pendingSamples.length >= CHUNK_SAMPLES) {
			onChunk(pendingSamples.slice(0, CHUNK_SAMPLES));
			pendingSamples = pendingSamples.slice(CHUNK_SAMPLES);
		}
	};

	mediaStreamSource.connect(worklet);

	return {
		audioCtx,
		stop: () => {
			mediaStreamSource.disconnect();
			worklet.disconnect();
			stream.getTracks().forEach((track) => track.stop());
			void audioCtx.close();
		},
	};
}
// #endregion microphone-stream
