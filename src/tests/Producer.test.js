/**
 * @vitest-environment node
 */

import { describe, it, expect, vi, mount } from 'vitest';
import io from 'socket.io-client';
import Producer from '../classes/Producer';
import EventEmitter from 'events';
import { RTCPeerConnection, RTCSessionDescription } from 'wrtc';
import {FakeMediaStreamTrack} from 'fake-mediastreamtrack'

describe('Producer tests', () => {
  // we can try mount(Producer) -> trigger(event) to test event handlers
  it('connects to wss', () => {
    const socket = io('https://localhost:3000');
    expect(socket).not.toBe(undefined);
  });

  it('instantiates a Producer', () => {
    const socket = io('https://localhost:3000');
    const producer = new Producer(socket, 1, new EventEmitter(), null);
    expect(producer.socket).not.toBe(undefined);
    expect(producer.id).toBe(1);
    expect(producer.connection).toBeInstanceOf(RTCPeerConnection)
    expect(producer.eventEmitter).toBeInstanceOf(EventEmitter)
  });

  it('calls handle ice candidate with an object with a candidate prop', () => {
    const socket = io('https://localhost:3000');
    const spy = vi.spyOn(socket, 'emit');
    const producer = new Producer(socket, 1, new EventEmitter(), null);
    const candidate = { candidate: true, clientId: producer.id };

    producer.handleRtcIceCandidate(candidate);

    expect(spy).toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith(
      'producerHandshake',
      expect.objectContaining(candidate)
    );
  });

  it('calls handle ice candidate with an object without a candidate prop', () => {
    const socket = io('https://localhost:3000');
    const spy = vi.spyOn(socket, 'emit');
    const producer = new Producer(socket, 1, new EventEmitter(), null);
    const candidate = { foo: true, clientId: producer.id };

    producer.handleRtcIceCandidate(candidate);

    expect(spy).not.toHaveBeenCalled();
  });

  it('adds a media track when it gets a signal', () => {
    const socket = io('https://localhost:3000');
    const producer = new Producer(socket, 1, new EventEmitter(), null);
    const spy = vi.spyOn(producer.eventEmitter, 'emit');
    const track = new FakeMediaStreamTrack({ kind: 'audio' });
    
    producer.handleRtcPeerTrack({track});

    expect(producer.mediaTracks['audio']).toBe(track);
    expect(spy).toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith(
      'producerTrack',
      expect.objectContaining({track})
    );
  });

  it('correctly handles a handshake with an sdp', async () => {
    const socket = io('https://localhost:3000');
    const socketSpy = vi.spyOn(socket, 'emit');
    const producer = new Producer(socket, 1, new EventEmitter(), null);
    const remoteDescSpy = vi.spyOn(producer.connection, 'setRemoteDescription');
    const localDescSpy = vi.spyOn(producer.connection, 'setLocalDescription');
    const answerSpy = vi.spyOn(producer.connection, 'createAnswer');
    const description = new RTCSessionDescription();
    description.type = 'offer';
    description.sdp = `v=0\no=- 1234567890 1234567890 IN IP4 127.0.0.1\ns=Test Session\nt=0 0\n`;

    await producer.handshake(description, undefined);

    expect(remoteDescSpy).toHaveBeenCalled();
    expect(answerSpy).toHaveBeenCalled();
    expect(localDescSpy).toHaveBeenCalled();
    expect(socketSpy).toHaveBeenCalled();
    expect(socketSpy).toHaveBeenCalledWith(
      'producerHandshake',
      expect.objectContaining({
        description: producer.connection.localDescription,
      })
    );
  });

  it('correctly rejects a handshake with an sdp when is negotiating is true', async() => {
    const socket = io('https://localhost:3000');
    const spy = vi.spyOn(socket, 'emit');
    const producer = new Producer(socket, 1, new EventEmitter(), null);
    const remoteDescSpy = vi.spyOn(producer.connection, 'setRemoteDescription');
    producer.isNegotiating = true;
    const description = new RTCSessionDescription();
    description.type = 'offer';
    description.sdp = `v=0\no=- 1234567890 1234567890 IN IP4 127.0.0.1\ns=Test Session\nt=0 0\n`;

    await producer.handshake(description, undefined);

    expect(remoteDescSpy).not.toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalled();
  });

  it('correctly handles a handshake with an ice candidate', async() => {
    const socket = io('https://localhost:3000');
    const producer = new Producer(socket, 1, new EventEmitter(), null);
    const remoteDescSpy = vi.spyOn(producer.connection, 'setRemoteDescription');
    const iceCandidateSpy = vi.spyOn(producer.connection, 'addIceCandidate');

    await producer.handshake(undefined, {candidate: [true]})

    expect(remoteDescSpy).not.toHaveBeenCalled();
    expect(iceCandidateSpy).toHaveBeenCalled();
  });

  it('correctly handles a handshake with an ice candidate with too many elements', async() => {
    const socket = io('https://localhost:3000');
    const producer = new Producer(socket, 1, new EventEmitter(), null);
    const remoteDescSpy = vi.spyOn(producer.connection, 'setRemoteDescription');
    const iceCandidateSpy = vi.spyOn(producer.connection, 'addIceCandidate');

    expect(() => producer.handshake(undefined, {foo: 'bar'}).toThrow('TypeError'))

    expect(remoteDescSpy).not.toHaveBeenCalled();
    expect(iceCandidateSpy).not.toHaveBeenCalled();

  });
});
