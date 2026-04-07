# AcadTrack — Architecture Rules & Development Standards

> These rules MUST be followed for every change, new feature, or bug fix.  
> They exist to keep the codebase consistent, maintainable, and conflict-free.

---

## RULE 1 — Route Group Structure

### The Three Route Groups

| Group | Purpose | Shell | Auth Required |
|---|---|---|---|
| `(auth)` | Login, change-password | Centered layout only | No |
| `(public)` | Apply page | No shell | No |
| `(admin)` | Admin-exclusive pages | AdminShell | Yes — Admin only |
| `(portal)` | Shared pages (multi-role) | ShellSelector (dynamic) | Yes — any role |

### Rules

- **NEVER** create a `(faculty)` or `(student)` route group. These were deleted to eliminate routing conflicts.
- **Admin-only pages** go in `(admin)/`. Examples: `/dashboard`, `/students`, `/faculty`, `/departments`, `/courses`, `/subjects`, `/enrollments`.
- **Shared pages** (visible to 2+ roles) go in `(portal)/`. Use role checks inside the component to render different UI per role.
- **NEVER** place the same URL path in two different route groups — this is the "parallel pages" conflict. Example: DO NOT have both `(admin)/grades/page.tsx` and `(portal)/grades/page.tsx`.
- Each route group has exactly one `layout.tsx`. Do not add nested layouts unless absolutely necessary.

### Adding a New Page — Decision Tree

```
Is this page admin-only?
  YES → Create app/(admin)/[page-name]/page.tsx
  NO  → Is it shared between 2+ roles?
          YES → Create app/(portal)/[page-name]/page.tsx
                Use: const { user } = useAuth(); if (user.role_name === 'Admin') ...
          NO  → Is it public (no login)?
                  YES → Create app/(public)/[page-name]/page.tsx
                  NO  → Is it auth-related (login/password)?
                          YES → Create app/(auth)/[page-name]/page.tsx
```

---

## RULE 2 — API Route Conventions

### File Location

All API routes live in `app/api/`. Follow REST conventions:

```
app/api/[resource]/route.ts          → GET (list), POST (create)
app/api/[resource]/[id]/route.ts     → GET (single), PUT (update), DELETE (remove)
app/api/[resource]/[action]/route.ts → Custom actions (e.g., /verify, /reject)
```

### Every API Route Must

1. **Import and use `apiHandler`** — never write a raw `async function GET(...)` without it.
2. **Use `requireRole` or `requireAuth`** for protected endpoints.
3. **Use `json()`** helper for all responses — never `return Response.json(...)` directly.
4. **Return a consistent shape**:

```typescript
// Success
return json({ success: true, data: result });
return json({ success: true, data: result, message: 'Created.' }, 201);

// Error (thrown, caught by apiHandler)
throw { status: 403, message: 'Access denied.' };
throw { status: 404, message: 'Not found.' };
```

5. **Never return raw errors** — `apiHandler` catches all throws and formats them.

### API Route Template

```typescript
import { NextRequest } from 'next/server';
import pool from '@/lib/db';
import { requireRole, apiHandler, json } from '@/lib/middleware';

export const GET = apiHandler(async (req: NextRequest) => {
  const payload = requireRole(req, ['Admin']);
  const [rows] = await pool.execute(`SELECT ...`) as any;
  return json({ success: true, data: rows });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const payload = requireRole(req, ['Admin']);
  const body = await req.json();
  // validate with Zod here
  await pool.execute(`INSERT INTO ...`, [...]);
  return json({ success: true, message: 'Created.' }, 201);
});
```

### Dynamic Route Parameters

In Next.js 16, `params` is a **Promise** — always await it:

```typescript
// app/api/sections/[id]/route.ts
export const GET = apiHandler(async (req: NextRequest, ctx: any) => {
  const { id } = await ctx.params;   // ← MUST await
  ...
});
```

### Public API Routes

Add to `publicPaths` in `proxy.ts` AND in the route itself avoid calling `requireRole`:

```typescript
// proxy.ts — add to publicPaths array
const publicPaths = ['/login', '/apply', '/api/auth', '/api/courses', ...];
```

---

## RULE 3 — Service Layer

All client-side API calls go through `services/`. Pages NEVER call `fetch()` directly.

### Service File Template

