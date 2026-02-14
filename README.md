# Lionheart Operations & Event Management Dashboard

A single-page prototype dashboard with a dark-mode-ready, minimalist aesthetic (Vercel-inspired). Built with React, Tailwind CSS, Lucide React, and Framer Motion.

## Features

- **Sidebar navigation**: Dashboard, Events, IT Support, Facilities
- **Smart Event Creator**: Modal with an "AI Suggest" button that generates a mock event description and suggests Facilities (tables, chairs, etc.) or IT (projector, mics) based on the event name
- **Landing page preview**: Live card/mini-site preview of the event being created
- **Ticketing & Sales Hub**: Table of recent ticket sales with a "Fundraising Mode" toggle
- **Support Queue**: Combined IT & Facilities request list with priority labels (Critical = red, Normal = yellow/amber)
- **Glassmorphism** cards and **Framer Motion** transitions between tabs

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Build

```bash
npm run build
npm run preview
```

## Stack

- React 18 + Vite
- Tailwind CSS (neutral/gray + primary indigo accent)
- Lucide React (icons)
- Framer Motion (animations)
