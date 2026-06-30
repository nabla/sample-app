import { TRANSCRIBE_SAMPLE_RATE_HZ } from "../api/transcribe.js";
// The AudioWorklet must be loaded as a JS module by URL. `?no-inline` tells Vite to
// emit it as a hashed asset and give us its URL, never an inlined `data:` URL (which
// `addModule` rejects) — so it can live next to this file instead of `public/`.
import rawPcm16ProcessorUrl from "./rawPcm16Processor.js?url&no-inline";

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
  const worklet = new AudioWorkletNode(audioCtx, "rawPcm16Processor");

  const CHUNK_SAMPLES = TRANSCRIBE_SAMPLE_RATE_HZ / 10; // 100 ms of audio
  let chunkBuffer = new Int16Array(CHUNK_SAMPLES);
  let chunkBufferCurrentLength = 0;

  worklet.port.onmessage = ({
    data: incomingSamples,
  }: MessageEvent<Int16Array>) => {
    let alreadyAdded = 0;
    while (alreadyAdded < incomingSamples.length) {
      const samplesToTake = Math.min(
        CHUNK_SAMPLES - chunkBufferCurrentLength, // The remaining space in the buffer
        incomingSamples.length - alreadyAdded, // The remaining samples in the incoming array
      );
      for (let i = 0; i < samplesToTake; i++) {
        chunkBuffer[chunkBufferCurrentLength + i] = incomingSamples[alreadyAdded + i];
      }
      chunkBufferCurrentLength += samplesToTake;
      alreadyAdded += samplesToTake;
      if (chunkBufferCurrentLength === CHUNK_SAMPLES) {
        onChunk(chunkBuffer);
        chunkBuffer = new Int16Array(CHUNK_SAMPLES);
        chunkBufferCurrentLength = 0;
      }
    }
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
