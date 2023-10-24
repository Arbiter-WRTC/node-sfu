/**
 * @vitest-environment node
 */

import { describe, it, expect, vi } from "vitest";
import io from 'socket.io-client';
import Consumer from "../classes/Consumer";
import EventEmitter from 'events';


describe("Consumer tests", () => {
  // mock the socket connection

  // we can try mount(Producer) -> trigger(event) to test event handlers
  it('connects to wss', () => {
    const socket = io('https://localhost:3000');
    expect(socket).not.toBe(undefined)
  })

});
