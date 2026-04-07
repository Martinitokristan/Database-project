import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Status = 'Enrolled' | 'Pending' | 'Rejected' | 'Passed' | 'Failed' | 'Incomplete' | 'Active' | 'Inactive';

const statusMap: Record<Status, { label: string; className: string }> = {
  Enrolled:   { label: 'Enrolled',   className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  Pending:    { label: 'Pending',    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  Rejected:   { label: 'Rejected',   className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
  Passed:     { label: 'Passed',     className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  Failed:     { label: 'Failed',     className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
  Incomplete: { label: 'Incomplete', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  Active:     { label: 'Active',     className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  Inactive:   { label: 'Inactive',   className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
};

export function StatusBadge({ status }: { status: string }) {
  const s = statusMap[status as Status] ?? { label: status, className: 'bg-gray-100 text-gray-700' };
  return (
    <Badge variant="outline" className={cn('text-xs font-medium border-0', s.className)}>
      {s.label}
    </Badge>
  );
}
