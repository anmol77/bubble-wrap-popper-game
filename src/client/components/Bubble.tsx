import React from 'react';
import { BubbleState } from '../../shared/types/game';

interface BubbleProps {
  state: BubbleState;
  isAnimating: boolean;
  onClick: () => void;
  size: number;
}

export const Bubble: React.FC<BubbleProps> = ({ state, isAnimating, onClick, size }) => {
  const handleClick = () => {
    if (state === 'unpopped' && !isAnimating) {
      onClick();
    }
  };

  return (
    <div
      className={`bubble ${state} ${isAnimating ? 'animating' : ''}`}
      onClick={handleClick}
      style={{
        width: `${size}px`,
        height: `${size}px`,
      }}
    >
      <div className="bubble-surface" />
      <div className="bubble-highlight" />
    </div>
  );
};