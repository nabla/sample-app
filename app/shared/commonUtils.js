// Common utilities for Nabla API demos

const API_VERSION = "2025-04-03"

let thinkingId;
let audioContext;
let pcmWorker;
let mediaSource;
let mediaStream;

// Element manipulation utilities
const disableElementById = (elementId) => {
    const element = document.getElementById(elementId);
    if (!element || element.hasAttribute("disabled")) return;
    element.setAttribute("disabled", "disabled");
};

const enableElementById = (elementId) => {
    const element = document.getElementById(elementId);
    if (!element || !element.hasAttribute("disabled")) return;
    element.removeAttribute("disabled");
};

// UI helpers
const startThinking = (parent) => {
    const thinking = document.createElement("div");
    thinking.setAttribute("id", "thinking");
    let count = 0;
    thinkingId = setInterval(() => {
        const dots = ".".repeat(count % 3 + 1);
        thinking.innerHTML = `Thinking${dots} `;
        count++;
    }, 500);
    parent.appendChild(thinking);
};

const stopThinking = (parent) => {
    clearInterval(thinkingId);
    if (!parent) return;
    const thinking = document.getElementById("thinking");
    if (thinking) {
        parent.removeChild(thinking);
    }
};

// Websocket utils
const endConnection = async (websocket, endObject) => {
    if (!websocket || websocket.readyState !== WebSocket.OPEN) return;

    websocket.send(JSON.stringify(endObject));

    // Await server closing the WS
    for (let i = 0; i < 50; i++) {
        if (websocket.readyState === WebSocket.OPEN) {
            await sleep(100);
        } else {
            break;
        }
    }
};

// Audio utilities
const initializeMediaStream = async (buildAudioChunk, websocket) => {
    // Ask authorization to access the microphone
    mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
            deviceId: "default",
            sampleRate: 16000,
            sampleSize: 16,
            channelCount: 1,
        },
        video: false,
    });
    audioContext = new AudioContext({ sampleRate: 16000 });
    await audioContext.audioWorklet.addModule("../shared/rawPcm16Processor.js");
    pcmWorker = new AudioWorkletNode(audioContext, "raw-pcm-16-worker", {
        outputChannelCount: [1],
    });
    mediaSource = audioContext.createMediaStreamSource(mediaStream);
    mediaSource.connect(pcmWorker);

    // pcm post on message
    pcmWorker.port.onmessage = (msg) => {
        const pcm16iSamples = msg.data;
        const audioAsBase64String = btoa(
            String.fromCodePoint(...new Uint8Array(pcm16iSamples.buffer)),
        );
        if (websocket.readyState !== websocket.OPEN) {
            console.error("Websocket is no longer open");
            return;
        }

        websocket.send(buildAudioChunk(audioAsBase64String));
    };
};

const stopAudio = () => {
    try {
        audioContext?.close();
    } catch (e) {
        console.error("Error while closing AudioContext", e);
    }

    try {
        pcmWorker?.port.close();
        pcmWorker?.disconnect();
    } catch (e) {
        console.error("Error while closing PCM worker", e);
    }

    try {
        mediaSource?.mediaStream.getTracks().forEach((track) => track.stop());
        mediaSource?.disconnect();
    } catch (e) {
        console.error("Error while closing media stream", e);
    }
};

// UI utils
const insertElementByStartOffset = (element, parentElement) => {
    const elementStartOffset = element.getAttribute("data-start-offset");
    let elementBefore = null;
    for (let childElement of parentElement.childNodes) {
        const childStartOffset =
            childElement.nodeName === element.nodeName && childElement.hasAttribute("data-start-offset")
                ? childElement.getAttribute("data-start-offset")
                : 0;
        if (Number(childStartOffset) > Number(elementStartOffset)) {
            elementBefore = childElement;
            break;
        }
    }
    if (elementBefore) {
        parentElement.insertBefore(element, elementBefore);
    } else {
        parentElement.appendChild(element);
    }
};

// Time formatting
const msToTime = (milli) => {
    const seconds = Math.floor((milli / 1000) % 60);
    const minutes = Math.floor((milli / (60 * 1000)) % 60);
    return `${String(minutes).padStart(2, 0)}:${String(seconds).padStart(2, 0)}`;
};

// Promises
const sleep = (duration) => new Promise((r) => setTimeout(r, duration));

export {
    API_VERSION,
    disableElementById,
    enableElementById,
    startThinking,
    stopThinking,
    endConnection,
    initializeMediaStream,
    stopAudio,
    insertElementByStartOffset,
    msToTime,
    sleep
}; 