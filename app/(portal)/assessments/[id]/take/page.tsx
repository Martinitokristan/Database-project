'use client';

import { useEffect, useState, useCallback, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { assessmentService } from '@/services/assessmentService';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  ChevronLeft, ChevronRight, Clock, AlertCircle,
  CheckCircle2, Circle, SkipForward, Send, Loader2,
} from 'lucide-react';

type QStatus = 'answered' | 'skipped' | 'untouched';

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(s) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function TakeAssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { role, user, isLoading } = useAuth();

  if (isLoading) return <LoadingSpinner />;
  if (role !== 'student') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Only students can take assessments.</p>
      </div>
    );
  }
  return <TakeUI assessmentId={Number(id)} userId={user!.user_id} />;
}

function TakeUI({ assessmentId, userId }: { assessmentId: number; userId: string }) {
  const router = useRouter();
  const [phase, setPhase]           = useState<'loading' | 'start' | 'taking' | 'review' | 'submitted'>('loading');
  const [assessment, setAssessment] = useState<any>(null);
  const [attempt, setAttempt]       = useState<any>(null);
  const [questions, setQuestions]   = useState<any[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [responses, setResponses]   = useState<Record<number, any>>({});
  const [timeLeft, setTimeLeft]     = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [startTime]                 = useState(Date.now());
  const timerRef                    = useRef<NodeJS.Timeout | null>(null);
  const autoSaveRef                 = useRef<NodeJS.Timeout | null>(null);

  const load = useCallback(async () => {
    const res = await assessmentService.getAttempt(assessmentId);
    if (!res.success) { toast.error('Failed to load assessment.'); return; }

    if (res.data) {
      const { attempt: att, questions: qs, responses: rs } = res.data;
      setAttempt(att);

      const qList = qs.map((q: any) => ({
        ...q,
        options: q.options ? (JSON.parse(q.options || '[]').filter(Boolean)) : [],
      }));
      setQuestions(qList);

      const respMap: Record<number, any> = {};
      for (const r of rs) { respMap[r.question_id] = r; }
      setResponses(respMap);

      if (att.time_spent !== null && att.started_at) {
        const elapsed  = Math.floor((Date.now() - new Date(att.started_at).getTime()) / 1000);
        const totalSec = (att.timer_minutes || 0) * 60;
        if (totalSec > 0) setTimeLeft(Math.max(0, totalSec - elapsed));
      }
      setPhase('taking');
    } else {
      const listRes = await assessmentService.list();
      const asmList = listRes.success ? listRes.data ?? [] : [];
      const found   = asmList.find((a: any) => a.assessment_id === assessmentId);
      setAssessment(found ?? { assessment_id: assessmentId });
      setPhase('start');
    }
  }, [assessmentId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (phase !== 'taking' || !attempt) return;
    const timerMins = attempt.timer_minutes ?? assessment?.timer_minutes;
    if (!timerMins) return;
    const elapsed  = Math.floor((Date.now() - new Date(attempt.started_at).getTime()) / 1000);
    const totalSec = timerMins * 60;
    setTimeLeft(Math.max(0, totalSec - elapsed));
  }, [phase, attempt, assessment]);

  useEffect(() => {
    if (timeLeft === null) return;
    if (timeLeft <= 0) { handleSubmit(true); return; }
    timerRef.current = setTimeout(() => setTimeLeft(t => (t !== null ? t - 1 : null)), 1000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [timeLeft]);

  async function handleStart() {
    const res = await assessmentService.startAttempt(assessmentId);
    if (!res.success) { toast.error(res.message || 'Could not start assessment.'); return; }
    const { attempt: att, questions: qs } = res.data;
    setAttempt(att);
    const qList = qs.map((q: any) => ({
      ...q,
      options: Array.isArray(q.options) ? q.options : (JSON.parse(q.options || '[]').filter(Boolean)),
    }));
    setQuestions(qList);
    if (att.timer_minutes) setTimeLeft(att.timer_minutes * 60);
    setPhase('taking');
  }

  function saveLocal(qid: number, val: any) {
    setResponses(r => ({ ...r, [qid]: val }));
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => {
      if (attempt) {
        assessmentService.saveResponse(assessmentId, { attempt_id: attempt.attempt_id, question_id: qid, ...val });
      }
    }, 800);
  }

  async function handleSubmit(auto = false) {
    if (!attempt) return;
    if (!auto && !confirm('Submit your assessment? You cannot change your answers after submitting.')) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setSubmitting(true);
    const respArr = Object.entries(responses).map(([qid, val]) => ({
      question_id: Number(qid),
      ...val,
    }));
    const timeSpent = Math.floor((Date.now() - startTime) / 1000);
    const res = await assessmentService.submit(assessmentId, {
      attempt_id: attempt.attempt_id,
      responses: respArr,
      time_spent: timeSpent,
    });
    setSubmitting(false);
    if (!res.success) { toast.error(res.message); return; }
    setAttempt((a: any) => ({ ...a, score: res.data.score, max_score: res.data.max_score }));
    setPhase('submitted');
  }

  function getStatus(qid: number): QStatus {
    const r = responses[qid];
    if (!r) return 'untouched';
    if (r.response_text?.trim() || r.selected_option_id || r.match_json) return 'answered';
    return 'skipped';
  }

  const answeredCount  = questions.filter(q => getStatus(q.question_id) === 'answered').length;
  const skippedCount   = questions.filter(q => getStatus(q.question_id) === 'skipped').length;
  const currentQ       = questions[currentIdx];

  /* ── Start Screen ── */
  if (phase === 'start') {
    const a = assessment;
    return (
      <div className="max-w-lg mx-auto mt-12">
        <Card>
          <CardContent className="p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className={cn('inline-flex h-14 w-14 items-center justify-center rounded-2xl mb-2',
                a?.assessment_type === 'Exam' ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-blue-100 dark:bg-blue-900/30'
              )}>
                <CheckCircle2 className={cn('h-7 w-7', a?.assessment_type === 'Exam' ? 'text-orange-600' : 'text-blue-600')} />
              </div>
              <h2 className="text-xl font-bold">{a?.title ?? 'Assessment'}</h2>
              {a?.description && <p className="text-sm text-muted-foreground">{a.description}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {a?.question_count && (
                <div className="rounded-lg bg-muted p-3 text-center">
                  <p className="text-2xl font-bold">{a.question_count}</p>
                  <p className="text-muted-foreground text-xs">Questions</p>
                </div>
              )}
              {a?.timer_minutes && (
                <div className="rounded-lg bg-muted p-3 text-center">
                  <p className="text-2xl font-bold">{a.timer_minutes}</p>
                  <p className="text-muted-foreground text-xs">Minutes</p>
                </div>
              )}
            </div>
            <div className="text-xs text-muted-foreground space-y-1 text-center">
              <p>• Questions will be shuffled uniquely for you.</p>
              <p>• You can navigate freely between questions.</p>
              {a?.timer_minutes && <p className="text-orange-600 font-medium">• Timer starts when you click Start and auto-submits.</p>}
            </div>
            <Button className="w-full" size="lg" onClick={handleStart}>
              Start Assessment
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ── Submitted Screen ── */
  if (phase === 'submitted') {
    const pct = attempt?.max_score ? Math.round(((attempt.score ?? 0) / attempt.max_score) * 100) : null;
    return (
      <div className="max-w-lg mx-auto mt-12">
        <Card>
          <CardContent className="p-8 space-y-6 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
            <div>
              <h2 className="text-xl font-bold">Assessment Submitted!</h2>
              <p className="text-muted-foreground text-sm mt-1">Your answers have been recorded and graded.</p>
            </div>
            {attempt?.score !== null && attempt?.max_score !== null && (
              <div className="rounded-xl bg-muted p-6">
                <p className="text-4xl font-bold">{Number(attempt.score).toFixed(2)}<span className="text-muted-foreground text-xl">/{Number(attempt.max_score).toFixed(0)}</span></p>
                {pct !== null && (
                  <p className={cn('text-lg font-semibold mt-1', pct >= 75 ? 'text-green-600' : pct >= 50 ? 'text-yellow-600' : 'text-red-600')}>
                    {pct}%
                  </p>
                )}
              </div>
            )}
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => router.push('/assessments')}>
                Back to Assessments
              </Button>
              <Button onClick={() => router.push(`/assessments/${assessmentId}/results`)}>
                View Results
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ── Review Screen ── */
  if (phase === 'review') {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <h2 className="text-lg font-bold">Review Before Submitting</h2>
        <div className="grid grid-cols-8 gap-2">
          {questions.map((q, i) => {
            const st = getStatus(q.question_id);
            return (
              <button
                key={q.question_id}
                onClick={() => { setCurrentIdx(i); setPhase('taking'); }}
                className={cn('h-9 w-9 rounded-lg text-xs font-medium transition-colors', {
                  'bg-primary text-primary-foreground': st === 'answered',
                  'bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200': st === 'skipped',
                  'bg-muted text-muted-foreground': st === 'untouched',
                })}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-primary inline-block" />Answered ({answeredCount})</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-yellow-300 inline-block" />Skipped ({skippedCount})</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-muted inline-block" />Untouched ({questions.length - answeredCount - skippedCount})</span>
        </div>
        {questions.length - answeredCount > 0 && (
          <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 p-3 flex items-center gap-2 text-sm text-yellow-800 dark:text-yellow-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {questions.length - answeredCount} unanswered question{questions.length - answeredCount !== 1 ? 's' : ''} will be marked as blank.
          </div>
        )}
        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={() => { setCurrentIdx(0); setPhase('taking'); }}>
            <ChevronLeft className="mr-2 h-4 w-4" /> Go Back
          </Button>
          <Button onClick={() => handleSubmit()} disabled={submitting}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Submit Assessment
          </Button>
        </div>
      </div>
    );
  }

  /* ── Taking Screen ── */
  if (phase === 'taking' && currentQ) {
    const q           = currentQ;
    const resp        = responses[q.question_id] ?? {};
    const qStatus     = getStatus(q.question_id);
    const shuffledOpts = q.options && q.options.length
      ? seededShuffle(q.options, (attempt?.attempt_id ?? 1) * q.question_id)
      : [];
    const matchOpts    = q.options ?? [];

    return (
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Header bar */}
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-medium text-muted-foreground">
            Question {currentIdx + 1} of {questions.length}
          </p>
          <div className="flex items-center gap-3">
            {timeLeft !== null && (
              <div className={cn('flex items-center gap-1.5 font-mono text-sm font-semibold px-3 py-1 rounded-full',
                timeLeft <= 60 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 animate-pulse'
                : timeLeft <= 300 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                : 'bg-muted text-muted-foreground'
              )}>
                <Clock className="h-3.5 w-3.5" />
                {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
              </div>
            )}
            <Button size="sm" variant="outline" onClick={() => setPhase('review')}>
              Review & Submit
            </Button>
          </div>
        </div>

        {/* Question navigator */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          {questions.map((q2, i) => {
            const st = getStatus(q2.question_id);
            return (
              <button
                key={q2.question_id}
                onClick={() => setCurrentIdx(i)}
                className={cn('h-7 min-w-[28px] px-1 rounded text-xs font-medium transition-colors shrink-0', {
                  'bg-primary text-primary-foreground':                                   i === currentIdx,
                  'bg-green-500 text-white':                                              i !== currentIdx && st === 'answered',
                  'bg-yellow-300 text-yellow-900 dark:bg-yellow-700 dark:text-yellow-100': i !== currentIdx && st === 'skipped',
                  'bg-muted text-muted-foreground':                                       i !== currentIdx && st === 'untouched',
                })}
              >
                {i + 1}
              </button>
            );
          })}
        </div>

        {/* Question card */}
        <Card>
          <CardContent className="p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
                    {q.question_type === 'MultipleChoice' ? 'Multiple Choice'
                      : q.question_type === 'Identification' ? 'Identification'
                      : 'Matching Type'}
                  </span>
                  <span className="text-xs text-muted-foreground">{q.points} pt{q.points !== 1 ? 's' : ''}</span>
                </div>
                <p className="text-base font-medium leading-relaxed mt-2">{q.question_text}</p>
              </div>
            </div>

            {/* Multiple Choice */}
            {q.question_type === 'MultipleChoice' && (
              <div className="space-y-2">
                {shuffledOpts.map((opt: any, i: number) => (
                  <button
                    key={opt.option_id}
                    onClick={() => saveLocal(q.question_id, { selected_option_id: opt.option_id })}
                    className={cn(
                      'w-full flex items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-all',
                      resp.selected_option_id === opt.option_id
                        ? 'border-primary bg-primary/5 font-medium'
                        : 'hover:border-muted-foreground/40 hover:bg-muted/50'
                    )}
                  >
                    <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs',
                      resp.selected_option_id === opt.option_id ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/30'
                    )}>
                      {String.fromCharCode(65 + i)}
                    </span>
                    {opt.option_text}
                  </button>
                ))}
              </div>
            )}

            {/* Identification */}
            {q.question_type === 'Identification' && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Type your answer below.</p>
                <Input
                  value={resp.response_text ?? ''}
                  onChange={e => saveLocal(q.question_id, { response_text: e.target.value })}
                  placeholder="Your answer…"
                  className="max-w-sm"
                />
              </div>
            )}

            {/* Matching */}
            {q.question_type === 'Matching' && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">Match each term to its correct answer using the dropdown.</p>
                {matchOpts.map((opt: any) => {
                  const matchData: Record<string, string> = resp.match_json ? JSON.parse(resp.match_json) : {};
                  const shuffledAnswers = seededShuffle(
                    matchOpts.map((o: any) => o.match_text).filter(Boolean),
                    (attempt?.attempt_id ?? 1) * q.question_id + opt.option_id
                  );
                  return (
                    <div key={opt.option_id} className="flex items-center gap-3">
                      <span className="min-w-[140px] text-sm font-medium">{opt.option_text}</span>
                      <span className="text-muted-foreground">→</span>
                      <select
                        value={matchData[opt.option_id] ?? ''}
                        onChange={e => {
                          const newMap = { ...matchData, [opt.option_id]: e.target.value };
                          saveLocal(q.question_id, { match_json: JSON.stringify(newMap) });
                        }}
                        className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
                      >
                        <option value="">— Select answer —</option>
                        {(shuffledAnswers as string[]).map((ans, idx) => (
                          <option key={`${ans}-${idx}`} value={ans}>{ans}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
            disabled={currentIdx === 0}
          >
            <ChevronLeft className="mr-2 h-4 w-4" /> Previous
          </Button>

          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => {
              saveLocal(q.question_id, { ...resp, _skipped: true });
              setCurrentIdx(i => Math.min(questions.length - 1, i + 1));
            }}>
              <SkipForward className="mr-1 h-4 w-4" /> Skip
            </Button>
          </div>

          {currentIdx < questions.length - 1 ? (
            <Button onClick={() => setCurrentIdx(i => i + 1)}>
              Next <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={() => setPhase('review')}>
              Review & Submit <Send className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  return <LoadingSpinner />;
}
