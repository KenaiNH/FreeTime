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

## Database Schema (Supabase)

All tables use UUID primary keys and `created_at` timestamps. Auth-linked columns default to `auth.uid()`.

### schedules
Personal class schedule entries.
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK, `gen_random_uuid()` |
| created_at | timestamptz | |
| user_id | uuid | FK → auth.users, default `auth.uid()` |
| class_name | text | |
| day_of_week | text | |
| start_time | time | |
| end_time | time | |
| color | text | nullable |

### groups
User-created groups with invite codes.
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| created_at | timestamptz | |
| name | text | |
| invite_code | text | unique, 6-char alphanumeric |
| created_by | uuid | nullable, default `auth.uid()` |

### group_members
Join table linking users to groups.
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| created_at | timestamptz | |
| group_id | uuid | FK → groups |
| user_id | uuid | default `auth.uid()` |
| role | text | default `'member'` |

### events
Group events with date/time and location.
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| created_at | timestamptz | |
| group_id | uuid | FK → groups |
| creator_id | uuid | default `auth.uid()` |
| title | text | |
| description | text | nullable |
| event_date | date | |
| start_time | time | |
| end_time | time | nullable |
| location | text | nullable |

### event_responses
User RSVP responses to events.
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| created_at | timestamptz | |
| event_id | uuid | FK → events |
| user_id | uuid | default `auth.uid()` |
| response | text | default `'pending'` |
| notified_at | timestamptz | nullable |
| responded_at | timestamptz | nullable |

### Key Relationships
- `schedules.user_id` → auth.users (personal schedules)
- `groups.created_by` → auth.users (group owner)
- `group_members` → joins users to groups (many-to-many)
- `events.group_id` → groups (events belong to a group)
- `event_responses.event_id` → events (RSVPs per event)

## Environment Variables

Requires Supabase credentials (not committed):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Current Gaps

- No testing framework or test files
- No CI/CD pipeline
- No Prettier configuration
- TypeScript types not used in most files despite tsconfig
