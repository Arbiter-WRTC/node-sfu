/**
 * @vitest-environment node
 */

import { describe, it, expect, vi } from 'vitest';
import io from 'socket.io-client';
import Consumer from '../classes/Consumer';
import { RTCPeerConnection, RTCSessionDescription } from 'wrtc';
import { FakeMediaStreamTrack } from 'fake-mediastreamtrack';

describe('Consumer tests', () => {
  // mock the socket connection

  // we can try mount(Producer) -> trigger(event) to test event handlers
  it('connects to wss', () => {
    const socket = io('https://localhost:3000');
    expect(socket).not.toBe(undefined);
  });

  it('instantiates a Consumer', () => {
    const socket = io('https://localhost:3000');
    const consumer = new Consumer(2, socket, 1, null);
    expect(consumer.clientId).toBe(1);
    expect(consumer.remotePeerId).toBe(2);
    expect(consumer.connection).toBeInstanceOf(RTCPeerConnection);
    expect(consumer.socket).toBe(socket);
  });

  it('correctly handles an ice candidate', () => {
    const socket = io('https://localhost:3000');
    const spy = vi.spyOn(socket, 'emit');
    const consumer = new Consumer(2, socket, 1, null);
    const candidate = {
      candidate: true,
      clientId: consumer.clientId,
      remotePeerId: consumer.remotePeerId,
    };

    consumer.handleRtcIceCandidate(candidate);

    expect(spy).toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith(
      'consumerHandshake',
      expect.objectContaining(candidate)
    );
  });

  it('calls handle ice candidate with an object without a candidate prop', () => {
    const socket = io('https://localhost:3000');
    const spy = vi.spyOn(socket, 'emit');
    const consumer = new Consumer(2, socket, 1, null);
    const candidate = {
      clientId: consumer.clientId,
      remotePeerId: consumer.remotePeerId,
    };
    consumer.handleRtcIceCandidate(candidate);

    expect(spy).not.toHaveBeenCalled();
  });

  it('makes an offer, sets local description, and emits a handshake', async () => {
    const socket = io('https://localhost:3000');
    const spy = vi.spyOn(socket, 'emit');
    const consumer = new Consumer(2, socket, 1, null);
    const offerSpy = vi.spyOn(consumer.connection, 'createOffer');
    const setLocalDescSpy = vi.spyOn(
      consumer.connection,
      'setLocalDescription'
    );

    await consumer.handleRtcConnectionNegotiation();

    expect(offerSpy).toHaveBeenCalled();
    expect(setLocalDescSpy).toHaveBeenCalled();
    expect(spy).toBeCalledWith(
      'consumerHandshake',
      expect.objectContaining({
        clientId: consumer.clientId,
        remotePeerId: consumer.remotePeerId,
      })
    );
  });

  it('adds a track to the RTCPeerConnection', () => {
    const socket = io('https://localhost:3000');
    const consumer = new Consumer(2, socket, 1, null);
    const track = new FakeMediaStreamTrack({ kind: 'audio' });

    expect(() => consumer.addTrack(track)).toThrow(
      'This is not an instance of MediaStreamTrack'
    );
  });

  it('sets remote description when given a response sdp', async() => {
    const socket = io('https://localhost:3000');
    const consumer = new Consumer(2, socket, 1, null);
    const remoteDescSpy = vi.spyOn(consumer.connection, 'setRemoteDescription');
    const description = new RTCSessionDescription();
    description.type = 'offer';
    description.sdp = `v=0\no=- 1234567890 1234567890 IN IP4 127.0.0.1\ns=Test Session\nt=0 0\n`;

    await consumer.handshake(description, undefined)

    expect(remoteDescSpy).toHaveBeenCalled();
  })

  it('correctly handles a handshake with an ice candidate', async() => {
    const socket = io('https://localhost:3000');
    const consumer = new Consumer(2, socket, 1, null);
    const remoteDescSpy = vi.spyOn(consumer.connection, 'setRemoteDescription');
    const iceCandidateSpy = vi.spyOn(consumer.connection, 'addIceCandidate');

    await consumer.handshake(undefined, {candidate: [true]})

    expect(remoteDescSpy).not.toHaveBeenCalled();
    expect(iceCandidateSpy).toHaveBeenCalled();
  });

  it('correctly handles a handshake with an ice candidate with too many elements', async() => {
    const socket = io('https://localhost:3000');
    const consumer = new Consumer(2, socket, 1, null);
    const remoteDescSpy = vi.spyOn(consumer.connection, 'setRemoteDescription');
    const iceCandidateSpy = vi.spyOn(consumer.connection, 'addIceCandidate');

    expect(() => consumer.handshake(undefined, {foo: 'bar'}).toThrow('TypeError'))

    expect(remoteDescSpy).not.toHaveBeenCalled();
    expect(iceCandidateSpy).not.toHaveBeenCalled();

  });
});
