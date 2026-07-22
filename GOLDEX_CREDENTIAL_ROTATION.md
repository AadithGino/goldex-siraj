# Credential rotation required before production release

Any credentials that were ever present in a shared archive, local `.env`, or
checked-in history for this project must be treated as **compromised**.

Rotate all of the following before go-live. Do **not** commit replacements.

## Required rotations

1. MongoDB Atlas (or other) database username and password; prefer a new DB user.
2. `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` (generate new ≥32-character secrets).
3. Owner / manager / admin account passwords.
4. S3 (or compatible) access key ID and secret access key.
5. OTP provider API keys and related secrets.
6. Any cookie signing secrets or third-party API tokens used by the app.

## After rotation

1. Update deployment secrets / environment variables only (never source control).
2. Invalidate existing customer and staff sessions (new JWT secrets force re-login).
3. Confirm `.env` remains untracked (`git check-ignore -v backend/.env`).
4. Keep `.env.example` free of real credentials.
5. After packaging, confirm `npm run package:release` hygiene scan reports `.env count = 0`.

## Phase 19–20 note

Phases 19–20 did **not** rotate any credentials. Rotation remains a hard GO gate. Any prior Zip(5) or local `.env` material must still be treated as compromised.

## Do not

- Paste production secrets into chat, tickets, or this repository.
- Re-use secrets that appeared in an earlier zip/archive handoff.
