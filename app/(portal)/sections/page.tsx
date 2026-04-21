'use client';

import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { sectionService } from '@/services/sectionService';
import { subjectService } from '@/services/subjectService';
import { semesterService } from '@/services/semesterService';
import { toast } from 'sonner';
import { BookOpen, X, Pencil, Mail, Calendar, Clock, MapPin, Users, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const schema = z.object({
  subject_id:    z.string().min(1, 'Select subject'),
  instructor_id: z.string().min(1, 'Select instructor'),
  semester_id:   z.string().min(1, 'Select semester'),
  section_name:  z.string().min(1),
  capacity:      z.string().min(1),
});
type FormData = z.infer<typeof schema>;

// ─── Group sections by semester ───────────────────────────────────────────────
function groupBySemester(sections: any[]) {
  const map = new Map<string, { name: string; semester_id: number; is_active: boolean; sections: any[] }>();
  for (const s of sections) {
    const key = String(s.semester_id);
    if (!map.has(key)) {
      map.set(key, { 
        name: `${s.term} ${s.school_year}`, 
        semester_id: s.semester_id, 
        is_active: s.semester_status === 'Active',
        sections: [] 
      });
    }
    map.get(key)!.sections.push(s);
  }
  // Sort Active first, then alphabetically
  return Array.from(map.values()).sort((a, b) => {
    if (a.is_active && !b.is_active) return -1;
    if (!a.is_active && b.is_active) return 1;
    return b.name.localeCompare(a.name);
  });
}

// ─── Admin Accordion View ─────────────────────────────────────────────────────
function AdminSections() {
  const [sections, setSections]   = useState<any[]>([]);
  const [semesters, setSemesters] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [open, setOpen]           = useState(false);
  const [saving, setSaving]       = useState(false);
  // Track which semester accordions are expanded (key = semester_id string)
  const [expanded, setExpanded]   = useState<Set<string>>(new Set());
  const [editTarget, setEditTarget] = useState<any>(null);
  const [editing, setEditing]     = useState(false);

  // Section Creation Form no longer requires subject or instructor immediately
  const { register, handleSubmit, setValue, reset, watch, formState: { errors } } = useForm<{
    section_name: string;
    year_level:   string;
    semester_id:  string;
    capacity: string;
  }>({
    defaultValues: { capacity: '40', year_level: '1st Year' },
  });
  const yearLevelValue = watch('year_level');
  const semesterValue = watch('semester_id');

  const load = useCallback(async () => {
    setLoading(true);
    const [sr, semr] = await Promise.all([
      sectionService.list(),
      semesterService.list(),
    ]);
    if (sr.success)   setSections(sr.data ?? []);
    if (semr.success) setSemesters(semr.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-expand all groups on first load
  useEffect(() => {
    if (sections.length > 0) {
      const ids = new Set(sections.map((s: any) => String(s.semester_id)));
      setExpanded(ids);
    }
  }, [sections]);

  function toggleGroup(key: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function onSubmit(data: any) {
    if (!data.semester_id || !data.section_name || !data.capacity) {
      toast.error('Please fill in all fields.');
      return;
    }
    setSaving(true);
    const payload = {
      semester_id: Number(data.semester_id),
      section_name: data.section_name,
      year_level: data.year_level,
      capacity: Number(data.capacity),
    };
    const res = editTarget 
      ? await sectionService.update(editTarget.section_id, payload)
      : await sectionService.create(payload);

    setSaving(false);
    if (!res.success) { toast.error(res.message); return; }
    toast.success(editTarget ? 'Section updated.' : 'Section created.'); 
    reset({ capacity: '40', year_level: '1st Year' }); 
    setOpen(false); 
    setEditTarget(null);
    load();
  }

  function openEdit(s: any) {
    setEditTarget(s);
    reset({
      section_name: s.section_name,
      semester_id: String(s.semester_id),
      year_level: s.year_level || '1st Year',
      capacity: String(s.capacity),
    });
    setOpen(true);
  }

  const grouped = groupBySemester(sections);

  return (
    <div>
      <PageHeader
        title="Sections (Cohorts)"
        description={`${sections.length} section${sections.length !== 1 ? 's' : ''} organized by semester.`}
        action={
          <Button onClick={() => { reset({ capacity: '40' }); setOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />Add Section
          </Button>
        }
      />

      {loading ? (
        <LoadingSpinner />
      ) : sections.length === 0 ? (
        <EmptyState title="No sections yet" description="Add the first section to get started." />
      ) : (
        <div className="space-y-3">
          {grouped.map(group => {
            const key = String(group.semester_id);
            const isOpen = expanded.has(key);
            return (
              <Card key={key} className="overflow-hidden">
                {/* Accordion Header */}
                <button
                  type="button"
                  onClick={() => toggleGroup(key)}
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-muted/40 transition-colors text-left"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <BookOpen className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm truncate">{group.name}</span>
                      {group.is_active && (
                        <Badge variant="default" className="scale-75 origin-left tracking-widest font-bold uppercase">Active</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {group.sections.length} section{group.sections.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <Badge variant="secondary" className="shrink-0 mr-2">
                    {group.sections.length}
                  </Badge>
                  {isOpen
                    ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                </button>

                {/* Accordion Body — Card Table Layout */}
                {isOpen && (
                  <div className="border-t bg-muted/5 divide-y">
                    <div className="hidden md:grid md:grid-cols-[2fr_120px_100px_100px_60px] gap-4 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <div>Section Name</div>
                      <div className="text-center">Year Level</div>
                      <div className="text-center">Capacity</div>
                      <div className="text-center">Enrolled</div>
                      <div className="w-[120px]" />
                    </div>
                    
                    <div className="divide-y">
                      {group.sections.map(s => {
                        const full = Number(s.enrolled_count) >= s.capacity;
                        return (
                          <div 
                            key={s.section_id} 
                            className="group flex flex-col md:grid md:grid-cols-[2fr_120px_100px_100px_60px] gap-4 px-6 py-4 items-center hover:bg-muted/50 transition-all duration-200"
                          >
                            {/* Section Name */}
                            <div className="w-full md:w-auto flex items-center justify-between md:block">
                              <span className="md:hidden text-xs font-semibold uppercase text-muted-foreground">Section</span>
                              <span className="font-bold text-base md:text-sm text-primary">{s.section_name}</span>
                            </div>

                            {/* Year Level */}
                            <div className="w-full md:w-auto flex items-center justify-between md:block text-center">
                              <span className="md:hidden text-xs font-semibold uppercase text-muted-foreground">Year</span>
                              <Badge variant="secondary" className="text-[10px] font-bold uppercase whitespace-nowrap">
                                {s.year_level || 'General'}
                              </Badge>
                            </div>

                            {/* Capacity */}
                            <div className="w-full md:w-auto flex items-center justify-between md:block text-center">
                              <span className="md:hidden text-xs font-semibold uppercase text-muted-foreground">Capacity</span>
                              <span className="text-sm font-medium">{s.capacity}</span>
                            </div>

                            {/* Enrolled */}
                            <div className="w-full md:w-auto flex items-center justify-between md:block text-center">
                              <span className="md:hidden text-xs font-semibold uppercase text-muted-foreground">Enrolled</span>
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  "font-bold transition-all",
                                  full ? "border-destructive text-destructive bg-destructive/5" : "border-primary/20 text-primary bg-primary/5"
                                )}>
                                {s.enrolled_count}/{s.capacity}
                              </Badge>
                            </div>

                            {/* Actions */}
                            <div className="w-full md:w-auto flex justify-end gap-1.5">
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-8 w-8 p-0 hover:bg-indigo-50 hover:text-indigo-600"
                                onClick={() => openEdit(s)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Link href={`/sections/${s.section_id}`} className="md:w-auto">
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Section Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-md p-0 overflow-hidden">
          <DialogHeader className="p-0">
            <div className="bg-primary px-6 pt-6 pb-10 relative">
              <DialogClose className="absolute top-3 right-3 text-primary-foreground/70 hover:text-primary-foreground transition-colors">
                <X className="h-5 w-5" />
              </DialogClose>
              <DialogDescription className="text-primary-foreground/80 text-xs uppercase tracking-widest font-semibold mb-1">
                Section Management
              </DialogDescription>
              <DialogTitle className="text-primary-foreground text-xl font-bold">
                {editTarget ? 'Edit Section' : 'Add Section (Cohort)'}
              </DialogTitle>
            </div>
          </DialogHeader>
          <div className="p-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Semester</Label>
                <Select value={semesterValue} onValueChange={v => setValue('semester_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Select semester" /></SelectTrigger>
                  <SelectContent>
                    {semesters.map((s: any) => (
                      <SelectItem key={s.semester_id} value={String(s.semester_id)}>
                        {s.term} {s.school_year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Year Level</Label>
                <Select value={yearLevelValue} onValueChange={v => setValue('year_level', v)}>
                  <SelectTrigger><SelectValue placeholder="Select year level" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1st Year">1st Year</SelectItem>
                    <SelectItem value="2nd Year">2nd Year</SelectItem>
                    <SelectItem value="3rd Year">3rd Year</SelectItem>
                    <SelectItem value="4th Year">4th Year</SelectItem>
                    <SelectItem value="Masteral">Masteral</SelectItem>
                    <SelectItem value="Doctorate">Doctorate</SelectItem>
                    <SelectItem value="Irregular">Irregular</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Section Name (e.g. BSCS-1A)</Label>
                <Input {...register('section_name')} placeholder="BSCS-1A" />
              </div>
              <div className="space-y-1.5">
                <Label>Capacity</Label>
                <Input type="number" min={1} {...register('capacity')} />
              </div>
              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => { setOpen(false); setEditTarget(null); }}>Cancel</Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editTarget ? 'Update Section' : 'Create Section'}
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Faculty Card View ───────────────────────────────────────────────────────
function FacultySections() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [selectedSection, setSelectedSection] = useState<any>(null);
  const [students, setStudents]   = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  useEffect(() => {
    fetch('/api/schedules', { credentials: 'include' })
      .then(res => res.json())
      .then(r => {
        if (r.success) {
          // Sort AM to PM
          const sorted = (r.data ?? []).sort((a: any, b: any) => {
            const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
            const dayDiff = days.indexOf(a.day_of_week) - days.indexOf(b.day_of_week);
            if (dayDiff !== 0) return dayDiff;
            return a.start_time.localeCompare(b.start_time);
          });
          setSchedules(sorted);
        }
        setLoading(false);
      });
  }, []);

  const viewStudents = async (section: any) => {
    setSelectedSection(section);
    setLoadingStudents(true);
    setStudents([]);
    try {
      const res = await fetch(`/api/sections/${section.section_id}/enrollments`).then(r => r.json());
      if (res.success) setStudents(res.data ?? []);
    } finally {
      setLoadingStudents(false);
    }
  };

  const formatTime = (time: string) => {
    if (!time) return '';
    const [h, m] = time.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m} ${ampm}`;
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader 
        title="My Schedule" 
        description="View your assigned classes and student enrollments." 
      />
      
      {schedules.length === 0 ? (
        <EmptyState title="No schedules found" description="You have not been assigned to any class schedules yet." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Accordion type="single" collapsible className="w-full">
              {schedules.map((s) => (
                <AccordionItem key={s.schedule_id} value={String(s.schedule_id)} className="border-b px-6 last:border-0 hover:bg-slate-50/50 transition-colors">
                  <AccordionTrigger className="hover:no-underline py-6">
                    <div className="flex flex-col md:flex-row md:items-center gap-4 text-left w-full">
                      <div className="flex items-center gap-3 min-w-[140px]">
                        <Calendar className="h-4 w-4 text-primary" />
                        <span className="font-bold text-sm">{s.day_of_week}</span>
                      </div>
                      <div className="flex items-center gap-3 min-w-[180px]">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{formatTime(s.start_time)} - {formatTime(s.end_time)}</span>
                      </div>
                      <div className="flex-1">
                        <span className="font-bold text-slate-900">{s.subject_title}</span>
                        <span className="ml-2 text-xs font-mono text-muted-foreground">({s.subject_code})</span>
                      </div>
                      <div className="md:text-right px-4">
                        <Badge variant="secondary" className="font-bold uppercase tracking-tight">{s.section_name}</Badge>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                      <Card className="bg-slate-50/50 border-dashed">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase text-slate-400">Class Details</span>
                            <Link href={`/offerings/${s.offering_id}/grades`}>
                              <Button size="sm" variant="outline" className="h-8 gap-2">
                                <BookOpen className="h-3.5 w-3.5" /> Gradebook
                              </Button>
                            </Link>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <MapPin className="h-4 w-4" /> Room {s.room}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <Users className="h-4 w-4" /> Instructor: {s.instructor_last || 'TBA'}
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase text-slate-400">Quick Tools</span>
                          <Button size="sm" variant="link" onClick={() => viewStudents(s)} className="h-auto p-0 text-primary">
                            Refresh Student List
                          </Button>
                        </div>
                        <Button 
                          className="w-full justify-start gap-2" 
                          variant="secondary"
                          onClick={() => viewStudents(s)}
                        >
                          <Users className="h-4 w-4" /> View Enrolled Students
                        </Button>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}

      {/* Enrolled Students Modal */}
      <Dialog open={!!selectedSection} onOpenChange={o => !o && setSelectedSection(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Enrollment List: {selectedSection?.section_name}</DialogTitle>
            <DialogDescription>
              {selectedSection?.subject_title} ({selectedSection?.subject_code})
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-2">
            {loadingStudents ? (
              <div className="h-32 flex items-center justify-center"><Loader2 className="animate-spin" /></div>
            ) : students.length === 0 ? (
              <p className="py-12 text-center text-muted-foreground italic">No students enrolled yet.</p>
            ) : (
              <div className="rounded-md border max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Year Level</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((st: any) => (
                      <TableRow key={st.enrollment_id}>
                        <TableCell className="font-mono text-xs">{st.student_id}</TableCell>
                        <TableCell className="font-medium">{st.last_name}, {st.first_name}</TableCell>
                        <TableCell>{st.year_level}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Mail className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedSection(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
export default function SectionsPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingSpinner />;
  
  if (user?.role_name === 'Admin') {
    return <AdminSections />;
  }

  return <FacultySections />;
}
