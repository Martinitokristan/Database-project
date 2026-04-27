'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/layout/PageHeader';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { assessmentService } from '@/services/assessmentService';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  ArrowLeft, Plus, Trash2, Pencil, Loader2, Upload,
  ClipboardList, Settings, Users, BarChart3, CheckCircle2,
  X, GripVertical, Eye, Lock, Unlock,
} from 'lucide-react';

type Tab = 'questions' | 'settings' | 'access' | 'results';

const statusColors: Record<string, string> = {
  Draft: 'bg-muted text-muted-foreground',
  Published: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  Closed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export default function AssessmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { role, isLoading } = useAuth();
  if (isLoading) return <LoadingSpinner />;
  if (role === 'student') return <StudentRedirect id={id} />;
  return <FacultyManagement id={id} />;
}

function StudentRedirect({ id }: { id: string }) {
  const router = useRouter();
  useEffect(() => { router.replace(`/assessments/${id}/take`); }, [id, router]);
  return <LoadingSpinner />;
}

/* ─── Faculty Management ────────────────────────────────────────── */
function FacultyManagement({ id }: { id: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('questions');
  const [assessment, setAssessment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await assessmentService.get(Number(id));
    if (!res.success) { toast.error('Assessment not found.'); return; }
    setAssessment(res.data);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handlePublish(action: 'publish' | 'unpublish' | 'close') {
    setPublishing(true);
    const res = action === 'publish'
      ? await assessmentService.publish(Number(id))
      : action === 'close'
        ? await assessmentService.close(Number(id))
        : await assessmentService.unpublish(Number(id));
    setPublishing(false);
    if (!res.success) { toast.error(res.message); return; }
    toast.success(res.message);
    load();
  }

  async function handleDelete() {
    if (!confirm('Delete this assessment? This cannot be undone.')) return;
    const res = await assessmentService.remove(Number(id));
    if (!res.success) { toast.error(res.message); return; }
    toast.success('Assessment deleted.');
    router.push('/assessments');
  }

  if (loading) return <LoadingSpinner />;
  if (!assessment) return null;

  const isDraft = assessment.status === 'Draft';
  const isPublished = assessment.status === 'Published';
  const isClosed = assessment.status === 'Closed';

  return (
    <div>
      <PageHeader
        title={assessment.title}
        description={`${assessment.assessment_type} · ${assessment.subject_code} · ${assessment.section_name}`}
        action={
          <div className="flex items-center gap-2">
            <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', statusColors[assessment.status])}>
              {assessment.status}
            </span>
            {isDraft && (
              <>
                <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={handleDelete}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" onClick={() => handlePublish('publish')} disabled={publishing}>
                  {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Publish'}
                </Button>
              </>
            )}
            {isPublished && (
              <Button size="sm" variant="outline" onClick={() => handlePublish('close')} disabled={publishing}>
                {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Close'}
              </Button>
            )}
            {isClosed && (
              <Button size="sm" variant="outline" onClick={() => handlePublish('unpublish')} disabled={publishing}>
                {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reopen as Draft'}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => router.push('/assessments')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b mb-6">
        {([
          { key: 'questions', label: 'Questions', icon: ClipboardList },
          { key: 'settings', label: 'Settings', icon: Settings },
          { key: 'access', label: 'Access', icon: Users },
          { key: 'results', label: 'Results', icon: BarChart3 },
        ] as { key: Tab; label: string; icon: any }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
              tab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'questions' && <QuestionsTab assessment={assessment} onRefresh={load} />}
      {tab === 'settings' && <SettingsTab assessment={assessment} onRefresh={load} key={`settings-${assessment.updated_at || Date.now()}`} />}
      {tab === 'access' && <AccessTab assessmentId={Number(id)} />}
      {tab === 'results' && <ResultsTab assessmentId={Number(id)} assessment={assessment} />}
    </div>
  );
}

/* ─── Questions Tab ─────────────────────────────────────────────── */
function QuestionsTab({ assessment, onRefresh }: { assessment: any; onRefresh: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editQ, setEditQ] = useState<any>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const questions: any[] = assessment.questions ?? [];

  async function handleDelete(qid: number) {
    if (!confirm('Delete this question?')) return;
    const res = await assessmentService.deleteQuestion(assessment.assessment_id, qid);
    if (!res.success) { toast.error(res.message); return; }
    toast.success('Question deleted.');
    onRefresh();
  }

  const totalPoints = questions.reduce((s: number, q: any) => s + parseFloat(q.points), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {questions.length} question{questions.length !== 1 ? 's' : ''} · {totalPoints} total points
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setUploadOpen(true)}>
            <Upload className="mr-2 h-4 w-4" /> Upload CSV
          </Button>
          <Button size="sm" onClick={() => { setEditQ(null); setShowAdd(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Add Question
          </Button>
        </div>
      </div>

      {questions.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">No questions yet. Add your first question.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {questions.map((q: any, idx: number) => (
            <Card key={q.question_id} className="group">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-relaxed">{q.question_text}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <Badge variant="outline" className="text-xs">{q.question_type}</Badge>
                      <Badge variant="outline" className="text-xs">{q.points} pt{q.points !== 1 ? 's' : ''}</Badge>
                      {q.question_type === 'Identification' && (
                        <Badge variant="outline" className="text-xs text-green-700 border-green-300">
                          {q.answers?.length ?? 0} accepted answer{q.answers?.length !== 1 ? 's' : ''}
                        </Badge>
                      )}
                      {q.question_type === 'MultipleChoice' && (
                        <Badge variant="outline" className="text-xs text-blue-700 border-blue-300">
                          {q.options?.length ?? 0} choices
                        </Badge>
                      )}
                      {q.question_type === 'Matching' && (
                        <Badge variant="outline" className="text-xs text-purple-700 border-purple-300">
                          {q.options?.length ?? 0} pairs
                        </Badge>
                      )}
                    </div>
                    {q.question_type === 'MultipleChoice' && q.options?.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {q.options.map((o: any) => (
                          <div key={o.option_id} className={cn('flex items-center gap-2 text-xs rounded px-2 py-1', o.is_correct ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300' : 'text-muted-foreground')}>
                            {o.is_correct ? <CheckCircle2 className="h-3 w-3 shrink-0" /> : <span className="h-3 w-3" />}
                            {o.option_text}
                          </div>
                        ))}
                      </div>
                    )}
                    {q.question_type === 'Identification' && q.answers?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {q.answers.map((a: any) => (
                          <span key={a.answer_id} className="rounded bg-green-50 dark:bg-green-900/20 px-2 py-0.5 text-xs text-green-800 dark:text-green-300">
                            {a.answer_text}
                          </span>
                        ))}
                      </div>
                    )}
                    {q.question_type === 'Matching' && q.options?.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {q.options.map((o: any) => (
                          <div key={o.option_id} className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">{o.option_text}</span>
                            <span>→</span>
                            <span>{o.match_text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="sm" variant="ghost" onClick={() => { setEditQ(q); setShowAdd(true); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDelete(q.question_id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showAdd && (
        <QuestionDialog
          assessmentId={assessment.assessment_id}
          editData={editQ}
          onClose={() => { setShowAdd(false); setEditQ(null); }}
          onSaved={() => { setShowAdd(false); setEditQ(null); onRefresh(); }}
        />
      )}

      {uploadOpen && (
        <UploadDialog
          assessmentId={assessment.assessment_id}
          onClose={() => setUploadOpen(false)}
          onSaved={() => { setUploadOpen(false); onRefresh(); }}
        />
      )}
    </div>
  );
}

/* ─── Question Dialog ───────────────────────────────────────────── */
function QuestionDialog({ assessmentId, editData, onClose, onSaved }: {
  assessmentId: number; editData: any; onClose: () => void; onSaved: () => void;
}) {
  const isEdit = !!editData;
  const [saving, setSaving] = useState(false);
  const [qType, setQType] = useState<string>(editData?.question_type ?? 'MultipleChoice');
  const [text, setText] = useState(editData?.question_text ?? '');
  const [points, setPoints] = useState<string>(String(editData?.points ?? '1'));
  const [caseSensitive, setCaseSensitive] = useState(editData?.case_sensitive ?? false);

  const [options, setOptions] = useState<{ option_text: string; is_correct: boolean; match_text?: string }[]>(
    editData?.options?.length ? editData.options.map((o: any) => ({ option_text: o.option_text, is_correct: !!o.is_correct, match_text: o.match_text || '' }))
      : qType === 'MultipleChoice' ? [
        { option_text: '', is_correct: true },
        { option_text: '', is_correct: false },
        { option_text: '', is_correct: false },
        { option_text: '', is_correct: false },
      ]
        : qType === 'Matching' ? [
          { option_text: '', is_correct: false, match_text: '' },
          { option_text: '', is_correct: false, match_text: '' },
        ]
          : []
  );
  const [answers, setAnswers] = useState<string[]>(
    editData?.answers?.length ? editData.answers.map((a: any) => a.answer_text) : ['', '', '']
  );

  function setCorrect(idx: number) {
    setOptions(opts => opts.map((o, i) => ({ ...o, is_correct: i === idx })));
  }

  async function handleSave() {
    if (!text.trim()) { toast.error('Question text is required.'); return; }
    const pts = parseFloat(points);
    if (isNaN(pts) || pts <= 0) { toast.error('Points must be a positive number.'); return; }

    const payload: any = { question_text: text.trim(), question_type: qType, points: pts, case_sensitive: caseSensitive };

    if (qType === 'Identification') {
      const ans = answers.filter(a => a.trim());
      if (!ans.length) { toast.error('Add at least 1 accepted answer.'); return; }
      payload.answers = ans;
    } else {
      const opts = options.filter(o => o.option_text.trim());
      if (opts.length < 2) { toast.error('Add at least 2 options.'); return; }
      if (qType === 'MultipleChoice' && !opts.some(o => o.is_correct)) {
        toast.error('Select a correct answer.'); return;
      }
      if (qType === 'Matching' && opts.some(o => !o.match_text?.trim())) {
        toast.error('Each term needs a matching answer.'); return;
      }
      payload.options = opts;
    }

    setSaving(true);
    const res = isEdit
      ? await assessmentService.updateQuestion(assessmentId, editData.question_id, payload)
      : await assessmentService.addQuestion(assessmentId, payload);
    setSaving(false);

    if (!res.success) { toast.error(res.message); return; }
    toast.success(isEdit ? 'Question updated.' : 'Question added.');
    onSaved();
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent aria-describedby={undefined} className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit' : 'Add'} Question</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Question Text</Label>
            <Textarea value={text} onChange={e => setText(e.target.value)} rows={3} placeholder="Enter question…" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label>Type</Label>
              <Select value={qType} onValueChange={v => {
                setQType(v);
                if (v === 'MultipleChoice') setOptions([
                  { option_text: '', is_correct: true }, { option_text: '', is_correct: false },
                  { option_text: '', is_correct: false }, { option_text: '', is_correct: false },
                ]);
                else if (v === 'Matching') setOptions([
                  { option_text: '', is_correct: false, match_text: '' },
                  { option_text: '', is_correct: false, match_text: '' },
                ]);
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MultipleChoice">Multiple Choice</SelectItem>
                  <SelectItem value="Identification">Identification</SelectItem>
                  <SelectItem value="Matching">Matching Type</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Points</Label>
              <Input type="number" min="0.5" step="0.5" value={points} onChange={e => setPoints(e.target.value)} />
            </div>
          </div>

          {/* Multiple Choice */}
          {qType === 'MultipleChoice' && (
            <div className="space-y-2">
              <Label>Choices <span className="text-xs text-muted-foreground">(click radio = correct)</span></Label>
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="radio" name="correct" checked={opt.is_correct}
                    onChange={() => setCorrect(i)}
                    className="h-4 w-4 accent-primary"
                  />
                  <Input
                    value={opt.option_text}
                    onChange={e => setOptions(opts => opts.map((o, j) => j === i ? { ...o, option_text: e.target.value } : o))}
                    placeholder={`Choice ${i + 1}`}
                  />
                  {options.length > 2 && (
                    <Button size="sm" variant="ghost" onClick={() => setOptions(opts => opts.filter((_, j) => j !== i))}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
              {options.length < 6 && (
                <Button size="sm" variant="outline" onClick={() => setOptions(opts => [...opts, { option_text: '', is_correct: false }])}>
                  <Plus className="mr-1 h-3 w-3" /> Add Choice
                </Button>
              )}
            </div>
          )}

          {/* Identification */}
          {qType === 'Identification' && (
            <div className="space-y-2">
              <Label>Accepted Answers <span className="text-xs text-muted-foreground">(up to 5)</span></Label>
              {answers.map((ans, i) => (
                <Input
                  key={i} value={ans}
                  onChange={e => setAnswers(a => a.map((x, j) => j === i ? e.target.value : x))}
                  placeholder={`Answer ${i + 1}${i === 0 ? ' (required)' : ' (optional)'}`}
                />
              ))}
              {answers.length < 5 && (
                <Button size="sm" variant="outline" onClick={() => setAnswers(a => [...a, ''])}>
                  <Plus className="mr-1 h-3 w-3" /> Add Answer
                </Button>
              )}
              <div className="flex items-center gap-2 pt-1">
                <Switch checked={caseSensitive} onCheckedChange={setCaseSensitive} id="case" />
                <Label htmlFor="case" className="text-xs font-normal">Case-sensitive matching</Label>
              </div>
            </div>
          )}

          {/* Matching */}
          {qType === 'Matching' && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Label>Term / Question</Label>
                <Label>Match / Answer</Label>
              </div>
              {options.map((opt, i) => (
                <div key={i} className="grid grid-cols-2 gap-2 items-center">
                  <Input
                    value={opt.option_text}
                    onChange={e => setOptions(opts => opts.map((o, j) => j === i ? { ...o, option_text: e.target.value } : o))}
                    placeholder={`Term ${i + 1}`}
                  />
                  <div className="flex gap-2">
                    <Input
                      value={opt.match_text || ''}
                      onChange={e => setOptions(opts => opts.map((o, j) => j === i ? { ...o, match_text: e.target.value } : o))}
                      placeholder={`Answer ${i + 1}`}
                    />
                    {options.length > 2 && (
                      <Button size="sm" variant="ghost" onClick={() => setOptions(opts => opts.filter((_, j) => j !== i))}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {options.length < 10 && (
                <Button size="sm" variant="outline" onClick={() => setOptions(opts => [...opts, { option_text: '', is_correct: false, match_text: '' }])}>
                  <Plus className="mr-1 h-3 w-3" /> Add Pair
                </Button>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? 'Save Changes' : 'Add Question'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Upload Dialog ─────────────────────────────────────────────── */
function UploadDialog({ assessmentId, onClose, onSaved }: {
  assessmentId: number; onClose: () => void; onSaved: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<any[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);

  async function handleParse() {
    if (!file) return;
    setParsing(true);
    const res = await assessmentService.uploadQuestions(assessmentId, file);
    setParsing(false);
    if (!res.success) { toast.error(res.message); return; }
    setParsed(res.data.questions ?? []);
    setErrors(res.data.errors ?? []);
  }

  async function handleImport() {
    if (!parsed.length) return;
    setSaving(true);
    let added = 0;
    for (const q of parsed) {
      const res = await assessmentService.addQuestion(assessmentId, q);
      if (res.success) added++;
    }
    setSaving(false);
    toast.success(`Imported ${added} question${added !== 1 ? 's' : ''}.`);
    onSaved();
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent aria-describedby={undefined} className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Questions</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            <p className="font-medium mb-1">Supported File Formats</p>
            <p className="text-xs"><strong>CSV</strong> — Structured data with type, question, points, options</p>
            <p className="text-xs"><strong>PDF, DOCX, DOC, TXT</strong> — Auto-parsed structured text</p>

            <div className="mt-3 p-2 bg-muted rounded text-left text-xs">
              <p className="font-medium mb-1">CSV Format:</p>
              <code className="text-xs block">type,question,points,col4,col5,col6,col7,col8</code>
              <p className="mt-1">Types: <code>Identification</code> · <code>MultipleChoice</code> · <code>Matching</code></p>
              <p className="mt-1">MCQ: col4-7 = choices · col8 = correct# (1-based)</p>
              <p>Identification: col4-8 = accepted answers</p>
              <p>Matching: col4+5 = pair1, col6+7 = pair2 …</p>
            </div>

            <div className="mt-3 p-2 bg-muted rounded text-left text-xs">
              <p className="font-medium mb-1">Text/PDF/DOCX Format:</p>
              <p>1. Question text here</p>
              <p>A) First option</p>
              <p>B) Second option (correct) *</p>
              <p>C) Third option</p>
              <p>Answer: Accepted Answer</p>
            </div>
          </div>
          <div className="space-y-2">
            <Input
              type="file"
              accept=".csv,.pdf,.doc,.docx,.txt"
              onChange={e => { setFile(e.target.files?.[0] ?? null); setParsed([]); setErrors([]); }}
            />
            <Button size="sm" variant="outline" onClick={handleParse} disabled={!file || parsing}>
              {parsing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Parse File
            </Button>
          </div>
          {errors.length > 0 && (
            <div className="rounded bg-destructive/10 p-3 space-y-1">
              <p className="text-xs font-medium text-destructive">Issues found:</p>
              {errors.map((e, i) => <p key={i} className="text-xs text-destructive">{e}</p>)}
            </div>
          )}
          {parsed.length > 0 && (
            <div className="rounded bg-green-50 dark:bg-green-900/20 p-3">
              <p className="text-xs font-medium text-green-700 dark:text-green-400">
                Ready to import {parsed.length} question{parsed.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          {parsed.length > 0 && (
            <Button onClick={handleImport} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Import {parsed.length} Questions
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Settings Tab ──────────────────────────────────────────────── */
function SettingsTab({ assessment, onRefresh }: { assessment: any; onRefresh: () => void }) {
  const [saving, setSaving] = useState(false);

  // Helper to format datetime for datetime-local input (YYYY-MM-DDTHH:MM)
  // Handles: MySQL "2026-04-08 14:30:00" or ISO "2026-04-08T06:30:00.000Z"
  const formatForInput = (dt: string | null) => {
    if (!dt) return '';
    try {
      const d = new Date(dt);
      if (isNaN(d.getTime())) {
        console.warn('Invalid date:', dt);
        return '';
      }

      // Convert to local timezone for display
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');

      return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch (e) {
      console.error('Date parsing error:', dt, e);
      return '';
    }
  };

  // Helper to build form state from assessment
  const buildFormState = (a: any) => ({
    title: a.title,
    description: a.description ?? '',
    assessment_type: a.assessment_type,
    timer_minutes: a.timer_minutes ?? '',
    per_question_timer: a.per_question_timer ?? '',
    shuffle_questions: !!a.shuffle_questions,
    shuffle_choices: !!a.shuffle_choices,
    max_attempts: a.max_attempts ?? 1,
    assessment_password: '',
    open_at: formatForInput(a.open_at),
    close_at: formatForInput(a.close_at),
    is_open: !!a.is_open,
    show_results: !!a.show_results,
  });

  const [form, setForm] = useState(() => buildFormState(assessment));

  // Sync form when assessment data changes (after save/refresh)
  useEffect(() => {
    console.log('Assessment updated, syncing form:', {
      open_at: assessment.open_at,
      close_at: assessment.close_at,
      timer: assessment.timer_minutes,
    });
    setForm(buildFormState(assessment));
  }, [assessment.assessment_id, assessment.updated_at, assessment.open_at, assessment.close_at, assessment.timer_minutes]);

  function set(k: string, v: any) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSave() {
    setSaving(true);
    try {
      // Format datetime for MySQL (YYYY-MM-DD HH:MM:SS)
      const formatDateTime = (dt: string) => {
        if (!dt) return null;
        const date = new Date(dt);
        return isNaN(date.getTime()) ? null : date.toISOString();
      };

      const payload = {
        ...form,
        timer_minutes: form.timer_minutes ? Number(form.timer_minutes) : null,
        per_question_timer: form.per_question_timer ? Number(form.per_question_timer) : null,
        max_attempts: Number(form.max_attempts) || 1,
        open_at: formatDateTime(form.open_at),
        close_at: formatDateTime(form.close_at),
        assessment_password: form.assessment_password || null,
      };

      console.log('Saving settings:', payload);
      const res = await assessmentService.update(assessment.assessment_id, payload);

      if (!res.success) {
        toast.error(res.message || 'Failed to save settings');
        console.error('Save error:', res);
        return;
      }

      toast.success('Settings saved successfully!');
      onRefresh();
    } catch (err) {
      console.error('Save exception:', err);
      toast.error('Error saving settings. Check console.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="max-w-xl space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Basic Info</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={form.title} onChange={e => set('title', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.assessment_type} onValueChange={v => set('assessment_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Quiz">Quiz</SelectItem>
                  <SelectItem value="Exam">Exam</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Timer & Navigation</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Global Timer (minutes)</Label>
              <Input type="number" min="1" value={form.timer_minutes} onChange={e => set('timer_minutes', e.target.value)} placeholder="No limit" />
              <div className="flex gap-1 mt-1">
                {[30, 60, 90, 120].map(mins => (
                  <button
                    key={mins}
                    onClick={() => set('timer_minutes', mins)}
                    className="text-xs px-2 py-1 bg-muted hover:bg-muted/80 rounded"
                  >
                    {mins >= 60 ? `${Math.floor(mins / 60)}hr${mins % 60 ? ' 30m' : ''}` : `${mins}m`}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Per-question Timer (seconds)</Label>
              <Input type="number" min="5" value={form.per_question_timer} onChange={e => set('per_question_timer', e.target.value)} placeholder="No limit" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Anti-Cheating & Shuffle</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {[
            { key: 'shuffle_questions', label: 'Shuffle question order per student' },
            { key: 'shuffle_choices', label: 'Shuffle MCQ choices per student' },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between">
              <Label className="font-normal">{label}</Label>
              <Switch checked={form[key as keyof typeof form] as boolean} onCheckedChange={v => set(key, v)} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Availability & Access</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Open At <span className="text-xs text-muted-foreground">(when students can start)</span></Label>
              <Input type="datetime-local" value={form.open_at} onChange={e => set('open_at', e.target.value)} className="w-full" />
            </div>
            <div className="space-y-1.5">
              <Label>Close At <span className="text-xs text-muted-foreground">(deadline)</span></Label>
              <Input type="datetime-local" value={form.close_at} onChange={e => set('close_at', e.target.value)} className="w-full" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            💡 Students can see the assessment before Open At, but cannot start until the time arrives.
          </p>
          <div className="space-y-1.5">
            <Label>Password (optional)</Label>
            <Input type="password" value={form.assessment_password} onChange={e => set('assessment_password', e.target.value)} placeholder="Leave blank for no password" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Max Attempts</Label>
              <Input type="number" min="1" value={form.max_attempts} onChange={e => set('max_attempts', e.target.value)} />
            </div>
          </div>
          {[
            { key: 'allow_retakes', label: 'Allow retakes up to max attempts' },
            { key: 'is_open', label: 'Manually open (override schedule)' },
            { key: 'show_results', label: 'Release results to students' },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between">
              <Label className="font-normal">{label}</Label>
              <Switch checked={form[key as keyof typeof form] as boolean} onCheckedChange={v => set(key, v)} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Button type="submit" disabled={saving}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save Settings
      </Button>
    </form>
  );
}

/* ─── Access Tab ─────────────────────────────────────────────────── */
function AccessTab({ assessmentId }: { assessmentId: number }) {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await assessmentService.getAccess(assessmentId);
    if (res.success) setStudents(res.data ?? []);
    setLoading(false);
  }, [assessmentId]);

  useEffect(() => { load(); }, [load]);

  async function toggle(userId: string, current: boolean) {
    setToggling(userId);
    const res = await assessmentService.updateAccess(assessmentId, { user_id: userId, is_enabled: !current });
    setToggling(null);
    if (!res.success) { toast.error(res.message); return; }
    setStudents(s => s.map(x => x.user_id === userId ? { ...x, is_enabled: !current } : x));
  }

  async function bulkToggle(enable: boolean) {
    const res = await assessmentService.updateAccess(assessmentId, { bulk: enable ? 'enable_all' : 'disable_all' });
    if (!res.success) { toast.error(res.message); return; }
    toast.success(enable ? 'All students enabled.' : 'All students disabled.');
    load();
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{students.length} enrolled student{students.length !== 1 ? 's' : ''}</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => bulkToggle(false)}>
            <Lock className="mr-2 h-3.5 w-3.5" /> Disable All
          </Button>
          <Button size="sm" variant="outline" onClick={() => bulkToggle(true)}>
            <Unlock className="mr-2 h-3.5 w-3.5" /> Enable All
          </Button>
        </div>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-center">Attempts</TableHead>
                <TableHead className="text-center">Best Score</TableHead>
                <TableHead className="text-center">Access</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No enrolled students.</TableCell></TableRow>
              ) : students.map(s => (
                <TableRow key={s.user_id}>
                  <TableCell className="font-medium">{s.last_name}, {s.first_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{s.email}</TableCell>
                  <TableCell className="text-center">{s.attempts_count ?? 0}</TableCell>
                  <TableCell className="text-center">{s.best_score != null ? `${s.best_score}` : '—'}</TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={!!s.is_enabled}
                      onCheckedChange={() => toggle(s.user_id, !!s.is_enabled)}
                      disabled={toggling === s.user_id}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Results Tab ───────────────────────────────────────────────── */
function ResultsTab({ assessmentId, assessment }: { assessmentId: number; assessment: any }) {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    assessmentService.getResults(assessmentId).then(res => {
      if (res.success) setResults(res.data ?? []);
      setLoading(false);
    });
  }, [assessmentId]);

  if (loading) return <LoadingSpinner />;

  const grouped: Record<string, any[]> = {};
  for (const r of results) {
    if (!grouped[r.user_id]) grouped[r.user_id] = [];
    grouped[r.user_id].push(r);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{Object.keys(grouped).length} student{Object.keys(grouped).length !== 1 ? 's' : ''} submitted</p>
        <Button size="sm" variant="outline" onClick={() => router.push(`/assessments/${assessmentId}/results`)}>
          <Eye className="mr-2 h-3.5 w-3.5" /> Full Results
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead className="text-center">Attempts</TableHead>
                <TableHead className="text-center">Best Score</TableHead>
                <TableHead className="text-center">Max Score</TableHead>
                <TableHead className="text-center">%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(grouped).length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No submissions yet.</TableCell></TableRow>
              ) : Object.entries(grouped).map(([uid, atts]) => {
                const best = atts.reduce((b, a) => (a.score ?? 0) > (b.score ?? 0) ? a : b, atts[0]);
                const pct = best.max_score ? Math.round((best.score / best.max_score) * 100) : 0;
                return (
                  <TableRow key={uid}>
                    <TableCell className="font-medium">{best.last_name}, {best.first_name}</TableCell>
                    <TableCell className="text-center">{atts.length}</TableCell>
                    <TableCell className="text-center font-mono">{best.score ?? 0}</TableCell>
                    <TableCell className="text-center font-mono">{best.max_score ?? 0}</TableCell>
                    <TableCell className="text-center">
                      <span className={cn('font-medium', pct >= 75 ? 'text-green-600' : pct >= 50 ? 'text-yellow-600' : 'text-red-600')}>
                        {pct}%
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
