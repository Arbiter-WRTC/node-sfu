import { RTCPeerConnection } from 'wrtc';

class Producer {
  constructor(socket, id, eventEmitter, rtcConfig) {
    this.id = id;
    this.connection = new RTCPeerConnection(rtcConfig);
    this.registerConnectionCallbacks();
    this.socket = socket;
    this.isNegotiating = false;
    this.addChatChannel();
    this.mediaTracks = {};

    this.eventEmitter = eventEmitter;
  }

  registerConnectionCallbacks() {
    this.connection.onicecandidate = this.handleRtcIceCandidate.bind(this);
    this.connection.ontrack = this.handleRtcPeerTrack.bind(this);
    this.connection.onconnectionstatechange =
      this.handleRtcConnectionStateChange.bind(this);
  }

  handleRtcIceCandidate({ candidate }) {
    if (candidate) {
      this.socket.emit('producerHandshake', { candidate, clientId: this.id });
    }
  }

  handleRtcPeerTrack({ track }) {
    console.log(`handle incoming ${track.kind} track...`);
    this.mediaTracks[track.kind] = track;
    this.eventEmitter.emit('producerTrack', { id: this.id, track: track });
  }

  handleRtcConnectionStateChange() {
    console.log(`State changed to ${this.connection.connectionState}`);
  }

  async handshake(description, candidate) {
    if (description) {
      console.log('trying to negotiate', description.type);

      if (this.isNegotiating) {
        console.log('Skipping nested negotiations');
        return;
      }

      this.isNegotiating = true;
      await this.connection.setRemoteDescription(description);
      this.isNegotiating = false;

      if (description.type === 'offer') {
        const answer = await this.connection.createAnswer();
        await this.connection.setLocalDescription(answer);

        console.log(
          `Sending ${this.connection.localDescription.type} to ${this.id}`
        );
        this.socket.emit('producerHandshake', {
          description: this.connection.localDescription,
          clientId: this.id,
        });
      }
    } else if (candidate) {
      try {
        console.log('Adding an ice candidate');
        await this.connection.addIceCandidate(candidate);
      } catch (e) {
        if (candidate.candidate.length > 1) {
          console.log('unable to add ICE candidate for peer', e);
        }
      }
    }
  }

  addChatChannel() {
    console.log('trying to add a chat channel');
    this.connection.chatChannel = this.connection.createDataChannel('chat', {
      negotiated: true,
      id: 100,
    });
    // this.connection.chatChannel.send('Hello from the SFU');
    this.connection.chatChannel.onmessage = (event) => {
      console.log('Got a chat message from the SFU', event.data);
    };
  }
}

export default Producer;