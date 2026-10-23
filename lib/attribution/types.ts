import type { BookingSource } from "@prisma/client";

// F-156: the resolved marketing attribution for a visit. Produced by
// `parseAttribution` from the landing URL, carried in the first-touch
// `ride_attr` cookie, and snapshotted onto the Booking at draft creation.
//
// `channel` is always set (the parser only returns a value when it saw a
// signal). `campaign` holds the offline `?c=` code or the online `utm_campaign`.
// `utmSource`/`utmMedium` keep the raw online-ad granularity for reporting.
export type Attribution = {
  channel: BookingSource;
  campaign?: string;
  utmSource?: string;
  utmMedium?: string;
};
