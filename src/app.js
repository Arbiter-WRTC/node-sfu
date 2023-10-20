import express from 'express';
import cors from 'cors';
import io from 'socket.io-client';
import { RTCPeerConnection } from 'wrtc';
import https from 'https';
import fs from 'fs';

import EventEmitter from 'events';

/*
run this to run SFU locally to generate self-signed certificates
UBUNTU: openssl req -new -neopenssl req -new -newkey rsa:2048 -days 365 -nodes -x509 -keyout server.key -out server.crt
MACOS: openssl req -newkey rsa:2048 -days 365 -nodes -x509 -keyout server.key -out server.crt

*/

const privateKey = fs.readFileSync('server.key', 'utf8');
const certificate = fs.readFileSync('server.crt', 'utf8');
const credentials = { key: privateKey, cert: certificate };

const app = express();
const httpsServer = https.createServer(credentials, app);

app.use(cors());
const RTC_CONFIG = null;

class Producer {
  constructor(socket, id, eventEmitter) {
    this.id = id;
    this.connection = new RTCPeerConnection(RTC_CONFIG);
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
    this.mediaTracks[track.kind] = track;
    this.eventEmitter.emit('producerTrack', { id: this.id, kind: track.kind });
  }

  handleRtcConnectionStateChange() {
    console.log(`State changed to ${this.connection.connectionState}`);
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

class Client {
  constructor(id, socket, eventEmitter) {
    this.socket = socket;
    this.id = id;
    this.eventEmitter = eventEmitter;
    this.producer = new Producer(this.socket, id, this.eventEmitter);
    this.consumers = new Map();
  }

  createNewConsumer() {}

  async producerHandshake(description, candidate) {
    if (description) {
      console.log('trying to negotiate', description.type);

      if (this.isNegotiating) {
        console.log('Skipping nested negotiations');
        return;
      }

      this.isNegotiating = true;
      await this.producer.connection.setRemoteDescription(description);
      this.isNegotiating = false;

      if (description.type === 'offer') {
        const answer = await this.producer.connection.createAnswer();
        await this.producer.connection.setLocalDescription(answer);

        console.log(
          `Sending ${this.producer.connection.localDescription.type} to ${this.id}`
        );
        this.socket.emit('producerHandshake', {
          description: this.producer.connection.localDescription,
          clientId: this.id,
        });
      }
    } else if (candidate) {
      try {
        console.log('Adding an ice candidate');
        await this.producer.connection.addIceCandidate(candidate);
      } catch (e) {
        if (candidate.candidate.length > 1) {
          console.log('unable to add ICE candidate for peer', e);
        }
      }
    }
  }

  getProducerTrack(kind) {
    // return this.producer;
    // mediaTracks[kind];
    // tracks;
  }

  addConsumerTrack(remotePeerId, track) {
    let consumer = this.findConsumerById(remotePeerId);
    if (!consumer) {
      consumer = this.createConsumer(remotePeerId);
    }
    // TODO: Add track to consumer
  }

  findConsumerById(remotePeerId) {
    return this.consumers.get(remotePeerId);
  }

  createConsumer(remotePeerId) {
    this.consumers.set(remotePeerId, new Consumer(remotePeerId, this.socket));
    return this.consumers.get(remotePeerId);
  }
}

class SFU {
  constructor(socketUrl) {
    this.clients = new Map();
    this.socket = io(socketUrl);
    this.bindSocketEvents();
    this.eventEmitter = new EventEmitter();
    this.bindClientEvents();
  }

  bindClientEvents() {
    this.eventEmitter.on('producerTrack', this.handleProducerTrack.bind(this));
  }

  handleProducerTrack({ id, kind }) {
    console.log('Handling Producer Track Event, Track added for:', id);
    const client = this.findClientById(id);
    const track = client.getProducerTrack(kind);
    this.clients.forEach((client, clientId) => {
      if (clientId === id) {
        return;
      }

      client.addConsumerTrack(id, track);
    });
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
    let client = this.findClientById(clientId);

    if (!client) {
      client = this.addClient(clientId);
    }

    client.producerHandshake(description, candidate);
  }

  addClient(id) {
    this.clients.set(id, new Client(id, this.socket, this.eventEmitter));
    return this.clients.get(id);
  }

  findClientById(id) {
    return this.clients.get(id);
  }
}

class Consumer {
  constructor(remotePeerId, socket) {
    //TODO: Create a new WebRTC Connection
    this.remotePeerId = remotePeerId;
    this.socket = socket;
    this.connection = new RTCPeerConnection(RTC_CONFIG);
  }
}

const sfu = new SFU('http://localhost:3000');

export default httpsServer;
