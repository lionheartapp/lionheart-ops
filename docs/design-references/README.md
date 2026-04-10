# Design References

A local copy of the [awesome-design-md](https://github.com/VoltAgent/awesome-design-md)
collection — 62 `DESIGN.md` files that describe the visual language, color palette,
typography, component patterns, and atmosphere of popular real-world products.

Each file is a dense, plain-text design brief. The format is LLM-optimized: drop
one into a conversation with a coding agent and say *"build me a page that looks
like this"* and it gets enough context to produce pixel-adjacent UI.

## How to use

- **Pick by feel, not by company.** Need a dark, ultra-minimal dashboard? Start
  with `linear.app/`, `raycast/`, or `superhuman/`. Need warm, trust-forward SaaS
  marketing? `stripe/`, `resend/`, or `sanity/`. Need editorial density? `notion/`
  or `mintlify/`.
- **Cite the file when prompting.** Example: *"Use the palette and hierarchy from
  `docs/design-references/stripe/DESIGN.md` for this pricing page."*
- **Don't wholesale copy.** The platform already has its own Aurora-based design
  system (see `CLAUDE.md`). Use these as inspiration / raw material, not as a
  replacement.

## Updating

Run `npx getdesign@latest add <brand>` from any subdirectory to pull a fresh copy.
New brands get added upstream regularly — see
[awesome-design-md](https://github.com/VoltAgent/awesome-design-md) for the
current roster.

## Index

### AI & developer tools
- `claude/` — Warm terracotta accent, editorial layout
- `cohere/` — Vibrant gradients, data-rich dashboards
- `cursor/` — Developer-focused, dark mode, code-centric
- `elevenlabs/` — Cinematic dark UI, audio waveforms
- `lovable/` — Playful, gradient-heavy, Gen-Z coded
- `minimax/` — Neon accents on bold dark
- `mistral.ai/` — French-engineered minimalism
- `ollama/` — Terminal-native, minimal chrome
- `opencode.ai/` — Developer IDE aesthetic
- `raycast/` — Dark, ultra-precise, keyboard-first
- `replicate/` — Scientific, grid-based
- `runwayml/` — Film-grain texture, creative tools
- `together.ai/` — Clean AI platform
- `voltagent/` — Technical, agent-forward
- `warp/` — Modern terminal

### SaaS & B2B
- `airtable/` — Colorful, friendly productivity
- `cal/` — Minimal scheduling
- `clay/` — Data-rich, colorful
- `clickhouse/` — Technical, data-dense
- `composio/` — API integration platform
- `hashicorp/` — Enterprise infra, dark accent
- `intercom/` — Conversational, friendly
- `linear.app/` — Dark-mode-native, precise
- `mintlify/` — Docs, editorial
- `mongodb/` — Database, green accent
- `notion/` — Editorial, utility-first
- `posthog/` — Playful analytics
- `resend/` — Minimal dev tool
- `sanity/` — Editorial CMS
- `sentry/` — Dark, monitoring
- `stripe/` — Trust-forward fintech
- `superhuman/` — Editorial email, fast
- `supabase/` — Green accent, dev platform
- `vercel/` — Minimal, editorial, dark/light

### Consumer & marketplace
- `airbnb/` — Warm, photography-first, Rausch red
- `binance/` — Crypto exchange, yellow/black
- `coinbase/` — Institutional crypto
- `kraken/` — Purple, institutional crypto
- `meta/` — Social platform
- `pinterest/` — Visual, pinboard
- `revolut/` — Modern fintech
- `spotify/` — Green accent, music
- `uber/` — Mobility, black/white
- `wise/` — Green, international money

### Design & creative
- `figma/` — Canvas-based, creative
- `framer/` — Motion-first, creative
- `miro/` — Whiteboard, collaborative
- `shopify/` — Commerce, editorial
- `webflow/` — Visual web builder
- `zapier/` — Orange accent, automation

### Hardware, automotive, lifestyle
- `apple/` — Premium, photography-led
- `bmw/` — Luxury automotive
- `ferrari/` — Performance red
- `ibm/` — Blue, corporate, Plex Sans
- `lamborghini/` — Aggressive, performance
- `nike/` — Athletic, bold
- `nvidia/` — Green, hardware
- `renault/` — European automotive
- `spacex/` — Aerospace, dark, precise
- `tesla/` — Minimal, automotive
- `x.ai/` — Dark, AI product

### Misc
- `expo/` — Mobile dev platform
