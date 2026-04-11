'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { assessmentService } from '@/services/assessmentService';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ArrowLeft, CheckCircle2, XCircle, Pencil, Loader2 } from 'lucide-react';

export default function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { role, isLoading } = useAuth();
  if (isLoading) return <LoadingSpinner />;
  if (role === 'faculty' || role === 'admin') return <FacultyResults id={Number(id)} />;
  return <StudentResults id={Number(id)} />;
}

/* ─── Faculty Results ───────────────────────────────────────────── */
function FacultyResults({ id }: { id: number }) {
  const router = useRouter();
  const [results, setResults]   = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [overrideQ, setOverrideQ] = useState<any | null>(null);

  const load = async () => {
    const res = await assessmentService.getResults(id);
    if (res.success) setResults(res.data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  async function handleOverride(responseId: number, pts: number) {
    const res = await assessmentService.overrideGrade(id, { response_id: responseId, points_earned: pts });
    if (!res.success) { toast.error(res.message); return; }
    toast.success('Grade overridden.');
    setOverrideQ(null);
    load();
    if (selected) {
      const r2 = await assessmentService.getResults(id);
      if (r2.success) {
        const updated = r2.data.find((x: any) => x.attempt_id === selected.attempt_id);
        setSelected(updated ?? null);
      }
    }
  }

  if (loading) return <LoadingSpinner />;

  const grouped: Record<string, any[]> = {};
  for (const r of results) {
    if (!grouped[r.user_id]) grouped[r.user_id] = [];
    grouped[r.user_id].push(r);
  }

  return (
    <div>
      <PageHeader
        title="Assessment Results"
        action={<Button variant="ghost" onClick={() => router.push(`/assessments/${id}`)}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>}
      />

      {Object.keys(grouped).length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">No submissions yet.</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead className="text-center">Attempt</TableHead>
                  <TableHead className="text-center">Submitted</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead className="text-center">%</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map(r => {
                  const pct = r.max_score ? Math.round((r.score / r.max_score) * 100) : 0;
                  return (
                    <TableRow key={r.attempt_id}>
                      <TableCell className="font-medium">{r.last_name}, {r.first_name}</TableCell>
                      <TableCell className="text-center text-sm">{r.attempt_no}</TableCell>
                      <TableCell className="text-center text-sm text-muted-foreground">
                        {r.submitted_at ? new Date(r.submitted_at).toLocaleString() : '—'}
                      </TableCell>
                      <TableCell className="text-center font-mono font-semibold">{r.score ?? 0}/{r.max_score ?? 0}</TableCell>
                      <TableCell className="text-center">
                        <span className={cn('font-semibold', pct >= 75 ? 'text-green-600' : pct >= 50 ? 'text-yellow-600' : 'text-red-600')}>
                          {pct}%
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => setSelected(r)}>
                          Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Attempt detail dialog */}
      {selected && (
        <Dialog open onOpenChange={() => setSelected(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selected.last_name}, {selected.first_name} — Attempt {selected.attempt_no}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-6 text-sm">
                <div><p className="text-muted-foreground text-xs">Score</p><p className="font-bold text-lg">{selected.score}/{selected.max_score}</p></div>
                {selected.max_score > 0 && <div><p className="text-muted-foreground text-xs">Percentage</p><p className={cn('font-bold text-lg', ((selected.score/selected.max_score)*100) >= 75 ? 'text-green-600' : 'text-red-600')}>{Math.round((selected.score/selected.max_score)*100)}%</p></div>}
                {selected.time_spent && <div><p className="text-muted-foreground text-xs">Time Spent</p><p className="font-semibold">{Math.floor(selected.time_spent/60)}m {selected.time_spent%60}s</p></div>}
              </div>
              <div className="space-y-3">
                {(selected.responses ?? []).map((resp: any, i: number) => (
                  <Card key={resp.response_id} className={cn(
                    resp.is_correct ? 'border-green-200 dark:border-green-800' : resp.is_correct === false ? 'border-red-200 dark:border-red-800' : 'border-muted'
                  )}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {resp.is_correct
                            ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                            : resp.is_correct === false
                              ? <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                              : <span className="h-4 w-4" />
                          }
                          <p className="text-sm font-medium">Q{i + 1}. {resp.question_text}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className="text-xs font-mono">
                            {resp.points_earned ?? 0}/{resp.points}
                          </Badge>
                          <Button size="sm" variant="ghost" onClick={() => setOverrideQ(resp)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="pl-6 space-y-1">
                        {resp.question_type === 'Identification' && (
                          <p className="text-xs text-muted-foreground">Answer: <span className="text-foreground font-medium">{resp.response_text || '(blank)'}</span></p>
                        )}
                        {resp.question_type === 'MultipleChoice' && (
                          <p className="text-xs text-muted-foreground">Selected option ID: <span className="text-foreground font-medium">{resp.selected_option_id ?? '(none)'}</span></p>
                        )}
                        {resp.manually_overridden && (
                          <Badge variant="outline" className="text-xs text-yellow-700 border-yellow-300">Manually overridden</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Override dialog */}
      {overrideQ && (
        <OverrideDialog
          response={overrideQ}
          onClose={() => setOverrideQ(null)}
          onSave={handleOverride}
        />
      )}
    </div>
  );
}

function OverrideDialog({ response, onClose, onSave }: {
  response: any; onClose: () => void; onSave: (id: number, pts: number) => Promise<void>;
}) {
  const [pts, setPts]     = useState(String(response.points_earned ?? 0));
  const [saving, setSaving] = useState(false);

  async function handle() {
    const n = parseFloat(pts);
    if (isNaN(n) || n < 0 || n > response.points) {
      toast.error(`Points must be between 0 and ${response.points}.`); return;
    }
    setSaving(true);
    await onSave(response.response_id, n);
    setSaving(false);
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Override Grade</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground line-clamp-2">{response.question_text}</p>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Points Earned <span className="text-muted-foreground text-xs">(max {response.points})</span></label>
            <Input type="number" min="0" max={response.points} step="0.5" value={pts} onChange={e => setPts(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handle} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Override
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Student Results ───────────────────────────────────────────── */
function StudentResults({ id }: { id: number }) {
  const router = useRouter();
  const [attempts, setAttempts] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [blocked, setBlocked]   = useState(false);

  useEffect(() => {
    assessmentService.getResults(id).then(res => {
      if (!res.success) { setBlocked(true); setLoading(false); return; }
      setAttempts(res.data ?? []);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <LoadingSpinner />;

  if (blocked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-center">
        <p className="font-semibold">Results not yet released</p>
        <p className="text-sm text-muted-foreground">Your instructor hasn't released results for this assessment yet.</p>
        <Button variant="outline" onClick={() => router.push('/assessments')}>Back to Assessments</Button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="My Results" action={<Button variant="ghost" onClick={() => router.push('/assessments')}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>} />
      {attempts.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">No submissions found.</CardContent></Card>
      ) : (
        <div className="space-y-6">
          {attempts.map(att => {
            const pct = att.max_score ? Math.round((att.score / att.max_score) * 100) : 0;
            return (
              <Card key={att.attempt_id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Attempt {att.attempt_no}</CardTitle>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-lg">{att.score}/{att.max_score}</span>
                      <span className={cn('font-bold', pct >= 75 ? 'text-green-600' : pct >= 50 ? 'text-yellow-600' : 'text-red-600')}>
                        {pct}%
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Submitted: {att.submitted_at ? new Date(att.submitted_at).toLocaleString() : '—'}
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {(att.responses ?? []).map((resp: any, i: number) => (
                      <div key={resp.response_id} className={cn('rounded-lg border p-3',
                        resp.is_correct ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/10'
                        : resp.is_correct === false ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/10'
                        : 'border-muted'
                      )}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {resp.is_correct
                              ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                              : resp.is_correct === false
                                ? <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                                : null
                            }
                            <p className="text-sm font-medium">Q{i + 1}. {resp.question_text}</p>
                          </div>
                          <Badge variant="outline" className="text-xs font-mono shrink-0">
                            {resp.points_earned ?? 0}/{resp.points}
                          </Badge>
                        </div>
                        {resp.question_type === 'Identification' && resp.response_text && (
                          <p className="pl-6 text-xs text-muted-foreground mt-1">
                            Your answer: <span className="text-foreground">{resp.response_text}</span>
                          </p>
                        )}
                      </div>
                    ))}
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
