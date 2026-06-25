// The streaming APIs expect each AUDIO_CHUNK's PCM-16 payload as a base64 string.
// This is a wire-format concern (used by the message builders), independent of where
// the audio came from — microphone or WAV file.
export function encodePcm16ToBase64(pcmData: Int16Array): string {
	const bytes = new Uint8Array(
		pcmData.buffer,
		pcmData.byteOffset,
		pcmData.byteLength,
	);
	let binary = "";
	for (let byteIndex = 0; byteIndex < bytes.byteLength; byteIndex++) {
		binary += String.fromCodePoint(bytes[byteIndex]);
	}
	return btoa(binary);
}
