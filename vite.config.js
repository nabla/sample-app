import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig, loadEnv } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');

    return ({
        define: {
            "import.meta.env.NABLA_API_HOSTNAME": JSON.stringify(
                env.NABLA_API_HOSTNAME
            ),
            "import.meta.env.NABLA_ACCESS_TOKEN": JSON.stringify(
                env.NABLA_ACCESS_TOKEN
            ),
            "import.meta.env.NABLA_REFRESH_TOKEN": JSON.stringify(
                env.NABLA_REFRESH_TOKEN
            ),
        },
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
});
