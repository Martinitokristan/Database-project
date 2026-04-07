# AcadTrack — System Flow Documentation

> Last updated: April 2026  
> Stack: Next.js 16.2.2 App Router · TypeScript · MySQL · JWT (httpOnly cookie)

---

## 1. Overview

AcadTrack is a University Management System with three user roles:

| Role | ID | Entry Page | Description |
|---|---|---|---|
| **Admin** | 1 | `/dashboard` | Full system control |
| **Faculty** | 2 | `/home` | Manage assigned sections & grades |
| **Student** | 3 | `/home` | View schedule, grades, announcements |

---

## 2. Authentication Flow

```
User visits any page
      │
      ▼
proxy.ts (runs before every request)
      │
      ├─ No token cookie?
      │      └─► Redirect → /login   (unless public path)
      │
      ├─ Has token + must_change_password = true?
      │      └─► Redirect → /change-password
      │
      ├─ Has token + visiting /login or /?
      │      └─► Redirect → role home
      │           ├─ admin   → /dashboard
      │           ├─ faculty → /home
      │           └─ student → /home
      │
      └─ Has token + valid role for path?
             └─► NextResponse.next() → page renders
```

### Login Sequence

```
POST /api/auth/login
  ├─ Validate email + password (Zod)
  ├─ Query: SELECT users JOIN roles WHERE email = ?
  ├─ bcrypt.compare(password, hash)
  ├─ jwt.sign({ user_id, role_id, role_name, must_change_password })
  ├─ Set httpOnly cookie: acadtrack_token (7 days)
  └─ Return: { success, data: { user_id, email, role_name, must_change_password } }
```

### Password Change (first login)

```
POST /api/auth/change-password
  ├─ Validate new_password (min 8 chars)
  ├─ UPDATE users SET password_hash = ?, must_change_password = FALSE
  └─ Client: refresh() → read new role → redirect to role home
```

### Session Check (AuthContext)

```
GET /api/auth/me
  ├─ Verify cookie token
  ├─ SELECT users + profiles + roles WHERE user_id = ?
  └─ Return: full user object with first_name, last_name, role_name
```

### Logout

```
POST /api/auth/logout
  └─ Clear cookie → redirect /login
```

### Public Paths (no auth required)

- `/login`
- `/apply`
- `/api/auth/*`
- `/api/applicants` (POST — submit application)
- `/api/courses` (GET — populate apply form)
- `/api/semesters` (GET — info for apply form)

---

## 3. User Roles & RBAC

### Role-Based Route Access

| Path | Admin | Faculty | Student |
|---|---|---|---|
| `/dashboard` | ✅ | ❌ | ❌ |
| `/students` | ✅ | ❌ | ❌ |
| `/faculty` | ✅ | ❌ | ❌ |
| `/departments` | ✅ | ❌ | ❌ |
| `/courses` | ✅ | ❌ | ❌ |
| `/subjects` | ✅ | ❌ | ❌ |
| `/enrollments` | ✅ | ❌ | ❌ |
| `/sections/[id]` | ✅ | ❌ | ❌ |
| `/sections` | ✅ | ✅ | ❌ |
| `/sections/[id]/grades` | ❌ | ✅ | ❌ |
| `/home` | ❌ | ✅ | ✅ |
| `/grades` | ✅ | ❌ | ✅ |
| `/announcements` | ✅ | ✅ | ✅ |
| `/schedule` | ❌ | ❌ | ✅ |

### API-Level RBAC (via `requireRole`)

Every API route that modifies data calls `requireRole(req, ['Admin'])` or `requireRole(req, ['Admin', 'Faculty'])`. The proxy.ts guards the UI; `lib/middleware.ts` guards the API.

---

## 4. Enrollment Lifecycle

This is the primary student creation flow:

```
Step 1 — Application
  Student visits /apply
  POST /api/applicants
    ├─ INSERT INTO applicants (email, course_id, status='Pending')
    └─ INSERT INTO profiles (applicant_id, first_name, ...)

Step 2 — Admin Review
  Admin visits /enrollments
  GET /api/applicants → list of pending applicants
  Admin selects a section and clicks "Enroll"

Step 3 — Enrollment Verification (transaction)
  POST /api/enrollments/verify { applicant_id, section_id }
    ├─ Verify applicant status = 'Pending'
    ├─ Verify section has capacity
    ├─ Generate student ID (e.g., 2026-1001)
    ├─ Hash default password (LastName + Year)
    ├─ INSERT INTO users (student_id, email, hash, role_id=3, must_change_password=TRUE)
    ├─ UPDATE profiles SET user_id = student_id (link profile to new user)
    ├─ UPDATE applicants SET status = 'Enrolled'
    ├─ INSERT INTO enrollments (user_id, section_id, status='Enrolled')
    └─ INSERT INTO grades (enrollment_id) — blank grade record

Step 4 — First Login
  Student logs in with default password
  Forced to /change-password
  After change: redirect to /home
```

