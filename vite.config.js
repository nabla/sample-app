import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, "index.html"),
                dictatedNote: resolve(__dirname, "app/dictated-note-demo/index.html"),
                ambientEncounter: resolve(__dirname, "app/ambient-encounter-demo/index.html"),
            },
        },
    },
});
