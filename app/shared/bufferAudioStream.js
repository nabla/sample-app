/**
 * The max number of packets sent to the server but not ACKed yet.
 *
 * Note: The number of in-flight packets is limited to 10 seconds of audio. Since
 * is configured to send 192 ms of audio per packet, the max number of in-flight
 * packets is 50.
 */
const MAX_IN_FLIGHT_PACKETS = 50;

/**
 * A class to buffer audio packets and send them to the server.
 *
 * It is used to make data transfer more resilient to network issues:
 * https://docs.nabla.com/guides/best-practices/transcription-network-resilience
 */
export class BufferedAudioStream {
    /** The websocket to send the packets to. */
    #websocket;

    /** The function to serialize the audio packet. */
    #serializeAudioPacket;

    /** The packets that are waiting to be sent. */
    #bufferedPackets = [];

    /** The packets that are being sent to the server but not acknowledged yet. */
    #inflightPackets = [];

    constructor({ serializeAudioPacket, websocket }) {
        this.#websocket = websocket;
        this.#serializeAudioPacket = serializeAudioPacket;

        // If the socket is not open, wait for it and flush the buffer.
        if (this.#websocket.readyState !== WebSocket.OPEN) {
            this.#websocket.addEventListener("open", () => {
                this.#sendBufferedPacketsIfNeeded();
            });
        }
    }

    /**
     * Send a packet to the server or buffer to be sent later.
     */
    sendAndBuffer(data) {
        this.#bufferedPackets.push(data);
        this.#sendBufferedPacketsIfNeeded();
    }

    /**
     * Handle the acknowledgement of a packet by the server and send the buffered packets if
     * needed.
     */
    handlePacketAck(data) {
        this.#inflightPackets = this.#inflightPackets.filter(
            packet => packet.seq_id <= data.seq_id
        );
        this.#sendBufferedPacketsIfNeeded();
    }

    #sendBufferedPacketsIfNeeded() {
        // Do nothing if the socket is not open.
        if (this.#websocket.readyState !== WebSocket.OPEN) {
            return;
        }

        // Send the buffered packets as long as there are less than the max number of
        // in-flight packets.
        while (
            this.#bufferedPackets.length > 0 &&
            this.#inflightPackets.length < MAX_IN_FLIGHT_PACKETS
        ) {
            // Remove the packet from the buffered packets and add it to the inflight packets.
            const packet = this.#bufferedPackets.shift();
            this.#inflightPackets.push(packet);

            // Serialize the packet and send it to the server.
            const serializedPacket = this.#serializeAudioPacket(packet);
            this.#websocket.send(serializedPacket);
        }
    }
}
