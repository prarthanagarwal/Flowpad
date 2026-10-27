import { defineConfig } from 'vite';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    electron([
      {
        // Main process entry point
        entry: 'src/main/main.js',
        vite: {
          build: {
            outDir: 'dist-electron/main',
            commonjsOptions: { include: [/src\/main/, /src\/shared/, /node_modules/] },
            rollupOptions: {
              external: ['electron', 'electron-store', 'update-electron-app', 'electron-squirrel-startup', 'linkedom', 'marked', 'turndown']
            }
          }
        }
      },
      {
        // Preload script
        entry: 'preload.js',
        onstart(options) {
          options.reload();
        },
        vite: {
          build: {
            outDir: 'dist-electron/preload',
            commonjsOptions: { include: [/preload\.js/] },
            rollupOptions: {
              external: ['electron']
            }
          }
        }
      }
    ]),
    renderer()
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      }
    }
  },
  server: {
    port: 5173
  }
});
