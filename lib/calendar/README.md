# Calendar token crypto (ADR-007)

The instructor's Google **refresh token** grants long-lived calendar access, so
it is encrypted at rest in `Instructor.googleRefreshToken` and never logged
(security checklist). Encryption lives in `crypto.ts`; the OAuth flow in
`google-oauth.ts` + `app/instructor/calendar/{connect,callback}`.

## `ENCRYPTION_KEY`

- A 32-byte key, **base64**-encoded. Generate:
  ```sh
  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  ```
- Set it in Vercel (Production + Preview) and in local `.env.local`.
- Without it, `isCalendarCryptoConfigured()` is `false` and the connect flow
  fails soft (`?calendar_error=not_configured`) — the rest of the app is fine.

## Stored format

`encryptToken` outputs base64 of:

```
[ iv (12 bytes) ][ GCM authTag (16 bytes) ][ ciphertext ]
```

AES-256-GCM with a random IV per encryption. The authTag makes tampering (or a
changed key) fail loudly: `decryptToken` throws.

## Key rotation

The scheme stores no key id, so rotation is a re-encrypt:

1. Add the new key as `ENCRYPTION_KEY_NEXT` (don't drop the old one yet).
2. Run a one-off: for each `Instructor` with a `googleRefreshToken`, decrypt
   with the old key and re-encrypt with the new one.
3. Promote `ENCRYPTION_KEY_NEXT` → `ENCRYPTION_KEY`, remove the old.

Simpler alternative for a single instructor: `disconnectCalendar()` + reconnect
mints a fresh refresh token under the new key — no migration script needed.

Never commit the key or print a decrypted token.
