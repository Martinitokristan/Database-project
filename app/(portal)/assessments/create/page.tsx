'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { assessmentService } from '@/services/assessmentService';
import { sectionService } from '@/services/sectionService';
import { toast } from 'sonner';
import { Loader2, ArrowLeft } from 'lucide-react';

export default function CreateAssessmentPage() {
  const { role, isLoading } = useAuth();
  if (isLoading) return <LoadingSpinner />;
  if (role === 'student') return null;
  return <CreateForm />;
}

function CreateForm() {
  const router = useRouter();
  const [offerings, setOfferings] = useState<any[]>([]);
  const [saving,    setSaving]   = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    assessment_type: 'Quiz',
    offering_id: '',
  });

  useEffect(() => {
    import('@/services/subjectOfferingService').then(({ subjectOfferingService }) => {
      subjectOfferingService.list().then(r => { if (r.success) setOfferings(r.data ?? []); });
    });
  }, []);

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim())    { toast.error('Title is required.'); return; }
    if (!form.offering_id)     { toast.error('Please select a subject offering.'); return; }
    if (!form.assessment_type) { toast.error('Please select a type.'); return; }
    setSaving(true);
    const res = await assessmentService.create({
      title:           form.title.trim(),
      description:     form.description || null,
      assessment_type: form.assessment_type,
      offering_id:     Number(form.offering_id),
    });
    setSaving(false);
    if (!res.success) { toast.error(res.message || 'Failed to create assessment.'); return; }
    toast.success('Assessment created! Now add questions.');
    router.push(`/assessments/${res.data.assessment_id}`);
  }

  return (
    <div>
      <PageHeader
        title="New Assessment"
        action={
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
        }
      />
      <div className="max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Basic Information</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Title <span className="text-destructive">*</span></Label>
                <Input
                  value={form.title}
                  onChange={e => set('title', e.target.value)}
                  placeholder="e.g. Midterm Exam — CS101"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={e => set('description', e.target.value)}
                  placeholder="Optional instructions for students…"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Type <span className="text-destructive">*</span></Label>
                  <Select value={form.assessment_type} onValueChange={v => set('assessment_type', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent position="popper" className="z-50">
                      <SelectItem value="Quiz">Quiz — Low-stakes</SelectItem>
                      <SelectItem value="Exam">Exam — Formal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Subject & Section <span className="text-destructive">*</span></Label>
                  <Select value={form.offering_id} onValueChange={v => set('offering_id', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent position="popper" className="z-50 max-h-60">
                      {offerings.length === 0 ? (
                        <div className="px-2 py-3 text-sm text-muted-foreground">No classes available</div>
                      ) : (
                        offerings.map(o => (
                          <SelectItem key={o.offering_id} value={String(o.offering_id)}>
                            {o.section_name} — {o.subject_code}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create & Add Questions
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
