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
import { courseService } from '@/services/courseService';
import { departmentService } from '@/services/departmentService';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';

const schema = z.object({
  dept_id:     z.string().min(1, 'Select a department'),
  course_name: z.string().min(2),
});
type FormData = z.infer<typeof schema>;

export default function CoursesPage() {
  const [courses, setCourses]     = useState<any[]>([]);
  const [departments, setDepts]   = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [open, setOpen]           = useState(false);
  const [editing, setEditing]     = useState<any>(null);
  const [saving, setSaving]       = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting]   = useState(false);

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [cr, dr] = await Promise.all([courseService.list(), departmentService.list()]);
    if (cr.success) setCourses(cr.data ?? []);
    if (dr.success) setDepts(dr.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() { reset({ dept_id: '', course_name: '' }); setEditing(null); setOpen(true); }
  function openEdit(c: any) { reset({ dept_id: String(c.dept_id), course_name: c.course_name }); setEditing(c); setOpen(true); }

  async function onSubmit(data: FormData) {
    setSaving(true);
    try {
      const payload = { ...data, dept_id: Number(data.dept_id) };
      const res = editing ? await courseService.update(editing.course_id, payload) : await courseService.create(payload);
      if (!res.success) { toast.error(res.message); return; }
      toast.success(editing ? 'Course updated.' : 'Course created.');
      setOpen(false); load();
    } catch { toast.error('An error occurred.'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await courseService.remove(deleteTarget.course_id);
    setDeleting(false);
    if (!res.success) { toast.error(res.message); return; }
    toast.success('Course deleted.'); setDeleteTarget(null); load();
  }

  return (
    <div>
      <PageHeader title="Courses" action={<Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Add Course</Button>} />
      <Card>
        <CardContent className="pt-4">
          {loading ? <LoadingSpinner /> : courses.length === 0 ? <EmptyState /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {courses.map(c => (
                  <TableRow key={c.course_id}>
                    <TableCell className="font-medium max-w-[300px] truncate" title={c.course_name}>{c.course_name}</TableCell>
                    <TableCell>{c.department_name}</TableCell>
                    <TableCell className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteTarget(c)}><Trash2 className="h-4 w-4" /></Button>
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
          <DialogHeader><DialogTitle>{editing ? 'Edit Course' : 'Add Course'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Select defaultValue={editing ? String(editing.dept_id) : ''} onValueChange={v => setValue('dept_id', v)}>
                <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>
                  {departments.map((d: any) => <SelectItem key={d.dept_id} value={String(d.dept_id)}>{d.department_name}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.dept_id && <p className="text-xs text-destructive">{errors.dept_id.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Course Name</Label>
              <Input {...register('course_name')} />
              {errors.course_name && <p className="text-xs text-destructive">{errors.course_name.message}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}
        title="Delete Course?" description={`Delete "${deleteTarget?.course_name}"?`}
        onConfirm={handleDelete} loading={deleting}
      />
    </div>
  );
}
