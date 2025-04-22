// Ambient encounter demo implementation
import { getOrRefetchUserAccessToken, CORE_API_BASE_URL } from '../shared/authentication.js';
import {
    disableElementById,
    enableElementById,
    startThinking,
    stopThinking,
    endConnection,
    initializeMediaStream,
    stopAudio,
    insertElementByStartOffset,
    msToTime,
    sleep,
    API_VERSION
} from '../shared/commonUtils.js';

let generatedNote = undefined;
let websocket;
let transcriptItems = {};
let transcriptSeqId = 0;
let noteSectionsCustomization = {};

// Template section mapping
const templateSectionsMap = {
    "GENERIC_MULTIPLE_SECTIONS": [
        "CHIEF_COMPLAINT",
        "HISTORY_OF_PRESENT_ILLNESS",
        "PAST_MEDICAL_HISTORY",
        "PAST_SURGICAL_HISTORY",
        "PAST_OBSTETRIC_HISTORY",
        "FAMILY_HISTORY",
        "SOCIAL_HISTORY",
        "ALLERGIES",
        "CURRENT_MEDICATIONS",
        "IMMUNIZATIONS",
        "VITALS",
        "LAB_RESULTS",
        "IMAGING_RESULTS",
        "PHYSICAL_EXAM",
        "ASSESSMENT",
        "PLAN",
        "PRESCRIPTION",
        "APPOINTMENTS"
    ],
    "GENERIC_SOAP": [
        "SUBJECTIVE",
        "OBJECTIVE",
        "ASSESSMENT",
        "PLAN"
    ],
};

// UI Utilities
const clearTranscript = () => {
    document.getElementById("transcript").innerHTML = "<h3>Transcript:</h3>";
};

const clearNoteContent = () => {
    document.getElementById("note").innerHTML = "<h3>Note:</h3>";
};

const clearPatientInstructions = () => {
    document.getElementById("patient-instructions").innerHTML = "<h3>Patient instructions:</h3>";
};

const clearNormalizedData = () => {
    document.getElementById("normalized-data").innerHTML = "<h3>Normalized data:</h3>";
};

const disableAll = () => {
    disableElementById("start-btn");
    disableElementById("generate-btn");
    disableElementById("normalize-btn");
    disableElementById("patient-instructions-btn");
};

const enableAll = () => {
    enableElementById("start-btn");
    enableElementById("generate-btn");
    enableElementById("normalize-btn");
    enableElementById("patient-instructions-btn");
};

// Transcript handling
const insertTranscriptItem = (data) => {
    transcriptItems[data.id] = data.text;
    const transcriptContent =
        `[${msToTime(data.start_offset_ms)} to ${msToTime(data.end_offset_ms)}]: ${data.text}`;
    const transcriptContainer = document.getElementById("transcript");
    let transcriptItem = document.getElementById(data.id);
    if (!transcriptItem) {
        transcriptItem = document.createElement("div");
        transcriptItem.setAttribute("id", data.id);
        transcriptItem.setAttribute("data-start-offset", data.start_offset_ms);
        insertElementByStartOffset(transcriptItem, transcriptContainer);
    }
    transcriptItem.innerHTML = transcriptContent;
    if (data.is_final) {
        transcriptItem.classList.remove("temporary-item");
    } else if (!transcriptItem.classList.contains("temporary-item")) {
        transcriptItem.classList.add("temporary-item");
    }
};

// WebSocket connection for transcript
const initializeTranscriptConnection = async () => {
    // Get valid token for connection
    const bearerToken = await getOrRefetchUserAccessToken();
    
    // Initialize websocket connection
    websocket = new WebSocket(
        `wss://${CORE_API_BASE_URL}/user/transcribe-ws?nabla-api-version=${API_VERSION}`,
        ["transcribe-protocol", "jwt-" + bearerToken],
    );

    websocket.onclose = (e) => {
        console.log(`Websocket closed: ${e.code} ${e.reason}`);
    };

    websocket.onmessage = (mes) => {
        if (websocket.readyState !== WebSocket.OPEN) return;
        if (typeof mes.data === "string") {
            const data = JSON.parse(mes.data);

            if (data.type === "AUDIO_CHUNK_ACK") {
                // This is where you'd remove audio chunks from your buffer
            } else if (data.type === "TRANSCRIPT_ITEM") {
                insertTranscriptItem(data);
            } else if (data.type === "ERROR_MESSAGE") {
                console.error(data.message);
            }
        }
    };
};

// Form field getters
const getFirstTranscriptLocale = () => (
    document.getElementById("first-transcript-locale")?.selectedOptions[0]?.value ?? "ENGLISH_US"
);

const getSecondTranscriptLocale = () => (
    document.getElementById("second-transcript-locale")?.selectedOptions[0]?.value ?? "SPANISH_ES"
);

const getNoteTemplate = () => (
    document.getElementById("note-template")?.selectedOptions[0]?.value ?? "GENERIC_MULTIPLE_SECTIONS"
);

const getPatientContext = () => (
    document.getElementById("patient-context")?.value
);

const getNoteLanguage = () => (
    document.getElementById("note-locale")?.selectedOptions[0]?.value ?? "ENGLISH_US"
);

