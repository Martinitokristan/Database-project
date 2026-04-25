'use client';

import { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useAuth } from '@/hooks/useAuth';
import { semesterService } from '@/services/semesterService';
import { sectionService } from '@/services/sectionService';
import { profileService } from '@/services/profileService';
import { subjectService } from '@/services/subjectService';
import { userService } from '@/services/userService';
import { toast } from 'sonner';
import {
  CalendarRange, Clock, User, Star,
  CheckCircle, XCircle, AlertCircle,
  Plus, Pencil, Trash2, Loader2, ChevronDown, ChevronRight,
  BookOpen, BookMarked, Users, FileDown, Bell, Eye, Archive, Layers,
} from 'lucide-react';

/* ─── Zod schema for admin form ─────────────────────────── */
const schema = z.object({
  school_year:    z.string().min(4, 'Required (e.g. 2025-2026)'),
  term:           z.string().min(2, 'Required'),
  start_date:     z.string().min(1, 'Required'),
  end_date:       z.string().min(1, 'Required'),
  midterm_deadline: z.string().optional(),
  final_deadline:   z.string().optional(),
  status:           z.enum(['Active', 'Inactive', 'Closed']),
});
type FormData = z.infer<typeof schema>;

function semesterEnded(sem: any): boolean {
  return sem.status === 'Closed' || new Date(sem.end_date) < new Date();
}

/* ─── Helpers ────────────────────────────────────────────── */
function StatusIcon({ status }: { status?: string }) {
  if (!status) return <AlertCircle className="h-4 w-4 text-amber-500" />;
  if (status === 'Passed')  return <CheckCircle className="h-4 w-4 text-green-600" />;
  if (status === 'Failed')  return <XCircle className="h-4 w-4 text-red-600" />;
  return <AlertCircle className="h-4 w-4 text-amber-500" />;
}

function GradeCell({ value }: { value: any }) {
  return <span className="font-medium">{value ?? <span className="text-muted-foreground">—</span>}</span>;
}

