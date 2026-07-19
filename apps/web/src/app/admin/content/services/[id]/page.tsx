'use client';

import { Briefcase } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ContentDetailPage } from '@/components/content/ContentDetailPage';
import { fetchAdminService, updateService, deleteService } from '@/lib/api';

function ServiceExtras({ data }: { data: Record<string, any> }) {
  const features = Array.isArray(data.features) ? data.features : [];
  const pricing = Array.isArray(data.pricing) ? data.pricing : (data.pricing ? [data.pricing] : []);
  const sections = Array.isArray(data.sections) ? data.sections : [];

  return (
    <div className="space-y-4 mt-4">
      {features.length > 0 && (
        <Card className="nm-raised">
          <CardHeader>
            <CardTitle className="text-sm">Features</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside text-sm space-y-1">
              {features.map((f: any, i: number) => (
                <li key={i}>{typeof f === 'string' ? f : (f.title || f.name || JSON.stringify(f))}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      {pricing.length > 0 && (
        <Card className="nm-raised">
          <CardHeader>
            <CardTitle className="text-sm">Pricing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {pricing.map((p: any, i: number) => (
                <div key={i} className="p-3 rounded-xl nm-raised-sm">
                  <p className="font-medium">{p.label || p.name || p.tier || `Tier ${i + 1}`}</p>
                  {p.price != null && <p className="text-sm text-muted-foreground">${p.price} {p.unit || ''}</p>}
                  {p.description && <p className="text-xs text-muted-foreground mt-1">{p.description}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      {sections.length > 0 && (
        <Card className="nm-raised">
          <CardHeader>
            <CardTitle className="text-sm">Sections</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sections.map((s: any, i: number) => (
              <div key={i} className="p-3 rounded-xl nm-raised-sm">
                <p className="font-medium text-sm">{s.title || s.heading || `Section ${i + 1}`}</p>
                {s.content && <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{s.content}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function AdminServiceDetailPage() {
  return (
    <ContentDetailPage
      title="Service"
      icon={Briefcase}
      backHref="/admin/content/services"
      titleKey="name"
      getFn={(token, id) => fetchAdminService(token, id)}
      updateFn={(token, id, data) => updateService(token, Number(id), data)}
      deleteFn={(token, id) => deleteService(token, Number(id))}
      fields={[
        { key: 'name', label: 'Name', type: 'text' },
        { key: 'slug', label: 'Slug', type: 'text' },
        { key: 'category', label: 'Category', type: 'text' },
        { key: 'description', label: 'Description', type: 'textarea' },
        { key: 'header_image', label: 'Header image', type: 'image', upload: 'portfolio' },
        { key: 'features', label: 'Features', type: 'json' },
        { key: 'pricing', label: 'Pricing', type: 'json' },
        { key: 'sections', label: 'Sections', type: 'json' },
        { key: 'is_popular', label: 'Popular', type: 'checkbox' },
        { key: 'is_active', label: 'Active', type: 'checkbox' },
      ]}
      extraReadOnly={(data) => <ServiceExtras data={data} />}
    />
  );
}
