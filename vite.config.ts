import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173, strictPort: true,
      proxy: { '/api': env.BACKEND_URL || 'http://localhost:3000' },
      fs: { deny: ['**/*.env', '**/.env', '**/.env.*', '**/*.{crt,pem}', '**/.git/**'] },
    },
    preview: {
      port: 5173, strictPort: true,
      proxy: { '/api': env.BACKEND_URL || 'http://localhost:3000' },
    },
  };
});
