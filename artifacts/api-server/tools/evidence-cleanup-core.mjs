import { createHash } from "node:crypto";

export const keyPattern = /^(evidence-staging|case-evidence)\/[a-f0-9]{32}$/;
export const digest = (value) => createHash("sha256").update(value).digest("hex");

export function classify(key, metadata, protectedKeys, retentionDays, now) {
  if (!keyPattern.test(key)) return "outside-scope";
  if (protectedKeys[key]) return protectedKeys[key].join(",");
  const created = Date.parse(metadata.timeCreated);
  const updated = Date.parse(metadata.updated);
  if (!Number.isFinite(created) || !Number.isFinite(updated) ||
      !/^[1-9][0-9]*$/.test(String(metadata.generation)) ||
      !/^[0-9]+$/.test(String(metadata.size))) return "invalid-metadata";
  if (Math.max(created, updated) > now - retentionDays * 86400000) return "within-retention";
  return "candidate";
}

export function validatePlan(plan, scope, config, now) {
  if (plan.version !== 1 || plan.scope !== scope || plan.backupsComplete !== true ||
      typeof config.inventory !== "string" || plan.inventory !== config.inventory ||
      !config.backupsComplete || !Number.isInteger(plan.retentionDays) || plan.retentionDays < 30 ||
      config.retentionDays !== plan.retentionDays || !Array.isArray(plan.objects) ||
      !Number.isFinite(Date.parse(plan.createdAt)) ||
      Date.parse(plan.createdAt) > now || now - Date.parse(plan.createdAt) > 86400000) {
    throw new Error("Invalid, stale or incompatible plan; create a new dry-run.");
  }
  const keys = new Set();
  for (const item of plan.objects) {
    if (!keyPattern.test(item.key) || keys.has(item.key) ||
        typeof item.generation !== "string" || !/^[1-9][0-9]*$/.test(item.generation) ||
        typeof item.size !== "string" || !/^[0-9]+$/.test(item.size) ||
        !Number.isFinite(Date.parse(item.updated)) || !Number.isFinite(Date.parse(item.timeCreated)) ||
        classify(item.key, item, {}, plan.retentionDays, Date.parse(plan.createdAt)) !== "candidate") {
      throw new Error("Invalid candidate in plan.");
    }
    keys.add(item.key);
  }
}

// Recheck references, age and generation immediately before each conditional delete.
export async function applyPlan(plan, config, store, emit, now = Date.now()) {
  validatePlan(plan, store.scope, config, now);
  for (const item of plan.objects) {
    const metadata = await store.metadata(item.key);
    if (!metadata) { await emit({ key: item.key, result: "already-missing" }); continue; }
    const reason = classify(item.key, metadata, config.protected, plan.retentionDays, now);
    if (reason !== "candidate" || String(metadata.generation) !== item.generation ||
        String(metadata.size) !== item.size || metadata.updated !== item.updated ||
        metadata.timeCreated !== item.timeCreated) {
      await emit({ key: item.key, result: "skipped", reason: reason === "candidate" ? "object-changed" : reason });
      continue;
    }
    // Use the live object with a generation-match precondition, not a historical
    // generation handle. A concurrent replacement must never be deleted.
    await emit({ key: item.key, result: "delete-requested", generation: item.generation });
    await store.remove(item.key, item.generation);
    await emit({ key: item.key, result: "deleted", generation: item.generation });
  }
}
