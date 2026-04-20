'use client';

import { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { StudentDetailsModal } from '@/components/shared/StudentDetailsModal';
import { userService } from '@/services/userService';
import { toast } from 'sonner';
import { Search, Eye } from 'lucide-react';

const YEAR_LEVELS = ['1st Year', '2nd Year', '3rd Year', '4th Year', 'Masteral', 'Doctorate', 'Irregular'] as const;

export default function StudentsPage() {
  const [users, setUsers]           = useState<any[]>([]);
  const [total, setTotal]           = useState(0);
  const [search, setSearch]         = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState<any>(null);
  const [saving, setSaving]         = useState(false);
  const [sections, setSections]     = useState<any[]>([]);
  const [disableTarget, setDisableTarget] = useState<any>(null);
  const [disabling, setDisabling]   = useState(false);

  const load = useCallback(async (q = '', yl = '') => {
    setLoading(true);
    const [usersRes, sectionsRes] = await Promise.all([
      userService.list({ search: q, role: 'Student', year_level: yl || undefined }),
      fetch('/api/sections?limit=250').then(r => r.json()).catch(() => ({ data: [] })),
    ]);
    if (usersRes.success) {
      setUsers(usersRes.data?.users ?? []);
      setTotal(usersRes.data?.total ?? 0);
    }
    if (sectionsRes.data) setSections(sectionsRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value);
    clearTimeout((window as any).__st);
    (window as any).__st = setTimeout(() => load(e.target.value, yearFilter), 400);
  }

  function handleYearFilter(val: string) {
    const v = val === 'all' ? '' : val;
    setYearFilter(v);
    load(search, v);
  }

  async function onSave(data: any) {
    if (!selected) return;
    setSaving(true);
    const res = await userService.update(selected.user_id, data);
    setSaving(false);
    if (!res.success) { toast.error(res.message); return; }
    toast.success('Profile updated.');
    setSelected({ ...selected, ...data });
    load(search, yearFilter);
  }

  async function handleToggleActive() {
    if (!disableTarget) return;
    setDisabling(true);
    const res = await userService.toggleActive(disableTarget.user_id);
    setDisabling(false);
    if (!res.success) { toast.error(res.message); return; }
    toast.success(res.data?.is_active ? 'Account enabled.' : 'Account disabled.');
    setSelected({ ...selected, is_active: res.data?.is_active });
    setDisableTarget(null);
    load(search, yearFilter);
  }

  const isActive = selected?.is_active !== false;

  return (
    <div>
      <PageHeader title="Students" description={`${total} student${total !== 1 ? 's' : ''} enrolled`} />

      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by name, ID or email…" value={search} onChange={handleSearch} className="pl-9" />
            </div>
            <Select onValueChange={handleYearFilter} defaultValue="all">
              <SelectTrigger className="w-44">
                <SelectValue placeholder="All Year Levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Year Levels</SelectItem>
                {YEAR_LEVELS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {loading ? <LoadingSpinner /> : users.length === 0 ? <EmptyState /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Year Level</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(u => (
                  <TableRow key={u.user_id}>
                    <TableCell className="font-mono text-sm">{u.user_id}</TableCell>
                    <TableCell className="font-medium">
                      {u.last_name}, {u.first_name}{u.middle_name ? ` ${u.middle_name[0]}.` : ''}
                    </TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      {u.year_level ? <Badge variant="outline">{u.year_level}</Badge> : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.is_active !== false ? 'default' : 'secondary'}>
                        {u.is_active !== false ? 'Active' : 'Disabled'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => setSelected(u)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <StudentDetailsModal
        student={selected}
        sections={sections}
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        onEdit={onSave}
        onToggleActive={setDisableTarget}
        isToggling={disabling}
        isSaving={saving}
      />

      <ConfirmDialog
        open={!!disableTarget}
        onOpenChange={o => !o && setDisableTarget(null)}
        title={isActive ? 'Disable Account?' : 'Enable Account?'}
        description={isActive
          ? `${disableTarget?.first_name} ${disableTarget?.last_name} will no longer be able to log in.`
          : `Re-enable access for ${disableTarget?.first_name} ${disableTarget?.last_name}.`}
        onConfirm={handleToggleActive}
        loading={disabling}
        confirmLabel={isActive ? 'Disable' : 'Enable'}
      />
    </div>
  );
}
