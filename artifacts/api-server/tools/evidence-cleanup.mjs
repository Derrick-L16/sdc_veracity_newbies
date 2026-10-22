// Private worker: invoke backend/evidence_cleanup.py, not this file directly.
import { readFile, writeFile, open } from "node:fs/promises";
import { evidenceFile } from "../src/lib/evidence-storage.ts";
import { applyPlan, classify, digest, keyPattern } from "./evidence-cleanup-core.mjs";

async function run() {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  const config = JSON.parse(input);
  if ((process.env.VERACITY_STORAGE ?? "replit") !== "replit") {
    throw new Error("Cloud cleanup cannot be used with local evidence storage.");
  }
  if (!Number.isInteger(config.retentionDays) || config.retentionDays < 30) throw new Error("Unsafe retention.");
  const anchor = evidenceFile(`case-evidence/${"0".repeat(32)}`);
  const prefix = anchor.name.slice(0, -"case-evidence/".length - 32);
  const scope = digest(`${anchor.bucket.name}/${prefix}`);
  const store = {
    scope,
    async metadata(key) {
      try { return (await evidenceFile(key).getMetadata())[0]; }
      catch (error) { if (error.code === 404) return null; throw error; }
    },
    async remove(key, generation) {
      await evidenceFile(key).delete({ ifGenerationMatch: generation });
    },
  };
  if (config.apply) {
    const raw = await readFile(config.apply, "utf8");
    if (config.confirm !== `DELETE-EVIDENCE-${digest(raw)}`) throw new Error("Confirmation does not match plan.");
    const plan = JSON.parse(raw);
    // Exclusive durable audit log must be available BEFORE any deletion.
    const audit = await open(`${config.apply}.deletions.jsonl`, "wx", 0o600);
    try {
      await audit.writeFile(JSON.stringify({ event: "started", planHash: digest(raw), at: new Date().toISOString() }) + "\n");
      await audit.sync();
      await applyPlan(plan, config, store, async (event) => {
        const line = JSON.stringify({ ...event, at: new Date().toISOString() });
        await audit.writeFile(line + "\n");
        await audit.sync();
        console.log(line);
      });
      await audit.writeFile(JSON.stringify({ event: "completed", at: new Date().toISOString() }) + "\n");
      await audit.sync();
    } finally {
      await audit.close();
    }
    return;
  }
  const now = Date.now();
  const plan = { version: 1, scope, createdAt: new Date(now).toISOString(),
    inventory: config.inventory,
    retentionDays: config.retentionDays, backupsComplete: config.backupsComplete,
    objects: [], excluded: [] };
  for (const kind of ["evidence-staging", "case-evidence"]) {
    // Exact private prefixes only, never enumerate or clear the whole bucket.
    const [files] = await anchor.bucket.getFiles({ prefix: `${prefix}${kind}/`, versions: false });
    for (const file of files) {
      const key = file.name.slice(prefix.length);
      if (!keyPattern.test(key)) continue;
      const [metadata] = await file.getMetadata();
      const reason = classify(key, metadata, config.protected, config.retentionDays, now);
      const entry = { key, generation: String(metadata.generation), size: String(metadata.size),
        timeCreated: metadata.timeCreated, updated: metadata.updated };
      if (reason === "candidate") plan.objects.push(entry);
      else plan.excluded.push({ key, reason });
    }
  }
  plan.objects.sort((a, b) => a.key.localeCompare(b.key));
  plan.excluded.sort((a, b) => a.key.localeCompare(b.key));
  const raw = JSON.stringify(plan, null, 2) + "\n";
  await writeFile(config.report, raw, { flag: "wx", mode: 0o600 });
  console.log(raw);
  console.log(`Dry-run only: ${plan.objects.length} candidates; ${plan.excluded.length} protected/recent objects.`);
  console.log(`Confirmation for this exact plan: DELETE-EVIDENCE-${digest(raw)}`);
  if (!config.backupsComplete) console.log("Apply disabled: rerun dry-run after inventorying every retained backup and active database.");
}

run().catch(() => {
  // GCS exceptions may contain signed URLs or credentials: never echo them.
  console.error("Cleanup stopped safely. Check plan, offline state, storage access and generation preconditions. A partial deletion is possible; create a fresh dry-run before retrying.");
  process.exitCode = 1;
});
