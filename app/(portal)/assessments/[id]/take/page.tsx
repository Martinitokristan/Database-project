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
  ShieldAlert, Save, FileCheck, RefreshCw,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

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
  const [phase, setPhase] = useState<'loading' | 'start' | 'taking' | 'review' | 'submitted'>('loading');
  const [assessment, setAssessment] = useState<any>(null);
  const [attempt, setAttempt] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [responses, setResponses] = useState<Record<number, any>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [violations, setViolations] = useState(0);
  const [showViolation, setShowViolation] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [startTime] = useState(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const autoSaveRef = useRef<NodeJS.Timeout | null>(null);

  const load = useCallback(async () => {
    const res = await assessmentService.getAttempt(assessmentId);
    if (!res.success) { toast.error('Failed to load assessment.'); return; }

    if (res.data) {
      const { attempt: att, questions: qs, responses: rs } = res.data;
      setAttempt(att);

      const qList = qs.map((q: any) => ({
        ...q,
        options: Array.isArray(q.options) ? q.options : (q.options ? JSON.parse(q.options).filter(Boolean) : []),
      }));
      setQuestions(qList);

      const respMap: Record<number, any> = {};
      for (const r of rs) { respMap[r.question_id] = r; }
      setResponses(respMap);

      if (att.time_spent !== null && att.started_at) {
        const elapsed = Math.floor((Date.now() - new Date(att.started_at).getTime()) / 1000);
        const totalSec = (att.timer_minutes || 0) * 60;
        if (totalSec > 0) setTimeLeft(Math.max(0, totalSec - elapsed));
      }
      setPhase('taking');
    } else {
      const listRes = await assessmentService.list();
      const asmList = listRes.success ? listRes.data ?? [] : [];
      const found = asmList.find((a: any) => a.assessment_id === assessmentId);
      setAssessment(found ?? { assessment_id: assessmentId });
      setPhase('start');
    }
  }, [assessmentId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (phase !== 'taking' || !attempt) return;
    const timerMins = attempt.timer_minutes ?? assessment?.timer_minutes;
    if (!timerMins) return;
    const elapsed = Math.floor((Date.now() - new Date(attempt.started_at).getTime()) / 1000);
    const totalSec = timerMins * 60;
    setTimeLeft(Math.max(0, totalSec - elapsed));
  }, [phase, attempt, assessment]);

  useEffect(() => {
    if (timeLeft === null) return;
    if (timeLeft <= 0) { handleSubmit(true); return; }
    timerRef.current = setTimeout(() => setTimeLeft(t => (t !== null ? t - 1 : null)), 1000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [timeLeft]);

  /* ── Cheating Prevention Logic ── */
  useEffect(() => {
    if (phase !== 'taking') return;

    const handleViolation = () => {
      setViolations(v => {
        const next = v + 1;
        if (next >= 3) {
          toast.error('Multiple security violations detected. Auto-submitting assessment.', { duration: 5000 });
          handleSubmit(true);
        } else {
          setShowViolation(true);
        }
        return next;
      });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') handleViolation();
    };

    const onBlur = () => handleViolation();

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      return (e.returnValue = 'Are you sure you want to leave? Your progress may not be fully saved.');
    };

    window.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onBlur);
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      window.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [phase]);

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
    setSaveStatus('saving');
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(async () => {
      if (attempt) {
        try {
          const res = await assessmentService.saveResponse(assessmentId, { attempt_id: attempt.attempt_id, question_id: qid, ...val });
          if (res.success) setSaveStatus('saved');
          else setSaveStatus('error');
        } catch {
          setSaveStatus('error');
        }
      }
    }, 800);
  }

  async function doSubmit() {
    if (!attempt) return;
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

  async function handleSubmit(auto = false) {
    if (!attempt) return;
    if (auto) {
      await doSubmit();
    } else {
      setShowSubmitConfirm(true);
    }
  }

  function getStatus(qid: number): QStatus {
    const r = responses[qid];
    if (!r) return 'untouched';
    if (r.response_text?.trim() || r.selected_option_id || r.match_json) return 'answered';
    return 'skipped';
  }

  const answeredCount = questions.filter(q => getStatus(q.question_id) === 'answered').length;
  const skippedCount = questions.filter(q => getStatus(q.question_id) === 'skipped').length;
  const currentQ = questions[currentIdx];

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
      <div className="max-w-3xl mx-auto mt-8">
        <Card className="border-muted shadow-sm">
          <CardContent className="p-8 space-y-6">
            <div className="flex items-center gap-4 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                <FileCheck className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Review Before Submitting</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Please review your answers before final submission.</p>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-6 flex flex-col gap-6">
              <div className="grid grid-cols-10 gap-3">
                {questions.map((q, i) => {
                  const st = getStatus(q.question_id);
                  return (
                    <button
                      key={q.question_id}
                      onClick={() => { setCurrentIdx(i); setPhase('taking'); }}
                      className={cn('h-10 w-10 flex items-center justify-center rounded-lg text-sm font-semibold transition-colors hover:opacity-80 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2', {
                        'bg-primary text-primary-foreground shadow-sm': st === 'answered',
                        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400': st === 'skipped',
                        'bg-muted text-muted-foreground hover:border-border border border-transparent': st === 'untouched',
                      })}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-6 text-sm font-medium pt-2 border-t mt-2 text-muted-foreground/80">
                <span className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded bg-primary shadow-sm" />Answered: <strong className="text-foreground">{answeredCount}</strong></span>
                <span className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded bg-yellow-400 dark:bg-yellow-600" />Skipped: <strong className="text-foreground">{skippedCount}</strong></span>
                <span className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded bg-muted border border-border" />Untouched: <strong className="text-foreground">{questions.length - answeredCount - skippedCount}</strong></span>
              </div>
            </div>

            {questions.length - answeredCount > 0 && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/50 p-4 flex items-start gap-3 mt-4 text-amber-900 dark:text-amber-200">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <span className="font-bold">Warning:</span> {questions.length - answeredCount} unanswered question{(questions.length - answeredCount) !== 1 ? 's' : ''}. Unanswered questions will receive 0 points.
                </div>
              </div>
            )}

            <div className="flex gap-4 pt-6 mt-4 border-t items-center justify-between">
              <Button size="lg" variant="outline" onClick={() => { setCurrentIdx(0); setPhase('taking'); }}>
                <ChevronLeft className="mr-2 h-4 w-4" /> Return to Assessment
              </Button>
              <Button size="lg" onClick={() => handleSubmit(false)} disabled={submitting} className="min-w-[200px]">
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Submit Assessment
              </Button>
            </div>
          </CardContent>
        </Card>
        <ConfirmDialog
          open={showSubmitConfirm}
          onOpenChange={setShowSubmitConfirm}
          title="Submit Assessment?"
          description="Are you sure you want to submit your assessment? You cannot change your answers after submitting."
          onConfirm={doSubmit}
          loading={submitting}
          confirmLabel="Yes, Submit Assessment"
        />
      </div>
    );
  }

  /* ── Taking Screen ── */
  if (phase === 'taking' && currentQ) {
    const q = currentQ;
    const resp = responses[q.question_id] ?? {};
    const qStatus = getStatus(q.question_id);
    const shuffledOpts = q.options && q.options.length
      ? seededShuffle(q.options, (attempt?.attempt_id ?? 1) * q.question_id)
      : [];
    const matchOpts = q.options ?? [];

    return (
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Header bar */}
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-medium text-muted-foreground">
            Question {currentIdx + 1} of {questions.length}
          </p>
          <div className="flex items-center gap-3">
            {/* Save indicator */}
            <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground mr-2">
              {saveStatus === 'saving' && <><RefreshCw className="h-3 w-3 animate-spin" /> Saving...</>}
              {saveStatus === 'saved' && <><FileCheck className="h-3 w-3 text-emerald-500" /> Draft Saved</>}
              {saveStatus === 'error' && <><AlertCircle className="h-3 w-3 text-rose-500" /> Save Failed</>}
            </div>

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

        {/* Violation Dialog */}
        <Dialog open={showViolation} onOpenChange={setShowViolation}>
          <DialogContent aria-describedby={undefined} className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-rose-600">
                <ShieldAlert className="h-5 w-5" /> Security Warning
              </DialogTitle>
              <DialogDescription className="pt-2">
                It was detected that you left the assessment window. This is considered a security violation.
              </DialogDescription>
            </DialogHeader>
            <div className="bg-rose-50 dark:bg-rose-900/20 p-4 rounded-lg flex flex-col items-center gap-2 text-center border border-rose-100 dark:border-rose-900/30">
              <p className="text-xl font-black text-rose-800 dark:text-rose-300">Warning {violations} / 3</p>
              <p className="text-xs font-medium text-rose-700 dark:text-rose-400">If you reach 3 warnings, your assessment will be automatically submitted.</p>
            </div>
            <DialogFooter>
              <Button className="w-full bg-rose-600 hover:bg-rose-700 text-white" onClick={() => setShowViolation(false)}>
                I understand, back to test
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Question navigator */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          {questions.map((q2, i) => {
            const st = getStatus(q2.question_id);
            return (
              <button
                key={q2.question_id}
                onClick={() => setCurrentIdx(i)}
                className={cn('h-7 min-w-[28px] px-1 rounded text-xs font-medium transition-colors shrink-0', {
                  'bg-primary text-primary-foreground': i === currentIdx,
                  'bg-green-500 text-white': i !== currentIdx && st === 'answered',
                  'bg-yellow-300 text-yellow-900 dark:bg-yellow-700 dark:text-yellow-100': i !== currentIdx && st === 'skipped',
                  'bg-muted text-muted-foreground': i !== currentIdx && st === 'untouched',
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

  return (
    <>
      {phase !== 'taking' && phase !== 'review' && phase !== 'submitted' && phase !== 'start' && <LoadingSpinner />}
      <ConfirmDialog
        open={showSubmitConfirm}
        onOpenChange={setShowSubmitConfirm}
        title="Submit Assessment?"
        description="Are you sure you want to submit your assessment? You cannot change your answers after submitting."
        onConfirm={doSubmit}
        loading={submitting}
        confirmLabel="Yes, Submit Assessment"
      />
    </>
  );
}
