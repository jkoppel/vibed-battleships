import { SignInButton } from "@clerk/clerk-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Authenticated, Unauthenticated } from "convex/react";
import { Anchor, Plus } from "lucide-react";
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="text-center">
      <div className="not-prose flex justify-center mb-4">
        <Anchor className="w-16 h-16 text-primary" />
      </div>
      <h1>Battleship Multiplayer</h1>

      <Unauthenticated>
        <p>Sign in to play Battleship with friends!</p>
        <div className="not-prose mt-4">
          <SignInButton mode="modal">
            <button className="btn btn-primary btn-lg">Get Started</button>
          </SignInButton>
        </div>
      </Unauthenticated>

      <Authenticated>
        <GameLobby />
      </Authenticated>
    </div>
  );
}

function GameLobby() {
  const [roomCode, setRoomCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const navigate = useNavigate();
  const createGame = useMutation(api.games.createGame);
  const joinGame = useMutation(api.games.joinGame);

  const handleCreateGame = async () => {
    try {
      const result = await createGame({});
      await navigate({ to: `/game/${result.gameId}` });
    } catch (error) {
      console.error("Error creating game:", error);
    }
  };

  const handleJoinGame = async () => {
    if (!roomCode.trim()) return;
    
    try {
      const gameId = await joinGame({ roomCode: roomCode.trim().toUpperCase() });
      await navigate({ to: `/game/${gameId}` });
    } catch (error) {
      console.error("Error joining game:", error);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="not-prose space-y-6">
        {/* Create Game */}
        <div className="card bg-base-200 shadow-xl">
          <div className="card-body">
            <h2 className="card-title justify-center">
              <Plus className="w-5 h-5" />
              Create New Game
            </h2>
            <p className="text-center text-sm opacity-70">
              Start a new game and invite a friend
            </p>
            <div className="card-actions justify-center">
              <button 
                className="btn btn-primary btn-wide"
                onClick={handleCreateGame}
              >
                Create Game
              </button>
            </div>
          </div>
        </div>

        {/* Join Game */}
        <div className="card bg-base-200 shadow-xl">
          <div className="card-body">
            <h2 className="card-title justify-center">
              <Anchor className="w-5 h-5" />
              Join Game
            </h2>
            <p className="text-center text-sm opacity-70">
              Enter a room code to join an existing game
            </p>
            <div className="form-control">
              <input
                type="text"
                placeholder="Enter room code"
                className="input input-bordered text-center tracking-widest uppercase"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                maxLength={6}
              />
            </div>
            <div className="card-actions justify-center">
              <button 
                className="btn btn-secondary btn-wide"
                onClick={handleJoinGame}
                disabled={!roomCode.trim()}
              >
                Join Game
              </button>
            </div>
          </div>
        </div>

        {/* Game Rules */}
        <div className="card bg-base-300 shadow-xl">
          <div className="card-body">
            <h3 className="card-title justify-center text-lg">How to Play</h3>
            <ul className="text-sm space-y-1 text-left">
              <li>• Place 5 ships on your 10x10 grid</li>
              <li>• Take turns firing at opponent's grid</li>
              <li>• Each player gets 2 special "bomb" attacks</li>
              <li>• Bombs hit a 3x3 area instead of single cell</li>
              <li>• Sink all enemy ships to win!</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
