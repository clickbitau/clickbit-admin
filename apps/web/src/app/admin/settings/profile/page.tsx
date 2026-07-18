'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { UserCircle, Camera, Trash2, Lock, Bell, Link2, AlertTriangle, Building2, Globe, Save } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  fetchProfile,
  updateProfile,
  changePassword,
  uploadAvatar,
  deleteAvatar,
  uploadCompanyLogo,
  deleteCompanyLogo,
  updateProfileNotifications,
  fetchLinkedAccounts,
  unlinkProvider,
  deleteAccount,
} from '@/lib/api';
import { formatDate } from '@/lib/format';
import { toast } from 'sonner';
import { MfaSection } from './MfaSection';
import { PasskeySection } from './PasskeySection';
import { TrustedDevicesSection } from './TrustedDevicesSection';

const NOTIFICATION_KEYS = [
  { key: 'new_leads', label: 'New leads', default: true },
  { key: 'new_orders', label: 'New orders', default: true },
  { key: 'support_tickets', label: 'Support tickets', default: true },
  { key: 'invoice_payments', label: 'Invoice payments', default: true },
  { key: 'mentions', label: 'Mentions', default: true },
  { key: 'announcements', label: 'Announcements', default: true },
  { key: 'reminders', label: 'Reminders', default: true },
  { key: 'marketing', label: 'Marketing updates', default: false },
];

type LinkedAccount = { provider: string; linked_at: string };

