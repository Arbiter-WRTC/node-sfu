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

class Consumer {
  constructor(remotePeerId, socket, clientId) {
    this.clientId = clientId;
    this.connection = new RTCPeerConnection(RTC_CONFIG);
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
    // console.log('handling ice candidate');
    if (candidate) {
      // console.log(
      //   'attempting to handle an ICE candidate type ',
      //   candidate.type
      // );
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

class Client {
  constructor(id, socket, eventEmitter) {
    this.socket = socket;
    this.id = id;
    this.eventEmitter = eventEmitter;
    this.producer = new Producer(this.socket, id, this.eventEmitter);
    this.consumers = new Map();
  }

  producerHandshake(description, candidate) {
    this.producer.handshake(description, candidate);
  }

  consumerHandshake(remotePeerId, description, candidate) {
    const consumer = this.findConsumerById(remotePeerId);
    console.log(this.consumers);
    console.log('Calling handhsake for consumer with id:', remotePeerId);
    consumer.handshake(description, candidate);
  }

  getProducerTrack(kind) {
    return this.producer.mediaTracks[kind];
  }

  addConsumerTrack(remotePeerId, track) {
    let consumer = this.findConsumerById(remotePeerId);
    if (!consumer) {
      consumer = this.createConsumer(remotePeerId);
    }

    consumer.addTrack(track);
  }

  findConsumerById(remotePeerId) {
    return this.consumers.get(remotePeerId);
  }

  createConsumer(remotePeerId) {
    console.log('a new consumer is added');
    this.consumers.set(
      remotePeerId,
      new Consumer(remotePeerId, this.socket, this.id)
    );
    return this.consumers.get(remotePeerId);
  }
}

class SFU {
  constructor(socketUrl) {
    this.clients = new Map();
    this.socket = io(socketUrl);
    this.eventEmitter = new EventEmitter();
    this.bindSocketEvents();
    this.bindClientEvents();
  }

  bindClientEvents() {
    this.eventEmitter.on('producerTrack', this.handleProducerTrack.bind(this));
  }

  handleProducerTrack({ id, track }) {
    console.log('Handling Producer Track Event, Track added for:', id);
    this.clients.forEach((client, clientId) => {
      if (clientId === id) {
        this.consumerCatchup(clientId);
        return;
      }

      client.addConsumerTrack(id, track);
    });
  }

  consumerCatchup(catchupClientId) {
    const catchupClient = this.findClientById(catchupClientId);
    this.clients.forEach((client, clientId) => {
      if (clientId === catchupClientId) {
        return;
      }

      const tracks = Object.values(client.producer.mediaTracks);
      tracks.forEach((track) => {
        catchupClient.addConsumerTrack(clientId, track);
      });
    });
  }

  bindSocketEvents() {
    this.socket.on('connect', this.handleConnect.bind(this));
    this.socket.on(
      'producerHandshake',
      this.handleProducerHandshake.bind(this)
    );
    this.socket.on(
      'consumerHandshake',
      this.handleConsumerHandshake.bind(this)
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

  async handleConsumerHandshake({
    clientId,
    remotePeerId,
    description,
    candidate,
  }) {
    let client = this.findClientById(clientId);
    if (client) {
      client.consumerHandshake(remotePeerId, description, candidate);
    }
  }

  addClient(id) {
    this.clients.set(id, new Client(id, this.socket, this.eventEmitter));
    return this.clients.get(id);
  }

  findClientById(id) {
    return this.clients.get(id);
  }
}

const sfu = new SFU('http://localhost:3000');

export default httpsServer;
