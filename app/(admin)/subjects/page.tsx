'use client';

import { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { subjectService } from '@/services/subjectService';
import { courseService } from '@/services/courseService';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const schema = z.object({
  course_id:    z.string().min(1, 'Select a course'),
  code:         z.string().min(1, 'Code required'),
  title:        z.string().min(2, 'Title required'),
  credit_units: z.string().min(1, 'Units required'),
  subject_type: z.enum(['Major', 'Minor']),
  prerequisite_id: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [courses, setCourses]   = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [open, setOpen]         = useState(false);
  const [editing, setEditing]   = useState<any>(null);
  const [saving, setSaving]     = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  const { register, handleSubmit, setValue, reset, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { 
      course_id: '', 
      code: '', 
      title: '', 
      credit_units: '3',
      subject_type: 'Major',
      prerequisite_id: 'none'
    },
  });

  // Register manual fields for shadcn Select
  useEffect(() => {
    register('course_id');
    register('subject_type');
    register('prerequisite_id');
  }, [register]);

  const load = useCallback(async (q = '', cf = '') => {
    setLoading(true);
    const [sr, cr] = await Promise.all([subjectService.list(), courseService.list()]);
    if (sr.success) {
      let data = sr.data ?? [];
      if (q) {
        const query = q.toLowerCase();
        data = data.filter((s: any) => 
          s.code.toLowerCase().includes(query) || 
          s.title.toLowerCase().includes(query)
        );
      }
      if (cf && cf !== 'all') {
        data = data.filter((s: any) => String(s.course_id) === cf);
      }
      setSubjects(data);
    }
    if (cr.success) setCourses(cr.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(search, courseFilter); }, [load, search, courseFilter]);

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value);
  }

  function handleCourseFilter(val: string) {
    setCourseFilter(val);
  }

  function openCreate() { 
    reset({ 
      course_id: '', code: '', title: '', credit_units: '3', 
      subject_type: 'Major', prerequisite_id: 'none' 
    }); 
    setEditing(null); setOpen(true); 
  }
  
  function openEdit(s: any) {
    reset({ 
      course_id: String(s.course_id), 
      code: s.code, 
      title: s.title, 
      credit_units: String(s.credit_units),
      subject_type: s.subject_type || 'Major',
      prerequisite_id: s.prerequisite_id ? String(s.prerequisite_id) : 'none'
    });
    setEditing(s); setOpen(true);
  }

  async function onSubmit(data: FormData) {
    setSaving(true);
    try {
      const payload = { 
        ...data, 
        course_id: Number(data.course_id), 
        credit_units: Number(data.credit_units),
        prerequisite_id: data.prerequisite_id ? Number(data.prerequisite_id) : null
      };
      const res = editing ? await subjectService.update(editing.subject_id, payload) : await subjectService.create(payload);
      if (!res.success) { toast.error(res.message); return; }
      toast.success(editing ? 'Subject updated.' : 'Subject created.');
      setOpen(false); load();
    } catch { toast.error('An error occurred.'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await subjectService.remove(deleteTarget.subject_id);
    setDeleting(false);
    if (!res.success) { toast.error(res.message); return; }
    toast.success('Subject deleted.'); setDeleteTarget(null); load();
  }

  return (
    <div>
      <PageHeader title="Subjects" action={<Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20 font-bold"><Plus className="mr-2 h-4 w-4" />Register Subject</Button>} />
      
      <Card className="border-none shadow-xl mb-6 bg-card/50 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[300px] max-w-md">
              <Plus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground rotate-45 transform" />
              <Input 
                placeholder="Search subject code or title..." 
                value={search} 
                onChange={handleSearch} 
                className="pl-9 h-11 bg-background/50 border-muted-foreground/20 focus:border-blue-500/50 transition-all font-medium" 
              />
            </div>
            <Select value={courseFilter || 'all'} onValueChange={handleCourseFilter}>
              <SelectTrigger className="w-[240px] h-11 font-medium bg-background/50 border-muted-foreground/20">
                <SelectValue placeholder="All Courses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Academic Programs</SelectItem>
                {courses.map((c: any) => (
                  <SelectItem key={c.course_id} value={String(c.course_id)}>{c.course_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-2xl overflow-hidden">
        <CardContent className="p-0">
          {loading ? <div className="h-96 flex items-center justify-center"><LoadingSpinner /></div> : subjects.length === 0 ? <EmptyState /> : (
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead className="w-24 pl-6 text-[10px] font-bold uppercase tracking-widest">Type</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest text-blue-600">Code</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest">Description</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest">Program</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest">Prerequisite</TableHead>
                  <TableHead className="text-center text-[10px] font-bold uppercase tracking-widest">Units</TableHead>
                  <TableHead className="w-24 pr-6" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {subjects.map(s => (
                  <TableRow key={s.subject_id} className="group hover:bg-muted/10 transition-colors">
                    <TableCell className="pl-6 py-4">
                      <Badge variant={s.subject_type === 'Major' ? 'default' : 'secondary'} className="font-bold text-[9px] uppercase tracking-wider px-2 py-0.5">
                        {s.subject_type || 'Major'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono font-black text-blue-600 dark:text-blue-400 text-sm">
                      {s.code}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-foreground leading-tight">{s.title}</span>
                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">{s.subject_type} Course</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                         <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                         <span className="text-xs font-semibold text-muted-foreground">{s.course_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {s.prerequisite_code ? (
                        <div className="flex flex-col">
                           <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase leading-none mb-0.5 tracking-tighter">Requires</span>
                           <span className="text-xs font-bold">{s.prerequisite_code}</span>
                        </div>
                      ) : <span className="text-[10px] text-muted-foreground/50 font-medium italic">No Requirement</span>}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-black text-sm border border-blue-100 dark:border-blue-800">
                        {s.credit_units}
                      </div>
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => openEdit(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-red-50" onClick={() => setDeleteTarget(s)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-[600px] p-0 border-none bg-[#1a2235] shadow-2xl overflow-hidden">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="text-2xl font-semibold text-white">
              {editing ? 'Edit Subject' : 'Add Subject'}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              Fill in the subject details for the curriculum.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit(onSubmit)} className="p-6 pt-2 space-y-6">
            {/* Row 1: Course Program */}
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Course Program</Label>
              <Select value={watch('course_id')} onValueChange={v => setValue('course_id', v, { shouldValidate: true })}>
                <SelectTrigger className="h-11 bg-black/20 border-white/10 text-white shadow-sm font-medium" aria-invalid={!!errors.course_id}>
                  <SelectValue placeholder="Select a course" />
                </SelectTrigger>
                <SelectContent className="bg-[#1a2235] border-white/10 text-white">
                  {courses.map((c: any) => <SelectItem key={c.course_id} value={String(c.course_id)}>{c.course_name}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.course_id && <p className="text-xs text-destructive font-medium mt-1">{errors.course_id.message}</p>}
            </div>

            {/* Row 2: Code & Units */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Subject Code</Label>
                <Input {...register('code')} placeholder="e.g. CS101" className="h-11 bg-black/20 border-white/10 text-white shadow-sm font-mono font-bold" aria-invalid={!!errors.code} />
                {errors.code && <p className="text-xs text-destructive font-medium mt-1">{errors.code.message}</p>}
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Credit Units</Label>
                <Input type="number" min={1} {...register('credit_units')} className="h-11 bg-black/20 border-white/10 text-white shadow-sm font-bold" aria-invalid={!!errors.credit_units} />
                {errors.credit_units && <p className="text-xs text-destructive font-medium mt-1">{errors.credit_units.message}</p>}
              </div>
            </div>

            {/* Row 3: Title */}
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Subject Title</Label>
              <Input {...register('title')} className="h-11 bg-black/20 border-white/10 text-white shadow-sm font-medium" placeholder="e.g. Introduction to Computing" aria-invalid={!!errors.title} />
              {errors.title && <p className="text-xs text-destructive font-medium mt-1">{errors.title.message}</p>}
            </div>

            {/* Row 4: Type & Prerequisite */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Subject Type</Label>
                <Select value={watch('subject_type')} onValueChange={v => setValue('subject_type', v as any, { shouldValidate: true })}>
                  <SelectTrigger className="h-11 bg-black/20 border-white/10 text-white shadow-sm font-medium" aria-invalid={!!errors.subject_type}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a2235] border-white/10 text-white">
                    <SelectItem value="Major">Major</SelectItem>
                    <SelectItem value="Minor">Minor</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Prerequisite</Label>
                <Select value={watch('prerequisite_id')} onValueChange={v => setValue('prerequisite_id', v, { shouldValidate: true })}>
                  <SelectTrigger className="h-11 bg-black/20 border-white/10 text-white shadow-sm font-sm" aria-invalid={!!errors.prerequisite_id}>
                    <SelectValue placeholder="No Prerequisite" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a2235] border-white/10 text-white">
                    <SelectItem value="none">None (Entry Level)</SelectItem>
                    {subjects.filter(s => s.subject_id !== editing?.subject_id).map((s: any) => (
                      <SelectItem key={s.subject_id} value={String(s.subject_id)}>{s.code} — {s.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="pt-4 gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="text-white hover:bg-white/5 font-semibold">Cancel</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 shadow-lg shadow-blue-500/20" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? 'Update Subject' : 'Save Subject'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}
        title="Delete Subject?" description={`Delete "${deleteTarget?.code} — ${deleteTarget?.title}"?`}
        onConfirm={handleDelete} loading={deleting}
      />
    </div>
  );
}
