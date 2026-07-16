import { TRANSCRIBE_SAMPLE_RATE_HZ } from "../api/transcribe.js";
// The AudioWorklet must be loaded as a JS module by URL. `?no-inline` tells Vite to
// emit it as a hashed asset and give us its URL, never an inlined `data:` URL (which
// `addModule` rejects) — so it can live next to this file instead of `public/`.
import rawPcm16ProcessorUrl from "./rawPcm16Processor.js?url&no-inline";

const CHUNK_DURATION_MS = 100;
const CHUNK_SAMPLES =
  (TRANSCRIBE_SAMPLE_RATE_HZ * CHUNK_DURATION_MS) / 1000;

// #region microphone-stream
export async function startMicrophoneStream(
  onChunk: (chunk: Int16Array) => void,
): Promise<{
  stop: () => void;
}> {
  // In case multiple microphones are available, you should allow the user to select
  // which one to use.
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
  const worklet = new AudioWorkletNode(audioCtx, "rawPcm16Processor", {
    processorOptions: { chunkSamples: CHUNK_SAMPLES },
  });

  // The worklet converts and chunks on the audio thread; the main thread just forwards.
  worklet.port.onmessage = ({ data }: MessageEvent<Int16Array>) => {
    onChunk(data);
  };

  mediaStreamSource.connect(worklet);

  return {
    stop: () => {
      mediaStreamSource.disconnect();
      worklet.disconnect();
      stream.getTracks().forEach((track) => track.stop());
      void audioCtx.close();
    },
  };
}
// #endregion microphone-stream
