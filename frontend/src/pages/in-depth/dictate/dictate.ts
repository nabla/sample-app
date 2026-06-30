import {
  type AudioChunkAck,
  buildDictateAudioChunk,
  buildDictateConfig,
  connectDictateWebSocket,
  DICTATE_END_MESSAGE,
  type DictatedText,
  type DictateServerMessage,
} from "../../../api/dictate.js";
import dictateApiSource from "../../../api/dictate.ts?raw";
import { startMicrophoneStream } from "../../../audio/mic-stream.js";
import micStreamSource from "../../../audio/mic-stream.ts?raw";
import rawPcm16ProcessorSource from "../../../audio/rawPcm16Processor.js?raw";
import { extractRegion } from "../../../shared/codeExtract.js";
import { initPageChrome } from "../../../shared/page-chrome.js";
import clientSource from "../../../transport/client.ts?raw";
import {
  addWsMessage,
  appendDictatedText,
  clearNote,
  getNoteText,
  readLocaleSelection,
  renderCodeSnippets,
  renderLocaleOptions,
  resetLog,
  setIdleState,
  setLoadingState,
  setRecordingState,
  switchWsTab,
  updateWsStatus,
} from "./dictate.render.js";
import dictatePageSource from "./dictate.ts?raw";

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
    file: "api/dictate.ts",
    source: dictateApiSource,
    region: "dictate-messages",
  },
  {
    title: "5. Receive DICTATED_TEXT & append verbatim",
    file: "pages/in-depth/dictate/dictate.ts",
    source: dictatePageSource,
    region: "dictate-receive",
  },
  {
    title: "6. Pace sending with audio-chunk ACKs",
    file: "pages/in-depth/dictate/dictate.ts",
    source: dictatePageSource,
    region: "dictate-pacing",
  },
];

let socket: WebSocket | null = null;
let microphone: { stop: () => void } | null = null;
let finalizing = false;

// After we send END the server flushes its remaining dictated texts and then closes
// the socket — that close is how we know everything has arrived. Re-armed per connection.
let serverClosed: Promise<void> = Promise.resolve();
let resolveServerClosed: () => void = () => {};

function armServerClosed(): void {
  serverClosed = new Promise<void>((resolve) => {
    resolveServerClosed = resolve;
  });
}

// #region dictate-pacing
// dictate-ws acknowledges audio chunks and accepts at most ~10s of un-acked audio
// before erroring. We send chunks as the microphone produces them, but hold back
// once too many are outstanding and drain the backlog as ACKs arrive. (This is the
// lightweight version — the transcribe page shows full buffering + reconnect.)
const MAX_UNACKED_CHUNKS = 90; // ~9s at 100ms per chunk, just under the server's 10s limit
let nextSeqId = 0;
let lastAckId = -1;
const pendingChunks: Int16Array[] = [];

function resetPacing(): void {
  nextSeqId = 0;
  lastAckId = -1;
  pendingChunks.length = 0;
}

function queueAudioChunk(chunk: Int16Array): void {
  pendingChunks.push(chunk);
  drainPendingChunks();
}

function drainPendingChunks(): void {
  while (
    socket?.readyState === WebSocket.OPEN &&
    pendingChunks.length > 0 &&
    nextSeqId - lastAckId < MAX_UNACKED_CHUNKS
  ) {
    const message = buildDictateAudioChunk(
      nextSeqId++,
      pendingChunks.shift()!,
    );
    socket.send(JSON.stringify(message));
    addWsMessage("send", JSON.stringify(message));
  }
}

function handleAck(ackId: number): void {
  lastAckId = ackId;
  drainPendingChunks();
}
// #endregion dictate-pacing

function main(): void {
  initPageChrome();
  renderLocaleOptions();
  setIdleState();
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
  windowHandlers.startDictation = startDictation;
  windowHandlers.pauseDictation = pauseDictation;
  windowHandlers.clearDictation = clearDictation;
}

main();

export async function startDictation(): Promise<void> {
  setLoadingState();
  try {
    const locale = readLocaleSelection();
    const noteText = getNoteText();
    resetLog();
    switchWsTab("key");
    resetPacing();
    microphone = await startMicrophoneStream((chunk) => queueAudioChunk(chunk));
    updateWsStatus("connecting");
    socket = await connectDictateWebSocket();
    updateWsStatus("connected");
    addWsMessage("system", "WebSocket connected");
    armServerClosed();
    attachSocketHandlers();
    // send the config before sending any audio
    sendConfig(locale, noteText);
    drainPendingChunks();
    setRecordingState();
  } catch (error) {
    alert(error instanceof Error ? error.message : String(error))
    microphone?.stop();
    microphone = null;
    socket?.close();
    socket = null;
    setIdleState();
  }
}

// Graceful pause: stop the mic, tell the server we're done, then wait for it to flush
// the remaining dictated texts and close the socket. The note is kept so Start resumes it.
export async function pauseDictation(): Promise<void> {
  if (!socket || finalizing) {
    return;
  }
  finalizing = true;
  microphone?.stop();
  microphone = null;
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(DICTATE_END_MESSAGE));
    addWsMessage("send", JSON.stringify(DICTATE_END_MESSAGE));
  }
  await serverClosed;
  socket = null;
  setIdleState();
  finalizing = false;
}

// Clear the note — this is how you start a fresh dictation (Clear, then Start).
export function clearDictation(): void {
  clearNote();
}

function sendConfig(
  locale: Parameters<typeof buildDictateConfig>[0],
  noteText: string,
): void {
  const config = buildDictateConfig(locale, noteText);
  socket?.send(JSON.stringify(config));
  addWsMessage("send", JSON.stringify(config));
}

// #region dictate-receive
function attachSocketHandlers(): void {
  if (!socket) {
    return;
  }
  socket.onmessage = (event: MessageEvent<string>) => {
    const message = JSON.parse(event.data) as DictateServerMessage;
    addWsMessage("recv", event.data);
    if (message.type === "DICTATED_TEXT") {
      appendDictatedText((message as DictatedText).text);
    } else if (message.type === "AUDIO_CHUNK_ACK") {
      handleAck((message as AudioChunkAck).ack_id);
    }
  };
  socket.onclose = () => {
    updateWsStatus("closed");
    addWsMessage("system", "WebSocket closed");
    resolveServerClosed();
    // Server-initiated close (e.g. silence timeout 83011) while still recording.
    if (!finalizing) {
      microphone?.stop();
      microphone = null;
      socket = null;
      setIdleState();
    }
  };
}
// #endregion dictate-receive
