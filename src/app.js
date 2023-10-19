import express from 'express';
import cors from 'cors';
import io from 'socket.io-client';
import { RTCPeerConnection } from 'wrtc';

const app = express();
app.use(cors());
const RTC_CONFIG = null;
class Producer {
  constructor(socket) {
    this.connection = new RTCPeerConnection(RTC_CONFIG);
    this.consumers = new Map();
    this.socket = socket;
  }

  addConnectionCallbacks() {
    this.connection.onicecandidate = this.handleRtcIceCandidate.bind(this);
    this.connection.ontrack = this.handleRtcPeerTrack.bind(this);
    this.connection.onconnectionstatechange =
      this.handleRtcConnectionStateChange.bind(this);
  }

  handleRtcIceCandidate({ candidate }) {
    if (candidate) {
      console.log(
        'attempting to handle an ICE candidate type ',
        candidate.type
      );
      this.socket.emit('producerHandshake', { candidate });
    }
  }

  handleRtcPeerTrack({ track }) {
    console.log(`handle incoming ${track.kind} track...`);
    this.connection.mediaTracks[track.kind] = track;
    this.connection.addTrack(track);
  }

  handleRtcConnectionStateChange() {
    console.log(`State changed to ${this.connection.connectionState}`);
  }
}
class SFU {
  constructor(socketUrl) {
    this.producers = new Map();
    this.socket = io(socketUrl);
    this.bindSocketEvents();
  }

  bindSocketEvents() {
    this.socket.on('connect', this.handleConnect.bind(this));
    this.socket.on(
      'producerHandshake',
      this.handleProducerHandshake.bind(this)
    );
  }

  handleConnect() {
    console.log('connected to websocket server');
    this.socket.emit('clientConnect', { type: 'sfu' });
  }

  async handleProducerHandshake({ sender, description, candidate }) {
    const producer = this.findProducerById(sender);

    if (description) {
      await producer.connection.setRemoteDescription(description);

      if (description.type === 'offer') {
        const answer = await producer.connection.createAnswer();
        await producer.connection.setLocalDescription(answer);
        this.socket.emit('producerHandshake', {
          description: producer.connection.localDescription,
        });
      }
    } else {
      try {
        await producer.connection.addIceCandidate(candidate);
      } catch (e) {
        if (candidate.candidate.length > 1) {
          console.log('unable to add ICE candidate for peer', e);
        }
      }
    }
  }

  addProducer(id) {
    this.producers.set(id, new Producer(this.socket));
  }

  findProducerById(id) {
    this.producers.get(id);
  }
}

class Consumer {
  constructor() {
    // TODO: Create a new WebRTC Connection
  }
}

const sfu = new SFU('http://localhost:3000');

export default app;
