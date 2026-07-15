'use client';

interface EmptyStateProps {
  text?: string;
}

export function EmptyState({ text = 'No records found.' }: EmptyStateProps) {
  return (
    <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
