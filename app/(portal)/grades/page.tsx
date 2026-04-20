'use client';

import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { sectionService } from '@/services/sectionService';
import { gradeService } from '@/services/gradeService';
import { reports } from '@/lib/reports';
import { FileText, Download } from 'lucide-react';

export default function GradesPage() {
  const { role, isLoading } = useAuth();
  if (isLoading) return <LoadingSpinner />;
  if (role === 'admin') return <AdminGrades />;
  if (role === 'student') return <StudentGrades />;
  return null;
}

function AdminGrades() {
  const [sections, setSections] = useState<any[]>([]);
  const [selected, setSelected] = useState('');
  const [grades, setGrades]     = useState<any[]>([]);
  const [loadingGrades, setLoadingGrades] = useState(false);

  useEffect(() => {
    sectionService.list().then(r => { if (r.success) setSections(r.data ?? []); });
  }, []);

  async function handleSectionChange(id: string) {
    setSelected(id);
    setLoadingGrades(true);
    const res = await gradeService.getBySectionId(Number(id));
    if (res.success) setGrades(res.data ?? []);
    setLoadingGrades(false);
  }

  const sorted = [...grades].sort((a, b) => {
    const avgA = (a.prelim_grade + a.midterm_grade + a.final_grade) / 3 || 0;
    const avgB = (b.prelim_grade + b.midterm_grade + b.final_grade) / 3 || 0;
    return avgB - avgA;
  });

  const handleExport = () => {
    const section = sections.find(s => String(s.section_id) === selected);
    if (!section) return;
    reports.exportGradeReport({ section, grades: sorted });
  };

  return (
    <div>
      <PageHeader 
        title="Grades" 
        description="View grades by section, ranked by average." 
        action={
          selected && grades.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleExport} className="h-9 gap-2">
              <Download className="h-4 w-4" /> Export Class Record
            </Button>
          )
        }
      />
      <div className="mb-4 max-w-sm">
        <Select value={selected} onValueChange={handleSectionChange}>
          <SelectTrigger><SelectValue placeholder="Select a section…" /></SelectTrigger>
          <SelectContent>
            {sections.map((s: any) => (
              <SelectItem key={s.section_id} value={String(s.section_id)}>
                {s.section_name} · {s.subject_code} · {s.term} {s.school_year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {!selected ? (
        <Card><CardContent className="pt-6"><EmptyState title="Select a section" description="Choose a section above to view its grade report." /></CardContent></Card>
      ) : loadingGrades ? <LoadingSpinner /> : (
        <Card>
          <CardHeader><CardTitle className="text-sm">Grade Report — {sections.find(s => String(s.section_id) === selected)?.section_name}</CardTitle></CardHeader>
          <CardContent>
            {sorted.length === 0 ? <EmptyState /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead className="text-center">Prelim</TableHead>
                    <TableHead className="text-center">Midterm</TableHead>
                    <TableHead className="text-center">Final</TableHead>
                    <TableHead className="text-center">Average</TableHead>
                    <TableHead>Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((g, i) => {
                    const avg = (g.prelim_grade != null && g.midterm_grade != null && g.final_grade != null)
                      ? ((Number(g.prelim_grade) + Number(g.midterm_grade) + Number(g.final_grade)) / 3).toFixed(2) : '—';
                    return (
                      <TableRow key={g.enrollment_id}>
                        <TableCell className="text-muted-foreground text-sm">{i + 1}</TableCell>
                        <TableCell>
                          <p className="font-medium">{g.last_name}, {g.first_name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{g.user_id}</p>
                        </TableCell>
                        <TableCell className="text-center">{g.prelim_grade ?? '—'}</TableCell>
                        <TableCell className="text-center">{g.midterm_grade ?? '—'}</TableCell>
                        <TableCell className="text-center">{g.final_grade ?? '—'}</TableCell>
                        <TableCell className="text-center font-semibold">{avg}</TableCell>
                        <TableCell>{g.remarks ? <StatusBadge status={g.remarks} /> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StudentGrades() {
  const { user }              = useAuth();
  const [grades, setGrades]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetch('/api/student/grades', { credentials: 'include' })
      .then(r => r.json())
      .then(r => { if (r.success) setGrades(r.data ?? []); })
      .finally(() => setLoading(false));
  }, []);

  const handleDownloadTranscript = () => {
    if (!user || grades.length === 0) return;
    setExporting(true);
    reports.exportTranscript({
      student: {
        user_id: user.user_id,
        first_name: (user as any).first_name,
        last_name: (user as any).last_name
      },
      grades: grades
    });
    setExporting(false);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader 
        title="My Grades" 
        description="Academic performance for all enrolled subjects." 
        action={
          grades.length > 0 && (
            <Button onClick={handleDownloadTranscript} disabled={exporting} className="gap-2 bg-blue-600 hover:bg-blue-700">
              <FileText className="h-4 w-4" /> Download Official Transcript
            </Button>
          )
        }
      />
      {grades.length === 0 ? (
        <EmptyState title="No grades yet" description="Grades will appear here once your instructor submits them." />
      ) : (
        <Card>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead className="text-center">Prelim</TableHead>
                  <TableHead className="text-center">Midterm</TableHead>
                  <TableHead className="text-center">Final</TableHead>
                  <TableHead className="text-center">Average</TableHead>
                  <TableHead>Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grades.map(g => {
                  const avg = (g.prelim_grade != null && g.midterm_grade != null && g.final_grade != null)
                    ? ((Number(g.prelim_grade) + Number(g.midterm_grade) + Number(g.final_grade)) / 3).toFixed(2) : '—';
                  return (
                    <TableRow key={g.enrollment_id}>
                      <TableCell>
                        <p className="font-medium">{g.subject_title}</p>
                        <p className="text-xs font-mono text-muted-foreground">{g.subject_code} · {g.credit_units} units</p>
                      </TableCell>
                      <TableCell className="text-sm">{g.section_name}</TableCell>
                      <TableCell className="text-center">{g.prelim_grade ?? <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-center">{g.midterm_grade ?? <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-center">{g.final_grade ?? <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-center font-semibold">{avg}</TableCell>
                      <TableCell>{g.remarks ? <StatusBadge status={g.remarks} /> : <span className="text-xs text-muted-foreground">Pending</span>}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
