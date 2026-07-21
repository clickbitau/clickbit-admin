'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { ExpenseForm } from '@/components/finance/ExpenseForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Wallet } from 'lucide-react';

export default function AdminNewExpensePage() {
  const { token } = useAuth();
  const router = useRouter();

  if (!token) return null;

  return (
    <PageShell
      title="New Expense"
      icon={Wallet}
      description="Record a new expense"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/finance/expenses"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      }
    >
      <Card>
        <CardHeader><CardTitle>Expense Details</CardTitle></CardHeader>
        <CardContent>
          <ExpenseForm token={token} onSuccess={(expense: any) => router.push(expense?.id ? `/admin/finance/expenses/${expense.id}` : '/admin/finance/expenses')} />
        </CardContent>
      </Card>
    </PageShell>
  );
}