---

## 5. Section & Grade Management

### Faculty Workflow

```
Faculty visits /sections
  GET /api/sections?instructor_id={me}
  └─ Shows only their assigned sections

Faculty clicks "Manage Grades" → /sections/[id]/grades
  GET /api/grades?section_id={id}
  └─ Shows all enrolled students with grade columns

Faculty updates grades
  PUT /api/grades/{enrollment_id}
    ├─ Verify faculty is the section instructor
    ├─ UPDATE grades (prelim_grade, midterm_grade, final_grade)
    └─ Auto-calculate remarks (Passed / Failed / Incomplete)
```

### Admin Section Workflow

```
Admin visits /sections (portal)
  POST /api/sections { section_name, subject_id, instructor_id, semester_id, capacity }

Admin visits /sections/[id] (admin detail page)
  GET  /api/sections/{id}
  GET  /api/sections/{id}/schedules
  POST /api/sections/{id}/schedules
  POST /api/sections/{id}/add-student
  DELETE /api/sections/{id}/remove-student/{user_id}
```

---

## 6. Announcements Flow

```
Type = 'General'   → Visible to all roles (or specific target_role_id)
Type = 'Section'   → Visible only to students enrolled in that section
                     and the section's instructor

Who can post:
  Admin   → General (any target_role) OR Section-specific
  Faculty → Section-specific only (for their own sections)
  Student → Read-only

API: GET /api/announcements
  ├─ Admin:   returns all announcements
  ├─ Faculty: returns General + their sections' announcements
  └─ Student: returns General + sections they're enrolled in
```

---

## 7. Dashboard Stats (Admin)

```
GET /api/dashboard/stats
  Returns:
    ├─ total_students  (COUNT users WHERE role_id = 3)
    ├─ total_faculty   (COUNT users WHERE role_id = 2)
    ├─ total_sections  (COUNT sections)
    ├─ pending_applicants (COUNT applicants WHERE status = 'Pending')
    └─ active_semester (semesters WHERE status = 'Active')

GET /api/applicants
  └─ Recent pending applicants list for dashboard
```

---

## 8. Student Portal Views

```
/home (StudentHome component)
  ├─ GET /api/student/enrollments → enrolled sections summary
  └─ Current semester info

/schedule
  GET /api/student/schedule
  └─ All schedules for student's enrolled sections, sorted by day/time

/semesters
  GET /api/semesters → list of all semesters
  └─ Click to expand → GET /api/student/semesters/{id}
      └─ Subjects enrolled that semester: subject code/title, instructor,
        schedules (day/time/room), grades (prelim/midterm/final), remarks (status)

/grades
  GET /api/student/grades
  └─ All grades across all enrolled sections

/announcements
  GET /api/announcements
  └─ General + section-specific announcements for this student
```

---

## 9. Database Schema Relationships

```
roles (1) ──────────────── (N) users
                                  │
              ┌───────────────────┤
              │                   │
           profiles            enrollments
           (user_id)          /           \
                         (user_id)   (section_id)
                                           │
                                       sections
                                      /    |    \
                              subject_id  inst. semester_id
                                  │               │
                               subjects       semesters
                                  │
                               course_id
                                  │
                               courses
                                  │
                               dept_id
                                  │
                            departments
                                  │
                         department_head_id → users

enrollments (1) ──── (1) grades
sections    (1) ──── (N) schedules
sections    (1) ──── (N) announcements (type='Section')
users       (1) ──── (N) announcements (as sender)
```

---

## 10. File Architecture

