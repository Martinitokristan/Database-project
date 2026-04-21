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
  const [semesters, setSemesters] = useState<any[]>([]);
  const [selectedSem, setSelectedSem] = useState('');
  
  const [sections, setSections] = useState<any[]>([]);
  const [selectedSec, setSelectedSec] = useState('');

  const [grades, setGrades]     = useState<any[]>([]);
  const [loadingGrades, setLoadingGrades] = useState(false);

  useEffect(() => {
    // We fetch semesters first. Since we import `fetchApi` indirectly, let's just fetch it
    fetch('/api/semesters', { credentials: 'include' })
      .then(r => r.json())
      .then(r => { 
        if (r.success && r.data?.length > 0) {
          setSemesters(r.data);
          const active = r.data.find((s: any) => s.status === 'Active') || r.data[0];
          setSelectedSem(String(active.semester_id));
        }
      });
  }, []);

  useEffect(() => {
    if (!selectedSem) return;
    fetch(`/api/sections?semester_id=${selectedSem}`, { credentials: 'include' })
      .then(r => r.json())
      .then(r => {
        if (r.success) {
          setSections(r.data ?? []);
          setSelectedSec('');
          setGrades([]);
        }
      });
  }, [selectedSem]);

  async function handleSectionChange(id: string) {
    setSelectedSec(id);
    setLoadingGrades(true);
    const res = await gradeService.getSectionOverview(Number(id));
    if (res.success) setGrades(res.data ?? []);
    setLoadingGrades(false);
  }

  const sorted = [...grades].sort((a, b) => {
    const avgA = Number(a.average) || 0;
    const avgB = Number(b.average) || 0;
    return avgB - avgA;
  });

  const handleExport = () => {
    const section = sections.find(s => String(s.section_id) === selectedSec);
    if (!section) return;
    reports.exportGradeReport({ section, grades: sorted });
  };

  const semStr = semesters.find(s => String(s.semester_id) === selectedSem);
  const semLabel = semStr ? `${semStr.term} ${semStr.school_year}` : '';

  return (
    <div>
      <PageHeader 
        title="Grades" 
        description="View aggregated grades by section, ranked by average." 
        action={
          selectedSec && grades.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleExport} className="h-9 gap-2">
              <Download className="h-4 w-4" /> Export Class Record
            </Button>
          )
        }
      />
      <div className="mb-6 flex flex-col sm:flex-row gap-4 max-w-2xl">
        <div className="flex-1">
          <Select value={selectedSem} onValueChange={setSelectedSem}>
            <SelectTrigger><SelectValue placeholder="Select Semester…" /></SelectTrigger>
            <SelectContent>
              {semesters.map((s: any) => (
                <SelectItem key={s.semester_id} value={String(s.semester_id)}>
                  {s.term} {s.school_year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <Select value={selectedSec} onValueChange={handleSectionChange} disabled={!selectedSem || sections.length === 0}>
            <SelectTrigger><SelectValue placeholder={sections.length === 0 ? "No sections found" : "Select Section…"} /></SelectTrigger>
            <SelectContent>
              {sections.map((s: any) => (
                <SelectItem key={s.section_id} value={String(s.section_id)}>
                  {s.section_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {!selectedSec ? (
        <Card><CardContent className="pt-6"><EmptyState title="Select a section" description="Choose a section above to view its general grade report." /></CardContent></Card>
      ) : loadingGrades ? <LoadingSpinner /> : (
        <Card>
          <CardHeader><CardTitle className="text-sm">Grade Report — {sections.find(s => String(s.section_id) === selectedSec)?.section_name} ({semLabel})</CardTitle></CardHeader>
          <CardContent>
            {sorted.length === 0 ? <EmptyState /> : (
               <div className="overflow-x-auto">
                 <Table>
                   <TableHeader>
                     <TableRow>
                       <TableHead className="w-8">#</TableHead>
                       <TableHead>Student</TableHead>
                       <TableHead className="text-center">Prelim</TableHead>
                       <TableHead className="text-center">Midterm</TableHead>
                       <TableHead className="text-center">Semi-F</TableHead>
                       <TableHead className="text-center">Final</TableHead>
                       <TableHead className="text-center bg-muted/30 font-bold">Overall Average</TableHead>
                       <TableHead>Remarks</TableHead>
                     </TableRow>
                   </TableHeader>
                   <TableBody>
                     {sorted.map((g, i) => (
                       <TableRow key={g.enrollment_id}>
                         <TableCell className="text-muted-foreground text-sm">{i + 1}</TableCell>
                         <TableCell>
                           <p className="font-bold whitespace-nowrap">{g.last_name}, {g.first_name}</p>
                           <p className="text-[10px] text-muted-foreground font-mono">{g.user_id}</p>
                         </TableCell>
                         <TableCell className="text-center">{g.prelim_grade ?? '—'}</TableCell>
                         <TableCell className="text-center">{g.midterm_grade ?? '—'}</TableCell>
                         <TableCell className="text-center">{g.semi_final_grade ?? '—'}</TableCell>
                         <TableCell className="text-center">{g.final_grade ?? '—'}</TableCell>
                         <TableCell className="text-center font-black bg-muted/10">{g.average}</TableCell>
                         <TableCell>{g.remarks ? <StatusBadge status={g.remarks} /> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                       </TableRow>
                     ))}
                   </TableBody>
                 </Table>
               </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { StudentClassRecordTab } from './StudentClassRecordTab';

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

  // Group by semester
  const grouped = grades.reduce((acc: Record<string, any[]>, g) => {
    const key = `${g.term} ${g.school_year}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(g);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <PageHeader 
        title="My Grades" 
        description="View your grades, activities, and assessments posted by your instructors." 
        action={
          grades.length > 0 && (
            <Button onClick={handleDownloadTranscript} disabled={exporting} className="gap-2 bg-blue-600 hover:bg-blue-700">
              <FileText className="h-4 w-4" /> Download Transcript
            </Button>
          )
        }
      />
      <Tabs defaultValue="final-grades" className="w-full">
        <div className="flex px-1 mb-4">
          <TabsList className="bg-background border h-auto p-1 text-muted-foreground w-full sm:w-auto overflow-x-auto justify-start shadow-sm">
            <TabsTrigger value="final-grades" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-bold px-6 py-2 flex items-center">
              Final Grades
            </TabsTrigger>
            <TabsTrigger value="class-record" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-bold px-6 py-2 flex items-center">
              Class Record
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="final-grades" className="mt-0 space-y-6">
          {grades.length === 0 ? (
            <EmptyState title="No grades yet" description="Grades will appear here once your instructor submits them." />
          ) : (
            Object.entries(grouped).map(([sem, semGrades]) => (
              <Card key={sem} className="overflow-hidden">
                <CardHeader className="bg-muted/30 border-b py-3">
                  <CardTitle className="text-sm font-bold">{sem}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Subject</TableHead>
                        <TableHead>Section</TableHead>
                        <TableHead>Instructor</TableHead>
                        <TableHead className="text-center">Prelim</TableHead>
                        <TableHead className="text-center">Midterm</TableHead>
                        <TableHead className="text-center">Semi-F</TableHead>
                        <TableHead className="text-center">Final</TableHead>
                        <TableHead className="text-center bg-muted/20 font-bold">Average</TableHead>
                        <TableHead>Remarks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(semGrades as any[]).map(g => {
                        const m = g.midterm_grade != null ? Number(g.midterm_grade) : null;
                        const f = g.final_grade != null ? Number(g.final_grade) : null;
                        let avg = '—';
                        if (m != null && f != null) {
                          avg = ((m + f) / 2).toFixed(2);
                        } else if (m != null) {
                          avg = m.toFixed(2);
                        } else if (f != null) {
                          avg = f.toFixed(2);
                        }
                        return (
                          <TableRow key={g.grade_id || g.enrollment_id}>
                            <TableCell>
                              <p className="font-bold text-sm">{g.subject_title}</p>
                              <p className="text-[10px] font-mono text-muted-foreground">{g.subject_code} · {g.credit_units} units</p>
                            </TableCell>
                            <TableCell className="text-sm">{g.section_name}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{g.instructor_last}, {g.instructor_first}</TableCell>
                            <TableCell className="text-center font-medium">{g.prelim_grade ?? <span className="text-muted-foreground">—</span>}</TableCell>
                            <TableCell className="text-center font-medium">{g.midterm_grade ?? <span className="text-muted-foreground">—</span>}</TableCell>
                            <TableCell className="text-center font-medium">{g.semi_final_grade ?? <span className="text-muted-foreground">—</span>}</TableCell>
                            <TableCell className="text-center font-medium">{g.final_grade ?? <span className="text-muted-foreground">—</span>}</TableCell>
                            <TableCell className="text-center font-black bg-muted/10">{avg}</TableCell>
                            <TableCell>{g.remarks ? <StatusBadge status={g.remarks} /> : <span className="text-xs text-muted-foreground">Pending</span>}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="class-record" className="mt-0">
          <StudentClassRecordTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
