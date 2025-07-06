import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// The schema defines your data model for the database.
// For more information, see https://docs.convex.dev/database/schema
export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    name: v.string(),
  }).index("by_clerkId", ["clerkId"]),

  games: defineTable({
    roomCode: v.string(),
    status: v.union(v.literal("waiting"), v.literal("setup"), v.literal("playing"), v.literal("finished")),
    createdBy: v.id("users"),
    player1: v.id("users"),
    player2: v.optional(v.id("users")),
    currentTurn: v.optional(v.id("users")),
    winner: v.optional(v.id("users")),
    gameData: v.object({
      player1: v.object({
        ships: v.array(v.object({
          id: v.string(),
          positions: v.array(v.object({ x: v.number(), y: v.number() })),
          hits: v.array(v.boolean()),
          sunk: v.boolean(),
        })),
        shots: v.array(v.object({
          x: v.number(),
          y: v.number(),
          hit: v.boolean(),
          type: v.union(v.literal("normal"), v.literal("bomb")),
        })),
        bombsRemaining: v.number(),
      }),
      player2: v.object({
        ships: v.array(v.object({
          id: v.string(),
          positions: v.array(v.object({ x: v.number(), y: v.number() })),
          hits: v.array(v.boolean()),
          sunk: v.boolean(),
        })),
        shots: v.array(v.object({
          x: v.number(),
          y: v.number(),
          hit: v.boolean(),
          type: v.union(v.literal("normal"), v.literal("bomb")),
        })),
        bombsRemaining: v.number(),
      }),
    }),
  }).index("by_roomCode", ["roomCode"]),

  moves: defineTable({
    gameId: v.id("games"),
    playerId: v.id("users"),
    x: v.number(),
    y: v.number(),
    type: v.union(v.literal("normal"), v.literal("bomb")),
    hit: v.boolean(),
    moveNumber: v.number(),
  }).index("by_gameId", ["gameId"]),
});
