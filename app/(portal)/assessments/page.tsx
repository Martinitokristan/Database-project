'use client';

import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { assessmentService } from '@/services/assessmentService';
import { Assessment } from '@/types';
import { cn } from '@/lib/utils';
import {
  ClipboardList, Plus, ChevronRight, Clock, BookOpen,
  CheckCircle2, Circle, AlertCircle, Lock, PlayCircle,
} from 'lucide-react';

const statusColors: Record<string, string> = {
  Draft:     'bg-muted text-muted-foreground',
  Published: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  Closed:    'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export default function AssessmentsPage() {
  const { role, isLoading } = useAuth();
  if (isLoading) return <LoadingSpinner />;
  if (role === 'faculty' || role === 'admin') return <FacultyAssessments />;
  if (role === 'student') return <StudentAssessments />;
  return null;
}

/* ─── Faculty / Admin view ──────────────────────────────────────── */
function FacultyAssessments() {
  const [assessments, setAssessments] = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const router = useRouter();

  const load = useCallback(async () => {
    setLoading(true);
    const res = await assessmentService.list();
    if (res.success) setAssessments(res.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <PageHeader
        title="Assessments"
        description="Create and manage quizzes and exams for your sections."
        action={
          <Button onClick={() => router.push('/assessments/create')}>
            <Plus className="mr-2 h-4 w-4" /> New Assessment
          </Button>
        }
      />
      {loading ? <LoadingSpinner /> : assessments.length === 0 ? (
        <div className="text-center py-16">
          <EmptyState
            title="No assessments yet"
            description="Create your first quiz or exam for a section."
          />
          <Button className="mt-4" onClick={() => router.push('/assessments/create')}>
            <Plus className="mr-2 h-4 w-4" />Create Assessment
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {assessments.map(a => (
            <Link key={a.assessment_id} href={`/assessments/${a.assessment_id}`}>
              <Card className="hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                        a.assessment_type === 'Exam' ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-blue-100 dark:bg-blue-900/30'
                      )}>
                        <ClipboardList className={cn('h-5 w-5', a.assessment_type === 'Exam' ? 'text-orange-600 dark:text-orange-400' : 'text-blue-600 dark:text-blue-400')} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{a.title}</p>
                        <p className="text-sm text-muted-foreground">
                          <span className="font-mono">{a.subject_code}</span>
                          <span className="mx-1">·</span>
                          {a.section_name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="hidden sm:flex flex-col items-end text-xs text-muted-foreground">
                        <span>{a.question_count} question{a.question_count !== 1 ? 's' : ''}</span>
                        <span>{a.attempt_count} submission{a.attempt_count !== 1 ? 's' : ''}</span>
                      </div>
                      <Badge variant="outline" className={cn('text-xs', a.assessment_type === 'Exam' ? 'border-orange-300 text-orange-700' : 'border-blue-300 text-blue-700')}>
                        {a.assessment_type}
                      </Badge>
                      <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', statusColors[a.status])}>
                        {a.status}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Student view ──────────────────────────────────────────────── */
function StudentAssessments() {
  const [assessments, setAssessments] = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    assessmentService.list().then(res => {
      if (res.success) setAssessments(res.data ?? []);
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader title="Assessments" description="Your upcoming and available quizzes and exams." />
      {assessments.length === 0 ? (
        <EmptyState title="No assessments available" description="You have no active assessments at this time." />
      ) : (
        <div className="space-y-3">
          {assessments.map(a => {
            const inProgress  = !!a.in_progress_attempt_id;
            const attemptsDone = Number(a.attempts_taken) || 0;
            const canStart    = a.can_start === 1 || a.can_start === true;
            const canTake     = canStart && (inProgress || attemptsDone < a.max_attempts);
            const isUpcoming  = !canStart && !inProgress && attemptsDone < a.max_attempts;

            return (
              <Card key={a.assessment_id} className={cn('transition-all', canTake || isUpcoming ? 'hover:border-primary/50 hover:shadow-sm' : 'opacity-60')}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                        a.assessment_type === 'Exam' ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-blue-100 dark:bg-blue-900/30'
                      )}>
                        <ClipboardList className={cn('h-5 w-5', a.assessment_type === 'Exam' ? 'text-orange-600' : 'text-blue-600')} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{a.title}</p>
                        <div className="flex items-center gap-2 flex-wrap mt-0.5">
                          <span className="text-xs text-muted-foreground">
                            <span className="font-mono">{a.subject_code}</span> · {a.section_name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {a.question_count} items
                          </span>
                          {a.timer_minutes && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" /> {a.timer_minutes} min
                            </span>
                          )}
                        </div>
                        {a.instructor_name && (
                          <p className="text-xs text-muted-foreground mt-0.5">by {a.instructor_name}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {inProgress ? (
                        <Link href={`/assessments/${a.assessment_id}/take`}>
                          <Button size="sm" variant="default" className="gap-1.5">
                            <PlayCircle className="h-3.5 w-3.5" /> Continue
                          </Button>
                        </Link>
                      ) : attemptsDone > 0 && !canTake ? (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 text-xs">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span className="text-muted-foreground">Completed</span>
                          </div>
                          {a.latest_score !== null && a.latest_max_score !== null && (
                            <div className="flex items-center gap-1.5">
                              <div className={cn(
                                'h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold',
                                (a.latest_score / a.latest_max_score) >= 0.75 ? 'bg-green-100 text-green-700' :
                                (a.latest_score / a.latest_max_score) >= 0.50 ? 'bg-yellow-100 text-yellow-700' :
                                'bg-red-100 text-red-700'
                              )}>
                                {Math.round((a.latest_score / a.latest_max_score) * 100)}%
                              </div>
                              <span className="text-sm font-medium">{Number(a.latest_score).toFixed(1)}/{Number(a.latest_max_score).toFixed(0)}</span>
                            </div>
                          )}
                        </div>
                      ) : isUpcoming ? (
                        <div className="flex items-center gap-1 text-xs text-amber-600">
                          <Clock className="h-4 w-4" />
                          <span>{a.open_at ? `Opens ${new Date(a.open_at).toLocaleString()}` : 'Upcoming'}</span>
                        </div>
                      ) : canTake ? (
                        <Link href={`/assessments/${a.assessment_id}/take`}>
                          <Button size="sm" variant="outline" className="gap-1.5">
                            <BookOpen className="h-3.5 w-3.5" />
                            {attemptsDone > 0 ? `Retake (${attemptsDone}/${a.max_attempts})` : 'Start'}
                          </Button>
                        </Link>
                      ) : null}
                      <Badge variant="outline" className={cn('text-xs', a.assessment_type === 'Exam' ? 'border-orange-300 text-orange-700' : 'border-blue-300 text-blue-700')}>
                        {a.assessment_type}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
