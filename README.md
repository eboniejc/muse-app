# Muse App

Full-stack music school management platform built for **MUSE INC** — a DJ and music production school in Ho Chi Minh City, Vietnam.

## Overview

Muse App handles end-to-end operations for a music school. Students browse and enroll in courses, schedule individual lessons, and unlock digital course materials after each session. Instructors receive Google Calendar invites automatically whenever a lesson is scheduled or updated. Admins manage enrollments, room bookings, and student progress through a central dashboard backed by a Google Sheet for lesson coordination.

## Features

- **Course & Enrollment Management** — Students browse courses by skill level, enroll, and track progress through a personalized dashboard
- **Lesson Scheduling** — Per-enrollment lesson scheduling with automated Google Calendar invites sent to the student, instructor, and admin
- **Digital Course Materials** — PDF ebooks unlock automatically after each lesson is completed
- **Practice Room Booking** — Students reserve practice rooms by the hour with live availability
- **Admin Dashboard** — Manage enrollments, users, room bookings, and course assignments
- **Google Sheets Sync** — Bidirectional sync between the app database and a Google Sheet; includes an embedded Apps Script for calendar event management
- **Magic-Link Authentication** — Passwordless email login via HMAC-signed JWT tokens; Google OAuth also supported
- **Push Notifications** — OneSignal integration for lesson reminders (24h and 1h before)
- **Bilingual UI** — Full English and Vietnamese support via i18next

## Tech Stack

**Frontend**
- React 19, React Router v6, TanStack Query v5
- Vite + TypeScript + SWC
- Radix UI (headless components), Lucide React icons
- React Hook Form + Zod validation
- Recharts, Embla Carousel, React Big Calendar
- i18next (EN/VI)

**Backend**
- Hono (lightweight Node.js web framework)
- Kysely (type-safe SQL query builder with CamelCasePlugin)
- PostgreSQL via Supabase
- jose (JWT signing/verification), bcryptjs
- superjson (type-safe serialization)

**Integrations**
- Supabase (PostgreSQL + Auth + Storage)
- Google Calendar API (Advanced Calendar Service via Apps Script)
- Google Sheets (Apps Script for lesson and room schedule sync)
- OneSignal (push notifications)
- Google OAuth 2.0 with PKCE

## Architecture

Single-repo full-stack app. Vite builds the React SPA into `dist/`, served statically by the Hono server alongside `/_api/*` API endpoints. Each endpoint is a self-contained TypeScript module with a Zod schema for request validation.

```
/
├── pages/           # React page components + CSS modules
├── components/      # Shared UI components
├── endpoints/       # API handlers — one file per route
│   ├── auth/        # Login, OAuth, magic link, session
│   ├── courses/     # Course listing and enrollment
│   ├── lessons/     # Scheduling, completion, cancellation
│   ├── rooms/       # Practice room bookings
│   ├── sheets/      # Google Sheets sync + Apps Script
│   ├── admin/       # Admin-only management endpoints
│   └── ...
├── helpers/         # DB client, auth, Supabase, integrations
├── sql/             # Database migrations
├── server.ts        # Hono server entry point
└── vite.config.ts
```

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm (`npm install -g pnpm`)
- A Supabase project with the schema from `sql/`
- Google OAuth credentials (for OAuth login)
- OneSignal account (for push notifications)

### Environment

Copy `env.example.json` to `env.json` and fill in your values:

```bash
cp env.example.json env.json
```

Generate a JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Build & Run

```bash
pnpm install
pnpm run build   # builds the React frontend into dist/
pnpm start       # starts the Hono server on port 3000
```

For development:
```bash
pnpm dev
```

## Deployment

Designed for deployment on [Railway](https://railway.app) or [Render](https://render.com).

**Build command:** `pnpm install && pnpm run build`  
**Start command:** `pnpm start`

Add all keys from `env.example.json` as environment variables in the platform dashboard. The `loadEnv.js` loader treats `env.json` as optional and falls back to `process.env` automatically, so no code changes are needed between local and production.

## Google Sheets Integration

The app includes an embedded Apps Script that syncs lesson data between the database and a Google Sheet, and pushes events to Google Calendar with student, instructor, and admin as guests.

To set up:
1. Open your Google Sheet → **Extensions → Apps Script**
2. Enable the **Google Calendar API** under Services
3. Paste the script served at `/_api/sheets/script`
4. Run `installTrigger` once, then `setup` to build the sheet tabs
5. Use the **MUSE INC Sync** menu to pull/push data and sync the calendar
