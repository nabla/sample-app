// A generic WebSocket message log used by the in-depth pages (transcribe, dictate).
// It splits high-volume audio frames into their own tab so the key protocol
// messages stay readable.

function shortenUuids(text: string): string {
	return text.replace(
		/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
		(uuid) => `${uuid.slice(0, 3)}..${uuid.slice(-3)}`,
	);
}

function formatMessage(
	direction: "send" | "recv" | "system",
	raw: string,
): string {
	if (direction === "system") {
		return raw;
	}
	try {
		const { type, ...rest } = JSON.parse(raw) as Record<string, unknown>;
		const pairs = Object.entries(rest).map(([key, value]) => {
			const valueText =
				typeof value === "string" ? value : JSON.stringify(value);
			return `${key}=${shortenUuids(valueText)}`;
		});
		return `${String(type)}${pairs.length ? `  ${pairs.join("  ")}` : ""}`;
	} catch {
		return shortenUuids(raw);
	}
}

let wsCountKey = 0;
let wsCountAudio = 0;

export function resetLog(): void {
	wsCountKey = 0;
	wsCountAudio = 0;
	const logKey = document.getElementById("ws-log-key");
	const logAudio = document.getElementById("ws-log-audio");
	if (logKey) {
		logKey.innerHTML =
			'<div class="text-grey-250 italic text-center pt-8">No messages yet</div>';
	}
	if (logAudio) {
		logAudio.innerHTML =
			'<div class="text-grey-250 italic text-center pt-8">No audio chunks yet</div>';
	}
	const countKeyElement = document.getElementById("ws-count-key");
	const countAudioElement = document.getElementById("ws-count-audio");
	if (countKeyElement) {
		countKeyElement.textContent = "0";
	}
	if (countAudioElement) {
		countAudioElement.textContent = "0";
	}
}

export function addWsMessage(
	direction: "send" | "recv" | "system",
	message: string,
): void {
	const isAudioChunk =
		(direction === "send" && message.includes('"AUDIO_CHUNK"')) ||
		(direction === "recv" && message.includes('"AUDIO_CHUNK_ACK"'));
	const logId = isAudioChunk ? "ws-log-audio" : "ws-log-key";
	const logElement = document.getElementById(logId);
	if (!logElement) {
		return;
	}
	logElement.querySelector(".italic")?.remove();

	const row = document.createElement("div");
	const color =
		direction === "send"
			? "text-primary-400"
			: direction === "recv"
				? "text-success-300"
				: "text-grey-300";
	const arrow = direction === "send" ? "→" : direction === "recv" ? "←" : "·";
	row.className = "flex gap-1.5 items-start whitespace-nowrap";
	const arrowSpan = document.createElement("span");
	arrowSpan.className = `${color} flex-shrink-0 font-bold`;
	arrowSpan.textContent = arrow;
	const textSpan = document.createElement("span");
	textSpan.className = "text-grey-250";
	textSpan.textContent = formatMessage(direction, message);
	row.appendChild(arrowSpan);
	row.appendChild(textSpan);
	logElement.appendChild(row);
	logElement.scrollTop = logElement.scrollHeight;

	if (isAudioChunk) {
		wsCountAudio++;
		const countElement = document.getElementById("ws-count-audio");
		if (countElement) {
			countElement.textContent = String(wsCountAudio);
		}
	} else {
		wsCountKey++;
		const countElement = document.getElementById("ws-count-key");
		if (countElement) {
			countElement.textContent = String(wsCountKey);
		}
	}
}

export function switchWsTab(tab: "key" | "audio"): void {
	const isKey = tab === "key";
	document.getElementById("ws-log-key")?.classList.toggle("hidden", !isKey);
	document.getElementById("ws-log-audio")?.classList.toggle("hidden", isKey);
	const activeClass = ["text-primary-600", "border-primary-600", "font-medium"];
	const inactiveClass = ["text-grey-250", "border-transparent"];
	const keyTab = document.getElementById("ws-tab-key");
	const audioTab = document.getElementById("ws-tab-audio");
	if (isKey) {
		activeClass.forEach((className) => keyTab?.classList.add(className));
		inactiveClass.forEach((className) => keyTab?.classList.remove(className));
		inactiveClass.forEach((className) => audioTab?.classList.add(className));
		activeClass.forEach((className) => audioTab?.classList.remove(className));
	} else {
		activeClass.forEach((className) => audioTab?.classList.add(className));
		inactiveClass.forEach((className) => audioTab?.classList.remove(className));
		inactiveClass.forEach((className) => keyTab?.classList.add(className));
		activeClass.forEach((className) => keyTab?.classList.remove(className));
	}
}

export function updateWsStatus(
	state: "idle" | "connecting" | "connected" | "closed",
): void {
	const statusElement = document.getElementById("ws-status");
	if (!statusElement) {
		return;
	}
	const styles: Record<
		string,
		{
			dot: string;
			text: string;
			label: string;
		}
	> = {
		idle: {
			dot: "bg-grey-250",
			text: "text-grey-250",
			label: "Idle",
		},
		connecting: {
			dot: "bg-warning-300",
			text: "text-warning-300",
			label: "Connecting…",
		},
		connected: {
			dot: "bg-success-300",
			text: "text-success-300",
			label: "Connected",
		},
		closed: {
			dot: "bg-grey-250",
			text: "text-grey-250",
			label: "Closed",
		},
	};
	const style = styles[state];
	statusElement.innerHTML = `<span class="w-1.5 h-1.5 rounded-full ${style.dot}"></span> ${style.label}`;
	statusElement.className = `text-xs flex items-center gap-1.5 ${style.text}`;
}