// Recording functionality
const startRecording = async () => {
    if (getFirstTranscriptLocale() === getSecondTranscriptLocale()) {
        const errorMessage = document.createElement("p");
        errorMessage.classList.add("error");
        errorMessage.innerText = "First and second transcript locales must be different.";
        document.getElementById("transcript").appendChild(errorMessage);
        return;
    }
    
    clearTranscript();
    enableElementById("generate-btn");

    transcriptSeqId = 0;
    await initializeTranscriptConnection();

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
        await initializeMediaStream((audioAsBase64String) => {
            return JSON.stringify({
                type: "AUDIO_CHUNK",
                payload: audioAsBase64String,
                stream_id: "stream1",
                seq_id: transcriptSeqId++,
            });
        }, websocket);

        const config = {
            type: "CONFIG",
            encoding: "PCM_S16LE",
            sample_rate: 16000,
            speech_locales: [getFirstTranscriptLocale(), getSecondTranscriptLocale()],
            streams: [
                { id: "stream1", speaker_type: "unspecified" },
            ],
            enable_audio_chunk_ack: true,
        };
        websocket.send(JSON.stringify(config));

        pcmWorker.port.start();
    } else {
        console.error("Microphone audio stream is not accessible on this browser");
    }
};

// Note generation
const generateNote = async () => {
    if (Object.keys(transcriptItems).length === 0) return;

    disableAll();

    stopAudio();
    await endConnection(websocket, { type: "END" });

    clearNoteContent();
    await digest();

    enableAll();
};

const digest = async () => {
    startThinking(document.getElementById("note"));

    const noteSectionsCustomizationArray = Object.entries(noteSectionsCustomization).map(
        ([sectionKey, customizationOptions]) => ({
            section_key: sectionKey,
            ...customizationOptions
        })
    );

    const bearerToken = await getOrRefetchUserAccessToken();
    const response = await fetch(`https://${CORE_API_BASE_URL}/user/generate-note`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${bearerToken}`,
            'X-Nabla-Api-Version': API_VERSION
        },
        body: JSON.stringify({
            note_template: getNoteTemplate(),
            note_locale: getNoteLanguage(),
            patient_context: getPatientContext(),
            transcript_items: Object.values(transcriptItems).map((it) => ({ text: it, speaker_type: "unspecified" })),
            note_sections_customization: noteSectionsCustomizationArray,
        })
    });

    const note = document.getElementById("note");
    stopThinking(note);

    if (!response.ok) {
        console.error('Error during note generation:', response.status);
        const errData = await response.json();
        const errText = document.createElement("p");
        errText.classList.add("error");
        errText.innerHTML = errData.message;
        note.appendChild(errText);
        return;
    }

    const data = await response.json();
    generatedNote = data.note;

    data.note.sections.forEach((section) => {
        const title = document.createElement("h4");
        title.innerHTML = section.title;
        const text = document.createElement("p");
        text.innerHTML = section.text;
        note.appendChild(title);
        note.appendChild(text);
    });
};

// Generate normalized data
const generateNormalizedData = async () => {
    if (!generatedNote) return;

    disableAll();
    clearNormalizedData();
    const normalizationContainer = document.getElementById("normalized-data");
    startThinking(normalizationContainer);

    const note_locale = getNoteLanguage();
    if (!["FRENCH_FR", "ENGLISH_US", "ENGLISH_UK"].includes(note_locale)) {
        const errorMessage = document.createElement("p");
        errorMessage.classList.add("error");
        errorMessage.innerText = "Normalized data are only available for note with locale FRENCH_FR, ENGLISH_US, ENGLISH_UK";
        normalizationContainer.appendChild(errorMessage);
        return;
    }

    const bearerToken = await getOrRefetchUserAccessToken();
    const response = await fetch(`https://${CORE_API_BASE_URL}/user/generate-normalized-data`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${bearerToken}`,
            'X-Nabla-Api-Version': API_VERSION
        },
        body: JSON.stringify({
            note: generatedNote,
            note_template: getNoteTemplate(),
            note_locale
        })
    });

    stopThinking(normalizationContainer);

    if (!response.ok) {
        console.error('Error during normalized data generation:', response.status);
        const errData = await response.json();
        const errText = document.createElement("p");
        errText.classList.add("error");
        errText.innerHTML = errData.message;
        normalizationContainer.appendChild(errText);
        return;
    }

    const data = await response.json();

    const conditionTitle = document.createElement("h4");
    conditionTitle.innerHTML = "Conditions:";
    normalizationContainer.appendChild(conditionTitle);

    addConditions(data.conditions, normalizationContainer);

    const familyHistoryTitle = document.createElement("h4");
    familyHistoryTitle.innerHTML = "Family history:";
    normalizationContainer.appendChild(familyHistoryTitle);

    const historyList = document.createElement("ul");
    data.family_history.forEach((member) => {
        const memberListItem = document.createElement("li");
        const relationship = document.createElement("span");
        relationship.innerText = member.relationship;
        memberListItem.appendChild(relationship);
        addConditions(member.conditions, memberListItem);
        historyList.appendChild(memberListItem);
    });
    normalizationContainer.appendChild(historyList);

    enableAll();
};

