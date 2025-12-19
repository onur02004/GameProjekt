const rooms = {}; // List of active rooms

// Helper: generate unique 8-digit room code
function generateRoomCode() {
  let code;
  do {
    code = Math.floor(10000000 + Math.random() * 90000000).toString();
  } while (rooms[code]);
  return code;
}

function createRoom() {
  const roomCode = generateRoomCode();
  const room = {
    roomCode,
    players: [],
    availableCharacters: ["Character 1", "Character 2", "Character 3", "Character 4"],
  };
  rooms[roomCode] = room;
  return room;
}

function getRoom(roomCode) {
  return rooms[roomCode];
}

function addPlayer(roomCode, player) {
  const room = getRoom(roomCode);
  if (!room) return false;
  if (room.players.length >= 4) return false; // Max 4 players
  if (room.players.find(p => p.name === player.name)) return false; // Name already taken
  room.players.push(player);
  return player;
}

// Update player's socket ID based on their name
function updatePlayerSocketId(roomCode, name, socketId) {
  const room = getRoom(roomCode);
  if (!room) return null;
  const player = room.players.find(p => p.name === name);
  if (!player) return null;
  player.id = socketId;
  return player;
}

function findPlayerBySocketId(roomCode, socketId) {
  const room = getRoom(roomCode);
  if (!room) return null;
  return room.players.find(p => p.id === socketId) || null;
}

function findPlayerByName(roomCode, name) {
  const room = getRoom(roomCode);
  if (!room) return null;
  return room.players.find(p => p.name === (name || "").trim()) || null;
}

function selectCharacter(roomCode, socketId, character) {
  const room = getRoom(roomCode);
  if (!room) return { success: false, error: "Room not found" };
  const player = room.players.find(p => p.id === socketId);
  if (!player) return { success: false, error: "Player not in room" };
  if (!character || !room.availableCharacters.includes(character)) return { success: false, error: "Character not available" };
  player.character = character;
  room.availableCharacters = room.availableCharacters.filter(c => c !== character);
  return { success: true, room, player };
}

function changeCharacter(roomCode, socketId, newCharacter, oldCharacter) {
    const room = getRoom(roomCode);
    if (!room) return { success: false, error: "Room not found" };
    const player = room.players.find(p => p.id === socketId);
    if (!player) return { success: false, error: "Player not in room" };
    if (!newCharacter || !room.availableCharacters.includes(newCharacter)) return { success: false, error: "New character not available" };
    player.character = newCharacter;
    room.availableCharacters = room.availableCharacters.filter(c => c !== newCharacter);
    if (oldCharacter) {
        room.availableCharacters.push(oldCharacter);
    }
    return { success: true, room, player };
}

function setReady(roomCode, socketId) {
  const room = getRoom(roomCode);
  if (!room) return { success: false, error: "Room not found" };
  const player = room.players.find(p => p.id === socketId);
  if (!player) return { success: false, error: "Player not in room" };
  if (!player.character) return { success: false, error: "Player has not selected a character" };
  player.ready = true;
  const allReady = room.players.length > 0 && room.players.every(p => p.ready);
  return { success: true, allReady, room };
}

function cansleReady(roomCode, socketId) {
    const room = getRoom(roomCode);
    if (!room) return { success: false, error: "Room not found" };
    const player = room.players.find(p => p.id === socketId);
    if (!player) return { success: false, error: "Player not in room" };
    player.ready = false;
    return { success: true, room };
}

function startGame(roomCode) {
  const room = getRoom(roomCode);
  if (!room) return { success: false, error: "Room not found" };
  const allReady = room.players.length > 0 && room.players.every(p => p.ready);
  if (!allReady) return { success: false, error: "Not all players are ready" };
  room.gameStarted = true;
  return { success: true, room };
}



function removePlayerBySocketId(socketId) {
  const removed = [];
  for (const roomCode of Object.keys(rooms)) {
    const room = rooms[roomCode];
    const idx = room.players.findIndex(p => p.id === socketId);
    if (idx !== -1) {
        room.availableCharacters.push(room.players[idx].character);
      const [player] = room.players.splice(idx, 1); // Remove player from room
      removed.push({ roomCode, player, room });
    }
  }
  return removed;
}

module.exports = {
  rooms,
  generateRoomCode,
  createRoom,
  getRoom,
  addPlayer,
  updatePlayerSocketId,
  findPlayerBySocketId,
  findPlayerByName,
  selectCharacter,
  setReady,
  cansleReady,
  removePlayerBySocketId,
  startGame,
  changeCharacter,
};