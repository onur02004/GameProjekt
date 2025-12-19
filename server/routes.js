const path = require("path");
const express = require("express");

function registerRoutes(app, roomsModule) {
  app.use(express.static(path.join(__dirname, "public")));
  app.get("/playercontrols.html", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "playercontrols.html"));
  });

  app.get("/test", (req, res) => res.send("Server is running"));

  app.get("/join", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "join.html"));
  });

  app.get("/rooms/:roomCode", (req, res) => {
    const { roomCode } = req.params;
    const room = roomsModule.getRoom(roomCode);
    if (!room) return res.status(404).json({ error: "Room not found" });
    res.json(room);
  });

  app.get("/:roomCode", (req, res, next) => {
    const { roomCode } = req.params;
    if (!/^\d{8}$/.test(roomCode)) return next();
    res.sendFile(path.join(__dirname, "public", "join.html"));
  });

  app.use((req, res) => res.status(404).send("Not Found"));
}

module.exports = registerRoutes;