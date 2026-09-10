# Security

This template handles account credentials, private messages and user-uploaded
images. If you find a problem in it, please tell us before telling anyone else.

## Reporting

Open a private security advisory through GitHub, or contact the repository owner
directly. Please do not open a public issue for a security problem.

Include what the issue is, the steps to reproduce it, and anything needed to
demonstrate it. We will acknowledge your report and say what we intend to do
about it. If we disagree that something is a vulnerability we will explain why
rather than going quiet.

**Deployments built from this template are not ours.** If you found a problem on
someone's live site, report it to whoever runs that site. Report it here only if
the cause is in this code — in which case everyone who forked it is affected too.

## Please don't

- Access, modify or retain data belonging to another user
- Degrade the service for anyone else — no load testing, no denial of service
- Use social engineering or phishing against anyone involved

Testing against your own account on a local instance is always fine, and
`scripts/smoke-test.sh` exists for exactly that.

## What the template does do

So you know what to expect, and what a regression would look like:

- Passwords are hashed with `Bun.password` (argon2id). They are never stored or
  logged in the clear.
- Sessions live server-side in Postgres. The cookie holds a signed session id
  and nothing else, and is `httpOnly`, `SameSite=Lax`, and `Secure` on any HTTPS
  connection. Running in production over plain HTTP logs a warning.
- **Every route derives the acting user from the session** — not from a query
  parameter, not from a request body. `requireAuth` proves a caller is signed
  in; `requireSelf` proves they are the specific user named in the URL;
  `requireAdmin` proves they are an administrator.
- Routes that write take the identity from the session and overwrite whatever
  the body claimed, so a request cannot act as another user.
- A response middleware (`server/sanitize.ts`) strips `passwordHash` from all
  JSON, as a backstop against a route returning a raw database row.
- Sign-in answers "incorrect email or password" identically whether the address
  exists or not, and verifies a hash either way so the timing does not give it
  away.
- `scripts/smoke-test.sh` asserts all of the above against a running instance.

## Known gaps

These are deliberate omissions in a template, not oversights, so a report about
them is not a new finding. Every one of them is still yours to close before real
people use your deployment — see the checklist in [DEPLOY.md](DEPLOY.md).

- **No rate limiting.** Nothing slows repeated sign-in attempts, so an attacker
  can guess passwords as fast as the server answers. This is the most important
  gap on the list; `express-rate-limit` on `/api/auth/*` closes it.
- **No email verification.** Anyone can register with an address they do not
  control.
- **No password reset.** There is no recovery path for a forgotten password.
- **No CSRF tokens.** The session cookie is `SameSite=Lax`, which stops
  cross-site POSTs from ordinary navigation, and the API is JSON-only. That
  covers the common cases but is not the same as per-request tokens. Add them if
  you widen CORS or set `SameSite=None`.
- **Uploads are lightly validated** and written to local disk with no scanning.
- **Direct messages are stored in plain text.** Whoever runs the server can read
  them. There is no end-to-end encryption, and the placeholder privacy policy
  says so plainly.
- **The seed publishes a password.** Every seeded account shares `demo1234`,
  written in `server/seed.ts`, and one of them is an administrator. Fine for a
  throwaway demo database, unacceptable anywhere else.
- **The admin dashboard has no second factor.** An administrator's password is
  the only thing between an attacker and every account.

## Not in scope

- Vulnerabilities in Bun, Express, Postgres or any other dependency — report
  those upstream
- Anything on the "known gaps" list above
- Missing hardening headers with no demonstrated impact
- Reports produced entirely by an automated scanner with no working proof
