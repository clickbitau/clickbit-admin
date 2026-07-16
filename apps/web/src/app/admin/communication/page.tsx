'use client';
import { PageShell } from '@/components/design-system/PageShell';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, Mail, MessageCircle as MessageCircleIcon } from 'lucide-react';

export default function AdminCommunicationPage() {
  return (
    <PageShell
      title="Communication"
      icon={MessageCircleIcon}
      description="Chat, messages and mail."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5" /> Chat</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">Workspaces, channels and direct messages.</p>
            <Button asChild><Link href="/admin/communication/chat">Open chat</Link></Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" /> Mail</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">Email accounts, templates and folders.</p>
            <Button asChild><Link href="/admin/communication/mail">Open mail</Link></Button>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}