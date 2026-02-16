# Link Preview Setup

## What was done

Added Open Graph and Twitter Card meta tags to enable rich link previews when the URL is shared on Twitter/X, Facebook, iMessage, Slack, Discord, LinkedIn, etc.

## Files changed

### `app/layout.tsx`

Expanded the existing `metadata` export to include:

- **`metadataBase`** — Set to `https://prism-questions.vercel.app`. This is required so that relative image paths (like `/25.png`) resolve to full absolute URLs. Without it, crawlers can't find the image.

- **`openGraph`** — Title, description, URL, site name, image, and type. This is the universal standard read by Facebook, LinkedIn, Slack, Discord, iMessage, etc.

- **`twitter`** — Card type (`summary` for square thumbnail), title, description, and image. Twitter falls back to Open Graph if these aren't present, but defining them explicitly gives control over the card format.

### `public/25.png`

Already existed. Square image used as the preview thumbnail. No changes needed.

## Why

Without these meta tags, sharing the URL on any platform shows either nothing or a generic text-only preview. With them, every platform renders a branded card with the Prism logo, title, and description.

## How it works

Next.js App Router reads the `metadata` export from `layout.tsx` and generates the corresponding `<meta>` tags in the HTML `<head>` at build time. When a platform's crawler fetches the page, it reads those tags to build the preview card.

## Validation

After deploying, verify with:

- **Twitter:** https://cards-dev.twitter.com/validator
- **Open Graph:** https://www.opengraph.xyz/
- **Facebook:** https://developers.facebook.com/tools/debug/
