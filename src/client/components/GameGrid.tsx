import React from 'react';
import { Bubble } from './Bubble';
import { GameState } from '../../shared/types/game';

interface GameGridProps {
  gameState: GameState;
  onBubblePop: (row: number, col: number) => void;
  bubbleSize: number;
}

export const GameGrid: React.FC<GameGridProps> = ({ gameState, onBubblePop, bubbleSize }) => {
  const { bubbles, ghosts } = gameState;

  return (
    <div 
      className="game-grid"
      style={{
        gridTemplateColumns: `repeat(${gameState.gridSize.cols}, ${bubbleSize}px)`,
        gridTemplateRows: `repeat(${gameState.gridSize.rows}, ${bubbleSize}px)`,
        gap: '2px',
      }}
    >
      {bubbles.map((row, rowIndex) =>
        row.map((bubble, colIndex) => {
          const hasGhost = ghosts.some(ghost => 
            ghost.isActive && ghost.x === colIndex && ghost.y === rowIndex
          );
          
          return (
            <div key={bubble.id} className="bubble-container">
              <Bubble
                state={bubble.state}
                isAnimating={bubble.isAnimating}
                onClick={() => onBubblePop(rowIndex, colIndex)}
                size={bubbleSize}
              />
              {hasGhost && <div className="ghost-indicator">👻</div>}
            </div>
          );
        })
      )}
    </div>
  );
};