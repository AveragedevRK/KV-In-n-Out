import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // process.cwd() ensures it finds your .env file on Render's server
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    base: '/', 
    plugins: [react()],
    
    // Dev server config
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true
    },

    // Production preview config (Crucial for Render Web Service)
    preview: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true
    },

    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },

    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      emptyOutDir: true
    }
  };
});
