import express from 'express';
import cors from 'cors';
import io from 'socket.io-client';
import { RTCPeerConnection } from 'wrtc';
import https from 'https';
import fs from 'fs';

/*
run this to run SFU locally to generate self-signed certificates
  openssl req -new -neopenssl req -new -newkey rsa:2048 -days 365 -nodes -x509 -keyout server.key -out server.crt
mac:
  openssl req -newkey rsa:2048 -days 365 -nodes -x509 -keyout server.key -out server.crt

*/

const privateKey = fs.readFileSync('server.key', 'utf8');
const certificate = fs.readFileSync('server.crt', 'utf8');
const credentials = { key: privateKey, cert: certificate };

const app = express();
const httpsServer = https.createServer(credentials, app);

app.use(cors());
const RTC_CONFIG = null;

class Producer {
  constructor(socket, id) {
    this.id = id;
    this.connection = new RTCPeerConnection(RTC_CONFIG);
    this.registerConnectionCallbacks();
    this.consumers = new Map();
    this.socket = socket;
    this.isNegotiating = false;
    this.addChatChannel();
    this.mediaTracks = {};
  }

  registerConnectionCallbacks() {
    this.connection.onicecandidate = this.handleRtcIceCandidate.bind(this);
    this.connection.ontrack = this.handleRtcPeerTrack.bind(this);
    this.connection.onconnectionstatechange =
      this.handleRtcConnectionStateChange.bind(this);
  }

  handleRtcIceCandidate({ candidate }) {
    // console.log('handling ice candidate');
    if (candidate) {
      // console.log(
      //   'attempting to handle an ICE candidate type ',
      //   candidate.type
      // );
      this.socket.emit('producerHandshake', { candidate, clientId: this.id });
    }
  }

  handleRtcPeerTrack({ track }) {
    console.log(`handle incoming ${track.kind} track...`);
    // this.connection.mediaTracks[track.kind] = track;
    // this.connection.addTrack(track);
  }

  handleRtcConnectionStateChange() {
    console.log(`State changed to ${this.connection.connectionState}`);
    console.log(this.connection.chatChannel);
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

  async handleProducerHandshake({ clientId, description, candidate }) {
    let producer = this.findProducerById(clientId);
    if (!producer) {
      producer = this.addProducer(clientId);
    }

    if (description) {
      console.log('trying to negotiate', description.type);

      if (this.isNegotiating) {
        console.log('Skipping nested negotiations');
        return;
      }

      this.isNegotiating = true;
      await producer.connection.setRemoteDescription(description);
      this.isNegotiating = false;

      if (description.type === 'offer') {
        const answer = await producer.connection.createAnswer();
        await producer.connection.setLocalDescription(answer);

        console.log(
          `Sending ${producer.connection.localDescription.type} to ${clientId}`
        );
        this.socket.emit('producerHandshake', {
          description: producer.connection.localDescription,
          clientId,
        });
      }
    } else {
      try {
        console.log('Adding an ice candidate');
        await producer.connection.addIceCandidate(candidate);
      } catch (e) {
        if (candidate.candidate.length > 1) {
          console.log('unable to add ICE candidate for peer', e);
        }
      }
    }
  }

  addProducer(id) {
    this.producers.set(id, new Producer(this.socket, id));
    return this.producers.get(id);
  }

  findProducerById(id) {
    return this.producers.get(id);
  }
}

class Consumer {
  constructor() {
    // TODO: Create a new WebRTC Connection
  }
}

const sfu = new SFU('http://localhost:3000');

export default httpsServer;