```typescript
// services/myEntityService.ts
import { fetchApi } from '@/lib/fetchApi';

export const myEntityService = {
  list:   ()        => fetchApi('/api/my-entity'),
  get:    (id: number) => fetchApi(`/api/my-entity/${id}`),
  create: (data: any)  => fetchApi('/api/my-entity', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: any) => fetchApi(`/api/my-entity/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: number) => fetchApi(`/api/my-entity/${id}`, { method: 'DELETE' }),
};
```

### Rules

- Service files are in `services/[entityName]Service.ts`.
- Use `fetchApi` from `lib/fetchApi.ts` — it auto-handles 401 redirects to `/login`.
- Services return `{ success: boolean; data?: T; message?: string }`.
- Never use `axios` — only `fetchApi`.

---

## RULE 4 — Authentication & Authorization

### In API Routes

```typescript
// Require any authenticated user
const payload = requireAuth(req);

// Require specific role(s)
const payload = requireRole(req, ['Admin']);
const payload = requireRole(req, ['Admin', 'Faculty']);

// payload contains: { user_id, role_id, role_name, must_change_password }
```

### In Page Components (client-side)

```typescript
const { user } = useAuth();  // from hooks/useAuth.ts

if (!user) return <LoadingSpinner />;
if (user.role_name === 'Admin') return <AdminView />;
if (user.role_name === 'Faculty') return <FacultyView />;
return <StudentView />;
```

### JWT & Cookies

- Token is stored as an httpOnly cookie named `acadtrack_token` (configurable via `COOKIE_NAME` env).
- Token payload: `{ user_id, role_id, role_name, must_change_password }`.
- Token expiry: 7 days (`JWT_EXPIRES_IN=7d`).
- NEVER store the token in `localStorage` or expose it to JavaScript.

---

## RULE 5 — Database Conventions

### Naming

- Table names: `snake_case` plural (e.g., `enrollments`, `announcements`).
- Primary keys: `{table_singular}_id` (e.g., `enrollment_id`, `section_id`).
- Foreign keys: follow the referenced table's PK name (e.g., `section_id` refs `sections.section_id`).
- Timestamps: every table has `created_at` and `updated_at` with `TIMESTAMP DEFAULT CURRENT_TIMESTAMP`.
- Soft deletes: use `is_active BOOLEAN DEFAULT TRUE` where needed (currently on `users`).

### Queries

- Always use **parameterized queries** — never string interpolation in SQL.
- Use `pool.execute()` for single queries.
- Use `transaction()` from `lib/db.ts` for multi-step operations (e.g., enrolling a student creates user + enrollment + grade in one transaction).
- Cast `pool.execute()` results: `const [rows] = await pool.execute(...) as any;`

### Adding a New Table

1. Add `CREATE TABLE` to `database/schema.sql`
2. Add foreign key constraints
3. Create API route in `app/api/[table-name]/route.ts`
4. Create service in `services/[entity]Service.ts`
5. If needed, create a seed script in `database/seed-[entity].ts`

---

## RULE 6 — Component Structure

### Layout Components (in `components/layout/`)

| Component | Purpose |
|---|---|
| `AdminShell` | Full layout for admin: Sidebar + main content |
| `FacultyShell` | Full layout for faculty: Sidebar + main content |
| `StudentShell` | Full layout for students: Sidebar + main content |
| `Sidebar` | Role-aware nav — auto-reads user role from `useAuth()` |
| `PageHeader` | Page title + optional action button |

### Shared Components (in `components/shared/`)

| Component | Usage |
|---|---|
| `LoadingSpinner` | While fetching data |
| `EmptyState` | When a list is empty |
| `ConfirmDialog` | Before destructive actions (delete, reject) |
| `StatusBadge` | Colored badge for status values |
| `ThemeToggle` | Dark/light mode switch |

### UI Components (in `components/ui/`)

These are **shadcn/ui** components (radix-nova style). Never modify these files directly. To add new shadcn components:

```bash
npx shadcn add [component-name]
```

### Rules

- Page components are in `app/(group)/[page]/page.tsx`.
- Reusable UI pieces go in `components/shared/` or `components/layout/`.
- Page components use `'use client'` since they use hooks and state.
- Never put business logic in layout components — layouts only wrap children.

---

## RULE 7 — Forms & Validation

Always use **react-hook-form + Zod** for forms:

```typescript
const schema = z.object({
  name:  z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email'),
});
type FormData = z.infer<typeof schema>;

