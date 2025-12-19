const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

const rooms = require("./rooms");
const registerSocketHandlers = require("./socketHandlers");
const registerRoutes = require("./routes");

const app = express();
const PORT = 6769;

app.use(cors());
app.use(express.json());

// Register routes (uses rooms module for /rooms/:code ...)
registerRoutes(app, rooms);

// Create HTTP server and bind socket.io to it
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

// Register socket handlers
registerSocketHandlers(io, rooms);

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});