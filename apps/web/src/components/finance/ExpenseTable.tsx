'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { Expense } from '@/types/finance';

interface ExpenseTableProps {
  expenses: Expense[];
  loading: boolean;
}

export function ExpenseTable({ expenses, loading }: ExpenseTableProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (expenses.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        No expenses found.
      </div>
    );
  }

  const formatCurrency = (value: number | string | undefined) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(Number(value ?? 0));

  const formatDate = (value?: string) => (value ? new Date(value).toLocaleDateString() : '-');

  const statusVariant = (status?: string) => {
    switch (status) {
      case 'approved':
      case 'reimbursed':
        return 'default';
      case 'rejected':
        return 'destructive';
      case 'pending':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Number</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {expenses.map((expense) => (
            <TableRow key={expense.id}>
              <TableCell className="font-medium">{expense.expense_number || `#${expense.id}`}</TableCell>
              <TableCell>{expense.description || '-'}</TableCell>
              <TableCell className="capitalize">{expense.category || '-'}</TableCell>
              <TableCell>
                <Badge variant={statusVariant(expense.status)}>{expense.status || 'draft'}</Badge>
              </TableCell>
              <TableCell>{formatDate(expense.expense_date)}</TableCell>
              <TableCell className="text-right">{formatCurrency(expense.total_amount)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
