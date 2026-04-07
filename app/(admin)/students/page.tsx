'use client';

import { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { userService } from '@/services/userService';
import { Search, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function StudentsPage() {
  const [users, setUsers]         = useState<any[]>([]);
  const [total, setTotal]         = useState(0);
  const [search, setSearch]       = useState('');
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState<any>(null);

  const load = useCallback(async (q = '') => {
    setLoading(true);
    const res = await userService.list({ search: q, role: 'Student' });
    if (res.success) { setUsers(res.data?.users ?? []); setTotal(res.data?.total ?? 0); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value);
    clearTimeout((window as any).__searchTimer);
    (window as any).__searchTimer = setTimeout(() => load(e.target.value), 400);
  }

  return (
    <div>
      <PageHeader title="Students" description={`${total} student${total !== 1 ? 's' : ''} enrolled`} />

      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by name, ID or email…" value={search} onChange={handleSearch} className="pl-9" />
            </div>
          </div>

          {loading ? <LoadingSpinner /> : users.length === 0 ? <EmptyState /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(u => (
                  <TableRow key={u.user_id}>
                    <TableCell className="font-mono text-sm">{u.user_id}</TableCell>
                    <TableCell className="font-medium">{u.last_name}, {u.first_name} {u.middle_name ? u.middle_name[0] + '.' : ''}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{u.gender ?? '—'}</TableCell>
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

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Student Profile</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><p className="text-muted-foreground text-xs">Student ID</p><p className="font-mono font-medium">{selected.user_id}</p></div>
                <div><p className="text-muted-foreground text-xs">Email</p><p>{selected.email}</p></div>
                <div><p className="text-muted-foreground text-xs">Full Name</p><p>{selected.first_name} {selected.middle_name} {selected.last_name}</p></div>
                <div><p className="text-muted-foreground text-xs">Phone</p><p>{selected.phone ?? '—'}</p></div>
                <div><p className="text-muted-foreground text-xs">Gender</p><p>{selected.gender ?? '—'}</p></div>
                <div><p className="text-muted-foreground text-xs">Enrolled</p><p>{selected.created_at ? new Date(selected.created_at).toLocaleDateString() : '—'}</p></div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
