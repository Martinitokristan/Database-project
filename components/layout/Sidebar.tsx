'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { authService } from '@/services/authService';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard, Users, GraduationCap, Building2, BookOpen,
  BookMarked, Layers, ClipboardList, Star, Megaphone,
  Home, Calendar, LogOut, ChevronDown, ChevronRight, LucideIcon,
  CalendarRange, UserCircle, ClipboardCheck,
} from 'lucide-react';

interface NavItem {
  label: string;
  href:  string;
  icon:  LucideIcon;
}

interface NavGroup {
  label:    string;
  items:    NavItem[];
  collapsible?: boolean;
}

/* ── Admin nav ── */
const adminStandalone: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
];
const adminGroups: NavGroup[] = [
  {
    label: 'People', collapsible: true,
    items: [
      { label: 'Students', href: '/students', icon: Users },
      { label: 'Faculty',  href: '/faculty',  icon: GraduationCap },
    ],
  },
  {
    label: 'Academic', collapsible: true,
    items: [
      { label: 'Departments', href: '/departments', icon: Building2 },
      { label: 'Courses',     href: '/courses',     icon: BookOpen },
      { label: 'Subjects',    href: '/subjects',    icon: BookMarked },
      { label: 'Semesters',   href: '/semesters',   icon: CalendarRange },
    ],
  },
  {
    label: 'Operations', collapsible: true,
    items: [
      { label: 'Sections',      href: '/sections',      icon: Layers },
      { label: 'Enrollments',   href: '/enrollments',   icon: ClipboardList },
      { label: 'Grades',        href: '/grades',        icon: Star },
      { label: 'Announcements', href: '/announcements', icon: Megaphone },
    ],
  },
  {
    label: 'Account', collapsible: true,
    items: [
      { label: 'Profile', href: '/profile', icon: UserCircle },
    ],
  },
];

/* ── Faculty nav ── */
const facultyGroups: NavGroup[] = [
  {
    label: '', collapsible: false,
    items: [
      { label: 'Home',          href: '/home',          icon: Home },
      { label: 'Sections',      href: '/sections',      icon: Layers },
      { label: 'Assessments',   href: '/assessments',   icon: ClipboardCheck },
      { label: 'Semesters',     href: '/semesters',     icon: CalendarRange },
      { label: 'Announcements', href: '/announcements', icon: Megaphone },
    ],
  },
  {
    label: 'Account', collapsible: false,
    items: [{ label: 'Profile', href: '/profile', icon: UserCircle }],
  },
];

/* ── Student nav ── */
const studentGroups: NavGroup[] = [
  {
    label: '', collapsible: false,
    items: [
      { label: 'Home',          href: '/home',          icon: Home },
      { label: 'Schedule',      href: '/schedule',      icon: Calendar },
      { label: 'Assessments',   href: '/assessments',   icon: ClipboardCheck },
      { label: 'Semesters',     href: '/semesters',     icon: CalendarRange },
      { label: 'Grades',        href: '/grades',        icon: Star },
      { label: 'Announcements', href: '/announcements', icon: Megaphone },
    ],
  },
  {
    label: 'Account', collapsible: false,
    items: [{ label: 'Profile', href: '/profile', icon: UserCircle }],
  },
];

interface SidebarProps {
  role: 'admin' | 'faculty' | 'student';
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
  const Icon = item.icon;
  return (
    <Link href={item.href}>
      <span className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        isActive
          ? 'bg-sidebar-primary text-sidebar-primary-foreground'
          : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
      )}>
        <Icon className="h-4 w-4 shrink-0" />
        {item.label}
        {isActive && <ChevronRight className="ml-auto h-3 w-3" />}
      </span>
    </Link>
  );
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const router   = useRouter();
  const { user } = useAuth();

  const groups     = role === 'admin' ? adminGroups : role === 'faculty' ? facultyGroups : studentGroups;
  const standalone = role === 'admin' ? adminStandalone : [];

  /* default: all groups open */
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.filter(g => g.collapsible).map(g => [g.label, true]))
  );

  function toggleGroup(label: string) {
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }));
  }

  async function handleLogout() {
    await authService.logout();
    router.push('/login');
  }

  return (
    <aside className="flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex items-center gap-2 px-6 py-5 border-b border-sidebar-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <span className="text-xs font-bold text-white">AT</span>
        </div>
        <span className="text-lg font-bold text-white">AcadTrack</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {/* Standalone items (Dashboard for admin) */}
        {standalone.map(item => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}

        {/* Groups */}
        {groups.map(group => (
          <div key={group.label || '_main'} className="mt-1">
            {/* Group header — clickable if collapsible */}
            {group.label && (
              group.collapsible ? (
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="flex w-full items-center justify-between px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/40 hover:text-sidebar-foreground/60 transition-colors"
                >
                  {group.label}
                  <ChevronDown
                    className={cn(
                      'h-3.5 w-3.5 transition-transform duration-200',
                      openGroups[group.label] ? 'rotate-0' : '-rotate-90'
                    )}
                  />
                </button>
              ) : (
                <p className="px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                  {group.label}
                </p>
              )
            )}

            {/* Items — shown if not collapsible OR if open */}
            {(!group.collapsible || openGroups[group.label]) && (
              <div className="space-y-0.5">
                {group.items.map(item => (
                  <NavLink key={item.href} item={item} pathname={pathname} />
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border px-3 py-3 space-y-2">
        <div className="flex items-center justify-between px-3 py-1">
          <div className="text-xs text-sidebar-foreground/60">
            <p className="font-medium text-sidebar-foreground truncate max-w-[130px]">
              {user?.first_name} {user?.last_name}
            </p>
            <p className="capitalize">{role}</p>
          </div>
          <ThemeToggle />
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </aside>
  );
}
