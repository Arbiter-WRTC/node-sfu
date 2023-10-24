import { RTCPeerConnection } from 'wrtc';

class Consumer {
  constructor(remotePeerId, socket, clientId, rtcConfig) {
    this.clientId = clientId;
    this.connection = new RTCPeerConnection(rtcConfig);
    this.remotePeerId = remotePeerId;
    this.socket = socket;
    this.mediaTracks = {};
    this.registerConnectionCallbacks();
    //this.addChatChannel();
  }

  registerConnectionCallbacks() {
    this.connection.onicecandidate = this.handleRtcIceCandidate.bind(this);
    this.connection.onconnectionstatechange =
      this.handleRtcConnectionStateChange.bind(this);
    this.connection.onnegotiationneeded =
      this.handleRtcConnectionNegotiation.bind(this);
  }

  handleRtcIceCandidate({ candidate }) {
    if (candidate) {
      this.socket.emit('consumerHandshake', {
        candidate,
        clientId: this.clientId,
        remotePeerId: this.remotePeerId,
      });
    }
  }

  async handleRtcConnectionNegotiation() {
    console.log('Consumer attempting offer ...');
    const offer = await this.connection.createOffer();
    await this.connection.setLocalDescription(offer);
    console.log(this.clientId);
    this.socket.emit('consumerHandshake', {
      description: this.connection.localDescription,
      clientId: this.clientId,
      remotePeerId: this.remotePeerId,
    });
  }

  addTrack(track) {
    this.connection.addTrack(track);
  }

  async handshake(description, candidate) {
    if (description) {
      console.log('Got a description, setting');
      await this.connection.setRemoteDescription(description);
    } else if (candidate) {
      try {
        console.log('Adding ice candidate from client');
        await this.connection.addIceCandidate(candidate);
      } catch (e) {
        if (candidate.candidate.length > 1) {
          console.log('unable to add ICE candidate for SFU', e);
        }
      }
    }
  }

  handleRtcConnectionStateChange() {
    console.log(`State changed to ${this.connection.connectionState}`);
  }

  // addChatChannel() {
  //   console.log('trying to add a chat channel');
  //   this.connection.chatChannel = this.connection.createDataChannel('chat', {
  //     negotiated: true,
  //     id: 100,
  //   });
  //   // this.connection.chatChannel.send('Hello from the SFU');
  //   this.connection.chatChannel.onmessage = (event) => {
  //     console.log('Got a chat message from the SFU', event.data);
  //   };
  // }
}

export default Consumer;
