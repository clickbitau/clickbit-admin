'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { InvoiceForm } from '@/components/finance/InvoiceForm';
import { Button } from '@/components/ui/button';
import { ArrowLeft, DollarSign } from 'lucide-react';

export default function AdminNewInvoicePage() {
  const { token } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialDocType = (searchParams?.get('document_type') as 'invoice' | 'estimate' | 'quote' | 'package') || 'invoice';

  if (!token) return null;

  return (
    <PageShell
      title="New Invoice"
      icon={DollarSign}
      description="Create a new invoice, estimate, quote or package"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/finance/invoices"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      }
    >
      <InvoiceForm token={token} initial={{ document_type: initialDocType }} onSuccess={(invoice: any) => router.push(invoice?.id ? `/admin/finance/invoices/${invoice.id}` : '/admin/finance/invoices')} />
    </PageShell>
  );
}