```
acadtrack/
├── proxy.ts                    # Route guard (auth + RBAC) — runs before every request
├── next.config.ts              # serverExternalPackages for mysql2/bcryptjs/jsonwebtoken
├── .env.local                  # DB, JWT, cookie, mail config
│
├── app/
│   ├── layout.tsx              # Root layout (Providers wrapper)
│   ├── page.tsx                # Redirects → /login
│   ├── providers.tsx           # ThemeProvider + AuthProvider + Toaster
│   │
│   ├── (auth)/                 # Login, change-password — centered layout, no shell
│   ├── (public)/               # Apply page — no auth required
│   │
│   ├── (admin)/                # Admin-only pages — wrapped in AdminShell
│   │   ├── layout.tsx          # AdminShell wrapper
│   │   ├── dashboard/
│   │   ├── students/
│   │   ├── faculty/
│   │   ├── departments/
│   │   ├── courses/
│   │   ├── subjects/
│   │   ├── enrollments/
│   │   └── sections/[id]/      # Section detail for admin
│   │
│   ├── (portal)/               # Shared pages — role-based shell via ShellSelector
│   │   ├── layout.tsx          # ShellSelector: AdminShell | FacultyShell | StudentShell
│   │   ├── home/               # Faculty + Student dashboard
│   │   ├── sections/           # Admin + Faculty section list
│   │   ├── sections/[id]/grades/  # Faculty grade manager
│   │   ├── grades/             # Admin + Student grade view
│   │   ├── semesters/          # Faculty + Student semester view
│   │   ├── profile/            # All roles profile page
│   │   ├── announcements/      # All roles
│   │   └── schedule/           # Student schedule
│   │
│   └── api/                    # All API routes (Next.js route handlers)
│       ├── auth/               # login, logout, me, change-password
│       ├── users/              # User listing + by ID
│       ├── faculty/            # Create faculty
│       ├── applicants/         # Applicant CRUD
│       ├── departments/        # Department CRUD
│       ├── courses/            # Course CRUD
│       ├── subjects/           # Subject CRUD
│       ├── semesters/          # Semester CRUD
│       ├── sections/           # Section CRUD + schedules + student management
│       ├── enrollments/        # List + verify (enroll applicant)
│       ├── grades/[id]/        # Get + update grade by enrollment
│       ├── announcements/      # List + create
│       ├── schedules/          # Schedule CRUD
│       ├── profile/[id]/       # User profile
│       ├── student/            # Student-specific: enrollments, schedule, grades, semesters
│       └── dashboard/stats/    # Admin stats
│
├── lib/
│   ├── auth.ts                 # signToken, verifyToken, hashPassword, generateStudentId
│   ├── db.ts                   # MySQL pool (singleton)
│   ├── middleware.ts           # requireAuth, requireRole, apiHandler, json
│   └── fetchApi.ts             # Client-side fetch wrapper (auto-redirects on 401)
│
├── services/                   # Client-side API call wrappers (use fetchApi)
│   └── [entity]Service.ts
│
├── context/
│   └── AuthContext.tsx         # User state, refresh(), setUser()
│
├── hooks/
│   └── useAuth.ts              # useContext(AuthContext) shortcut
│
├── components/
│   ├── layout/                 # AdminShell, FacultyShell, StudentShell, Sidebar, PageHeader
│   ├── shared/                 # LoadingSpinner, EmptyState, ConfirmDialog, StatusBadge, ThemeToggle
│   └── ui/                     # shadcn/ui components
│
├── types/
│   └── index.ts                # Shared TypeScript types
│
└── database/
    ├── schema.sql              # Full MySQL schema
    ├── seed-admin.ts           # Creates admin account
    ├── seed-faculty.ts         # Creates sample faculty
    ├── seed-students.ts        # Creates sample students
    ├── seed-data.ts            # Departments, courses, subjects, sections, semesters
    └── seed-enrollments.ts     # Enrollments, grades, announcements
```

---

## 11. Implemented Features (recently added)

| Feature | Location | Details |
|---|---|---|
| **Grade report PDF export** | `(admin)/sections/[id]` → Students tab | "Export PDF" button — uses `jspdf` + `jspdf-autotable`, downloads grade report with section header + full grades table |
| **Email notifications (Brevo)** | `lib/brevo.ts` + `app/api/enrollments/verify` | Sends HTML welcome email on enrollment with student ID, temp password, section/subject info. Set `BREVO_API_KEY` in `.env.local` |
| **Student/Faculty/Admin profile page** | `(portal)/profile` | View and edit personal details via `PUT /api/profile/[id]`. Accessible by all roles |
| **Semester management UI** | `(admin)/semesters` | Full CRUD for semesters. Only one Active semester at a time (auto-deactivates others) |

## 12. Suggested Future Features

| Feature | Where to Add | Notes |
|---|---|---|
| Attendance tracking | New table + API | Add `attendance` table with `date`, `status` |
| Grade appeal system | New table + API | `grade_appeals` with student request + faculty response |
| Bulk student enrollment | `(admin)/enrollments` | Add CSV import to `/api/enrollments/bulk` |
| Faculty schedule view | `(portal)/home` (FacultyHome) | `/api/sections/{id}/schedules` already works |
