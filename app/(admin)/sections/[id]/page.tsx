'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { sectionService } from '@/services/sectionService';
import { scheduleService } from '@/services/scheduleService';
import { subjectService } from '@/services/subjectService';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, ArrowLeft, FileDown, Pencil, Eye } from 'lucide-react';
import Link from 'next/link';

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'] as const;

export default function SectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [section, setSection]     = useState<any>(null);
  const [offerings, setOfferings] = useState<any[]>([]);
  const [students, setStudents]   = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [addOfferingOpen, setAddOfferingOpen] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [removeTarget, setRemoveTarget] = useState<any>(null);
  const [removing, setRemoving]   = useState(false);
  const [saving, setSaving]       = useState(false);

  const [subjects, setSubjects] = useState<any[]>([]);
  const [faculties, setFaculties] = useState<any[]>([]);

  // Section Renaming
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');

  // Offering Editing
  const [editOfferingTarget, setEditOfferingTarget] = useState<any>(null);
  const [editOfferingForm, setEditOfferingForm] = useState<any>(null);

  const [offeringForm, setOfferingForm] = useState({
    subject_id: '',
    instructor_id: '',
    day_of_week: 'Monday & Thursday',
    room: '',
    start_time: '',
    end_time: ''
  });
  
  const load = useCallback(async () => {
    setLoading(true);
    const [sr, er, or, subr, facr] = await Promise.all([
      sectionService.get(Number(id)),
      sectionService.getEnrollments(Number(id)),
      fetch(`/api/subject-offerings?section_id=${id}`).then(r => r.json()),
      subjectService.list(),
      fetch('/api/users?role=faculty').then(r => r.json())
    ]);
    if (sr.success) setSection(sr.data);
    if (er.success) setStudents(er.data ?? []);
    if (or.success) setOfferings(or.data ?? []);
    if (subr.success) setSubjects(subr.data ?? []);
    if (facr.success) setFaculties(facr.data?.users ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleAddOffering() {
    if (!offeringForm.subject_id) return toast.error('Subject is required.');
    if (!offeringForm.room) return toast.error('Room is required.');
    if (!offeringForm.start_time || !offeringForm.end_time) return toast.error('Schedule times are required.');
    setSaving(true);
    const payload = {
      section_id: Number(id),
      subject_id: Number(offeringForm.subject_id),
      instructor_id: offeringForm.instructor_id || undefined,
    };
    
    // In a real app we'd map this to subjectOfferingService.create()
    const res = await fetch('/api/subject-offerings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(r => r.json());
    
    setSaving(false);
    if (!res.success) { toast.error(res.message); return; }
    
    // 2. Create Schedule(s)
    const dayValue = offeringForm.day_of_week;
    const days = dayValue.includes('&') 
      ? dayValue.split('&').map(d => d.trim()) 
      : [dayValue];

    let successCount = 0;
    for (const day of days) {
      const schRes = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offering_id: res.data.offering_id,
          day_of_week: day,
          start_time: offeringForm.start_time,
          end_time: offeringForm.end_time,
          room: offeringForm.room,
          // We can use the section's semester dates if available or leave null for defaults
        })
      }).then(r => r.json());

      if (schRes.success) successCount++;
      else toast.warning(`Offering created, but failed to schedule ${day}: ${schRes.message}`);
    }

    if (successCount === days.length) {
      toast.success('Subject offering and schedules added.');
    } else {
      toast.success('Subject offering added with some scheduling issues.');
    }

    setAddOfferingOpen(false);
    setOfferingForm({ subject_id: '', instructor_id: '', day_of_week: 'Monday & Thursday', room: '', start_time: '', end_time: '' });
    load();
  }

  async function handleAddStudent() {
    if (!studentId.trim()) return;
    setSaving(true);
    const res = await sectionService.addStudent(Number(id), { user_id: studentId.trim() });
    setSaving(false);
    if (!res.success) { toast.error(res.message); return; }
    toast.success('Student added. Grade records have been initialized for their classes.'); 
    setStudentId(''); setAddStudentOpen(false); load();
  }

  async function handleRemoveStudent() {
    if (!removeTarget) return;
    setRemoving(true);
    const res = await sectionService.removeStudent(Number(id), removeTarget.user_id);
    setRemoving(false);
    if (!res.success) { toast.error(res.message); return; }
    toast.success('Student removed.'); setRemoveTarget(null); load();
  }

  if (loading) return <LoadingSpinner />;
  if (!section) return <p className="text-muted-foreground">Section not found.</p>;

  return (
    <div>
      <div className="mb-4">
        <Link href="/semesters"><Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" />Back</Button></Link>
      </div>
      <div className="flex items-center gap-3 mb-6">
        {isEditingName ? (
          <div className="flex items-center gap-2">
            <Input 
              value={newName} 
              onChange={e => setNewName(e.target.value)} 
              className="text-2xl font-bold h-10 w-[300px]"
              autoFocus
            />
            <Button size="sm" onClick={async () => {
              if (!newName.trim()) return;
              setSaving(true);
              const res = await sectionService.update(Number(id), { section_name: newName.trim() });
              setSaving(false);
              if (res.success) {
                toast.success('Section renamed.');
                setIsEditingName(false);
                load();
              } else toast.error(res.message);
            }}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setIsEditingName(false)}>Cancel</Button>
          </div>
        ) : (
          <>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">{section.section_name}</h1>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-indigo-600" onClick={() => {
              setNewName(section.section_name);
              setIsEditingName(true);
            }}>
              <Pencil className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
      
      <p className="text-sm text-muted-foreground mb-8">
        Cohort · {section.term} {section.school_year} — Capacity: {section.capacity}
      </p>

      <Tabs defaultValue="classes">
        <TabsList className="mb-4">
          <TabsTrigger value="classes">Classes ({offerings.length})</TabsTrigger>
          <TabsTrigger value="students">Students ({students.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="classes">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="text-sm">Subject Offerings</CardTitle>
              <Button size="sm" onClick={() => setAddOfferingOpen(true)}><Plus className="mr-1 h-3 w-3" />Add Class</Button>
            </CardHeader>
            <CardContent>
              {offerings.length === 0 ? <EmptyState title="No classes assigned" description="Add subjects to this section." /> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Instructor</TableHead>
                      <TableHead>Schedule</TableHead>
                      <TableHead>Units</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {offerings.map(o => (
                      <TableRow key={o.offering_id}>
                        <TableCell className="font-mono text-sm">{o.subject_code}</TableCell>
                        <TableCell className="font-medium text-sm">{o.subject_title}</TableCell>
                        <TableCell className="text-sm">
                          {o.instructor_first ? `${o.instructor_last}, ${o.instructor_first}` : <span className="text-muted-foreground">Unassigned</span>}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-tight">
                              {o.schedule_details ? (() => {
                                const groups: Record<string, string[]> = {};
                                o.schedule_details.split(', ').forEach((curr: string) => {
                                  const [day, time] = curr.split(' ');
                                  if (!groups[time]) groups[time] = [];
                                  groups[time].push(day.slice(0, 3).toUpperCase());
                                });
                                return Object.entries(groups).map(([time, days]) => `${days.join('/')} ${time}`).join(' | ');
                              })() : (
                                <span className="text-slate-400 italic font-normal">No schedule set</span>
                              )}
                            </span>
                            {o.start_date && (
                              <span className="text-[9px] text-muted-foreground font-medium flex items-center gap-1">
                                <span className="h-1 w-1 rounded-full bg-slate-300" />
                                {new Date(o.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - {new Date(o.end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{o.credit_units}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Link href={`/grade-manager?offering_id=${o.offering_id}`}>
                              <Button size="sm" variant="ghost" className="h-8 w-8 text-indigo-600 hover:bg-indigo-50" title="View Grades">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button 
                              size="sm" variant="ghost" className="h-8 w-8 text-amber-600 hover:bg-amber-50" 
                              title="Edit Offering"
                              onClick={() => {
                                setEditOfferingTarget(o);
                                // Parse existing schedule details to populate form
                                const firstSched = o.schedule_details?.split(', ')[0] || '';
                                const [days, time] = firstSched.split(' ');
                                const [start, end] = (time || '').split('-');
                                setEditOfferingForm({
                                  instructor_id: o.instructor_id || 'none',
                                  day_of_week: days || 'Monday',
                                  room: o.room || '',
                                  start_time: start || '',
                                  end_time: end || ''
                                });
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="students">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="text-sm">Enrolled Students</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setAddStudentOpen(true)}><Plus className="mr-1 h-3 w-3" />Add Student</Button>
              </div>
            </CardHeader>
            <CardContent>
              {students.length === 0 ? <EmptyState title="No students enrolled" /> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map(s => (
                      <TableRow key={s.enrollment_id}>
                        <TableCell className="font-mono text-sm">{s.user_id}</TableCell>
                        <TableCell className="font-medium">{s.last_name}, {s.first_name}</TableCell>
                        <TableCell>{s.email}</TableCell>
                        <TableCell>
                          <Badge variant={s.status === 'Enrolled' ? 'default' : 'secondary'}>{s.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setRemoveTarget(s)}>
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
      </Tabs>

      <Dialog open={addOfferingOpen} onOpenChange={setAddOfferingOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Subject Offering to Section</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Select value={offeringForm.subject_id} onValueChange={v => setOfferingForm(f => ({ ...f, subject_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                <SelectContent>
                  {subjects.map((sub: any) => (
                    <SelectItem key={sub.subject_id} value={String(sub.subject_id)}>
                      {sub.code} — {sub.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Instructor <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Select value={offeringForm.instructor_id} onValueChange={v => setOfferingForm(f => ({ ...f, instructor_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select instructor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {faculties.map((fac: any) => (
                    <SelectItem key={fac.user_id} value={fac.user_id}>
                      {fac.last_name}, {fac.first_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-3 pt-3 border-t">
              <Label className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Class Schedule</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs font-medium text-slate-600">Day Options</Label>
                  <Select value={offeringForm.day_of_week} onValueChange={v => setOfferingForm(f => ({ ...f, day_of_week: v }))}>
                    <SelectTrigger className="h-8 text-xs font-semibold"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <div className="px-2 py-1.5 text-[10px] font-black uppercase tracking-widest text-indigo-500/70">Regular</div>
                      <SelectItem value="Monday & Thursday" className="text-xs cursor-pointer">Monday & Thursday</SelectItem>
                      <SelectItem value="Tuesday & Friday" className="text-xs cursor-pointer">Tuesday & Friday</SelectItem>
                      <div className="px-2 py-1.5 mt-2 text-[10px] font-black uppercase tracking-widest text-amber-500/70">Special</div>
                      <SelectItem value="Wednesday" className="text-xs cursor-pointer">Wednesday (Midweek)</SelectItem>
                      <SelectItem value="Saturday" className="text-xs cursor-pointer">Saturday (Weekend)</SelectItem>
                      <div className="px-2 py-1.5 mt-2 text-[10px] font-black uppercase tracking-widest text-slate-500/70">Single Day</div>
                      {['Monday','Tuesday','Thursday','Friday','Sunday'].map(d => (
                        <SelectItem key={d} value={d} className="text-xs">{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Room</Label>
                  <Input 
                    placeholder="e.g., CL1" 
                    className="h-8 text-xs" 
                    value={offeringForm.room}
                    onChange={e => setOfferingForm(f => ({ ...f, room: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Time In</Label>
                  <Input 
                    type="time" 
                    className="h-8 text-xs" 
                    value={offeringForm.start_time}
                    onChange={e => setOfferingForm(f => ({ ...f, start_time: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Time Out</Label>
                  <Input 
                    type="time" 
                    className="h-8 text-xs" 
                    value={offeringForm.end_time}
                    onChange={e => setOfferingForm(f => ({ ...f, end_time: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground mt-2 italic">
              Students in this section will automatically see this in their Portal.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOfferingOpen(false)}>Cancel</Button>
            <Button onClick={handleAddOffering} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add Class</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addStudentOpen} onOpenChange={setAddStudentOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Student to Section</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label>Student ID</Label>
            <Input placeholder="2026-0001" value={studentId} onChange={e => setStudentId(e.target.value)} />
            <p className="text-xs text-muted-foreground mt-2">
              This will automatically enroll the student and create grade records for all {offerings.length} subject offerings in this section.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddStudentOpen(false)}>Cancel</Button>
            <Button onClick={handleAddStudent} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add Student</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editOfferingTarget} onOpenChange={o => !o && setEditOfferingTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Subject Offering</DialogTitle></DialogHeader>
          {editOfferingForm && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Instructor</Label>
                <Select value={editOfferingForm.instructor_id} onValueChange={v => setEditOfferingForm((f: any) => ({ ...f, instructor_id: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {faculties.map((fac: any) => (
                      <SelectItem key={fac.user_id} value={fac.user_id}>{fac.last_name}, {fac.first_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-3 border-t">
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs">Day of Week</Label>
                  <Select value={editOfferingForm.day_of_week} onValueChange={v => setEditOfferingForm((f: any) => ({ ...f, day_of_week: v }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DAYS.map(d => <SelectItem key={d} value={d} className="text-xs">{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Room</Label>
                  <Input className="h-8 text-xs" value={editOfferingForm.room} onChange={e => setEditOfferingForm((f: any) => ({ ...f, room: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Time In</Label>
                  <Input type="time" className="h-8 text-xs" value={editOfferingForm.start_time} onChange={e => setEditOfferingForm((f: any) => ({ ...f, start_time: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Time Out</Label>
                  <Input type="time" className="h-8 text-xs" value={editOfferingForm.end_time} onChange={e => setEditOfferingForm((f: any) => ({ ...f, end_time: e.target.value }))} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOfferingTarget(null)}>Cancel</Button>
            <Button disabled={saving} onClick={async () => {
              if (!editOfferingTarget) return;
              setSaving(true);
              try {
                // 1. Update Offering (Instructor)
                await fetch(`/api/subject-offerings/${editOfferingTarget.offering_id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ instructor_id: editOfferingForm.instructor_id === 'none' ? null : editOfferingForm.instructor_id })
                });
                
                // 2. Simple Schedule logic: delete old and add new (simplified for this UI)
                const sres = await fetch(`/api/schedules?offering_id=${editOfferingTarget.offering_id}`).then(r => r.json());
                if (sres.success) {
                  for (const s of sres.data) {
                    await fetch(`/api/schedules/${s.schedule_id}`, { method: 'DELETE' });
                  }
                }
                
                await fetch('/api/schedules', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    offering_id: editOfferingTarget.offering_id,
                    day_of_week: editOfferingForm.day_of_week,
                    start_time: editOfferingForm.start_time,
                    end_time: editOfferingForm.end_time,
                    room: editOfferingForm.room
                  })
                });

                toast.success('Offering updated.');
                setEditOfferingTarget(null);
                load();
              } catch (err) {
                toast.error('Failed to update.');
              } finally {
                setSaving(false);
              }
            }}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!removeTarget} onOpenChange={o => !o && setRemoveTarget(null)}
        title="Remove Student?" description={`Remove ${removeTarget?.first_name} ${removeTarget?.last_name} from this section? This will delete all of their grades for classes in this section.`}
        onConfirm={handleRemoveStudent} loading={removing} confirmLabel="Remove"
      />
    </div>
  );
}
