import { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, Ghost, Bubble } from '../../shared/types/game';

const GRID_ROWS = 15; // Increased for more bubble wrap
const GRID_COLS = 10; // Increased for more bubble wrap
const GAME_DURATION = 30; // Changed from 60 to 30 seconds for testing
const RAGE_MODE_THRESHOLD = 10;
const MAX_GHOST_EVENTS = 15;
const GHOST_UNPOP_PENALTY = 1; // Points lost when ghost unpops a bubble (reduced to 1)

export const useGameLogic = () => {
  const [gameState, setGameState] = useState<GameState>(() => initializeGame());
  const [gameStats, setGameStats] = useState({
    bubblesPopped: 0,
    bubblesUnpopped: 0,
    ghostEvents: 0,
  });
  
  const gameTimerRef = useRef<NodeJS.Timeout>();
  const ghostTimerRef = useRef<NodeJS.Timeout>();
  const tickTockTimerRef = useRef<NodeJS.Timeout>();
  const rageAudioTimerRef = useRef<NodeJS.Timeout>();
  const alarmTimeoutRef = useRef<NodeJS.Timeout>();
  const alarmDelayTimeoutRef = useRef<NodeJS.Timeout>();
  const ghostEventCountRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Audio file references
  const tickTockAudioRef = useRef<HTMLAudioElement | null>(null);
  const bubblePopAudioRef = useRef<HTMLAudioElement | null>(null);
  const alarmEndAudioRef = useRef<HTMLAudioElement | null>(null);

  function initializeGame(): GameState {
    const bubbles: Bubble[][] = [];
    
    for (let row = 0; row < GRID_ROWS; row++) {
      const bubbleRow: Bubble[] = [];
      for (let col = 0; col < GRID_COLS; col++) {
        bubbleRow.push({
          id: `${row}-${col}`,
          state: 'unpopped',
          isAnimating: false,
        });
      }
      bubbles.push(bubbleRow);
    }

    return {
      bubbles,
      score: 0,
      timeLeft: GAME_DURATION, // This will now be 30 seconds
      isPlaying: false,
      isRageMode: false,
      ghosts: [],
      gridSize: { rows: GRID_ROWS, cols: GRID_COLS },
    };
  }

  // Initialize audio files
  useEffect(() => {
    // Updated paths for Vite build - assets are now in the root
    const tryLoadAudio = (paths: string[]) => {
      return new Promise<HTMLAudioElement | null>((resolve) => {
        let currentIndex = 0;
        
        const tryNext = () => {
          if (currentIndex >= paths.length) {
            console.log('Could not load audio from any path:', paths);
            resolve(null);
            return;
          }
          
          const audio = new Audio();
          const currentPath = paths[currentIndex];
          
          audio.oncanplaythrough = () => {
            console.log('Successfully loaded audio from:', currentPath);
            resolve(audio);
          };
          
          audio.onerror = () => {
            console.log('Failed to load audio from:', currentPath);
            currentIndex++;
            tryNext();
          };
          
          audio.src = currentPath;
          audio.preload = 'auto';
        };
        
        tryNext();
      });
    };

    // Try different possible paths for each audio file - updated for Vite build
    const loadAudioFiles = async () => {
      // Tick tock audio - try Vite asset paths first
      tickTockAudioRef.current = await tryLoadAudio([
        '/tick_tock.wav',
        './tick_tock.wav',
        'tick_tock.wav',
        '/assets/tick_tock.wav',
        './assets/tick_tock.wav',
        'assets/tick_tock.wav'
      ]);
      
      if (tickTockAudioRef.current) {
        tickTockAudioRef.current.loop = false;
        tickTockAudioRef.current.volume = 0.7;
      }

      // Bubble pop audio
      bubblePopAudioRef.current = await tryLoadAudio([
        '/bubble-wrap-pop.wav',
        './bubble-wrap-pop.wav',
        'bubble-wrap-pop.wav',
        '/assets/bubble-wrap-pop.wav',
        './assets/bubble-wrap-pop.wav',
        'assets/bubble-wrap-pop.wav'
      ]);
      
      if (bubblePopAudioRef.current) {
        bubblePopAudioRef.current.loop = false;
        bubblePopAudioRef.current.volume = 0.8;
      }

      // Alarm end audio
      alarmEndAudioRef.current = await tryLoadAudio([
        '/alarm_end.wav',
        './alarm_end.wav',
        'alarm_end.wav',
        '/assets/alarm_end.wav',
        './assets/alarm_end.wav',
        'assets/alarm_end.wav'
      ]);
      
      if (alarmEndAudioRef.current) {
        alarmEndAudioRef.current.loop = false;
        alarmEndAudioRef.current.volume = 0.9;
      }
    };

    loadAudioFiles();

    return () => {
      // Cleanup audio references
      if (tickTockAudioRef.current) {
        tickTockAudioRef.current.pause();
        tickTockAudioRef.current = null;
      }
      if (bubblePopAudioRef.current) {
        bubblePopAudioRef.current.pause();
        bubblePopAudioRef.current = null;
      }
      if (alarmEndAudioRef.current) {
        alarmEndAudioRef.current.pause();
        alarmEndAudioRef.current = null;
      }
    };
  }, []);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  // Stop alarm sound function
  const stopAlarmSound = useCallback(() => {
    if (alarmEndAudioRef.current) {
      alarmEndAudioRef.current.pause();
      alarmEndAudioRef.current.currentTime = 0;
    }
    if (alarmTimeoutRef.current) {
      clearTimeout(alarmTimeoutRef.current);
      alarmTimeoutRef.current = undefined;
    }
    if (alarmDelayTimeoutRef.current) {
      clearTimeout(alarmDelayTimeoutRef.current);
      alarmDelayTimeoutRef.current = undefined;
    }
  }, []);

  // Play tick-tock sound from audio file
  const playTickTockSound = useCallback(() => {
    try {
      if (tickTockAudioRef.current) {
        // Reset audio to beginning and play
        tickTockAudioRef.current.currentTime = 0;
        const playPromise = tickTockAudioRef.current.play();
        
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.log('Tick-tock audio play failed:', error);
            // Fallback to synthesized sound
            playTickTockSynthesized();
          });
        }
      } else {
        // Fallback to synthesized sound if audio file not loaded
        playTickTockSynthesized();
      }
    } catch (error) {
      console.log('Tick-tock sound error, using fallback');
      playTickTockSynthesized();
    }
  }, []);

  // Fallback synthesized tick-tock sound
  const playTickTockSynthesized = useCallback(() => {
    try {
      const audioContext = getAudioContext();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {
      console.log('Synthesized tick-tock sound would play here');
    }
  }, [getAudioContext]);

  // Play bubble wrap pop sound from audio file
  const playBubbleWrapPopSound = useCallback(() => {
    try {
      if (bubblePopAudioRef.current) {
        // Clone the audio for overlapping sounds
        const audioClone = bubblePopAudioRef.current.cloneNode() as HTMLAudioElement;
        audioClone.volume = 0.8;
        audioClone.currentTime = 0;
        
        const playPromise = audioClone.play();
        
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.log('Bubble pop audio play failed:', error);
            // Fallback to synthesized sound
            playBubblePopSynthesized();
          });
        }
      } else {
        // Fallback to synthesized sound if audio file not loaded
        playBubblePopSynthesized();
      }
    } catch (error) {
      console.log('Bubble wrap pop sound error, using fallback');
      playBubblePopSynthesized();
    }
  }, []);

  // Fallback synthesized bubble pop sound
  const playBubblePopSynthesized = useCallback(() => {
    try {
      const audioContext = getAudioContext();
      const oscillator1 = audioContext.createOscillator();
      const oscillator2 = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      const filter = audioContext.createBiquadFilter();
      
      oscillator1.connect(filter);
      oscillator2.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator1.frequency.setValueAtTime(1200, audioContext.currentTime);
      oscillator1.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.1);
      oscillator1.type = 'sine';
      
      oscillator2.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator2.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.08);
      oscillator2.type = 'triangle';
      
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2000, audioContext.currentTime);
      filter.frequency.exponentialRampToValueAtTime(300, audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.12);
      
      oscillator1.start(audioContext.currentTime);
      oscillator1.stop(audioContext.currentTime + 0.12);
      oscillator2.start(audioContext.currentTime);
      oscillator2.stop(audioContext.currentTime + 0.12);
    } catch (error) {
      console.log('Synthesized bubble pop sound would play here');
    }
  }, [getAudioContext]);

  // EXACT ALARM SECTION - Play alarm end sound for EXACTLY 1 second
  const playAlarmEndSound = useCallback(() => {
    try {
      if (alarmEndAudioRef.current) {
        // Stop any currently playing alarm first
        stopAlarmSound();
        
        alarmEndAudioRef.current.currentTime = 0;
        const playPromise = alarmEndAudioRef.current.play();
        
        if (playPromise !== undefined) {
          playPromise.then(() => {
            // CRITICAL: Set up automatic stop after EXACTLY 1 second
            alarmTimeoutRef.current = setTimeout(() => {
              stopAlarmSound();
            }, 1000); // EXACTLY 1 second - this is the key change
          }).catch(error => {
            console.log('Alarm end audio play failed:', error);
            // Fallback to synthesized sound
            playAlarmSynthesized();
          });
        }

        // Also add an event listener to stop when the audio naturally ends
        const handleAudioEnd = () => {
          stopAlarmSound();
          if (alarmEndAudioRef.current) {
            alarmEndAudioRef.current.removeEventListener('ended', handleAudioEnd);
          }
        };
        
        if (alarmEndAudioRef.current) {
          alarmEndAudioRef.current.addEventListener('ended', handleAudioEnd);
        }
      } else {
        // Fallback to synthesized sound if audio file not loaded
        playAlarmSynthesized();
      }
    } catch (error) {
      console.log('Alarm end sound error, using fallback');
      playAlarmSynthesized();
    }
  }, [stopAlarmSound]);

  // Fallback synthesized alarm sound - exactly 1 second
  const playAlarmSynthesized = useCallback(() => {
    try {
      const audioContext = getAudioContext();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Alternating alarm tones for 1 second only
      oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime + 0.5);
      oscillator.type = 'square';
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.05);
      gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.95);
      gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 1); // EXACTLY 1 second
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 1); // EXACTLY 1 second
      
      // Set up timeout to clear references after 1 second
      alarmTimeoutRef.current = setTimeout(() => {
        stopAlarmSound();
      }, 1000); // EXACTLY 1 second
      
    } catch (error) {
      console.log('Synthesized alarm sound would play here');
    }
  }, [getAudioContext, stopAlarmSound]);

  // Schedule alarm to play immediately after timer ends (no delay)
  const scheduleAlarmSound = useCallback(() => {
    // Play alarm immediately when game ends, for exactly 1 second
    playAlarmEndSound();
  }, [playAlarmEndSound]);

  const playBubbleInflateSound = useCallback(() => {
    try {
      const audioContext = getAudioContext();
      
      // Create realistic bubble inflate sound (reverse of pop)
      const oscillator1 = audioContext.createOscillator();
      const oscillator2 = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      const filter = audioContext.createBiquadFilter();
      
      oscillator1.connect(filter);
      oscillator2.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Reverse frequency sweep for inflate effect
      oscillator1.frequency.setValueAtTime(120, audioContext.currentTime);
      oscillator1.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + 0.2);
      oscillator1.type = 'sine';
      
      // Secondary oscillator for air flow effect
      oscillator2.frequency.setValueAtTime(80, audioContext.currentTime);
      oscillator2.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.18);
      oscillator2.type = 'triangle';
      
      // Filter for air-like sound
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(300, audioContext.currentTime);
      filter.frequency.exponentialRampToValueAtTime(1800, audioContext.currentTime + 0.2);
      filter.Q.setValueAtTime(1, audioContext.currentTime);
      
      // Gradual volume increase like inflating
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.06, audioContext.currentTime + 0.03);
      gainNode.gain.linearRampToValueAtTime(0.12, audioContext.currentTime + 0.12);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.22);
      
      const duration = 0.22;
      oscillator1.start(audioContext.currentTime);
      oscillator1.stop(audioContext.currentTime + duration);
      oscillator2.start(audioContext.currentTime);
      oscillator2.stop(audioContext.currentTime + duration);
      
    } catch (error) {
      console.log('Bubble inflate sound would play here');
    }
  }, [getAudioContext]);

  const playSpookyGhostArrivalSound = useCallback(() => {
    try {
      const audioContext = getAudioContext();
      
      // Create spooky ghost arrival sound with multiple layers
      const oscillator1 = audioContext.createOscillator();
      const oscillator2 = audioContext.createOscillator();
      const oscillator3 = audioContext.createOscillator();
      const noiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.5, audioContext.sampleRate);
      const noiseSource = audioContext.createBufferSource();
      const gainNode = audioContext.createGain();
      const noiseGain = audioContext.createGain();
      const filter1 = audioContext.createBiquadFilter();
      const filter2 = audioContext.createBiquadFilter();
      const delay = audioContext.createDelay();
      const delayGain = audioContext.createGain();
      
      // Generate white noise for wind effect
      const noiseData = noiseBuffer.getChannelData(0);
      for (let i = 0; i < noiseData.length; i++) {
        noiseData[i] = Math.random() * 2 - 1;
      }
      noiseSource.buffer = noiseBuffer;
      
      // Connect audio graph
      oscillator1.connect(filter1);
      oscillator2.connect(filter1);
      oscillator3.connect(filter2);
      noiseSource.connect(noiseGain);
      filter1.connect(gainNode);
      filter2.connect(gainNode);
      noiseGain.connect(filter2);
      gainNode.connect(audioContext.destination);
      
      // Add delay for echo effect
      gainNode.connect(delay);
      delay.connect(delayGain);
      delayGain.connect(audioContext.destination);
      
      // Low spooky frequency with vibrato
      oscillator1.frequency.setValueAtTime(85, audioContext.currentTime);
      oscillator1.frequency.linearRampToValueAtTime(95, audioContext.currentTime + 0.3);
      oscillator1.frequency.linearRampToValueAtTime(75, audioContext.currentTime + 0.6);
      oscillator1.type = 'sine';
      
      // Harmonic for eeriness
      oscillator2.frequency.setValueAtTime(170, audioContext.currentTime);
      oscillator2.frequency.linearRampToValueAtTime(190, audioContext.currentTime + 0.3);
      oscillator2.frequency.linearRampToValueAtTime(150, audioContext.currentTime + 0.6);
      oscillator2.type = 'triangle';
      
      // High frequency whistle
      oscillator3.frequency.setValueAtTime(1200, audioContext.currentTime);
      oscillator3.frequency.linearRampToValueAtTime(800, audioContext.currentTime + 0.4);
      oscillator3.frequency.linearRampToValueAtTime(1400, audioContext.currentTime + 0.8);
      oscillator3.type = 'sine';
      
      // Filters for spooky effect
      filter1.type = 'lowpass';
      filter1.frequency.setValueAtTime(400, audioContext.currentTime);
      filter1.Q.setValueAtTime(8, audioContext.currentTime);
      
      filter2.type = 'bandpass';
      filter2.frequency.setValueAtTime(1000, audioContext.currentTime);
      filter2.Q.setValueAtTime(10, audioContext.currentTime);
      
      // Delay settings for echo
      delay.delayTime.setValueAtTime(0.15, audioContext.currentTime);
      delayGain.gain.setValueAtTime(0.3, audioContext.currentTime);
      
      // Noise gain for wind effect
      noiseGain.gain.setValueAtTime(0, audioContext.currentTime);
      noiseGain.gain.linearRampToValueAtTime(0.02, audioContext.currentTime + 0.1);
      noiseGain.gain.linearRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
      noiseGain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.8);
      
      // Main volume envelope with tremolo
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.08, audioContext.currentTime + 0.1);
      
      // Create tremolo effect
      for (let i = 0; i < 8; i++) {
        const time = audioContext.currentTime + 0.1 + (i * 0.08);
        gainNode.gain.linearRampToValueAtTime(0.04, time);
        gainNode.gain.linearRampToValueAtTime(0.08, time + 0.04);
      }
      
      gainNode.gain.linearRampToValueAtTime(0.001, audioContext.currentTime + 0.9);
      
      const duration = 0.9;
      oscillator1.start(audioContext.currentTime);
      oscillator1.stop(audioContext.currentTime + duration);
      oscillator2.start(audioContext.currentTime);
      oscillator2.stop(audioContext.currentTime + duration);
      oscillator3.start(audioContext.currentTime);
      oscillator3.stop(audioContext.currentTime + duration);
      noiseSource.start(audioContext.currentTime);
      noiseSource.stop(audioContext.currentTime + duration);
      
    } catch (error) {
      console.log('Spooky ghost arrival sound would play here');
    }
  }, [getAudioContext]);

  const playGhostUnpopSound = useCallback(() => {
    try {
      const audioContext = getAudioContext();
      
      // Combine spooky ghost sound with bubble inflate
      const oscillator1 = audioContext.createOscillator();
      const oscillator2 = audioContext.createOscillator();
      const oscillator3 = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      const filter = audioContext.createBiquadFilter();
      
      oscillator1.connect(filter);
      oscillator2.connect(filter);
      oscillator3.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Spooky low frequency
      oscillator1.frequency.setValueAtTime(100, audioContext.currentTime);
      oscillator1.frequency.linearRampToValueAtTime(120, audioContext.currentTime + 0.15);
      oscillator1.type = 'sine';
      
      // Bubble inflate frequency
      oscillator2.frequency.setValueAtTime(150, audioContext.currentTime);
      oscillator2.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.18);
      oscillator2.type = 'triangle';
      
      // Ghostly whisper
      oscillator3.frequency.setValueAtTime(600, audioContext.currentTime);
      oscillator3.frequency.linearRampToValueAtTime(400, audioContext.currentTime + 0.2);
      oscillator3.type = 'sine';
      
      // Filter for combined effect
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(500, audioContext.currentTime);
      filter.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + 0.2);
      filter.Q.setValueAtTime(3, audioContext.currentTime);
      
      // Volume envelope
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.02);
      gainNode.gain.linearRampToValueAtTime(0.08, audioContext.currentTime + 0.1);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.25);
      
      const duration = 0.25;
      oscillator1.start(audioContext.currentTime);
      oscillator1.stop(audioContext.currentTime + duration);
      oscillator2.start(audioContext.currentTime);
      oscillator2.stop(audioContext.currentTime + duration);
      oscillator3.start(audioContext.currentTime);
      oscillator3.stop(audioContext.currentTime + duration);
      
    } catch (error) {
      console.log('Ghost unpop sound would play here');
    }
  }, [getAudioContext]);

  // Start tick-tock timer for last 10 seconds - plays every second
  const startTickTockTimer = useCallback(() => {
    // Play first tick immediately
    playTickTockSound();
    
    // Then play every second for the remaining 9 seconds
    let tickCount = 1;
    const tickTockInterval = setInterval(() => {
      if (tickCount < 10) { // Only play for 10 total ticks
        playTickTockSound();
        tickCount++;
      } else {
        clearInterval(tickTockInterval);
      }
    }, 1000); // Every second
    
    tickTockTimerRef.current = tickTockInterval;
  }, [playTickTockSound]);

  const startRageAmbient = useCallback(() => {
    // For rage mode, we'll use synthesized ambient sounds since we don't have a rage ambient audio file
    // This creates an intense atmosphere during the last 10 seconds
    try {
      const audioContext = getAudioContext();
      
      // Create intense rage mode ambient sound
      const oscillator1 = audioContext.createOscillator();
      const oscillator2 = audioContext.createOscillator();
      const oscillator3 = audioContext.createOscillator();
      const noiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 2, audioContext.sampleRate);
      const noiseSource = audioContext.createBufferSource();
      const gainNode = audioContext.createGain();
      const noiseGain = audioContext.createGain();
      const filter1 = audioContext.createBiquadFilter();
      const filter2 = audioContext.createBiquadFilter();
      const lfo = audioContext.createOscillator();
      const lfoGain = audioContext.createGain();
      
      // Generate red noise for intense atmosphere
      const noiseData = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < noiseData.length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        noiseData[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        noiseData[i] *= 0.11;
        b6 = white * 0.115926;
      }
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;
      
      // Connect audio graph
      oscillator1.connect(filter1);
      oscillator2.connect(filter1);
      oscillator3.connect(filter2);
      noiseSource.connect(noiseGain);
      filter1.connect(gainNode);
      filter2.connect(gainNode);
      noiseGain.connect(filter2);
      
      // LFO for tremolo effect
      lfo.connect(lfoGain);
      lfoGain.connect(gainNode.gain);
      
      gainNode.connect(audioContext.destination);
      
      // Deep rumbling bass
      oscillator1.frequency.setValueAtTime(40, audioContext.currentTime);
      oscillator1.frequency.linearRampToValueAtTime(35, audioContext.currentTime + 1);
      oscillator1.frequency.linearRampToValueAtTime(45, audioContext.currentTime + 2);
      oscillator1.type = 'sawtooth';
      
      // Mid-range tension
      oscillator2.frequency.setValueAtTime(120, audioContext.currentTime);
      oscillator2.frequency.linearRampToValueAtTime(110, audioContext.currentTime + 1.5);
      oscillator2.frequency.linearRampToValueAtTime(130, audioContext.currentTime + 2);
      oscillator2.type = 'square';
      
      // High frequency tension
      oscillator3.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator3.frequency.linearRampToValueAtTime(900, audioContext.currentTime + 0.8);
      oscillator3.frequency.linearRampToValueAtTime(700, audioContext.currentTime + 1.6);
      oscillator3.type = 'sine';
      
      // Filters for ominous effect
      filter1.type = 'lowpass';
      filter1.frequency.setValueAtTime(200, audioContext.currentTime);
      filter1.Q.setValueAtTime(8, audioContext.currentTime);
      
      filter2.type = 'bandpass';
      filter2.frequency.setValueAtTime(1500, audioContext.currentTime);
      filter2.Q.setValueAtTime(15, audioContext.currentTime);
      
      // LFO for tremolo
      lfo.frequency.setValueAtTime(6, audioContext.currentTime);
      lfo.type = 'sine';
      lfoGain.gain.setValueAtTime(0.02, audioContext.currentTime);
      
      // Noise gain for atmosphere
      noiseGain.gain.setValueAtTime(0.03, audioContext.currentTime);
      
      // Main volume envelope
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.08, audioContext.currentTime + 0.5);
      gainNode.gain.linearRampToValueAtTime(0.12, audioContext.currentTime + 1);
      gainNode.gain.linearRampToValueAtTime(0.08, audioContext.currentTime + 1.5);
      gainNode.gain.linearRampToValueAtTime(0.001, audioContext.currentTime + 2);
      
      const duration = 2;
      oscillator1.start(audioContext.currentTime);
      oscillator1.stop(audioContext.currentTime + duration);
      oscillator2.start(audioContext.currentTime);
      oscillator2.stop(audioContext.currentTime + duration);
      oscillator3.start(audioContext.currentTime);
      oscillator3.stop(audioContext.currentTime + duration);
      lfo.start(audioContext.currentTime);
      lfo.stop(audioContext.currentTime + duration);
      noiseSource.start(audioContext.currentTime);
      noiseSource.stop(audioContext.currentTime + duration);
      
    } catch (error) {
      console.log('Rage ambient sound would play here');
    }
    
    // Continue playing rage ambient sounds every 3 seconds for 10 seconds total
    let rageCount = 0;
    const rageInterval = setInterval(() => {
      rageCount++;
      if (rageCount >= 3) { // Stop after 3 additional plays (total ~10 seconds)
        clearInterval(rageInterval);
        return;
      }
      
      // Play another rage ambient sound
      try {
        const audioContext = getAudioContext();
        // Simplified rage sound for repeated playing
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.setValueAtTime(60, audioContext.currentTime);
        osc.type = 'sawtooth';
        gain.gain.setValueAtTime(0, audioContext.currentTime);
        gain.gain.linearRampToValueAtTime(0.05, audioContext.currentTime + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 1);
        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + 1);
      } catch (error) {
        console.log('Rage ambient loop sound would play here');
      }
    }, 3000);
    
    rageAudioTimerRef.current = rageInterval;
  }, [getAudioContext]);

  const popBubble = useCallback((row: number, col: number) => {
    // Only allow popping if game is actively playing
    if (!gameState.isPlaying) return;

    setGameState(prev => {
      const newBubbles = prev.bubbles.map(r => [...r]);
      const bubble = newBubbles[row][col];
      
      if (bubble.state === 'unpopped' && !bubble.isAnimating) {
        bubble.state = 'popped';
        bubble.isAnimating = true;
        
        // Stop animation after a short delay
        setTimeout(() => {
          setGameState(current => {
            const updatedBubbles = current.bubbles.map(r => [...r]);
            updatedBubbles[row][col].isAnimating = false;
            return { ...current, bubbles: updatedBubbles };
          });
        }, 400);

        // Play the real bubble wrap pop sound
        playBubbleWrapPopSound();
        setGameStats(stats => ({ ...stats, bubblesPopped: stats.bubblesPopped + 1 }));
        
        return {
          ...prev,
          bubbles: newBubbles,
          score: prev.score + 1,
        };
      }
      
      return prev;
    });
  }, [gameState.isPlaying, playBubbleWrapPopSound]);

  const spawnGhost = useCallback(() => {
    // Check if we've reached max ghost events
    if (ghostEventCountRef.current >= MAX_GHOST_EVENTS) return;
    
    // Get current game state to check if game is still playing
    setGameState(prev => {
      // CRITICAL: Don't spawn ghosts if the game is not playing
      if (!prev.isPlaying) return prev;
      
      // Play spooky ghost arrival sound
      playSpookyGhostArrivalSound();
      
      // Find all popped bubbles
      const poppedBubbles: { row: number; col: number }[] = [];
      prev.bubbles.forEach((row, rowIndex) => {
        row.forEach((bubble, colIndex) => {
          if (bubble.state === 'popped') {
            poppedBubbles.push({ row: rowIndex, col: colIndex });
          }
        });
      });

      if (poppedBubbles.length === 0) return prev;

      // Pick random starting position
      const startPos = poppedBubbles[Math.floor(Math.random() * poppedBubbles.length)];
      const steps = Math.floor(Math.random() * 5) + 1;

      const newGhost: Ghost = {
        id: `ghost-${Date.now()}`,
        x: startPos.col,
        y: startPos.row,
        stepsRemaining: steps,
        isActive: true,
      };

      ghostEventCountRef.current++;
      setGameStats(stats => ({ ...stats, ghostEvents: stats.ghostEvents + 1 }));

      return {
        ...prev,
        ghosts: [...prev.ghosts, newGhost],
      };
    });
  }, [playSpookyGhostArrivalSound]);

  const moveGhosts = useCallback(() => {
    setGameState(prev => {
      // CRITICAL: Don't move ghosts if the game is not playing
      if (!prev.isPlaying) return prev;
      
      const newBubbles = prev.bubbles.map(row => [...row]);
      const newGhosts = prev.ghosts.map(ghost => ({ ...ghost }));
      let scoreChange = 0;

      newGhosts.forEach(ghost => {
        if (!ghost.isActive || ghost.stepsRemaining <= 0) {
          ghost.isActive = false;
          return;
        }

        // Move ghost randomly
        const directions = [
          { dx: 0, dy: -1 }, // up
          { dx: 0, dy: 1 },  // down
          { dx: -1, dy: 0 }, // left
          { dx: 1, dy: 0 },  // right
        ];

        const direction = directions[Math.floor(Math.random() * directions.length)];
        const newX = Math.max(0, Math.min(GRID_COLS - 1, ghost.x + direction.dx));
        const newY = Math.max(0, Math.min(GRID_ROWS - 1, ghost.y + direction.dy));

        ghost.x = newX;
        ghost.y = newY;
        ghost.stepsRemaining--;

        // Check if ghost lands on popped bubble
        const bubble = newBubbles[newY][newX];
        if (bubble.state === 'popped') {
          bubble.state = 'unpopped';
          bubble.isAnimating = true;
          
          // ENHANCED: Apply score penalty when ghost unpops a bubble (reduced to 1 point)
          scoreChange -= GHOST_UNPOP_PENALTY;
          
          playGhostUnpopSound();
          
          // Update stats: decrease popped count and increase unpopped count
          setGameStats(stats => ({ 
            ...stats, 
            bubblesPopped: Math.max(0, stats.bubblesPopped - 1), // Decrease popped count
            bubblesUnpopped: stats.bubblesUnpopped + 1 
          }));

          // Stop animation
          setTimeout(() => {
            setGameState(current => {
              const updatedBubbles = current.bubbles.map(r => [...r]);
              updatedBubbles[newY][newX].isAnimating = false;
              return { ...current, bubbles: updatedBubbles };
            });
          }, 500);
        }

        if (ghost.stepsRemaining <= 0) {
          ghost.isActive = false;
        }
      });

      return {
        ...prev,
        bubbles: newBubbles,
        ghosts: newGhosts.filter(ghost => ghost.isActive),
        // ENHANCED: Apply score reduction with minimum of 0
        score: Math.max(0, prev.score + scoreChange),
      };
    });
  }, [playGhostUnpopSound]);

  const startGame = useCallback(() => {
    setGameState(prev => ({ ...prev, isPlaying: true }));
    ghostEventCountRef.current = 0;
    
    // Game timer
    gameTimerRef.current = setInterval(() => {
      setGameState(prev => {
        const newTimeLeft = prev.timeLeft - 1;
        const newIsRageMode = newTimeLeft <= RAGE_MODE_THRESHOLD && newTimeLeft > 0;
        const wasRageMode = prev.isRageMode;
        
        // Start rage mode effects when entering rage mode (at 10 seconds)
        if (newIsRageMode && !wasRageMode) {
          startTickTockTimer(); // This will play tick-tock every second for 10 seconds
          startRageAmbient();
        }
        
        if (newTimeLeft <= 0) {
          // CRITICAL: Stop all timers immediately when game ends
          if (gameTimerRef.current) {
            clearInterval(gameTimerRef.current);
            gameTimerRef.current = undefined;
          }
          if (ghostTimerRef.current) {
            clearTimeout(ghostTimerRef.current);
            ghostTimerRef.current = undefined;
          }
          if (tickTockTimerRef.current) {
            clearInterval(tickTockTimerRef.current);
            tickTockTimerRef.current = undefined;
          }
          if (rageAudioTimerRef.current) {
            clearInterval(rageAudioTimerRef.current);
            rageAudioTimerRef.current = undefined;
          }
          
          // Schedule alarm to play immediately after timer ends for exactly 1 second
          scheduleAlarmSound();
          
          return {
            ...prev,
            timeLeft: 0,
            isPlaying: false, // Game stops, board shows current state
            isRageMode: false,
            // Keep ghosts visible but inactive
            ghosts: prev.ghosts.map(ghost => ({ ...ghost, isActive: false })),
          };
        }
        
        return {
          ...prev,
          timeLeft: newTimeLeft,
          isRageMode: newIsRageMode,
        };
      });
    }, 1000);

    // Ghost spawning timer - schedules next ghost only if game is still playing
    const scheduleNextGhost = () => {
      if (ghostEventCountRef.current >= MAX_GHOST_EVENTS) return;
      
      // Check current game state before scheduling
      setGameState(currentState => {
        // CRITICAL: Don't schedule ghosts if game is not playing
        if (!currentState.isPlaying) return currentState;
        
        // CRITICAL CHANGE: Much more aggressive ghost spawning in rage mode (last 10 seconds)
        const delay = currentState.isRageMode ? 
          Math.random() * 300 + 200 : // 0.2-0.5 seconds in rage mode (VERY AGGRESSIVE!)
          Math.random() * 3000 + 2000;  // 2-5 seconds normally
        
        ghostTimerRef.current = setTimeout(() => {
          // Double-check game state before spawning
          setGameState(checkState => {
            if (checkState.isPlaying) {
              spawnGhost();
              scheduleNextGhost();
            }
            return checkState;
          });
        }, delay);
        
        return currentState;
      });
    };

    scheduleNextGhost();

    // Ghost movement timer - only moves ghosts while game is playing
    const ghostMoveInterval = setInterval(() => {
      moveGhosts();
    }, 500);
    
    return () => {
      clearInterval(ghostMoveInterval);
    };
  }, [spawnGhost, moveGhosts, startTickTockTimer, startRageAmbient, scheduleAlarmSound]);

  const resetGame = useCallback(() => {
    // Clear all timers and intervals
    if (gameTimerRef.current) {
      clearInterval(gameTimerRef.current);
      gameTimerRef.current = undefined;
    }
    if (ghostTimerRef.current) {
      clearTimeout(ghostTimerRef.current);
      ghostTimerRef.current = undefined;
    }
    if (tickTockTimerRef.current) {
      clearInterval(tickTockTimerRef.current);
      tickTockTimerRef.current = undefined;
    }
    if (rageAudioTimerRef.current) {
      clearInterval(rageAudioTimerRef.current);
      rageAudioTimerRef.current = undefined;
    }
    
    // CRITICAL: Stop alarm sound completely when resetting/restarting game
    stopAlarmSound();
    
    setGameState(initializeGame());
    setGameStats({
      bubblesPopped: 0,
      bubblesUnpopped: 0,
      ghostEvents: 0,
    });
    ghostEventCountRef.current = 0;
  }, [stopAlarmSound]);

  useEffect(() => {
    return () => {
      // Cleanup all timers and audio
      if (gameTimerRef.current) clearInterval(gameTimerRef.current);
      if (ghostTimerRef.current) clearTimeout(ghostTimerRef.current);
      if (tickTockTimerRef.current) clearInterval(tickTockTimerRef.current);
      if (rageAudioTimerRef.current) clearInterval(rageAudioTimerRef.current);
      if (alarmTimeoutRef.current) clearTimeout(alarmTimeoutRef.current);
      if (alarmDelayTimeoutRef.current) clearTimeout(alarmDelayTimeoutRef.current);
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return {
    gameState,
    gameStats,
    popBubble,
    startGame,
    resetGame,
  };
};