const addConditions = (conditions, parent) => {
    const conditionsList = document.createElement("ul");
    conditions.forEach((condition) => {
        const element = document.createElement("li");
        element.innerHTML = `${condition.coding.display.toUpperCase()} (${condition.coding.code})<br /><u>Clinical status:</u> ${condition.clinical_status}<br />`;
        if (condition.categories.length > 0) {
            element.innerHTML += "<u>Categories:</u> [" + condition.categories.join() + "]";
        }
        conditionsList.appendChild(element);
    });
    parent.appendChild(conditionsList);
};

// Generate patient instructions
const generatePatientInstructions = async () => {
    if (!generatedNote) return;

    clearPatientInstructions();
    disableAll();
    const patientInstructions = document.getElementById("patient-instructions");
    startThinking(patientInstructions);

    const bearerToken = await getOrRefetchUserAccessToken();
    const response = await fetch(`https://${CORE_API_BASE_URL}/user/generate-patient-instructions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${bearerToken}`,
            'X-Nabla-Api-Version': API_VERSION
        },
        body: JSON.stringify({
            note: generatedNote,
            note_locale: "ENGLISH_US",
            note_template: getNoteTemplate(),
            instructions_locale: "ENGLISH_US",
            consultation_type: "IN_PERSON"
        })
    });

    if (!response.ok) {
        console.error('Error during patient instructions generation:', response.status);
    }

    const data = await response.json();

    stopThinking(patientInstructions);
    const instructionsTitle = document.createElement("h4");
    instructionsTitle.innerHTML = "Instructions: ";
    patientInstructions.appendChild(instructionsTitle);

    const text = document.createElement("p");
    text.innerHTML = data.instructions;
    patientInstructions.appendChild(text);
    enableAll();
};

// Clear all data
const clearEncounter = async () => {
    disableElementById("start-btn");
    disableAll();
    stopAudio();
    await endConnection(websocket, { type: "END" });
    clearNoteContent();
    clearNormalizedData();
    clearPatientInstructions();
    clearTranscript();
    enableElementById("start-btn");
    enableAll();
};

// Note customization
const updateSectionsList = () => {
    const template = getNoteTemplate();
    const selectElement = document.getElementById("note-sections");
    selectElement.innerHTML = "";

    const sections = templateSectionsMap[template] || [];
    sections.forEach((sectionKey) => {
        const opt = document.createElement("option");
        opt.value = sectionKey;
        opt.innerText = sectionKey;
        selectElement.appendChild(opt);
    });

    selectElement.value = sections[0] || "";
    onSectionToCustomizeChange();
};

const onTemplateChange = () => {
    noteSectionsCustomization = {};
    updateSectionsList();
};

const onSectionToCustomizeChange = () => {
    const selected = document.getElementById("note-sections").value;
    if (!selected) {
        document.getElementById("section-customization-fields").style.display = "none";
        return;
    }

    document.getElementById("section-customization-fields").style.display = "inline-block";
    const existing = noteSectionsCustomization[selected] || {};
    document.getElementById("style-select").value = existing.style || "AUTO";
    document.getElementById("custom-instruction").value = existing.custom_instruction || "";
};

const onSectionStyleChange = () => {
    const sectionKey = document.getElementById("note-sections").value;
    if (!sectionKey) return;

    const styleValue = document.getElementById("style-select").value;

    const customizationOptions = noteSectionsCustomization[sectionKey] ?? {};
    customizationOptions.style = styleValue;
    noteSectionsCustomization[sectionKey] = customizationOptions;
};

const onSectionCustomInstructionChange = () => {
    const sectionKey = document.getElementById("note-sections").value;
    if (!sectionKey) return;

    const customInstructionValue = document.getElementById("custom-instruction").value;

    const customizationOptions = noteSectionsCustomization[sectionKey] ?? {};
    customizationOptions.custom_instruction = customInstructionValue;
    noteSectionsCustomization[sectionKey] = customizationOptions;
};

// Initialize the application
const initApp = () => {
    // Initial call to display an error message directly if the refresh token is expired
    getOrRefetchUserAccessToken();
    
    // Set up event listeners
    document.getElementById("start-btn").addEventListener("click", startRecording);
    document.getElementById("generate-btn").addEventListener("click", generateNote);
    document.getElementById("normalize-btn").addEventListener("click", generateNormalizedData);
    document.getElementById("patient-instructions-btn").addEventListener("click", generatePatientInstructions);
    document.getElementById("clear-btn").addEventListener("click", clearEncounter);
    
    document.getElementById("note-template").addEventListener("change", onTemplateChange);
    document.getElementById("note-sections").addEventListener("change", onSectionToCustomizeChange);
    document.getElementById("style-select").addEventListener("change", onSectionStyleChange);
    document.getElementById("custom-instruction").addEventListener("input", onSectionCustomInstructionChange);
    
    // Initialize section customization
    updateSectionsList();
};

// Start the application when DOM is fully loaded
document.addEventListener("DOMContentLoaded", initApp);
