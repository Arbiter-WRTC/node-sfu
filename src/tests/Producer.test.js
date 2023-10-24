/**
 * @vitest-environment node
 */

import { describe, it, expect, vi } from "vitest";
import io from 'socket.io-client';
import Producer from "../classes/Producer";
import EventEmitter from 'events';

describe("Producer tests", () => {
  // we can try mount(Producer) -> trigger(event) to test event handlers
  it('connects to wss', () => {
    const socket = io('https://localhost:3000');
    expect(socket).not.toBe(undefined)
  })

  it('correctly instantiates a Producer', () => {
    const socket = io('https://localhost:3000');
    const producer = new Producer(socket, 1, new EventEmitter(), null)
    expect(producer.socket).not.toBe(undefined);
    expect(producer.id).toBe(1);
    expect(producer.connection).not.toBe(undefined);
    expect(producer.eventEmitter).not.toBe(undefined);
    console.log('all done')
  })
});
