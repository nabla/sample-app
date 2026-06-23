// #region pcm16-worklet
// An AudioWorklet that converts the browser's Float32 mic samples to PCM_S16LE —
// the encoding the Nabla streaming APIs require. Loaded via audioWorklet.addModule().
class RawPcm16Processor extends AudioWorkletProcessor {
	process(inputs) {
		const input = inputs[0]?.[0];
		if (!input) {
			return true;
		}
		const pcm16 = new Int16Array(input.length);
		for (let i = 0; i < input.length; i++) {
			const s = Math.max(-1, Math.min(1, input[i]));
			pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
		}
		this.port.postMessage(pcm16, [pcm16.buffer]);
		return true;
	}
}
registerProcessor("rawPcm16Processor", RawPcm16Processor);
// #endregion pcm16-worklet
