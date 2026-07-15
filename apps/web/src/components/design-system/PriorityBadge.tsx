'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface PriorityBadgeProps {
  priority?: string;
  className?: string;
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  if (!priority) return <Badge variant="secondary">-</Badge>;

  const normalized = priority.toLowerCase();

  const styles: Record<string, string> = {
    low: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    urgent: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  };

  const style = styles[normalized] ?? 'bg-secondary text-secondary-foreground';

  return (
    <Badge variant="outline" className={cn(style, className)}>
      {priority}
    </Badge>
  );
}
