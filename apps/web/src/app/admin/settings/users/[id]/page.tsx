'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { StatCards } from '@/components/design-system/StatCards';
import { PersonAvatar } from '@/components/design-system/PersonAvatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  fetchUser,
  fetchUserAccountStatus,
  fetchUserPermissions,
  fetchAvailablePermissions,
  updateUser,
  updateUserPermissions,
  resetUserPermissions,
  resendUserWelcome,
  resetUser2fa,
  uploadUserAvatar,
  deleteUserAvatar,
  deleteUser,
} from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { ArrowLeft, User, Save, Trash, Mail, Shield, Camera, X } from 'lucide-react';

const roles = ['admin', 'manager', 'employee', 'customer', 'agent'];
const statuses = ['active', 'inactive', 'suspended'];

export default function AdminUserDetailPage() {
  const { token, user: currentUser } = useAuth();
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

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

  const { data: accountStatus } = useQuery({
    queryKey: ['user-account-status', token, id],
    queryFn: async () => { if (!token) throw new Error('No token'); return fetchUserAccountStatus(token, id); },
    enabled: !!token && !!id,
  });

  // Nest returns a flat profile; fetchUser normalizes to `{ user }`. Also accept a
  // flat payload if an older client/cache still has one.
  const userData = (data as { user?: Record<string, any> } | Record<string, any> | undefined)?.user
    ?? (data && typeof data === 'object' && 'id' in data && 'email' in data ? (data as Record<string, any>) : undefined);
  const isAdmin = currentUser?.role === 'admin';

  const { data: permissionsData } = useQuery({
    queryKey: ['user-permissions', token, id],
    queryFn: async () => { if (!token) throw new Error('No token'); return fetchUserPermissions(token, id); },
    enabled: !!token && !!id && userData?.role === 'manager',
  });

  const { data: availablePermissionsData } = useQuery({
    queryKey: ['available-permissions', token],
    queryFn: async () => { if (!token) throw new Error('No token'); return fetchAvailablePermissions(token); },
    enabled: !!token && userData?.role === 'manager',
  });

  useEffect(() => {
    if (userData) setForm(userData);
  }, [userData]);

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => updateUser(token!, Number(id), payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', token, id] });
      queryClient.invalidateQueries({ queryKey: ['user-account-status', token, id] });
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

  const permissionsMutation = useMutation({
    mutationFn: (permissions: string[]) => updateUserPermissions(token!, Number(id), permissions),
    onSuccess: () => { toast.success('Permissions updated'); queryClient.invalidateQueries({ queryKey: ['user-permissions', token, id] }); },
    onError: () => toast.error('Failed to update permissions'),
  });

  const resetPermissionsMutation = useMutation({
    mutationFn: () => resetUserPermissions(token!, Number(id)),
    onSuccess: () => { toast.success('Permissions reset to defaults'); queryClient.invalidateQueries({ queryKey: ['user-permissions', token, id] }); },
    onError: () => toast.error('Failed to reset permissions'),
  });

  const resendWelcomeMutation = useMutation({
    mutationFn: () => resendUserWelcome(token!, Number(id)),
    onSuccess: (res) => toast.success(res.message || 'Welcome email resent'),
    onError: () => toast.error('Failed to resend welcome'),
  });

  const reset2faMutation = useMutation({
    mutationFn: () => resetUser2fa(token!, Number(id)),
    onSuccess: (res) => toast.success(res.message || '2FA reset'),
    onError: () => toast.error('Failed to reset 2FA'),
  });

  const avatarMutation = useMutation({
    mutationFn: (file: File) => uploadUserAvatar(token!, Number(id), file),
    onSuccess: () => { toast.success('Avatar uploaded'); queryClient.invalidateQueries({ queryKey: ['user', token, id] }); },
    onError: () => toast.error('Failed to upload avatar'),
  });

  const deleteAvatarMutation = useMutation({
    mutationFn: () => deleteUserAvatar(token!, Number(id)),
    onSuccess: () => { toast.success('Avatar removed'); queryClient.invalidateQueries({ queryKey: ['user', token, id] }); },
    onError: () => toast.error('Failed to remove avatar'),
  });

  const handleSave = () => updateMutation.mutate(form);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) avatarMutation.mutate(file);
  };

  if (error) {
    return (
      <PageShell title="User" icon={User} description="Error" actions={<Button variant="outline" size="sm" asChild><Link href="/admin/settings/users"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link></Button>}>
        <div className="p-6 text-destructive">Failed to load user.</div>
      </PageShell>
    );
  }

  const displayName = userData ? `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || userData.email : 'User';

  const statCards = userData
    ? [
        { label: 'Role', value: userData.role, icon: User },
        { label: 'Status', value: userData.status || 'active', icon: Shield, accent: userData.status === 'active' ? 'success' as const : 'warning' as const },
        { label: 'Email verified', value: accountStatus?.email_verified ? 'Yes' : 'No', icon: Mail },
        { label: 'Last login', value: accountStatus?.last_login ? formatDateTime(accountStatus.last_login) : 'Never', icon: User },
      ]
    : [];

  const permissionGroups = (availablePermissionsData?.availablePermissions ?? {}) as Record<string, { key: string; label: string; description: string }[]>;
  const currentPermissions: string[] = permissionsData?.customPermissions ?? [];

  return (
    <PageShell
      title={displayName}
      icon={User}
      description={userData ? userData.email : ''}
      actions={
        <div className="flex flex-wrap items-center gap-2">
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
        <>
          <StatCards cards={statCards} />

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div className="flex items-center gap-4">
                      <PersonAvatar name={displayName} avatar_url={userData.avatar} size="lg" className="h-16 w-16 text-xl" />
                      <div>
                        <CardTitle className="text-2xl">{displayName}</CardTitle>
                        <p className="text-sm text-muted-foreground">{userData.email} · {userData.role}</p>
                      </div>
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

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={avatarMutation.isPending}><Camera className="mr-1 h-4 w-4" /> Upload avatar</Button>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
                    {userData.avatar && <Button variant="outline" size="sm" onClick={() => deleteAvatarMutation.mutate()} disabled={deleteAvatarMutation.isPending}><X className="mr-1 h-4 w-4" /> Remove avatar</Button>}
                    <Button variant="outline" size="sm" onClick={() => resendWelcomeMutation.mutate()} disabled={resendWelcomeMutation.isPending}><Mail className="mr-1 h-4 w-4" /> Resend welcome</Button>
                    {isAdmin && <Button variant="outline" size="sm" onClick={() => reset2faMutation.mutate()} disabled={reset2faMutation.isPending}><Shield className="mr-1 h-4 w-4" /> Reset 2FA</Button>}
                    <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}><Trash className="mr-1 h-4 w-4" /> Delete user</Button>
                  </div>
                </CardContent>
              </Card>

              {userData.role === 'manager' && (
                <Card>
                  <CardHeader><CardTitle>Manager Permissions</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    {permissionsData?.usingDefaultPermissions && (
                      <Badge variant="secondary">Using default permissions</Badge>
                    )}
                    <div className="space-y-4">
                      {Object.entries(permissionGroups).map(([group, perms]) => (
                        <div key={group}>
                          <p className="text-sm font-medium capitalize mb-2">{group}</p>
                          <div className="grid gap-2 md:grid-cols-2">
                            {(perms as { key: string; label: string; description: string }[]).map((perm) => {
                              const checked = currentPermissions.includes(perm.key);
                              return (
                                <label key={perm.key} className="flex items-start gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    className="mt-1 h-4 w-4 rounded border-border"
                                    checked={checked}
                                    onChange={() => {
                                      const next = checked ? currentPermissions.filter((p) => p !== perm.key) : [...currentPermissions, perm.key];
                                      permissionsMutation.mutate(next);
                                    }}
                                  />
                                  <div className="text-sm">
                                    <p className="font-medium">{perm.label}</p>
                                    <p className="text-xs text-muted-foreground">{perm.description}</p>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => resetPermissionsMutation.mutate()} disabled={resetPermissionsMutation.isPending}>Reset to defaults</Button>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader><CardTitle>Account Status</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p><span className="text-muted-foreground">Auth linked:</span> {accountStatus?.has_auth ? 'Yes' : 'No'}</p>
                  <p><span className="text-muted-foreground">Email verified:</span> {accountStatus?.email_verified ? 'Yes' : 'No'}</p>
                  <p><span className="text-muted-foreground">Last login:</span> {accountStatus?.last_login ? formatDateTime(accountStatus.last_login) : 'Never'}</p>
                  {accountStatus?.linked_contact && (
                    <p><span className="text-muted-foreground">Linked contact:</span> <Link href={`/admin/crm/contacts/${accountStatus.linked_contact.id}`} className="hover:underline">{accountStatus.linked_contact.name}</Link></p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </PageShell>
  );
}
