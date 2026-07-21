'use client';

import { useState } from 'react';
import { ResourceListPage } from '@/components/crm/ResourceListPage';
import { fetchAutomations } from '@/lib/crm-api';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import type { CrmAutomation } from '@clickbit/shared';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/components/auth/AuthProvider';
import { AutomationForm } from '@/components/crm/AutomationForm';

export default function AutomationsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const { token } = useAuth();
  return (
    <>
      <ResourceListPage<CrmAutomation>
        title="Automations"
        resourceKey="automations"
        fetcher={fetchAutomations as any}
        getRowId={(row) => row.id}
        columns={[
          { key: 'name', header: 'Name' },
          { key: 'trigger_type', header: 'Trigger' },
          { key: 'action_type', header: 'Action' },
          { key: 'is_active', header: 'Active' },
        ]}
        actions={<Button onClick={() => setCreateOpen(true)}><Plus className="mr-1 h-4 w-4" /> New Automation</Button>}
      />
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>New Automation</DialogTitle>
            <DialogDescription>Create a CRM automation rule.</DialogDescription>
          </DialogHeader>
          {token && (
            <AutomationForm
              token={token}
              onSuccess={() => setCreateOpen(false)}
              onCancel={() => setCreateOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
