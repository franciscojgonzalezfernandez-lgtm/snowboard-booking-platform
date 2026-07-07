// Renders one or more Schema.org nodes as a `<script type="application/ld+json">`
// (F-100). Centralises two things so no page has to get them right by hand:
//   1. `@context` injection — a single node gets it inline; an array is wrapped
//      in an `@graph` so several entities share one context block.
//   2. `<`-escaping — content is our own JSON-encoded i18n/DB strings, but a stray
//      angle bracket must never break out of the script element.

type JsonLdProps = {
  data: Record<string, unknown> | Record<string, unknown>[];
};

export function JsonLd({ data }: JsonLdProps) {
  const payload = Array.isArray(data)
    ? { "@context": "https://schema.org", "@graph": data }
    : { "@context": "https://schema.org", ...data };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(payload).replace(/</g, "\\u003c"),
      }}
    />
  );
}
