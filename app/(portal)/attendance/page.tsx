'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { sectionService } from '@/services/sectionService';
import { attendanceService } from '@/services/attendanceService';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  CheckCircle2, Clock, XCircle, Users, 
  Calendar as CalendarIcon, Download, Save, 
  ChevronLeft, ChevronRight, CheckSquare, RefreshCw, FileText
} from 'lucide-react';
import { reports } from '@/lib/reports';

type AttendanceStatus = 'Present' | 'Late' | 'Absent' | 'Clear';

export default function AttendancePage() {
  const [sections, setSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  const [students, setStudents] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [summary, setSummary] = useState<any[]>([]);
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load assigned sections
  const loadSections = useCallback(async () => {
    setLoading(true);
    const res = await sectionService.list();
    if (res.success) {
      setSections(res.data ?? []);
      if (res.data?.length > 0) setSelectedSection(String(res.data[0].section_id));
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadSections(); }, [loadSections]);

  // Load attendance data
  const loadAttendance = useCallback(async () => {
    if (!selectedSection) return;
    setFetching(true);
    try {
      const month = selectedDate.getMonth() + 1;
      const year = selectedDate.getFullYear();
      const res = await attendanceService.list(Number(selectedSection), month, year);
      if (res.success) {
        setStudents(res.data.students);
        setRecords(res.data.records);
        setSummary(res.data.summary);
      }
    } catch {
      toast.error('Failed to load attendance records.');
    } finally {
      setFetching(false);
    }
  }, [selectedSection, selectedDate]);

  useEffect(() => { loadAttendance(); }, [loadAttendance]);

  const handleMark = async (enrollmentId: number, userId: string, status: 'Present' | 'Late' | 'Absent') => {
    const prevStatus = records.find(r => r.enrollment_id === enrollmentId && format(new Date(r.date), 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd'))?.status;
    
    if (prevStatus === status) return;

    // Optimistic Update
    const newRecord = { 
      enrollment_id: enrollmentId, 
      section_id: Number(selectedSection), 
      user_id: userId, 
      date: format(selectedDate, 'yyyy-MM-dd'), 
      status 
    };
    
    setRecords(prev => {
      const filtered = prev.filter(r => !(r.enrollment_id === enrollmentId && format(new Date(r.date), 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd')));
      return [...filtered, newRecord];
    });

    try {
      const res = await attendanceService.save(newRecord);
      if (!res.success) throw new Error();
      // Update summary silently
      loadAttendance(); 
    } catch {
      toast.error('Failed to save attendance marker.');
      loadAttendance(); // Revert
    }
  };

  const handleBulkMark = async (status: AttendanceStatus) => {
    if (!selectedSection) return;
    setSaving(true);
    try {
      const res = await attendanceService.saveBulk({
        section_id: Number(selectedSection),
        date: format(selectedDate, 'yyyy-MM-dd'),
        status,
        bulk: true
      });
      if (res.success) {
        toast.success(status === 'Clear' ? 'All markers cleared for this date.' : `Marked all as ${status}.`);
        loadAttendance();
      }
    } catch {
      toast.error('Failed to update attendance in bulk.');
    } finally {
      setSaving(false);
    }
  };

  const handleExportCSV = async () => {
    if (!selectedSection) return;
    const res = await attendanceService.export(Number(selectedSection), selectedDate.getFullYear());
    if (res.success) {
      window.open(`/api/attendance/export?section_id=${selectedSection}&year=${selectedDate.getFullYear()}&month=${selectedDate.getMonth()+1}`, '_blank');
    }
  };

  const handleExportPDF = () => {
    if (!selectedSection || students.length === 0) return;
    reports.exportAttendance({
      section: currentSection,
      students: students,
      records: records,
      month: format(selectedDate, 'MMMM'),
      year: format(selectedDate, 'yyyy')
    });
  };

  const getStatus = (enrollmentId: number) => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    return records.find(r => r.enrollment_id === enrollmentId && format(new Date(r.date), 'yyyy-MM-dd') === dateStr)?.status;
  };

  if (loading) return <div className="h-96 flex items-center justify-center"><LoadingSpinner /></div>;
  if (sections.length === 0) return <EmptyState title="No Sections Assigned" description="You don't have any active sections to track attendance for." />;

  const currentSection = sections.find(s => String(s.section_id) === selectedSection);

  return (
    <div className="space-y-6">
    <PageHeader 
      title="Attendance Tracking" 
      description="Monitor daily presence and generate academic participation reports."
      action={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-2 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700">
            <FileText className="h-4 w-4" /> Export PDF Log
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>
      }
    />

      <div className="flex flex-col lg:flex-row gap-6">
        {/* LEFT PANEL: Section & Date Selection */}
        <div className="w-full lg:w-[320px] space-y-4 shrink-0">
          <Card className="border-none shadow-lg bg-blue-600 dark:bg-blue-700 text-white overflow-hidden">
            <CardContent className="p-6 space-y-6">
               <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-blue-200">Current Section</label>
                  <Select value={selectedSection} onValueChange={setSelectedSection}>
                    <SelectTrigger className="bg-white/10 border-white/20 text-white h-11 focus:ring-white/30">
                      <SelectValue placeholder="Select section" />
                    </SelectTrigger>
                    <SelectContent>
                      {sections.map(s => (
                        <SelectItem key={s.section_id} value={String(s.section_id)}>
                          {s.subject_code} — {s.section_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
               </div>

               <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase tracking-widest text-blue-200">Attendance Date</label>
                    <div className="flex gap-1">
                       <Button size="icon" variant="ghost" className="h-7 w-7 text-white hover:bg-white/10" onClick={() => {
                         const d = new Date(selectedDate); d.setDate(d.getDate() - 1); setSelectedDate(d);
                       }}><ChevronLeft className="h-4 w-4" /></Button>
                       <Button size="icon" variant="ghost" className="h-7 w-7 text-white hover:bg-white/10" onClick={() => {
                         const d = new Date(selectedDate); d.setDate(d.getDate() + 1); setSelectedDate(d);
                       }}><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 text-center border border-white/10">
                     <CalendarIcon className="h-8 w-8 mx-auto mb-2 text-blue-200 opacity-50" />
                     <p className="text-2xl font-black tracking-tighter">{format(selectedDate, 'MMM dd')}</p>
                     <p className="text-[10px] font-bold uppercase text-blue-100/60 uppercase tracking-widest">{format(selectedDate, 'EEEE, yyyy')}</p>
                  </div>
               </div>

               <div className="space-y-3 pt-4 border-t border-white/10">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-blue-100 font-medium">Monthly Stats</span>
                    <Badge variant="outline" className="text-[9px] uppercase font-bold border-white/30 text-white bg-white/5">Auto-updating</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                     <div className="bg-black/10 rounded-lg p-2 text-center">
                        <p className="text-[9px] font-bold text-blue-200 uppercase tracking-tighter">Avg. Present</p>
                        <p className="text-lg font-black">{summary.length > 0 ? Math.round(summary.reduce((a,b) => a + b.percent, 0) / summary.length) : 0}%</p>
                     </div>
                     <div className="bg-black/10 rounded-lg p-2 text-center">
                        <p className="text-[9px] font-bold text-blue-200 uppercase tracking-tighter">Students</p>
                        <p className="text-lg font-black">{students.length}</p>
                     </div>
                  </div>
               </div>
            </CardContent>
          </Card>
          
          <Card className="border-none shadow-md overflow-hidden bg-card/50 backdrop-blur-sm">
             <CardContent className="p-4 space-y-3">
               <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Quick Actions</p>
               <Button variant="outline" className="w-full justify-start text-xs font-bold gap-3 h-10 border-blue-100 hover:bg-blue-50 hover:text-blue-700"
                onClick={() => handleBulkMark("Present")} disabled={saving}>
                 <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Mark All Present
               </Button>
               <Button variant="outline" className="w-full justify-start text-xs font-bold gap-3 h-10 border-red-100 hover:bg-red-50 hover:text-red-700" onClick={() => handleBulkMark("Absent")} disabled={saving}>
                 <XCircle className="h-4 w-4 text-rose-500" /> Mark All Absent
               </Button>
               <Button variant="ghost" className="w-full justify-start text-[10px] uppercase tracking-widest font-black gap-3 h-10 text-muted-foreground hover:text-rose-600" onClick={() => {
                 if(confirm("Clear all attendance markers for this date?")) handleBulkMark("Clear");
               }} disabled={saving}>
                 <RefreshCw className="h-4 w-4" /> Clear All Markers
               </Button>
             </CardContent>
          </Card>
        </div>

        {/* RIGHT PANEL: Attendance Grid */}
        <div className="flex-1 min-w-0">
          <Card className="border-none shadow-xl overflow-hidden min-h-[500px]">
            <CardContent className="p-0">
              {fetching ? <div className="h-96 flex items-center justify-center bg-muted/20"><LoadingSpinner /></div> : (
                <>
                  <div className="p-6 bg-muted/10 border-b flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold tracking-tight">Roster Management</h3>
                      <p className="text-xs text-muted-foreground font-medium">Showing enrollment list for {currentSection?.section_name}</p>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                       <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-emerald-500" /> Present </div>
                       <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-amber-500" /> Late </div>
                       <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-rose-500" /> Absent </div>
                    </div>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead className="w-[80px] pl-6">ID</TableHead>
                          <TableHead>Student Name</TableHead>
                          <TableHead className="text-center">Status Marker</TableHead>
                          <TableHead className="text-right pr-6">Participation</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {students.map((s) => {
                          const status = getStatus(s.enrollment_id);
                          const studSummary = summary.find(sm => sm.user_id === s.user_id);
                          
                          return (
                            <TableRow key={s.user_id} className="hover:bg-muted/5 transition-colors group">
                              <TableCell className="font-mono text-xs pl-6 text-muted-foreground group-hover:text-foreground">{s.user_id}</TableCell>
                              <TableCell className="font-bold">{s.full_name}</TableCell>
                              <TableCell className="flex justify-center p-2">
                                <div className="inline-flex bg-muted/30 p-1.5 rounded-full shadow-inner gap-1">
                                  <button 
                                    onClick={() => handleMark(s.enrollment_id, s.user_id, 'Present')}
                                    className={`p-2 rounded-full transition-all duration-200 ${status === 'Present' ? 'bg-emerald-500 text-white shadow-lg ring-2 ring-emerald-500/20' : 'text-muted-foreground hover:bg-muted-foreground/10'}`}>
                                    <CheckCircle2 className="h-4.5 w-4.5" />
                                  </button>
                                  <button 
                                    onClick={() => handleMark(s.enrollment_id, s.user_id, 'Late')}
                                    className={`p-2 rounded-full transition-all duration-200 ${status === 'Late' ? 'bg-amber-500 text-white shadow-lg ring-2 ring-amber-500/20' : 'text-muted-foreground hover:bg-muted-foreground/10'}`}>
                                    <Clock className="h-4.5 w-4.5" />
                                  </button>
                                  <button 
                                    onClick={() => handleMark(s.enrollment_id, s.user_id, 'Absent')}
                                    className={`p-2 rounded-full transition-all duration-200 ${status === 'Absent' ? 'bg-rose-500 text-white shadow-lg ring-2 ring-rose-500/20' : 'text-muted-foreground hover:bg-muted-foreground/10'}`}>
                                    <XCircle className="h-4.5 w-4.5" />
                                  </button>
                                </div>
                              </TableCell>
                              <TableCell className="text-right pr-6">
                                <span className={`text-xs font-black tracking-tight ${studSummary?.percent > 85 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                                  {studSummary?.percent ?? 0}%
                                </span>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  
                  {students.length === 0 && (
                     <div className="py-20 flex flex-col items-center justify-center opacity-40">
                        <Users className="h-12 w-12 mb-2" />
                        <p className="font-bold">No students enrolled in this section.</p>
                     </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
