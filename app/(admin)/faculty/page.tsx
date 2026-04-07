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
import { toast } from 'sonner';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { departmentService } from '@/services/departmentService';

const schema = z.object({
  first_name:    z.string().min(1),
  middle_name:   z.string().optional(),
  last_name:     z.string().min(1),
  email:         z.string().email(),
  gender:        z.enum(['Male', 'Female', 'Other']),
  date_of_birth: z.string().min(1),
  phone:         z.string().min(7),
  address:       z.string().min(5),
});
type FormData = z.infer<typeof schema>;

export default function FacultyPage() {
  const [faculty, setFaculty]     = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [open, setOpen]           = useState(false);
  const [saving, setSaving]       = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting]   = useState(false);

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/users?role=Faculty&limit=100', { credentials: 'include' }).then(r => r.json());
    if (res.success) setFaculty(res.data?.users ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function onSubmit(data: FormData) {
    setSaving(true);
    try {
      const res = await fetch('/api/faculty', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(r => r.json());
      if (!res.success) { toast.error(res.message); return; }
      toast.success('Faculty member added.');
      reset(); setOpen(false); load();
    } catch { toast.error('An error occurred.'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/users/${deleteTarget.user_id}`, { method: 'DELETE', credentials: 'include' }).then(r => r.json());
      if (!res.success) { toast.error(res.message); return; }
      toast.success('Faculty deactivated.');
      setDeleteTarget(null); load();
    } catch { toast.error('An error occurred.'); }
    finally { setDeleting(false); }
  }

  return (
    <div>
      <PageHeader
        title="Faculty"
        description="Manage faculty members"
        action={<Button onClick={() => { reset(); setOpen(true); }}><Plus className="mr-2 h-4 w-4" />Add Faculty</Button>}
      />

      <Card>
        <CardContent className="pt-4">
          {loading ? <LoadingSpinner /> : faculty.length === 0 ? <EmptyState /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {faculty.map(f => (
                  <TableRow key={f.user_id}>
                    <TableCell className="font-mono text-sm">{f.user_id}</TableCell>
                    <TableCell className="font-medium">{f.last_name}, {f.first_name}</TableCell>
                    <TableCell>{f.email}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteTarget(f)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Faculty Member</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>First Name</Label><Input {...register('first_name')} />{errors.first_name && <p className="text-xs text-destructive">{errors.first_name.message}</p>}</div>
              <div className="space-y-1"><Label>Last Name</Label><Input {...register('last_name')} />{errors.last_name && <p className="text-xs text-destructive">{errors.last_name.message}</p>}</div>
            </div>
            <div className="space-y-1"><Label>Email</Label><Input type="email" {...register('email')} />{errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Gender</Label>
                <Select onValueChange={v => setValue('gender', v as any)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Date of Birth</Label><Input type="date" {...register('date_of_birth')} /></div>
            </div>
            <div className="space-y-1"><Label>Phone</Label><Input {...register('phone')} /></div>
            <div className="space-y-1"><Label>Address</Label><Input {...register('address')} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add Faculty</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={o => !o && setDeleteTarget(null)}
        title="Deactivate Faculty?"
        description={`This will deactivate ${deleteTarget?.first_name} ${deleteTarget?.last_name}. They will no longer be able to log in.`}
        onConfirm={handleDelete}
        loading={deleting}
        confirmLabel="Deactivate"
      />
    </div>
  );
}
