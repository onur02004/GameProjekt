// testClient.js
const { io } = require("socket.io-client");
const readline = require("readline");

// Verbindung zu deinem Server
const socket = io("http://localhost:6769");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// ===== CONNECT =====
socket.on("connect", () => {
  console.log("✅ Connected to server");
  console.log("Socket ID:", socket.id);

  rl.question("Enter room code to join: ", (roomCode) => {
    
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

          // 3.2 Charakter wechseln
            socket.emit(
              "changeCharacter",
              {
                roomCode,
                character: "Character 1", // test ob fehler meldung kommt
              },
              (changeRes) => {
                console.log("🔄 Character change:", changeRes);
              }
            );

            // 3.3 Charakter wechseln zurück
            socket.emit(
              "changeCharacter",
              {
                roomCode,
                character: "Character 3",
              },
              (changeRes) => {
                console.log("🔄 Character change back:", changeRes);
              }
            );

            // start Test
            socket.emit(
              "startGame",
              { roomCode },
              (startRes) => {
                console.log("🚀 Game start:", startRes);
              }
            );

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

socket.on("allReady", (room) => {
  console.log("✅ All players ready in room:", room.roomCode);
});

socket.on("gameStart", (room) => {
  console.log("🚀 GAME STARTED!");
  console.log("Players:", room.players.map(p => p.name));
});

// ===== DISCONNECT =====
socket.on("disconnect", () => {
  console.log("❌ Disconnected from server");
});
