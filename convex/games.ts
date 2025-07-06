import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";

const SHIP_SIZES = [5, 4, 3, 3, 2];

function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function createEmptyPlayerData() {
  return {
    ships: [],
    shots: [],
    bombsRemaining: 2,
  };
}

export const createGame = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) {
      throw new ConvexError("User not found");
    }

    const roomCode = generateRoomCode();
    
    const gameId = await ctx.db.insert("games", {
      roomCode,
      status: "waiting",
      createdBy: user._id,
      player1: user._id,
      currentTurn: undefined,
      winner: undefined,
      gameData: {
        player1: createEmptyPlayerData(),
        player2: createEmptyPlayerData(),
      },
    });

    return { gameId, roomCode };
  },
});

export const joinGame = mutation({
  args: { roomCode: v.string() },
  handler: async (ctx, { roomCode }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) {
      throw new ConvexError("User not found");
    }

    const game = await ctx.db
      .query("games")
      .withIndex("by_roomCode", (q) => q.eq("roomCode", roomCode))
      .unique();

    if (!game) {
      throw new ConvexError("Game not found");
    }

    if (game.status !== "waiting") {
      throw new ConvexError("Game already started or finished");
    }

    if (game.player1 === user._id) {
      throw new ConvexError("You are already in this game");
    }

    if (game.player2) {
      throw new ConvexError("Game is full");
    }

    await ctx.db.patch(game._id, {
      player2: user._id,
      status: "setup",
    });

    return game._id;
  },
});

export const getGame = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, { gameId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Not authenticated");
    }

    const game = await ctx.db.get(gameId);
    if (!game) {
      throw new ConvexError("Game not found");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) {
      throw new ConvexError("User not found");
    }

    if (game.player1 !== user._id && game.player2 !== user._id) {
      throw new ConvexError("You are not a player in this game");
    }

    const player1 = await ctx.db.get(game.player1);
    const player2 = game.player2 ? await ctx.db.get(game.player2) : null;

    return {
      ...game,
      player1Name: player1?.name || "Player 1",
      player2Name: player2?.name || "Player 2",
      isPlayer1: game.player1 === user._id,
      isPlayer2: game.player2 === user._id,
    };
  },
});

export const placeShips = mutation({
  args: {
    gameId: v.id("games"),
    ships: v.array(v.object({
      id: v.string(),
      positions: v.array(v.object({ x: v.number(), y: v.number() })),
    })),
  },
  handler: async (ctx, { gameId, ships }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Not authenticated");
    }

    const game = await ctx.db.get(gameId);
    if (!game) {
      throw new ConvexError("Game not found");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) {
      throw new ConvexError("User not found");
    }

    if (game.player1 !== user._id && game.player2 !== user._id) {
      throw new ConvexError("You are not a player in this game");
    }

    if (game.status !== "setup") {
      throw new ConvexError("Game is not in setup phase");
    }

    // Validate ship placement
    if (ships.length !== SHIP_SIZES.length) {
      throw new ConvexError("Invalid number of ships");
    }

    const formattedShips = ships.map((ship) => ({
      id: ship.id,
      positions: ship.positions,
      hits: new Array(ship.positions.length).fill(false),
      sunk: false,
    }));

    const isPlayer1 = game.player1 === user._id;
    const newGameData = { ...game.gameData };

    if (isPlayer1) {
      newGameData.player1.ships = formattedShips;
    } else {
      newGameData.player2.ships = formattedShips;
    }

    await ctx.db.patch(gameId, { gameData: newGameData });

    // Check if both players have placed ships
    const bothPlayersReady = 
      newGameData.player1.ships.length > 0 && 
      newGameData.player2.ships.length > 0;

    if (bothPlayersReady) {
      await ctx.db.patch(gameId, {
        status: "playing",
        currentTurn: game.player1, // Player 1 starts
      });
    }

    return { success: true };
  },
});

