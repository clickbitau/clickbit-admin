'use client';

import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  text?: string;
  title?: string;
  description?: string;
  icon?: LucideIcon;
  className?: string;
}

export function EmptyState({
  text = 'No records found.',
  title,
  description,
  icon: Icon,
  className,
}: EmptyStateProps) {
  const displayTitle = title || text;
  const IconComponent = Icon || Inbox;

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center p-6 nm-surface rounded-2xl',
        className,
      )}
    >
      <div className="mx-auto mb-3 w-12 h-12 rounded-full nm-inset-sm flex items-center justify-center">
        <IconComponent className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground">{displayTitle}</p>
      {description && <p className="text-xs text-muted-foreground mt-1 max-w-xs">{description}</p>}
    </div>
  );
}
