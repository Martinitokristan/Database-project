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
import { departmentService } from '@/services/departmentService';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';

const schema = z.object({
  department_name:    z.string().min(2),
  department_head_id: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function DepartmentsPage() {
  const [departments, setDepts] = useState<any[]>([]);
  const [faculty, setFaculty]   = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [open, setOpen]         = useState(false);
  const [editing, setEditing]   = useState<any>(null);
  const [saving, setSaving]     = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [dr, fr] = await Promise.all([
      departmentService.list(),
      fetch('/api/users?role=Faculty&limit=100', { credentials: 'include' }).then(r => r.json()),
    ]);
    if (dr.success) setDepts(dr.data ?? []);
    if (fr.success) setFaculty(fr.data?.users ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() { reset({ department_name: '', department_head_id: '' }); setEditing(null); setOpen(true); }
  function openEdit(d: any) {
    reset({ department_name: d.department_name, department_head_id: d.department_head_id ?? '' });
    setEditing(d); setOpen(true);
  }

  async function onSubmit(data: FormData) {
    setSaving(true);
    try {
      const payload = { ...data, department_head_id: data.department_head_id || null };
      const res = editing
        ? await departmentService.update(editing.dept_id, payload)
        : await departmentService.create(payload);
      if (!res.success) { toast.error(res.message); return; }
      toast.success(editing ? 'Department updated.' : 'Department created.');
      setOpen(false); load();
    } catch { toast.error('An error occurred.'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await departmentService.remove(deleteTarget.dept_id);
    setDeleting(false);
    if (!res.success) { toast.error(res.message); return; }
    toast.success('Department deleted.'); setDeleteTarget(null); load();
  }

  return (
    <div>
      <PageHeader
        title="Departments"
        action={<Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Add Department</Button>}
      />
      <Card>
        <CardContent className="pt-4">
          {loading ? <LoadingSpinner /> : departments.length === 0 ? <EmptyState /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Department</TableHead>
                  <TableHead>Department Head</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map(d => (
                  <TableRow key={d.dept_id}>
                    <TableCell className="font-medium">{d.department_name}</TableCell>
                    <TableCell>{d.first_name ? `${d.first_name} ${d.last_name}` : <span className="text-muted-foreground text-xs">None</span>}</TableCell>
                    <TableCell className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(d)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteTarget(d)}><Trash2 className="h-4 w-4" /></Button>
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
          <DialogHeader><DialogTitle>{editing ? 'Edit Department' : 'Add Department'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Department Name</Label>
              <Input {...register('department_name')} />
              {errors.department_name && <p className="text-xs text-destructive">{errors.department_name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Department Head <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Select
                defaultValue={editing?.department_head_id ?? ''}
                onValueChange={v => setValue('department_head_id', v === 'none' ? '' : v)}
              >
                <SelectTrigger><SelectValue placeholder="Select faculty" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {faculty.map((f: any) => (
                    <SelectItem key={f.user_id} value={f.user_id}>{f.last_name}, {f.first_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={o => !o && setDeleteTarget(null)}
        title="Delete Department?"
        description={`Delete "${deleteTarget?.department_name}"? This cannot be undone.`}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}
