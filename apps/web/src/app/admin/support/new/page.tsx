'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { SupportTicketForm } from '@/components/support/SupportTicketForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Ticket as TicketIcon } from 'lucide-react';

export default function AdminNewTicketPage() {
  const { token } = useAuth();
  const router = useRouter();

  if (!token) return null;

  return (
    <PageShell
      title="New Ticket"
      icon={TicketIcon}
      description="Create a support ticket on behalf of a customer or internal user"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/support"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      }
    >
      <Card>
        <CardHeader><CardTitle>Ticket Details</CardTitle></CardHeader>
        <CardContent>
          <SupportTicketForm token={token} onSuccess={(ticket: any) => router.push(ticket?.id ? `/admin/support/${ticket.id}` : '/admin/support')} />
        </CardContent>
      </Card>
    </PageShell>
  );
}
