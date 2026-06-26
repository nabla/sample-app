import transcribeApiSource from "../../../api/transcribe.ts?raw";
import bufferedStreamSource from "../../../transcribe/buffered-stream.ts?raw";
import { connectTranscribeWebSocket } from "../../../api/transcribe.js";
import {
  InstrumentedWebSocket,
  type ConnectionStatus,
} from "../../../transport/instrumented-websocket.js";
import { type AudioStream, openAudioStream } from "../../../audio/audio-source.js";
import micStreamSource from "../../../audio/mic-stream.ts?raw";
import rawPcm16ProcessorSource from "../../../audio/rawPcm16Processor.js?raw";
import { extractRegion } from "../../../shared/codeExtract.js";
import { initPageChrome } from "../../../shared/page-chrome.js";
import { saveTranscriptItems } from "../../../shared/storage.js";
import { TranscriptionSession } from "../../../transcribe/transcription-session.js";
import sessionSource from "../../../transcribe/transcription-session.ts?raw";
import clientSource from "../../../transport/client.ts?raw";
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
  startBufferVisualization,
  stopBufferVisualization,
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
    file: "transcribe/transcription-session.ts",
    source: sessionSource,
    region: "receive-transcript",
  },
  {
    title: "6. Buffer & replay on reconnect",
    file: "transcribe/buffered-stream.ts",
    source: bufferedStreamSource,
    region: "buffered-audio-stream",
  },
];

const SIMULATED_ACK_LATENCY_MS = 10_000;

let session: TranscriptionSession | null = null;
let audio: AudioStream | null = null;
let finalizing = false;
let latencyActive = false;
// Read per-frame by the observed socket; raising it holds incoming frames back.
let receiveLatencyMs = 0;

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
    const audioSource = readAudioSourceSelection();
    prepareNewSession();

    const transcriptionSession = new TranscriptionSession(async () => {
      const socket = new InstrumentedWebSocket(
        connectTranscribeWebSocket,
        addWsMessage,
        reportWsStatus,
        () => receiveLatencyMs,
      );
      await socket.open();
	  return socket;
    });
    wireSession(transcriptionSession);
    await transcriptionSession.start();
    session = transcriptionSession;
    setRecordingState(audioSource === "wav-file");
    startBufferVisualization(() => transcriptionSession.getBufferStatistics());
    audio = await openAudioStream(audioSource, (pcm) =>
      transcriptionSession.sendAudio(pcm),
    );
  } catch (error) {
    alert(error instanceof Error ? error.message : String(error));
    setStartState();
  }
}

// Drive the UI from session events — the page never touches the socket directly.
function wireSession(transcriptionSession: TranscriptionSession): void {
  transcriptionSession.onTranscriptItem(() => {
    renderTranscript(transcriptionSession.items());
    updateTranscriptStats(transcriptionSession.items());
  });
}

// Maps a connection status to the WS-log + status-pill UI. Passed to the socket, which
// calls it as it moves through connecting → connected → closed.
function reportWsStatus(status: ConnectionStatus): void {
  updateWsStatus(status);
  if (status === "connected") {
    addWsMessage("system", "WebSocket connected");
  } else if (status === "closed") {
    addWsMessage("system", "WebSocket closed");
  }
}

export async function stopTranscribing(): Promise<void> {
  if (session) {
    await finalize();
  }
}

// Graceful shutdown: stop audio, end the stream (END + await server close), then save.
async function finalize(): Promise<void> {
  const transcriptionSession = session;
  if (!transcriptionSession || finalizing) {
    return;
  }
  finalizing = true;
  const audioStream = audio;
  session = null;
  audio = null;
  audioStream?.stop();
  await transcriptionSession.stop();
  stopBufferVisualization();
  const items = transcriptionSession.items();
  if (items.length > 0) {
    saveTranscriptItems(items);
  }
  finalizing = false;
  setStartState();
}

export function simulateDisconnect(): void {
  if (!session) {
    return;
  }
  setDisconnectedState();
  addWsMessage("system", "Connection lost — buffering audio locally");
  session.disconnect();
}

export async function simulateReconnect(): Promise<void> {
  if (!session) {
    return;
  }
  setReconnectedState();
  const { queued, inflight } = session.getBufferStatistics();
  addWsMessage("system", `Replaying ${queued + inflight} buffered packets`);
  await session.reconnect();
}

// A one-shot latency spike: hold incoming frames for a few seconds so ACKs back up
// and the in-flight window fills, then auto-recover so the backlog drains.
export function simulateHighLatency(): void {
  if (!session || latencyActive) {
    return;
  }
  latencyActive = true;
  receiveLatencyMs = SIMULATED_ACK_LATENCY_MS;
  setLatencyState(true);
  setTimeout(() => {
    receiveLatencyMs = 0;
    setLatencyState(false);
    latencyActive = false;
  }, SIMULATED_ACK_LATENCY_MS);
}

function prepareNewSession(): void {
  resetLog();
  switchWsTab("key");
  resetTranscriptArea();
  updateTranscriptStats([]);
  session = null;
  latencyActive = false;
  receiveLatencyMs = 0;
  setLatencyState(false);
}
