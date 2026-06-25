// Decodes a WAV file and streams it as PCM-16 chunks — used to feed the mock audio
// source to the streaming APIs.

export function decodeWavHeader(buffer: ArrayBuffer): {
	sampleRate: number;
	dataOffset: number;
	dataLength: number;
} {
	const dataView = new DataView(buffer);
	const sampleRate = dataView.getUint32(24, true);
	let offset = 12;
	while (offset < buffer.byteLength - 8) {
		const chunkId = String.fromCharCode(
			dataView.getUint8(offset),
			dataView.getUint8(offset + 1),
			dataView.getUint8(offset + 2),
			dataView.getUint8(offset + 3),
		);
		const chunkSize = dataView.getUint32(offset + 4, true);
		if (chunkId === "data") {
			return {
				sampleRate,
				dataOffset: offset + 8,
				dataLength: chunkSize,
			};
		}
		offset += 8 + chunkSize;
	}
	throw new Error("No data chunk found in WAV file");
}

const CHUNK_SAMPLES = 1600; // 100ms at 16kHz

export async function* streamWavChunks(
	wavBuffer: ArrayBuffer,
	intervalMs = 100,
): AsyncGenerator<Int16Array> {
	const { dataOffset, dataLength } = decodeWavHeader(wavBuffer);
	const pcmSamples = new Int16Array(wavBuffer, dataOffset, dataLength / 2);
	let offset = 0;
	while (offset < pcmSamples.length) {
		const chunk = pcmSamples.slice(offset, offset + CHUNK_SAMPLES);
		offset += CHUNK_SAMPLES;
		yield chunk;
		await new Promise<void>((resolve) => setTimeout(resolve, intervalMs));
	}
}

// The bundled mock encounter audio, fetched once and cached for the session.
let wavFileBuffer: ArrayBuffer | null = null;

export async function loadWavFile(): Promise<ArrayBuffer> {
	if (!wavFileBuffer) {
		const response = await fetch("/primary_care.wav");
		wavFileBuffer = await response.arrayBuffer();
	}
	return wavFileBuffer;
}
