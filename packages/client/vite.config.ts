import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiPort = Number(process.env.RYCORN_API_PORT ?? 3000);
const apiHttp = `http://127.0.0.1:${apiPort}`;
const apiWebSocket = `ws://127.0.0.1:${apiPort}`;

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: Number(process.env.RYCORN_CLIENT_PORT ?? 5173),
    strictPort: true,
    allowedHosts: ['.devtunnels.ms'],
    proxy: {
      '^/(network|simulation|ds|admin)(/|$)': { target: apiHttp, changeOrigin: true },
      '^/health/?$': { target: apiHttp, changeOrigin: true },
      '/ws': { target: apiWebSocket, changeOrigin: true, ws: true },
    },
  },
});
