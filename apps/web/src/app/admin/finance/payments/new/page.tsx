'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { PaymentForm } from '@/components/finance/PaymentForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, CreditCard } from 'lucide-react';

export default function AdminNewPaymentPage() {
  const { token } = useAuth();
  const router = useRouter();

  if (!token) return null;

  return (
    <PageShell
      title="Record Payment"
      icon={CreditCard}
      description="Manually record a payment against an invoice"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/finance/payments"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      }
    >
      <Card>
        <CardHeader><CardTitle>Payment Details</CardTitle></CardHeader>
        <CardContent>
          <PaymentForm token={token} onSuccess={(payment: any) => router.push(payment?.id ? `/admin/finance/payments/${payment.id}` : '/admin/finance/payments')} />
        </CardContent>
      </Card>
    </PageShell>
  );
}
