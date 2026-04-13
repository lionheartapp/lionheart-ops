---
aliases: [Design System, Aurora, Glass]
tags: [design, ui, styling]
created: 2026-04-08
---

# UI Design System

## Brand Gradient — "Aurora"

The brand gradient is called **"aurora"** (user's chosen code word). Used for tab indicators, icon accents, focus rings, and animated borders.

- **CSS**: `linear-gradient(90deg, #3B82F6 0%, #6366F1 100%)` (blue -> indigo)
- **Conic variant** (for spinning rings): `conic-gradient(from 0deg, #3B82F6, #6366F1, #8B5CF6, #6366F1, #3B82F6)`
- **Glow shadow**: `0 0 8px rgba(59,130,246,0.4), 0 0 16px rgba(99,102,241,0.2)`
- **Focus ring (light)**: `ring-blue-400/40` + `shadow-[0_0_0_3px_rgba(99,102,241,0.15)]`
- **Used in**: Tab indicators (`useAnimatedTabIndicator`), sidebar facility indicator, knowledge base animated icon, search bar focus state

> [!tip] The aurora gradient is also applied to [[Components#Illustrations (13 files)]] as SVG fills using `url(#aurora-grad)`.

## Sidebar Gradient

Background: `bg-gradient-to-b from-[#111827] to-[#1a1f3d]` (dark navy -> indigo-navy)

## Button Styles (Current Standard)

- **Primary (dark pill)**: `px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 active:scale-[0.97]`
- **Secondary (ghost pill)**: `px-5 py-2.5 rounded-full bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 active:scale-[0.97]`
- **Tertiary (text link)**: `text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg`

> [!note] All buttons use `active:scale-[0.97]` via `.ui-btn` global class — see [[Animation System#What Was Animated]].

## Glassmorphism System (Site-Wide)

**CSS utility classes** in `globals.css @layer components`:

| Class | Definition | Use For |
|-------|-----------|---------|
| `.ui-glass` | `bg-white/60 backdrop-blur-sm border border-gray-200/30 rounded-2xl shadow-sm` | Cards, sections |
| `.ui-glass-hover` | Same + `hover:shadow-md hover:bg-white/70 transition-all duration-200` | Interactive cards |
| `.ui-glass-table` | Same + `overflow-hidden` | Tables |
| `.ui-glass-overlay` | `bg-white/80 backdrop-blur-md border border-gray-200/30 shadow-heavy` | Modals, drawers, dialogs |
| `.ui-glass-dropdown` | `bg-white/80 backdrop-blur-md border border-gray-200/30 rounded-xl shadow-heavy` | Dropdowns, menus, toasts |

**Layout background**: `DashboardLayout.tsx` has fixed ambient gradient blobs (`blur-[120px]` blue/violet/amber at low opacity) behind all content.

**Gradient accent cards**: `bg-gradient-to-br from-primary-50/80 to-primary-100/80 backdrop-blur-sm border border-primary-200/30 rounded-2xl shadow-sm`

## Reusable Component Patterns

| Pattern | Classes | Notes |
|---------|---------|-------|
| Stat card | `ui-glass p-4 text-center` | With icon, value, label. Use [[Components#AnimatedCounter]] for values |
| Gradient accent card | `bg-gradient-to-br from-primary-50/80 to-primary-100/80 ...` | See gradient accent cards above |
| Section card | `ui-glass p-6` | Header row with title + "View all" link |
| Interactive card | `ui-glass-hover p-4` | Clickable cards, list items |
| Table container | `ui-glass-table` | Wrapping `<table>` |
| Modal/drawer panel | `ui-glass-overlay rounded-2xl` | See [[Components#DetailDrawer]] |
| Dropdown/menu/toast | `ui-glass-dropdown` | — |
| W/L/T badges | green-100/700, red-100/700, yellow-100/700 | Sport-specific |
| Sport color dot | `w-2.5 h-2.5 rounded-full` | `style={{ backgroundColor: sport.color }}` |
| Skeleton loading | `animate-pulse` blocks matching final layout | Grid of `rounded-2xl` divs |
| Empty state with CTA | Centered icon in `rounded-2xl bg-primary-50` | + heading + desc + action button |

## Filter Dropdowns (Current Standard)

Use `FloatingDropdown` from `@/components/ui/FloatingInput` for all filter UI — not raw `<select>`. Provides floating label, custom dropdown menu, keyboard nav. See `AssetRegisterFilters.tsx` for reference.

## Drawer Pattern

- `ui-glass-overlay` is now solid white (`bg-white border border-gray-200`)
- [[Components#DetailDrawer]] has `footer?: ReactNode` prop for sticky bottom buttons with `border-t` separator
- All ~20 consumers migrated. Use `form="formId"` for external footer buttons.

## Empty States — unDraw Illustration Plan

User approved adding unDraw illustrations to all 6 major empty states using the aurora gradient:

1. **Knowledge Base** (`KnowledgeBaseList.tsx`) — "No articles yet"
2. **Calendar** (`CalendarView.tsx`) — "No calendars yet"
3. **Maintenance Dashboard** (`MaintenanceDashboard.tsx`) — "No completed tickets"
4. **Athletics Welcome** (`AthleticsDashboard.tsx`) — "Welcome to Athletics"
5. **Campus Buildings** (`CampusTab.tsx`) — "No buildings yet"
6. **Tickets/Board** — Empty board state

> [!info] unDraw SVGs should use aurora gradient fill via `url(#aurora-grad)` with `<linearGradient id="aurora-grad">` defs block.

## UI Terminology Changes

| Old Term | New Term | Context |
|----------|----------|---------|
| "Facilities" | **"Maintenance"** | Sidebar section header |
| "Dashboard" (under Maintenance) | **"Maintenance Hub"** | Sidebar + tab label |
| "Facilities Management" | **"Maintenance"** | Page title |
| "Regulatory Compliance" | **"Compliance"** | Page title, matches sidebar tab |

> [!warning] Pages should match their sidebar tab name exactly — see [[UX Lessons]].
