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
import { Applicant, Section } from '@/types';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, Loader2, Search, Download, Eye } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { reports } from '@/lib/reports';
import { Badge } from '@/components/ui/badge';

export default function EnrollmentsPage() {
  const [pending, setPending]     = useState<Applicant[]>([]);
  const [sections, setSections]   = useState<Section[]>([]);
  const [loading, setLoading]     = useState(true);
  const [verifyTarget, setVerifyTarget] = useState<Applicant | null>(null);
  const [selectedSection, setSelectedSection] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<Applicant | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [search, setSearch]       = useState('');

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
  
  const filteredPending = pending.filter(a => 
    `${a.first_name} ${a.last_name} ${a.email} ${a.course_name}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <PageHeader title="Enrollments" description="Manage pending enrollees and enrollments." />

      <Tabs defaultValue="pending">
        <TabsList className="mb-4">
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="enrolled">All Enrollees</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <Card>
            <CardContent className="pt-6">
              <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search pending enrollees..." 
                  className="pl-10" 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              
              {loading ? <LoadingSpinner /> : filteredPending.length === 0 ? (
                <EmptyState title="No enrollees found" description={search ? "Adjust your search terms and try again." : "All enrollees have been processed."} />
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
                    {filteredPending.map(a => (
                      <TableRow key={a.applicant_id}>
                        <TableCell className="font-medium">{a.last_name}, {a.first_name}</TableCell>
                        <TableCell>{a.email}</TableCell>
                        <TableCell>{a.course_name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{a.applied_at ? new Date(a.applied_at).toLocaleDateString() : '—'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="icon" variant="ghost" onClick={() => { setVerifyTarget(a); setSelectedSection(''); }}>
                              <Eye className="h-4 w-4" />
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
          <AllEnrollees searchProp={search} onSearchChange={setSearch} />
        </TabsContent>
      </Tabs>

      <Dialog open={!!verifyTarget} onOpenChange={o => !o && setVerifyTarget(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Review Application</DialogTitle></DialogHeader>
          {verifyTarget && (() => {
            let address: any = verifyTarget.address || {};
            let isStringAddress = false;
            if (typeof verifyTarget.address === 'string') {
              try {
                address = JSON.parse(verifyTarget.address);
              } catch (e) {
                address = verifyTarget.address;
                isStringAddress = true;
              }
            }
            
            return (
            <div className="space-y-6 py-2">
              <fieldset className="space-y-4">
                <legend className="text-sm font-semibold text-primary uppercase tracking-wider border-b pb-2 w-full">Personal Information</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground block mb-1">Full Name</span>
                    <span className="font-medium">{verifyTarget.last_name}, {verifyTarget.first_name} {verifyTarget.middle_name} {verifyTarget.suffix}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block mb-1">Gender</span>
                    <span className="font-medium">{verifyTarget.gender}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block mb-1">Date of Birth</span>
                    <span className="font-medium">{verifyTarget.date_of_birth ? new Date(verifyTarget.date_of_birth).toLocaleDateString() : '—'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block mb-1">Phone</span>
                    <span className="font-medium">{verifyTarget.phone}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block mb-1">Email</span>
                    <span className="font-medium">{verifyTarget.email}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block mb-1">Course</span>
                    <span className="font-medium">{verifyTarget.course_name}</span>
                  </div>
                </div>
              </fieldset>

              <fieldset className="space-y-4">
                <legend className="text-sm font-semibold text-primary uppercase tracking-wider border-b pb-2 w-full">Address Details</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  {isStringAddress ? (
                    <div className="bg-muted/30 p-3 rounded-md border col-span-1 sm:col-span-2">
                      <div className="font-medium mb-1 flex items-center gap-2">Home / Current Address</div>
                      <div className="text-muted-foreground">{address}</div>
                    </div>
                  ) : (
                    <>
                      <div className="bg-muted/30 p-3 rounded-md border">
                        <div className="font-medium mb-1 flex items-center gap-2">Current Address</div>
                        <div className="text-muted-foreground">
                          {address?.current?.streetBarangay}, {address?.current?.city}<br/>
                          {address?.current?.province}, {address?.current?.postalCode}
                        </div>
                      </div>
                      {address?.home && address.home.province && (
                      <div className="bg-muted/30 p-3 rounded-md border">
                        <div className="font-medium mb-1 flex items-center gap-2">Home Address</div>
                        <div className="text-muted-foreground">
                          {address.home.streetBarangay}, {address.home.city}<br/>
                          {address.home.province}, {address.home.postalCode}
                        </div>
                      </div>
                      )}
                    </>
                  )}
                </div>
              </fieldset>

              <fieldset className="space-y-4">
                <legend className="text-sm font-semibold text-primary uppercase tracking-wider border-b pb-2 w-full">Enrollment Action</legend>
                <div className="space-y-1.5">
                  <Label>Assign to Section <span className="text-destructive">*</span></Label>
                  <Select value={selectedSection} onValueChange={setSelectedSection}>
                    <SelectTrigger><SelectValue placeholder="Select section to enroll" /></SelectTrigger>
                    <SelectContent>
                      {sections
                        .filter((s: any) => s.course_id === verifyTarget.course_id)
                        .map((s: any) => (
                          <SelectItem key={s.section_id} value={String(s.section_id)}>
                            {s.section_name} · {s.enrolled_count}/{s.capacity}
                          </SelectItem>
                        ))}
                      {sections.filter((s: any) => s.course_id === verifyTarget.course_id).length === 0 && (
                        <div className="p-2 text-sm text-muted-foreground text-center">No sections found for this course.</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </fieldset>
            </div>
            );
          })()}
          <DialogFooter className="gap-2 sm:gap-0 mt-4 border-t pt-4">
            <Button variant="outline" onClick={() => setVerifyTarget(null)}>Cancel</Button>
            <div className="flex gap-2">
              <Button variant="destructive" onClick={() => { const t = verifyTarget; setVerifyTarget(null); setRejectTarget(t); }}>
                <XCircle className="mr-1 h-4 w-4" /> Reject Application
              </Button>
              <Button onClick={handleVerify} disabled={verifying || !selectedSection}>
                {verifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <CheckCircle2 className="mr-1 h-4 w-4" /> Accept & Enroll
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!rejectTarget} onOpenChange={o => !o && setRejectTarget(null)}
        title="Reject Enrollee?"
        description={`Reject ${rejectTarget?.first_name} ${rejectTarget?.last_name}'s enrollment? This cannot be undone.`}
        onConfirm={handleReject} loading={rejecting} confirmLabel="Reject"
      />
    </div>
  );
}

