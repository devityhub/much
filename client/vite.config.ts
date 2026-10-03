import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

const apiTarget = process.env.MUCH_API ?? 'http://127.0.0.1:43124';

export default defineConfig(({ mode }) => {
  // `npm run dev:https`: abre na rede local com HTTPS, exigido pelo navegador para microfone, câmera e tela.
  const https = mode === 'https';
  return {
    plugins: [react(), tailwindcss(), ...(https ? [basicSsl()] : [])],
    server: {
      port: 43123,
      host: https ? true : '127.0.0.1',
      proxy: {
        '/api': apiTarget,
        '/uploads': apiTarget,
        '/socket.io': { target: apiTarget, ws: true },
      },
    },
  };
});
