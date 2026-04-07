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
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, ArrowLeft, FileDown } from 'lucide-react';
import Link from 'next/link';

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'] as const;

export default function SectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [section, setSection]     = useState<any>(null);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [students, setStudents]   = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [schedOpen, setSchedOpen] = useState(false);
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [studentId, setStudentId] = useState('');
  const [removeTarget, setRemoveTarget] = useState<any>(null);
  const [removing, setRemoving]   = useState(false);
  const [exporting, setExporting] = useState(false);

  const [schedForm, setSchedForm] = useState({
    day_of_week: 'Monday', start_time: '08:00', end_time: '09:00', room: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [sr, schr, gr] = await Promise.all([
      sectionService.get(Number(id)),
      sectionService.getSchedules(Number(id)),
      fetch(`/api/grades/${id}`, { credentials: 'include' }).then(r => r.json()),
    ]);
    if (sr.success) setSection(sr.data);
    if (schr.success) setSchedules(schr.data ?? []);
    if (gr.success) setStudents(gr.data ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleAddSchedule() {
    setSaving(true);
    const res = await scheduleService.create({ section_id: Number(id), ...schedForm });
    setSaving(false);
    if (!res.success) { toast.error(res.message); return; }
    toast.success('Schedule added.'); setSchedOpen(false); load();
  }

  async function handleDeleteSchedule(schedId: number) {
    const res = await scheduleService.remove(schedId);
    if (!res.success) { toast.error(res.message); return; }
    toast.success('Schedule removed.'); load();
  }

  async function handleAddStudent() {
    if (!studentId.trim()) return;
    setSaving(true);
    const res = await sectionService.addStudent(Number(id), { user_id: studentId.trim() });
    setSaving(false);
    if (!res.success) { toast.error(res.message); return; }
    toast.success('Student added.'); setStudentId(''); setAddStudentOpen(false); load();
  }

  async function handleRemoveStudent() {
    if (!removeTarget) return;
    setRemoving(true);
    const res = await sectionService.removeStudent(Number(id), removeTarget.user_id);
    setRemoving(false);
    if (!res.success) { toast.error(res.message); return; }
    toast.success('Student removed.'); setRemoveTarget(null); load();
  }

  async function handleExportPdf() {
    if (!section || students.length === 0) return;
    setExporting(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF();

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('AcadTrack — Grade Report', 14, 18);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      doc.text(`Section  : ${section.section_name}`, 14, 28);
      doc.text(`Subject  : ${section.subject_code} — ${section.subject_title}`, 14, 34);
      doc.text(`Instructor: ${section.instructor_last_name ? section.instructor_last_name + ', ' + section.instructor_first_name : '—'}`, 14, 40);
      doc.text(`Semester : ${section.term} ${section.school_year}`, 14, 46);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 52);
      doc.setTextColor(0);

      autoTable(doc, {
        startY: 60,
        head: [['Student ID', 'Last Name', 'First Name', 'Prelim', 'Midterm', 'Final', 'Average', 'Remarks']],
        body: students.map(s => [
          s.user_id,
          s.last_name,
          s.first_name,
          s.prelim_grade  ?? '—',
          s.midterm_grade ?? '—',
          s.final_grade   ?? '—',
          s.average       ?? '—',
          s.remarks       ?? 'Incomplete',
        ]),
        headStyles: { fillColor: [37, 99, 235], fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 28 },
          2: { cellWidth: 28 },
          3: { cellWidth: 18, halign: 'center' },
          4: { cellWidth: 18, halign: 'center' },
          5: { cellWidth: 18, halign: 'center' },
          6: { cellWidth: 18, halign: 'center' },
          7: { cellWidth: 24, halign: 'center' },
        },
        margin: { left: 14, right: 14 },
      });

      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.getWidth() - 28, doc.internal.pageSize.getHeight() - 10);
      }

      doc.save(`grade-report-${section.section_name}-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e) {
      console.error(e);
    } finally {
      setExporting(false);
    }
  }

  if (loading) return <LoadingSpinner />;
  if (!section) return <p className="text-muted-foreground">Section not found.</p>;

  return (
    <div>
      <div className="mb-4">
        <Link href="/sections"><Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" />Back</Button></Link>
      </div>
      <PageHeader
        title={section.section_name}
        description={`${section.subject_code} — ${section.subject_title} · ${section.term} ${section.school_year}`}
      />

      <Tabs defaultValue="schedules">
        <TabsList className="mb-4">
          <TabsTrigger value="schedules">Schedules</TabsTrigger>
          <TabsTrigger value="students">Students ({students.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="schedules">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="text-sm">Class Schedules</CardTitle>
              <Button size="sm" onClick={() => setSchedOpen(true)}><Plus className="mr-1 h-3 w-3" />Add</Button>
            </CardHeader>
            <CardContent>
              {schedules.length === 0 ? <EmptyState title="No schedules yet" /> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Day</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Room</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schedules.map(s => (
                      <TableRow key={s.schedule_id}>
                        <TableCell>{s.day_of_week}</TableCell>
                        <TableCell>{s.start_time.slice(0,5)} – {s.end_time.slice(0,5)}</TableCell>
                        <TableCell>{s.room}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDeleteSchedule(s.schedule_id)}>
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

        <TabsContent value="students">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="text-sm">Enrolled Students</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleExportPdf} disabled={exporting || students.length === 0}>
                  {exporting ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <FileDown className="mr-1 h-3 w-3" />}
                  Export PDF
                </Button>
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
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map(s => (
                      <TableRow key={s.user_id}>
                        <TableCell className="font-mono text-sm">{s.user_id}</TableCell>
                        <TableCell className="font-medium">{s.last_name}, {s.first_name}</TableCell>
                        <TableCell>{s.email}</TableCell>
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

      <Dialog open={schedOpen} onOpenChange={setSchedOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Schedule</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Day</Label>
              <Select value={schedForm.day_of_week} onValueChange={v => setSchedForm(f => ({ ...f, day_of_week: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Start Time</Label><Input type="time" value={schedForm.start_time} onChange={e => setSchedForm(f => ({ ...f, start_time: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>End Time</Label><Input type="time" value={schedForm.end_time} onChange={e => setSchedForm(f => ({ ...f, end_time: e.target.value }))} /></div>
            </div>
            <div className="space-y-1.5"><Label>Room</Label><Input placeholder="Room 101" value={schedForm.room} onChange={e => setSchedForm(f => ({ ...f, room: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSchedOpen(false)}>Cancel</Button>
            <Button onClick={handleAddSchedule} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addStudentOpen} onOpenChange={setAddStudentOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Student to Section</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label>Student ID</Label>
            <Input placeholder="2026-0001" value={studentId} onChange={e => setStudentId(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddStudentOpen(false)}>Cancel</Button>
            <Button onClick={handleAddStudent} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!removeTarget} onOpenChange={o => !o && setRemoveTarget(null)}
        title="Remove Student?" description={`Remove ${removeTarget?.first_name} ${removeTarget?.last_name} from this section?`}
        onConfirm={handleRemoveStudent} loading={removing} confirmLabel="Remove"
      />
    </div>
  );
}
