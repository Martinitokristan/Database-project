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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { FacultyDetailsModal } from '@/components/shared/FacultyDetailsModal';
import { userService } from '@/services/userService';
import { toast } from 'sonner';
import { Plus, Eye, Loader2, X } from 'lucide-react';

const schema = z.object({
  first_name:    z.string().min(1),
  middle_name:   z.string().optional().nullable(),
  last_name:     z.string().min(1),
  email:         z.string().email(),
  personal_email: z.string().email(),
  gender:        z.enum(['Male', 'Female', 'Other']),
  date_of_birth: z.string().min(1),
  phone:         z.string().length(11, 'Must be 11 digits'),
  address:       z.string().min(5),
  temp_password: z.string().min(7, 'Required (4 letters + 3 numbers)'),
});
type FormData = z.infer<typeof schema>;

export default function FacultyPage() {
  const [faculty, setFaculty]         = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [allSections, setAllSections] = useState<any[]>([]);
  const [open, setOpen]               = useState(false);
  const [saving, setSaving]           = useState(false);
  const [selected, setSelected]       = useState<any>(null);
  const [editSaving, setEditSaving]   = useState(false);
  const [toggleTarget, setToggleTarget] = useState<any>(null);
  const [toggling, setToggling]       = useState(false);

  const { register, handleSubmit, setValue, reset, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const firstName = watch('first_name');
  const lastName  = watch('last_name');

  useEffect(() => { register('gender'); }, [register]);

  const generateCredentials = useCallback(() => {
    if (!firstName || !lastName) return;
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    const nums    = '0123456789';
    let randLetters = '';
    let randNums = '';
    for (let i = 0; i < 4; i++) randLetters += letters.charAt(Math.floor(Math.random() * letters.length));
    for (let i = 0; i < 3; i++) randNums += nums.charAt(Math.floor(Math.random() * nums.length));
    
    const suffix = `${randLetters}${randNums}`;
    const generatedEmail = `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${suffix}@acadtrack.edu`.replace(/\s+/g, '');
    const generatedPass  = suffix.toUpperCase(); // Or follow the exact 4+3 rule for password too

    setValue('email', generatedEmail);
    setValue('temp_password', generatedPass);
  }, [firstName, lastName, setValue]);

  const load = useCallback(async () => {
    setLoading(true);
    const [facultyRes, sectionsRes] = await Promise.all([
      userService.list({ role: 'Faculty', limit: 100 }),
      fetch('/api/sections?limit=250').then(r => r.json()).catch(() => ({ data: [] })),
    ]);
    if (facultyRes.success) setFaculty(facultyRes.data?.users ?? []);
    if (sectionsRes.data) setAllSections(sectionsRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function onSubmit(data: FormData) {
    setSaving(true);
    try {
      const res = await fetch('/api/faculty', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(r => r.json());
      if (!res.success) { toast.error(res.message); return; }
      toast.success('Faculty member added.');
      reset(); setOpen(false); load();
    } catch { toast.error('An error occurred.'); }
    finally { setSaving(false); }
  }

  async function onEditSave(data: any) {
    if (!selected) return;
    setEditSaving(true);
    const res = await userService.update(selected.user_id, data);
    setEditSaving(false);
    if (!res.success) { toast.error(res.message); return; }
    toast.success('Profile updated.');
    setSelected({ ...selected, ...data });
    load();
  }

  async function handleToggle() {
    if (!toggleTarget) return;
    setToggling(true);
    const res = await userService.toggleActive(toggleTarget.user_id);
    setToggling(false);
    if (!res.success) { toast.error(res.message); return; }
    const newActive = res.data?.is_active;
    toast.success(newActive ? 'Account enabled.' : 'Account disabled.');
    setSelected({ ...selected, is_active: newActive });
    setToggleTarget(null);
    load();
  }

  const isActive = selected?.is_active !== false;

  return (
    <div>
      <PageHeader
        title="Faculty"
        description="Manage faculty members"
        action={<Button onClick={() => { reset(); setOpen(true); }}><Plus className="mr-2 h-4 w-4" />Add Faculty member</Button>}
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
                  <TableHead>Status</TableHead>
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
                      <Badge variant={f.is_active !== false ? 'default' : 'secondary'}>
                        {f.is_active !== false ? 'Active' : 'Disabled'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => setSelected(f)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <FacultyDetailsModal
        faculty={selected}
        sections={allSections}
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        onEdit={onEditSave}
        onToggleActive={setToggleTarget}
        isToggling={toggling}
        isSaving={editSaving}
      />

      {/* Add Faculty Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-lg p-0 overflow-hidden">
          <DialogHeader className="p-0">
            <div className="bg-indigo-600 px-6 pt-6 pb-10 relative">
              <DialogClose className="absolute top-3 right-3 text-white/70 hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </DialogClose>
              <DialogDescription className="text-white/80 text-xs uppercase tracking-widest font-semibold mb-1">
                Faculty Management
              </DialogDescription>
              <DialogTitle className="text-white text-xl font-bold">
                Add Faculty Member
              </DialogTitle>
            </div>
          </DialogHeader>
          <div className="p-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5"><Label className="text-[11px] font-bold uppercase tracking-wider">First Name</Label><Input {...register('first_name')} />{errors.first_name && <p className="text-xs text-destructive">{errors.first_name.message}</p>}</div>
                <div className="space-y-1.5"><Label className="text-[11px] font-bold uppercase tracking-wider">Middle Name</Label><Input {...register('middle_name')} /></div>
                <div className="space-y-1.5"><Label className="text-[11px] font-bold uppercase tracking-wider">Last Name</Label><Input {...register('last_name')} />{errors.last_name && <p className="text-xs text-destructive">{errors.last_name.message}</p>}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] font-bold uppercase tracking-wider">Institutional Email</Label>
                    <button type="button" onClick={generateCredentials} className="text-[10px] text-indigo-600 hover:underline font-bold">Auto-gen</button>
                  </div>
                  <Input type="email" {...register('email')} placeholder="official@acadtrack.edu" />
                  {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                </div>
                <div className="space-y-1.5"><Label className="text-[11px] font-bold uppercase tracking-wider">Personal Email</Label><Input type="email" {...register('personal_email')} placeholder="personal@gmail.com" />{errors.personal_email && <p className="text-xs text-destructive">{errors.personal_email.message}</p>}</div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] font-bold uppercase tracking-wider">Temporary Password</Label>
                </div>
                <Input type="text" {...register('temp_password')} placeholder="Specify or auto-generate..." />
                {errors.temp_password && <p className="text-xs text-destructive">{errors.temp_password.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-wider">Gender</Label>
                  <Select onValueChange={v => setValue('gender', v as any)}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label className="text-[11px] font-bold uppercase tracking-wider">Date of Birth</Label><Input type="date" {...register('date_of_birth')} /></div>
              </div>
              <div className="space-y-1.5"><Label className="text-[11px] font-bold uppercase tracking-wider">Phone Number</Label><Input {...register('phone')} maxLength={11} placeholder="09XXXXXXXXX" />{errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}</div>
              <div className="space-y-1.5"><Label className="text-[11px] font-bold uppercase tracking-wider">Physical Address</Label><Input {...register('address')} /></div>
              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 font-bold" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add Faculty
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Toggle Confirm */}
      <ConfirmDialog
        open={!!toggleTarget}
        onOpenChange={o => !o && setToggleTarget(null)}
        title={isActive ? 'Disable Account?' : 'Enable Account?'}
        description={isActive
          ? `${toggleTarget?.first_name} ${toggleTarget?.last_name} will no longer be able to log in.`
          : `Re-enable login access for ${toggleTarget?.first_name} ${toggleTarget?.last_name}.`}
        onConfirm={handleToggle}
        loading={toggling}
        confirmLabel={isActive ? 'Disable' : 'Enable'}
      />
    </div>
  );
}
