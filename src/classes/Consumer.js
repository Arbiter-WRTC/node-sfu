import { RTCPeerConnection } from 'wrtc';

class Consumer {
  constructor(sfuId, clientId, remotePeerId, socket, rtcConfig) {
    this.sfuId = sfuId;
    this.clientId = clientId;
    this.remotePeerId = remotePeerId;
    this.connection = new RTCPeerConnection(rtcConfig);
    this.socket = socket;
    this.mediaTracks = {};
    this.registerConnectionCallbacks();
    //this.addChatChannel();

    this.queuedCandidates = [];
  }

  registerConnectionCallbacks() {
    this.connection.onicecandidate = this.handleRtcIceCandidate.bind(this);
    this.connection.onnegotiationneeded =
      this.handleRtcConnectionNegotiation.bind(this);
  }

  handleRtcIceCandidate({ candidate }) {
    if (candidate) {
      const payload = {
        action: 'handshake',
        data: {
          type: 'consumer',
          sender: this.sfuId,
          receiver: this.clientId,
          remotePeerId: this.remotePeerId,
          candidate: candidate,
        },
      };
      this.socket.send(JSON.stringify(payload));
    }
  }

  async handleRtcConnectionNegotiation() {
    const offer = await this.connection.createOffer();
    await this.connection.setLocalDescription(offer);

    const payload = {
      action: 'handshake',
      data: {
        type: 'consumer',
        sender: this.sfuId,
        receiver: this.clientId,
        remotePeerId: this.remotePeerId,
        description: this.connection.localDescription,
      },
    };

    this.socket.send(JSON.stringify(payload));
  }

  addTrack(track) {
    this.connection.addTrack(track);
  }

  modifyIceAttributes(sdp) {
    const iceAttributesRegex = /a=(ice-pwd:|ice-ufrag:)(.*)/gi;
    const modifiedSdp = sdp.replace(
      iceAttributesRegex,
      (_, attribute, value) => {
        // Replace spaces with '+'
        const modifiedValue = value.replace(/ /g, '+');
        return `a=${attribute}${modifiedValue}`;
      }
    );
    return modifiedSdp;
  }

  async handshake(data) {
    console.log(data);
    const { description, candidate } = data;
    if (description) {
      description.sdp = this.modifyIceAttributes(description.sdp);
      await this.connection.setRemoteDescription(description);
      this.processQueuedCandidates();
    } else if (candidate) {
      try {
        if (candidate.candidate.length > 1) {
          this.handleReceivedIceCandidate(candidate);
        }
      } catch (e) {
        if (candidate.candidate.length > 1) {
          console.log('unable to add ICE candidate for peer', e);
        }
      }
    }
  }

  async handleReceivedIceCandidate(candidate) {
    if (this.connection.remoteDescription === null) {
      this.queuedCandidates.push(candidate);
    } else {
      await this.connection.addIceCandidate(candidate);
    }
  }

  async processQueuedCandidates() {
    while (this.queuedCandidates.length > 0) {
      const candidate = this.queuedCandidates.shift();
      try {
        await this.connection.addIceCandidate(candidate);
      } catch (e) {
        if (candidate.candidate.length > 1) {
          console.log('unable to add ICE candidate for peer', e);
        }
      }
    }
  }

  closeConnection() {
    this.connection.close();
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
