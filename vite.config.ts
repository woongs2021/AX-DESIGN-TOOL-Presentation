import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import { startFigmaBridge } from "./scripts/figma-bridge.ts";
import { presentationProject } from "./scripts/presentation-project.ts";

const PRESENTATION_DEFAULTS_ROUTE = "/__presentation-defaults";
const presentationDefaultsFile = resolve("src/shared/presentation-defaults.json");

/** Lets the Presentation tab save its current pages as the app defaults. */
const presentationDefaults = (): Plugin => ({
  name: "presentation-defaults",
  configureServer(server) {
    server.middlewares.use(PRESENTATION_DEFAULTS_ROUTE, (req, res) => {
      if (req.method !== "POST") {
        res.statusCode = 405;
        res.end();
        return;
      }
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { pages?: unknown };
          if (!Array.isArray(body.pages) || body.pages.length < 1) throw new Error("pages");
          writeFileSync(presentationDefaultsFile, `${JSON.stringify(body, null, 2)}\n`);
          res.statusCode = 204;
        } catch {
          res.statusCode = 400;
        }
        res.end();
      });
    });
  },
  handleHotUpdate({ file }) {
    // The page already holds what it just wrote; a reload would drop the editor state.
    if (resolve(file) === presentationDefaultsFile) return [];
  },
});

const figmaBridge = (): Plugin => ({
  name: "figma-bridge",
  configureServer(server) {
    const bridge = startFigmaBridge();
    server.httpServer?.on("close", () => {
      if (bridge?.listening) bridge.close();
    });
  },
});

export default defineConfig({
  plugins: [figmaBridge(), presentationDefaults(), presentationProject()],
  base: "./",
  // The conference data and assets the Presentation reads (data/conference.json, assets/conference/…), copied from AX-DESIGN-TOOL's public build.
  publicDir: "public",
  build: {
    outDir: "dist/app",
    emptyOutDir: true,
  },
  server: {
    watch: {
      ignored: ["**/presentation/**"],
    },
    fs: {
      allow: ["."],
    },
  },
});
