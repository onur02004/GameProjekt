const path = require("path");

module.exports = function registerSocketHandlers(io, roomsModule) {
  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("createRoom", (callback) => {
      const room = roomsModule.createRoom();
      socket.join(room.roomCode);
      console.log(`Room created ${room.roomCode} by socket ${socket.id}`);
      if (typeof callback === "function") callback({ roomCode: room.roomCode });
    });

    socket.on("joinRoom", (data, callback) => {
      const { roomCode, name } = data || {};
      const room = roomsModule.getRoom(roomCode);
      if (!room) {
        if (typeof callback === "function") callback({ success: false, error: "Room not found" });
        return;
      }
      if (!name) {
        if (typeof callback === "function") callback({ success: false, error: "Missing name" });
        return;
      }

      const existing = room.players.find(p => p.name === name);
      if (existing) {
        existing.id = socket.id;
        socket.join(roomCode);
        socket.emit("availableCharacters", room.availableCharacters);
        io.to(roomCode).emit("roomUpdated", room);
        if (typeof callback === "function") {
          callback({ success: true, roomCode, player: existing, playerCount: room.players.length });
        }
        return;
      }

      const player = { id: socket.id, name, character: null, ready: false };
      roomsModule.addPlayer(roomCode, player);
      socket.join(roomCode);
      io.to(roomCode).emit("roomUpdated", room);
      io.to(roomCode).emit("availableCharacters", room.availableCharacters);
      if (typeof callback === "function") {
        callback({ success: true, roomCode, player, playerCount: room.players.length });
      }
    });

    socket.on("selectCharacter", (data, callback) => {
      const { roomCode, character } = data || {};
      const result = roomsModule.selectCharacter(roomCode, socket.id, character);
      if (!result.success) {
        if (typeof callback === "function") callback(result);
        return;
      }
      io.to(roomCode).emit("roomUpdated", result.room);
      io.to(roomCode).emit("availableCharacters", result.room.availableCharacters);
      if (typeof callback === "function") callback({ success: true });
    });

    socket.on("setReady", (data, callback) => {
      const { roomCode } = data || {};
      const result = roomsModule.setReady(roomCode, socket.id);
      if (!result.success) {
        if (typeof callback === "function") callback(result);
        return;
      }
      io.to(roomCode).emit("roomUpdated", result.room);
      if (result.allReady) {
        io.to(roomCode).emit("gameStart", result.room);
      }
      if (typeof callback === "function") callback({ success: true });
    });

    socket.on("playerControl", (data) => {
      const { roomCode, action, x, y } = data || {};
      if (!roomCode) return;
      const player = roomsModule.findPlayerBySocketId(roomCode, socket.id);
      if (!player) {
        console.log("Ignored control: sender not in room");
        return;
      }
      const payload = { roomCode, playerName: player.name, action, x, y };
      io.to(roomCode).emit("playerControl", payload);
    });

    socket.on("playerControllableAreaTriggerEntered", (data) => {
      const { roomCode, playerName, action, description } = data || {};
      if (!roomCode) return;
      const room = roomsModule.getRoom(roomCode);
      if (!room) {
        console.log(`TriggerEntered: room ${roomCode} not found`);
        return;
      }
      console.log(`Checking room ${roomCode}. Looking for: '${playerName}'`);
      console.log("Current players:", room.players.map(p => p.name));
      const target = roomsModule.findPlayerByName(roomCode, playerName);
      if (target) {
        const payload = { roomCode, playerName, action, description };
        io.to(target.id).emit("playerControllableAreaTriggerEntered", payload);
      } else {
        console.log(`ERROR: Player '${playerName}' not found in room ${roomCode}`);
      }
    });

    socket.on("playerControllableAreaTriggerLeft", (data) => {
      const { roomCode, playerName, action } = data || {};
      if (!roomCode) {
        console.log("no Room Code by playerControllableAreaTriggerLeft. returning");
        return;
      }
      const room = roomsModule.getRoom(roomCode);
      if (!room) {
        console.log(`TriggerLeft: room ${roomCode} not found`);
        return;
      }
      console.log(`Checking room ${roomCode}. Looking for: '${playerName}'`);
      console.log("Current players:", room.players.map(p => p.name));
      const target = roomsModule.findPlayerByName(roomCode, playerName);
      if (target) {
        const payload = { roomCode, playerName, action };
        io.to(target.id).emit("playerControllableAreaTriggerLeft", payload);
      } else {
        console.log(`ERROR: Player '${playerName}' not found in room ${roomCode}`);
      }
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
      const removed = roomsModule.removePlayerBySocketId(socket.id);
      removed.forEach(r => {
        io.to(r.room.roomCode).emit("roomUpdated", r.room);
        console.log(`Removed player ${r.player.name} from room ${r.roomCode} due to disconnect`);
      });
    });
  });
};