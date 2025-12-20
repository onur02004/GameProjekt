// testClient.js
const { io } = require("socket.io-client");

// Verbindung zu deinem Server
const socket = io("http://localhost:6769");

// ===== CONNECT =====
socket.on("connect", () => {
  console.log("✅ Connected to server");
  console.log("Socket ID:", socket.id);

  // 1. Raum erstellen
  socket.emit("createRoom", (res) => {
    console.log("🏠 Room created:", res.roomCode);

    const roomCode = res.roomCode;

    // 2. Raum beitreten
    socket.emit(
      "joinRoom",
      { roomCode, name: "TestPlayer2" },
      (joinRes) => {
        console.log("🚪 Join result:", joinRes);

        // 3. Charakter auswählen
        socket.emit(
          "selectCharacter",
          {
            roomCode,
            character: "Character 2",
          },
          (charRes) => {
            console.log("🎭 Character select:", charRes);

            // 4. Ready setzen
            socket.emit(
              "setReady",
              { roomCode },
              (readyRes) => {
                console.log("✅ Ready:", readyRes);
              }
            );
          }
        );
      }
    );
  });
});

// ===== SERVER EVENTS =====
socket.on("roomUpdated", (room) => {
  console.log("📦 roomUpdated:", JSON.stringify(room, null, 2));
});

socket.on("availableCharacters", (chars) => {
  console.log("🎮 Available characters:", chars);
});

socket.on("gameStart", (room) => {
  console.log("🚀 GAME STARTED!");
  console.log("Players:", room.players.map(p => p.name));
});

// ===== DISCONNECT =====
socket.on("disconnect", () => {
  console.log("❌ Disconnected from server");
});
