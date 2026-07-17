'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchAgentPortalCompanies } from '@/lib/api';
import { Building2, Mail, Phone, Globe } from 'lucide-react';

export default function AgentCompaniesPage() {
  const { token } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['agent-companies', token],
    queryFn: async () => { if (!token) throw new Error('No token'); return fetchAgentPortalCompanies(token); },
    enabled: !!token,
  });

  const companies = (data?.data || []) as Array<{
    id: number; name: string; email?: string; phone?: string; industry?: string; domain?: string; address_line1?: string; city?: string; state?: string;
  }>;

  if (isLoading) {
    return (
      <div className="p-4 space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-40" /><Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Building2 className="w-7 h-7 text-blue-500" />
          My Companies
        </h1>
        <p className="text-muted-foreground mt-1">Companies under your agent partnership</p>
      </div>

      {companies.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <Building2 className="w-12 h-12 mx-auto mb-4 opacity-40" />
            <h3 className="text-lg font-medium mb-1">No companies assigned</h3>
            <p className="text-sm">Companies linked to your clients will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {companies.map((company) => (
            <Card key={company.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{company.name}</CardTitle>
                {company.industry && <p className="text-sm text-muted-foreground">{company.industry}</p>}
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {company.email && <div className="flex items-center gap-2 text-muted-foreground"><Mail className="w-4 h-4" /> {company.email}</div>}
                {company.phone && <div className="flex items-center gap-2 text-muted-foreground"><Phone className="w-4 h-4" /> {company.phone}</div>}
                {company.domain && <div className="flex items-center gap-2 text-muted-foreground"><Globe className="w-4 h-4" /> {company.domain}</div>}
                {(company.address_line1 || company.city) && (
                  <div className="text-muted-foreground">
                    {[company.address_line1, company.city, company.state].filter(Boolean).join(', ')}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
