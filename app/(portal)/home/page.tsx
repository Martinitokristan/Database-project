'use client';

import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { sectionService } from '@/services/sectionService';
import { Layers, Clock, BookOpen, Calendar, IdCard, ChevronRight, Users } from 'lucide-react';
import Link from 'next/link';

export default function HomePage() {
  const { role, user, isLoading } = useAuth();

  if (isLoading) return <LoadingSpinner />;
  if (role === 'faculty') return <FacultyHome user={user} />;
  if (role === 'student') return <StudentHome user={user} />;
  return null;
}

function FacultyHome({ user }: { user: any }) {
  const [sections, setSections]       = useState<any[]>([]);
  const [allSchedules, setAllSchedules] = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    async function load() {
      const sr = await sectionService.list();
      if (!sr.success) { setLoading(false); return; }
      const secs = sr.data ?? [];
      setSections(secs);
      const schedResults = await Promise.all(
        secs.map((s: any) => sectionService.getSchedules(s.section_id).then(r => (r.data ?? []).map((sch: any) => ({ ...sch, section: s }))))
      );
      setAllSchedules(schedResults.flat());
      setLoading(false);
    }
    load();
  }, []);

  const today    = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const todayDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const todaySchedules = allSchedules.filter((s: any) => s.day_of_week === todayDay).sort((a: any, b: any) => a.start_time.localeCompare(b.start_time));

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader title={`Welcome, ${user?.first_name ?? 'Faculty'}!`} description={today} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">My Sections</h2>
          {sections.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No sections assigned yet.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {sections.map(s => (
                <Link key={s.section_id} href={`/sections/${s.section_id}/grades`}>
                  <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                    <CardContent className="flex items-center justify-between py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10"><Layers className="h-4 w-4 text-primary" /></div>
                        <div><p className="font-semibold">{s.section_name}</p><p className="text-xs text-muted-foreground">{s.subject_code} — {s.subject_title}</p></div>
                      </div>
                      <Badge variant="outline">{s.enrolled_count}/{s.capacity} enrolled</Badge>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Today's Schedule</h2>
          {todaySchedules.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No classes today.</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {todaySchedules.map((sch: any, i: number) => (
                <Card key={i}><CardContent className="py-3">
                  <div className="flex items-start gap-2">
                    <Clock className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{sch.start_time?.slice(0,5)} – {sch.end_time?.slice(0,5)}</p>
                      <p className="text-xs text-muted-foreground">{sch.section?.section_name} · {sch.room}</p>
                    </div>
                  </div>
                </CardContent></Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StudentHome({ user }: { user: any }) {
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [semester, setSemester]       = useState<any>(null);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    async function load() {
      const [semRes, enrollRes] = await Promise.all([
        fetch('/api/semesters', { credentials: 'include' }).then(r => r.json()).catch(() => null),
        fetch('/api/student/enrollments', { credentials: 'include' }).then(r => r.json()).catch(() => null),
      ]);
      if (semRes?.success) setSemester((semRes.data ?? []).find((s: any) => s.status === 'Active'));
      if (enrollRes?.success) setEnrollments(enrollRes.data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader title={`Hello, ${user?.first_name ?? 'Student'}!`} description={today} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="md:col-span-1 border-primary/20">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10"><IdCard className="h-5 w-5 text-primary" /></div>
              <div><p className="text-xs text-muted-foreground">Student ID</p><p className="font-mono font-bold text-lg">{user?.user_id}</p></div>
            </div>
            <div className="space-y-1 text-sm">
              <p><span className="text-muted-foreground">Name: </span>{user?.first_name} {user?.last_name}</p>
              <p><span className="text-muted-foreground">Email: </span>{user?.email}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3"><Calendar className="h-4 w-4 text-primary" /><p className="font-semibold text-sm">Current Semester</p></div>
            {semester ? (
              <div>
                <p className="text-xl font-bold">{semester.term}</p>
                <p className="text-muted-foreground">{semester.school_year}</p>
                <div className="mt-2 flex gap-2">
                  <Badge variant="outline" className="text-xs text-green-600 border-green-200">Active</Badge>
                  <Badge variant="outline" className="text-xs">{new Date(semester.start_date).toLocaleDateString()} – {new Date(semester.end_date).toLocaleDateString()}</Badge>
                </div>
              </div>
            ) : <p className="text-muted-foreground text-sm">No active semester.</p>}
          </CardContent>
        </Card>
      </div>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Enrolled Sections</h2>
      {enrollments.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No enrolled sections found.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {enrollments.map((e: any) => (
            <Card key={e.enrollment_id}><CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 shrink-0"><BookOpen className="h-4 w-4 text-accent" /></div>
                <div className="min-w-0">
                  <p className="font-semibold truncate">{e.subject_title ?? e.section_name}</p>
                  <p className="text-xs font-mono text-muted-foreground">{e.subject_code}</p>
                  <p className="text-xs text-muted-foreground mt-1">{e.instructor_first} {e.instructor_last}</p>
                </div>
              </div>
            </CardContent></Card>
          ))}
        </div>
      )}
    </div>
  );
}