export default function AdminSettingsProfilePage() {
  const { token, logout } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const avatarRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['profile', token],
    queryFn: () => { if (!token) throw new Error('No token'); return fetchProfile(token); },
    enabled: !!token,
  });

  const user = data?.data?.user;
  const initial = user ?? {};

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    job_title: '',
    company: '',
    bio: '',
    website: '',
    timezone: '',
    language: '',
    address: '',
  });

  useEffect(() => {
    if (user) {
      setForm({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
        phone: user.phone || '',
        job_title: user.job_title || '',
        company: user.company || '',
        bio: user.bio || '',
        website: user.website || '',
        timezone: user.timezone || '',
        language: user.language || '',
        address: user.address || '',
      });
    }
  }, [user]);

  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const notifications = (user?.preferences && typeof user.preferences === 'object' ? (user.preferences as any).notifications : {}) || {};
    const next: Record<string, boolean> = {};
    for (const n of NOTIFICATION_KEYS) next[n.key] = notifications[n.key] ?? n.default;
    setPrefs(next);
  }, [user?.preferences]);

  const update = useMutation({
    mutationFn: () => updateProfile(token!, { ...form, preferences: { notifications: prefs } }),
    onSuccess: () => { toast.success('Profile updated'); queryClient.invalidateQueries({ queryKey: ['profile', token] }); },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to update profile'),
  });

  const updateNotifications = useMutation({
    mutationFn: () => updateProfileNotifications(token!, prefs),
    onSuccess: () => { toast.success('Notification preferences saved'); queryClient.invalidateQueries({ queryKey: ['profile', token] }); },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to save preferences'),
  });

  const uploadAvatarMutation = useMutation({
    mutationFn: (file: File) => uploadAvatar(token!, file),
    onSuccess: () => { toast.success('Avatar uploaded'); queryClient.invalidateQueries({ queryKey: ['profile', token] }); },
    onError: () => toast.error('Avatar upload failed'),
  });

  const removeAvatar = useMutation({
    mutationFn: () => deleteAvatar(token!),
    onSuccess: () => { toast.success('Avatar removed'); queryClient.invalidateQueries({ queryKey: ['profile', token] }); },
  });

  const uploadLogoMutation = useMutation({
    mutationFn: (file: File) => uploadCompanyLogo(token!, file),
    onSuccess: () => { toast.success('Company logo uploaded'); queryClient.invalidateQueries({ queryKey: ['profile', token] }); },
    onError: () => toast.error('Logo upload failed'),
  });

  const removeLogo = useMutation({
    mutationFn: () => deleteCompanyLogo(token!),
    onSuccess: () => { toast.success('Company logo removed'); queryClient.invalidateQueries({ queryKey: ['profile', token] }); },
  });

  const savePassword = useMutation({
    mutationFn: (payload: { current_password: string; new_password: string; confirm_password: string }) => changePassword(token!, payload),
    onSuccess: (res: any) => { toast.success(res.message || 'Password changed'); setPw({ current_password: '', new_password: '', confirm_password: '' }); },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to change password'),
  });

  const { data: linkedData } = useQuery({
    queryKey: ['linked-accounts', token],
    queryFn: () => fetchLinkedAccounts(token!),
    enabled: !!token,
  });
  const linkedAccounts: LinkedAccount[] = linkedData?.data?.linked_accounts ?? [];

  const unlink = useMutation({
    mutationFn: (provider: string) => unlinkProvider(token!, provider),
    onSuccess: () => { toast.success('Provider unlinked'); queryClient.invalidateQueries({ queryKey: ['linked-accounts', token] }); },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to unlink'),
  });

  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm_password: '' });

  const accountDelete = useMutation({
    mutationFn: (password: string) => deleteAccount(token!, password),
    onSuccess: () => { toast.success('Account deleted'); logout?.(); router.push('/login'); },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to delete account'),
  });

  const onAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadAvatarMutation.mutate(file);
  };

  const onLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadLogoMutation.mutate(file);
  };

  if (isLoading || !user) return (
    <PageShell title="Profile" icon={UserCircle}>
      <Card><CardContent className="p-6"><Skeleton className="h-40 w-full" /></CardContent></Card>
    </PageShell>
  );

  const fullName = `${form.first_name || ''} ${form.last_name || ''}`.trim() || user.email;

  return (
    <PageShell title="Profile" icon={UserCircle} description="Manage your account, security, and preferences">
      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Your public profile information.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col sm:flex-row items-start gap-6">
                <div className="relative">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={user.avatar} alt={fullName} />
                    <AvatarFallback className="text-2xl">{form.first_name?.[0] || form.last_name?.[0] || 'U'}</AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-2 -right-2 flex gap-1">
                    <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full" onClick={() => avatarRef.current?.click()}><Camera className="h-4 w-4" /></Button>
                    {user.avatar && <Button variant="destructive" size="icon" className="h-8 w-8 rounded-full" onClick={() => removeAvatar.mutate()}><Trash2 className="h-4 w-4" /></Button>}
                  </div>
                  <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={onAvatarSelect} />
                </div>
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                  <div className="space-y-2"><Label>First name</Label><Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Last name</Label><Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
                  <div className="space-y-2 sm:col-span-2"><Label>Email</Label><Input value={form.email} disabled title={user.email_verified ? 'Verified' : 'Unverified'} className={user.email_verified ? '' : 'border-amber-300'} /></div>
                  <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Job title</Label><Input value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} /></div>
                  <div className="space-y-2 sm:col-span-2"><Label>Bio</Label><Input value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Website</Label><Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Timezone</Label><Input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} placeholder="Australia/Sydney" /></div>
                  <div className="space-y-2"><Label>Language</Label><Input value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} placeholder="en" /></div>
                  <div className="space-y-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => update.mutate()} disabled={update.isPending}><Save className="mr-1 h-4 w-4" /> Save profile</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="company" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Building2 className="h-4 w-4" /> Company branding</CardTitle>
              <CardDescription>Your company name and logo appear on invoices and the customer portal.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2"><Label>Company name</Label><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20 rounded-md">
                  <AvatarImage src={user.company_logo} className="rounded-md object-contain" />
                  <AvatarFallback className="rounded-md"><Building2 className="h-8 w-8" /></AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => logoRef.current?.click()}><Camera className="mr-1 h-4 w-4" /> Upload logo</Button>
                    {user.company_logo && <Button variant="outline" onClick={() => removeLogo.mutate()}><Trash2 className="mr-1 h-4 w-4" /> Remove</Button>}
                  </div>
                  <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={onLogoSelect} />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => update.mutate()} disabled={update.isPending}><Save className="mr-1 h-4 w-4" /> Save company</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Bell className="h-4 w-4" /> Email notifications</CardTitle>
              <CardDescription>Choose what you want to be notified about.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {NOTIFICATION_KEYS.map((n) => (
                <div key={n.key} className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm font-medium">{n.label}</span>
                  <input
                    type="checkbox"
                    checked={!!prefs[n.key]}
                    onChange={(e) => setPrefs((p) => ({ ...p, [n.key]: e.target.checked }))}
                    className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                </div>
              ))}
              <div className="flex justify-end pt-2">
                <Button onClick={() => updateNotifications.mutate()} disabled={updateNotifications.isPending}><Save className="mr-1 h-4 w-4" /> Save notifications</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Lock className="h-4 w-4" /> Change password</CardTitle>
              <CardDescription>Update your password. You will be logged out of other sessions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2"><Label>Current password</Label><Input type="password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} /></div>
              <div className="space-y-2"><Label>New password</Label><Input type="password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} /></div>
              <div className="space-y-2"><Label>Confirm new password</Label><Input type="password" value={pw.confirm_password} onChange={(e) => setPw({ ...pw, confirm_password: e.target.value })} /></div>
              <div className="flex justify-end">
                <Button onClick={() => savePassword.mutate(pw)} disabled={savePassword.isPending}>Change password</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Link2 className="h-4 w-4" /> Linked accounts</CardTitle>
              <CardDescription>Social login providers connected to your account.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {linkedAccounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No linked social accounts.</p>
              ) : (
                linkedAccounts.map((a) => (
                  <div key={a.provider} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium capitalize">{a.provider}</span>
                      <span className="text-xs text-muted-foreground">Linked {formatDate(a.linked_at)}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => unlink.mutate(a.provider)} disabled={unlink.isPending}>Unlink</Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <MfaSection />

          <PasskeySection />

          <TrustedDevicesSection />

          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-4 w-4" /> Danger zone</CardTitle>
              <CardDescription>Deleting your account cannot be undone.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" onClick={() => {
                const password = window.prompt('This will deactivate your account. Enter your password to confirm:');
                if (password) accountDelete.mutate(password);
              }} disabled={accountDelete.isPending}>Delete account</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
