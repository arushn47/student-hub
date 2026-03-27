# StudentHub

An all-in-one academic productivity platform built for college students. Manage notes, tasks, exam prep, timetables, grades, budgets, and more — with AI-powered study tools and Google Workspace integration.

---

## Features

| Category | Features |
|---|---|
| **Academics** | AI Exam Prep (syllabus → quizzes, summaries), Notes (rich-text editor with AI explain/breakdown), Tasks (drag-and-drop Kanban), Assignments (group collaboration), Grades & CGPA tracking, Question Paper archive |
| **Campus Life** | Google Calendar sync, Timetable grid, Attendance tracker |
| **Productivity** | Pomodoro Focus Timer (with session stats), Reminders (API-backed with notifications), Budget tracker |
| **AI** | Study Buddy chat (Gemini 2.5 Flash), AI note explanations, syllabus analysis, quiz generation, image-to-text extraction |
| **Integrations** | Google Calendar, Google Tasks, Google Classroom import |
| **Infrastructure** | Row-Level Security on every table, DB-backed rate limiting, CSP + security headers, PWA support |

---

## Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router, React 19)
- **Language**: TypeScript
- **Database & Auth**: [Supabase](https://supabase.com/) (Postgres, Auth, RLS)
- **AI**: [Google Gemini](https://ai.google.dev/) via `@google/generative-ai`
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/), Radix Primitives
- **Editor**: [Tiptap](https://tiptap.dev/) (rich-text notes)
- **Testing**: [Vitest](https://vitest.dev/) (unit), [Playwright](https://playwright.dev/) (E2E)
- **Deployment**: [Vercel](https://vercel.com/)

---

## Local Development

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com/) project (free tier works)
- A [Google AI Studio](https://aistudio.google.com/) API key (Gemini)
- Google Cloud OAuth credentials for Calendar/Tasks/Classroom sync

### 1. Clone & install

```bash
git clone https://github.com/your-username/student-hub.git
cd student-hub
npm install
```

### 2. Environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in the values. See `.env.example` for descriptions of each variable.

### 3. Database setup

Run the schema and all migrations against your Supabase project:

1. Go to the Supabase SQL Editor.
2. Paste and run `supabase/schema.sql` to create all tables.
3. Run each file in `supabase/migrations/` in chronological order to apply incremental changes (RLS policies, rate-limit RPC, plan columns, etc.).

### 4. Start the dev server

```bash
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

---

## Testing

### Unit tests (Vitest)

```bash
npm test              # watch mode
npm run test:ci       # single run + coverage
```

### E2E tests (Playwright)

```bash
npx playwright install   # first time only
npm run test:e2e
```

### All tests

```bash
npm run test:all
```

---

## Deployment (Vercel)

1. Push the repo to GitHub.
2. Import the project in [Vercel](https://vercel.com/).
3. Add all env vars from `.env.example` in the Vercel dashboard under **Settings → Environment Variables**.
4. Deploy. Vercel auto-detects Next.js — no custom build config needed.

### Important notes

- Set `NEXT_PUBLIC_APP_URL` to your production domain (e.g., `https://studenthub.example.com`).
- Configure the Google OAuth redirect URI in the Google Cloud Console to point to `https://your-domain/auth/callback`.
- Update the Supabase Auth callback URL in the Supabase dashboard to match.

---

## Payments

Payments are **not yet enabled**. The `profiles` table includes `plan` and `subscription_status` columns to support future monetisation, but all users currently receive the free tier. Plan limits are defined in `lib/plans.ts`.

---

## Project Structure

```
app/                    # Next.js App Router pages & API routes
  api/                  # Server-side API routes (ai, google, reminders, pomodoro, etc.)
  dashboard/            # Authenticated dashboard pages
components/             # React components (UI, dashboard widgets, providers)
lib/                    # Shared utilities (Supabase clients, Gemini helpers, env, schemas, plans)
supabase/               # SQL schema & migrations
e2e/                    # Playwright E2E tests
public/                 # Static assets, PWA manifest
types/                  # Shared TypeScript types
```

---

## License

Private — not open-source.

---

Built by [Arush Nandakumar Menon](https://github.com/arushn47)
