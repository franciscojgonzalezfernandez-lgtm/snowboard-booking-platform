import { getTranslations } from "next-intl/server";

import { renderOgImage, stripMarkup } from "./og-template";

// Most marketing routes map the same two message keys onto the card: `eyebrow`
// → kicker, `heading` → title. This helper resolves them for a locale so each
// `opengraph-image.tsx` stays a thin shell of its Next-required exports.
export async function ogImageFromNamespace(
  locale: string,
  namespace: string,
  keys: { kickerKey?: string; titleKey?: string } = {},
) {
  const t = await getTranslations({ locale, namespace });
  return renderOgImage({
    kicker: t(keys.kickerKey ?? "eyebrow"),
    title: stripMarkup(t(keys.titleKey ?? "heading")),
  });
}
