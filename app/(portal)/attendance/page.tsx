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
  ChevronLeft, ChevronRight, CheckSquare, RefreshCw, FileText,
  Triangle, Circle, Check
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
  const [viewMode, setViewMode] = useState<'daily' | 'grid'>('daily');

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

        {/* RIGHT PANEL: Attendance View */}
        <div className="flex-1 min-w-0">
          <Card className="border-none shadow-xl overflow-hidden min-h-[600px] flex flex-col">
            <div className="p-4 bg-muted/10 border-b flex items-center justify-between">
              <div className="flex items-center gap-4">
                 <div className="hidden sm:block">
                   <h3 className="text-lg font-bold tracking-tight">Roster Management</h3>
                   <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">{currentSection?.section_name}</p>
                 </div>
                 <Tabs value={viewMode} onValueChange={(v: any) => setViewMode(v)} className="w-[200px]">
                   <TabsList className="grid w-full grid-cols-2">
                     <TabsTrigger value="daily" className="text-xs">Daily</TabsTrigger>
                     <TabsTrigger value="grid" className="text-xs">Matrix</TabsTrigger>
                   </TabsList>
                 </Tabs>
              </div>
              <div className="hidden md:flex items-center gap-4 text-[9px] font-black text-muted-foreground uppercase tracking-widest">
                 <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-emerald-500" /> Present </div>
                 <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-amber-500" /> Late </div>
                 <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-rose-500" /> Absent </div>
              </div>
            </div>

            <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
              {fetching ? (
                <div className="flex-1 flex items-center justify-center bg-muted/20">
                  <LoadingSpinner />
                </div>
              ) : viewMode === 'daily' ? (
                /* ── Daily View ── */
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="w-[80px] pl-6 font-black uppercase text-[10px]">ID</TableHead>
                        <TableHead className="font-black uppercase text-[10px]">Student Name</TableHead>
                        <TableHead className="text-center font-black uppercase text-[10px]">Status Marker</TableHead>
                        <TableHead className="text-right pr-6 font-black uppercase text-[10px]">Participation</TableHead>
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
                                  <CheckCircle2 className="h-4 w-4" />
                                </button>
                                <button 
                                  onClick={() => handleMark(s.enrollment_id, s.user_id, 'Late')}
                                  className={`p-2 rounded-full transition-all duration-200 ${status === 'Late' ? 'bg-amber-500 text-white shadow-lg ring-2 ring-amber-500/20' : 'text-muted-foreground hover:bg-muted-foreground/10'}`}>
                                  <Circle className="h-4 w-4 fill-current" />
                                </button>
                                <button 
                                  onClick={() => handleMark(s.enrollment_id, s.user_id, 'Absent')}
                                  className={`p-2 rounded-full transition-all duration-200 ${status === 'Absent' ? 'bg-rose-500 text-white shadow-lg ring-2 ring-rose-500/20' : 'text-muted-foreground hover:bg-muted-foreground/10'}`}>
                                  <Triangle className="h-4 w-4 fill-current" />
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
              ) : (
                /* ── Matrix/Grid View ── */
                <div className="flex-1 overflow-auto">
                  <div className="inline-block min-w-full">
                    <Table className="border-collapse">
                      <TableHeader className="bg-slate-50 sticky top-0 z-20">
                        <TableRow>
                          <TableHead className="w-[200px] font-black uppercase text-[10px] bg-slate-50 border-r z-30 sticky left-0 pl-6">Student</TableHead>
                          <TableHead className="w-[120px] font-black uppercase text-[10px] bg-slate-50 border-r text-center px-2">Stats</TableHead>
                          {/* Get unique dates from records */}
                          {Array.from(new Set(records.map(r => format(new Date(r.date), 'MMM dd'))))
                            .sort((a,b) => new Date(b).getTime() - new Date(a).getTime())
                            .map(date => (
                              <TableHead key={date} className="w-[80px] font-bold text-[10px] text-center border-r px-2 whitespace-nowrap">
                                {date}
                              </TableHead>
                            ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {summary.map((s) => (
                          <TableRow key={s.user_id} className="hover:bg-slate-50/50 h-10 transition-colors">
                            <TableCell className="font-bold text-xs sticky left-0 bg-white border-r pl-6 z-10 w-[200px]">
                              {s.full_name}
                            </TableCell>
                            <TableCell className="border-r px-2">
                               <div className="flex items-center justify-center gap-3">
                                  <div className="flex items-center gap-1">
                                    <Check className="h-3 w-3 text-emerald-500" />
                                    <span className="text-[10px] font-black">{s.present}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Triangle className="h-2.5 w-2.5 text-rose-500 fill-current" />
                                    <span className="text-[10px] font-black">{s.absent}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Circle className="h-2.5 w-2.5 text-amber-500 fill-current" />
                                    <span className="text-[10px] font-black">{s.late}</span>
                                  </div>
                               </div>
                            </TableCell>
                            {/* Render status for each date */}
                            {Array.from(new Set(records.map(r => format(new Date(r.date), 'MMM dd'))))
                              .sort((a,b) => new Date(b).getTime() - new Date(a).getTime())
                              .map(date => {
                                const record = records.find(r => r.user_id === s.user_id && format(new Date(r.date), 'MMM dd') === date);
                                return (
                                  <TableCell key={date} className="text-center border-r p-0 h-10 w-[80px]">
                                    <div className="flex items-center justify-center h-full w-full">
                                      {record?.status === 'Present' && <Check className="h-4 w-4 text-emerald-500" />}
                                      {record?.status === 'Absent' && <Triangle className="h-3.5 w-3.5 text-rose-500 fill-current" />}
                                      {record?.status === 'Late' && <Circle className="h-3.5 w-3.5 text-amber-500 fill-current" />}
                                      {!record && <span className="text-slate-200">−</span>}
                                    </div>
                                  </TableCell>
                                );
                              })}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
              
              {students.length === 0 && !fetching && (
                 <div className="flex-1 flex flex-col items-center justify-center opacity-40">
                    <Users className="h-12 w-12 mb-2" />
                    <p className="font-bold text-sm">No students enrolled</p>
                 </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
