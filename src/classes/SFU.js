import Client from './Client';
import io from 'socket.io-client';
import EventEmitter from 'events';
import { v4 as uuidv4 } from 'uuid';
import WebSocket from 'ws';

class SFU {
  constructor(socketUrl, rtcConfig) {
    this.sfuId = uuidv4();
    this.rtcConfig = rtcConfig;
    this.clients = new Map();
    // this.socket = io(socketUrl);
    this.socket = new WebSocket(socketUrl);
    this.eventEmitter = new EventEmitter();
    this.bindSocketEvents();
    this.bindClientEvents();
  }

  bindClientEvents() {
    this.eventEmitter.on('producerTrack', this.handleProducerTrack.bind(this));
    this.eventEmitter.on(
      'featuresShared',
      this.handleFeaturesShared.bind(this)
    );
  }

  handleFeaturesShared({ id, features, initialConnect }) {
    if (initialConnect) {
      this.featuresCatchup(id);
    }

    // Now share the features with all other peers
    this.clients.forEach((client, clientId) => {
      if (clientId === id) {
        client.setFeatures(features);
        return;
      }

      client.shareFeatures(id, features);
    });
  }

  featuresCatchup(catchupClientId) {
    const catchupClient = this.findClientById(catchupClientId);
    this.clients.forEach((client, clientId) => {
      if (clientId === catchupClientId) {
        return;
      }
      catchupClient.shareFeatures(clientId, client.getFeatures());
    });
  }

  handleProducerTrack({ id, track }) {
    console.log('Handling Producer Track Event, Track added for:', id);
    this.clients.forEach((client, clientId) => {
      if (clientId === id) {
        if (client.caughtUp) {
          return;
        }

        client.caughtUp = true;
        this.consumerCatchup(clientId);
        return;
      }
      console.log(id, clientId, track.kind);
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
    // this.socket.on('connect', this.handleConnect.bind(this));
    // this.socket.on(
    //   'producerHandshake',
    //   this.handleProducerHandshake.bind(this)
    // );
    // this.socket.on(
    //   'consumerHandshake',
    //   this.handleConsumerHandshake.bind(this)
    // );
    // this.socket.on('clientDisconnect', this.handleClientDisconnect.bind(this));

    this.socket.addEventListener('open', this.handleConnect.bind(this));
    this.socket.addEventListener('message', this.handleMessage.bind(this));
  }

  handleConnect() {
    console.log('connected to websocket server');

    const payload = {
      action: 'identify',
      data: {
        id: this.sfuId,
        type: 'sfu',
      },
    };

    console.log('Identifying...', this.sfuId);
    this.socket.send(JSON.stringify(payload));
  }

  handleMessage(e) {
    console.log('Got a message');
    const data = JSON.parse(e.data);

    if (data.connectionId) {
      console.log(data);
    }

    switch (data.type) {
      case 'producer':
        console.log('Got a producer handshake');
        this.handleProducerHandshake(data);
        break;

      case 'consumer':
        console.log('Got a consumer handshake');
        this.handleConsumerHandshake(data);
        break;

      default:
        console.log('invalid handshake type');
    }
  }

  // handleConnect() {
  //   console.log('connected to websocket server');
  //   this.socket.emit('clientConnect', { type: 'sfu' });
  // }

  async handleProducerHandshake(data) {
    const { sender } = data;
    let client = this.findClientById(sender);

    if (!client) {
      client = this.addClient(sender);
    }
    client.producerHandshake(data);
  }

  async handleConsumerHandshake(data) {
    const { sender } = data;
    let client = this.findClientById(sender);
    if (client) {
      client.consumerHandshake(data);
    }
  }

  async handleClientDisconnect({ clientId }) {
    // find the offending client, close all of their consumer connections, then close their connection
    // iterate through the rest of the clients, close all of their consumer connections that match the client id
    const closedClient = this.findClientById(clientId);
    console.log('to delete', closedClient);
    await closedClient.pruneClient();
    this.clients.delete(clientId);
    console.log('should be undefined', this.findClientById(clientId));
    this.clients.forEach((client) => {
      const toCloseConsumer = client.findConsumerById(clientId);
      toCloseConsumer.closeConnection();
      console.log('deleted', clientId);
      client.consumers.delete(clientId);
    });
  }

  addClient(clientId) {
    console.log('Adding new Client:', clientId);

    this.clients.set(
      clientId,
      new Client(
        this.sfuId,
        clientId,
        this.socket,
        this.eventEmitter,
        this.rtcConfig
      )
    );
    return this.clients.get(clientId);
  }

  findClientById(id) {
    return this.clients.get(id);
  }
}

export default SFU;
