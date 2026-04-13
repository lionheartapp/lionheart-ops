---
aliases: [Animations, Framer Motion, Motion]
tags: [design, animation, framer-motion]
created: 2026-04-08
---

# Animation System (Site-Wide)

## Foundation Files

| File | Purpose |
|------|---------|
| `src/lib/animations.ts` | Shared Framer Motion variants |
| `src/components/motion/AnimatedCounter.tsx` | Animated number counter (rolls up from 0) |
| `src/components/motion/PageTransition.tsx` | Page wrapper with stagger |
| `src/components/motion/StaggerList.tsx` | Animated list with enter/exit |

See [[Components#Shared/Reusable Components]] for props on AnimatedCounter, PageTransition, and StaggerList.

## Shared Variants (`animations.ts`)

`fadeInUp`, `cardEntrance`, `listItem`, `staggerContainer`, `dropdownVariants`, `tabContent`, `toastSlideIn`, `badgePop`, `expandCollapse`, `buttonTap`

## What Was Animated

| Area | Technique | Notes |
|------|-----------|-------|
| Dashboard | Staggered card entrance | [[Components#AnimatedCounter]] for stat values, dropdown with AnimatePresence |
| Settings | CSS `animate-[fadeIn_200ms_ease-out]` | Tabs use hidden/shown pattern, not unmount |
| Athletics | Tab crossfade `AnimatePresence mode="wait"` | Dashboard stat cards with AnimatedCounter |
| Planning | Header stagger, card entrance | — |
| Sidebar | Calendar expand/collapse | Motion height animation, chevron rotation |
| Search palette | Scale+fade entrance | Backdrop blur |
| Toasts | Slide-in/out with AnimatePresence | `popLayout` mode, stack animation |
| Notification bell | Badge pop animation | Dropdown entrance |
| Confirm dialog | Scale+fade entrance | With backdrop |
| Empty states | Fade-up entrance | — |
| All buttons | `active:scale-[0.97]` | Via `.ui-btn` global class — see [[UI Design System#Button Styles (Current Standard)]] |
| Page transitions | Fade between routes | Via `DashboardLayout` pathname key |
| User dropdown | Animated entrance/exit | — |

## CSS Keyframes (globals.css)

`fadeIn`, `fadeSlideUp`, `scaleIn`

## Easing

`[0.25, 0.1, 0.25, 1]` (custom cubic-bezier) — used consistently across all Framer Motion animations.
