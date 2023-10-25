import { Server } from "socket.io";
import { createServer } from "http";

export default async function setupTestServer() {
  const httpServer = createServer();

  const io = new Server(httpServer);
  httpServer.listen(3000);
  console.log('listening on port 3000');
  let serverSocket;

  io.on("connection", (connectedSocket) => {
    // clientConnect, consumerHandshake, producerHandshake
    serverSocket = connectedSocket;
  });

  return {io, serverSocket}
}