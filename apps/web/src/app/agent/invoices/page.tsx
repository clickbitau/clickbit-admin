'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { fetchAgentPortalInvoices } from '@/lib/api';
import { Receipt, ChevronLeft, ChevronRight } from 'lucide-react';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

function formatDate(value?: string | Date) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-AU');
}

export default function AgentInvoicesPage() {
  const { token } = useAuth();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['agent-invoices', token, page],
    queryFn: async () => { if (!token) throw new Error('No token'); return fetchAgentPortalInvoices(token, { page, limit: 25 }); },
    enabled: !!token,
  });

  const invoices = (data?.data || []) as Array<{
    id: number; invoice_number?: string; title?: string; client_name?: string; total_amount?: number; amount_paid?: number; status?: string; payment_status?: string; issue_date?: string; due_date?: string;
  }>;
  const pagination = (data?.pagination || { currentPage: 1, totalPages: 1 }) as { currentPage: number; totalPages: number };

  if (isLoading) {
    return <div className="p-4 space-y-6"><Skeleton className="h-10 w-1/3" /><Skeleton className="h-64" /></div>;
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Receipt className="w-7 h-7 text-purple-500" />
          Invoices
        </h1>
        <p className="text-muted-foreground mt-1">Invoices for your clients</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {invoices.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Receipt className="w-12 h-12 mx-auto mb-4 opacity-40" />
              <h3 className="text-lg font-medium mb-1">No invoices found</h3>
              <p className="text-sm">Invoices linked to your clients will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider">Invoice</th>
                    <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider">Client</th>
                    <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider">Amount</th>
                    <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider">Status</th>
                    <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider">Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-medium">{inv.invoice_number || `Invoice #${inv.id}`}</div>
                        {inv.title && <div className="text-xs text-muted-foreground">{inv.title}</div>}
                      </td>
                      <td className="px-5 py-4 text-sm">{inv.client_name || '-'}</td>
                      <td className="px-5 py-4 font-medium">{formatCurrency(inv.total_amount || 0)}</td>
                      <td className="px-5 py-4">
                        <Badge variant={inv.payment_status === 'paid' ? 'default' : inv.payment_status === 'overdue' ? 'destructive' : 'secondary'} className="capitalize">
                          {inv.payment_status || inv.status || 'pending'}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">{formatDate(inv.due_date || inv.issue_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="flex items-center gap-1 px-3 py-2 rounded-xl disabled:opacity-50 hover:nm-raised-sm transition-all"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>
          <span className="text-sm text-muted-foreground">Page {pagination.currentPage} of {pagination.totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={page >= pagination.totalPages}
            className="flex items-center gap-1 px-3 py-2 rounded-xl disabled:opacity-50 hover:nm-raised-sm transition-all"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
