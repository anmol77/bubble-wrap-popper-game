import { defineConfig } from 'vite';
import tailwind from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwind()],
  build: {
    outDir: '../../webroot',
    emptyOutDir: true,
    sourcemap: true,
    chunkSizeWarningLimit: 1500,
  },
  publicDir: '../../assets', // Include assets folder in build
  assetsInclude: ['**/*.wav', '**/*.mp3', '**/*.ogg'], // Include audio files
});