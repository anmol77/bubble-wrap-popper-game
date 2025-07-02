import express from 'express';
import { createServer, getServerPort } from '@devvit/server';
import { InitGameResponse, PopBubbleResponse, GameEndResponse } from '../shared/types/game';

const app = express();

// Middleware for JSON body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.text());

const router = express.Router();

// SIMPLIFIED: Remove all Redis and context dependencies that cause AsyncLocalStorage errors
// This is a client-side game, so we don't need server-side persistence for the core gameplay

// Initialize a new game session - simplified
router.post<{}, InitGameResponse>('/api/game/init', async (_req, res): Promise<void> => {
  try {
    const gameId = `game:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
    
    res.json({
      status: 'success',
      gameId,
      gridSize: { rows: 15, cols: 10 },
    });
  } catch (error) {
    console.error('Error initializing game:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Failed to initialize game' 
    });
  }
});

// Handle bubble pop action - simplified
router.post<{}, PopBubbleResponse, { gameId: string; row: number; col: number }>(
  '/api/game/pop',
  async (req, res): Promise<void> => {
    try {
      const { gameId, row, col } = req.body;

      if (!gameId || typeof row !== 'number' || typeof col !== 'number') {
        res.status(400).json({ 
          status: 'error', 
          message: 'gameId, row, and col are required' 
        });
        return;
      }

      // Since this is a client-side game, just acknowledge the pop
      res.json({
        status: 'success',
        newScore: 1, // Client handles actual scoring
        bubbleState: 'popped',
      });
    } catch (error) {
      console.error('Error processing bubble pop:', error);
      res.status(500).json({ 
        status: 'error', 
        message: 'Failed to process bubble pop' 
      });
    }
  }
);

// Handle game end - simplified
router.post<{}, GameEndResponse, { gameId: string; finalScore: number; stats: any }>(
  '/api/game/end',
  async (req, res): Promise<void> => {
    try {
      const { gameId, finalScore, stats } = req.body;

      if (!gameId || typeof finalScore !== 'number') {
        res.status(400).json({ 
          status: 'error', 
          message: 'gameId and finalScore are required' 
        });
        return;
      }

      // Generate end message based on score
      let message = "Victory is fragile. Like plastic.";
      if (finalScore > 15) {
        message = "You popped like a champ!";
      } else if (finalScore <= 10) {
        message = "The ghost wins this round...";
      } else if (finalScore < 0) {
        message = "The ghosts completely dominated! 👻";
      }

      res.json({
        status: 'success',
        finalStats: {
          finalScore,
          bubblesPopped: stats.bubblesPopped || 0,
          bubblesUnpopped: stats.bubblesUnpopped || 0,
          ghostEvents: stats.ghostEvents || 0,
        },
        message,
      });
    } catch (error) {
      console.error('Error ending game:', error);
      res.status(500).json({ 
        status: 'error', 
        message: 'Failed to end game' 
      });
    }
  }
);

// Get game leaderboard - simplified
router.get<{}, any>('/api/game/leaderboard', async (_req, res): Promise<void> => {
  try {
    res.json({
      status: 'success',
      leaderboard: [
        { username: 'BubbleMaster', score: 87 },
        { username: 'PopKing', score: 72 },
        { username: 'GhostBuster', score: 65 },
      ],
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Failed to fetch leaderboard' 
    });
  }
});

// Use router middleware
app.use(router);

// Get port from environment variable with fallback
const port = getServerPort();

const server = createServer(app);
server.on('error', (err) => console.error(`server error; ${err.stack}`));
server.listen(port, () => console.log(`Bubble Wrap Popper Server running on http://localhost:${port}`));