const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
  resolver: zodResolver(schema),
});
```

### Rules

- Validate on BOTH client (Zod schema) and server (Zod `safeParse` in API route).
- Use `z.string()` for select inputs that return string values (even if the value is a number). Convert to number before sending to DB.
- Show field-level errors using `{errors.field && <p className="text-xs text-destructive">{errors.field.message}</p>}`.
- Use `toast.success()` / `toast.error()` from `sonner` for action feedback.

---

## RULE 8 — Styling

- Use **Tailwind v4** utility classes only.
- Tailwind config is in `app/globals.css` via `@theme {}` blocks — NOT in `tailwind.config.js`.
- Use `shadcn/ui` components for all UI elements (Card, Table, Dialog, Button, Input, etc.).
- Use `cn()` from `lib/utils.ts` to merge class names conditionally.
- Dark mode is handled by `next-themes` via `ThemeProvider` — use `dark:` variants.
- Never write inline `style={{}}` props unless absolutely necessary for dynamic values.

---

## RULE 9 — Environment Variables

All sensitive config lives in `.env.local`:

```
DB_HOST       # MySQL host
DB_PORT       # MySQL port (default 3306)
DB_NAME       # Database name (acadtrack)
DB_USER       # MySQL user
DB_PASS       # MySQL password

JWT_SECRET    # Min 32 characters — change before production
JWT_EXPIRES_IN # Token expiry (7d)
COOKIE_NAME   # Cookie name (acadtrack_token)

MAIL_HOST     # SMTP host
MAIL_PORT     # SMTP port
MAIL_USER     # SMTP user
MAIL_PASS     # SMTP password
MAIL_FROM     # From address
```

### Rules

- NEVER hardcode secrets in source code.
- NEVER commit `.env.local` to git (already in `.gitignore`).
- Access env vars server-side only (in `lib/`, `app/api/`). Never access them in `'use client'` components.
- Prefix client-safe env vars with `NEXT_PUBLIC_` only if they contain no secrets.

---

## RULE 10 — Adding a New Feature (Checklist)

When adding any new feature (e.g., "Attendance Tracking"):

```
□ 1. DB — Add table to database/schema.sql
□ 2. DB — Create seed file if needed (database/seed-[feature].ts)
□ 3. API — Create app/api/[feature]/route.ts  (GET + POST)
□ 4. API — Create app/api/[feature]/[id]/route.ts  (GET + PUT + DELETE)
□ 5. API — Add requireRole() to all protected endpoints
□ 6. Service — Create services/[feature]Service.ts using fetchApi
□ 7. Page — Decide: (admin)/, (portal)/, or (public)/
□ 8. Page — Create page.tsx with useAuth() role check if (portal)/
□ 9. Nav — Add nav item to Sidebar.tsx in the correct role's nav array
□ 10. Proxy — If any endpoints are public, add to publicPaths in proxy.ts
□ 11. Types — Add TypeScript types to types/index.ts if needed
```

---

## RULE 11 — File Naming

| Item | Convention | Example |
|---|---|---|
| Page files | `page.tsx` | `app/(admin)/students/page.tsx` |
| Layout files | `layout.tsx` | `app/(admin)/layout.tsx` |
| API routes | `route.ts` | `app/api/users/route.ts` |
| Services | `camelCase + Service.ts` | `services/userService.ts` |
| Components | `PascalCase.tsx` | `components/layout/AdminShell.tsx` |
| Lib utilities | `camelCase.ts` | `lib/auth.ts` |
| Types | `index.ts` in `types/` | `types/index.ts` |
| DB seeds | `seed-[entity].ts` | `database/seed-students.ts` |

---

## RULE 12 — What NOT To Do

- ❌ Don't create `(faculty)/` or `(student)/` route groups — they cause parallel page conflicts.
- ❌ Don't use `axios` — use `fetchApi` from `lib/fetchApi.ts`.
- ❌ Don't call `fetch()` directly in page components — use the service layer.
- ❌ Don't write raw SQL with string interpolation — always use parameterized queries.
- ❌ Don't use `tailwind.config.js` — Tailwind v4 uses `globals.css`.
- ❌ Don't modify `components/ui/` files manually — use `npx shadcn add`.
- ❌ Don't skip `apiHandler` wrapper in API routes — error handling is centralized there.
- ❌ Don't access `process.env` in client components — server only.
- ❌ Don't forget `await ctx.params` in dynamic API routes (Next.js 16 breaking change).
- ❌ Don't add `mysql2`, `bcryptjs`, or `jsonwebtoken` to client-side imports — server only.