export const makeMove = mutation({
  args: {
    gameId: v.id("games"),
    x: v.number(),
    y: v.number(),
    type: v.union(v.literal("normal"), v.literal("bomb")),
  },
  handler: async (ctx, { gameId, x, y, type }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Not authenticated");
    }

    const game = await ctx.db.get(gameId);
    if (!game) {
      throw new ConvexError("Game not found");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) {
      throw new ConvexError("User not found");
    }

    if (game.status !== "playing") {
      throw new ConvexError("Game is not in playing state");
    }

    if (game.currentTurn !== user._id) {
      throw new ConvexError("Not your turn");
    }

    const isPlayer1 = game.player1 === user._id;
    const currentPlayerData = isPlayer1 ? game.gameData.player1 : game.gameData.player2;
    const opponentData = isPlayer1 ? game.gameData.player2 : game.gameData.player1;

    // Check if bomb is available
    if (type === "bomb" && currentPlayerData.bombsRemaining <= 0) {
      throw new ConvexError("No bombs remaining");
    }

    // Get positions to attack
    const positionsToAttack = type === "bomb" 
      ? getBombPositions(x, y)
      : [{ x, y }];

    // Check if any position already attacked
    const alreadyAttacked = positionsToAttack.some(pos => 
      currentPlayerData.shots.some(shot => shot.x === pos.x && shot.y === pos.y)
    );

    if (alreadyAttacked) {
      throw new ConvexError("Position already attacked");
    }

    // Process each position
    const newShots = [];
    let hitCount = 0;
    const updatedOpponentShips = [...opponentData.ships];

    for (const pos of positionsToAttack) {
      let hit = false;

      // Check if position hits any ship
      for (let shipIndex = 0; shipIndex < updatedOpponentShips.length; shipIndex++) {
        const ship = updatedOpponentShips[shipIndex];
        const hitPositionIndex = ship.positions.findIndex(
          shipPos => shipPos.x === pos.x && shipPos.y === pos.y
        );

        if (hitPositionIndex !== -1) {
          hit = true;
          hitCount++;
          ship.hits[hitPositionIndex] = true;
          
          // Check if ship is sunk
          if (ship.hits.every(h => h)) {
            ship.sunk = true;
          }
          break;
        }
      }

      newShots.push({
        x: pos.x,
        y: pos.y,
        hit,
        type: type,
      });
    }

    // Update game data
    const newGameData = { ...game.gameData };
    if (isPlayer1) {
      newGameData.player1.shots = [...currentPlayerData.shots, ...newShots];
      newGameData.player2.ships = updatedOpponentShips;
      if (type === "bomb") {
        newGameData.player1.bombsRemaining--;
      }
    } else {
      newGameData.player2.shots = [...currentPlayerData.shots, ...newShots];
      newGameData.player1.ships = updatedOpponentShips;
      if (type === "bomb") {
        newGameData.player2.bombsRemaining--;
      }
    }

    // Check for winner
    const allOpponentShipsSunk = updatedOpponentShips.every(ship => ship.sunk);
    const nextTurn = allOpponentShipsSunk ? undefined : 
      (game.currentTurn === game.player1 ? game.player2 : game.player1);

    await ctx.db.patch(gameId, {
      gameData: newGameData,
      currentTurn: nextTurn,
      status: allOpponentShipsSunk ? "finished" : "playing",
      winner: allOpponentShipsSunk ? user._id : undefined,
    });

    // Record move
    const moveNumber = await ctx.db
      .query("moves")
      .withIndex("by_gameId", (q) => q.eq("gameId", gameId))
      .collect()
      .then(moves => moves.length + 1);

    await ctx.db.insert("moves", {
      gameId,
      playerId: user._id,
      x,
      y,
      type,
      hit: hitCount > 0,
      moveNumber,
    });

    return { success: true, hits: hitCount, gameEnded: allOpponentShipsSunk };
  },
});

function getBombPositions(centerX: number, centerY: number) {
  const positions = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const x = centerX + dx;
      const y = centerY + dy;
      if (x >= 0 && x < 10 && y >= 0 && y < 10) {
        positions.push({ x, y });
      }
    }
  }
  return positions;
}