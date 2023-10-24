import { beforeAll, afterAll, afterEach } from 'vitest';
import setupTestServer from './utils/mockSocketServer';
let socketSever;
let serverSocket;

beforeAll(async() => {
  const response = await setupTestServer()
  socketServer = response.io;
  serverSocket = response.serverSocket;
})

afterAll(() => {
  socketSever.close();
  serverSocket.close();
  console.log('after all')
})
// runs a cleanup after each test case (e.g. clearing jsdom)
afterEach(() => {
  cleanup();
  console.log('cleanup')
});