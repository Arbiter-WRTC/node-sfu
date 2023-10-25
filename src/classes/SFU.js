import Client from './Client';
import io from 'socket.io-client';
import EventEmitter from 'events';

class SFU {
  constructor(socketUrl, rtcConfig) {
    this.rtcConfig = rtcConfig;
    this.clients = new Map();
    this.socket = io(socketUrl);
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
    this.clients.set(
      id,
      new Client(id, this.socket, this.eventEmitter, this.rtcConfig)
    );
    return this.clients.get(id);
  }

  findClientById(id) {
    return this.clients.get(id);
  }
}

export default SFU;
