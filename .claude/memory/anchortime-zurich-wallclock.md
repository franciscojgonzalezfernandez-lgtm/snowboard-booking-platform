---
name: anchortime-zurich-wallclock
description: Booking anchorTime is a naive Europe/Zurich wall-clock; convert to true UTC only at external-calendar boundaries
metadata: 
  node_type: memory
  type: project
  originSessionId: 9539c6cb-3893-453a-8f8d-fc80ebad3c0a
---

`Booking.anchorTime` ("HH:MM") is a **naive Europe/Zurich wall-clock**. The whole
app stores it via `setUtcTime(date, anchorTime)` (stamping the wall-clock into a
Date's UTC fields) and renders it raw or with `timeZone: "UTC"` — so 12:00 always
displays as 12:00. There is NO timezone conversion anywhere in normal flows.

**Why:** single Swiss ski school; all times are local. The "UTC" formatting is a
trick to keep the wall-clock stable on screen, not a real instant.

**How to apply:** when emitting an **absolute** time to an external calendar (.ics
`DTSTART`, Google Calendar API), DO NOT pass `setUtcTime(...)` directly — that
labels 12:00 as 12:00 UTC and renders an hour late (13:00 winter / 14:00 summer)
once a client applies a real timezone. Either convert with
`zurichWallClockToUtc()` (lib/booking-engine/time.ts, DST-aware) and emit as UTC,
or emit a floating-local datetime (no `Z`) + `timeZone: "Europe/Zurich"`. This
offset bug bit both the F-075 Google sync and the F-045/F-058 .ics — see commits
43f3fb6 + 419a303 on f-075-gcal-sync. Keep email-body labels on the naive value.
