import path from 'node:path';
import { buildFrameHalf } from '@holistics/anfra-sdk/build';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

// In development the page is served by Vite, with hot reload, and everything else goes to the
// host's server (server/main.ts), as one origin: the same routes production serves from one process.
const server = `http://127.0.0.1:${process.env.PORT ?? 8787}`;

/**
 * `virtual:askai-frame`: the Ask AI plugin's frame half (src/askai/frame.ts), built into the script
 * source the host provisions into each frame. Built again when its files change.
 */
function askAiFrame(): Plugin {
  const id = 'virtual:askai-frame';
  const dir = path.resolve(import.meta.dirname, 'src/askai');
  return {
    name: 'askai-frame',
    resolveId: (source) => (source === id ? `\0${id}` : undefined),
    async load(resolved) {
      if (resolved !== `\0${id}`) return;
      for (const file of ['frame.ts', 'model.ts']) this.addWatchFile(path.join(dir, file));
      const frame = await buildFrameHalf({ setup: path.join(dir, 'frame.ts') });
      return `export default ${JSON.stringify(frame)};`;
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), askAiFrame()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': server, '/host': server, '/exports': server, '/health': server, '/mcp': server },
  },
  build: { outDir: 'dist/page', emptyOutDir: true },
});
