const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;

app.use(express.static(path.join(__dirname, "public")));

let gameRooms = {};

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

// Function to check if all players have made their moves
function allPlayersMadeMove(players) {
  return Object.values(players).every((player) => player.move !== null);
}

// Function to determine the winner
function checkWinner(players) {
  const [player1, player2] = Object.values(players);
  const [player1Id, player2Id] = Object.keys(players);

  if (player1.move === player2.move) {
    return { winner: "draw", message: "It's a tie!" };
  }

  const winningCombos = {
    rock: "scissors",
    paper: "rock",
    scissors: "paper",
  };

  const winnerId =
    winningCombos[player1.move] === player2.move ? player1Id : player2Id;

  return { winner: winnerId, message: `${players[winnerId].name} wins!` };
}

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("createGame", (playerName) => {
    const roomCode = generateRoomCode();
    socket.join(roomCode);
    gameRooms[roomCode] = {
      players: { [socket.id]: { name: playerName, move: null } },
      starter: socket.id,
    };

    socket.emit("roomCreated", { roomCode });
  });

  socket.on("joinGame", ({ roomCode, playerName }) => {
    const room = io.sockets.adapter.rooms.get(roomCode);

    if (room && room.size === 1) {
      socket.join(roomCode);
      gameRooms[roomCode].players[socket.id] = { name: playerName, move: null };

      io.in(roomCode).emit("startGame", {
        message: `${playerName} has joined. Game started!`,
        starter: gameRooms[roomCode].starter,
      });
    } else if (room && room.size >= 2) {
      socket.emit("roomFull", "Room is already full.");
    } else {
      socket.emit("roomNotFound", "Room not found.");
    }
  });

  socket.on("playerMove", ({ roomCode, playerId, move }) => {
    const room = gameRooms[roomCode];
    if (!room) return socket.emit("roomNotFound", "Room not found.");

    room.players[playerId].move = move;

    if (allPlayersMadeMove(room.players)) {
      const result = checkWinner(room.players);
      io.in(roomCode).emit("gameResult", result);

      Object.values(room.players).forEach((player) => (player.move = null));
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    for (const [roomCode, room] of Object.entries(gameRooms)) {
      if (room.players[socket.id]) {
        delete room.players[socket.id];
        if (Object.keys(room.players).length === 0) {
          delete gameRooms[roomCode]; // Clean up empty rooms
        }
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
