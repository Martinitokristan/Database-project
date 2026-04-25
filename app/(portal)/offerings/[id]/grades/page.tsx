'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { gradeService } from '@/services/gradeService';
import { subjectOfferingService } from '@/services/subjectOfferingService';
import { toast } from 'sonner';
import { Save, ArrowLeft, Loader2, Lock, CheckCircle2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import Link from 'next/link';

export default function GradeManagerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [offering, setOffering] = useState<any>(null);
  const [grades, setGrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<Record<number, any>>({});
  const [saving, setSaving] = useState<number | null>(null);
  const [showFinalize, setShowFinalize] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [or, gr] = await Promise.all([
      subjectOfferingService.get(Number(id)),
      gradeService.getByOfferingId(Number(id)),
    ]);
    if (or.success) setOffering(or.data);
    if (gr.success) setGrades(gr.data ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  function handleEdit(enrollmentId: number, field: string, value: string) {
    const num = value === '' ? null : Number(value);
    setEdits(prev => ({ ...prev, [enrollmentId]: { ...(prev[enrollmentId] ?? {}), [field]: num } }));
  }

  async function handleFinalize() {
    setFinalizing(true);
    const res = await gradeService.finalize(Number(id));
    setFinalizing(null as any);
    if (!res.success) { toast.error(res.message); return; }
    toast.success('Grades finalized and locked.');
    setShowFinalize(false);
    load();
  }
  async function handleSave(enrollmentId: number) {
    const edit = edits[enrollmentId];
    if (!edit) return;
    setSaving(enrollmentId);
    const res = await gradeService.updateGrade(Number(id), enrollmentId, edit);
    setSaving(null);
    if (!res.success) { toast.error(res.message); return; }
    toast.success('Grade saved.');
    setEdits(prev => { const n = { ...prev }; delete n[enrollmentId]; return n; });
    load();
  }

  const isFinalized = grades.length > 0 && grades.every(g => g.is_finalized);
  const canFinalize = grades.length > 0 && !isFinalized && grades.every(g =>
    g.prelim_grade !== null && g.midterm_grade !== null && g.final_grade !== null
  );

  function getVal(g: any, field: string) {
    const edit = edits[g.enrollment_id];
    if (edit && field in edit) return edit[field] === null ? '' : String(edit[field]);
    return g[field] === null || g[field] === undefined ? '' : String(g[field]);
  }

  if (loading) return <LoadingSpinner />;

  return (
    <>
      <div>
        <div className="mb-4">
          <Link href="/sections"><Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" />Back</Button></Link>
        </div>
        <PageHeader
          title={offering ? `${offering.section_name} — Grade Manager` : 'Grade Manager'}
          description={offering ? `${offering.subject_code} · ${offering.term} ${offering.school_year}` : ''}
          action={
            !isFinalized && (
              <Button
                variant="default"
                className="bg-emerald-600 hover:bg-emerald-700 h-9 font-bold text-xs uppercase tracking-widest gap-2"
                disabled={!canFinalize}
                onClick={() => setShowFinalize(true)}
              >
                <Lock className="h-4 w-4" /> Finalize Grades
              </Button>
            )
          }
        />

        {isFinalized && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-800 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="font-bold text-emerald-900 dark:text-emerald-100 italic">Grades Locked</p>
              <p className="text-sm text-emerald-700 dark:text-emerald-300">This class has been finalized. Contact an administrator for further adjustments.</p>
            </div>
          </div>
        )}
        <Card>
          <CardContent className="pt-4">
            {grades.length === 0 ? <EmptyState title="No students enrolled" /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead className="text-center w-28">Prelim</TableHead>
                    <TableHead className="text-center w-28">Midterm</TableHead>
                    <TableHead className="text-center w-28">Final</TableHead>
                    <TableHead className="text-center w-28">Average</TableHead>
                    <TableHead>Remarks</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grades.map(g => {
                    const prelim = edits[g.enrollment_id]?.prelim_grade !== undefined ? edits[g.enrollment_id].prelim_grade : g.prelim_grade;
                    const midterm = edits[g.enrollment_id]?.midterm_grade !== undefined ? edits[g.enrollment_id].midterm_grade : g.midterm_grade;
                    const finalG = edits[g.enrollment_id]?.final_grade !== undefined ? edits[g.enrollment_id].final_grade : g.final_grade;
                    const avg = (prelim != null && midterm != null && finalG != null)
                      ? ((Number(prelim) + Number(midterm) + Number(finalG)) / 3).toFixed(2) : '—';
                    const isDirty = !!edits[g.enrollment_id];
                    return (
                      <TableRow key={g.enrollment_id} className={isDirty ? 'bg-primary/5' : ''}>
                        <TableCell>
                          <p className="font-medium">{g.last_name}, {g.first_name}</p>
                          <p className="text-xs font-mono text-muted-foreground">{g.user_id}</p>
                        </TableCell>
                        {(['prelim_grade', 'midterm_grade', 'final_grade'] as const).map(field => (
                          <TableCell key={field} className="text-center">
                            <Input
                              type="number" min={0} max={100} step={0.01}
                              className="h-8 text-center w-24 mx-auto disabled:opacity-70 disabled:bg-muted"
                              value={getVal(g, field)}
                              onChange={e => handleEdit(g.enrollment_id, field, e.target.value)}
                              disabled={isFinalized}
                            />
                          </TableCell>
                        ))}
                        <TableCell className="text-center font-semibold">{avg}</TableCell>
                        <TableCell>{g.remarks ? <StatusBadge status={g.remarks} /> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                        <TableCell>
                          {isDirty && (
                            <Button size="sm" onClick={() => handleSave(g.enrollment_id)} disabled={saving === g.enrollment_id}>
                              {saving === g.enrollment_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
      <ConfirmDialog
        open={showFinalize}
        onOpenChange={setShowFinalize}
        title="Finalize Grades?"
        description="This will lock all grades for this section and prevent further editing. Are you sure you're ready to submit?"
        onConfirm={handleFinalize}
        loading={finalizing}
        confirmLabel="Finalize & Lock"
      />
    </>
  );
}
