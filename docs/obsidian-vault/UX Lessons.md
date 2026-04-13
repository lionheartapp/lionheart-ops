---
aliases: [UX Rules, UX Patterns]
tags: [design, ux, patterns]
created: 2026-04-08
---

# UX Patterns & Lessons

## Rules (Proven Across Features)

### Never show "Select a team" empty states

When a dropdown has "All Teams" as default, SHOW all data. Blank states that require user action before showing anything are bad UX.

**Applied to:** Schedule tab (shows all-teams agenda), Roster tab (shows team directory cards)

### Team directory pattern

When viewing all teams in Roster, show card grid with sport color dot (see [[UI Design System#Reusable Component Patterns]]), team name, level, player count. Click card to drill into detail. Better than a giant merged table.

### Cross-team search

Search box works across all teams when no specific team selected. Shows results table with team name column.

### Campus filtering pattern

Always client-side: `teams.filter(t => !t.schoolId || t.schoolId === activeCampusId)`. Then derive filtered games/practices from filtered team IDs. Dashboard API also accepts `?campusId=` for server-side filtering of aggregated data.

### Show team names in multi-team views

When showing games/practices across all teams, add team name to each row so users know which team each event belongs to.

### Enable action buttons without team selection

"Add Game" / "Add Practice" buttons should always be enabled since the drawers have their own team pickers.

### Pages should match their sidebar tab name exactly

No divergence between nav label and page title. See [[UI Design System#UI Terminology Changes]] for the canonical name mappings.
