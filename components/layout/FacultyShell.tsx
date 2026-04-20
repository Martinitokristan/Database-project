'use client';

import { Sidebar } from './Sidebar';
import { NotificationBell } from '@/components/shared/NotificationBell';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { useAuth } from '@/hooks/useAuth';
import { ThemeToggle } from '@/components/shared/ThemeToggle';

export function FacultyShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const displayName = user ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() : '';
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role="faculty" />
      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="flex items-center justify-between gap-2 border-b px-6 py-2 bg-background shrink-0">
          <span className="text-sm font-semibold text-primary tracking-wide">AcadTrack</span>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <NotificationBell />
            <div className="flex items-center gap-2 pl-1 border-l">
              <UserAvatar src={user?.avatar_url} name={displayName} role="Faculty" size={30} />
              <span className="text-sm font-medium hidden sm:block">{displayName}</span>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="p-6 md:p-8 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
