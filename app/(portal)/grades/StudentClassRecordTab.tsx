'use client';

import { useState, useEffect } from 'react';
import { classRecordService } from '@/services/classRecordService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { Calendar } from 'lucide-react';

export function StudentClassRecordTab() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    classRecordService.myRecords().then(res => {
      if (res.success) setRecords(res.data ?? []);
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingSpinner />;

  if (records.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <EmptyState title="No Class Records" description="Your instructors haven't posted any activities, quizzes, or exams yet." />
        </CardContent>
      </Card>
    );
  }

  // Group by Subject and Section
  const grouped = records.reduce((acc: Record<string, any[]>, r) => {
    const key = `${r.subject_code} — ${r.subject_title} (${r.section_name})`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([subject, items]) => (
        <Card key={subject} className="overflow-hidden">
          <CardHeader className="bg-muted/30 border-b py-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold">{subject}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Instructor: {items[0].instructor_first} {items[0].instructor_last}</p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/10">
                  <TableHead className="font-black uppercase text-[10px]">Type</TableHead>
                  <TableHead className="font-black uppercase text-[10px]">Title</TableHead>
                  <TableHead className="font-black uppercase text-[10px]">Date</TableHead>
                  <TableHead className="text-center font-black uppercase text-[10px]">Score</TableHead>
                  <TableHead className="text-center font-black uppercase text-[10px]">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(items as any[]).map(item => {
                  const hasScore = item.score != null;
                  const score = hasScore ? Number(item.score) : null;
                  const percentage = hasScore ? (score! / item.max_score) * 100 : null;

                  return (
                    <TableRow key={item.item_id}>
                      <TableCell><Badge variant="outline">{item.record_type}</Badge></TableCell>
                      <TableCell className="font-medium">{item.title}</TableCell>
                      <TableCell className="text-sm">{new Date(item.record_date).toLocaleDateString()}</TableCell>
                      <TableCell className="text-center font-mono">
                         {hasScore ? (
                           <span className="font-bold">{score} / {item.max_score}</span>
                         ) : (
                           <span className="text-muted-foreground">— / {item.max_score}</span>
                         )}
                      </TableCell>
                      <TableCell className="text-center">
                        {percentage != null ? (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${percentage >= 75 ? 'bg-emerald-100 text-emerald-700' : percentage >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                            {Math.round(percentage)}%
                          </span>
                        ) : (
                           <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
