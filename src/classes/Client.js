import Producer from './Producer';
import Consumer from './Consumer';

class Client {
  constructor(sfuId, clientId, socket, eventEmitter, rtcConfig) {
    this.socket = socket;
    this.sfuId = sfuId;
    this.clientId = clientId;
    this.rtcConfig = rtcConfig;
    this.eventEmitter = eventEmitter;
    this.producer = new Producer(
      this.sfuId,
      this.clientId,
      this.socket,
      this.eventEmitter,
      this.rtcConfig
    );
    this.consumers = new Map();
  }

  producerHandshake(data) {
    this.producer.handshake(data);
  }

  consumerHandshake(data) {
    const { remotePeerId } = data;
    const consumer = this.findConsumerById(remotePeerId);
    if (!consumer) {
      console.log('error: consumer not found');
      return;
    }
    consumer.handshake(data);
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
    this.consumers.set(
      remotePeerId,
      new Consumer(
        this.sfuId,
        this.clientId,
        remotePeerId,
        this.socket,
        this.rtcConfig
      )
    );
    return this.consumers.get(remotePeerId);
  }

  shareFeatures(id, features) {
    this.producer.shareFeatures(id, features);
  }

  setFeatures(features) {
    this.producer.setFeatures(features);
  }

  getFeatures() {
    return this.producer.getFeatures();
  }

  pruneClient() {
    this.producer.closeConnection();
    this.consumers.forEach((consumer) => consumer.closeConnection());
  }

  sendChatMessage(data) {
    this.producer.sendChatMessage(data);
  }
}

export default Client;
