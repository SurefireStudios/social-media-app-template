# Deploying

One web service and one Postgres database. Both have free tiers that are enough
to put this on a public URL and click through it.

The app builds to a single process that serves the API *and* the built client on
one port, so you do not need a separate static host, a reverse proxy, or a CORS
configuration.

## The free route

| Piece | Where | Notes |
| --- | --- | --- |
| App | [Render](https://render.com) free web service | Spins down after 15 minutes idle, ~50 s to wake |
| Database | [Neon](https://neon.tech) free Postgres | No card, and no 30-day expiry |

Render's own free Postgres expires after 30 days, which is why the database goes
to Neon. Any Postgres works — Supabase, RDS, or one you run yourself.

### Steps

1. **Create the database.** Make a Neon project and copy the connection string.
   It looks like `postgresql://user:pass@host/db?sslmode=require`.

2. **Create the service.** In Render, **New → Blueprint**, and point it at your
   fork. It reads [`render.yaml`](render.yaml) and sets everything up.

3. **Set `DATABASE_URL`** in the Render dashboard to the Neon string.

   `SESSION_SECRET` is generated for you by the blueprint — you never see it and
   do not need to. `PUBLIC_ORIGIN` can stay empty for a single-service
   deployment.

4. **Create the tables**, from your machine, against the Neon database:

   ```bash
   DATABASE_URL="<your neon connection string>" bun run db:push
   ```

5. **Optionally seed it**, so there is something to look at:

   ```bash
   DATABASE_URL="<your neon connection string>" bun run db:seed
   ```

   Without this you get empty screens, which demonstrate nothing. With it you
   get a populated feed, a ranked leaderboard, and six accounts you can sign in
   as — all sharing the password printed by the seed.

That is the whole deployment. A signed-out visitor can browse the feed,
leaderboard and profiles; signing in unlocks posting, swiping and messaging.

> **If you seeded, treat the deployment as a demo.** Six accounts share one
> password that is written in `server/seed.ts`, and one of them is an
> administrator. Drop those accounts before anyone real uses it.

## Other hosts

Nothing about the app is Render-specific. It needs a Node or Bun runtime, a port
read from `$PORT`, and `DATABASE_URL` and `SESSION_SECRET` in the environment.

```bash
bun install
bun run build          # -> dist/index.js and the client bundle
bun run dist/index.js  # honours $PORT, defaults to 5000
```

- **Fly.io** — needs a `fly.toml` and a Dockerfile, but no idle spin-down.
- **Railway** — works the same way; trial credit rather than a free tier.
- **A VPS** — run the build behind nginx or Caddy for TLS.
- **Vercel / Netlify / Cloudflare Pages** — static hosting only. The client
  would deploy, but there would be no API behind it.

Behind any proxy or platform that terminates TLS, `trust proxy` is already set
in `server/index.ts`. That is what lets the session cookie see it is on an HTTPS
connection and mark itself `Secure`.

## Uploads disappear on ephemeral hosts

Uploaded images are written to local disk, under `dist/public/uploads`. On
Render, Fly, Heroku and most managed platforms the filesystem is ephemeral:
every redeploy and every restart begins from the container image, and uploaded
images are gone.

For a demo that is usually acceptable. For anything else, move uploads to object
storage — S3, Cloudflare R2, Cloudinary or similar. There is one multer
configuration at the top of `server/routes.ts`; swapping its storage engine is
the only change needed.

A persistent disk (Render's paid tier, a Fly volume, a VPS) also works, and is
less effort if you are already paying for one.

## Before real people use it

The template gives you a sound foundation — hashed passwords, server-side
sessions, ownership checks on every route. It is not a finished product. At
minimum, work through this list:

- [ ] **Serve it over HTTPS.** The session cookie is marked `Secure` only on an
      HTTPS connection, and a session cookie over plain HTTP is readable by
      anything on the network path. The server logs a warning if it finds itself
      in production without TLS — do not ignore it.
- [ ] **Rate-limit the auth routes.** There is none. An attacker can guess
      passwords as fast as your server answers. `express-rate-limit` on
      `/api/auth/*` is a few lines and closes the biggest gap.
- [ ] **Add email verification.** Anyone can register with an address they do
      not control.
- [ ] **Add password reset.** There is currently no way to recover an account.
- [ ] **Move uploads to object storage**, per the section above.
- [ ] **Tighten upload validation.** Check file types and size limits against
      what you actually want to accept.
- [ ] **Replace the legal pages.** `PrivacyPolicy.tsx` and `TermsOfService.tsx`
      are marked placeholders, not legal documents.
- [ ] **Drop the seeded accounts**, if you seeded. They share a published
      password and one is an administrator.
- [ ] **Set up database backups.**
- [ ] **Run the smoke test** after any change to authentication:
      ```bash
      BASE_URL="https://your-app.example.com" bun run test:smoke
      ```
      Only against a database you can throw away — it writes.

## Gating a private demo

If you want it online but not open, put something in front of it:

- **Cloudflare Access** — free for up to 50 users, and requires a login before
  any request reaches the app.
- **HTTP Basic Auth middleware** in `server/index.ts`, gated on an environment
  variable. Crude, but a dozen lines.