const DAY_ORDER = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const DAY_ABBR: Record<string, string> = {
  Monday:'Mon', Tuesday:'Tue', Wednesday:'Wed', Thursday:'Thu',
  Friday:'Fri', Saturday:'Sat', Sunday:'Sun',
};
function fmtTime(t: string) {
  const [h, m] = t.slice(0, 5).split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2,'0')}${h >= 12 ? 'PM' : 'AM'}`;
}
function formatSchedules(schedules: any[]): string[] {
  const groups: Record<string, { days: string[]; start: string; end: string; room: string }> = {};
  for (const s of schedules) {
    const key = `${s.start_time}|${s.end_time}|${s.room}`;
    if (!groups[key]) groups[key] = { days: [], start: s.start_time, end: s.end_time, room: s.room };
    groups[key].days.push(s.day_of_week);
  }
  return Object.values(groups).map(g => {
    const days = g.days
      .sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b))
      .map(d => DAY_ABBR[d] ?? d.slice(0, 3))
      .join('-');
    return `${days} · ${fmtTime(g.start)}–${fmtTime(g.end)} · ${g.room}`;
  });
}

/* ═══════════════════════════════════════════════════════════
   ADMIN VIEW — Semester CRUD management
═══════════════════════════════════════════════════════════ */
function AdminSemestersView() {
  const [semesters, setSemesters]     = useState<any[]>([]);
  const [allSections, setAllSections] = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [open, setOpen]               = useState(false);
  const [editing, setEditing]         = useState<any>(null);
  const [saving, setSaving]             = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting]         = useState(false);
  const [notifyTarget, setNotifyTarget] = useState<any>(null);
  const [notifyType, setNotifyType]     = useState<'midterm' | 'final'>('midterm');
  const [notifying, setNotifying]       = useState(false);
  const [activeTab, setActiveTab]       = useState('semesters');
  
  // For Add Section inside Semesters Page
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [viewSectionTarget, setViewSectionTarget] = useState<any>(null);
  const [subjects, setSubjects]             = useState<any[]>([]);
  const [faculty, setFaculty]               = useState<any[]>([]);
  const [notifyDone, setNotifyDone]     = useState<{ sent: number; faculty: string[] } | null>(null);
  const [renamingSection, setRenamingSection] = useState(false);
  const [renameValue, setRenameValue]         = useState('');

  const { register, handleSubmit, setValue, reset, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'Inactive' },
  });
  const statusValue = watch('status');

  const load = useCallback(async () => {
    setLoading(true);
    const [semRes, secRes, subRes, facRes] = await Promise.all([
      semesterService.list(),
      sectionService.list(),
      subjectService.list(),
      userService.list({ role: 'Faculty', limit: 100 })
    ]);
    if (semRes.success) setSemesters(semRes.data ?? []);
    if (secRes.success) setAllSections(secRes.data ?? []);
    if (subRes.success) setSubjects(subRes.data ?? []);
    if (facRes.success) setFaculty(facRes.data?.users ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    reset({ school_year: '', term: '', start_date: '', end_date: '', midterm_deadline: '', final_deadline: '', status: 'Inactive' });
    setEditing(null);
    setOpen(true);
  }

  function openEdit(s: any) {
    reset({
      school_year:    s.school_year,
      term:           s.term,
      start_date:     s.start_date?.slice(0, 10),
      end_date:       s.end_date?.slice(0, 10),
      midterm_deadline: s.midterm_deadline?.slice(0, 10) ?? '',
      final_deadline:   s.final_deadline?.slice(0, 10) ?? '',
      status:         s.status,
    });
    setEditing(s);
    setOpen(true);
  }

  async function handleNotify() {
    if (!notifyTarget) return;
    setNotifying(true);
    try {
      const res  = await fetch(`/api/semesters/${notifyTarget.semester_id}/notify`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: notifyType }),
      });
      const json = await res.json();
      if (!json.success) { toast.error(json.message); return; }
      setNotifyDone(json.data);
      toast.success(`${json.data.type} notification sent successfully to ${json.data.sent} faculty.`);
    } finally { setNotifying(false); }
  }

  async function onSubmit(data: FormData) {
    setSaving(true);
    try {
      const payload = { ...data, midterm_deadline: data.midterm_deadline || null, final_deadline: data.final_deadline || null };
      const res = editing
        ? await semesterService.update(editing.semester_id, payload)
        : await semesterService.create(payload);
      if (!res.success) { toast.error(res.message); return; }
      toast.success(editing ? 'Semester updated.' : 'Semester created.');
      if (data.status === 'Active') toast.info('Previous active semester set to Inactive.');
      if (data.status === 'Closed') toast.info('Semester closed. GWA is now visible to students.');
      setOpen(false);
      load();
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await semesterService.remove(deleteTarget.semester_id);
    setDeleting(false);
    if (!res.success) { toast.error(res.message); return; }
    toast.success('Semester deleted.');
    setDeleteTarget(null);
    load();
  }

  const active = semesters.find(s => s.status === 'Active');

  return (
    <div>
      <PageHeader
        title="Semesters & Sections"
        description={active ? `Active Term: ${active.term} ${active.school_year}` : 'Manage academic terms and section archives'}
        action={
          activeTab === 'semesters' ? (
            <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 shadow-md">
              <Plus className="mr-2 h-4 w-4" />Add Semester
            </Button>
          ) : (
            <Button onClick={() => setAddSectionOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 shadow-md">
              <Plus className="mr-2 h-4 w-4" />Add Section
            </Button>
          )
        }
      />
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="semesters">Semesters</TabsTrigger>
            <TabsTrigger value="sections">Section Management</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="semesters" className="m-0">
          <Card>
            <CardContent className="pt-4">
              {loading ? <LoadingSpinner /> : semesters.length === 0 ? <EmptyState title="No semesters yet" /> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Term</TableHead>
                      <TableHead>School Year</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead>Midterm Deadline</TableHead>
                      <TableHead>Final Deadline</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-32" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {semesters.map(s => (
                      <TableRow key={s.semester_id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <CalendarRange className="h-4 w-4 text-muted-foreground" />
                            {s.term}
                          </div>
                        </TableCell>
                        <TableCell>{s.school_year}</TableCell>
                        <TableCell className="text-sm">{s.start_date?.slice(0, 10)}</TableCell>
                        <TableCell className="text-sm">{s.end_date?.slice(0, 10)}</TableCell>
                        <TableCell className="text-sm">
                          {s.midterm_deadline
                            ? <span className="font-medium text-orange-600">{s.midterm_deadline.slice(0, 10)}</span>
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-sm">
                          {s.final_deadline
                            ? <span className="font-medium text-red-600">{s.final_deadline.slice(0, 10)}</span>
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          <Badge variant={s.status === 'Active' ? 'default' : s.status === 'Closed' ? 'destructive' : 'secondary'}>
                            {s.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(s)} title="Edit">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost"
                            onClick={() => { setNotifyTarget(s); setNotifyType('midterm'); setNotifyDone(null); }}
                            disabled={!s.midterm_deadline && !s.final_deadline}
                            title="Notify Faculty">
                            <Bell className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive"
                            onClick={() => setDeleteTarget(s)} disabled={s.status === 'Active'} title="Delete">
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
        </TabsContent>

        <TabsContent value="sections" className="m-0">
          <Card>
            <CardContent className="pt-4">
              {loading ? <LoadingSpinner /> : allSections.length === 0 ? <EmptyState title="No sections defined" /> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Section</TableHead>
                      <TableHead>Capacity</TableHead>
                      <TableHead>Semester</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-24" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allSections.map(sec => (
                      <TableRow key={sec.section_id} className={sec.is_archived ? "opacity-60 bg-muted/20" : ""}>
                        <TableCell className="font-medium font-mono text-xs">{sec.section_name}</TableCell>
                        <TableCell className="text-xs">
                          {sec.enrolled_count} / {sec.capacity}
                        </TableCell>
                        <TableCell className="text-xs">{sec.school_year} - {sec.term}</TableCell>
                        <TableCell>
                          <Badge variant={sec.is_archived ? "secondary" : "default"} className={!sec.is_archived ? "bg-emerald-500 hover:bg-emerald-500" : ""}>
                            {sec.is_archived ? 'Archived' : 'Active'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="hover:bg-indigo-50 transition-all font-semibold text-indigo-600 gap-1.5"
                            onClick={() => setViewSectionTarget(sec)}
                          >
                            <Eye className="h-4 w-4" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
          </TableBody>
        </Table>
      )}
    </CardContent>
  </Card>
</TabsContent>

{/* ── Global Add Section Dialog ── */}
<Dialog open={addSectionOpen} onOpenChange={setAddSectionOpen}>
  <DialogContent className="sm:max-w-[425px]">
    <DialogHeader>
      <DialogTitle>Add New Section</DialogTitle>
    </DialogHeader>
    <form className="space-y-4 py-4" onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setSaving(true);
        try {
          const res = await fetch('/api/sections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              semester_id: Number(fd.get('semester_id')),
              section_name: fd.get('section_name'),
              capacity: Number(fd.get('capacity') || 40)
            })
          }).then(r => r.json());

          if (res.success) {
            toast.success('Section created successfully.');
            setAddSectionOpen(false);
            load();
          } else toast.error(res.message);
        } catch (err) {
          toast.error('Failed to create section.');
        } finally {
          setSaving(false);
        }
      }}>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Term</Label>
            <Select name="semester_id" required>
              <SelectTrigger><SelectValue placeholder="Select term..." /></SelectTrigger>
              <SelectContent>
                {semesters.map(s => <SelectItem key={s.semester_id} value={String(s.semester_id)}>{s.school_year} - {s.term}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Section Name</Label>
            <Input name="section_name" placeholder="e.g., BSIT 1-A" required />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Capacity</Label>
            <Input name="capacity" type="number" defaultValue={40} required />
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button type="button" variant="outline" onClick={() => setAddSectionOpen(false)}>Cancel</Button>
          <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">Save Section</Button>
        </DialogFooter>
    </form>
  </DialogContent>
</Dialog>

      {/* ── Section Eyeview Modal ── */}
      <Dialog open={!!viewSectionTarget} onOpenChange={o => !o && setViewSectionTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Section Details</DialogTitle>
          </DialogHeader>
          {viewSectionTarget && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground flex items-center gap-1">
                    Section Name
                    <Button 
                      variant="ghost" size="icon" className="h-4 w-4 text-slate-400 hover:text-indigo-600"
                      onClick={() => {
                        setRenameValue(viewSectionTarget.section_name);
                        setRenamingSection(true);
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </Label>
                  {renamingSection ? (
                    <div className="flex items-center gap-2 mt-1">
                      <Input 
                        value={renameValue} 
                        onChange={e => setRenameValue(e.target.value)}
                        className="h-8 text-sm font-bold"
                        autoFocus
                      />
                      <Button size="sm" className="h-8" onClick={async () => {
                        if (!renameValue.trim()) return;
                        setSaving(true);
                        const res = await sectionService.update(viewSectionTarget.section_id, { section_name: renameValue.trim() });
                        setSaving(false);
                        if (res.success) {
                          toast.success('Section renamed.');
                          setRenamingSection(false);
                          setViewSectionTarget({ ...viewSectionTarget, section_name: renameValue.trim() });
                          load();
                        } else toast.error(res.message);
                      }}>Save</Button>
                      <Button size="sm" variant="ghost" className="h-8" onClick={() => setRenamingSection(false)}>Cancel</Button>
                    </div>
                  ) : (
                    <p className="font-bold text-lg">{viewSectionTarget.section_name}</p>
                  )}
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div>
                    <Badge variant={viewSectionTarget.is_archived ? "secondary" : "default"}>
                      {viewSectionTarget.is_archived ? 'Archived' : 'Active'}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Enrollment</Label>
                  <p className="font-medium">{viewSectionTarget.enrolled_count} / {viewSectionTarget.capacity}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Term</Label>
                  <p className="font-medium">{viewSectionTarget.school_year} - {viewSectionTarget.term}</p>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-4 border-t">
                <Button asChild variant="outline" className="w-full justify-start gap-2 h-10 border-indigo-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-all">
                  <Link href={`/sections/${viewSectionTarget.section_id}`}>
                    <Layers className="h-4 w-4" />
                    View Full Schedule & Classes
                  </Link>
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-2"
                  onClick={async () => {
                    const res = await sectionService.update(viewSectionTarget.section_id, { is_archived: !viewSectionTarget.is_archived });
                    if (res.success) {
                      toast.success(viewSectionTarget.is_archived ? 'Section restored.' : 'Section archived.');
                      setViewSectionTarget(null);
                      load();
                    } else toast.error(res.message);
                  }}
                >
                  <Archive className="h-4 w-4" />
                  {viewSectionTarget.is_archived ? 'Restore Section' : 'Archive Section'}
                </Button>
                <Button 
                  variant="destructive" 
                  className="w-full justify-start gap-2"
                  onClick={async () => {
                    if (confirm('Delete this section permanently?')) {
                      const res = await sectionService.remove(viewSectionTarget.section_id);
                      if (res.success) { 
                        toast.success('Section deleted'); 
                        setViewSectionTarget(null);
                        load(); 
                      } else toast.error(res.message);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Section
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader><DialogTitle>{editing ? 'Edit Semester' : 'Add Semester'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>School Year</Label>
                <Input placeholder="2025-2026" {...register('school_year')} />
                {errors.school_year && <p className="text-xs text-destructive">{errors.school_year.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Term</Label>
                <Select defaultValue={editing?.term ?? ''} onValueChange={v => setValue('term', v)}>
                  <SelectTrigger><SelectValue placeholder="Select term" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="First Semester">First Semester</SelectItem>
                    <SelectItem value="Second Semester">Second Semester</SelectItem>
                    <SelectItem value="Summer">Summer</SelectItem>
                    <SelectItem value="Midyear">Midyear</SelectItem>
                  </SelectContent>
                </Select>
                {errors.term && <p className="text-xs text-destructive">{errors.term.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Input type="date" {...register('start_date')} />
                {errors.start_date && <p className="text-xs text-destructive">{errors.start_date.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>End Date</Label>
                <Input type="date" {...register('end_date')} />
                {errors.end_date && <p className="text-xs text-destructive">{errors.end_date.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Midterm Grade Deadline <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input type="date" {...register('midterm_deadline')} />
              </div>
              <div className="space-y-1.5">
                <Label>Final Grade Deadline <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input type="date" {...register('final_deadline')} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">Set deadlines for faculty to submit grades. Used to trigger notifications.</p>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={statusValue} onValueChange={v => setValue('status', v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                  <SelectItem value="Closed">Closed</SelectItem>
                </SelectContent>
              </Select>
              {statusValue === 'Active' && (
                <p className="text-xs text-amber-600">Setting this as Active will deactivate the current active semester.</p>
              )}
              {statusValue === 'Closed' && (
                <p className="text-xs text-red-600">Closing this semester will make GWA visible to students. This cannot be undone easily.</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}
        title="Delete Semester?"
        description={`Delete "${deleteTarget?.term} ${deleteTarget?.school_year}"? This will fail if the semester has associated sections.`}
        onConfirm={handleDelete} loading={deleting}
      />

      {/* ── Notify Faculty Dialog ── */}
      <Dialog open={!!notifyTarget} onOpenChange={o => { if (!o) { setNotifyTarget(null); setNotifyDone(null); } }}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-orange-500" />
              Notify Faculty — Grade Deadline
            </DialogTitle>
          </DialogHeader>
          {notifyDone ? (
            <div className="space-y-3">
              <p className="text-sm text-green-700 font-medium">✓ Emails sent to {notifyDone.sent} faculty member{notifyDone.sent !== 1 ? 's' : ''}.</p>
              <div className="rounded-md bg-muted p-3 max-h-40 overflow-y-auto">
                {notifyDone.faculty.map((f, i) => (
                  <p key={i} className="text-xs text-muted-foreground">{f}</p>
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setNotifyTarget(null); setNotifyDone(null); }}>Close</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md bg-muted p-3 space-y-1 text-sm">
                <p><span className="text-muted-foreground">Semester:</span> <strong>{notifyTarget?.term} {notifyTarget?.school_year}</strong></p>
                <p><span className="text-muted-foreground">End Date:</span> {notifyTarget?.end_date?.slice(0, 10)}</p>
                <p><span className="text-muted-foreground">Midterm Deadline:</span>{' '}
                  {notifyTarget?.midterm_deadline
                    ? <strong className="text-orange-600">{notifyTarget.midterm_deadline.slice(0, 10)}</strong>
                    : <span className="text-muted-foreground">— Not set</span>}
                </p>
                <p><span className="text-muted-foreground">Final Deadline:</span>{' '}
                  {notifyTarget?.final_deadline
                    ? <strong className="text-red-600">{notifyTarget.final_deadline.slice(0, 10)}</strong>
                    : <span className="text-muted-foreground">— Not set</span>}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Notify for which deadline?</Label>
                <div className="flex gap-2">
                  <Button
                    size="sm" variant={notifyType === 'midterm' ? 'default' : 'outline'}
                    onClick={() => setNotifyType('midterm')}
                    disabled={!notifyTarget?.midterm_deadline}
                  >
                    Midterm {notifyTarget?.midterm_deadline ? `( ${notifyTarget.midterm_deadline.slice(0,10)} )` : '(not set)'}
                  </Button>
                  <Button
                    size="sm" variant={notifyType === 'final' ? 'default' : 'outline'}
                    onClick={() => setNotifyType('final')}
                    disabled={!notifyTarget?.final_deadline}
                  >
                    Finals {notifyTarget?.final_deadline ? `( ${notifyTarget.final_deadline.slice(0,10)} )` : '(not set)'}
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                An email + in-app notification will be sent to all faculty with sections in this semester.
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setNotifyTarget(null)}>Cancel</Button>
                <Button
                  onClick={handleNotify}
                  disabled={notifying || (notifyType === 'midterm' ? !notifyTarget?.midterm_deadline : !notifyTarget?.final_deadline)}
                >
                  {notifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Notify Faculty for {notifyType === 'midterm' ? 'Midterm' : 'Finals'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   STUDENT VIEW — Subjects, schedules & grades per semester
═══════════════════════════════════════════════════════════ */
function computeGwa(subjects: any[]): string | null {
  const graded = subjects.filter(s => s.average != null);
  if (!graded.length) return null;
  const sum = graded.reduce((acc, s) => acc + Number(s.average), 0);
  return (sum / graded.length).toFixed(2);
}

function StudentSemestersView() {
  const { user }                  = useAuth();
  const [semesters, setSemesters] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [expanded, setExpanded]   = useState<number | null>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [profile, setProfile]     = useState<any>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    semesterService.list().then(res => {
      if (res.success) setSemesters(res.data ?? []);
      setLoading(false);
    });
    if (user?.user_id) {
      profileService.get(user.user_id).then(res => {
        if (res.success) setProfile(res.data);
      });
    }
  }, [user?.user_id]);

  async function fetchSemesterSubjects(semesterId: number): Promise<any[]> {
    const res  = await fetch(`/api/student/semesters/${semesterId}`, { credentials: 'include' });
    const json = await res.json();
    return json.success ? json.data : [];
  }

  async function toggleExpand(semesterId: number) {
    if (expanded === semesterId) { setExpanded(null); return; }
    setExpanded(semesterId);
    const already = semesters.find(s => s.semester_id === semesterId);
    if (already?.subjects) return;
    setLoadingId(semesterId);
    const subjects = await fetchSemesterSubjects(semesterId);
    setSemesters(prev => prev.map(s =>
      s.semester_id === semesterId ? { ...s, subjects } : s
    ));
    setLoadingId(null);
  }

  async function handleDownloadAllPdf() {
    setExporting(true);
    try {
      /* ── Load any unloaded semesters ── */
      const allSemesters: any[] = await Promise.all(
        semesters.map(async sem => {
          if (sem.subjects) return sem;
          const subjects = await fetchSemesterSubjects(sem.semester_id);
          return { ...sem, subjects };
        })
      );
      setSemesters(allSemesters);

      const withData = allSemesters.filter(s => s.subjects?.length > 0);
      if (!withData.length) { toast.error('No grade data found to export.'); return; }

      const { default: jsPDF }     = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF({ orientation: 'landscape' });
      const pw  = doc.internal.pageSize.getWidth();
      const ph  = doc.internal.pageSize.getHeight();
      const studentName = profile
        ? `${profile.first_name}${profile.middle_name ? ' ' + profile.middle_name : ''} ${profile.last_name}`.trim()
        : String(user?.user_id ?? '');

      /* ── Page 1: Cover / Student Info ── */
      doc.setFillColor(37, 99, 235);
      doc.rect(0, 0, pw, 28, 'F');
      doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
      doc.text('AcadTrack', 14, 16);
      doc.setFontSize(10); doc.setFont('helvetica', 'normal');
      doc.text('Student Complete Grade Report', pw - 14, 16, { align: 'right' });

      doc.setTextColor(30, 41, 59); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
      doc.text('Student Information', 14, 40);
      doc.setDrawColor(226, 232, 240); doc.line(14, 42, pw - 14, 42);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(71, 85, 105);
      doc.text(`Student ID  :  ${user?.user_id ?? '—'}`, 14, 50);
      doc.text(`Full Name   :  ${studentName}`,           14, 58);
      doc.text(`Report Date :  ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, pw / 2, 50);
      doc.text(`Total Semesters : ${withData.length}`,    pw / 2, 58);

      /* ── Overall GWA ── */
      const allGraded = withData.flatMap(s => (s.subjects ?? []).filter((subj: any) => subj.average != null));
      const overallGwa = allGraded.length
        ? (allGraded.reduce((a: number, s: any) => a + Number(s.average), 0) / allGraded.length).toFixed(2)
        : '—';
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(30, 41, 59);
      doc.text(`Cumulative GWA  :  ${overallGwa}`, 14, 68);
      doc.setDrawColor(226, 232, 240); doc.line(14, 72, pw - 14, 72);

      /* ── One section per semester ── */
      let cursorY = 80;

      for (let si = 0; si < withData.length; si++) {
        const sem      = withData[si];
        const subjects = sem.subjects as any[];
        const gwa      = computeGwa(subjects) ?? '—';
        const passed   = subjects.filter(s => s.remarks === 'Passed').length;
        const failed   = subjects.filter(s => s.remarks === 'Failed').length;
        const inc      = subjects.filter(s => !s.remarks || s.remarks === 'Incomplete').length;
        const startD   = sem.start_date ? new Date(sem.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
        const endD     = sem.end_date   ? new Date(sem.end_date).toLocaleDateString('en-US',   { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

        /* Page break if near bottom */
        if (cursorY > ph - 60) { doc.addPage(); cursorY = 20; }

        /* Semester header band */
        doc.setFillColor(239, 246, 255);
        doc.rect(14, cursorY - 4, pw - 28, 18, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(37, 99, 235);
        doc.text(`${sem.term}  ${sem.school_year}`, 18, cursorY + 6);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(71, 85, 105);
        doc.text(`${startD} – ${endD}`, 18, cursorY + 12);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(30, 41, 59);
        doc.text(`Semester GWA: ${gwa}`, pw - 14, cursorY + 6, { align: 'right' });
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(71, 85, 105);
        doc.text(`Passed: ${passed}  Failed: ${failed}  Incomplete: ${inc}`, pw - 14, cursorY + 12, { align: 'right' });

        cursorY += 20;

        autoTable(doc, {
          startY: cursorY,
          head: [['Code', 'Subject Title', 'Instructor', 'Schedule', 'Prelim', 'Midterm', 'Final', 'Average', 'Status']],
          body: subjects.map(s => [
            s.subject_code,
            s.subject_title,
            s.instructor_first_name && s.instructor_last_name
              ? `${s.instructor_last_name}, ${s.instructor_first_name}`
              : '—',
            s.schedules?.length ? formatSchedules(s.schedules).join('\n') : '—',
            s.prelim_grade  ?? '—',
            s.midterm_grade ?? '—',
            s.final_grade   ?? '—',
            s.average       ?? '—',
            s.remarks       || 'Incomplete',
          ]),
          headStyles: { fillColor: [37, 99, 235], fontStyle: 'bold', fontSize: 7.5, textColor: [255,255,255], halign: 'center' },
          bodyStyles: { fontSize: 8, valign: 'middle' },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          columnStyles: {
            0: { cellWidth: 20, halign: 'center' },
            1: { cellWidth: 50 },
            2: { cellWidth: 36 },
            3: { cellWidth: 44, fontSize: 7 },
            4: { cellWidth: 15, halign: 'center' },
            5: { cellWidth: 15, halign: 'center' },
            6: { cellWidth: 15, halign: 'center' },
            7: { cellWidth: 15, halign: 'center' },
            8: { cellWidth: 22, halign: 'center' },
          },
          margin: { left: 14, right: 14 },
          didParseCell: data => {
            if (data.column.index === 8 && data.section === 'body') {
              const v = data.cell.raw as string;
              if (v === 'Passed')      data.cell.styles.textColor = [22, 163, 74];
              else if (v === 'Failed') data.cell.styles.textColor = [220, 38, 38];
              else                    data.cell.styles.textColor = [217, 119, 6];
            }
          },
        });

        cursorY = (doc as any).lastAutoTable.finalY + 10;
        /* Separator between semesters */
        if (si < withData.length - 1) {
          doc.setDrawColor(203, 213, 225);
          doc.line(14, cursorY - 5, pw - 14, cursorY - 5);
        }
      }

      /* ── Page footers ── */
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7); doc.setTextColor(148, 163, 184);
        doc.text(
          `This is an official grade report generated by AcadTrack  ·  Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
          14, ph - 8
        );
        doc.text(`Page ${i} of ${pageCount}`, pw - 14, ph - 8, { align: 'right' });
      }

      doc.save(`grade-report-all-semesters-${user?.user_id}.pdf`);
    } catch (e) {
      console.error(e);
      toast.error('Failed to generate PDF.');
    } finally {
      setExporting(false);
    }
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader
        title="My Semesters"
        description="View subjects, schedules, and grades per semester"
        action={
          <Button onClick={handleDownloadAllPdf} disabled={exporting}>
            {exporting
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <FileDown className="mr-2 h-4 w-4" />}
            Download All Semesters PDF
          </Button>
        }
      />
      {semesters.length === 0 ? <EmptyState title="No semesters available" /> : (
        <div className="space-y-3">
          {semesters.map(sem => {
            const gwa = sem.subjects ? computeGwa(sem.subjects) : null;
            return (
            <Card key={sem.semester_id}>
              <CardHeader
                className="cursor-pointer hover:bg-muted/40 transition-colors py-4"
                onClick={() => toggleExpand(sem.semester_id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CalendarRange className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-base">{sem.term} {sem.school_year}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {new Date(sem.start_date).toLocaleDateString()} – {new Date(sem.end_date).toLocaleDateString()}
                      </p>
                      {gwa && semesterEnded(sem) && (
                        <p className="text-xs font-semibold text-primary mt-0.5">GWA: {gwa}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={sem.status === 'Active' ? 'default' : sem.status === 'Closed' ? 'destructive' : 'secondary'}>{sem.status}</Badge>
                    {expanded === sem.semester_id
                      ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>
              </CardHeader>

              {expanded === sem.semester_id && (
                <CardContent className="pt-0 pb-4">
                  {loadingId === sem.semester_id ? <LoadingSpinner /> :
                   !sem.subjects ? null :
                   sem.subjects.length === 0
                    ? <EmptyState title="No subjects enrolled this semester" />
                    : (
                      <div className="space-y-3">
                        {sem.subjects.map((subj: any) => (
                          <div key={subj.section_id} className="rounded-lg border bg-muted/30 p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Left — subject info */}
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm font-semibold">{subj.subject_code}</span>
                                  <Badge variant="outline" className="text-xs">{subj.section_name}</Badge>
                                </div>
                                <p className="text-sm">{subj.subject_title}</p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <User className="h-3 w-3" />
                                  {subj.instructor_first_name} {subj.instructor_last_name}
                                </div>
                                {subj.schedules?.length > 0 && (
                                  <div className="space-y-0.5 pt-1">
                                    {formatSchedules(subj.schedules).map((line, i) => (
                                      <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Clock className="h-3 w-3 shrink-0" />
                                        {line}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Right — grades */}
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2 text-xs font-medium">
                                  <Star className="h-3.5 w-3.5 text-muted-foreground" />
                                  Grades
                                </div>
                                <table className="w-full text-sm border-collapse">
                                  <thead>
                                    <tr className="border-b">
                                      {['Prelim', 'Midterm', 'Final', 'Average', 'Status'].map(h => (
                                        <th key={h} className="py-1.5 px-2 text-xs font-medium text-muted-foreground text-center">{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    <tr>
                                      {[subj.prelim_grade, subj.midterm_grade, subj.final_grade, subj.average].map((v, i) => (
                                        <td key={i} className="py-2 px-2 text-center font-semibold">
                                          {v ?? <span className="text-muted-foreground font-normal">—</span>}
                                        </td>
                                      ))}
                                      <td className="py-2 px-2 text-center">
                                        <span className="inline-flex items-center gap-1 text-xs font-medium">
                                          <StatusIcon status={subj.remarks} />
                                          {subj.remarks || 'Incomplete'}
                                        </span>
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  }
                </CardContent>
              )}
            </Card>
          );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   FACULTY VIEW — Teaching sections per semester
═══════════════════════════════════════════════════════════ */
function FacultySemestersView() {
  const [semesters, setSemesters] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [expanded, setExpanded]   = useState<number | null>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);

  useEffect(() => {
    semesterService.list().then(res => {
      if (res.success) setSemesters(res.data ?? []);
      setLoading(false);
    });
  }, []);

  async function toggleExpand(semesterId: number) {
    if (expanded === semesterId) { setExpanded(null); return; }
    setExpanded(semesterId);
    const already = semesters.find(s => s.semester_id === semesterId);
    if (already?.sections) return;
    setLoadingId(semesterId);
    const res = await fetch(`/api/faculty/semesters/${semesterId}`, { credentials: 'include' });
    const json = await res.json();
    if (json.success) {
      setSemesters(prev => prev.map(s =>
        s.semester_id === semesterId ? { ...s, sections: json.data } : s
      ));
    }
    setLoadingId(null);
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader title="Semesters" description="Your teaching sections per semester" />
      {semesters.length === 0 ? <EmptyState title="No semesters available" /> : (
        <div className="space-y-3">
          {semesters.map(sem => (
            <Card key={sem.semester_id}>
              <CardHeader
                className="cursor-pointer hover:bg-muted/40 transition-colors py-4"
                onClick={() => toggleExpand(sem.semester_id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CalendarRange className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-base">{sem.term} {sem.school_year}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {new Date(sem.start_date).toLocaleDateString()} – {new Date(sem.end_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={sem.status === 'Active' ? 'default' : sem.status === 'Closed' ? 'destructive' : 'secondary'}>{sem.status}</Badge>
                    {expanded === sem.semester_id
                      ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>
              </CardHeader>

              {expanded === sem.semester_id && (
                <CardContent className="pt-0 pb-4">
                  {loadingId === sem.semester_id ? <LoadingSpinner /> :
                   !sem.sections ? null :
                   sem.sections.length === 0
                    ? <EmptyState title="No sections assigned this semester" />
                    : (
                      <div className="space-y-3">
                        {sem.sections.map((sec: any) => (
                          <div key={sec.offering_id} className="rounded-lg border bg-muted/30 p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm font-semibold">{sec.subject_code}</span>
                                  <Badge variant="outline" className="text-xs">{sec.section_name}</Badge>
                                </div>
                                <p className="text-sm">{sec.subject_title}</p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Users className="h-3 w-3" />
                                  {sec.enrolled_count} / {sec.capacity} enrolled
                                </div>
                                {sec.schedules?.length > 0 && (
                                  <div className="space-y-0.5 pt-1">
                                    {formatSchedules(sec.schedules).map((line, i) => (
                                      <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Clock className="h-3 w-3 shrink-0" />
                                        {line}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  }
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ROOT — Role dispatcher
═══════════════════════════════════════════════════════════ */
export default function SemestersPage() {
  const { role, isLoading } = useAuth();
  if (isLoading) return <LoadingSpinner />;
  if (role === 'admin')   return <AdminSemestersView />;
  if (role === 'faculty') return <FacultySemestersView />;
  return <StudentSemestersView />;
}
