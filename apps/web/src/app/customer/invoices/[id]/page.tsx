'use client';

import { useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { ResourceDetailPage } from '@/components/design-system/ResourceDetailPage';
import { fetchCustomerInvoice, customerPayInvoice, customerVerifyInvoicePayment, fetchCustomerInvoicePdfUrl } from '@/lib/api';

import { Receipt } from 'lucide-react';
import { toast } from 'sonner';

export default function CustomerInvoiceDetailPage() {
  const { token } = useAuth();
  const params = useParams();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const id = params.id as string;
  const sessionId = searchParams.get('session_id') || undefined;

  useEffect(() => {
    if (sessionId && token && id) {
      customerVerifyInvoicePayment(token, id, { session_id: sessionId })
        .then((result) => {
          if (result?.success) {
            toast.success('Payment verified');
          } else {
            toast.info(result?.message || 'Payment verification returned no result');
          }
          queryClient.invalidateQueries({ queryKey: ['invoice', token, id] });
        })
        .catch(() => toast.error('Payment verification failed'));
    }
  }, [sessionId, token, id, queryClient]);

  const payMutation = useMutation({
    mutationFn: () => customerPayInvoice(token!, id),
    onSuccess: (data) => {
      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast.info(data?.message || 'Payment flow is not configured yet.');
      }
    },
    onError: () => toast.error('Failed to start payment.'),
  });

  const pdfMutation = useMutation({
    mutationFn: () => fetchCustomerInvoicePdfUrl(token!, id),
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${id}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    },
    onError: () => toast.error('Failed to download PDF.'),
  });

  return (
    <ResourceDetailPage
      title="Invoice"
      icon={Receipt}
      backHref="/customer/invoices"
      titleKey="invoice_number"
      getFn={(t, invoiceId) => fetchCustomerInvoice(t, invoiceId).then((r) => r.data)}
      fields={[
        { key: 'title', label: 'Title', type: 'text', readOnly: true },
        { key: 'status', label: 'Status', type: 'text', readOnly: true },
        { key: 'total_amount', label: 'Total', type: 'number', readOnly: true },
        { key: 'amount_paid', label: 'Amount Paid', type: 'number', readOnly: true },
        { key: 'issue_date', label: 'Issue Date', type: 'date', readOnly: true },
        { key: 'due_date', label: 'Due Date', type: 'date', readOnly: true },
        { key: 'description', label: 'Description', type: 'textarea', readOnly: true },
      ]}
      actions={[
        { label: 'Pay', variant: 'default', onClick: () => payMutation.mutate(), disabled: payMutation.isPending },
        { label: 'PDF', variant: 'outline', onClick: () => pdfMutation.mutate(), disabled: pdfMutation.isPending },
      ]}
    />
  );
}
