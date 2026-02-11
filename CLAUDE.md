# CLAUDE.md

## Project Overview

FreeTime is a collaborative class scheduling app built with Next.js. Users manage personal schedules and view group schedules with others via invite codes. Backend is Supabase (auth + PostgreSQL).

## Tech Stack

- **Framework:** Next.js 16 (App Router) with React 19
- **Language:** JavaScript/JSX (TypeScript configured but not fully adopted)
- **Styling:** Tailwind CSS 4 via PostCSS
- **Backend:** Supabase (auth, database)
- **Utilities:** date-fns, react-hot-toast

## Commands

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Project Structure

```
app/                        # Next.js App Router pages
├── page.jsx                # Root (redirects to login/dashboard)
├── layout.jsx              # Root layout
├── globals.css             # Tailwind global styles + CSS variables
├── login/page.jsx          # Auth page (Supabase Auth UI)
└── dashboard/
    ├── layout.jsx          # Dashboard layout (navbar + auth guard)
    ├── page.jsx            # Personal schedule management
    └── groups/
        ├── page.jsx        # Group listing/creation/joining
        └── [id]/page.jsx   # Group schedule view (dynamic route)
lib/
└── supabase.js             # Supabase client initialization
```

## Code Conventions

- All page components use `'use client'` directive (client-side rendering)
- Components: PascalCase. Functions/variables: camelCase
- State managed with React hooks (`useState`, `useEffect`), no centralized store
- Supabase queries done client-side with `.select()`, `.insert()`, `.delete()`, `.eq()`
- Toast notifications (`react-hot-toast`) for user feedback
- Inline Tailwind classes for all styling — no separate CSS files beyond `globals.css`
- Form visibility toggled via boolean state (`showForm`, `showCreateForm`, etc.)
- Path alias: `@/*` maps to project root

## Authentication

- Supabase Auth UI for login/signup
- Auth guard in `dashboard/layout.jsx` — redirects to `/login` if no session
- Auth state tracked via `supabase.auth.onAuthStateChange` subscription

## Environment Variables

Requires Supabase credentials (not committed):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Current Gaps

- No testing framework or test files
- No CI/CD pipeline
- No Prettier configuration
- TypeScript types not used in most files despite tsconfig
