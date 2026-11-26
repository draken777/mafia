import { defineConfig } from 'vite';

const SERVER_PORT = Number(process.env.PORT ?? 3001);

export default defineConfig({
  root: 'client',
  build: {
    outDir: '../dist/client',
    emptyOutDir: true,
  },
  server: {
    host: true, // reachable from phones on the same Wi-Fi during development
    port: 5173,
    proxy: {
      '/socket.io': {
        target: `http://localhost:${SERVER_PORT}`,
        ws: true,
      },
    },
  },
});
