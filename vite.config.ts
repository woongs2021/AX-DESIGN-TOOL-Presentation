import { defineConfig, type Plugin } from "vite";
import { startFigmaBridge } from "./scripts/figma-bridge.ts";
import { motionDefaultsRoute } from "./scripts/motion-defaults.ts";
import { presentationProject } from "./scripts/presentation-project.ts";
import { projectsRoutes } from "./scripts/projects.ts";

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
  // projectsRoutes writes project.json, deck.json (기본값 세팅), and thumbnail.webp; presentationProject keeps the page folders;
  // motionDefaultsRoute writes presentation/motions.json (Motions 이 값을 기본값으로 설정).
  plugins: [figmaBridge(), projectsRoutes(), presentationProject(), motionDefaultsRoute()],
  base: "./",
  // The conference data and assets the Presentation reads (data/conference.json, assets/conference/…), copied from AX-DESIGN-TOOL's public build.
  publicDir: "public",
  build: {
    outDir: "dist/app",
    emptyOutDir: true,
  },
  server: {
    // The page already holds what it wrote under presentation/; a reload would drop the editor state.
    watch: {
      ignored: ["**/presentation/**"],
    },
    fs: {
      allow: ["."],
    },
  },
});
