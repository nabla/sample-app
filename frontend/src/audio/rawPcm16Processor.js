// #region pcm16-worklet

// An AudioWorklet that converts the browser's Float32 mic samples to PCM_S16LE and
// emits fixed-size chunks — the encoding and pacing the Nabla streaming APIs require.
// Loaded via audioWorklet.addModule().
class RawPcm16Processor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const chunkSamples = options.processorOptions?.chunkSamples ?? 1600;
    this.accumulator = new Pcm16ChunkAccumulator(this.port, chunkSamples);
  }

  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) {
      return true;
    }
    this.accumulator.appendFloat32(input);
    return true;
  }
}

// Buffers converted PCM samples until a full chunk is ready, then posts it to the
// main thread. Lives entirely on the audio rendering thread.
class Pcm16ChunkAccumulator {
  constructor(port, chunkSamples) {
    this.port = port;
    this.chunkSamples = chunkSamples;
    this.buffer = new Int16Array(chunkSamples);
    this.length = 0;
  }

  appendFloat32(input) {
    for (let i = 0; i < input.length; i++) {
      this.buffer[this.length++] = input[i] * 0x7fff;
      if (this.length === this.chunkSamples) {
        this.port.postMessage(this.buffer, [this.buffer.buffer]);
        this.buffer = new Int16Array(this.chunkSamples);
        this.length = 0;
      }
    }
  }
}

registerProcessor("rawPcm16Processor", RawPcm16Processor);
// #endregion pcm16-worklet
