/**
 * @vitest-environment node
 */

import { describe, it, expect, vi } from 'vitest';
import io from 'socket.io-client';
import { FakeMediaStreamTrack } from 'fake-mediastreamtrack';
import Client from '../classes/Client';
import Producer from '../classes/Producer';
import EventEmitter from 'events';
import Consumer from '../classes/Consumer';

describe('Client tests', () => {
  // mock the socket connection

  // we can try mount(Producer) -> trigger(event) to test event handlers
  it('connects to wss', () => {
    const socket = io('https://localhost:3000');
    expect(socket).not.toBe(undefined);
  });

  it('correctly instantiates a new Client', () => {
    const socket = io('https://localhost:3000');
    const client = new Client(1, socket, new EventEmitter(), null);
    expect(client.socket).toBe(socket);
    expect(client.id).toBe(1);
    expect(client.eventEmitter).toBeInstanceOf(EventEmitter);
    expect(client.producer).toBeInstanceOf(Producer);
  });

  it('correctly calls handshake on producer with given args', () => {
    const socket = io('https://localhost:3000');
    const client = new Client(1, socket, new EventEmitter(), null);
    const spy = vi.spyOn(client.producer, 'handshake').mockImplementation(() => {});

    const desc = { a: 1 };
    const cand = { b: 2 };

    client.producerHandshake(desc, cand);

    expect(spy).toHaveBeenCalledWith(desc, cand);
  });

  it('correctly calls handshake on consumer with given args', () => {
    const socket = io('https://localhost:3000');
    const client = new Client(1, socket, new EventEmitter(), null);
    const consumer = new Consumer(2, socket, 1, null)
    client.consumers.set(2, consumer)

    const findSpy = vi.spyOn(client, 'findConsumerById');
    const consumerSpy = vi.spyOn(consumer, 'handshake').mockImplementation(() => {});

    const desc = { a: 1 };
    const cand = { b: 2 };

    client.consumerHandshake(2, desc, cand);

    expect(findSpy).toHaveBeenCalledWith(2);
    expect(consumerSpy).toHaveBeenCalledWith(desc, cand);
  });

  it('does not call handshake on bad consumer', () => {
    const socket = io('https://localhost:3000');
    const client = new Client(1, socket, new EventEmitter(), null);
    const consumer = new Consumer(2, socket, 1, null)
    client.consumers.set(2, consumer)

    const findSpy = vi.spyOn(client, 'findConsumerById');
    const consumerSpy = vi.spyOn(consumer, 'handshake').mockImplementation(() => {});

    const desc = { a: 1 };
    const cand = { b: 2 };

    client.consumerHandshake(3, desc, cand);

    expect(findSpy).toHaveBeenCalledWith(3);
    expect(consumerSpy).not.toHaveBeenCalledWith(desc, cand);
  });

  it('finds a producer media tracks if they exist', () => {
    const socket = io('https://localhost:3000');
    const client = new Client(1, socket, new EventEmitter(), null);
    const spy = vi.spyOn(client, 'getProducerTrack')
    const track = new FakeMediaStreamTrack({kind: 'audio'});
    client.producer.mediaTracks.audio = track;

    const audio = client.getProducerTrack('audio');
    const video = client.getProducerTrack('video');

    expect(spy).toHaveBeenCalledTimes(2);
    expect(audio).toBe(track);
    expect(video).toBe(undefined);
  });

  it('attempts to add a media track for a given consumer if the consumer exists', () => {
    const socket = io('https://localhost:3000');
    const client = new Client(1, socket, new EventEmitter(), null);
    const consumer1 = new Consumer(2, socket, 1, null)
    const consumer2 = new Consumer(3, socket, 1, null)
    client.consumers.set(2, consumer1)

    const findSpy = vi.spyOn(client, 'findConsumerById');
    const createSpy = vi.spyOn(client, 'createConsumer').mockImplementation(() => consumer2)
    const addTrackSpy1 = vi.spyOn(consumer1, 'addTrack').mockImplementation(() => {})
    const addTrackSpy2 = vi.spyOn(consumer2, 'addTrack').mockImplementation(() => {})

    const track = new FakeMediaStreamTrack({kind: 'audio'});
    
    client.addConsumerTrack(2, track);
    client.addConsumerTrack(3, track);

    expect(findSpy).toHaveBeenCalledTimes(2);
    expect(createSpy).toHaveBeenCalledWith(3);
    expect(addTrackSpy1).toHaveBeenCalledOnce();
    expect(addTrackSpy2).toHaveBeenCalledOnce();
  });

  it('correctly finds a consumer by its id', () => {
    const socket = io('https://localhost:3000');
    const client = new Client(1, socket, new EventEmitter(), null);
    const consumer1 = new Consumer(2, socket, 1, null)
    client.consumers.set(2, consumer1)

    const found = client.findConsumerById(2);
    const notFound = client.findConsumerById(3);

    expect(found).toBe(consumer1);
    expect(notFound).toBe(undefined);
  });

  it('correctly creates a new consumer for the remote peer given', () => {
    const socket = io('https://localhost:3000');
    const client = new Client(1, socket, new EventEmitter(), null);

    const consumer = client.createConsumer(2);

    expect(consumer).toBeInstanceOf(Consumer);
    expect(consumer.remotePeerId).toBe(2);
  });
});
