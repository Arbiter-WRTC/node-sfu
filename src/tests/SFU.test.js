/**
 * @vitest-environment node
 */

import { describe, it, expect, vi } from 'vitest';
import io from 'socket.io-client';
import { FakeMediaStreamTrack } from 'fake-mediastreamtrack';
import SFU from '../classes/SFU';
import Client from '../classes/Client';
import EventEmitter from 'events';

describe('Producer tests', () => {
  // mock the socket connection

  // we can try mount(Producer) -> trigger(event) to test event handlers
  it('connects to wss', () => {
    const socket = io('https://localhost:3000');
    expect(socket).not.toBe(undefined);
  });

  it('correctly constructs an SFU instance', () => {
    const socketUrl = 'https://localhost:3000';
    const sfu = new SFU(socketUrl, null);

    expect(sfu.rtcConfig).toBe(null);
    expect(sfu.clients).not.toBe(undefined);
    expect(sfu.socket._opts.hostname).toBe('localhost');
    expect(sfu.socket._opts.port).toBe('3000');
    expect(sfu.eventEmitter).toBeInstanceOf(EventEmitter);
  });

  it('handles adding a track for an existing producer with no other clients', () => {
    const socketUrl = 'https://localhost:3000';
    const sfu = new SFU(socketUrl, null);
    const socket = io('https://localhost:3000');
    const client = new Client(1, socket, new EventEmitter(), null);
    sfu.clients.set(1, client);
    const track = new FakeMediaStreamTrack({ kind: 'audio' });

    const catchupSpy = vi
      .spyOn(sfu, 'consumerCatchup')
      .mockImplementation(() => {});
    const addSpy = vi
      .spyOn(client, 'addConsumerTrack')
      .mockImplementation(() => {});

    sfu.handleProducerTrack({ id: 1, track });

    expect(catchupSpy).toHaveBeenCalledWith(1);
    expect(addSpy).not.toHaveBeenCalled();
  });

  it('handles adding a track for an existing producer with other clients', () => {
    const socketUrl = 'https://localhost:3000';
    const sfu = new SFU(socketUrl, null);
    const socket = io(socketUrl);
    const client1 = new Client(1, socket, new EventEmitter(), null);
    const client2 = new Client(2, socket, new EventEmitter(), null);

    sfu.clients.set(1, client1);
    sfu.clients.set(2, client2);
    const track = new FakeMediaStreamTrack({ kind: 'audio' });

    const catchupSpy = vi
      .spyOn(sfu, 'consumerCatchup')
      .mockImplementation(() => {});
    const addSpy1 = vi
      .spyOn(client1, 'addConsumerTrack')
      .mockImplementation(() => {});
    const addSpy2 = vi
      .spyOn(client2, 'addConsumerTrack')
      .mockImplementation(() => {});

    sfu.handleProducerTrack({ id: 1, track });

    expect(catchupSpy).toHaveBeenCalledWith(1);
    expect(addSpy1).not.toHaveBeenCalled();
    expect(addSpy2).toHaveBeenCalledWith(1, expect.objectContaining(track));
  });

  it('handles catching up a client with no other clients', () => {
    const socketUrl = 'https://localhost:3000';
    const sfu = new SFU(socketUrl, null);
    const socket = io('https://localhost:3000');
    const client = new Client(1, socket, new EventEmitter(), null);
    sfu.clients.set(1, client);

    const findSpy = vi.spyOn(sfu, 'findClientById');
    const clientTrackSpy = vi.spyOn(client, 'addConsumerTrack');
    sfu.consumerCatchup(1);

    expect(findSpy).toHaveBeenCalled();
    expect(clientTrackSpy).not.toHaveBeenCalled();
  });

  it('handles catching up a client with other clients', () => {
    const socketUrl = 'https://localhost:3000';
    const sfu = new SFU(socketUrl, null);
    const socket = io('https://localhost:3000');
    const client1 = new Client(1, socket, new EventEmitter(), null);
    const client2 = new Client(2, socket, new EventEmitter(), null);
    sfu.clients.set(1, client1);
    sfu.clients.set(2, client2);

    const findSpy = vi.spyOn(sfu, 'findClientById');
    const mediaSpy = vi.spyOn(Object, 'values').mockReturnValue(['foo', 'bar']);
    const addSpy = vi
      .spyOn(client2, 'addConsumerTrack')
      .mockImplementation(() => {});

    sfu.consumerCatchup(2);

    expect(findSpy).toHaveBeenCalled();
    expect(mediaSpy).toHaveBeenCalled();
    expect(addSpy).toHaveBeenCalledWith(1, 'foo');
    expect(addSpy).toHaveBeenCalledWith(1, 'bar');
  });

  it('emits a signal on connect', () => {
    const socketUrl = 'https://localhost:3000';
    const sfu = new SFU(socketUrl, null);
    const spy = vi.spyOn(sfu.socket, 'emit');

    sfu.handleConnect();
    expect(spy).toHaveBeenCalledWith(
      'clientConnect',
      expect.objectContaining({ type: 'sfu' })
    );
  });

  it('calls producer handshake on a client that exists and creates one if not', async () => {
    const socketUrl = 'https://localhost:3000';
    const sfu = new SFU(socketUrl, null);
    const socket = io('https://localhost:3000');
    const client = new Client(1, socket, new EventEmitter(), null);
    const fakeClient = { producerHandshake: () => {} };
    sfu.clients.set(1, client);

    const clientShakeSpy = vi
      .spyOn(client, 'producerHandshake')
      .mockImplementation(() => {});
    const fakeShakeSpy = vi.spyOn(fakeClient, 'producerHandshake');
    const findSpy = vi.spyOn(sfu, 'findClientById');
    const addSpy = vi.spyOn(sfu, 'addClient').mockImplementation(() => {
      return fakeClient;
    });

    await sfu.handleProducerHandshake({
      clientId: 1,
      description: 'foo',
      candidate: 'bar',
    });
    await sfu.handleProducerHandshake({
      clientId: 2,
      description: 'baz',
      candidate: 'qux',
    });

    expect(findSpy).toHaveBeenCalledTimes(2);
    expect(addSpy).toHaveBeenCalledWith(2);
    expect(clientShakeSpy).toHaveBeenCalledWith('foo', 'bar');
    expect(fakeShakeSpy).toHaveBeenCalledWith('baz', 'qux');
  });

  it('handles handshakes for an existing consumer', () => {
    const socketUrl = 'https://localhost:3000';
    const sfu = new SFU(socketUrl, null);
    const socket = io('https://localhost:3000');
    const client = new Client(1, socket, new EventEmitter(), null);
    sfu.clients.set(1, client);

    const findSpy = vi.spyOn(sfu, 'findClientById');
    const shakeSpy = vi
      .spyOn(client, 'consumerHandshake')
      .mockImplementation(() => {});

    sfu.handleConsumerHandshake({
      clientId: 1,
      remotePeerId: 2,
      description: 'foo',
      candidate: 'bar',
    });
    expect(findSpy).toHaveBeenCalled();
    expect(shakeSpy).toHaveBeenCalledWith(2, 'foo', 'bar')
  });

  it('correctly adds a client', () => {
    const socketUrl = 'https://localhost:3000';
    const sfu = new SFU(socketUrl, null);
    expect(sfu.clients).toHaveLength(0)
    const client = sfu.addClient(1);
    expect(sfu.clients).toHaveLength(1)
    expect(client).toBeInstanceOf(Client)

  });

  it('correctly finds a client given its id', () => {
    const socketUrl = 'https://localhost:3000';
    const sfu = new SFU(socketUrl, null);
    const noclient = sfu.findClientById(1)
    expect(noclient).toBe(undefined);
    const client = sfu.addClient(1);
    expect(client).toBeInstanceOf(Client)
  });
});
