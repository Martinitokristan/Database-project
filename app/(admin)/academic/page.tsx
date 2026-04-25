'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { departmentService } from '@/services/departmentService';
import { courseService } from '@/services/courseService';
import { subjectService } from '@/services/subjectService';
import { sectionService } from '@/services/sectionService';
import { subjectOfferingService } from '@/services/subjectOfferingService';
import { semesterService } from '@/services/semesterService';
import { userService } from '@/services/userService';
import { toast } from 'sonner';
import { 
  Building2, UserCog, ChevronRight, ChevronDown, BookOpen, 
  BookMarked, Layers, ArrowLeft, GraduationCap,
  Users, Info, Loader2, Search, Plus, Trash2, Pencil, Eye, X
} from 'lucide-react';
import Link from 'next/link';
import { Department, User, Course, Subject, Section, Semester } from '@/types';
import { cn } from '@/lib/utils';

type ViewMode = 'departments' | 'department-detail';

export default function AcademicPortal() {
  const [view, setView] = useState<ViewMode>('departments');
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [departments, setDepts] = useState<Department[]>([]);
  const [faculty, setFaculty] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Drill-down data
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [offerings, setOfferings] = useState<any[]>([]);
  const [sectionPool, setSectionPool] = useState<Section[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);

  // Reassign Modal
  const [reassignTarget, setReassignTarget] = useState<any>(null);
  const [newHeadId, setNewHeadId] = useState<string>('');
  const [savingHead, setSavingHead] = useState(false);
  const [editDeptTarget, setEditDeptTarget] = useState<Department | null>(null);
  const [editingDeptName, setEditingDeptName] = useState('');
  const [editingDeptHeadId, setEditingDeptHeadId] = useState('');
  const [savingDept, setSavingDept] = useState(false);
  const [addDeptOpen, setAddDeptOpen] = useState(false);
  const [addDeptName, setAddDeptName] = useState('');
  const [addDeptHeadId, setAddDeptHeadId] = useState('none');
  const [deleteDeptTarget, setDeleteDeptTarget] = useState<Department | null>(null);
  const [deletingDept, setDeletingDept] = useState(false);

  // Add Dialogs
  const [addCourseOpen, setAddCourseOpen] = useState(false);
  const [addSubjectOpen, setAddSubjectOpen] = useState(false);
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [targetSubject, setTargetSubject] = useState<any>(null);
  const [savingEntity, setSavingEntity] = useState(false);

  // Delete Section
  const [deleteSectionTarget, setDeleteSectionTarget] = useState<any>(null);
  const [deletingSection, setDeletingSection] = useState(false);

  // Course Edit/Delete
  const [editCourseTarget, setEditCourseTarget] = useState<Course | null>(null);
  const [editingCourseName, setEditingCourseName] = useState('');
  const [deleteCourseTarget, setDeleteCourseTarget] = useState<Course | null>(null);

  // Subject Edit/Delete
  const [editSubjectTarget, setEditSubjectTarget] = useState<Subject | null>(null);
  const [deleteSubjectTarget, setDeleteSubjectTarget] = useState<Subject | null>(null);
  const [editingSubjectForm, setEditingSubjectForm] = useState<any>(null);

  // Section Edit
  const [editSectionTarget, setEditSectionTarget] = useState<any>(null);
  const [editingSectionName, setEditingSectionName] = useState('');

  // New assignment states
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [selectedTermId, setSelectedTermId] = useState<string>('');
  const [assignedCapacity, setAssignedCapacity] = useState<number>(40);
  const [expandedSubjects, setExpandedSubjects] = useState<number[]>([]);
  const [editOfferingTarget, setEditOfferingTarget] = useState<any>(null);
  const [editOfferingForm, setEditOfferingForm] = useState({
    instructor_id: '',
    day_of_week: 'Monday & Thursday',
    room: '',
    start_time: '',
    end_time: ''
  });


  const loadBase = useCallback(async () => {
    setLoading(true);
    const [dr, fr, sr, secRes] = await Promise.all([
      departmentService.list(),
      userService.list({ role: 'Faculty', limit: 100 }),
      semesterService.list(),
      sectionService.list()
    ]);
    if (dr.success) setDepts(dr.data ?? []);
    if (fr.success) setFaculty(fr.data?.users ?? []);
    if (sr.success) setSemesters(sr.data ?? []);
    if (secRes.success) setSectionPool(secRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadBase(); }, [loadBase]);

  useEffect(() => {
    if (editOfferingTarget) {
      setEditOfferingForm({
        instructor_id: editOfferingTarget.instructor_id || '',
        day_of_week: 'Monday & Thursday', // Default to regular, user can change
        room: '', // We'd need to fetch schedule to populate these
        start_time: '',
        end_time: ''
      });
      // Fetch current schedules to populate if possible
      fetch(`/api/schedules?offering_id=${editOfferingTarget.offering_id}`)
        .then(r => r.json())
        .then(res => {
          if (res.success && res.data.length > 0) {
            const first = res.data[0];
            // If multiple days with same time, try to match option
            const days = res.data.map((d: any) => d.day_of_week);
            let dayOption = first.day_of_week;
            if (days.includes('Monday') && days.includes('Thursday')) dayOption = 'Monday & Thursday';
            else if (days.includes('Tuesday') && days.includes('Friday')) dayOption = 'Tuesday & Friday';

            setEditOfferingForm(f => ({
              ...f,
              day_of_week: dayOption,
              room: first.room,
              start_time: first.start_time.slice(0, 5),
              end_time: first.end_time.slice(0, 5)
            }));
          }
        });
    }
  }, [editOfferingTarget]);

  const loadDeptDetails = async (deptId: number) => {
    setDrillLoading(true);
    try {
      // 1. Fetch courses for department
      const cRes = await fetch(`/api/courses?dept_id=${deptId}`, { credentials: 'include' }).then(r => r.json());
      const deptCourses = cRes.success ? (cRes.data ?? []) : [];
      setCourses(deptCourses);

      // 2. Fetch all subjects and filter or let user pick course? 
      // For now, let's fetch all subjects for this dept's courses
      const sRes = await fetch(`/api/subjects`, { credentials: 'include' }).then(r => r.json());
      const deptSubjects = sRes.success ? (sRes.data ?? []).filter((s: any) => s.dept_id === deptId) : [];
      setSubjects(deptSubjects);

      // 3. Fetch offerings linked to those subjects
      const offRes = await fetch(`/api/subject-offerings`, { credentials: 'include' }).then(r => r.json());
      const deptOfferings = offRes.success ? (offRes.data ?? []) : [];
      setOfferings(deptOfferings);
    } catch (err) {
      toast.error('Failed to load department structure.');
    } finally {
      setDrillLoading(false);
    }
  };

  const enterDept = (dept: any) => {
    setSelectedDept(dept);
    setView('department-detail');
    loadDeptDetails(dept.dept_id);
  };

  const handleDeptUpdate = async () => {
    if (!editDeptTarget) return;
    setSavingDept(true);
    const res = await departmentService.update(editDeptTarget.dept_id, {
      department_name: editingDeptName,
      department_head_id: editingDeptHeadId === 'none' ? null : editingDeptHeadId
    });
    setSavingDept(false);
    if (!res.success) { toast.error(res.message); return; }
    toast.success('Department updated.');
    setEditDeptTarget(null);
    loadBase();
    if (selectedDept?.dept_id === editDeptTarget.dept_id) {
      setSelectedDept(prev => prev ? { ...prev, department_name: editingDeptName, department_head_id: editingDeptHeadId === 'none' ? null : editingDeptHeadId } : null);
    }
  };

  const openEditDept = (e: React.MouseEvent, dept: Department) => {
    e.stopPropagation();
    setEditDeptTarget(dept);
    setEditingDeptName(dept.department_name);
    setEditingDeptHeadId(dept.department_head_id || 'none');
  };

  const handleCreateDept = async () => {
    if (!addDeptName.trim()) { toast.error('Department name is required.'); return; }
    setSavingDept(true);
    const res = await departmentService.create({
      department_name: addDeptName,
      department_head_id: addDeptHeadId === 'none' ? null : addDeptHeadId
    });
    setSavingDept(false);
    if (!res.success) { toast.error(res.message); return; }
    toast.success('Department created.');
    setAddDeptOpen(false);
    setAddDeptName('');
    setAddDeptHeadId('none');
    loadBase();
  };

  const handleDeleteDept = async () => {
    if (!deleteDeptTarget) return;
    setDeletingDept(true);
    const res = await departmentService.remove(deleteDeptTarget.dept_id);
    setDeletingDept(false);
    if (!res.success) { toast.error(res.message); return; }
    toast.success('Department deleted.');
    setDeleteDeptTarget(null);
    loadBase();
  };

  if (loading) return <div className="h-[400px] flex items-center justify-center"><LoadingSpinner /></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {view === 'departments' ? (
        <>
          <PageHeader 
            title="Academic Programs" 
            description="Manage university departments, courses, and the core educational structure"
            action={
              <Button onClick={() => setAddDeptOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 shadow-md">
                <Plus className="mr-2 h-4 w-4" /> Add Department
              </Button>
            }
          />

          {departments.length === 0 ? <EmptyState /> : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {departments.map(dept => {
                const head = faculty.find(f => f.user_id === dept.department_head_id);
                return (
                  <Card 
                    key={dept.dept_id} 
                    className="group relative overflow-hidden border-indigo-100 bg-white/50 backdrop-blur-sm lg:hover:border-indigo-400 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-500 cursor-pointer"
                    onClick={() => enterDept(dept)}
                  >
                    <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0 flex gap-2">
                      <Button 
                        size="icon" 
                        variant="secondary" 
                        className="h-8 w-8 rounded-full bg-white/80 backdrop-blur-sm text-indigo-600 hover:bg-white"
                        onClick={(e) => openEditDept(e, dept)}
                        title="Edit Department"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="destructive" 
                        className="h-8 w-8 rounded-full bg-red-500 text-white hover:bg-red-600 shadow-lg"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteDeptTarget(dept);
                        }}
                        title="Delete Department"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <div className="h-8 w-8 rounded-full bg-indigo-500 flex items-center justify-center text-white">
                        <ChevronRight className="h-4 w-4" />
                      </div>
                    </div>
                    
                    {/* Decorative Background Blob */}
                    <div className="absolute -bottom-8 -right-8 h-24 w-24 rounded-full bg-indigo-50/50 group-hover:bg-indigo-100/50 transition-colors duration-500" />

                    <CardHeader className="pb-4">
                      <div className="h-14 w-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-500">
                        <Building2 className="h-7 w-7 text-indigo-600" />
                      </div>
                      <CardTitle className="text-xl font-bold text-slate-800 tracking-tight">{dept.department_name}</CardTitle>
                      <CardDescription className="flex items-center gap-2 pt-1 font-medium text-indigo-600/70">
                        <UserCog className="h-3.5 w-3.5" />
                        {head ? `${head.first_name} ${head.last_name}` : 'No Department Head'}
                      </CardDescription>
                    </CardHeader>

                    <CardContent>
                      <div className="flex items-center gap-4 text-sm text-slate-500">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-700">Detailed</span>
                          <span className="text-[10px] uppercase tracking-widest font-black opacity-60">Structure</span>
                        </div>
                        <div className="h-8 w-px bg-slate-100" />
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-700">Programs</span>
                          <span className="text-[10px] uppercase tracking-widest font-black opacity-60">View</span>
                        </div>
                        <div className="h-8 w-px bg-slate-100" />
                        <div className="flex flex-col">
                          <span className="font-bold text-indigo-600">Active</span>
                          <span className="text-[10px] uppercase tracking-widest font-black opacity-60">Status</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center gap-4 mb-2">
            <Button variant="ghost" size="sm" onClick={() => setView('departments')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Departments
            </Button>
          </div>
          <PageHeader 
            title={selectedDept?.department_name || 'Department Details'} 
            description={`Course offerings and curriculum for the ${selectedDept?.department_name || 'Department'}`}
            action={
              <Button variant="outline" size="sm" className="h-8 text-[10px] font-bold uppercase tracking-widest text-indigo-600 border-indigo-200" onClick={(e) => selectedDept && openEditDept(e, selectedDept)}>
                <Pencil className="h-3 w-3 mr-1.5" /> Edit Department
              </Button>
            }
          />

          {drillLoading ? <LoadingSpinner /> : (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Courses Grid */}
              <Card className="xl:col-span-1">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <BookOpen className="h-4 w-4" /> Courses
                  </CardTitle>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-indigo-600" onClick={() => setAddCourseOpen(true)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px] pr-4">
                    <div className="space-y-3">
                      {courses.length === 0 ? <p className="text-sm italic text-muted-foreground">No courses found</p> : courses.map(c => (
                        <div 
                          key={c.course_id} 
                          className={cn(
                            "p-3 rounded-lg border flex items-center justify-between group transition-all cursor-pointer",
                            selectedCourseId === c.course_id 
                              ? "bg-indigo-50 border-indigo-300 shadow-sm" 
                              : "bg-slate-50/50 hover:border-indigo-200 hover:bg-white"
                          )}
                          onClick={() => setSelectedCourseId(selectedCourseId === c.course_id ? null : c.course_id)}
                        >
                          <div className={cn("font-semibold text-sm flex-1", selectedCourseId === c.course_id ? "text-indigo-700" : "")}>
                            {c.course_name}
                          </div>
                          
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity mr-2">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 text-indigo-600 hover:bg-indigo-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditCourseTarget(c);
                                setEditingCourseName(c.course_name);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 text-red-600 hover:bg-red-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteCourseTarget(c);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>

                          <Badge variant={selectedCourseId === c.course_id ? "default" : "outline"} className="text-[10px] font-bold">COURSE</Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Subjects Table */}
              <Card className="xl:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <BookMarked className="h-4 w-4" /> Subjects & Curriculum
                  </CardTitle>
                  <Button variant="outline" size="sm" className="h-8 text-[10px] font-bold uppercase tracking-widest text-indigo-600 border-indigo-200" onClick={() => setAddSubjectOpen(true)}>
                    <Plus className="h-3 w-3 mr-1.5" /> Add Subject
                  </Button>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[10px] font-bold uppercase">Code</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase">Title</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase">Year</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase">Units</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase text-right pr-6">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {subjects.length === 0 ? (
                          <TableRow><TableCell colSpan={5} className="text-center italic text-muted-foreground py-8">No subjects defined</TableCell></TableRow>
                        ) : (selectedCourseId ? subjects.filter(s => s.course_id === selectedCourseId) : subjects).map(s => {
                          const subOfferings = offerings.filter(off => off.subject_id === s.subject_id);
                          return (
                            <TableRow key={s.subject_id} className="hover:bg-slate-50 transition-colors">
                              <TableCell className="font-mono text-xs font-bold text-indigo-600">{s.code}</TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="font-semibold text-sm">{s.title}</span>
                                  <span className="text-[10px] text-muted-foreground">{s.course_name}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-xs">
                                <Badge variant="outline" className="text-[9px] font-bold uppercase whitespace-nowrap">
                                  {s.year_level || 'General'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs">{s.credit_units} Units</TableCell>
                               <TableCell className="text-right">
                                <div className="flex flex-col items-end">
                                  <div className="flex items-center gap-2">
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className={cn(
                                        "h-8 px-2 text-[10px] font-bold transition-all gap-1.5",
                                        expandedSubjects.includes(s.subject_id) 
                                          ? "bg-indigo-600 text-white hover:bg-indigo-700" 
                                          : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                                      )}
                                      disabled={subOfferings.length === 0}
                                      onClick={() => {
                                        setExpandedSubjects(prev => 
                                          prev.includes(s.subject_id) 
                                            ? prev.filter(id => id !== s.subject_id) 
                                            : [...prev, s.subject_id]
                                        );
                                      }}
                                    >
                                      {expandedSubjects.includes(s.subject_id) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                      {subOfferings.length} {subOfferings.length === 1 ? 'Section' : 'Sections'}
                                    </Button>
                                    
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      className="h-8 px-3 text-[10px] font-bold uppercase tracking-wider text-indigo-600 border-indigo-200 hover:bg-indigo-50 transition-all gap-1.5 shadow-sm"
                                      onClick={() => { setTargetSubject(s); setAddSectionOpen(true); }}
                                    >
                                      <Plus className="h-3.5 w-3.5" />
                                      Assign
                                    </Button>

                                    <div className="h-6 w-px bg-slate-100 mx-1" />

                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-8 w-8 text-indigo-600 hover:bg-indigo-50"
                                      onClick={() => {
                                        setEditSubjectTarget(s);
                                        setEditingSubjectForm({
                                          ...s,
                                          course_id: String(s.course_id),
                                          year_level: s.year_level || '1st Year',
                                          subject_type: s.subject_type || 'Major',
                                          prerequisite_id: s.prerequisite_id ? String(s.prerequisite_id) : 'none'
                                        });
                                      }}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-8 w-8 text-red-600 hover:bg-red-50"
                                      onClick={() => setDeleteSubjectTarget(s)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>

                                  {expandedSubjects.includes(s.subject_id) && (
                                    <div className="mt-4 space-y-1 w-full max-w-[320px] animate-in slide-in-from-top-2 duration-300 text-left">
                                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 pl-1">Assigned Sections</div>
                                      {subOfferings.map(off => (
                                        <div 
                                          key={off.offering_id} 
                                          className="group/sec border border-slate-200 bg-white shadow-sm hover:border-indigo-300 transition-all"
                                        >
                                          <div className="flex items-center justify-between p-2 pl-3">
                                            <div className="flex flex-col">
                                              <div className="flex items-center gap-2 group/name">
                                                <span className="text-[11px] font-bold text-slate-800">{off.section_name}</span>
                                                <Button 
                                                  variant="ghost" size="icon" className="h-4 w-4 opacity-0 group-hover/name:opacity-100 transition-opacity"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditSectionTarget(off);
                                                    setEditingSectionName(off.section_name);
                                                  }}
                                                >
                                                  <Pencil className="h-2.5 w-2.5 text-slate-400" />
                                                </Button>
                                              </div>
                                              <span className="text-[9px] text-indigo-500 font-medium uppercase truncate max-w-[120px]">
                                                {off.instructor_last ? `${off.instructor_last}` : 'TBA'}
                                              </span>
                                            </div>
                                            
                                            <div className="flex items-center gap-1.5 pr-1">
                                              <Link href={`/sections/${off.section_id}`} target="_blank" title="View Section Detail">
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                                                  <Eye className="h-3.5 w-3.5" />
                                                </Button>
                                              </Link>
                                              <Button 
                                                variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                                                onClick={() => setEditOfferingTarget(off)}
                                                title="Edit Assignment"
                                              >
                                                <Pencil className="h-3.5 w-3.5" />
                                              </Button>
                                              <Button 
                                                variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                                onClick={() => setDeleteSectionTarget(off)}
                                                title="Remove Assignment"
                                              >
                                                <Trash2 className="h-3.5 w-3.5" />
                                              </Button>
                                              <div className="h-4 w-px bg-slate-100 mx-0.5" />
                                              <ChevronDown className="h-3 w-3 text-slate-300 group-hover/sec:text-indigo-400 transition-colors mr-1" />
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {/* Add Course Dialog */}
      <Dialog open={addCourseOpen} onOpenChange={setAddCourseOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Course</DialogTitle>
            <DialogDescription>Create a new academic program for {selectedDept?.department_name || 'the department'}.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4 py-4" onSubmit={async (e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const name = formData.get('course_name') as string;
            if (!name || !selectedDept) return;
            setSavingEntity(true);
            const res = await courseService.create({ dept_id: selectedDept.dept_id, course_name: name });
            setSavingEntity(false);
            if (res.success) {
              toast.success('Course created.');
              setAddCourseOpen(false);
              loadDeptDetails(selectedDept.dept_id);
            } else toast.error(res.message);
          }}>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Course Name</Label>
              <Input name="course_name" placeholder="e.g., Bachelor of Science in Information Technology" required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddCourseOpen(false)}>Cancel</Button>
              <Button className="bg-indigo-600 hover:bg-indigo-700" type="submit" disabled={savingEntity}>
                {savingEntity && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Course
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Subject Dialog */}
      <Dialog open={addSubjectOpen} onOpenChange={setAddSubjectOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New Subject</DialogTitle>
            <DialogDescription>Define a new subject for the curricula in this department.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4 py-4" onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const data = {
              course_id: Number(fd.get('course_id')),
              code: fd.get('code') as string,
              title: fd.get('title') as string,
              credit_units: Number(fd.get('credit_units')),
              year_level: fd.get('year_level') as any,
              subject_type: fd.get('subject_type') as any,
              prerequisite_id: fd.get('prerequisite_id') ? Number(fd.get('prerequisite_id')) : null
            };
            if (!selectedDept) return;
            setSavingEntity(true);
            const res = await subjectService.create(data);
            setSavingEntity(false);
            if (res.success) {
              toast.success('Subject created.');
              setAddSubjectOpen(false);
              loadDeptDetails(selectedDept.dept_id);
            } else toast.error(res.message);
          }}>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Parent Course</Label>
                <Select name="course_id" required>
                  <SelectTrigger><SelectValue placeholder="Select course..." /></SelectTrigger>
                  <SelectContent>
                    {courses.map(c => <SelectItem key={c.course_id} value={String(c.course_id)}>{c.course_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Subject Code</Label>
                <Input name="code" placeholder="IT-101" required />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Units</Label>
                <Input name="credit_units" type="number" defaultValue="3" required />
              </div>
              <div className="space-y-2 col-span-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Subject Title</Label>
                <Input name="title" placeholder="Introduction to Computing" required />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Type</Label>
                <Select name="subject_type" defaultValue="Major">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Major">Major</SelectItem>
                    <SelectItem value="Minor">Minor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Year Level</Label>
                <Select name="year_level" defaultValue="1st Year">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1st Year">1st Year</SelectItem>
                    <SelectItem value="2nd Year">2nd Year</SelectItem>
                    <SelectItem value="3rd Year">3rd Year</SelectItem>
                    <SelectItem value="4th Year">4th Year</SelectItem>
                    <SelectItem value="Masteral">Masteral</SelectItem>
                    <SelectItem value="Doctorate">Doctorate</SelectItem>
                    <SelectItem value="Irregular">Irregular</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Prerequisite (Optional)</Label>
                <Select name="prerequisite_id">
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Prerequisite</SelectItem>
                    {subjects.map(s => <SelectItem key={s.subject_id} value={String(s.subject_id)}>{s.code}: {s.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddSubjectOpen(false)}>Cancel</Button>
              <Button className="bg-indigo-600 hover:bg-indigo-700" type="submit" disabled={savingEntity}>
                {savingEntity && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Subject
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Section Dialog */}
      <Dialog open={addSectionOpen} onOpenChange={(o) => {
        setAddSectionOpen(o);
        if (!o) {
          setSelectedSectionId('');
          setSelectedTermId('');
          setAssignedCapacity(40);
        }
      }}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Assign Section to {targetSubject?.code}</DialogTitle>
            <DialogDescription>
              Select an existing section shell and set the schedule for this subject offering.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4 py-4" onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            if (!targetSubject || !selectedDept) return;
            
            setSavingEntity(true);
            try {
              // 1. Create Subject Offering
              const offRes = await fetch('/api/subject-offerings', {
                method: 'POST',
                body: JSON.stringify({
                  subject_id: targetSubject.subject_id,
                  section_id: Number(fd.get('section_id')),
                  instructor_id: fd.get('instructor_id')
                })
              }).then(r => r.json());

              if (!offRes.success) { toast.error(offRes.message); return; }

              // 2. Create Schedule(s)
              const dayValue = fd.get('day_of_week') as string;
              const days = dayValue.includes('&') 
                ? dayValue.split('&').map(d => d.trim()) 
                : [dayValue];

              let successCount = 0;
              for (const day of days) {
                const schRes = await fetch('/api/schedules', {
                  method: 'POST',
                  body: JSON.stringify({
                    offering_id: offRes.data.offering_id,
                    day_of_week: day,
                    start_time: fd.get('start_time'),
                    end_time: fd.get('end_time'),
                    room: fd.get('room'),
                    start_date: semesters.find(s => String(s.semester_id) === selectedTermId)?.start_date?.slice(0, 10),
                    end_date: semesters.find(s => String(s.semester_id) === selectedTermId)?.end_date?.slice(0, 10)
                  })
                }).then(r => r.json());

                if (schRes.success) successCount++;
                else toast.error(`Failed to schedule ${day}: ${schRes.message}`);
              }

              if (successCount === days.length) {
                toast.success('Section assigned and schedules created.');
              }

              setAddSectionOpen(false);
              loadDeptDetails(selectedDept.dept_id);
            } catch (err) {
              toast.error('An error occurred during assignment.');
            } finally {
              setSavingEntity(false);
            }
          }}>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Select Term</Label>
                <Select 
                  name="semester_id" 
                  value={selectedTermId} 
                  onValueChange={setSelectedTermId}
                  required
                >
                  <SelectTrigger><SelectValue placeholder="Choose term first..." /></SelectTrigger>
                  <SelectContent>
                    {semesters.map(s => <SelectItem key={s.semester_id} value={String(s.semester_id)}>{s.school_year} - {s.term}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 col-span-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Section Name</Label>
                <Select 
                  name="section_id" 
                  value={selectedSectionId}
                  disabled={!selectedTermId}
                  onValueChange={(val) => {
                    setSelectedSectionId(val);
                    const sec = sectionPool.find(s => String(s.section_id) === val);
                    if (sec) setAssignedCapacity(sec.capacity);
                  }}
                  required
                >
                  <SelectTrigger><SelectValue placeholder={selectedTermId ? "Select section pool..." : "Select term above"} /></SelectTrigger>
                  <SelectContent>
                    {sectionPool
                      .filter(s => String(s.semester_id) === selectedTermId)
                      .map(s => <SelectItem key={s.section_id} value={String(s.section_id)}>{s.section_name}</SelectItem>)
                    }
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Instructor</Label>
                <Select name="instructor_id" required>
                  <SelectTrigger><SelectValue placeholder="Select faculty..." /></SelectTrigger>
                  <SelectContent>
                    {faculty.map(f => <SelectItem key={f.user_id} value={f.user_id}>{f.last_name}, {f.first_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-amber-600">Capacity (Read-only)</Label>
                <Input value={assignedCapacity} readOnly className="bg-slate-50 font-bold border-amber-100" />
                <input type="hidden" name="capacity" value={assignedCapacity} />
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t mt-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Class Schedule</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Day</Label>
                  <Select name="day_of_week" defaultValue="Monday & Thursday" required>
                    <SelectTrigger className="h-8 text-xs font-semibold ring-offset-background focus:ring-indigo-500"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <div className="px-2 py-1.5 text-[10px] font-black uppercase tracking-widest text-indigo-500/70">Regular Schedule</div>
                      <SelectItem value="Monday & Thursday" className="text-xs cursor-pointer focus:bg-indigo-50">Option 1: Monday & Thursday</SelectItem>
                      <SelectItem value="Tuesday & Friday" className="text-xs cursor-pointer focus:bg-indigo-50">Option 2: Tuesday & Friday</SelectItem>
                      
                      <div className="px-2 py-1.5 mt-2 text-[10px] font-black uppercase tracking-widest text-amber-500/70">Special Sessions</div>
                      <SelectItem value="Wednesday" className="text-xs cursor-pointer focus:bg-amber-50">Midweek: Wednesday (On-Request)</SelectItem>
                      <SelectItem value="Saturday" className="text-xs cursor-pointer focus:bg-amber-50">Weekend: Saturday (NSTP/OJT)</SelectItem>
                      
                      <div className="px-2 py-1.5 mt-2 text-[10px] font-black uppercase tracking-widest text-slate-500/70">Other</div>
                      {['Monday','Tuesday','Thursday','Friday','Sunday'].map(d => (
                        <SelectItem key={d} value={d} className="text-xs cursor-pointer">{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Room</Label>
                  <Input name="room" placeholder="e.g., CL1" className="h-8 text-xs" required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Time In</Label>
                  <Input name="start_time" type="time" className="h-8 text-xs" required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Time Out</Label>
                  <Input name="end_time" type="time" className="h-8 text-xs" required />
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setAddSectionOpen(false)}>Cancel</Button>
              <Button className="bg-indigo-600 hover:bg-indigo-700" size="sm" type="submit" disabled={savingEntity}>
                {savingEntity && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm Assignment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Department Dialog */}
      <Dialog open={!!editDeptTarget} onOpenChange={o => !o && setEditDeptTarget(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Department</DialogTitle>
            <DialogDescription>Modify the department name and assign a department head.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Department Name</Label>
              <Input 
                value={editingDeptName} 
                onChange={e => setEditingDeptName(e.target.value)} 
                placeholder="e.g., Computer Science" 
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Department Head</Label>
              <Select 
                value={editingDeptHeadId} 
                onValueChange={setEditingDeptHeadId}
              >
                <SelectTrigger><SelectValue placeholder="Select faculty..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Unassigned)</SelectItem>
                  {faculty.map(f => (
                    <SelectItem key={f.user_id} value={f.user_id}>{f.last_name}, {f.first_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDeptTarget(null)}>Cancel</Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={handleDeptUpdate} disabled={savingDept}>
              {savingDept && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Section Confirm */}
      <ConfirmDialog 
        open={!!deleteSectionTarget}
        onOpenChange={(o: boolean) => !o && setDeleteSectionTarget(null)}
        title="Remove Assignment?"
        description={`Removing this subject assignment will remove it from this section cohort. All grades and schedules for this specific class will be deleted. Students enrolled will be affected.`}
        loading={deletingSection}
        onConfirm={async () => {
          if (!deleteSectionTarget || !selectedDept) return;
          setDeletingSection(true);
          const res = await subjectOfferingService.remove(deleteSectionTarget.offering_id);
          setDeletingSection(false);
          if (res.success) {
            toast.success('Course assignment removed.');
            setDeleteSectionTarget(null);
            loadDeptDetails(selectedDept.dept_id);
          } else toast.error(res.message);
        }}
      />

      {/* Add Department Dialog */}
      <Dialog open={addDeptOpen} onOpenChange={setAddDeptOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Department</DialogTitle>
            <DialogDescription>Create a new academic department for the university.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Department Name</Label>
              <Input 
                value={addDeptName} 
                onChange={e => setAddDeptName(e.target.value)} 
                placeholder="e.g., College of Engineering" 
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Initial Department Head</Label>
              <Select 
                value={addDeptHeadId} 
                onValueChange={setAddDeptHeadId}
              >
                <SelectTrigger><SelectValue placeholder="Select faculty (optional)..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Unassigned)</SelectItem>
                  {faculty.map(f => (
                    <SelectItem key={f.user_id} value={f.user_id}>{f.last_name}, {f.first_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDeptOpen(false)}>Cancel</Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={handleCreateDept} disabled={savingDept}>
              {savingDept && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Department
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Department Confirm */}
      <ConfirmDialog 
        open={!!deleteDeptTarget}
        onOpenChange={(o) => !o && setDeleteDeptTarget(null)}
        title="Delete Department?"
        description={`This will permanently delete the department "${deleteDeptTarget?.department_name}". This action cannot be undone and may fail if there are courses linked to it.`}
        loading={deletingDept}
        onConfirm={handleDeleteDept}
      />

      {/* Edit Offering Dialog */}
      <Dialog open={!!editOfferingTarget} onOpenChange={o => !o && setEditOfferingTarget(null)}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-amber-500" />
              Edit Assignment: {editOfferingTarget?.section_name}
            </DialogTitle>
            <DialogDescription>
              Update the instructor or re-configure the class schedule for this subject offering.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">Instructor</Label>
              <Select 
                value={editOfferingForm.instructor_id} 
                onValueChange={v => setEditOfferingForm(f => ({ ...f, instructor_id: v }))}
              >
                <SelectTrigger className="h-10"><SelectValue placeholder="Select faculty..." /></SelectTrigger>
                <SelectContent>
                  {faculty.map(f => (
                    <SelectItem key={f.user_id} value={f.user_id}>{f.last_name}, {f.first_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3 pt-3 border-t">
              <Label className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Update Schedule</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs font-medium text-slate-600">Day Options</Label>
                  <Select 
                    value={editOfferingForm.day_of_week} 
                    onValueChange={v => setEditOfferingForm(f => ({ ...f, day_of_week: v }))}
                  >
                    <SelectTrigger className="h-8 text-xs font-semibold"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <div className="px-2 py-1.5 text-[10px] font-black uppercase tracking-widest text-indigo-500/70">Regular</div>
                      <SelectItem value="Monday & Thursday" className="text-xs">Monday & Thursday</SelectItem>
                      <SelectItem value="Tuesday & Friday" className="text-xs">Tuesday & Friday</SelectItem>
                      <div className="px-2 py-1.5 mt-2 text-[10px] font-black uppercase tracking-widest text-amber-500/70">Special</div>
                      <SelectItem value="Wednesday" className="text-xs">Wednesday (Midweek)</SelectItem>
                      <SelectItem value="Saturday" className="text-xs">Saturday (Weekend)</SelectItem>
                      <div className="px-2 py-1.5 mt-2 text-[10px] font-black uppercase tracking-widest text-slate-500/70">Other</div>
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
                    value={editOfferingForm.room}
                    onChange={e => setEditOfferingForm(f => ({ ...f, room: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5"></div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Time In</Label>
                  <Input 
                    type="time" 
                    className="h-8 text-xs" 
                    value={editOfferingForm.start_time}
                    onChange={e => setEditOfferingForm(f => ({ ...f, start_time: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Time Out</Label>
                  <Input 
                    type="time" 
                    className="h-8 text-xs" 
                    value={editOfferingForm.end_time}
                    onChange={e => setEditOfferingForm(f => ({ ...f, end_time: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditOfferingTarget(null)}>Cancel</Button>
            <Button 
              className="bg-indigo-600 hover:bg-indigo-700" 
              size="sm"
              disabled={savingEntity}
              onClick={async () => {
                if (!editOfferingTarget || !selectedDept) return;
                setSavingEntity(true);
                try {
                  // 1. Update Instructor
                  await fetch(`/api/subject-offerings/${editOfferingTarget.offering_id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ instructor_id: editOfferingForm.instructor_id })
                  });

                  // 2. Refresh Schedules
                  const sres = await fetch(`/api/schedules?offering_id=${editOfferingTarget.offering_id}`).then(r => r.json());
                  if (sres.success) {
                    for (const s of sres.data) {
                      await fetch(`/api/schedules/${s.schedule_id}`, { method: 'DELETE' });
                    }
                  }

                  const days = editOfferingForm.day_of_week.includes('&') 
                    ? editOfferingForm.day_of_week.split('&').map(d => d.trim()) 
                    : [editOfferingForm.day_of_week];

                  for (const d of days) {
                    await fetch('/api/schedules', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        offering_id: editOfferingTarget.offering_id,
                        day_of_week: d,
                        start_time: editOfferingForm.start_time,
                        end_time: editOfferingForm.end_time,
                        room: editOfferingForm.room
                      })
                    });
                  }

                  toast.success('Assignment updated successfully.');
                  setEditOfferingTarget(null);
                  loadDeptDetails(selectedDept.dept_id);
                } catch (err) {
                  toast.error('An error occurred while updating the assignment.');
                } finally {
                  setSavingEntity(false);
                }
              }}
            >
              {savingEntity && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Course Dialog */}
      <Dialog open={!!editCourseTarget} onOpenChange={o => !o && setEditCourseTarget(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Course</DialogTitle>
            <DialogDescription>Modify the course name for {selectedDept?.department_name}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Course Name</Label>
              <Input 
                value={editingCourseName} 
                onChange={e => setEditingCourseName(e.target.value)} 
                placeholder="e.g., Bachelor of Science in Information Technology" 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCourseTarget(null)}>Cancel</Button>
            <Button 
              className="bg-indigo-600 hover:bg-indigo-700" 
              disabled={savingEntity}
              onClick={async () => {
                if (!editCourseTarget || !selectedDept) return;
                setSavingEntity(true);
                const res = await courseService.update(editCourseTarget.course_id, { course_name: editingCourseName });
                setSavingEntity(false);
                if (res.success) {
                  toast.success('Course updated.');
                  setEditCourseTarget(null);
                  loadDeptDetails(selectedDept.dept_id);
                } else toast.error(res.message);
              }}
            >
              {savingEntity && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Course Confirm */}
      <ConfirmDialog 
        open={!!deleteCourseTarget}
        onOpenChange={o => !o && setDeleteCourseTarget(null)}
        title="Delete Course?"
        description={`This will permanently delete the course "${deleteCourseTarget?.course_name}". This may fail if there are subjects or students linked to it.`}
        loading={savingEntity}
        onConfirm={async () => {
          if (!deleteCourseTarget || !selectedDept) return;
          setSavingEntity(true);
          const res = await courseService.remove(deleteCourseTarget.course_id);
          setSavingEntity(false);
          if (res.success) {
            toast.success('Course deleted.');
            setDeleteCourseTarget(null);
            loadDeptDetails(selectedDept.dept_id);
          } else toast.error(res.message);
        }}
      />

      {/* Edit Subject Dialog */}
      <Dialog open={!!editSubjectTarget} onOpenChange={o => !o && setEditSubjectTarget(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Subject</DialogTitle>
            <DialogDescription>Modify subject details and curriculum settings.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Parent Course</Label>
                <Select 
                  value={editingSubjectForm?.course_id} 
                  onValueChange={v => setEditingSubjectForm((f: any) => ({ ...f, course_id: v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Select course..." /></SelectTrigger>
                  <SelectContent>
                    {courses.map(c => <SelectItem key={c.course_id} value={String(c.course_id)}>{c.course_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Subject Code</Label>
                <Input 
                  value={editingSubjectForm?.code} 
                  onChange={e => setEditingSubjectForm((f: any) => ({ ...f, code: e.target.value }))}
                  placeholder="IT-101" 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Units</Label>
                <Input 
                  type="number" 
                  value={editingSubjectForm?.credit_units} 
                  onChange={e => setEditingSubjectForm((f: any) => ({ ...f, credit_units: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Subject Title</Label>
                <Input 
                  value={editingSubjectForm?.title} 
                  onChange={e => setEditingSubjectForm((f: any) => ({ ...f, title: e.target.value }))}
                  placeholder="Introduction to Computing" 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Type</Label>
                <Select 
                  value={editingSubjectForm?.subject_type} 
                  onValueChange={v => setEditingSubjectForm((f: any) => ({ ...f, subject_type: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Major">Major</SelectItem>
                    <SelectItem value="Minor">Minor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Year Level</Label>
                <Select 
                  value={editingSubjectForm?.year_level} 
                  onValueChange={v => setEditingSubjectForm((f: any) => ({ ...f, year_level: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1st Year">1st Year</SelectItem>
                    <SelectItem value="2nd Year">2nd Year</SelectItem>
                    <SelectItem value="3rd Year">3rd Year</SelectItem>
                    <SelectItem value="4th Year">4th Year</SelectItem>
                    <SelectItem value="Masteral">Masteral</SelectItem>
                    <SelectItem value="Doctorate">Doctorate</SelectItem>
                    <SelectItem value="Irregular">Irregular</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 col-span-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Prerequisite (Optional)</Label>
                <Select 
                  value={editingSubjectForm?.prerequisite_id} 
                  onValueChange={v => setEditingSubjectForm((f: any) => ({ ...f, prerequisite_id: v }))}
                >
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Prerequisite</SelectItem>
                    {subjects
                      .filter(s => s.subject_id !== editSubjectTarget?.subject_id)
                      .map(s => <SelectItem key={s.subject_id} value={String(s.subject_id)}>{s.code}: {s.title}</SelectItem>)
                    }
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSubjectTarget(null)}>Cancel</Button>
            <Button 
              className="bg-indigo-600 hover:bg-indigo-700" 
              disabled={savingEntity}
              onClick={async () => {
                if (!editSubjectTarget || !selectedDept) return;
                setSavingEntity(true);
                const data = {
                  ...editingSubjectForm,
                  course_id: Number(editingSubjectForm.course_id),
                  prerequisite_id: editingSubjectForm.prerequisite_id === 'none' ? null : Number(editingSubjectForm.prerequisite_id)
                };
                const res = await subjectService.update(editSubjectTarget.subject_id, data);
                setSavingEntity(false);
                if (res.success) {
                  toast.success('Subject updated.');
                  setEditSubjectTarget(null);
                  loadDeptDetails(selectedDept.dept_id);
                } else toast.error(res.message);
              }}
            >
              {savingEntity && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Subject Confirm */}
      <ConfirmDialog 
        open={!!deleteSubjectTarget}
        onOpenChange={o => !o && setDeleteSubjectTarget(null)}
        title="Delete Subject?"
        description={`This will permanently delete the subject "${deleteSubjectTarget?.code}: ${deleteSubjectTarget?.title}". This may fail if there are active offerings or student grades linked to it.`}
        loading={savingEntity}
        onConfirm={async () => {
          if (!deleteSubjectTarget || !selectedDept) return;
          setSavingEntity(true);
          const res = await subjectService.remove(deleteSubjectTarget.subject_id);
          setSavingEntity(false);
          if (res.success) {
            toast.success('Subject deleted.');
            setDeleteSubjectTarget(null);
            loadDeptDetails(selectedDept.dept_id);
          } else toast.error(res.message);
        }}
      />
      {/* Edit Section Name Dialog */}
      <Dialog open={!!editSectionTarget} onOpenChange={o => !o && setEditSectionTarget(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Rename Section</DialogTitle>
            <DialogDescription>Change the name for this academic section cohort.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Section Name</Label>
              <Input 
                value={editingSectionName} 
                onChange={e => setEditingSectionName(e.target.value)} 
                placeholder="e.g., BSIT-1A" 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSectionTarget(null)}>Cancel</Button>
            <Button 
              className="bg-indigo-600 hover:bg-indigo-700" 
              disabled={savingEntity}
              onClick={async () => {
                if (!editSectionTarget || !selectedDept) return;
                setSavingEntity(true);
                try {
                  const res = await fetch(`/api/sections/${editSectionTarget.section_id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ section_name: editingSectionName })
                  }).then(r => r.json());

                  if (res.success) {
                    toast.success('Section renamed.');
                    setEditSectionTarget(null);
                    loadDeptDetails(selectedDept.dept_id);
                  } else toast.error(res.message);
                } catch (err) {
                  toast.error('An error occurred.');
                } finally {
                  setSavingEntity(false);
                }
              }}
            >
              {savingEntity && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


