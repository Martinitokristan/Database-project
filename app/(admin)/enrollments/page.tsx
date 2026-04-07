'use client';

import { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { applicantService } from '@/services/applicantService';
import { enrollmentService } from '@/services/enrollmentService';
import { sectionService } from '@/services/sectionService';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export default function EnrollmentsPage() {
  const [pending, setPending]     = useState<any[]>([]);
  const [sections, setSections]   = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [verifyTarget, setVerifyTarget] = useState<any>(null);
  const [selectedSection, setSelectedSection] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<any>(null);
  const [rejecting, setRejecting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [pr, sr] = await Promise.all([
      applicantService.list({ status: 'Pending', limit: 100 }),
      sectionService.list(),
    ]);
    if (pr.success) setPending(pr.data?.applicants ?? []);
    if (sr.success) setSections(sr.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleVerify() {
    if (!verifyTarget || !selectedSection) return;
    setVerifying(true);
    const res = await enrollmentService.verify({
      applicant_id: verifyTarget.applicant_id,
      section_id:   Number(selectedSection),
    });
    setVerifying(false);
    if (!res.success) { toast.error(res.message); return; }
    toast.success(`Enrolled! Student ID: ${res.data?.user_id}`);
    setVerifyTarget(null); setSelectedSection(''); load();
  }

  async function handleReject() {
    if (!rejectTarget) return;
    setRejecting(true);
    const res = await applicantService.reject(rejectTarget.applicant_id);
    setRejecting(false);
    if (!res.success) { toast.error(res.message); return; }
    toast.success('Applicant rejected.'); setRejectTarget(null); load();
  }

  return (
    <div>
      <PageHeader title="Enrollments" description="Manage pending applicants and enrollments." />

      <Tabs defaultValue="pending">
        <TabsList className="mb-4">
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="enrolled">All Applicants</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <Card>
            <CardContent className="pt-4">
              {loading ? <LoadingSpinner /> : pending.length === 0 ? (
                <EmptyState title="No pending applications" description="All applicants have been processed." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead>Applied</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pending.map(a => (
                      <TableRow key={a.applicant_id}>
                        <TableCell className="font-medium">{a.last_name}, {a.first_name}</TableCell>
                        <TableCell>{a.email}</TableCell>
                        <TableCell>{a.course_name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{a.applied_at ? new Date(a.applied_at).toLocaleDateString() : '—'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" onClick={() => { setVerifyTarget(a); setSelectedSection(''); }}>
                              <CheckCircle2 className="mr-1 h-4 w-4" />Enroll
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => setRejectTarget(a)}>
                              <XCircle className="mr-1 h-4 w-4" />Reject
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

        <TabsContent value="enrolled">
          <AllApplicants />
        </TabsContent>
      </Tabs>

      <Dialog open={!!verifyTarget} onOpenChange={o => !o && setVerifyTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Enroll Applicant</DialogTitle></DialogHeader>
          {verifyTarget && (
            <div className="space-y-4">
              <div className="rounded-md bg-muted p-3 text-sm">
                <p className="font-medium">{verifyTarget.first_name} {verifyTarget.last_name}</p>
                <p className="text-muted-foreground">{verifyTarget.email} · {verifyTarget.course_name}</p>
              </div>
              <div className="space-y-1.5">
                <Label>Assign to Section</Label>
                <Select value={selectedSection} onValueChange={setSelectedSection}>
                  <SelectTrigger><SelectValue placeholder="Select section" /></SelectTrigger>
                  <SelectContent>
                    {sections.map((s: any) => (
                      <SelectItem key={s.section_id} value={String(s.section_id)}>
                        {s.section_name} · {s.subject_code} · {s.enrolled_count}/{s.capacity}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyTarget(null)}>Cancel</Button>
            <Button onClick={handleVerify} disabled={verifying || !selectedSection}>
              {verifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirm Enrollment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!rejectTarget} onOpenChange={o => !o && setRejectTarget(null)}
        title="Reject Applicant?"
        description={`Reject ${rejectTarget?.first_name} ${rejectTarget?.last_name}'s application? This cannot be undone.`}
        onConfirm={handleReject} loading={rejecting} confirmLabel="Reject"
      />
    </div>
  );
}

function AllApplicants() {
  const [applicants, setApplicants] = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    applicantService.list({ limit: 100 }).then(r => {
      if (r.success) setApplicants(r.data?.applicants ?? []);
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <Card>
      <CardContent className="pt-4">
        {applicants.length === 0 ? <EmptyState /> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Applied</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applicants.map(a => (
                <TableRow key={a.applicant_id}>
                  <TableCell className="font-medium">{a.last_name}, {a.first_name}</TableCell>
                  <TableCell>{a.email}</TableCell>
                  <TableCell>{a.course_name}</TableCell>
                  <TableCell><StatusBadge status={a.status} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.applied_at ? new Date(a.applied_at).toLocaleDateString() : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
