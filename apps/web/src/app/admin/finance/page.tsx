'use client';

import { useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { ArrowRight, CreditCard, DollarSign, FileText, Plus, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import Link from 'next/link';
import { PageShell } from '@/components/design-system/PageShell';
import { StatCards } from '@/components/design-system/StatCards';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/components/auth/AuthProvider';
import { fetchInvoiceStats, fetchPaymentStats, fetchExpenseStats, fetchInvoices, fetchPayments, fetchExpenses } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import type { Invoice, Payment, Expense, InvoiceStats, PaymentStats, ExpenseStats } from '@/types/finance';

function currentMonthRange() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: first.toISOString().split('T')[0], to: last.toISOString().split('T')[0] };
}

const invoiceStatusColors: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  viewed: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  partial: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  overdue: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  cancelled: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  expired: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

const expenseStatusColors: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  paid: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  reimbursed: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
};

export default function AdminFinanceDashboardPage() {
  const { token } = useAuth();
  const [period] = useState(currentMonthRange());

  const [
    invoiceStats,
    paymentStats,
    expenseStats,
    invoices,
    payments,
    expenses,
  ] = useQueries({
    queries: [
      { queryKey: ['invoice-stats', token], queryFn: async () => { if (!token) throw new Error('No token'); return fetchInvoiceStats(token); }, enabled: !!token },
      { queryKey: ['payment-stats', token, period], queryFn: async () => { if (!token) throw new Error('No token'); return fetchPaymentStats(token, { dateFrom: period.from, dateTo: period.to }); }, enabled: !!token },
      { queryKey: ['expense-stats', token, period], queryFn: async () => { if (!token) throw new Error('No token'); return fetchExpenseStats(token, { start_date: period.from, end_date: period.to }); }, enabled: !!token },
      { queryKey: ['recent-invoices', token], queryFn: async () => { if (!token) throw new Error('No token'); return fetchInvoices(token, { page: 1, limit: 5, sort_order: 'DESC', sort_by: 'created_at' }); }, enabled: !!token },
      { queryKey: ['recent-payments', token], queryFn: async () => { if (!token) throw new Error('No token'); return fetchPayments(token, { page: 1, limit: 5 }); }, enabled: !!token },
      { queryKey: ['recent-expenses', token], queryFn: async () => { if (!token) throw new Error('No token'); return fetchExpenses(token, { page: 1, limit: 5, sortBy: 'expense_date', sortOrder: 'DESC' }); }, enabled: !!token },
    ],
  });

  const stats = invoiceStats.data?.data;
  const pstats = paymentStats.data?.data;
  const estats = expenseStats.data?.data;
  const invoiceList = (invoices.data?.invoices ?? invoices.data?.data ?? []) as Invoice[];
  const paymentList = (payments.data?.payments ?? []) as Payment[];
  const expenseList = (expenses.data?.data ?? []) as Expense[];

  const outstandingAmount = useMemo(() => {
    if (!stats) return 0;
    return (stats.sent + stats.viewed + stats.partial + stats.overdue);
  }, [stats]);

  const paidAmount = pstats?.completedTotal ?? 0;
  const expenseAmount = estats?.total_amount ?? 0;
  const profit = Number(paidAmount) - Number(expenseAmount);

  const isLoading = invoiceStats.isLoading || paymentStats.isLoading || expenseStats.isLoading;

  const statCards = [
    { label: 'Outstanding Invoices', value: isLoading ? '...' : outstandingAmount, sub: formatCurrency(stats?.outstandingAmount || 0), icon: FileText, accent: 'warning' as const },
    { label: 'Payments Received', value: isLoading ? '...' : formatCurrency(Number(paidAmount)), sub: `${pstats?.completedCount || 0} completed`, icon: CreditCard, accent: 'success' as const },
    { label: 'Expenses', value: isLoading ? '...' : formatCurrency(Number(expenseAmount)), sub: `${estats?.total_count || 0} total`, icon: TrendingDown, accent: 'destructive' as const },
    { label: 'Net Profit', value: isLoading ? '...' : formatCurrency(profit), icon: profit >= 0 ? TrendingUp : TrendingDown, accent: profit >= 0 ? ('success' as const) : ('destructive' as const) },
  ];

  return (
    <PageShell
      title="Finance Dashboard"
      icon={DollarSign}
      description="Invoices, payments, expenses and cash-flow overview."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm"><Link href="/admin/finance/invoices">Invoices</Link></Button>
          <Button asChild variant="outline" size="sm"><Link href="/admin/finance/payments">Payments</Link></Button>
          <Button asChild variant="outline" size="sm"><Link href="/admin/finance/expenses">Expenses</Link></Button>
          <Button asChild size="sm"><Link href="/admin/finance/invoices/new"><Plus className="mr-1 h-4 w-4" /> New Invoice</Link></Button>
        </div>
      }
    >
      {invoiceStats.error || paymentStats.error || expenseStats.error ? (
        <div className="text-destructive">Failed to load finance dashboard.</div>
      ) : (
        <>
          <StatCards cards={statCards} />

          <div className="grid gap-6 lg:grid-cols-3">
            <DashboardCard
              title="Invoice Status"
              icon={FileText}
              link="/admin/finance/invoices"
              isLoading={invoiceStats.isLoading}
            >
              {stats && (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <StatusItem label="Total" value={stats.total} />
                  <StatusItem label="Draft" value={stats.draft} />
                  <StatusItem label="Sent" value={stats.sent} />
                  <StatusItem label="Viewed" value={stats.viewed} />
                  <StatusItem label="Paid" value={stats.paid} accent="success" />
                  <StatusItem label="Overdue" value={stats.overdue} accent="destructive" />
                </div>
              )}
            </DashboardCard>

            <DashboardCard
              title="Payments"
              icon={CreditCard}
              link="/admin/finance/payments"
              isLoading={paymentStats.isLoading}
            >
              {pstats && (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Completed</span><span>{pstats.completedCount} · {formatCurrency(Number(pstats.completedTotal))}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Pending</span><span>{pstats.pendingCount}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Failed</span><span>{pstats.failedCount}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Refunded</span><span>{pstats.refundedCount} · {formatCurrency(Number(pstats.refundedTotal))}</span></div>
                </div>
              )}
            </DashboardCard>

            <DashboardCard
              title="Expense Summary"
              icon={Wallet}
              link="/admin/finance/expenses"
              isLoading={expenseStats.isLoading}
            >
              {estats && (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span>{estats.total_count} · {formatCurrency(estats.total_amount)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Pending approval</span><span>{estats.pending_approval}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Pending reimbursement</span><span>{estats.pending_reimbursement}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Billable unbilled</span><span>{estats.billable_unbilled}</span></div>
                </div>
              )}
            </DashboardCard>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <RecentCard title="Recent Invoices" link="/admin/finance/invoices" isLoading={invoices.isLoading}>
              {invoiceList.map((i) => (
                <Link key={i.id} href={`/admin/finance/invoices/${i.id}`} className="nm-raised-sm p-3 flex items-center justify-between hover:bg-primary/5 text-sm transition-colors">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{i.invoice_number || i.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{i.client_name || i.client_email}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-medium">{formatCurrency(i.total_amount ?? i.total)}</p>
                    <Badge variant="outline" className={`text-[10px] ${invoiceStatusColors[i.status || 'draft'] || ''}`}>{i.status || 'draft'}</Badge>
                  </div>
                </Link>
              ))}
            </RecentCard>

            <RecentCard title="Recent Payments" link="/admin/finance/payments" isLoading={payments.isLoading}>
              {paymentList.map((p) => (
                <Link key={p.id} href={`/admin/finance/payments/${p.transaction_id || p.id}`} className="nm-raised-sm p-3 flex items-center justify-between hover:bg-primary/5 text-sm transition-colors">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{p.transaction_id || `Payment ${p.id}`}</p>
                    <p className="text-xs text-muted-foreground truncate">{p.payment_method || p.status}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-medium">{formatCurrency(p.amount)}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(p.payment_date)}</p>
                  </div>
                </Link>
              ))}
            </RecentCard>

            <RecentCard title="Recent Expenses" link="/admin/finance/expenses" isLoading={expenses.isLoading}>
              {expenseList.map((e) => (
                <Link key={e.id} href={`/admin/finance/expenses/${e.id}`} className="nm-raised-sm p-3 flex items-center justify-between hover:bg-primary/5 text-sm transition-colors">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{e.expense_number || e.category || `Expense ${e.id}`}</p>
                    <p className="text-xs text-muted-foreground truncate">{e.description || e.status}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-medium">{formatCurrency(e.total_amount ?? e.amount)}</p>
                    <Badge variant="outline" className={`text-[10px] ${expenseStatusColors[e.status || 'draft'] || ''}`}>{e.status || 'draft'}</Badge>
                  </div>
                </Link>
              ))}
            </RecentCard>
          </div>
        </>
      )}
    </PageShell>
  );
}

function DashboardCard({ title, icon: Icon, link, isLoading, children }: { title: string; icon: any; link: string; isLoading?: boolean; children: React.ReactNode }) {
  return (
    <div className="nm-raised p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-medium flex items-center gap-2"><Icon className="h-4 w-4" /> {title}</h3>
        <Link href={link} className="text-xs text-primary hover:underline flex items-center">View <ArrowRight className="ml-1 h-3 w-3" /></Link>
      </div>
      {isLoading ? <Skeleton className="h-20 w-full" /> : children}
    </div>
  );
}

function StatusItem({ label, value, accent }: { label: string; value: number; accent?: 'success' | 'destructive' | 'warning' }) {
  const color = accent === 'success' ? 'text-green-600' : accent === 'destructive' ? 'text-destructive' : accent === 'warning' ? 'text-yellow-600' : '';
  return (
    <div className="flex justify-between border-b pb-1 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold ${color}`}>{value}</span>
    </div>
  );
}

function RecentCard({ title, link, isLoading, children }: { title: string; link: string; isLoading?: boolean; children: React.ReactNode }) {
  return (
    <div className="nm-raised p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-medium">{title}</h3>
        <Link href={link} className="text-xs text-primary hover:underline flex items-center">View all <ArrowRight className="ml-1 h-3 w-3" /></Link>
      </div>
      {isLoading ? <Skeleton className="h-20 w-full" /> : <div className="space-y-2">{children}</div>}
    </div>
  );
}
