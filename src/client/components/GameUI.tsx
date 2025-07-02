import React from 'react';
import { GameState } from '../../shared/types/game';

interface GameUIProps {
  gameState: GameState;
  onStartGame: () => void;
  onResetGame: () => void;
}

export const GameUI: React.FC<GameUIProps> = ({ gameState, onStartGame, onResetGame }) => {
  const { score, timeLeft, isPlaying, isRageMode } = gameState;

  const formatTime = (seconds: number) => {
    return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
  };

  const getTimerColor = () => {
    if (isRageMode) return 'text-red-500 animate-pulse';
    if (timeLeft <= 10) return 'text-orange-500';
    return 'text-gray-700';
  };

  const getScoreMessage = () => {
    if (score < 0) return "Ghosts are winning! 👻";
    if (score > 15) return "Popping champion! 🏆";
    if (score > 20) return "Good popping! 💪";
    return "Keep popping! 🫧";
  };

  return (
    <div className={`game-ui ${isRageMode ? 'rage-mode' : ''}`}>
      {/* Badge Sticker - Positioned on score card */}
      <img 
        src="/black_circle_360x360.png" 
        alt="Made with Bolt.new" 
        className={`bolt-badge-sticker ${isPlaying ? 'badge-during-game' : ''}`}
      />
      
      <div className="ui-header">
        <div className="score-display">
          <span className="score-label">Score</span>
          <span className={`score-value ${score < 0 ? 'text-red-500' : ''}`}>
            {score}
          </span>
          {score < 0 && (
            <span className="text-xs text-red-500 font-medium">
              Ghost Penalty: -1 per unpop
            </span>
          )}
        </div>
        
        <div className="timer-display">
          <span className={`timer-value ${getTimerColor()}`}>
            {formatTime(timeLeft)}
          </span>
          {isRageMode && (
            <span className="rage-indicator">👻 GHOST RAGE! 👻</span>
          )}
        </div>
      </div>

      {!isPlaying && timeLeft === 30 && (
        <button 
          className="start-button"
          onClick={onStartGame}
        >
          Start Popping!
        </button>
      )}

      {!isPlaying && timeLeft === 0 && (
        <div className="game-over">
          <h2 className="game-over-title">Time's Up!</h2>
          <p className="final-score">Final Score: {score}</p>
          <p className="game-over-message">
            {score > 15 ? "You popped like a champ!" : 
             score > 10 ? "Victory is fragile. Like plastic." :
             score >= 0 ? "The ghost wins this round..." :
             "The ghosts completely dominated! 👻"}
          </p>
          <p className="text-sm text-gray-600 mt-2">
            {getScoreMessage()}
          </p>
          <button 
            className="restart-button"
            onClick={onResetGame}
          >
            Pop Again!
          </button>
        </div>
      )}
    </div>
  );
};