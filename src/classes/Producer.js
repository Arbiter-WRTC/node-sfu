import { RTCPeerConnection } from 'wrtc';

class Producer {
  constructor(sfuId, clientId, socket, eventEmitter, rtcConfig) {
    this.sfuId = sfuId;
    this.clientId = clientId;
    this.connection = new RTCPeerConnection(rtcConfig);
    this.registerConnectionCallbacks();
    this.socket = socket;
    this.isNegotiating = false;
    this.addChatChannel();
    this.addFeaturesChannel();
    this.mediaTracks = {};
    this.eventEmitter = eventEmitter;
    this.features = {};
    this.queuedCandidates = [];
  }

  registerConnectionCallbacks() {
    this.connection.onicecandidate = this.handleRtcIceCandidate.bind(this);
    this.connection.ontrack = this.handleRtcPeerTrack.bind(this);
    this.connection.onconnectionstatechange =
      this.handleRtcConnectionStateChange.bind(this);
  }

  handleRtcIceCandidate({ candidate }) {
    if (candidate) {
      const payload = {
        action: 'handshake',
        data: {
          type: 'producer',
          sender: this.sfuId,
          receiver: this.clientId,
          candidate: candidate,
        },
      };
      this.socket.send(JSON.stringify(payload));
    }
  }

  handleRtcPeerTrack({ track }) {
    this.mediaTracks[track.kind] = track;
    this.eventEmitter.emit('producerTrack', { id: this.clientId, track });
  }

  handleRtcConnectionStateChange() {
    console.log(`State changed to ${this.connection.connectionState}`);
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
      if (this.isNegotiating || this.connection.remoteDescription !== null) {
        return;
      }

      this.isNegotiating = true;
      description.sdp = this.modifyIceAttributes(description.sdp);
      await this.connection.setRemoteDescription(description);
      this.isNegotiating = false;

      if (description.type === 'offer') {
        const answer = await this.connection.createAnswer();
        await this.connection.setLocalDescription(answer);

        const payload = {
          action: 'handshake',
          data: {
            type: 'producer',
            sender: this.sfuId,
            receiver: this.clientId,
            description: this.connection.localDescription,
          },
        };

        this.socket.send(JSON.stringify(payload));
        this.processQueuedCandidates();
      }
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

  addChatChannel() {
    this.connection.chatChannel = this.connection.createDataChannel('chat', {
      negotiated: true,
      id: 100,
    });
    this.connection.chatChannel.onmessage = (event) => {
      console.log('Got a chat message from the SFU', event.data);
    };
  }

  addFeaturesChannel() {
    this.featuresChannel = this.connection.createDataChannel('features', {
      negotiated: true,
      id: 110,
    });

    this.featuresChannel.onopen = (event) => {
      console.log('Features channel open');
    };

    this.featuresChannel.onmessage = ({ data }) => {
      this.eventEmitter.emit('featuresShared', JSON.parse(data));
    };
  }

  shareFeatures(id, features) {
    if (this.featuresChannel.readyState == 'open') {
      this.featuresChannel.send(JSON.stringify({ id, features }));
    }
  }

  setFeatures(features) {
    this.features = features;
  }

  getFeatures() {
    return this.features;
  }

  closeConnection() {
    this.connection.close();
  }
}

export default Producer;
