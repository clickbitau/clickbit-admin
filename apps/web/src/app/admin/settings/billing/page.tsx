'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Save } from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/components/auth/AuthProvider';
import { fetchBillingSettings, updateBillingSettings } from '@/lib/api';

interface BillingSettingsForm {
  stripePublishableKey?: string;
  stripeSecretKey?: string;
  currencyCode?: string;
  taxRate?: number;
  companyAbn?: string;
  billingAddress?: string;
  paymentTerms?: string;
}

export default function AdminBillingSettingsPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['billing-settings', token],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchBillingSettings(token);
    },
    enabled: !!token,
  });

  const [form, setForm] = useState<BillingSettingsForm>({
    stripePublishableKey: '',
    stripeSecretKey: '',
    currencyCode: 'AUD',
    taxRate: 10,
    companyAbn: '',
    billingAddress: '',
    paymentTerms: 'Net 30',
  });

  useEffect(() => {
    if (data) setForm((f) => ({ ...f, ...data }));
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error('No token');
      return updateBillingSettings(token, form as Record<string, unknown>);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['billing-settings', token] }),
  });

  return (
    <PageShell title="Billing Settings" icon={CreditCard} description="Stripe, tax, and Google Maps configuration.">
      <Card>
        <CardHeader>
          <CardTitle>Payment & Tax Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          {error && <div className="text-destructive">Failed to load billing settings.</div>}
          {isLoading && <div className="text-muted-foreground">Loading...</div>}
          {!isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stripePublishableKey">Stripe Publishable Key</Label>
                <Input id="stripePublishableKey" value={form.stripePublishableKey} onChange={(e) => setForm({ ...form, stripePublishableKey: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stripeSecretKey">Stripe Secret Key</Label>
                <Input id="stripeSecretKey" type="password" value={form.stripeSecretKey} onChange={(e) => setForm({ ...form, stripeSecretKey: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currencyCode">Currency Code</Label>
                <Input id="currencyCode" value={form.currencyCode} onChange={(e) => setForm({ ...form, currencyCode: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxRate">Tax Rate (%)</Label>
                <Input id="taxRate" type="number" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyAbn">Company ABN</Label>
                <Input id="companyAbn" value={form.companyAbn} onChange={(e) => setForm({ ...form, companyAbn: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentTerms">Payment Terms</Label>
                <Input id="paymentTerms" value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="billingAddress">Billing Address</Label>
                <Input id="billingAddress" value={form.billingAddress} onChange={(e) => setForm({ ...form, billingAddress: e.target.value })} />
              </div>
            </div>
          )}

          <div className="mt-4">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              <Save className="mr-2 h-4 w-4" /> {save.isPending ? 'Saving...' : 'Save Billing Settings'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
