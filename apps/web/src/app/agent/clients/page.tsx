'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { PersonAvatar } from '@/components/design-system/PersonAvatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchAgentPortalDashboard, fetchAgentPortalClients } from '@/lib/api';
import { Users2, DollarSign, Search, Building2, Phone, Mail, Calendar, TrendingUp } from 'lucide-react';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

function formatDate(value?: string | Date) {
  if (!value) return 'Never';
  return new Date(value).toLocaleDateString('en-AU');
}

export default function AgentClientsPage() {
  const { token } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: dashboard, isLoading: loadingDashboard } = useQuery({
    queryKey: ['agent-dashboard', token],
    queryFn: async () => { if (!token) throw new Error('No token'); return fetchAgentPortalDashboard(token); },
    enabled: !!token,
  });

  const { data: clientsData, isLoading: loadingClients } = useQuery({
    queryKey: ['agent-clients', token],
    queryFn: async () => { if (!token) throw new Error('No token'); return fetchAgentPortalClients(token); },
    enabled: !!token,
  });

  const isLoading = loadingDashboard || loadingClients;
  const stats = dashboard?.stats || {};
  const clients = (clientsData?.data?.clients || []) as Array<{
    id: number; name: string; email?: string; phone?: string; company?: string; total_revenue: number; created_at?: string; last_contacted_at?: string;
  }>;

  const filtered = clients.filter((c) =>
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.company?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="p-4 space-y-6">
        <div className="grid grid-cols-3 gap-4"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
        <Skeleton className="h-10" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users2 className="w-7 h-7 text-blue-500" />
          My Clients
        </h1>
        <p className="text-muted-foreground mt-1">Clients referred through your agent partnership</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground mb-1">Total Clients</div>
            <div className="text-2xl font-bold">{stats.total_clients || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground mb-1">Total Revenue</div>
            <div className="text-2xl font-bold text-emerald-600">{formatCurrency(stats.client_revenue || 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground mb-1">Avg Revenue</div>
            <div className="text-2xl font-bold text-purple-600">{formatCurrency(stats.total_clients > 0 ? (stats.client_revenue || 0) / stats.total_clients : 0)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search clients..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Users2 className="w-12 h-12 mx-auto mb-4 opacity-40" />
              <h3 className="text-lg font-medium mb-1">No clients found</h3>
              <p className="text-sm">Clients assigned to you will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider">Client</th>
                    <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider">Contact</th>
                    <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider">Revenue</th>
                    <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider">Since</th>
                    <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider">Last Contact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((client) => (
                    <tr key={client.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <PersonAvatar name={client.name} size="md" />
                          <div>
                            <div className="font-medium">{client.name}</div>
                            {client.company && (
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <Building2 className="w-3 h-3" /> {client.company}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="space-y-1">
                          {client.email && <div className="flex items-center gap-1 text-sm text-muted-foreground"><Mail className="w-3 h-3" /> {client.email}</div>}
                          {client.phone && <div className="flex items-center gap-1 text-sm text-muted-foreground"><Phone className="w-3 h-3" /> {client.phone}</div>}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-semibold text-emerald-600">{formatCurrency(client.total_revenue || 0)}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="w-3 h-3" /> {formatDate(client.created_at)}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">
                        {client.last_contacted_at ? formatDate(client.last_contacted_at) : 'Never'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
