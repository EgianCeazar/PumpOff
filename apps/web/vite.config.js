import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig(({ mode }) => ({
  // `npm run dev:phone` serves over HTTPS on your Wi-Fi, because phones
  // only allow camera access on secure pages. Your phone will warn about
  // the self-signed certificate once; accept it to continue.
  plugins: [react(), ...(mode === 'phone' ? [basicSsl()] : [])],
  // Matches the GitHub Pages path for when the repo is published.
  base: '/PumpOff/',
  server: { host: true },
}));
