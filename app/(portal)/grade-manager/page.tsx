'use client';

import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { subjectOfferingService } from '@/services/subjectOfferingService';
import { gradeService } from '@/services/gradeService';
import { toast } from 'sonner';
import { Save, CheckCircle2, Lock, Users, BookOpen, Star, Loader2, ClipboardList, PenTool } from 'lucide-react';
import { ClassRecordTab } from './ClassRecordTab';

export default function GradeManagerPage() {
  const { role, isLoading } = useAuth();
  if (isLoading) return <LoadingSpinner />;
  if (role !== 'faculty' && role !== 'admin') return <EmptyState title="Access Denied" />;
  return <GradeManager />;
}

function GradeManager() {
  const [offerings, setOfferings] = useState<any[]>([]);
  const [selectedOffering, setSelectedOffering] = useState('');
  const [grades, setGrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingGrades, setLoadingGrades] = useState(false);
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [editedGrades, setEditedGrades] = useState<Record<number, { prelim?: number | null; midterm?: number | null; semi_final?: number | null; final?: number | null }>>({});

  useEffect(() => {
    subjectOfferingService.list().then(r => {
      if (r.success) setOfferings(r.data ?? []);
      setLoading(false);
    });
  }, []);

  const loadGrades = useCallback(async (offeringId: string) => {
    setLoadingGrades(true);
    setEditedGrades({});
    const res = await gradeService.getByOfferingId(Number(offeringId));
    if (res.success) setGrades(res.data ?? []);
    setLoadingGrades(false);
  }, []);

  function handleOfferingChange(id: string) {
    setSelectedOffering(id);
    loadGrades(id);
  }

  function handleGradeInput(enrollmentId: number, field: 'prelim' | 'midterm' | 'semi_final' | 'final', value: string) {
    const num = value === '' ? null : Number(value);
    setEditedGrades(prev => ({
      ...prev,
      [enrollmentId]: { ...prev[enrollmentId], [field]: num }
    }));
  }

  function getDisplayValue(g: any, field: 'prelim_grade' | 'midterm_grade' | 'semi_final_grade' | 'final_grade') {
    const enrollmentId = g.enrollment_id;
    let editKey: 'prelim' | 'midterm' | 'semi_final' | 'final' = 'midterm';
    if (field === 'prelim_grade') editKey = 'prelim';
    if (field === 'semi_final_grade') editKey = 'semi_final';
    if (field === 'final_grade') editKey = 'final';

    if (editedGrades[enrollmentId]?.[editKey] !== undefined) {
      return editedGrades[enrollmentId][editKey];
    }
    return g[field];
  }

  function computeAverage(midterm: number | null, final_val: number | null): string {
    if (midterm == null && final_val == null) return '—';
    const m = Number(midterm) || 0;
    const f = Number(final_val) || 0;
    let count = 0, sum = 0;
    if (midterm != null) { sum += m; count++; }
    if (final_val != null) { sum += f; count++; }
    return count > 0 ? (sum / count).toFixed(2) : '—';
  }

  function computeRemarks(midterm: number | null, final_val: number | null): string | null {
    if (midterm == null || final_val == null) return null;
    const avg = (Number(midterm) + Number(final_val)) / 2;
    return avg <= 3.0 ? 'Passed' : 'Failed';
  }

  async function handleSaveGrade(g: any) {
    const enrollmentId = g.enrollment_id;
    const edited = editedGrades[enrollmentId];
    if (!edited) return;

    const prelim = edited.prelim !== undefined ? edited.prelim : g.prelim_grade;
    const midterm = edited.midterm !== undefined ? edited.midterm : g.midterm_grade;
    const semi_final = edited.semi_final !== undefined ? edited.semi_final : g.semi_final_grade;
    const final_val = edited.final !== undefined ? edited.final : g.final_grade;

    setSaving(prev => ({ ...prev, [enrollmentId]: true }));
    try {
      const res = await gradeService.updateGrade(Number(selectedOffering), enrollmentId, {
        prelim_grade: prelim,
        midterm_grade: midterm,
        semi_final_grade: semi_final,
        final_grade: final_val
      });
      if (res.success) {
        toast.success(`Grade saved for ${g.last_name}, ${g.first_name}`);
        // Refresh and clear edits for this student
        setEditedGrades(prev => {
          const next = { ...prev };
          delete next[enrollmentId];
          return next;
        });
        loadGrades(selectedOffering);
      } else {
        toast.error(res.message || 'Failed to save grade.');
      }
    } catch {
      toast.error('Failed to save grade.');
    } finally {
      setSaving(prev => ({ ...prev, [enrollmentId]: false }));
    }
  }

  async function handleSaveAll() {
    const toSave = Object.keys(editedGrades).map(Number);
    if (toSave.length === 0) return;

    for (const enrollmentId of toSave) {
      const g = grades.find(gr => gr.enrollment_id === enrollmentId);
      if (g) await handleSaveGrade(g);
    }
  }

  if (loading) return <div className="h-96 flex items-center justify-center"><LoadingSpinner /></div>;

  const currentOffering = offerings.find(o => String(o.offering_id) === selectedOffering);
  const hasEdits = Object.keys(editedGrades).length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Grade Manager"
        description="Input and manage student grades for your subject offerings."
        action={
          hasEdits && (
            <Button onClick={handleSaveAll} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
              <Save className="h-4 w-4" /> Save All Changes
            </Button>
          )
        }
      />

      {/* Offering Selector */}
      <Card className="border-none shadow-lg bg-gradient-to-r from-indigo-600 to-violet-600 text-white overflow-hidden">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-sm">
                <BookOpen className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Subject Offering</p>
                <p className="text-lg font-bold">
                  {currentOffering ? `${currentOffering.subject_code} — ${currentOffering.subject_title}` : 'Select an offering'}
                </p>
                {currentOffering && (
                  <p className="text-xs text-indigo-200">
                    {currentOffering.section_name} · {currentOffering.term} {currentOffering.school_year}
                  </p>
                )}
              </div>
            </div>
            <div className="flex-1 min-w-[280px]">
              <Select value={selectedOffering} onValueChange={handleOfferingChange}>
                <SelectTrigger className="bg-white/10 border-white/20 text-white h-11 focus:ring-white/30 [&>span]:text-white">
                  <SelectValue placeholder="Select a subject offering…" />
                </SelectTrigger>
                <SelectContent>
                  {offerings.map(o => (
                    <SelectItem key={o.offering_id} value={String(o.offering_id)}>
                      {o.subject_code} · {o.subject_title} · {o.section_name} · {o.term} {o.school_year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {currentOffering && (
              <div className="flex gap-4 text-center">
                <div className="bg-white/10 rounded-lg px-4 py-2 backdrop-blur-sm">
                  <p className="text-[9px] font-black uppercase tracking-widest text-indigo-200">Students</p>
                  <p className="text-xl font-black">{grades.length}</p>
                </div>
                <div className="bg-white/10 rounded-lg px-4 py-2 backdrop-blur-sm">
                  <p className="text-[9px] font-black uppercase tracking-widest text-indigo-200">Graded</p>
                  <p className="text-xl font-black">
                    {grades.filter(g => g.midterm_grade != null && g.final_grade != null).length}
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs Area */}
      {!selectedOffering ? (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              title="Select a Subject Offering"
              description="Choose one of your subject offerings above to start managing grades."
            />
          </CardContent>
        </Card>
      ) : loadingGrades ? (
        <LoadingSpinner />
      ) : grades.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <EmptyState title="No Students Enrolled" description="There are no enrolled students in this offering yet." />
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="final-grades" className="w-full">
          <div className="flex px-1 mb-4">
            <TabsList className="bg-background border h-auto p-1 text-muted-foreground w-full sm:w-auto overflow-x-auto justify-start shadow-sm">
              <TabsTrigger value="final-grades" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-bold px-6 py-2">
                <Star className="h-4 w-4 mr-2" />
                Final Grades
              </TabsTrigger>
              <TabsTrigger value="class-record" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-bold px-6 py-2">
                <ClipboardList className="h-4 w-4 mr-2" />
                Class Record
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="final-grades" className="mt-0">
            <Card className="border-none shadow-xl overflow-hidden mt-4">
              <CardHeader className="bg-muted/30 border-b py-3 px-6">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    Class Roster — {grades.length} student{grades.length !== 1 ? 's' : ''}
                  </CardTitle>
                  {hasEdits && (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs animate-pulse">
                      {Object.keys(editedGrades).length} unsaved change{Object.keys(editedGrades).length !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/10">
                        <TableHead className="w-10 pl-6 font-black uppercase text-[10px]">#</TableHead>
                        <TableHead className="font-black uppercase text-[10px]">Student</TableHead>
                        <TableHead className="text-center font-black uppercase text-[10px] w-[110px]">Prelim</TableHead>
                        <TableHead className="text-center font-black uppercase text-[10px] w-[110px]">Midterm</TableHead>
                        <TableHead className="text-center font-black uppercase text-[10px] w-[110px]">Semi-F</TableHead>
                        <TableHead className="text-center font-black uppercase text-[10px] w-[110px]">Final</TableHead>
                        <TableHead className="text-center font-black uppercase text-[10px] w-[100px] bg-muted/20">Average</TableHead>
                        <TableHead className="text-center font-black uppercase text-[10px] w-[100px]">Remarks</TableHead>
                        <TableHead className="text-center font-black uppercase text-[10px] w-[80px]">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {grades.map((g, i) => {
                        const isFinalized = g.is_finalized;
                        const preVal = getDisplayValue(g, 'prelim_grade');
                        const midVal = getDisplayValue(g, 'midterm_grade');
                        const semiVal = getDisplayValue(g, 'semi_final_grade');
                        const finVal = getDisplayValue(g, 'final_grade');
                        // Average is strictly Midterm + Final based on User Choice
                        const avg = computeAverage(midVal, finVal);
                        const remarks = computeRemarks(midVal, finVal);
                        const hasEdit = !!editedGrades[g.enrollment_id];
                        const isSaving = saving[g.enrollment_id];

                        return (
                          <TableRow
                            key={g.enrollment_id}
                            className={`transition-colors ${hasEdit ? 'bg-amber-50/50 dark:bg-amber-900/10' : 'hover:bg-muted/5'} ${isFinalized ? 'opacity-60' : ''}`}
                          >
                            <TableCell className="pl-6 text-muted-foreground text-sm font-mono">{i + 1}</TableCell>
                            <TableCell>
                              <p className="font-bold text-sm whitespace-nowrap">{g.last_name}, {g.first_name}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">{g.user_id}</p>
                            </TableCell>

                            <TableCell className="text-center">
                              {isFinalized ? (
                                <span className="font-medium">{g.prelim_grade ?? '—'}</span>
                              ) : (
                                <Input
                                  type="number" step="0.01" min="1" max="5" placeholder="—"
                                  className="h-9 w-20 mx-auto text-center font-medium text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  value={preVal ?? ''} onChange={e => handleGradeInput(g.enrollment_id, 'prelim', e.target.value)}
                                />
                              )}
                            </TableCell>

                            <TableCell className="text-center">
                              {isFinalized ? (
                                <span className="font-medium">{g.midterm_grade ?? '—'}</span>
                              ) : (
                                <Input
                                  type="number" step="0.01" min="1" max="5" placeholder="—"
                                  className="h-9 w-20 mx-auto text-center font-medium text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  value={midVal ?? ''} onChange={e => handleGradeInput(g.enrollment_id, 'midterm', e.target.value)}
                                />
                              )}
                            </TableCell>

                            <TableCell className="text-center">
                              {isFinalized ? (
                                <span className="font-medium">{g.semi_final_grade ?? '—'}</span>
                              ) : (
                                <Input
                                  type="number" step="0.01" min="1" max="5" placeholder="—"
                                  className="h-9 w-20 mx-auto text-center font-medium text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  value={semiVal ?? ''} onChange={e => handleGradeInput(g.enrollment_id, 'semi_final', e.target.value)}
                                />
                              )}
                            </TableCell>

                            <TableCell className="text-center">
                              {isFinalized ? (
                                <span className="font-medium">{g.final_grade ?? '—'}</span>
                              ) : (
                                <Input
                                  type="number" step="0.01" min="1" max="5" placeholder="—"
                                  className="h-9 w-20 mx-auto text-center font-medium text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  value={finVal ?? ''} onChange={e => handleGradeInput(g.enrollment_id, 'final', e.target.value)}
                                />
                              )}
                            </TableCell>

                            <TableCell className="text-center bg-muted/10">
                              <span className="font-black text-lg tracking-tight">
                                {avg}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              {remarks ? (
                                <StatusBadge status={remarks} />
                              ) : g.remarks ? (
                                <StatusBadge status={g.remarks} />
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {isFinalized ? (
                                <Lock className="h-4 w-4 text-muted-foreground mx-auto" />
                              ) : hasEdit ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                  onClick={() => handleSaveGrade(g)}
                                  disabled={isSaving}
                                >
                                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                </Button>
                              ) : g.midterm_grade != null && g.final_grade != null ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                              ) : null}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="class-record" className="mt-4">
            <ClassRecordTab offeringId={selectedOffering} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
