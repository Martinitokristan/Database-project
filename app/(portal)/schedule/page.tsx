'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { Clock, MapPin, User } from 'lucide-react';

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'] as const;
type Day = typeof DAYS[number];

function formatTime(t: string): string {
  const [hStr, mStr] = (t ?? '').slice(0, 5).split(':');
  const h = parseInt(hStr, 10);
  const m = mStr ?? '00';
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${period}`;
}

const DAY_SHORT: Record<Day, string> = {
  Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed',
  Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun',
};

export default function SchedulePage() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    fetch('/api/student/schedule', { credentials: 'include' })
      .then(r => r.json())
      .then(r => { if (r.success) setSchedules(r.data ?? []); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;

  const byDay = DAYS.reduce((acc, day) => {
    acc[day] = schedules.filter(s => s.day_of_week === day).sort((a, b) => a.start_time.localeCompare(b.start_time));
    return acc;
  }, {} as Record<Day, any[]>);

  const activeDays = DAYS.filter(d => byDay[d].length > 0);

  if (activeDays.length === 0) {
    return (
      <div>
        <PageHeader title="My Schedule" description="Weekly class schedule for the current semester." />
        <EmptyState title="No schedule yet" description="You have no classes scheduled this semester." />
      </div>
    );
  }

  const totalClasses = schedules.length;

  return (
    <div className="space-y-4">
      <PageHeader title="My Schedule" description="Weekly class schedule for the current semester." />

      {/* Summary strip */}
      <div className="flex flex-wrap gap-2">
        {activeDays.map(day => (
          <span key={day} className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            {DAY_SHORT[day]} · {byDay[day].length} class{byDay[day].length !== 1 ? 'es' : ''}
          </span>
        ))}
        <span className="ml-auto inline-flex items-center rounded-full border px-3 py-1 text-xs text-muted-foreground">
          {totalClasses} total
        </span>
      </div>

      {/* Card grid — 1 col → 2 → 3 → 5 columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {activeDays.map(day => (
          <div key={day} className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 overflow-hidden flex flex-col">

            {/* Day header */}
            <div className="flex items-center justify-between border-b border-emerald-200 dark:border-emerald-800 bg-emerald-500 px-4 py-2.5">
              <span className="font-bold text-sm tracking-wide text-white">{day}</span>
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold text-white">
                {byDay[day].length}
              </span>
            </div>

            {/* Scrollable class list — capped at ~3.5 cards, scrolls if more */}
            <div className="divide-y divide-emerald-100 dark:divide-emerald-900 overflow-y-auto" style={{ maxHeight: '15rem' }}>
              {byDay[day].map((s: any, i: number) => (
                <div key={i} className="px-4 py-2.5">
                  {/* Time */}
                  <div className="flex items-center gap-1.5 mb-1">
                    <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-xs font-semibold tabular-nums">
                      {formatTime(s.start_time)} – {formatTime(s.end_time)}
                    </span>
                  </div>

                  {/* Subject title */}
                  <p className="text-sm font-semibold leading-snug line-clamp-2">{s.subject_title}</p>

                  {/* Code · section */}
                  <p className="text-xs font-mono text-muted-foreground mt-0.5">
                    {s.subject_code} · {s.section_name}
                  </p>

                  {/* Instructor + room */}
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 min-w-0 text-xs text-muted-foreground">
                      <User className="h-3 w-3 shrink-0" />
                      <span className="truncate">{s.instructor_first} {s.instructor_last}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      <span>{s.room}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Overflow hint when more than 3 entries */}
            {byDay[day].length > 3 && (
              <div className="border-t border-emerald-200 dark:border-emerald-800 bg-emerald-100/50 dark:bg-emerald-900/20 px-4 py-1.5 text-center text-[11px] text-emerald-600 dark:text-emerald-400">
                Scroll to see all {byDay[day].length} classes
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
