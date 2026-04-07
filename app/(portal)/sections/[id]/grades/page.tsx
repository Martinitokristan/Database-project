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
import { sectionService } from '@/services/sectionService';
import { toast } from 'sonner';
import { Save, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function GradeManagerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }              = use(params);
  const [section, setSection] = useState<any>(null);
  const [grades, setGrades]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits]     = useState<Record<number, any>>({});
  const [saving, setSaving]   = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [sr, gr] = await Promise.all([
      sectionService.get(Number(id)),
      gradeService.getBySectionId(Number(id)),
    ]);
    if (sr.success) setSection(sr.data);
    if (gr.success) setGrades(gr.data ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  function handleEdit(enrollmentId: number, field: string, value: string) {
    const num = value === '' ? null : Number(value);
    setEdits(prev => ({ ...prev, [enrollmentId]: { ...(prev[enrollmentId] ?? {}), [field]: num } }));
  }

  async function handleSave(enrollmentId: number) {
    const edit = edits[enrollmentId];
    if (!edit) return;
    setSaving(enrollmentId);
    const res = await gradeService.updateByEnrollment(enrollmentId, edit);
    setSaving(null);
    if (!res.success) { toast.error(res.message); return; }
    toast.success('Grade saved.');
    setEdits(prev => { const n = { ...prev }; delete n[enrollmentId]; return n; });
    load();
  }

  function getVal(g: any, field: string) {
    const edit = edits[g.enrollment_id];
    if (edit && field in edit) return edit[field] === null ? '' : String(edit[field]);
    return g[field] === null || g[field] === undefined ? '' : String(g[field]);
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="mb-4">
        <Link href="/sections"><Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" />Back</Button></Link>
      </div>
      <PageHeader
        title={section ? `${section.section_name} — Grade Manager` : 'Grade Manager'}
        description={section ? `${section.subject_code} · ${section.term} ${section.school_year}` : ''}
      />
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
                  const prelim  = edits[g.enrollment_id]?.prelim_grade  !== undefined ? edits[g.enrollment_id].prelim_grade  : g.prelim_grade;
                  const midterm = edits[g.enrollment_id]?.midterm_grade !== undefined ? edits[g.enrollment_id].midterm_grade : g.midterm_grade;
                  const finalG  = edits[g.enrollment_id]?.final_grade   !== undefined ? edits[g.enrollment_id].final_grade   : g.final_grade;
                  const avg = (prelim != null && midterm != null && finalG != null)
                    ? ((Number(prelim) + Number(midterm) + Number(finalG)) / 3).toFixed(2) : '—';
                  const isDirty = !!edits[g.enrollment_id];
                  return (
                    <TableRow key={g.enrollment_id} className={isDirty ? 'bg-primary/5' : ''}>
                      <TableCell>
                        <p className="font-medium">{g.last_name}, {g.first_name}</p>
                        <p className="text-xs font-mono text-muted-foreground">{g.user_id}</p>
                      </TableCell>
                      {(['prelim_grade','midterm_grade','final_grade'] as const).map(field => (
                        <TableCell key={field} className="text-center">
                          <Input type="number" min={0} max={100} step={0.01} className="h-8 text-center w-24 mx-auto" value={getVal(g, field)} onChange={e => handleEdit(g.enrollment_id, field, e.target.value)} />
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
  );
}
