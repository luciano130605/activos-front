import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173, strictPort: true,
      proxy: { '/api': env.BACKEND_URL || 'https://activos-back-production.up.railway.app/' },
      fs: { deny: ['**/*.env', '**/.env', '**/.env.*', '**/*.{crt,pem}', '**/.git/**'] },
    },
    preview: {
      port: 5173, strictPort: true,
      proxy: { '/api': env.BACKEND_URL || 'https://activos-back-production.up.railway.app/' },
    },
  };
});
