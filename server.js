// server.js
const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.get("/playercontrols.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "playercontrols.html"));
});

// Create HTTP server and bind socket.io to it
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// In-memory room storage
// rooms = {
//   "12345678": {
//      roomCode: "12345678",
//      players: [ { id, name, character, ready } ]
//   }
// }
const rooms = {};

// Helper: generate unique 8-digit room code
function generateRoomCode() {
  let code;
  do {
    code = Math.floor(10000000 + Math.random() * 90000000).toString(); // 8 digits
  } while (rooms[code]);
  return code;
}

/* ---------------------- SOCKET.IO LOGIC ---------------------- */

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("connect", () => {
    console.log("PlayerControls connected, id:", socket.id);
});

  // Unity (or anyone) asks to create a room
  // client: socket.emit("createRoom", (response) => { ... })
  socket.on("createRoom", (callback) => {
    console.log("creating room");

    const roomCode = generateRoomCode();
    const room = {
      roomCode,
      players: [],
    };
    rooms[roomCode] = room;

    socket.join(roomCode);
    console.log(`Room created ${roomCode} by socket ${socket.id}`);

    if (typeof callback === "function") {
      callback({ roomCode });
    }
  });

  // HTML or Unity joins a room
  // client: socket.emit("joinRoom", { roomCode, name, character }, (res) => { ... })
  socket.on("joinRoom", (data, callback) => {
    const { roomCode, name, character } = data || {};
    const room = rooms[roomCode];

    if (!room) {
      if (typeof callback === "function") {
        callback({ success: false, error: "Room not found" });
      }
      return;
    }

    if (!name || !character) {
      if (typeof callback === "function") {
        callback({ success: false, error: "Missing name or character" });
      }
      return;
    }

    // track this player by socket.id and ready state
    const player = {
      id: socket.id,
      name,
      character,
      ready: false,
    };

    room.players.push(player);

    socket.join(roomCode);
    console.log(`Player joined room ${roomCode}:`, player);

    // Notify everyone in this room (including Unity) about new state
    io.to(roomCode).emit("roomUpdated", room);

    if (typeof callback === "function") {
      callback({
        success: true,
        roomCode,
        player,
        playerCount: room.players.length,
      });
    }
  });

  // Player presses "I'm ready" button
  // client: socket.emit("setReady", { roomCode }, (res) => { ... })
  socket.on("setReady", (data, callback) => {
    const { roomCode } = data || {};
    const room = rooms[roomCode];

    if (!room) {
      if (typeof callback === "function") {
        callback({ success: false, error: "Room not found" });
      }
      return;
    }

    // find the player belonging to this socket
    const player = room.players.find((p) => p.id === socket.id);
    if (!player) {
      if (typeof callback === "function") {
        callback({ success: false, error: "Player not in room" });
      }
      return;
    }

    player.ready = true;
    console.log(`Player ${player.name} is READY in room ${roomCode}`);

    // notify everyone that room state changed
    io.to(roomCode).emit("roomUpdated", room);

    // check if all players are ready
    const allReady =
      room.players.length > 0 && room.players.every((p) => p.ready);

    if (allReady) {
      console.log(`All players ready in room ${roomCode}, starting game!`);
      io.to(roomCode).emit("gameStart", room);
    }

    if (typeof callback === "function") {
      callback({ success: true });
    }
  });

  // Phone / browser control input → forward to Unity
  // client: socket.emit("playerControl", { roomCode, playerName, action, x, y });
  socket.on("playerControl", (data) => {
    const { roomCode, playerName, action, x, y } = data || {};

    if (!roomCode) {
      console.log("playerControl without roomCode, ignoring");
      return;
    }

    const room = rooms[roomCode];
    if (!room) {
      console.log(`playerControl: room ${roomCode} not found`);
      return;
    }

    //Konnte ein Problem sein wenn der PLayer disconnectes and reconnects

    const payload = {
      roomCode,
      playerName,
      action,
      x,
      y
    };

    io.to(roomCode).emit("playerControl", payload);
  });


  socket.on("playerControllableAreaTriggerEntered", (data) => {
    const { roomCode, playerName, action, description } = data || {};

    if (!roomCode) return;

    const room = rooms[roomCode];
    if (!room) {
      console.log(`TriggerEntered: room ${roomCode} not found`);
      return;
    }

    // 1. Debug: Print everyone currently in the room
    console.log(`Checking room ${roomCode}. Looking for: '${playerName}'`);
    console.log("Current players:", room.players.map(p => p.name));

    // 2. Find the player (Added .trim() to handle accidental spaces)
    const targetPlayer = room.players.find(p => p.name === playerName.trim());

    if (targetPlayer) {
      const payload = { roomCode, playerName, action, description };
      io.to(targetPlayer.id).emit("playerControllableAreaTriggerEntered", payload);
      console.log(`Sent trigger to ${playerName}`);
    } else {
      console.log(`ERROR: Player '${playerName}' not found in room ${roomCode}`);
    }
  });

  socket.on("playerControllableAreaTriggerLeft", (data) => {
    const { roomCode, playerName, action } = data || {};

    if (!roomCode){
      console.log("no Room Code by playerControllableAreaTriggerLeft. returning");
    }

    const room = rooms[roomCode];
    if (!room) {
      console.log(`TriggerLeft: room ${roomCode} not found`);
      return;
    }

    // 1. Debug: Print everyone currently in the room
    console.log(`Checking room ${roomCode}. Looking for: '${playerName}'`);
    console.log("Current players:", room.players.map(p => p.name));

    // 2. Find the player (Added .trim() to handle accidental spaces)
    const targetPlayer = room.players.find(p => p.name === playerName.trim());

    if (targetPlayer) {
      const payload = { roomCode, playerName, action };
      io.to(targetPlayer.id).emit("playerControllableAreaTriggerLeft", payload);
      console.log(`Sent trigger to ${playerName}`);
    } else {
      console.log(`ERROR: Player '${playerName}' not found in room ${roomCode}`);
    }
  });


  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);

    // remove this player from any room they were in
    for (const roomCode of Object.keys(rooms)) {
      const room = rooms[roomCode];
      const index = room.players.findIndex((p) => p.id === socket.id);
      if (index !== -1) {
        const [removed] = room.players.splice(index, 1);
        console.log(
          `Removed player ${removed.name} from room ${roomCode} due to disconnect`
        );

        // notify remaining players in that room
        io.to(roomCode).emit("roomUpdated", room);

        // optional: if room becomes empty you can delete it
        // if (room.players.length === 0) {
        //   delete rooms[roomCode];
        //   console.log(`Room ${roomCode} deleted (empty)`);
        // }
      }
    }
  });
});

/* ---------------------- HTTP ROUTES ---------------------- */

// Serve /rooms/:roomCode as JSON (optional, for debugging)
app.get("/rooms/:roomCode", (req, res) => {
  const { roomCode } = req.params;
  const room = rooms[roomCode];

  if (!room) {
    return res.status(404).json({ error: "Room not found" });
  }

  res.json(room);
});

// Serve HTML for /<8-digit-code>
app.get("/:roomCode", (req, res, next) => {
  const { roomCode } = req.params;
  if (!/^\d{8}$/.test(roomCode)) return next();

  res.sendFile(path.join(__dirname, "public", "join.html"));
});

// Fallback 404
app.use((req, res) => {
  res.status(404).send("Not Found");
});

/* ---------------------- START SERVER ---------------------- */

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
