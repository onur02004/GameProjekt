// server.js
// Vermittelt die Dateien an den Client (Handy)
const express = require("express");
// Cross-Origin Ressource Sharing (Smartphone <-> PC)
const cors = require("cors");
// Für die Übersetzung der Pfade (Linux "/", Windoof "\")
const path = require("path");
// Express (Websiten) && Socket.io (Echtzeit) -> gleichzeitig auf selben Port
const http = require("http");
// Klasse für Echtzeit-Kommunikation
const { Server } = require("socket.io");
// Erstellt Anwendung
const app = express();
const PORT = 6769;

app.use(cors());
app.use(express.json()); // Konvertiert Json-Text in JS-Objekte
// (Anfrage (Wird nd gebraucht, aber von express gefordert), Antwort)
app.get("/playercontrols.html", (req,res) => {
  /* Schickt playercontrols vom Server-Speicher zum Handy
     __dirname -> Startpunkt/public/Datei 
     / oder \ macht er automatisch mit const path */
  res.sendFile(path.join(__dirname, "public", "playercontrols.html"));
});

// Create HTTP server and bind socket.io to it
// Nimmt die Express-App und packt sie in einen NodeJS HTTP-server
// socket.io braucht einen Server
const server = http.createServer(app);
//Starte socket.io mit eben dem HTTP-Server, den er braucht
// normale Anfrage (Website) -> durchlassen zu Express(app)
// WebSocket Anfrage (WebSocket-Handshake) -> io übernimmt
const io = new Server(server, {
  cors: {
    // Sicherheits-Schranke für Browser
    // "*" heißt hier einfach "fuer alle"
    origin: "*",
  },
});

// In-memory room storage
// rooms = {
//   "12345678": {                                  <- Key ist der Raumcode
//      roomCode: "12345678",
//      players: [ { id, name, character, ready } ] <- Liste Spieler im Raum
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


// Erkennt Connection
io.on("connection", (socket) => {

  console.log("Client connected:", socket.id);

  socket.on("connect", () => {
    console.log("PlayerControls connected, id:", socket.id);
});

  // --- Lobby-Management ---

  // Unity (or anyone) asks to create a room
  // client: socket.emit("createRoom", (response) => { ... })

  // Unity fragt Raum an, Server generiert Code und erstellt leere Spielerliste
  // Schickt den generierten Code an Unity zurück
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
      if (typeof callback === "function") callback({ success: false, error: "Room not found" });
      return;
    }

    // FIX: Prüfen, ob der Name schon existiert (Reconnect-Logik)
    const existingPlayer = room.players.find((p) => p.name === name);

    if (existingPlayer) {
        // Fall: Reconnect!
        // Wir aktualisieren nur die "Telefonnummer" (Socket ID) des Spielers
        existingPlayer.id = socket.id;
        
        // Character updaten, falls er gewechselt wurde
        existingPlayer.character = character; 
        
        // Wir setzen ihn wieder auf "nicht bereit" oder lassen es so, wie du magst
        // existingPlayer.ready = false; 

        socket.join(roomCode);
        console.log(`Player ${name} reconnected via socket ${socket.id}`);
        
        // Alle informieren
        io.to(roomCode).emit("roomUpdated", room);

        if (typeof callback === "function") {
            callback({
                success: true,
                roomCode,
                player: existingPlayer,
                playerCount: room.players.length,
            });
        }
        return; // WICHTIG: Hier aufhören, damit er nicht doppelt hinzugefügt wird
    }

    // --- Ab hier der normale Code für NEUE Spieler ---
    const player = {
      id: socket.id,
      name,
      character,
      ready: false,
    };
    
    // ... Rest bleibt gleich (room.players.push, etc.)

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

  // Spieler drueckt bereit, Server merkt sich das, prueft, ob alle bereit sind
  // Wenn ja -> gameStart
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

  // Methode geaendert

  // Phone / browser control input → forward to Unity
  socket.on("playerControl", (data) => {
    // Wir nehmen nur die Bewegungsdaten, den Namen ignorieren wir erstmal aus den Daten
    const { roomCode, action, x, y } = data || {};

    if (!roomCode) return;

    const room = rooms[roomCode];
    if (!room) return;

    // FIX: Wir suchen den Spieler anhand seiner ECHTEN Verbindung (Socket ID)
    // Damit verhindern wir, dass jemand fremdes Befehle für "Hans" schickt.
    const player = room.players.find((p) => p.id === socket.id);

    if (!player) {
      console.log("Befehl ignoriert: Sender ist nicht im Raum.");
      return;
    }

    // Wir nehmen den verifizierten Namen aus unserer Liste
    const payload = {
      roomCode,
      playerName: player.name, // <-- Hier nutzen wir den echten Namen
      action,
      x,
      y
    };

    io.to(roomCode).emit("playerControl", payload);
  });

  // --- Rückmeldung vom Spiel ans Handy ---

  // Unity merkt z.B. Spieler steht vor einem Schalter
  // -> Unity sagt Server Bescheid, Server sucht Handy und gibt den Button
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

  // Gegenteil, Spieler läuft weg, Button verschwindet
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

  // Aufraumen (Spieler loeschen bei disconnect, Message senden)
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
