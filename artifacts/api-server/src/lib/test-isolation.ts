import { lstatSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

// Never silently fall back to the demo DB or cloud evidence when a test run was requested.
export function assertTestIsolation(env: NodeJS.ProcessEnv = process.env) {
  if (!env.VERACITY_E2E && !env.VERACITY_E2E_ROOT && !env.VERACITY_E2E_TOKEN) return;
  const fail = () => { throw new Error("Unsafe E2E configuration: a fresh temporary SQLite database and local evidence directory are required."); };
  if (env.VERACITY_E2E !== "1" || env.NODE_ENV !== "development" ||
      env.VERACITY_LOCAL_DEV !== "1" || env.VERACITY_STORAGE !== "local" ||
      !env.VERACITY_E2E_ROOT || !env.VERACITY_E2E_TOKEN ||
      !env.VERACITY_DB || !env.VERACITY_LOCAL_UPLOAD_DIR) return fail();
  const root = realpathSync(env.VERACITY_E2E_ROOT);
  if (path.dirname(root) !== realpathSync(tmpdir()) ||
      !path.basename(root).startsWith("veracity-e2e-") ||
      readFileSync(path.join(root, "isolation-token"), "utf8") !== env.VERACITY_E2E_TOKEN ||
      path.resolve(env.VERACITY_DB) !== path.join(root, "test.sqlite3") ||
      path.resolve(env.VERACITY_LOCAL_UPLOAD_DIR) !== path.join(root, "evidence") ||
      present(env.VERACITY_DB) || present(env.VERACITY_LOCAL_UPLOAD_DIR)) return fail();
}

function present(filename: string) {
  try { lstatSync(filename); return true; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}
