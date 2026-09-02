import { createServer } from "http";
import next from "next";
import { Server } from "socket.io";
import { registerRoomHandlers } from "./src/server/rooms";

const port = parseInt(process.env.PORT || "3000", 10);
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  const io = new Server(httpServer, {
    path: "/socket.io",
  });

  io.on("connection", (socket) => {
    registerRoomHandlers(io, socket);
  });

  httpServer.listen(port, () => {
    console.log(`> Risikon pronto su http://localhost:${port}`);
  });
});
