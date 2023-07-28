const API_KEY = "<YOUR_API_KEY>";
let websocket;
let audioContext;
let pcmWorker;
let mediaSource;
const rawPCM16WorkerName = "raw-pcm-16-worker";

const initializeWsCnx = () => {
    // Normally we'd send a 'Authorization': 'Bearer <YOUR_TOKEN>' header.
    // But since JS WS client does not support sending additional headers,
    // we rely on an "auth token as 2nd WS protocol prefixed with `jwt-`" authentication mechanism
    // that is only meant for prototyping purposes.
    websocket = new WebSocket('wss://api.nabla.com/v1/server/copilot/listen', ["copilot-listen-protocol", "jwt-" + API_KEY]);

    websocket.onclose = (e) => {
        console.log(`Websocket closed: ${e.code} ${e.reason}`);
        const transcript = document.getElementById("transcript");
        transcript.lastElementChild.innerHTML = "-----";
        transcript.appendChild(document.createElement("div"));
        document.getElementById("start").removeAttribute('disabled')
    };

    const msToTime = (milli) => {
        const seconds = Math.floor((milli / 1000) % 60);
        const minutes = Math.floor((milli / (60 * 1000)) % 60);

        return `${String(minutes).padStart(2, 0)}:${String(seconds).padStart(2, 0)}`;
    };

    websocket.onmessage = (mes) => {
        if (typeof mes.data === "string") {
            const data = JSON.parse(mes.data);
            if (data.object === "transcript_item") {
                const transcript = document.getElementById("transcript");
                transcript.lastElementChild.innerHTML = `[${msToTime(data.start_offset_ms)} to ${msToTime(data.end_offset_ms)}]: ${data.text}`;
                if (data.is_final) {
                    // Create a new div for future transcript items
                    transcript.appendChild(document.createElement("div"));
                }
            } else if (data.object === "note") {
                const note = document.getElementById("note");
                data.sections.forEach((section) => {
                    const title = document.createElement("h4");
                    title.innerHTML = section.title;
                    const text = document.createElement("p");
                    text.innerHTML = section.text;
                    note.appendChild(title);
                    note.appendChild(text);
                })
            }
        }
    };
}

const startRecordingAsync = async () => {
    document.getElementById("start").setAttribute('disabled', 'disabled');
    document.getElementById("generate").removeAttribute('disabled')

    initializeWsCnx();

    // Await websocket being open
    const sleep = (duration) => new Promise((r) => setTimeout(r, duration));
    for (let i = 0; i < 10; i++) {
        if (websocket.readyState !== websocket.OPEN) {
            await sleep(100);
        } else {
            break;
        }
    }
    if (websocket.readyState !== websocket.OPEN) {
        throw new Error("Websocket did not open");
    }

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        // Ask authorization to access the microphone
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                deviceId: "default",
                sampleRate: 16000,
                sampleSize: 16,
                channelCount: 1,
            },
            video: false,
        });
        audioContext = new AudioContext({ sampleRate: 16000 });
        await audioContext.audioWorklet.addModule("rawPcm16Processor.js")
        pcmWorker = new AudioWorkletNode(audioContext, rawPCM16WorkerName, {
            outputChannelCount: [1],
        });
        mediaSource = audioContext.createMediaStreamSource(stream);
        mediaSource.connect(pcmWorker);

        // pcm post on message
        pcmWorker.port.onmessage = (msg) => {
            const pcm16iSamples = msg.data;
            const audioAsBase64String = btoa(
                String.fromCodePoint(...new Uint8Array(pcm16iSamples.buffer)),
            );
            if (websocket.readyState !== websocket.OPEN) {
                console.error("Websocket is no longer open")
                return;
            }
            // Send the audio chunk to the websocket cnx
            websocket.send(
                JSON.stringify({
                    object: "audio_chunk",
                    payload: audioAsBase64String,
                    stream_id: "stream1",
                })
            );
        }

        const config = {
            object: "listen_config",
            output_objects: ["transcript_item", "note"],
            encoding: "pcm_s16le",
            sample_rate: 16000,
            language: "en",
            streams: [
                { id: "stream1", speaker_type: "doctor" },
            ],
        };
        websocket.send(JSON.stringify(config));

        // pcm start
        pcmWorker.port.start();
    } else {
        console.error("Microphone audio stream is not accessible on this browser");
    }
}

const startRecording = () => {
    startRecordingAsync()
        .then()
        .catch((err) => {
            console.log(err)
        });
}

const endWsCnx = () => {
    if (websocket.readyState !== websocket.OPEN) return;

    websocket.send(
        JSON.stringify({
            object: "end",
        }),
    );
}

const generate = () => {
    endWsCnx();

    audioContext?.close();
    pcmWorker?.port.close();
    pcmWorker?.disconnect();
    mediaSource?.mediaStream.getTracks().forEach((track) => track.stop());
    mediaSource?.disconnect();

    document.getElementById("generate").setAttribute('disabled', 'disabled');
}
