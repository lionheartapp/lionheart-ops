# Missing Skills Investigation

CLAUDE.md references three skills/MCPs that are **not currently installed** and **do not exist in the plugin marketplace or MCP registry** under those names. Here's what was found and the recommended path forward.

## What's referenced in CLAUDE.md

From the "Design & UI Standards" section:

1. **`ui-ux-pro-max`** — "for layout, accessibility, color contrast, interaction patterns, and the Pre-Delivery Checklist"
2. **`frontend-design`** — "for distinctive, production-grade interfaces that avoid generic AI aesthetics"
3. **`21st-dev-magic` MCP tools** — "for animations, transitions, and polished component patterns"

## What was searched

- The `knowledge-work-plugins` marketplace (all plugins)
- The Claude MCP registry (all connectors)
- Keyword searches for each name verbatim plus semantic variants

## Findings

None of the three exist under their referenced names. The CLAUDE.md references are phantom — likely copy-pasted from another project's config or pointing at skills that were removed.

## Installed equivalents (that you already have)

The `design` plugin is installed and covers the same ground as the three missing items:

| CLAUDE.md reference | Closest installed equivalent |
|---|---|
| `ui-ux-pro-max` → layout, accessibility, interaction patterns | `design:design-critique` + `design:accessibility-review` |
| `ui-ux-pro-max` → Pre-Delivery Checklist | `design:design-handoff` (covers handoff specs) |
| `frontend-design` → distinctive production interfaces | `design:design-system-management` |
| `21st-dev-magic` → animations/transitions/components | No installed equivalent. Closest external option: `Magic Patterns` MCP (https://mcp.magicpatterns.com/mcp) — different product, generates UI patterns from prompts. |

## Recommended actions

1. **Update CLAUDE.md** to point at the skills you actually have (the `design:*` family) rather than the phantom ones. Otherwise future sessions will try to load skills that don't exist and silently fall back to generic advice.

2. **If you specifically want 21st.dev's Magic MCP** (the tool I believe the CLAUDE.md reference was actually aiming at), it's an external MCP maintained at https://21st.dev/magic. You'd need to register it as a custom MCP server in Claude settings rather than install it as a plugin. It isn't in the registry results here, so it has to be added manually.

3. **If you want a custom "ui-ux-pro-max" checklist skill**, I can scaffold one using the `skill-creator` skill — a single SKILL.md that wraps your existing UI rules from CLAUDE.md (card style, skeleton loaders, gradient accents, cursor-pointer, etc.) into an enforceable pre-delivery check.

## Proposed CLAUDE.md patch

Replace the current block:

> 1. **Use 21st-dev-magic MCP tools** for animations, transitions, and polished component patterns
> 2. **Apply ui-ux-pro-max skill** for layout, accessibility, color contrast, interaction patterns, and the Pre-Delivery Checklist
> 3. **Apply frontend-design skill** for distinctive, production-grade interfaces that avoid generic AI aesthetics

With:

> 1. **Apply `design:design-critique`** for structured feedback on usability, hierarchy, and consistency
> 2. **Apply `design:accessibility-review`** for WCAG 2.1 AA color contrast, keyboard nav, and touch targets
> 3. **Apply `design:design-system-management`** to keep tokens and patterns consistent across the codebase
> 4. **Apply `design:ux-writing`** for microcopy, empty states, and CTAs

This keeps the intent (enforce quality at design time) but points at skills that actually exist in this environment.
