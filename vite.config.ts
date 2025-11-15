import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  // Fix: Use path.resolve('.') instead of process.cwd() to avoid type errors
  const env = loadEnv(mode, path.resolve('.'), '');
  
  return {
    plugins: [react()],
    resolve: {
      alias: {
        // Explicitly map the absolute import path used in index.html
        // to the physical file in the current working directory.
        // This fixes the "Rollup failed to resolve import" error on Vercel.
        // Fix: Use path.resolve('index.tsx') instead of process.cwd()
        '/index.tsx': path.resolve('index.tsx'),
      },
    },
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
    },
  };
});