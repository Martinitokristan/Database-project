'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Users, GraduationCap, Layers, ClipboardList, Calendar } from 'lucide-react';

export default function DashboardPage() {
  const [stats, setStats]         = useState<any>(null);
  const [applicants, setApplicants] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [statsRes, appsRes] = await Promise.all([
          fetch('/api/dashboard/stats', { credentials: 'include' }).then(r => r.json()).catch(() => null),
          fetch('/api/applicants?status=Pending&limit=5', { credentials: 'include' }).then(r => r.json()),
        ]);
        if (appsRes.success) setApplicants(appsRes.data?.applicants ?? []);
        if (statsRes?.success) setStats(statsRes.data);
        else {
          const [usersRes, sectionsRes, semRes] = await Promise.all([
            fetch('/api/users?limit=1', { credentials: 'include' }).then(r => r.json()),
            fetch('/api/sections', { credentials: 'include' }).then(r => r.json()),
            fetch('/api/semesters', { credentials: 'include' }).then(r => r.json()),
          ]);
          setStats({
            students:  usersRes.data?.total ?? 0,
            sections:  (sectionsRes.data ?? []).length,
            pending:   appsRes.data?.total ?? 0,
            semester:  (semRes.data ?? []).find((s: any) => s.status === 'Active'),
          });
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <LoadingSpinner />;

  const statCards = [
    { label: 'Total Students',   value: stats?.students  ?? '—', icon: Users,          color: 'text-blue-600' },
    { label: 'Active Sections',  value: stats?.sections  ?? '—', icon: Layers,         color: 'text-purple-600' },
    { label: 'Pending Enrollees', value: stats?.pending ?? '—', icon: ClipboardList,  color: 'text-yellow-600' },
    { label: 'Active Semester',  value: stats?.semester?.term ?? 'None', icon: Calendar, color: 'text-green-600' },
  ];

  return (
    <div>
      <PageHeader title="Dashboard" description="Welcome to AcadTrack administration." />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">{label}</p>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Pending Enrollees</CardTitle>
        </CardHeader>
        <CardContent>
          {applicants.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No pending enrollees.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applicants.map((a: any) => (
                  <TableRow key={a.applicant_id}>
                    <TableCell className="font-medium">{a.last_name}, {a.first_name}</TableCell>
                    <TableCell>{a.email}</TableCell>
                    <TableCell>{a.course_name}</TableCell>
                    <TableCell><StatusBadge status={a.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
