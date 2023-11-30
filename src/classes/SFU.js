import Client from './Client';
import EventEmitter from 'events';
import WebSocket from 'ws';

class SFU {
  constructor(socketUrl, rtcConfig, sfuId) {
    this.sfuId = sfuId;
    this.rtcConfig = rtcConfig;
    this.clients = new Map();
    this.socket = new WebSocket(socketUrl);
    this.eventEmitter = new EventEmitter();
  }

  listen() {
    this.bindSocketEvents();
    this.bindClientEvents();
  }

  bindClientEvents() {
    this.eventEmitter.on('producerTrack', this.handleProducerTrack.bind(this));
    this.eventEmitter.on(
      'featuresShared',
      this.handleFeaturesShared.bind(this)
    );
    this.eventEmitter.on('chatMessage', this.handleChatMessage.bind(this));
  }

  handleChatMessage(data) {
    console.log(data);
    this.clients.forEach((client, clientId) => {
      if (clientId === data.id) {
        return;
      }

      client.sendChatMessage(data);
    });
  }

  handleFeaturesShared({ id, features, initialConnect }) {
    if (initialConnect) {
      this.featuresCatchup(id);
    }

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
    const data = JSON.parse(e.data);

    if (data.connectionId) {
      console.log(data);
    }

    switch (data.type) {
      case 'producer':
        console.log('producer!');
        this.handleProducerHandshake(data);
        break;

      case 'consumer':
        console.log('consumer!');
        this.handleConsumerHandshake(data);
        break;

      case 'clientDisconnect':
        console.log('Got a Client Disconnect Message:', data);
        this.handleClientDisconnect(data);
        break;

      default:
        console.log('invalid handshake type');
    }
  }

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
    const closedClient = this.findClientById(clientId);
    await closedClient.pruneClient();
    this.clients.delete(clientId);
    this.clients.forEach((client) => {
      const toCloseConsumer = client.findConsumerById(clientId);
      toCloseConsumer.closeConnection();
      client.consumers.delete(clientId);
    });
  }

  addClient(clientId) {
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
