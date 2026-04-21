'use client';

import { useState, useEffect, useCallback } from 'react';
import { classRecordService } from '@/services/classRecordService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { toast } from 'sonner';
import { Plus, Save, Loader2, Calendar, Edit, Trash2 } from 'lucide-react';

interface ClassRecordTabProps {
  offeringId: string;
}

export function ClassRecordTab({ offeringId }: ClassRecordTabProps) {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  
  // scoresMap[enrollment_id][item_id]
  const [scoresMap, setScoresMap] = useState<Record<number, Record<number, number | null>>>({});
  
  // tracking changes for bulk save
  const [editedScores, setEditedScores] = useState<Record<string, number | null>>({}); // key: 'enrollmentId_itemId'
  const [saving, setSaving] = useState(false);

  // For creating a new item
  const [isCreating, setIsCreating] = useState(false);
  const [newItem, setNewItem] = useState({
    record_type: 'Activity',
    title: '',
    max_score: 100,
    record_date: new Date().toISOString().split('T')[0],
    visible_to_students: true,
  });

  const loadMatrix = useCallback(async () => {
    setLoading(true);
    const res = await classRecordService.getMatrix(Number(offeringId));
    if (res.success) {
      setStudents(res.data?.students ?? []);
      setItems(res.data?.items ?? []);
      setScoresMap(res.data?.scoresMap ?? {});
      setEditedScores({});
    }
    setLoading(false);
  }, [offeringId]);

  useEffect(() => {
    if (offeringId) {
      loadMatrix();
      setIsCreating(false);
    }
  }, [offeringId, loadMatrix]);

  async function handleCreateItem() {
    if (!newItem.title) return toast.error('Title is required');
    setSaving(true);
    const res = await classRecordService.createItem({ ...newItem, offering_id: Number(offeringId) });
    setSaving(false);
    if (res.success) {
      toast.success('Record column created');
      setIsCreating(false);
      loadMatrix();
    } else {
      toast.error(res.message || 'Failed to create item');
    }
  }

  function handleScoreChange(enrollmentId: number, itemId: number, value: string) {
    const parsed = value === '' ? null : Number(value);
    
    // Update local state for immediate feedback
    setScoresMap(prev => ({
      ...prev,
      [enrollmentId]: {
        ...prev[enrollmentId],
        [itemId]: parsed
      }
    }));

    // Track as edited (for bulk save)
    setEditedScores(prev => ({
      ...prev,
      [`${enrollmentId}_${itemId}`]: parsed
    }));
  }

  async function handleSaveAllScores() {
    const edits = Object.keys(editedScores);
    if (edits.length === 0) return;

    setSaving(true);
    const payload = edits.map(key => {
      const [enr, itm] = key.split('_');
      return {
        enrollment_id: Number(enr),
        item_id: Number(itm),
        score: editedScores[key]
      };
    });

    const res = await classRecordService.saveMatrix({ offering_id: Number(offeringId), scores: payload });
    setSaving(false);
    
    if (res.success) {
      toast.success('Scores saved successfully');
      setEditedScores({});
    } else {
      toast.error(res.message || 'Failed to save scores');
    }
  }

  async function handleDeleteItem(id: number) {
    if (!confirm('Are you sure you want to delete this column? All student scores for this record will be lost.')) return;
    const res = await classRecordService.deleteItem(id);
    if (res.success) {
      toast.success('Column deleted');
      loadMatrix();
    } else {
      toast.error(res.message || 'Failed to delete');
    }
  }

  if (loading && !isCreating) {
    return <LoadingSpinner />;
  }

  if (!offeringId) {
    return <EmptyState title="Select an offering to view class records" />;
  }

  // --- CREATE VIEW ---
  if (isCreating) {
    return (
      <Card className="border-none shadow-xl">
        <CardHeader className="border-b bg-muted/30 pb-4">
          <CardTitle>New Class Record Column</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 max-w-md space-y-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={newItem.record_type} onValueChange={v => setNewItem({...newItem, record_type: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Activity">Activity</SelectItem>
                <SelectItem value="Quiz">Quiz</SelectItem>
                <SelectItem value="Assessment">Assessment</SelectItem>
                <SelectItem value="Exam">Exam</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={newItem.title} onChange={e => setNewItem({...newItem, title: e.target.value})} placeholder="e.g. Chapter 1 Quiz" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Max Score</Label>
              <Input type="number" min="1" value={newItem.max_score} onChange={e => setNewItem({...newItem, max_score: Number(e.target.value)})} />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={newItem.record_date} onChange={e => setNewItem({...newItem, record_date: e.target.value})} />
            </div>
          </div>
          <div className="flex items-center space-x-2 pt-2">
            <Switch checked={newItem.visible_to_students} onCheckedChange={c => setNewItem({...newItem, visible_to_students: c})} />
            <Label>Visible to students</Label>
          </div>
          <div className="pt-4 flex gap-2">
            <Button onClick={handleCreateItem} disabled={saving} className="bg-primary hover:bg-primary/90 flex-1">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />} Create Column
            </Button>
            <Button variant="outline" onClick={() => setIsCreating(false)} disabled={saving}>Cancel</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasEdits = Object.keys(editedScores).length > 0;

  // --- GRID VIEW ---
  return (
    <Card className="border-none shadow-xl overflow-hidden">
      <CardHeader className="bg-muted/30 border-b py-3 px-6">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            Class Record Sheet — {items.length} columns
          </CardTitle>
          <div className="flex gap-2 items-center">
            {hasEdits && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs animate-pulse mr-2">
                Unsaved changes
              </Badge>
            )}
            <Button size="sm" variant="outline" onClick={() => setIsCreating(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Add Column
            </Button>
            <Button size="sm" onClick={handleSaveAllScores} disabled={!hasEdits || saving} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
               {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Scores
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
           <div className="p-12 text-center text-muted-foreground">
              <p className="font-medium">No records yet.</p>
              <p className="text-sm mt-1 mb-4">Click 'Add Column' to create an activity or quiz.</p>
           </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Using a fixed layout table makes it look like an Excel sheet */}
            <Table style={{ tableLayout: 'fixed', minWidth: `${300 + (items.length * 150)}px` }}>
              <TableHeader>
                <TableRow className="bg-muted/10 h-16">
                  {/* Sticky student column */}
                  <TableHead className="w-[300px] border-r align-middle bg-muted/10 sticky left-0 z-10 shadow-[1px_0_0_0_#e5e7eb] dark:shadow-[1px_0_0_0_#262626]">
                    <div className="pl-4 font-black uppercase text-[10px]">Student</div>
                  </TableHead>
                  
                  {/* Dynamic item columns */}
                  {items.map(item => (
                    <TableHead key={item.item_id} className="w-[150px] border-r p-0 align-top group">
                       <div className="h-full flex flex-col justify-between p-2">
                         <div className="flex justify-between items-start">
                           <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-background">{item.record_type}</Badge>
                           <button onClick={() => handleDeleteItem(item.item_id)} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity" title="Delete Column">
                             <Trash2 className="h-3 w-3" />
                           </button>
                         </div>
                         <div className="mt-1">
                           <p className="font-bold text-xs leading-tight truncate" title={item.title}>{item.title}</p>
                           <p className="text-[9px] text-muted-foreground mt-0.5">{new Date(item.record_date).toLocaleDateString()}</p>
                         </div>
                         <div className="mt-1 text-center bg-muted/20 py-0.5 rounded text-[10px] font-mono font-bold text-muted-foreground">
                           Max: {item.max_score}
                         </div>
                       </div>
                    </TableHead>
                  ))}
                  
                  <TableHead className="w-[100px] align-bottom pb-3"><div className="text-center font-black uppercase text-[10px] text-muted-foreground">Total Average</div></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student, idx) => {
                  
                  // compute a quick row average just for show
                  let totalEarned = 0;
                  let totalMax = 0;
                  items.forEach(item => {
                    let score = scoresMap[student.enrollment_id]?.[item.item_id];
                    
                    // If currently edited, use the typed value for real-time calculation
                    const edited = editedScores[`${student.enrollment_id}_${item.item_id}`];
                    if (edited !== undefined) {
                      score = edited;
                    }

                    if (score !== null && score !== undefined && score !== '') {
                      totalEarned += Number(score);
                      totalMax += Number(item.max_score);
                    }
                  });
                  const rowAvg = (totalMax > 0 && !isNaN(totalEarned) && !isNaN(totalMax)) 
                    ? ((totalEarned / totalMax) * 100).toFixed(2) + '%' 
                    : '—';

                  return (
                    <TableRow key={student.enrollment_id} className="hover:bg-muted/5 group">
                      {/* Sticky student column */}
                      <TableCell className="border-r p-0 bg-background/95 backdrop-blur-sm sticky left-0 z-10 shadow-[1px_0_0_0_#e5e7eb] group-hover:bg-muted/5 dark:shadow-[1px_0_0_0_#262626]">
                        <div className="flex items-center px-4 py-2">
                          <span className="text-muted-foreground text-xs font-mono w-6">{idx + 1}</span>
                          <div>
                            <p className="font-bold text-sm whitespace-nowrap">{student.last_name}, {student.first_name}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{student.user_id}</p>
                          </div>
                        </div>
                      </TableCell>

                      {/* Dynamic score inputs */}
                      {items.map(item => {
                        const val = scoresMap[student.enrollment_id]?.[item.item_id];
                        const isEdited = editedScores[`${student.enrollment_id}_${item.item_id}`] !== undefined;

                        return (
                          <TableCell key={item.item_id} className={`border-r p-1 text-center ${isEdited ? 'bg-amber-50/30' : ''}`}>
                            <Input
                              type="number"
                              min="0"
                              max={item.max_score}
                              placeholder="—"
                              className={`h-8 w-[80%] mx-auto text-center font-medium text-sm border-transparent hover:border-input focus:border-ring transition-colors ${isEdited ? 'text-amber-700 font-bold' : ''}`}
                              value={val ?? ''}
                              onChange={(e) => handleScoreChange(student.enrollment_id, item.item_id, e.target.value)}
                            />
                          </TableCell>
                        );
                      })}

                      {/* Row Total Average */}
                      <TableCell className="text-center font-bold text-xs bg-muted/10 text-muted-foreground">
                        {rowAvg}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
