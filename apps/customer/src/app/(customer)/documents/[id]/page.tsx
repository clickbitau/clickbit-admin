'use client';

import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import { useParams } from 'next/navigation';
import { ResourceDetailPage } from '@/components/design-system/ResourceDetailPage';
import { fetchCustomerDocument, fetchCustomerDocumentDownload } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { Files } from 'lucide-react';
import { toast } from 'sonner';

export default function CustomerDocumentDetailPage() {
  const { token } = useAuth();
  const params = useParams();
  const id = params.id as string;

  const downloadMutation = useMutation({
    mutationFn: () => fetchCustomerDocumentDownload(token!, id),
    onSuccess: (data) => {
      const url = data?.data?.file_url || data?.data?.url;
      if (url) {
        window.open(url, '_blank');
      } else {
        toast.info(data?.message || 'Download not available.');
      }
    },
    onError: () => toast.error('Failed to download document.'),
  });

  return (
    <ResourceDetailPage
      title="Document"
      icon={Files}
      backHref="/documents"
      titleKey="title"
      getFn={(t, docId) => fetchCustomerDocument(t, docId).then((r) => r.data)}
      fields={[
        { key: 'title', label: 'Title', type: 'text', readOnly: true },
        { key: 'category', label: 'Category', type: 'text', readOnly: true },
        { key: 'mime_type', label: 'Type', type: 'text', readOnly: true },
        { key: 'status', label: 'Status', type: 'text', readOnly: true },
        { key: 'file_size', label: 'Size (bytes)', type: 'number', readOnly: true },
        { key: 'original_filename', label: 'Filename', type: 'text', readOnly: true },
        { key: 'file_url', label: 'URL', type: 'text', readOnly: true },
        { key: 'created_at', label: 'Created', type: 'date', readOnly: true },
      ]}
      actions={[
        { label: 'Download', variant: 'default', onClick: () => downloadMutation.mutate(), disabled: downloadMutation.isPending },
      ]}
    />
  );
}
