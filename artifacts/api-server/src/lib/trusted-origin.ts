import type { Request } from "express";

// APP_ORIGIN may list several exact origins separated by commas (the local
// launcher trusts both localhost and 127.0.0.1). Without it, the shared reverse
// proxy's forwarded host and protocol give the browser's exact origin.
export function isTrustedOrigin(req: Request) {
  const origin = req.get("origin");
  if (!origin) return false;
  const host = req.get("x-forwarded-host")?.split(",")[0]?.trim() || req.get("host");
  const protocol = req.get("x-forwarded-proto")?.split(",")[0]?.trim() || req.protocol;
  const expected = process.env.APP_ORIGIN
    ? process.env.APP_ORIGIN.split(",").map((value) => value.trim()).filter(Boolean)
    : [`${protocol}://${host}`];
  return expected.includes(origin);
}
