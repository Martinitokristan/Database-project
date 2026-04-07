'use client';

import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { announcementService } from '@/services/announcementService';
import { sectionService } from '@/services/sectionService';
import { toast } from 'sonner';
import { Plus, Trash2, Megaphone, Loader2 } from 'lucide-react';

const adminSchema = z.object({
  title:          z.string().min(1),
  content:        z.string().min(1),
  type:           z.enum(['General', 'Section']),
  section_id:     z.string().optional(),
  target_role_id: z.string().optional(),
});
const facultySchema = z.object({
  title:      z.string().min(1),
  content:    z.string().min(1),
  section_id: z.string().min(1, 'Select a section'),
});

export default function AnnouncementsPage() {
  const { role, isLoading } = useAuth();
  if (isLoading) return <LoadingSpinner />;
  if (role === 'admin')   return <AdminAnnouncements />;
  if (role === 'faculty') return <FacultyAnnouncements />;
  if (role === 'student') return <StudentAnnouncements />;
  return null;
}

function AnnouncementCard({ a, onDelete, canDelete }: { a: any; onDelete?: () => void; canDelete?: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-2 pt-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Megaphone className="h-4 w-4 text-primary shrink-0" />
              <p className="font-semibold">{a.title}</p>
              <Badge variant="outline" className="text-xs">{a.type}</Badge>
              {a.section_name && <Badge variant="outline" className="text-xs text-purple-600">{a.section_name}</Badge>}
              {a.target_role && <Badge variant="outline" className="text-xs">→ {a.target_role}</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">{a.sender_first} {a.sender_last} · {new Date(a.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
          </div>
          {canDelete && onDelete && (
            <Button size="sm" variant="ghost" className="text-destructive shrink-0 ml-2" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-4">
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{a.content}</p>
      </CardContent>
    </Card>
  );
}

function AdminAnnouncements() {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [sections, setSections]   = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [open, setOpen]           = useState(false);
  const [saving, setSaving]       = useState(false);
  const [typeValue, setTypeValue] = useState<'General' | 'Section'>('General');
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting]   = useState(false);

  const { register, handleSubmit, setValue, reset } = useForm<z.infer<typeof adminSchema>>({
    resolver: zodResolver(adminSchema), defaultValues: { type: 'General' },
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [ar, sr] = await Promise.all([announcementService.list(), sectionService.list()]);
    if (ar.success) setAnnouncements(ar.data ?? []);
    if (sr.success) setSections(sr.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function onSubmit(data: z.infer<typeof adminSchema>) {
    setSaving(true);
    const payload: any = {
      title: data.title, content: data.content, type: data.type,
      section_id:     data.type === 'Section' && data.section_id ? Number(data.section_id) : null,
      target_role_id: data.type === 'General' && data.target_role_id ? Number(data.target_role_id) : null,
    };
    const res = await announcementService.create(payload);
    setSaving(false);
    if (!res.success) { toast.error(res.message); return; }
    toast.success('Announcement posted.'); reset(); setOpen(false); load();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await announcementService.remove(deleteTarget.announcement_id);
    setDeleting(false);
    if (!res.success) { toast.error(res.message); return; }
    toast.success('Deleted.'); setDeleteTarget(null); load();
  }

  return (
    <div>
      <PageHeader title="Announcements" action={<Button onClick={() => { reset({ type: 'General' }); setTypeValue('General'); setOpen(true); }}><Plus className="mr-2 h-4 w-4" />Post</Button>} />
      {loading ? <LoadingSpinner /> : announcements.length === 0 ? <EmptyState /> : (
        <div className="space-y-3">
          {announcements.map(a => (
            <AnnouncementCard key={a.announcement_id} a={a} canDelete onDelete={() => setDeleteTarget(a)} />
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Post Announcement</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5"><Label>Title</Label><Input {...register('title')} /></div>
            <div className="space-y-1.5"><Label>Content</Label><Textarea rows={4} {...register('content')} /></div>
            <div className="space-y-1.5"><Label>Type</Label>
              <Select defaultValue="General" onValueChange={v => { setValue('type', v as any); setTypeValue(v as any); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="General">General</SelectItem><SelectItem value="Section">Section</SelectItem></SelectContent>
              </Select>
            </div>
            {typeValue === 'Section' && (
              <div className="space-y-1.5"><Label>Section</Label>
                <Select onValueChange={v => setValue('section_id', v)}><SelectTrigger><SelectValue placeholder="Select section" /></SelectTrigger>
                  <SelectContent>{sections.map((s: any) => <SelectItem key={s.section_id} value={String(s.section_id)}>{s.section_name} · {s.subject_code}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {typeValue === 'General' && (
              <div className="space-y-1.5"><Label>Target Role <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Select onValueChange={v => setValue('target_role_id', v)}><SelectTrigger><SelectValue placeholder="All roles" /></SelectTrigger>
                  <SelectContent><SelectItem value="2">Faculty</SelectItem><SelectItem value="3">Students</SelectItem></SelectContent>
                </Select>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Post</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)} title="Delete Announcement?" description="This will permanently delete the announcement." onConfirm={handleDelete} loading={deleting} />
    </div>
  );
}

function FacultyAnnouncements() {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [sections, setSections]   = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [open, setOpen]           = useState(false);
  const [saving, setSaving]       = useState(false);

  const { register, handleSubmit, setValue, reset } = useForm<z.infer<typeof facultySchema>>({
    resolver: zodResolver(facultySchema),
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [ar, sr] = await Promise.all([announcementService.list(), sectionService.list()]);
    if (ar.success) setAnnouncements(ar.data ?? []);
    if (sr.success) setSections(sr.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function onSubmit(data: z.infer<typeof facultySchema>) {
    setSaving(true);
    const res = await announcementService.create({ title: data.title, content: data.content, type: 'Section', section_id: Number(data.section_id) });
    setSaving(false);
    if (!res.success) { toast.error(res.message); return; }
    toast.success('Posted.'); reset(); setOpen(false); load();
  }

  return (
    <div>
      <PageHeader title="Announcements" action={<Button onClick={() => { reset(); setOpen(true); }}><Plus className="mr-2 h-4 w-4" />Post</Button>} />
      {loading ? <LoadingSpinner /> : announcements.length === 0 ? <EmptyState /> : (
        <div className="space-y-3">{announcements.map(a => <AnnouncementCard key={a.announcement_id} a={a} />)}</div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Post to Section</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5"><Label>Section</Label>
              <Select onValueChange={v => setValue('section_id', v)}><SelectTrigger><SelectValue placeholder="Select your section" /></SelectTrigger>
                <SelectContent>{sections.map((s: any) => <SelectItem key={s.section_id} value={String(s.section_id)}>{s.section_name} · {s.subject_code}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Title</Label><Input {...register('title')} /></div>
            <div className="space-y-1.5"><Label>Content</Label><Textarea rows={4} {...register('content')} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Post</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StudentAnnouncements() {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading]             = useState(true);

  useEffect(() => {
    announcementService.list().then(r => {
      if (r.success) setAnnouncements(r.data ?? []);
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader title="Announcements" description="Latest announcements from admin and your instructors." />
      {announcements.length === 0 ? <EmptyState title="No announcements yet" /> : (
        <div className="space-y-3">{announcements.map(a => <AnnouncementCard key={a.announcement_id} a={a} />)}</div>
      )}
    </div>
  );
}
