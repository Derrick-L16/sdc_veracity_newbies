// Test process only: cloud adapter is replaced before any GCS code is imported.
export async function load(url, context, nextLoad) {
  if (!url.endsWith("/src/lib/evidence-storage.ts")) return nextLoad(url, context);
  return { format: "module", shortCircuit: true, source: `
    import { readFileSync, appendFileSync } from "node:fs";
    const fixture = JSON.parse(readFileSync(process.env.CLEANUP_FIXTURE, "utf8"));
    const bucket = { name: "test-only-private-bucket", getFiles: async ({prefix, versions}) => {
      if (!/^private\\/(case-evidence|evidence-staging)\\/$/.test(prefix) || versions !== false) throw new Error("unsafe listing");
      return [Object.keys(fixture).map(key => file(key)).filter(f => f.name.startsWith(prefix))];
    }};
    const file = key => ({ name: "private/" + key, bucket,
      getMetadata: async () => {
        if (!fixture[key]) throw Object.assign(new Error("missing"), {code:404});
        return [fixture[key]];
      },
      delete: async options => {
        if (!options.ifGenerationMatch || options.ifGenerationMatch !== fixture[key].generation) throw new Error("unsafe deletion");
        appendFileSync(process.env.CLEANUP_FIXTURE + ".deleted", JSON.stringify({key, options}) + "\\n");
      }
    });
    export const evidenceFile = file;
  ` };
}