function AllEnrollees({ searchProp, onSearchChange }: { searchProp: string, onSearchChange: (v: string) => void }) {
  const [applicants, setApplicants] = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    applicantService.list({ limit: 500 }).then(r => {
      if (r.success) setApplicants(r.data?.applicants ?? []);
      setLoading(false);
    });
  }, []);

  const filtered = applicants.filter(a => 
    `${a.first_name} ${a.last_name} ${a.email} ${a.course_name}`.toLowerCase().includes(searchProp.toLowerCase())
  );

  if (loading) return <LoadingSpinner />;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search all enrollees..." 
            className="pl-10" 
            value={searchProp}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        {filtered.length === 0 ? <EmptyState title="No results found" description="No matching enrollees in the system." /> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Applied</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(a => (
                <TableRow key={a.applicant_id} className="group">
                  <TableCell className="font-bold">{a.last_name}, {a.first_name}</TableCell>
                  <TableCell className="text-muted-foreground">{a.email}</TableCell>
                  <TableCell><Badge variant="secondary" className="font-normal">{a.course_name}</Badge></TableCell>
                  <TableCell><StatusBadge status={a.status} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground p-0">
                    {a.applied_at ? new Date(a.applied_at).toLocaleDateString() : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    {a.status === 'Enrolled' && (
                      <Button variant="ghost" size="sm" onClick={() => reports.exportEnrollmentSlip({ student: a, section: a })} className="h-8 gap-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                        <Download className="h-3.5 w-3.5" /> Slip
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
