'use client';
import { PageShell } from '@/components/design-system/PageShell';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, Users, UserCircle, ShieldCheck, BarChart3, FileText } from 'lucide-react';

const modules = [
  { label: 'Site Settings', href: '/admin/settings', icon: Settings },
  { label: 'Users', href: '/admin/settings/users', icon: Users },
  { label: 'Profile', href: '/admin/settings/profile', icon: UserCircle },
  { label: 'Audit Logs', href: '/admin/settings/audit-logs', icon: ShieldCheck },
  { label: 'Dashboard Stats', href: '/admin/settings/dashboard', icon: BarChart3 },
  { label: 'Billing Settings', href: '/admin/settings/billing', icon: FileText },
];

export default function AdminSettingsPage() {
  return (
    <PageShell
      title="Settings & Admin"
      icon={Settings}
    >
      <div className="grid gap-4 md:grid-cols-3">
        {modules.map((m) => (
          <Card key={m.label}>
            <CardHeader><CardTitle className="flex items-center gap-2"><m.icon className="h-5 w-5" /> {m.label}</CardTitle></CardHeader>
            <CardContent><Button asChild><Link href={m.href}>Manage</Link></Button></CardContent>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}