// Dictated note demo implementation
import { getOrRefetchUserAccessToken, CORE_API_BASE_URL } from '../shared/authentication.js';
import {
    disableElementById,
    enableElementById,
    endConnection,
    initializeMediaStream,
    stopAudio,
    insertElementByStartOffset,
    sleep,
    API_VERSION
} from '../shared/commonUtils.js';

let websocket;
let dictateSeqId = 0;

// Dictation handling
const insertDictatedItem = (data) => {
    const dictationContainer = document.getElementById("dictated-note");
    let dicatedItem = document.getElementById(data.id);
    if (!dicatedItem) {
        dicatedItem = document.createElement("span");
        dicatedItem.setAttribute("id", data.id);
        dicatedItem.setAttribute("data-start-offset", data.start_offset_ms);
        insertElementByStartOffset(dicatedItem, dictationContainer);
    }
    dicatedItem.innerHTML = data.text + "&nbsp;";
    if (data.is_final) {
        dicatedItem.classList.remove("temporary-item");
    } else if (!dicatedItem.classList.contains("temporary-item")) {
        dicatedItem.classList.add("temporary-item");
    }
};

// WebSocket connection for dictation
const initializeDictationConnection = async () => {
    const bearerToken = await getOrRefetchUserAccessToken();
    websocket = new WebSocket(
        `wss://${CORE_API_BASE_URL}/user/dictate-ws?nabla-api-version=${API_VERSION}`,
        ["dictate-protocol", "jwt-" + bearerToken]
    );

    websocket.onclose = (e) => {
        console.log(`Websocket closed: ${e.code} ${e.reason}`);
    };

    websocket.onmessage = (mes) => {
        if (websocket.readyState !== WebSocket.OPEN) {
            console.log("ws not open");
            return;
        }
        if (typeof mes.data === "string") {
            const data = JSON.parse(mes.data);

            if (data.type === "AUDIO_CHUNK_ACK") {
                // This is where you'd remove audio chunks from your buffer
            } else if (data.type === "DICTATION_ITEM") {
                insertDictatedItem(data);
            } else if (data.type === "ERROR_MESSAGE") {
                console.error(data.message);
            }
        }
    };
};

// Form field getters
const getDictationLocale = () => {
    const dictationLocaleSelect = document.getElementById("dictationLocale");
    return dictationLocaleSelect.selectedOptions && dictationLocaleSelect.selectedOptions.length > 0
        ? dictationLocaleSelect.selectedOptions[0].value
        : "ENGLISH_US";
};

const isPunctuationExplicit = () => {
    return document.getElementById("punctuation-switch").checked;
};

// Dictation controls
const startDictating = async () => {
    disableElementById("dictate-btn");
    enableElementById("pause-btn");

    dictateSeqId = 0;
    await initializeDictationConnection();

    // Await websocket being open
    for (let i = 0; i < 10; i++) {
        if (websocket.readyState !== WebSocket.OPEN) {
            await sleep(100);
        } else {
            break;
        }
    }
    if (websocket.readyState !== WebSocket.OPEN) {
        throw new Error("Websocket did not open");
    }

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        await initializeMediaStream((audioAsBase64String) => (JSON.stringify({
            type: "AUDIO_CHUNK",
            payload: audioAsBase64String,
            seq_id: dictateSeqId++,
        })), websocket);

        const locale = getDictationLocale();
        const config = {
            type: "CONFIG",
            encoding: "PCM_S16LE",
            sample_rate: 16000,
            speech_locale: locale,
            dictate_punctuation: isPunctuationExplicit(),
            enable_audio_chunk_ack: true,
        };
        websocket.send(JSON.stringify(config));

        // pcm start
        pcmWorker.port.start();
    } else {
        console.error("Microphone audio stream is not accessible on this browser");
    }
};

const pauseDictating = async () => {
    disableElementById("pause-btn");
    stopAudio();
    await endConnection(websocket, { type: "END" });
    enableElementById("dictate-btn");
};

// Initialize the application
const initApp = () => {
    // Initial call to display an error message directly if the refresh token is expired
    getOrRefetchUserAccessToken();
    
    // Set up event listeners
    document.getElementById("dictate-btn").addEventListener("click", startDictating);
    document.getElementById("pause-btn").addEventListener("click", pauseDictating);
};

// Start the application when DOM is fully loaded
document.addEventListener("DOMContentLoaded", initApp);
