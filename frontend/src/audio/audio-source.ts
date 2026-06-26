import { startMicrophoneStream } from "./mic-stream.js";
import { loadWavFile, streamWavChunks } from "./wav-stream.js";

// Where the encounter audio comes from. The only place this discriminates is the
// registry below — everything downstream consumes the uniform AudioStream.
export type AudioSource = "microphone" | "wav-file";

// A running audio source, pushing PCM-16 chunks to the callback it was opened with,
// until stop() is called. A WAV file would otherwise end on its own, but we don't
// auto-stop on it — recording always ends when the user stops it.
export interface AudioStream {
  stop(): void;
}

type AudioStreamFactory = (
  onChunk: (pcm: Int16Array) => void,
) => Promise<AudioStream>;

const openMicrophoneStream: AudioStreamFactory = async (onChunk) => {
  const microphone = await startMicrophoneStream(onChunk);
  return {
    stop: () => microphone.stop(),
  };
};

const openWavFileStream: AudioStreamFactory = async (onChunk) => {
  const wavFile = await loadWavFile();
  let stopped = false;
  void (async () => {
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
  };
};

// Adding a source = one entry here + its factory. All audio sources are handled uniformly.
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
