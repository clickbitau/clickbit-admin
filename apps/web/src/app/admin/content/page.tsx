'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Briefcase, Image, Users, Star, BookOpen, Megaphone } from 'lucide-react';

const modules = [
  { label: 'Services', href: '/admin/content/services', icon: Briefcase },
  { label: 'Portfolio', href: '/admin/content/portfolio', icon: Image },
  { label: 'Team', href: '/admin/content/team', icon: Users },
  { label: 'Reviews', href: '/admin/content/reviews', icon: Star },
  { label: 'Blog', href: '/admin/content/blog', icon: BookOpen },
  { label: 'Marketing', href: '/admin/content/marketing', icon: Megaphone },
];

export default function AdminContentPage() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Content & Marketing</h1>
        <div className="grid gap-4 md:grid-cols-3">
          {modules.map((m) => (
            <Card key={m.label}>
              <CardHeader><CardTitle className="flex items-center gap-2"><m.icon className="h-5 w-5" /> {m.label}</CardTitle></CardHeader>
              <CardContent><Button asChild><Link href={m.href}>Manage</Link></Button></CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
