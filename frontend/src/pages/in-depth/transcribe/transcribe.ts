import {
	buildAudioChunk,
	buildTranscribeConfig,
	connectTranscribeWebSocket,
	TRANSCRIBE_END_MESSAGE,
	type TranscribeServerMessage,
	type TranscriptItem,
} from "../../../api/transcribe.js";
import transcribeApiSource from "../../../api/transcribe.ts?raw";
import bufferedStreamSource from "../../../audio/buffered-stream.ts?raw";
import {
	type AudioSource,
	openAudioStream,
} from "../../../audio/audio-source.js";
import micStreamSource from "../../../audio/mic-stream.ts?raw";
import rawPcm16ProcessorSource from "../../../audio/rawPcm16Processor.js?raw";
import { extractRegion } from "../../../shared/codeExtract.js";
import { initPageChrome } from "../../../shared/page-chrome.js";
import { saveTranscriptItems } from "../../../shared/storage.js";
import {
	collectFinalTranscriptItems,
	createSession,
	currentTranscriptItems,
	recordTranscriptItem,
	type TranscriptionSession,
} from "../../../shared/transcription-session.js";
import clientSource from "../../../transport/client.ts?raw";
import transcribePageSource from "./transcribe.ts?raw";
import {
	addWsMessage,
	readAudioSourceSelection,
	renderCodeSnippets,
	renderTranscript,
	resetLog,
	resetTranscriptArea,
	setDisconnectedState,
	setLatencyState,
	setLoadingState,
	setReconnectedState,
	setRecordingState,
	setStartState,
	startBufViz,
	stopBufViz,
	switchWsTab,
	updateTranscriptStats,
	updateWsStatus,
} from "./transcribe.render.js";

// The "Code" tab is rendered from these real source regions — see #region markers.
const CODE_SNIPPETS = [
	{
		title: "1. Capture mic audio in 100 ms PCM chunks",
		file: "audio/mic-stream.ts",
		source: micStreamSource,
		region: "microphone-stream",
	},
	{
		title: "2. Convert mic audio to PCM-16 (AudioWorklet)",
		file: "audio/rawPcm16Processor.js",
		source: rawPcm16ProcessorSource,
		region: "pcm16-worklet",
	},
	{
		title: "3. Open the socket with auth",
		file: "transport/client.ts",
		source: clientSource,
		region: "nabla-websocket",
	},
	{
		title: "4. Build the CONFIG and audio-chunk messages",
		file: "api/transcribe.ts",
		source: transcribeApiSource,
		region: "transcribe-messages",
	},
	{
		title: "5. Receive transcript items & detect completion",
		file: "pages/in-depth/transcribe/transcribe.ts",
		source: transcribePageSource,
		region: "receive-transcript",
	},
	{
		title: "6. Buffer & replay on reconnect",
		file: "audio/buffered-stream.ts",
		source: bufferedStreamSource,
		region: "buffered-audio-stream",
	},
];

let activeSession: TranscriptionSession | null = null;
let finalizing = false;

// During a latency spike, each ACK is held this long before processing — the spike
// also lasts this long, so the window fills and the queue backs up, then recovers.
const SIMULATED_ACK_LATENCY_MS = 10000;
let ackLatencyMs = 0;

// After we send END the server flushes its remaining transcript items and then
// closes the socket — that close is how we know everything has arrived. Re-armed
// for each connection.
let serverClosed: Promise<void> = Promise.resolve();
let resolveServerClosed: () => void = () => {};

function armServerClosed(): void {
	serverClosed = new Promise<void>((resolve) => {
		resolveServerClosed = resolve;
	});
}

function main(): void {
	initPageChrome();
	setStartState();
	renderCodeSnippets(
		CODE_SNIPPETS.map((snippet) => ({
			title: snippet.title,
			label: `${snippet.file} · #region ${snippet.region}`,
			code: extractRegion(snippet.source, snippet.region),
		})),
	);
	exposePageHandlers();
}

function exposePageHandlers(): void {
	const windowHandlers = window as unknown as Record<string, unknown>;
	windowHandlers.switchWsTab = switchWsTab;
	windowHandlers.startTranscribing = startTranscribing;
	windowHandlers.stopTranscribing = stopTranscribing;
	windowHandlers.simulateDisconnect = simulateDisconnect;
	windowHandlers.simulateReconnect = simulateReconnect;
	windowHandlers.simulateHighLatency = simulateHighLatency;
}

main();

export async function startTranscribing(): Promise<void> {
	setLoadingState();
	try {
		const audioSource = getAudioSource();
		prepareNewSession();
		await openTranscribeSession(audioSource === "wav-file");
		startBufViz(() => activeSession?.bufferedAudioStream.getStats());
		const session = activeSession!;
		const audio = await openAudioStream(audioSource, (chunk) =>
			sendAudioChunk(session, chunk),
		);
		session.stopAudio = audio.stop;
		// A WAV ends on its own → finalize when it does; the mic ends only on Stop.
		void audio.completed.then(() => {
			if (activeSession === session) {
				void finalize(session);
			}
		});
	} catch (error) {
		alert(error instanceof Error ? error.message : String(error));
		setStartState();
	}
}

export async function stopTranscribing(): Promise<void> {
	if (activeSession) {
		await finalize(activeSession);
	}
}

export async function simulateDisconnect(): Promise<void> {
	if (!activeSession) {
		return;
	}
	setDisconnectedState();
	addWsMessage("system", "Connection lost — buffering audio locally");
	activeSession.socket.close();
}

