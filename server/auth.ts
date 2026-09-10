/**
 * Session authentication.
 *
 * Every route derives the acting user from the signed session cookie. Nothing
 * reads a user id out of the query string or request body — a client can say who
 * it *wants* to act as all it likes, and the server will ignore it.
 *
 * Passwords are hashed with `Bun.password`, which defaults to argon2id. That is
 * built into the runtime, so there is no dependency to add or keep patched.
 */
import type { Request, Response, NextFunction, RequestHandler } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import { storage } from "./storage";
import type { User } from "@shared/schema";

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

/** A request that has passed through requireAuth, so the user is known. */
export interface AuthedRequest extends Request {
  userId: number;
}

const PgStore = connectPgSimple(session);

export function sessionMiddleware(): RequestHandler {
  const secret = process.env.SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET must be set to at least 32 characters.\n" +
        "Generate one with:  openssl rand -base64 32\n" +
        "Refusing to start: without it, session cookies can be forged."
    );
  }

  return session({
    name: "sid",
    secret,
    resave: false,
    saveUninitialized: false,
    store: new PgStore({
      pool,
      tableName: "session",
      createTableIfMissing: true,
    }),
    cookie: {
      httpOnly: true,
      // "auto" marks the cookie Secure when the connection is HTTPS and leaves
      // it unmarked when it is not.
      //
      // A flat `true` in production is the stricter setting, and it fails in a
      // way that wastes an afternoon: sign-in answers 200, sets no cookie at
      // all, and the app bounces the user back to the login screen forever with
      // nothing in the logs. "auto" keeps a plain-HTTP deployment working and
      // still gets the Secure flag everywhere it matters.
      //
      // It relies on `trust proxy` (set in index.ts) to see through a TLS
      // terminator like Render's or Cloudflare's. If you are certain your
      // deployment is HTTPS-only, tighten this to `true`.
      secure: "auto",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
    },
  });
}

export async function hashPassword(plain: string): Promise<string> {
  return Bun.password.hash(plain);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await Bun.password.verify(plain, hash);
  } catch {
    // A malformed hash should read as "wrong password", not crash the request.
    return false;
  }
}

/** The shape safe to send to a client: everything except the password hash. */
export type PublicUser = Omit<User, "passwordHash">;

export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}

/**
 * Rejects the request unless a session identifies a real, unbanned user.
 * Sets `req.userId` for the handler.
 */
export const requireAuth: RequestHandler = async (req, res, next) => {
  const userId = req.session?.userId;

  if (!userId) {
    return res.status(401).json({ message: "Not signed in" });
  }

  const user = await storage.getUser(userId);

  if (!user) {
    // The account went away underneath a live session.
    req.session.destroy(() => {});
    return res.status(401).json({ message: "Not signed in" });
  }

  if (user.isBanned) {
    return res.status(403).json({ message: "This account is suspended" });
  }

  (req as AuthedRequest).userId = user.id;
  next();
};

/** requireAuth, and the user must be an admin. */
export const requireAdmin: RequestHandler = async (req, res, next) => {
  requireAuth(req, res, async (err?: unknown) => {
    if (err) return next(err);
    if (res.headersSent) return;

    const user = await storage.getUser((req as AuthedRequest).userId);
    if (!user?.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  });
};

/**
 * Reads the session without requiring it. For endpoints that behave differently
 * when signed in — the feed hides posts you have already swiped, profiles show
 * whether you follow them — but are still public.
 */
export function optionalUserId(req: Request): number | null {
  return req.session?.userId ?? null;
}

/**
 * requireAuth, and the user id in the URL must be the signed-in user.
 *
 * `requireAuth` alone only proves the caller is *someone*. Routes that carry a
 * user id in the path — a person's notifications, their unread counts, their
 * DM threads — also need to prove the caller is *that* someone, or any account
 * can read and modify any other account's private data by editing the URL.
 *
 * Pass every path parameter that must match; the caller has to be one of them.
 * A two-person DM thread uses `requireSelf("userId1", "userId2")`, which allows
 * either participant and nobody else.
 */
export function requireSelf(...params: string[]): RequestHandler {
  return (req, res, next) => {
    requireAuth(req, res, (err?: unknown) => {
      if (err) return next(err);
      if (res.headersSent) return;

      const me = (req as AuthedRequest).userId;
      const ids = params.map((p) => Number(req.params[p]));

      if (ids.some((id) => Number.isNaN(id))) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      if (!ids.includes(me)) {
        // 403, not 404: the caller is authenticated, just not entitled. Saying
        // so is not a leak — they already know the id they asked for.
        return res.status(403).json({ message: "You can only access your own data" });
      }
      next();
    });
  };
}
