'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { createTeamMember } from '@/lib/api';
import { ArrowLeft, Plus, Users } from 'lucide-react';

export default function AdminNewTeamMemberPage() {
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Record<string, any>>({
    name: '',
    role: '',
    role_label: '',
    email: '',
    phone: '',
    bio: '',
    linkedin: '',
    display_order: 0,
    image: '',
    is_active: true,
  });

  const mutation = useMutation({
    mutationFn: () => createTeamMember(token!, {
      ...form,
      display_order: Number(form.display_order) || 0,
    }),
    onSuccess: () => {
      toast.success('Team member created');
      queryClient.invalidateQueries({ queryKey: ['admin-team'] });
      router.push('/admin/content/team');
    },
    onError: () => toast.error('Failed to create team member'),
  });

  return (
    <PageShell
      title="New Team Member"
      icon={Users}
      description="Add a team member to the public site"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/content/team"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
      }
    >
      <Card>
        <CardHeader><CardTitle>Member Details</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Role</Label><Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} /></div>
          <div><Label>Role label</Label><Input value={form.role_label} onChange={(e) => setForm({ ...form, role_label: e.target.value })} /></div>
          <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div><Label>LinkedIn</Label><Input value={form.linkedin} onChange={(e) => setForm({ ...form, linkedin: e.target.value })} /></div>
          <div><Label>Image URL</Label><Input value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} /></div>
          <div><Label>Display order</Label><Input type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: e.target.value })} /></div>
          <div className="md:col-span-2"><Label>Bio</Label><Textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={4} /></div>
          <div className="md:col-span-2 flex gap-4">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active</label>
          </div>
          <div className="md:col-span-2">
            <Button onClick={() => form.name && form.role && mutation.mutate()} disabled={mutation.isPending}>
              <Plus className="mr-2 h-4 w-4" /> Create Team Member
            </Button>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
