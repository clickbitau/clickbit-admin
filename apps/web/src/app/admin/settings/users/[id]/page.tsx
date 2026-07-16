'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { fetchUser, updateUser, deleteUser } from '@/lib/api';
import { ArrowLeft, User, Save, Trash } from 'lucide-react';

const roles = ['admin', 'manager', 'employee', 'customer', 'agent'];
const statuses = ['active', 'inactive', 'suspended'];

export default function AdminUserDetailPage() {
  const { token } = useAuth();
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>({});

  const { data, isLoading, error } = useQuery({
    queryKey: ['user', token, id],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchUser(token, id);
    },
    enabled: !!token && !!id,
  });

  const userData = data?.user;

  useEffect(() => {
    if (userData) setForm(userData);
  }, [userData]);

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => updateUser(token!, Number(id), payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', token, id] });
      toast.success('User updated');
      setIsEditing(false);
    },
    onError: () => toast.error('Failed to update user'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteUser(token!, Number(id)),
    onSuccess: () => {
      toast.success('User deleted');
      router.push('/admin/settings/users');
    },
    onError: () => toast.error('Failed to delete user'),
  });

  const handleSave = () => {
    updateMutation.mutate(form);
  };

  if (error) {
    return (
      <PageShell title="User" icon={User} description="Error" actions={<Button variant="outline" size="sm" asChild><Link href="/admin/settings/users"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link></Button>}>
        <div className="p-6 text-destructive">Failed to load user.</div>
      </PageShell>
    );
  }

  const displayName = userData ? `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || userData.email : 'User';

  return (
    <PageShell
      title={displayName}
      icon={User}
      description={userData ? userData.email : ''}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/settings/users"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
          </Button>
          {!isEditing ? (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>Edit</Button>
          ) : (
            <Button variant="default" size="sm" onClick={handleSave} disabled={updateMutation.isPending}><Save className="mr-1 h-4 w-4" /> Save</Button>
          )}
        </div>
      }
    >
      {isLoading || !userData ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl">{displayName}</CardTitle>
                <p className="text-sm text-muted-foreground">{userData.email} · {userData.role}</p>
              </div>
              <Badge variant={userData.status === 'active' ? 'default' : 'secondary'}>{userData.status || 'active'}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {isEditing ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div><Label>First name</Label><Input value={String(form.first_name || '')} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></div>
                <div><Label>Last name</Label><Input value={String(form.last_name || '')} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
                <div><Label>Email</Label><Input value={String(form.email || '')} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div><Label>Phone</Label><Input value={String(form.phone || '')} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                <div><Label>Job title</Label><Input value={String(form.job_title || '')} onChange={(e) => setForm({ ...form, job_title: e.target.value })} /></div>
                <div><Label>Role</Label>
                  <select value={String(form.role || '')} onChange={(e) => setForm({ ...form, role: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                    {roles.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div><Label>Status</Label>
                  <select value={String(form.status || 'active')} onChange={(e) => setForm({ ...form, status: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                    {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div><Label>Avatar URL</Label><Input value={String(form.avatar || '')} onChange={(e) => setForm({ ...form, avatar: e.target.value })} /></div>
              </div>
            ) : (
              <div className="grid gap-2 md:grid-cols-2 text-sm">
                <p><span className="text-muted-foreground">First name:</span> {userData.first_name || '—'}</p>
                <p><span className="text-muted-foreground">Last name:</span> {userData.last_name || '—'}</p>
                <p><span className="text-muted-foreground">Email:</span> {userData.email || '—'}</p>
                <p><span className="text-muted-foreground">Phone:</span> {userData.phone || '—'}</p>
                <p><span className="text-muted-foreground">Job title:</span> {userData.job_title || '—'}</p>
                <p><span className="text-muted-foreground">Role:</span> {userData.role || '—'}</p>
                <p><span className="text-muted-foreground">Status:</span> {userData.status || 'active'}</p>
                <p><span className="text-muted-foreground">Created:</span> {userData.created_at ? new Date(userData.created_at).toLocaleDateString() : '—'}</p>
              </div>
            )}

            <Separator />

            <div className="flex justify-end">
              <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}><Trash className="mr-2 h-4 w-4" /> Delete user</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}
