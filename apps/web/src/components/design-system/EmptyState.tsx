'use client';

import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  text?: string;
}

export function EmptyState({ text = 'No records found.' }: EmptyStateProps) {
  return (
    <div className="nm-raised p-8 text-center">
      <div className="mx-auto mb-3 w-12 h-12 rounded-full nm-inset-sm flex items-center justify-center">
        <Inbox className="w-5 h-5 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
