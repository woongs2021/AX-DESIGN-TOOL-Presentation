/**
 * presentation/motions.json: the Motions defaults (이 값을 기본값으로 설정). GET /__motions-defaults reads the file,
 * POST replaces it with the checked body. Localhost dev server only.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";
import { MOTION_DEFAULTS_FILE, MOTION_DEFAULTS_ROUTE, parseMotionDefaults, type MotionDefaults } from "../src/shared/motions.ts";
import { projectsRoot } from "./presentation-project.ts";
import { loopback, readBody, send } from "./projects.ts";

function defaultsFile(): string {
  return join(projectsRoot(), MOTION_DEFAULTS_FILE);
}

function readDefaults(): MotionDefaults {
  try {
    return parseMotionDefaults(existsSync(defaultsFile()) ? (JSON.parse(readFileSync(defaultsFile(), "utf8")) as unknown) : null);
  } catch {
    return parseMotionDefaults(null);
  }
}

export function motionDefaultsRoute(): Plugin {
  return {
    name: "motion-defaults",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if ((req.url?.split("?")[0] ?? "") !== MOTION_DEFAULTS_ROUTE) {
          next();
          return;
        }
        if (!loopback(req)) {
          send(res, 403);
          return;
        }
        if (req.method === "GET") {
          send(res, 200, readDefaults());
          return;
        }
        if (req.method !== "POST") {
          send(res, 405);
          return;
        }
        try {
          const defaults = parseMotionDefaults(JSON.parse(await readBody(req)) as unknown);
          writeFileSync(defaultsFile(), `${JSON.stringify(defaults, null, 2)}\n`);
          send(res, 200, defaults);
        } catch (error) {
          send(res, error instanceof SyntaxError ? 400 : 500);
        }
      });
    },
  };
}
