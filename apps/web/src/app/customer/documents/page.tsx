'use client';

import { useRouter } from 'next/navigation';
import { ResourceListPage } from '@/components/crm/ResourceListPage';
import { fetchCustomerDocuments } from '@/lib/api';
import type { Document } from '@/types/crm';
import { formatDate } from '@/lib/format';
import { Files } from 'lucide-react';

export default function CustomerDocumentsPage() {
  const router = useRouter();

  return (
    <ResourceListPage<Document>
      title="Documents"
      icon={Files}
      resourceKey="data"
      fetcher={fetchCustomerDocuments}
      getRowId={(row) => row.id}
      columns={[
        { key: 'title', header: 'Title', accessor: 'title' },
        { key: 'category', header: 'Category', accessor: 'category' },
        { key: 'status', header: 'Status', accessor: 'status' },
        { key: 'mime_type', header: 'Type', accessor: 'mime_type' },
        {
          key: 'created_at',
          header: 'Created',
          cell: (row) => formatDate(row.created_at),
        },
      ]}
      onRowClick={(row) => router.push(`/customer/documents/${row.id}`)}
      searchPlaceholder="Search documents..."
    />
  );
}
