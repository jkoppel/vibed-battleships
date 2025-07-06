import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { Bomb, Copy, Share2, Target, Trophy } from "lucide-react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export const Route = createFileRoute("/game/$gameId")({
  loader: async ({ context: { queryClient }, params: { gameId } }) => {
    const gameQueryOptions = convexQuery(api.games.getGame, { 
      gameId: gameId as Id<"games"> 
    });
    await queryClient.ensureQueryData(gameQueryOptions);
    return { gameQueryOptions };
  },
  component: GameRoom,
});

function GameRoom() {
  const { gameId } = Route.useParams();
  const { gameQueryOptions } = Route.useLoaderData();
  const { data: game } = useSuspenseQuery(gameQueryOptions);
  
  const [selectedShipType, setSelectedShipType] = useState<"normal" | "bomb">("normal");

  const shareGameLink = () => {
    const link = `${window.location.origin}/game/${gameId}`;
    void navigator.clipboard.writeText(link);
  };

  const copyRoomCode = () => {
    void navigator.clipboard.writeText(game.roomCode);
  };

  if (game.status === "waiting") {
    return (
      <div className="max-w-2xl mx-auto text-center">
        <div className="card bg-base-200 shadow-xl">
          <div className="card-body">
            <h2 className="card-title justify-center text-2xl">
              <Share2 className="w-8 h-8" />
              Waiting for Player 2
            </h2>
            
            <div className="stats stats-vertical lg:stats-horizontal shadow mt-4">
              <div className="stat">
                <div className="stat-title">Room Code</div>
                <div className="stat-value text-primary font-mono">
                  {game.roomCode}
                </div>
                <div className="stat-actions">
                  <button 
                    className="btn btn-sm btn-ghost"
                    onClick={copyRoomCode}
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </button>
                </div>
              </div>
              
              <div className="stat">
                <div className="stat-title">Players</div>
                <div className="stat-value">1 / 2</div>
                <div className="stat-desc">
                  {game.player1Name} is waiting
                </div>
              </div>
            </div>

            <div className="divider">Share Game</div>
            
            <button 
              className="btn btn-primary btn-wide"
              onClick={shareGameLink}
            >
              <Share2 className="w-4 h-4 mr-2" />
              Copy Game Link
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (game.status === "setup") {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold">Ship Placement</h1>
          <p className="text-lg opacity-70">
            {game.player1Name} vs {game.player2Name}
          </p>
        </div>
        
        <ShipPlacement 
          gameId={gameId as Id<"games">}
          onShipsPlaced={() => {}}
        />
      </div>
    );
  }

  if (game.status === "playing") {
    return (
      <div className="max-w-6xl mx-auto">
        <GameBoard 
          game={game}
          selectedShipType={selectedShipType}
          onShipTypeChange={setSelectedShipType}
        />
      </div>
    );
  }

  if (game.status === "finished") {
    const isWinner = game.winner === (game.isPlayer1 ? game.player1 : game.player2);
    
    return (
      <div className="max-w-2xl mx-auto text-center">
        <div className="card bg-base-200 shadow-xl">
          <div className="card-body">
            <h2 className="card-title justify-center text-3xl">
              <Trophy className="w-8 h-8" />
              Game Over
            </h2>
            
            <div className={`text-2xl font-bold ${isWinner ? 'text-success' : 'text-error'}`}>
              {isWinner ? 'Victory!' : 'Defeat!'}
            </div>
            
            <p className="text-lg">
              {isWinner 
                ? `You defeated ${game.isPlayer1 ? game.player2Name : game.player1Name}!`
                : `${game.isPlayer1 ? game.player2Name : game.player1Name} won this round!`
              }
            </p>
            
            <div className="card-actions justify-center mt-4">
              <button 
                className="btn btn-primary"
                onClick={() => window.location.href = '/'}
              >
                Play Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function ShipPlacement({ gameId, onShipsPlaced }: { 
  gameId: Id<"games">; 
  onShipsPlaced: () => void; 
}) {
  const [ships] = useState<Array<{ id: string; positions: Array<{ x: number; y: number }> }>>([]);
  const [placedShips] = useState<Set<string>>(new Set());
  const placeShips = useMutation(api.games.placeShips);

  const SHIP_SIZES = [
    { id: "carrier", size: 5, name: "Carrier" },
    { id: "battleship", size: 4, name: "Battleship" },
    { id: "cruiser", size: 3, name: "Cruiser" },
    { id: "submarine", size: 3, name: "Submarine" },
    { id: "destroyer", size: 2, name: "Destroyer" },
  ];

  const handleFinalizePlacement = async () => {
    if (ships.length !== 5) return;
    
    try {
      await placeShips({ gameId, ships });
      onShipsPlaced();
    } catch (error) {
      console.error("Error placing ships:", error);
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Ship Placement Grid */}
      <div className="card bg-base-200 shadow-xl">
        <div className="card-body">
          <h3 className="card-title">Your Fleet</h3>
          <div className="grid grid-cols-10 gap-1 aspect-square">
            {Array.from({ length: 100 }, (_, i) => {
              const x = i % 10;
              const y = Math.floor(i / 10);
              const hasShip = ships.some(ship => 
                ship.positions.some(pos => pos.x === x && pos.y === y)
              );
              
              return (
                <div
                  key={i}
                  className={`aspect-square border-2 border-base-300 rounded cursor-pointer ${
                    hasShip ? 'bg-primary' : 'bg-base-100 hover:bg-base-300'
                  }`}
                  onClick={() => {
                    // Simple ship placement logic - just place individual cells for now
                    // In a real implementation, this would be more sophisticated
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Ship Selection */}
      <div className="card bg-base-200 shadow-xl">
        <div className="card-body">
          <h3 className="card-title">Ships to Place</h3>
          <div className="space-y-3">
            {SHIP_SIZES.map((ship) => (
              <div 
                key={ship.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  placedShips.has(ship.id) 
                    ? 'bg-success text-success-content border-success' 
                    : 'bg-base-100 border-base-300'
                }`}
              >
                <div>
                  <div className="font-semibold">{ship.name}</div>
                  <div className="text-sm opacity-70">{ship.size} cells</div>
                </div>
                <div className="flex gap-1">
                  {Array.from({ length: ship.size }, (_, i) => (
                    <div 
                      key={i} 
                      className={`w-4 h-4 rounded border ${
                        placedShips.has(ship.id) 
                          ? 'bg-success-content' 
                          : 'bg-primary'
                      }`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          
          <div className="card-actions justify-center mt-4">
            <button 
              className="btn btn-primary btn-wide"
              onClick={() => void handleFinalizePlacement()}
              disabled={ships.length !== 5}
            >
              {ships.length === 5 ? 'Ready for Battle!' : `Place ${5 - ships.length} more ships`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function GameBoard({ game, selectedShipType, onShipTypeChange }: { 
  game: any; 
  selectedShipType: "normal" | "bomb";
  onShipTypeChange: (type: "normal" | "bomb") => void;
}) {
  const makeMove = useMutation(api.games.makeMove);
  const isMyTurn = game.currentTurn === (game.isPlayer1 ? game.player1 : game.player2);
  const myData = game.isPlayer1 ? game.gameData.player1 : game.gameData.player2;
  const opponentData = game.isPlayer1 ? game.gameData.player2 : game.gameData.player1;

  const handleCellClick = async (x: number, y: number) => {
    if (!isMyTurn) return;
    
    try {
      await makeMove({ 
        gameId: game._id, 
        x, 
        y, 
        type: selectedShipType 
      });
    } catch (error) {
      console.error("Error making move:", error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Game Status */}
      <div className="text-center">
        <div className="stats stats-horizontal shadow">
          <div className="stat">
            <div className="stat-title">Turn</div>
            <div className={`stat-value ${isMyTurn ? 'text-success' : 'text-warning'}`}>
              {isMyTurn ? 'Your Turn' : 'Opponent\'s Turn'}
            </div>
          </div>
          
          <div className="stat">
            <div className="stat-title">Bombs Remaining</div>
            <div className="stat-value text-primary">
              {myData.bombsRemaining}
            </div>
          </div>
        </div>
      </div>

      {/* Attack Type Selection */}
      <div className="flex justify-center">
        <div className="join">
          <button 
            className={`btn join-item ${selectedShipType === "normal" ? "btn-active" : ""}`}
            onClick={() => onShipTypeChange("normal")}
          >
            <Target className="w-4 h-4 mr-2" />
            Normal Shot
          </button>
          <button 
            className={`btn join-item ${selectedShipType === "bomb" ? "btn-active" : ""}`}
            onClick={() => onShipTypeChange("bomb")}
            disabled={myData.bombsRemaining === 0}
          >
            <Bomb className="w-4 h-4 mr-2" />
            Bomb ({myData.bombsRemaining})
          </button>
        </div>
      </div>

      {/* Game Boards */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Enemy Board */}
        <div className="card bg-base-200 shadow-xl">
          <div className="card-body">
            <h3 className="card-title">Enemy Waters</h3>
            <div className="grid grid-cols-10 gap-1 aspect-square">
              {Array.from({ length: 100 }, (_, i) => {
                const x = i % 10;
                const y = Math.floor(i / 10);
                const shot = myData.shots.find((s: any) => s.x === x && s.y === y);
                
                return (
                  <div
                    key={i}
                    className={`aspect-square border-2 border-base-300 rounded cursor-pointer ${
                      shot 
                        ? shot.hit 
                          ? 'bg-error text-error-content' 
                          : 'bg-base-300'
                        : 'bg-base-100 hover:bg-base-300'
                    } ${isMyTurn ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                    onClick={() => !shot && void handleCellClick(x, y)}
                  >
                    {shot && (
                      <div className="w-full h-full flex items-center justify-center text-xs font-bold">
                        {shot.hit ? '💥' : '💨'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* My Board */}
        <div className="card bg-base-200 shadow-xl">
          <div className="card-body">
            <h3 className="card-title">Your Fleet</h3>
            <div className="grid grid-cols-10 gap-1 aspect-square">
              {Array.from({ length: 100 }, (_, i) => {
                const x = i % 10;
                const y = Math.floor(i / 10);
                const hasShip = myData.ships.some((ship: any) => 
                  ship.positions.some((pos: any) => pos.x === x && pos.y === y)
                );
                const shot = opponentData.shots.find((s: any) => s.x === x && s.y === y);
                
                return (
                  <div
                    key={i}
                    className={`aspect-square border-2 border-base-300 rounded ${
                      hasShip 
                        ? shot?.hit 
                          ? 'bg-error text-error-content' 
                          : 'bg-primary text-primary-content'
                        : shot 
                          ? 'bg-base-300' 
                          : 'bg-base-100'
                    }`}
                  >
                    {shot && (
                      <div className="w-full h-full flex items-center justify-center text-xs font-bold">
                        {shot.hit ? '💥' : '💨'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}