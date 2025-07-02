export type BubbleState = 'unpopped' | 'popped';

export type Bubble = {
  id: string;
  state: BubbleState;
  isAnimating: boolean;
};

export type Ghost = {
  id: string;
  x: number;
  y: number;
  stepsRemaining: number;
  isActive: boolean;
};

export type GameState = {
  bubbles: Bubble[][];
  score: number;
  timeLeft: number;
  isPlaying: boolean;
  isRageMode: boolean;
  ghosts: Ghost[];
  gridSize: { rows: number; cols: number };
};

export type GameStats = {
  finalScore: number;
  bubblesPopped: number;
  bubblesUnpopped: number;
  ghostEvents: number;
};

// API Types
type Response<T> = { status: 'error'; message: string } | ({ status: 'success' } & T);

export type InitGameResponse = Response<{
  gameId: string;
  gridSize: { rows: number; cols: number };
}>;

export type PopBubbleResponse = Response<{
  newScore: number;
  bubbleState: BubbleState;
}>;

export type GameEndResponse = Response<{
  finalStats: GameStats;
  message: string;
}>;