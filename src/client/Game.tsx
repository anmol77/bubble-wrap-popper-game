import React, { useEffect } from 'react';
import { GameGrid } from './components/GameGrid';
import { GameUI } from './components/GameUI';
import { useGameLogic } from './hooks/useGameLogic';

export const Game: React.FC = () => {
  const { gameState, gameStats, popBubble, startGame, resetGame } = useGameLogic();

  // Calculate bubble size based on screen size for more realistic bubble wrap
  const calculateBubbleSize = () => {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const availableWidth = Math.min(screenWidth - 40, 800); // Increased max width
    const availableHeight = screenHeight - 200; // Leave space for UI
    
    const bubbleSizeByWidth = Math.floor(availableWidth / gameState.gridSize.cols) - 2;
    const bubbleSizeByHeight = Math.floor(availableHeight / gameState.gridSize.rows) - 2;
    
    return Math.min(bubbleSizeByWidth, bubbleSizeByHeight, 45); // Slightly smaller for more bubbles
  };

  const bubbleSize = calculateBubbleSize();

  useEffect(() => {
    const handleResize = () => {
      // Force re-render on resize
      window.dispatchEvent(new Event('resize'));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="bubble-wrap-game">
      <GameUI 
        gameState={gameState}
        onStartGame={startGame}
        onResetGame={resetGame}
      />
      
      <div className="game-container">
        <GameGrid
          gameState={gameState}
          onBubblePop={popBubble}
          bubbleSize={bubbleSize}
        />
      </div>

      {/* Debug info (remove in production) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="debug-info">
          <p>Popped: {gameStats.bubblesPopped}</p>
          <p>Unpopped: {gameStats.bubblesUnpopped}</p>
          <p>Ghost Events: {gameStats.ghostEvents}</p>
          <p>Grid: {gameState.gridSize.rows}x{gameState.gridSize.cols}</p>
        </div>
      )}
    </div>
  );
};