'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  variant?: 'default' | 'load-more';
  hasMore?: boolean;
  isLoading?: boolean;
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  onPageChange,
  variant = 'default',
  hasMore = currentPage < totalPages,
  isLoading,
  className,
}: PaginationProps) {
  if (totalPages <= 1 && !hasMore) return null;

  if (variant === 'load-more') {
    if (!hasMore) return null;
    return (
      <div className={cn('flex justify-center', className)}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={isLoading}
          className="nm-raised"
        >
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Load more
        </Button>
      </div>
    );
  }

  const pages: (number | string)[] = [];
  const maxVisible = 5;
  const start = Math.max(1, Math.min(currentPage - Math.floor(maxVisible / 2), totalPages - maxVisible + 1));
  const end = Math.min(totalPages, start + maxVisible - 1);

  if (start > 1) pages.push(1, '...');
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < totalPages) pages.push('...', totalPages);

  return (
    <div className={cn('flex flex-col sm:flex-row items-center justify-between gap-3', className)}>
      <p className="text-sm text-muted-foreground">
        {totalItems} total
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 nm-raised"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} className="px-2 text-sm text-muted-foreground">...</span>
          ) : (
            <Button
              key={p}
              variant={currentPage === p ? 'default' : 'outline'}
              size="sm"
              className={cn('h-8 min-w-[2rem] px-2', currentPage === p ? '' : 'nm-raised')}
              onClick={() => onPageChange(Number(p))}
            >
              {p}
            </Button>
          )
        )}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 nm-raised"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
