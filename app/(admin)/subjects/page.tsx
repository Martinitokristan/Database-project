'use client';

import { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { subjectService } from '@/services/subjectService';
import { courseService } from '@/services/courseService';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';

const schema = z.object({
  course_id:    z.string().min(1, 'Select a course'),
  code:         z.string().min(1),
  title:        z.string().min(2),
  credit_units: z.string().min(1),
});
type FormData = z.infer<typeof schema>;

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [courses, setCourses]   = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [open, setOpen]         = useState(false);
  const [editing, setEditing]   = useState<any>(null);
  const [saving, setSaving]     = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { credit_units: '3' },
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [sr, cr] = await Promise.all([subjectService.list(), courseService.list()]);
    if (sr.success) setSubjects(sr.data ?? []);
    if (cr.success) setCourses(cr.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() { reset({ course_id: '', code: '', title: '', credit_units: '3' }); setEditing(null); setOpen(true); }
  function openEdit(s: any) {
    reset({ course_id: String(s.course_id), code: s.code, title: s.title, credit_units: String(s.credit_units) });
    setEditing(s); setOpen(true);
  }

  async function onSubmit(data: FormData) {
    setSaving(true);
    try {
      const payload = { ...data, course_id: Number(data.course_id), credit_units: Number(data.credit_units) };
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
      <PageHeader title="Subjects" action={<Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Add Subject</Button>} />
      <Card>
        <CardContent className="pt-4">
          {loading ? <LoadingSpinner /> : subjects.length === 0 ? <EmptyState /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead className="text-center">Units</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {subjects.map(s => (
                  <TableRow key={s.subject_id}>
                    <TableCell className="font-mono font-medium">{s.code}</TableCell>
                    <TableCell>{s.title}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.course_name}</TableCell>
                    <TableCell className="text-center">{s.credit_units}</TableCell>
                    <TableCell className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteTarget(s)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Subject' : 'Add Subject'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Course</Label>
              <Select defaultValue={editing ? String(editing.course_id) : ''} onValueChange={v => setValue('course_id', v)}>
                <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                <SelectContent>
                  {courses.map((c: any) => <SelectItem key={c.course_id} value={String(c.course_id)}>{c.course_name}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.course_id && <p className="text-xs text-destructive">{errors.course_id.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Code</Label><Input {...register('code')} placeholder="CS101" />{errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}</div>
              <div className="space-y-1.5"><Label>Credit Units</Label><Input type="number" min={1} {...register('credit_units')} />{errors.credit_units && <p className="text-xs text-destructive">{errors.credit_units.message}</p>}</div>
            </div>
            <div className="space-y-1.5"><Label>Title</Label><Input {...register('title')} />{errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}</div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button>
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
