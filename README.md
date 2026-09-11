<div align="center">

# Swipe Social

**An open-source social media app template you can fork and make your own.**

A Tinder-style swipe feed, sign-up and sign-in, profiles, following, comments,
direct messages, notifications, a points leaderboard, an admin dashboard and an
ad slot — all in one repository, with no third-party accounts to create.

[![CI](https://github.com/SurefireStudios/swipe-social-template-hashr8r/actions/workflows/ci.yml/badge.svg)](https://github.com/SurefireStudios/swipe-social-template-hashr8r/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

<img src="docs/screenshots/feed.png" alt="The swipe feed" width="240" />
<img src="docs/screenshots/leaderboard.png" alt="The leaderboard" width="240" />
<img src="docs/screenshots/auth.png" alt="Sign in" width="240" />

</div>

---

## What you get

| | |
| --- | --- |
| **Accounts** | Email and password, hashed with argon2id. Server-side sessions in Postgres. |
| **Feed** | Tinder-style swipe cards — right to rate, left to skip. Cards you have already seen drop out. |
| **Profiles** | Bio, location, avatar and banner uploads, post grid, follower counts. |
| **Social** | Follow, comment, report. A points leaderboard, global or people-you-follow. |
| **Messages** | One-to-one direct messages with unread counts. |
| **Notifications** | Generated on follows, ratings, comments and messages, with unread badges. |
| **Admin** | Promote, suspend and delete users, remove posts, read reports, manage ads, broadcast announcements. |
| **Seed data** | Six accounts, ten posts, follows, comments, messages — one command, and every account is signable-into. |

It is a working application, not a scaffold. Clone it, point it at a database,
and you have something you can click through in about five minutes.

## Stack

Bun · Express 4 · PostgreSQL · Drizzle ORM · React 18 · Vite 5 · Tailwind ·
Radix UI · TanStack Query · wouter · TypeScript throughout.

One process serves the API and the built client, so a single free-tier web
service is enough to host it.

## Quickstart

You need [Bun](https://bun.sh) 1.2 or newer and a PostgreSQL database. Any
Postgres works — a local one, or a free [Neon](https://neon.tech) instance.

```bash
git clone https://github.com/SurefireStudios/swipe-social-template-hashr8r.git
cd swipe-social-template-hashr8r
bun install
cp .env.example .env
```

Fill in two values in `.env`:

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/swipe_social"
SESSION_SECRET="$(openssl rand -base64 32)"
```

`SESSION_SECRET` is not optional — the server refuses to start without at least
32 characters, because a guessable secret means forgeable sessions.

Then create the tables, add the demo content, and start it:

```bash
bun run db:push
bun run db:seed
bun run dev
```

Open <http://localhost:5000>. The seed prints six email addresses, all sharing
the password `demo1234`; the first one is an administrator. Sign in as any of
them, or register a new account.

> The seeded password is written in `server/seed.ts` in plain sight. Only ever
> seed a database you are happy to throw away.

## Making it yours

**The name.** `client/src/lib/brand.ts` holds `APP_NAME` and `APP_TAGLINE`;
the header, admin pages and in-app copy follow from there. The browser tab title
is in `client/index.html`, and the package name in `package.json`.

**The colours.** `theme.json` sets the primary colour and radius;
`tailwind.config.ts` and `client/src/index.css` hold the rest. Users can also
pick their own accent colour from the in-app theme picker.

**The subject.** The example domain is mining rigs, so posts carry
`minerModel`, `hashrate`, `algorithm`, `power`, `temperature` and `efficiency`.
If you are building something else, those are ordinary columns in
`shared/schema.ts` — rename them, change their types, run `bun run db:push`, and
follow the type errors. TypeScript will point at every place that needs
updating, which is the whole reason the schema is shared between client and
server.

**The legal pages.** `PrivacyPolicy.tsx` and `TermsOfService.tsx` are
placeholders that describe what the code actually stores. They are a starting
point, clearly marked as one, and are not legal documents. Replace them before
you launch.

## How authentication works

Worth understanding before you extend it, because everything else depends on it.

Sign-in sets one httpOnly cookie holding a signed session id. Every request is
attributed by looking up that session — **the client never tells the server who
it is**. There is no user id in a query string, no id in a request body that the
server trusts, and no token in `localStorage` for a script on the page to steal.

Four middlewares in `server/auth.ts` cover the cases:

| | |
| --- | --- |
| `requireAuth` | Signed in, and not suspended. |
| `requireAdmin` | Signed in, and an administrator. |
| `requireSelf(...params)` | Signed in, **and** the user id in the URL is theirs. A two-person DM thread uses `requireSelf("userId1", "userId2")`, which allows either participant and nobody else. |
| `optionalUserId(req)` | Reads the session without demanding one, for routes that are public but behave differently when signed in. |

`requireAuth` alone only proves the caller is *someone*. Any route with a user
id in its path needs `requireSelf` as well, or one account can read another's
private data by editing the URL.

Passwords go through `Bun.password`, which defaults to argon2id — built in, so
there is no hashing dependency to keep up to date. As a backstop, a response
middleware in `server/sanitize.ts` strips `passwordHash` from every JSON
response, so a route that hands back a raw database row cannot leak one.

To swap in OAuth, replace `client/src/pages/Auth.tsx` and the four
`/api/auth/*` routes, and set `req.session.userId` on success. Nothing else in
the app has to change — every other route only reads the session.

## Testing it

```bash
bun run dev                 # in one terminal
bun run test:smoke          # in another
```

`scripts/smoke-test.sh` makes 66 live HTTP checks against a seeded database:
that public routes stay public, that guarded routes reject the signed-out, that
a user id in a query string or a request body grants nothing, that one account
cannot read or delete another's messages and notifications, that admin routes
check the session rather than a parameter, and that no response carries a
password hash. It exits with the number of failures, so CI can use it as-is.

Run it only against a database you can throw away — it registers accounts,
creates a post, and sends an announcement to every user.

## Deploying

See **[DEPLOY.md](DEPLOY.md)** for the full walkthrough. The short version:
`render.yaml` in this repository is a working Render blueprint, and Render's
free tier plus a free Neon database will host it at no cost.

One caveat that matters everywhere: **uploaded images are written to local
disk** (`dist/public/uploads`). On any host with an ephemeral filesystem —
Render, Fly, Heroku and most others — they disappear on every redeploy and
restart. For anything beyond a demo, move uploads to object storage such as S3,
R2 or Cloudinary. `server/routes.ts` has one multer configuration; that is the
only place to change.

## Project layout

```
client/src/
  pages/          one file per screen
  components/     shared UI, including the swipe card
  hooks/useAuth   the auth context — user, login, register, logout
  lib/brand.ts    app name and tagline
server/
  index.ts        express setup, cors, sessions, static serving
  auth.ts         sessions, hashing, requireAuth / requireAdmin / requireSelf
  routes.ts       every API route
  storage.ts      every database query
  sanitize.ts     strips password hashes from responses
  seed.ts         demo content
shared/schema.ts  drizzle tables and zod schemas, used by both sides
scripts/          the smoke test
```

## Commands

| | |
| --- | --- |
| `bun run dev` | Server and client with hot reload, on port 5000. |
| `bun run build` | Build the client and bundle the server into `dist/`. |
| `bun start` | Run the production build. |
| `bun run check` | TypeScript, no emit. |
| `bun run db:push` | Apply `shared/schema.ts` to the database. |
| `bun run db:seed` | Insert demo content. Add `-- --force` to wipe first. |
| `bun run test:smoke` | The access-control smoke test. |

`PORT` overrides the port; managed hosts set it for you.

## Contributing

Issues and pull requests are welcome. `bun run check` and `bun run build` both
have to pass, and CI runs them on every pull request. If you change anything
touching authentication or route guards, please run `bun run test:smoke` and say
so in the description.

## Security

Found a vulnerability? See **[SECURITY.md](SECURITY.md)** — please report it
privately rather than opening a public issue.

This template gives you a sound starting point, not a finished security posture.
Before real people use your deployment, at minimum: serve it over HTTPS, add
rate limiting to the auth routes (there is none — an attacker can guess
passwords as fast as your server answers), add email verification and password
reset, and move uploads off local disk. See the checklist at the end of
[DEPLOY.md](DEPLOY.md).

## License

[MIT](LICENSE). Fork it, rename it, ship it, sell it — attribution in the
licence text is all that is asked.
