'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { createAutomation } from '@/lib/crm-api';
import { Plus } from 'lucide-react';

const triggers = ['lead_created', 'deal_created', 'contact_created', 'company_created', 'activity_created', 'task_created', 'status_changed', 'stage_changed', 'no_activity_days', 'custom_package_created', 'order_created', 'order_status_changed', 'ticket_created', 'scheduled'];
const actions = ['send_email', 'create_task', 'create_activity', 'update_field', 'assign_owner', 'add_tag', 'remove_tag', 'create_deal', 'move_deal_stage', 'send_notification', 'webhook', 'update_lead_score', 'change_lifecycle_stage'];
const targets = ['contact', 'deal', 'company', 'activity', 'order', 'ticket'];

interface AutomationFormProps {
  token: string;
  onSuccess?: (automation: any) => void;
  onCancel?: () => void;
  initial?: Record<string, any>;
}

export function AutomationForm({ token, onSuccess, onCancel, initial }: AutomationFormProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Record<string, any>>({
    trigger_type: 'lead_created',
    action_type: 'send_email',
    target_entity: 'contact',
    delay_minutes: 0,
    is_active: true,
    trigger_conditions: {},
    action_config: {},
    ...initial,
  });
  const [triggerJson, setTriggerJson] = useState(JSON.stringify(form.trigger_conditions || {}, null, 2));
  const [actionJson, setActionJson] = useState(JSON.stringify(form.action_config || {}, null, 2));

  const mutation = useMutation({
    mutationFn: () => createAutomation(token, {
      ...form,
      trigger_conditions: JSON.parse(triggerJson || '{}'),
      action_config: JSON.parse(actionJson || '{}'),
    }),
    onSuccess: (data: any) => {
      toast.success('Automation created');
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      onSuccess?.(data?.automation ?? data?.data ?? data);
    },
    onError: () => toast.error('Failed to create automation'),
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2"><Label>Name</Label><Input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
      <div className="md:col-span-2"><Label>Description</Label><Textarea value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
      <div><Label>Trigger type</Label>
        <select value={form.trigger_type || ''} onChange={(e) => setForm({ ...form, trigger_type: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          {triggers.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div><Label>Action type</Label>
        <select value={form.action_type || ''} onChange={(e) => setForm({ ...form, action_type: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          {actions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      <div><Label>Target entity</Label>
        <select value={form.target_entity || 'contact'} onChange={(e) => setForm({ ...form, target_entity: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          {targets.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div><Label>Delay minutes</Label><Input type="number" value={form.delay_minutes ?? 0} onChange={(e) => setForm({ ...form, delay_minutes: e.target.value ? Number(e.target.value) : 0 })} /></div>
      <div className="md:col-span-2"><Label>Trigger conditions (JSON)</Label><Textarea value={triggerJson} onChange={(e) => setTriggerJson(e.target.value)} rows={3} /></div>
      <div className="md:col-span-2"><Label>Action config (JSON)</Label><Textarea value={actionJson} onChange={(e) => setActionJson(e.target.value)} rows={3} /></div>
      <div className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} id="active" /><Label htmlFor="active">Active</Label></div>
      <div className="md:col-span-2 flex items-center justify-end gap-2">
        {onCancel && <Button variant="outline" onClick={onCancel}>Cancel</Button>}
        <Button onClick={() => form.name && form.trigger_type && form.action_type && mutation.mutate()} disabled={mutation.isPending}>
          <Plus className="mr-2 h-4 w-4" /> Create Automation
        </Button>
      </div>
    </div>
  );
}
