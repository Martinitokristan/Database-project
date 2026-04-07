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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { sectionService } from '@/services/sectionService';
import { subjectService } from '@/services/subjectService';
import { semesterService } from '@/services/semesterService';
import { toast } from 'sonner';
import { Plus, Eye, Loader2, Layers, Users, ChevronRight } from 'lucide-react';

const schema = z.object({
  subject_id:    z.string().min(1, 'Select subject'),
  instructor_id: z.string().min(1, 'Select instructor'),
  semester_id:   z.string().min(1, 'Select semester'),
  section_name:  z.string().min(1),
  capacity:      z.string().min(1),
});
type FormData = z.infer<typeof schema>;

export default function SectionsPage() {
  const { role, isLoading } = useAuth();
  if (isLoading) return <LoadingSpinner />;
  if (role === 'admin')   return <AdminSections />;
  if (role === 'faculty') return <FacultySections />;
  return null;
}

function AdminSections() {
  const [sections, setSections]   = useState<any[]>([]);
  const [subjects, setSubjects]   = useState<any[]>([]);
  const [semesters, setSemesters] = useState<any[]>([]);
  const [faculty, setFaculty]     = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [open, setOpen]           = useState(false);
  const [saving, setSaving]       = useState(false);

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema), defaultValues: { capacity: '40' },
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [sr, subr, semr, fr] = await Promise.all([
      sectionService.list(), subjectService.list(), semesterService.list(),
      fetch('/api/users?role=Faculty&limit=100', { credentials: 'include' }).then(r => r.json()),
    ]);
    if (sr.success) setSections(sr.data ?? []);
    if (subr.success) setSubjects(subr.data ?? []);
    if (semr.success) setSemesters(semr.data ?? []);
    if (fr.success) setFaculty(fr.data?.users ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function onSubmit(data: FormData) {
    setSaving(true);
    const res = await sectionService.create({
      subject_id: Number(data.subject_id), instructor_id: data.instructor_id,
      semester_id: Number(data.semester_id), section_name: data.section_name, capacity: Number(data.capacity),
    });
    setSaving(false);
    if (!res.success) { toast.error(res.message); return; }
    toast.success('Section created.'); reset({ capacity: '40' }); setOpen(false); load();
  }

  return (
    <div>
      <PageHeader title="Sections" action={<Button onClick={() => { reset({ capacity: '40' }); setOpen(true); }}><Plus className="mr-2 h-4 w-4" />Add Section</Button>} />
      <Card>
        <CardContent className="pt-4">
          {loading ? <LoadingSpinner /> : sections.length === 0 ? <EmptyState /> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Section</TableHead><TableHead>Subject</TableHead>
                <TableHead>Instructor</TableHead><TableHead>Semester</TableHead>
                <TableHead className="text-center">Enrolled</TableHead><TableHead className="w-16" />
              </TableRow></TableHeader>
              <TableBody>
                {sections.map(s => (
                  <TableRow key={s.section_id}>
                    <TableCell className="font-medium">{s.section_name}</TableCell>
                    <TableCell><span className="font-mono text-xs text-muted-foreground">{s.subject_code}</span><span className="ml-2 text-sm">{s.subject_title}</span></TableCell>
                    <TableCell>{s.instructor_last}, {s.instructor_first}</TableCell>
                    <TableCell className="text-sm">{s.term} {s.school_year}</TableCell>
                    <TableCell className="text-center"><Badge variant="outline" className={Number(s.enrolled_count) >= s.capacity ? 'border-destructive text-destructive' : ''}>{s.enrolled_count}/{s.capacity}</Badge></TableCell>
                    <TableCell><Link href={`/sections/${s.section_id}`}><Button size="sm" variant="ghost"><Eye className="h-4 w-4" /></Button></Link></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Section</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="space-y-1.5"><Label>Subject</Label>
              <Select onValueChange={v => setValue('subject_id', v)}><SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                <SelectContent>{subjects.map((s: any) => <SelectItem key={s.subject_id} value={String(s.subject_id)}>{s.code} — {s.title}</SelectItem>)}</SelectContent>
              </Select>{errors.subject_id && <p className="text-xs text-destructive">{errors.subject_id.message}</p>}
            </div>
            <div className="space-y-1.5"><Label>Instructor</Label>
              <Select onValueChange={v => setValue('instructor_id', v)}><SelectTrigger><SelectValue placeholder="Select faculty" /></SelectTrigger>
                <SelectContent>{faculty.map((f: any) => <SelectItem key={f.user_id} value={f.user_id}>{f.last_name}, {f.first_name}</SelectItem>)}</SelectContent>
              </Select>{errors.instructor_id && <p className="text-xs text-destructive">{errors.instructor_id.message}</p>}
            </div>
            <div className="space-y-1.5"><Label>Semester</Label>
              <Select onValueChange={v => setValue('semester_id', v)}><SelectTrigger><SelectValue placeholder="Select semester" /></SelectTrigger>
                <SelectContent>{semesters.map((s: any) => <SelectItem key={s.semester_id} value={String(s.semester_id)}>{s.term} {s.school_year}</SelectItem>)}</SelectContent>
              </Select>{errors.semester_id && <p className="text-xs text-destructive">{errors.semester_id.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Section Name</Label><Input {...register('section_name')} placeholder="A" /></div>
              <div className="space-y-1.5"><Label>Capacity</Label><Input type="number" min={1} {...register('capacity')} /></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FacultySections() {
  const [sections, setSections] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    sectionService.list().then(r => { if (r.success) setSections(r.data ?? []); setLoading(false); });
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader title="My Sections" description="Click a section to manage grades." />
      {sections.length === 0 ? <EmptyState title="No sections assigned" /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sections.map(s => (
            <Link key={s.section_id} href={`/sections/${s.section_id}/grades`}>
              <Card className="hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer h-full">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><Layers className="h-5 w-5 text-primary" /></div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="font-bold text-lg">{s.section_name}</p>
                  <p className="text-sm font-mono text-muted-foreground">{s.subject_code}</p>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{s.subject_title}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <Badge variant="outline" className="gap-1 text-xs"><Users className="h-3 w-3" />{s.enrolled_count}/{s.capacity}</Badge>
                    <Badge variant="outline" className="text-xs">{s.term} {s.school_year}</Badge>
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
