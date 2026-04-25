import { InboxIcon } from 'lucide-react';

interface EmptyStateProps {
  title?:       string;
  description?: string;
}

export function EmptyState({ title = 'No data found', description = 'Nothing to display here yet.' }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
      <InboxIcon className="mb-3 h-10 w-10 opacity-40" />
      <p className="font-medium text-sm">{title}</p>
      <p className="text-xs mt-1">{description}</p>
    </div>
  );
}
