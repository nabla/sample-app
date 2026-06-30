import type { AudioSource } from "../../../audio/audio-source.js";
import type { TranscriptItem } from "../../../api/transcribe.js";

export { renderCodeSnippets } from "../../../shared/codeSnippets.render.js";
// The WebSocket log and code-snippet rendering are generic and shared with the
// dictate page; re-exported here so this stays the transcribe page's single
// render entry point.
export {
  addWsMessage,
  resetLog,
  switchWsTab,
  updateWsStatus,
} from "../../../shared/wsLog.render.js";

function setBar(barId: string, percent: number, label: string): void {
  const barElement = document.getElementById(`bar-${barId}`);
  const labelElement = document.getElementById(`lbl-${barId}`);
  if (barElement) {
    barElement.style.width = `${percent}%`;
  }
  if (labelElement) {
    labelElement.textContent = label;
  }
}

function formatMs(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

export function updateTranscriptStats(items: TranscriptItem[]): void {
  const finalCount = items.filter((item) => item.is_final).length;
  const inProgressCount = items.filter((item) => !item.is_final).length;
  const finalLabel = document.getElementById("lbl-final");
  const pendingLabel = document.getElementById("lbl-pending");
  if (finalLabel) {
    finalLabel.textContent = `${finalCount} final`;
  }
  if (pendingLabel) {
    pendingLabel.textContent = `${inProgressCount} in progress`;
  }
}

// Re-renders the whole transcript from the current set of items every update. Items
// can arrive out of order and as partials that finalize later, so rather than patch
// individual elements (easy to get wrong on reconnect/replay), we rebuild from the
// deduped source of truth each time — the displayed transcript is always the latest
// version of every item, sorted by start time.
export function renderTranscript(items: TranscriptItem[]): void {
  const container = document.getElementById("transcript-items");
  if (!container) {
    return;
  }
  container.replaceChildren();
  if (items.length === 0) {
    const placeholder = document.createElement("div");
    placeholder.className = "text-grey-250 italic";
    placeholder.textContent = "Waiting for audio…";
    container.append(placeholder);
    return;
  }
  const ordered = [...items].sort(
    (left, right) => left.start_offset_ms - right.start_offset_ms,
  );
  for (const item of ordered) {
    const row = document.createElement("div");
    row.className = item.is_final ? "text-grey-400" : "text-grey-250 italic";
    const speaker =
      item.speaker_type === "DOCTOR"
        ? "Doctor> "
        : item.speaker_type === "PATIENT"
          ? "Patient> "
          : "";
    const time = `[${formatMs(item.start_offset_ms)}..${formatMs(item.end_offset_ms)}]`;
    row.textContent = `${time} ${speaker}${item.text}`;
    container.append(row);
  }
  container.scrollTop = container.scrollHeight;
}

export function showBufferVisualization(): void {
  document.getElementById("buffer-viz")?.classList.remove("hidden");
}

export function updateBufferVisualization(stats: {
  queued: number;
  inflight: number;
  totalAcked: number;
}): void {
  const { queued, inflight, totalAcked } = stats;
  setBar("queued", Math.min((queued / 50) * 100, 100), `${queued} pkts`);
  setBar("inflight", Math.min((inflight / 50) * 100, 100), `${inflight} pkts`);
  const total = queued + inflight + totalAcked;
  setBar(
    "acked",
    total > 0 ? Math.min((totalAcked / total) * 100, 100) : 0,
    `${totalAcked} pkts`,
  );
}

let bufferVisualizationInterval: ReturnType<typeof setInterval> | null = null;

export function startBufferVisualization(
  getStats: () => { queued: number; inflight: number; totalAcked: number } | undefined,
): void {
  showBufferVisualization();
  if (bufferVisualizationInterval) {
    clearInterval(bufferVisualizationInterval);
  }
  bufferVisualizationInterval = setInterval(() => {
    const stats = getStats();
    if (stats) {
      updateBufferVisualization(stats);
    }
  }, 200);
}

export function stopBufferVisualization(): void {
  if (bufferVisualizationInterval) {
    clearInterval(bufferVisualizationInterval);
    bufferVisualizationInterval = null;
  }
}

export function readAudioSourceSelection(): AudioSource {
  return (document.getElementById("seed-select") as HTMLSelectElement)
    .value as AudioSource;
}

export function setLoadingState(): void {
  const startButton = document.getElementById("start-btn") as HTMLButtonElement;
  startButton.textContent = "Loading…";
  startButton.disabled = true;
}

export function setRecordingState(isMockRecording: boolean): void {
  const startButton = document.getElementById("start-btn") as HTMLButtonElement;
  startButton.classList.add("hidden");
  document.getElementById("stop-btn")?.classList.remove("hidden");
  document.getElementById("recording-dot")?.classList.remove("hidden");
  document.getElementById("transcript-panel")?.classList.remove("hidden");
  if (isMockRecording) {
    document.getElementById("mock-badge")?.classList.remove("hidden");
  }
}

export function setStartState(): void {
  const startButton = document.getElementById("start-btn") as HTMLButtonElement;
  startButton.textContent = "Start";
  startButton.disabled = false;
  startButton.classList.remove("hidden");
  document.getElementById("stop-btn")?.classList.add("hidden");
  document.getElementById("recording-dot")?.classList.add("hidden");
  document.getElementById("mock-badge")?.classList.add("hidden");
  document.getElementById("disconnect-warning")?.classList.add("hidden");
}

export function setDisconnectedState(): void {
  document.getElementById("disconnect-btn")?.classList.add("hidden");
  document.getElementById("disconnect-warning")?.classList.remove("hidden");
}

export function setReconnectedState(): void {
  document.getElementById("disconnect-warning")?.classList.add("hidden");
  document.getElementById("disconnect-btn")?.classList.remove("hidden");
}

// Active while a latency spike is in progress: the button is disabled and shows the
// buffer is absorbing it, until it auto-recovers.
export function setLatencyState(active: boolean): void {
  const button = document.getElementById("latency-btn") as HTMLButtonElement | null;
  if (!button) {
    return;
  }
  button.textContent = active ? "Absorbing latency spike…" : "Simulate latency spike";
  button.disabled = active;
  button.classList.toggle("opacity-60", active);
}
