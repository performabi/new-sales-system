import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { apiPlugin } from './src/server/apiPlugin';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), apiPlugin()],
  server: {
    port: 4545,
    strictPort: true,      // fail if 4545 is already taken
    open: true,            // auto-open browser
  },
});
