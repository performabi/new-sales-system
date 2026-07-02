import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { apiPlugin } from './src/server/apiPlugin';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), apiPlugin()],
  server: {
    port: 5174,
    strictPort: false, // allow fallback if port taken
    open: true,            // auto-open browser
  },
});
