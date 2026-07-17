'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchCustomerCompany } from '@/lib/api';
import { Building2, Mail, Phone, Globe, MapPin, Users, Calendar } from 'lucide-react';

function formatDate(value?: string | Date) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-AU');
}

export default function CustomerCompanyPage() {
  const { token } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['customer-company', token],
    queryFn: async () => { if (!token) throw new Error('No token'); return fetchCustomerCompany(token); },
    enabled: !!token,
  });

  const company = data?.data as {
    id?: number; name?: string; domain?: string; industry?: string; company_size?: string; email?: string; phone?: string;
    address?: string; address_line2?: string; city?: string; state?: string; country?: string; postal_code?: string;
    logo_url?: string; website?: string; description?: string; created_at?: string;
    primary_contact?: { id: number; name: string; email?: string; phone?: string } | null;
  } | null;

  if (isLoading) {
    return (
      <div className="p-4 lg:p-6 space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="p-4 lg:p-6">
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <Building2 className="h-16 w-16 mx-auto mb-4 opacity-40" />
            <h3 className="text-lg font-medium mb-2">No Company Profile</h3>
            <p className="text-sm">No company has been associated with your account yet. Please contact support to link your company.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><Building2 className="h-8 w-8" /> Company Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">View your company information</p>
      </div>

      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 p-8">
          <div className="flex items-center gap-6">
            {company.logo_url ? (
              <img src={company.logo_url} alt={company.name} className="h-24 w-24 rounded-xl object-cover bg-white p-2 shadow-lg" />
            ) : (
              <div className="h-24 w-24 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Building2 className="h-12 w-12 text-white" />
              </div>
            )}
            <div className="flex-1">
              <h2 className="text-3xl font-bold text-white mb-2">{company.name}</h2>
              {company.industry && <p className="text-cyan-100">{company.industry}</p>}
              {company.company_size && (
                <p className="text-cyan-100 text-sm mt-1"><Users className="h-4 w-4 inline mr-1" />{company.company_size} employees</p>
              )}
            </div>
          </div>
        </div>
        <CardContent className="p-8 space-y-6">
          {company.description && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">About</h3>
              <p className="text-foreground">{company.description}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-4">Contact Information</h3>
              <div className="space-y-3">
                {company.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      <a href={`mailto:${company.email}`} className="hover:text-primary">{company.email}</a>
                    </div>
                  </div>
                )}
                {company.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Phone</p>
                      <a href={`tel:${company.phone}`} className="hover:text-primary">{company.phone}</a>
                    </div>
                  </div>
                )}
                {company.website && (
                  <div className="flex items-center gap-3">
                    <Globe className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Website</p>
                      <a href={company.website.startsWith('http') ? company.website : `https://${company.website}`} target="_blank" rel="noopener noreferrer" className="hover:text-primary">{company.website}</a>
                    </div>
                  </div>
                )}
                {company.domain && (
                  <div className="flex items-center gap-3">
                    <Globe className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Domain</p>
                      <p>{company.domain}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-4">Address</h3>
              {(company.address || company.city || company.country) ? (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-1" />
                  <div>
                    {company.address && <p>{company.address}</p>}
                    {(company.address_line2) && <p>{company.address_line2}</p>}
                    {(company.city || company.state || company.postal_code) && (
                      <p>{[company.city, company.state, company.postal_code].filter(Boolean).join(', ')}</p>
                    )}
                    {company.country && <p>{company.country}</p>}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No address information available</p>
              )}
            </div>
          </div>

          {company.primary_contact && (
            <div className="pt-6 border-t">
              <h3 className="text-sm font-medium text-muted-foreground mb-4">Primary Contact</h3>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-cyan-600 flex items-center justify-center text-white font-medium">
                  {company.primary_contact.name.charAt(0)}
                </div>
                <div>
                  <p className="font-medium">{company.primary_contact.name}</p>
                  {company.primary_contact.email && <p className="text-sm text-muted-foreground">{company.primary_contact.email}</p>}
                  {company.primary_contact.phone && <p className="text-sm text-muted-foreground">{company.primary_contact.phone}</p>}
                </div>
              </div>
            </div>
          )}

          <div className="pt-6 border-t flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>Company added on {formatDate(company.created_at)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