export async function simulateReconnect(): Promise<void> {
	if (!activeSession) {
		return;
	}
	setReconnectedState();
	addWsMessage("system", "Reconnecting…");
	const socket = await openTranscribeSocket();
	reconnectSession(activeSession, socket);
	logReplayCount(activeSession);
	activeSession.bufferedAudioStream.replayAll();
}

// A one-shot latency spike: delay ACKs for a few seconds so the in-flight window
// fills and the queue backs up, then auto-recover so the backlog drains. (A *sustained*
// delay can't be stable — the window only hides MAX_UNACKED/latency chunks per second,
// which for a fixed real-time source below the input rate would grow the queue forever.)
export function simulateHighLatency(): void {
	if (ackLatencyMs > 0) {
		return; // a spike is already in progress
	}
	ackLatencyMs = SIMULATED_ACK_LATENCY_MS;
	setLatencyState(true);
	setTimeout(() => {
		ackLatencyMs = 0;
		setLatencyState(false);
	}, SIMULATED_ACK_LATENCY_MS);
}

async function openTranscribeSession(isMockRecording: boolean): Promise<void> {
	const socket = await openTranscribeSocket();
	activeSession = createSession(socket);
	armServerClosed();
	attachSocketHandlers(activeSession);
	sendTranscribeConfig(socket);
	setRecordingState(isMockRecording);
}

async function openTranscribeSocket(): Promise<WebSocket> {
	updateWsStatus("connecting");
	const socket = await connectTranscribeWebSocket();
	updateWsStatus("connected");
	addWsMessage("system", "WebSocket connected");
	return socket;
}

// #region receive-transcript
function attachSocketHandlers(session: TranscriptionSession): void {
	session.socket.onmessage = (event: MessageEvent<string>) =>
		handleSocketMessage(session, event);
	session.socket.onclose = () => {
		updateWsStatus("closed");
		addWsMessage("system", "WebSocket closed");
		resolveServerClosed();
	};
}

function handleSocketMessage(
	session: TranscriptionSession,
	event: MessageEvent<string>,
): void {
	const message = JSON.parse(event.data) as TranscribeServerMessage;
	if (message.type === "AUDIO_CHUNK_ACK" && message.ack_id !== undefined) {
		void handleAck(session, message.ack_id);
	} else if (message.type === "TRANSCRIPT_ITEM") {
		addWsMessage("recv", event.data);
		handleTranscriptItem(session, message);
	} else {
		addWsMessage("recv", event.data);
	}
}

function handleTranscriptItem(
	session: TranscriptionSession,
	item: TranscriptItem,
): void {
	recordTranscriptItem(session, item);
	const items = currentTranscriptItems(session);
	renderTranscript(items);
	updateTranscriptStats(items);
}
// #endregion receive-transcript

// Processing an ACK frees a slot in the send window. During a latency spike the ACK
// is held for a few seconds first, so the in-flight window fills and chunks back up
// in the queue — the flow control keeps working, it just shows the buffer absorbing
// the lag. (Throttling our sends this way also paces transcript items, since the
// server only transcribes audio we've actually sent.)
async function handleAck(session: TranscriptionSession, ackId: number): Promise<void> {
	if (ackLatencyMs > 0) {
		await sleep(ackLatencyMs);
	}
	if (activeSession !== session) {
		return; // a late ACK for a session we've finalized or replaced
	}
	session.bufferedAudioStream.handlePacketAck({ ack_id: ackId });
	addWsMessage("recv", `{"type":"AUDIO_CHUNK_ACK","ack_id":${ackId}}`);
}

const sleep = (ms: number): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, ms));

function sendTranscribeConfig(socket: WebSocket): void {
	const config = buildTranscribeConfig();
	socket.send(JSON.stringify(config));
	addWsMessage("send", JSON.stringify(config));
}

function sendAudioChunk(
	session: TranscriptionSession,
	audioChunk: Int16Array,
): void {
	const message = buildAudioChunk(session.nextChunkSequenceNumber++, audioChunk);
	session.bufferedAudioStream.sendAndBuffer(message);
	addWsMessage("send", JSON.stringify(message));
}

function reconnectSession(
	session: TranscriptionSession,
	socket: WebSocket,
): void {
	session.bufferedAudioStream.reconnect(socket);
	session.socket = socket;
	armServerClosed();
	attachSocketHandlers(session);
	sendTranscribeConfig(socket);
}

function logReplayCount(session: TranscriptionSession): void {
	const { inflight, queued } = session.bufferedAudioStream.getStats();
	addWsMessage("system", `Replaying ${inflight + queued} buffered packets`);
}

function prepareNewSession(): void {
	resetLog();
	switchWsTab("key");
	resetTranscriptArea();
	updateTranscriptStats([]);
	activeSession = null;
	ackLatencyMs = 0;
	setLatencyState(false);
}

// Graceful shutdown: stop audio, tell the server we're done, then wait for it to
// flush the remaining transcript items and close the socket itself.
async function finalize(session: TranscriptionSession): Promise<void> {
	if (finalizing) {
		return;
	}
	finalizing = true;
	activeSession = null; // halt the capture loop and block re-entry
	session.stopAudio?.();
	if (session.socket.readyState === WebSocket.OPEN) {
		session.socket.send(JSON.stringify(TRANSCRIBE_END_MESSAGE));
		addWsMessage("send", JSON.stringify(TRANSCRIBE_END_MESSAGE));
	}
	await serverClosed;
	stopBufViz();
	setStartState();
	const transcriptItems = collectFinalTranscriptItems(session);
	if (transcriptItems.length > 0) {
		saveTranscriptItems(transcriptItems);
	}
	finalizing = false;
}

function getAudioSource(): AudioSource {
	const rawSelection = readAudioSourceSelection();
	return rawSelection === "mic" ? "microphone" : "wav-file";
}
