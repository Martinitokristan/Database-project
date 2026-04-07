import Link from 'next/link';
import {
  GraduationCap, Users, BookOpen, ClipboardList,
  BarChart3, Megaphone, CalendarRange, Layers,
  CheckCircle2, ArrowRight, Building2, Star,
} from 'lucide-react';

const features = [
  {
    icon: Users,
    title: 'Student & Faculty Management',
    desc: 'Maintain complete profiles, academic records, and role-based access for every member of your institution.',
  },
  {
    icon: Building2,
    title: 'Departments & Courses',
    desc: 'Organize academic programs by department, course, and subject with structured curriculum management.',
  },
  {
    icon: Layers,
    title: 'Section Enrollment',
    desc: 'Assign students to sections, manage class sizes, and track enrollment status in real time.',
  },
  {
    icon: BarChart3,
    title: 'Grade Tracking & GWA',
    desc: 'Record prelim, midterm, and final grades with automatic GWA computation and pass/fail remarks.',
  },
  {
    icon: CalendarRange,
    title: 'Semester Lifecycle',
    desc: 'Manage Active, Inactive, and Closed semesters with grade deadlines and faculty notifications.',
  },
  {
    icon: Megaphone,
    title: 'Announcements & Notifications',
    desc: 'Post section or general announcements and send real-time in-app notifications to the right audience.',
  },
];

const roles = [
  {
    role: 'Administrator',
    color: 'bg-primary',
    points: [
      'Full system control & user management',
      'Monitor all departments, courses & sections',
      'Set grade deadlines & notify faculty by email',
      'View enrollment and grade reports',
      'Manage semester status and applicant approvals',
    ],
  },
  {
    role: 'Faculty',
    color: 'bg-emerald-500',
    points: [
      'Access assigned sections and class lists',
      'Submit prelim, midterm & final grades',
      'Post announcements to specific sections',
      'Receive grade deadline notifications',
      'View semester schedules & academic calendar',
    ],
  },
  {
    role: 'Student',
    color: 'bg-violet-500',
    points: [
      'View enrolled subjects & weekly schedule',
      'Track grades and GWA per semester',
      'Receive real-time grade update notifications',
      'Browse section & faculty announcements',
      'Apply online for admission enrollment',
    ],
  },
];

const stats = [
  { value: '3', label: 'User Roles' },
  { value: '6+', label: 'Core Modules' },
  { value: '100%', label: 'Web-based' },
  { value: '24/7', label: 'Access' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* ── Navbar ── */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="text-xs font-bold text-white">AT</span>
            </div>
            <span className="text-lg font-bold">AcadTrack</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#roles"    className="hover:text-foreground transition-colors">For You</a>
            <a href="#how"      className="hover:text-foreground transition-colors">How It Works</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/apply"
              className="hidden sm:inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
            >
              Apply
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors gap-1.5"
            >
              Sign in <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="mx-auto max-w-6xl px-6 py-24 md:py-32 text-center relative z-10">
          <span className="inline-flex items-center gap-2 rounded-full border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground mb-6">
            <Star className="h-3 w-3 text-primary" />
            University Management System
          </span>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-tight mb-6">
            Academic excellence,<br className="hidden sm:block" />
            <span className="text-primary"> perfectly organized</span>
          </h1>
          <p className="max-w-2xl mx-auto text-muted-foreground text-lg leading-relaxed mb-10">
            AcadTrack unifies student records, faculty tools, enrollment, grading, and communication
            into one seamless platform — built for modern universities.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
            >
              Sign in to your account <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/apply"
              className="inline-flex items-center gap-2 rounded-lg border px-6 py-3 text-sm font-semibold hover:bg-muted transition-colors"
            >
              <GraduationCap className="h-4 w-4" />
              Apply for admission
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="border-b bg-muted/30">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {stats.map(s => (
              <div key={s.label}>
                <p className="text-3xl font-bold text-primary">{s.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight mb-3">Everything you need</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            From student admission to final grades — every academic workflow covered in one platform.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map(f => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="rounded-xl border bg-card p-6 hover:shadow-md transition-shadow">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 mb-4">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Roles ── */}
      <section id="roles" className="border-y bg-muted/20">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight mb-3">Built for every role</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Tailored dashboards and tools for administrators, faculty members, and students.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {roles.map(r => (
              <div key={r.role} className="rounded-xl border bg-card overflow-hidden">
                <div className={`${r.color} px-6 py-4`}>
                  <h3 className="font-bold text-white text-lg">{r.role}</h3>
                </div>
                <ul className="px-6 py-5 space-y-3">
                  {r.points.map(p => (
                    <li key={p} className="flex items-start gap-2.5 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="mx-auto max-w-6xl px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight mb-3">How it works</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Simple, structured, and transparent — from setup to semester completion.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { step: '01', title: 'Admin sets up',          desc: 'Create departments, courses, subjects, and open a new semester.' },
            { step: '02', title: 'Enroll students',        desc: 'Assign students to sections and confirm their enrollment status.' },
            { step: '03', title: 'Faculty teaches & grades', desc: 'Faculty submit grades per period with automatic GWA computation.' },
            { step: '04', title: 'Semester closed',        desc: 'Admin closes the semester, making final grades visible to students.' },
          ].map(s => (
            <div key={s.step} className="relative rounded-xl border bg-card p-6">
              <span className="text-4xl font-black text-primary/15 leading-none">{s.step}</span>
              <h3 className="font-semibold mt-2 mb-1.5">{s.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="border-t bg-primary text-white">
        <div className="mx-auto max-w-6xl px-6 py-16 text-center">
          <h2 className="text-3xl font-bold mb-3">Ready to get started?</h2>
          <p className="text-white/70 mb-8 max-w-md mx-auto">
            Sign in to your account or apply for student admission today.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-primary hover:bg-white/90 transition-colors"
            >
              Sign in <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/apply"
              className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
            >
              Apply for admission
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t bg-muted/20">
        <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary">
              <span className="text-[9px] font-bold text-white">AT</span>
            </div>
            <span className="font-medium text-foreground">AcadTrack</span>
            <span>· University Management System</span>
          </div>
          <p>© {new Date().getFullYear()} AcadTrack. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
