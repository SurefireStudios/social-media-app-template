import type { RequestHandler } from "express";

/**
 * Fields that must never reach a client, at any depth, in any response.
 */
const SECRET_FIELDS = new Set(["passwordHash", "password"]);

/**
 * Recursively removes secret fields from anything about to be serialised.
 *
 * Returns the same object when there is nothing to remove, so the common case
 * costs a walk and no allocation.
 */
function strip(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) return value;
  if (seen.has(value)) return value; // cycles: leave as-is, JSON.stringify will complain
  seen.add(value);

  if (Array.isArray(value)) {
    let changed = false;
    const out = value.map((v) => {
      const s = strip(v, seen);
      if (s !== v) changed = true;
      return s;
    });
    return changed ? out : value;
  }

  let changed = false;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_FIELDS.has(k)) {
      changed = true;
      continue;
    }
    const s = strip(v, seen);
    if (s !== v) changed = true;
    out[k] = s;
  }
  return changed ? out : value;
}

/**
 * A last line of defence against leaking password hashes.
 *
 * Most routes here hand back rows straight from the database, and those rows
 * carry `passwordHash`. Remembering to strip it at every call site is the kind
 * of discipline that holds until someone adds the fortieth route — and the
 * public leaderboard once served every user's argon2 hash to anonymous callers
 * for exactly that reason.
 *
 * So the guarantee lives here instead: nothing leaves through res.json with a
 * password field, whatever the route does. Prefer `toPublicUser` at the call
 * site for clarity; this is what catches the one you forget.
 */
export const stripSecrets: RequestHandler = (_req, res, next) => {
  const json = res.json.bind(res);
  res.json = (body: unknown) => json(strip(body));
  next();
};
