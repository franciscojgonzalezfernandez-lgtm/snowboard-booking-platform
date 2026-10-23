# Marketing attribution (F-156)

How the platform records **where each booking came from** — direct traffic, a
flyer QR, a station-sticker QR, a Google/Meta ad, etc. — so you can see which
campaigns actually produce bookings and revenue.

## How it works

1. A visitor arrives on a **tagged URL** (from a QR code or an ad link).
2. The middleware reads the tag and stores it in a first-touch cookie
   (`ride_attr`, 90 days). First touch wins: if they already have the cookie, a
   later tag does **not** overwrite it.
3. When they complete a booking, the source is snapshotted onto the booking row
   (immutable afterwards).
4. You see it in **Admin → Bookings** (Source column + filter), on each
   **booking detail**, and aggregated in **Admin → Campaigns** (bookings + CHF
   per campaign).

Untagged / normal traffic is recorded as **Direct**.

## Tagged URL scheme

### Offline (flyers, stickers, posters) — short `?c=` code

Point the QR at the home page with a campaign code:

```
https://rideflumserberg.ch/?c=<code>
```

`<code>` must be one of the **known campaign codes** below (lowercase,
`a-z 0-9 -`). A code not in the list is still captured, but shows up under the
generic **Other** channel — so add the code to the map before you print it.

### Online (SEM / SEO / social) — standard UTM

Use standard UTM parameters (Google Ads and most platforms can auto-append
these):

```
https://rideflumserberg.ch/?utm_source=google&utm_medium=cpc&utm_campaign=beginners-winter26
```

Channel is derived from `utm_medium`:

| `utm_medium`                    | Channel            |
| ------------------------------- | ------------------ |
| `cpc` / `ppc` / `paid`          | Paid search (SEM)  |
| `organic`                       | Organic (SEO)      |
| `social` / `paidsocial`         | Social             |
| `referral`                      | Referral           |
| (a `gclid` present, no medium)  | Paid search (SEM)  |
| (a `fbclid` present, no medium) | Social             |
| anything else                   | Other              |

`utm_campaign` is stored as the campaign; `utm_source` / `utm_medium` are kept
raw on the booking detail.

### Telling social platforms apart

Instagram, TikTok and Facebook all map to the **Social** channel. To see them as
separate lines in **Admin → Campaigns**, tag each with its own `utm_source`:

```
?utm_source=instagram&utm_medium=social
?utm_source=tiktok&utm_medium=social
?utm_source=facebook&utm_medium=social
```

The rollup groups Social by source and shows a row per platform ("Social ·
Instagram", "Social · TikTok", …). Common spellings are folded together
(`ig`/`insta` → Instagram, `fb`/`meta` → Facebook). The bookings **list** filter
stays at the channel level (Social) — the platform split lives in the rollup and
on each booking's detail (`utm_source`).

## Known campaign codes

The source of truth is `lib/attribution/campaigns.ts` (`KNOWN_CAMPAIGNS`). To add
a campaign, add a row there, then print its QR. Current codes:

| Code                    | Channel           | Label                        |
| ----------------------- | ----------------- | ---------------------------- |
| `flyer-talstation`      | Flyer             | Flyer · Talstation           |
| `sticker-bergbahn`      | Sticker           | Sticker · Bergbahn gondola   |
| `poster-cafe`           | Flyer             | Poster · mountain café       |
| `sem-google-beginners`  | Paid search (SEM) | Google Ads · beginners       |

## Generating the QR image

Use any QR generator (e.g. your phone, a browser extension, or an online tool).
Encode the full tagged URL above. No in-app generator is provided.

## Notes

- The cookie is `httpOnly` (server-read only), `SameSite=Lax`, 90-day life, and
  is cleared once a booking is created so the next booking can attribute to a new
  campaign.
- Vercel Analytics already shows UTM traffic; this feature is the only thing that
  ties a **booking** (and its CHF revenue) to the campaign.
