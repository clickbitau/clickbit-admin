'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { ContactForm } from '@/components/crm/ContactForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User, ArrowLeft } from 'lucide-react';

export default function AdminNewContactPage() {
  const { token } = useAuth();
  const router = useRouter();

  if (!token) return null;

  return (
    <PageShell
      title="New Contact"
      icon={User}
      description="Add a new CRM contact"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/crm/contacts"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      }
    >
      <Card>
        <CardHeader><CardTitle>Contact Details</CardTitle></CardHeader>
        <CardContent>
          <ContactForm token={token} onSuccess={(contact: any) => router.push(contact?.id ? `/admin/crm/contacts/${contact.id}` : '/admin/crm/contacts')} />
        </CardContent>
      </Card>
    </PageShell>
  );
}
