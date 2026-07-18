'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '@/lib/useDebounce';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageShell } from '@/components/design-system/PageShell';
import { StatCards } from '@/components/design-system/StatCards';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileText,
  Plus,
  Copy,
  Star,
  Trash2,
  Search,
  Code,
  Eye,
  RefreshCw,
  Check,
  LayoutTemplate,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { PdfTemplate } from '@/types/settings';
import {
  fetchPdfTemplates,
  createPdfTemplate,
  updatePdfTemplate,
  deletePdfTemplate,
  setDefaultPdfTemplate,
  clonePdfTemplate,
  previewPdfTemplate,
  previewPdfTemplateWithData,
} from '@/lib/api';

const TEMPLATE_TYPES = [
  { value: 'invoice', label: 'Invoice', icon: FileText },
  { value: 'quote', label: 'Quote / Estimate', icon: FileText },
  { value: 'payslip', label: 'Payslip', icon: FileText },
  { value: 'contract', label: 'Contract', icon: FileText },
  { value: 'receipt', label: 'Receipt', icon: FileText },
  { value: 'other', label: 'Other', icon: FileText },
];

const PDF_TEMPLATE_VARIABLES = [
  { key: '{{invoice_number}}', label: 'Invoice Number' },
  { key: '{{quote_number}}', label: 'Quote Number' },
  { key: '{{date}}', label: 'Date' },
  { key: '{{due_date}}', label: 'Due Date' },
  { key: '{{client_name}}', label: 'Client Name' },
  { key: '{{client_email}}', label: 'Client Email' },
  { key: '{{company_name}}', label: 'Company Name' },
  { key: '{{company_address}}', label: 'Company Address' },
  { key: '{{company_phone}}', label: 'Company Phone' },
  { key: '{{company_email}}', label: 'Company Email' },
  { key: '{{items}}', label: 'Line Items Table' },
  { key: '{{subtotal}}', label: 'Subtotal' },
  { key: '{{tax}}', label: 'Tax' },
  { key: '{{total}}', label: 'Total' },
  { key: '{{amount_due}}', label: 'Amount Due' },
  { key: '{{notes}}', label: 'Notes' },
  { key: '{{payment_terms}}', label: 'Payment Terms' },
  { key: '{{employee_name}}', label: 'Employee Name' },
  { key: '{{pay_period}}', label: 'Pay Period' },
  { key: '{{gross_pay}}', label: 'Gross Pay' },
  { key: '{{net_pay}}', label: 'Net Pay' },
  { key: '{{tax_deduction}}', label: 'Tax Deduction' },
];

const DEFAULT_CSS = `body {
  font-family: 'Sora', 'Helvetica', sans-serif;
  font-size: 12px;
  color: #0F172A;
  padding: 48px;
  line-height: 1.5;
}
h1 { color: #1FBBD2; font-size: 28px; margin: 0 0 12px; }
h2 { font-size: 14px; color: #475569; margin: 0 0 6px; }
table { width: 100%; border-collapse: collapse; margin: 16px 0; }
th { background: #F8FAFC; text-align: left; padding: 8px; border-bottom: 2px solid #E2E8F0; }
td { padding: 8px; border-bottom: 1px solid #E2E8F0; }
.text-right { text-align: right; }
.total { font-weight: 700; font-size: 14px; color: #1FBBD2; }`;

const DEFAULT_HTML = `<div style="display:flex; justify-content:space-between; align-items:flex-start;">
  <div>
    <h1>INVOICE</h1>
    <p>{{company_name}}<br>{{company_address}}<br>{{company_email}}</p>
  </div>
  <div style="text-align:right;">
    <h2># {{invoice_number}}</h2>
    <p>Date: {{date}}<br>Due: {{due_date}}</p>
  </div>
</div>

<div style="margin: 24px 0;">
  <h2>Billed To</h2>
  <p>{{client_name}}<br>{{client_email}}</p>
</div>

<h2>Items</h2>
{{items}}

<div style="width: 300px; margin-left: auto; margin-top: 16px;">
  <div style="display:flex; justify-content:space-between;"><span>Subtotal</span><span>{{subtotal}}</span></div>
  <div style="display:flex; justify-content:space-between;"><span>Tax</span><span>{{tax}}</span></div>
  <div style="display:flex; justify-content:space-between; font-weight:700; font-size:14px; color:#1FBBD2; margin-top:8px;">
    <span>Total</span><span>{{total}}</span>
  </div>
</div>

<div style="margin-top: 32px;">
  <p><strong>Notes:</strong> {{notes}}</p>
  <p><strong>Payment Terms:</strong> {{payment_terms}}</p>
</div>`;

const DEFAULT_HEADER = '';
const DEFAULT_FOOTER = '<div style="margin-top: 48px; text-align: center; color: #94A3B8; font-size: 10px;">Thank you for your business.</div>';

const emptyTemplate: PdfTemplate = {
  id: 0,
  name: '',
  template_type: 'invoice',
  description: '',
  html: DEFAULT_HTML,
  css: DEFAULT_CSS,
  header: DEFAULT_HEADER,
  footer: DEFAULT_FOOTER,
  is_default: false,
};

export default function AdminPdfTemplatesPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [editing, setEditing] = useState<PdfTemplate | null>(null);
  const [form, setForm] = useState<PdfTemplate>(emptyTemplate);
  const [activeField, setActiveField] = useState<keyof PdfTemplate>('html');
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  const debouncedForm = useDebounce(form, 600);

  const { data: templates = [], isLoading, error } = useQuery({
    queryKey: ['pdf-templates', token, typeFilter],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchPdfTemplates(token, typeFilter || undefined);
    },
    enabled: !!token,
  });

  const filtered = useMemo(() => {
    const q = filter.toLowerCase();
    return templates.filter((t) =>
      (t.name || '').toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q) ||
      (t.template_type || '').toLowerCase().includes(q)
    );
  }, [templates, filter]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['pdf-templates', token] });

  const createMutation = useMutation({
    mutationFn: (data: Partial<PdfTemplate>) => createPdfTemplate(token!, data),
    onSuccess: () => { refresh(); closeEditor(); toast.success('Template created'); },
    onError: (err: Error) => toast.error(err.message || 'Failed to create template'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PdfTemplate> }) => updatePdfTemplate(token!, id, data),
    onSuccess: () => { refresh(); closeEditor(); toast.success('Template updated'); },
    onError: (err: Error) => toast.error(err.message || 'Failed to update template'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => deletePdfTemplate(token!, id),
    onSuccess: () => { refresh(); toast.success('Template deleted'); },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete template'),
  });

  const defaultMutation = useMutation({
    mutationFn: (id: number) => setDefaultPdfTemplate(token!, id),
    onSuccess: () => { refresh(); toast.success('Default template set'); },
    onError: (err: Error) => toast.error(err.message || 'Failed'),
  });

  const cloneMutation = useMutation({
    mutationFn: (id: number) => clonePdfTemplate(token!, id),
    onSuccess: () => { refresh(); toast.success('Template duplicated'); },
    onError: (err: Error) => toast.error(err.message || 'Failed to clone'),
  });

  const previewMutation = useMutation({
    mutationFn: (data: Partial<PdfTemplate>) => previewPdfTemplateWithData(token!, data),
    onSuccess: (res) => { setPreviewHtml(res.preview_html); setPreviewLoading(false); },
    onError: () => { setPreviewLoading(false); toast.error('Preview failed'); },
  });

  function openEditor(template?: PdfTemplate) {
    const t = template ? { ...template } : { ...emptyTemplate, id: Date.now() };
    setForm({
      ...t,
      html: t.html ?? DEFAULT_HTML,
      css: t.css ?? DEFAULT_CSS,
      header: t.header ?? DEFAULT_HEADER,
      footer: t.footer ?? DEFAULT_FOOTER,
      template_type: t.template_type || t.type || 'invoice',
    });
    setEditing(template || null);
    setPreviewHtml('');
    if (template && template.id) {
      setPreviewLoading(true);
      previewMutation.mutate(t);
    }
  }

  function closeEditor() {
    setEditing(null);
    setForm(emptyTemplate);
    setPreviewHtml('');
  }

  function handleSave() {
    if (!form.name.trim() || !form.template_type) return toast.error('Name and type are required');
    const data = { ...form, is_default: form.is_default ?? false };
    if (editing?.id) {
      updateMutation.mutate({ id: editing.id, data });
    } else {
      createMutation.mutate(data);
    }
  }

  function handleDelete(id?: number) {
    if (!id) return;
    if (window.confirm('Delete this template?')) removeMutation.mutate(id);
  }

  useEffect(() => {
    if (!editing) return;
    setPreviewLoading(true);
    previewMutation.mutate(debouncedForm);
  }, [debouncedForm, editing, previewMutation]);

  const statCards = useMemo(() => {
    const byType = (type: string) => templates.filter((t) => (t.template_type || t.type) === type).length;
    return [
      { label: 'Total Templates', value: templates.length, icon: LayoutTemplate },
      { label: 'Default', value: templates.filter((t) => t.is_default).length, icon: Star },
      { label: 'Invoice', value: byType('invoice'), icon: FileText, onClick: () => setTypeFilter('invoice') },
      { label: 'Quote', value: byType('quote'), icon: FileText, onClick: () => setTypeFilter('quote') },
      { label: 'Payslip', value: byType('payslip'), icon: FileText, onClick: () => setTypeFilter('payslip') },
      { label: 'Contract', value: byType('contract'), icon: FileText, onClick: () => setTypeFilter('contract') },
    ];
  }, [templates]);

  const previewUrl = useMemo(() => {
    if (!previewHtml) return '';
    const blob = new Blob([previewHtml], { type: 'text/html' });
    return URL.createObjectURL(blob);
  }, [previewHtml]);

  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  function insertVariable(variable: string) {
    const field = activeField;
    if (!['html', 'css', 'header', 'footer'].includes(field)) return;
    const current = (form[field] as string) || '';
    const el = document.getElementById(`pdf-${field}`) as HTMLTextAreaElement | null;
    if (el) {
      const start = el.selectionStart ?? current.length;
      const end = el.selectionEnd ?? current.length;
      const newValue = current.slice(0, start) + variable + current.slice(end);
      setForm((prev) => ({ ...prev, [field]: newValue }));
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
    } else {
      setForm((prev) => ({ ...prev, [field]: current + variable }));
    }
  }

  const fields = [
    { key: 'html' as const, label: 'Body HTML', rows: 12 },
    { key: 'css' as const, label: 'CSS', rows: 6 },
    { key: 'header' as const, label: 'Header HTML', rows: 4 },
    { key: 'footer' as const, label: 'Footer HTML', rows: 4 },
  ];

  return (
    <PageShell
      title="PDF Templates"
      icon={FileText}
      description="Design and preview invoice, quote, payslip and contract PDF templates"
      actions={
        <Button onClick={() => openEditor()}>
          <Plus className="mr-1 h-4 w-4" /> New Template
        </Button>
      }
    >
      <StatCards cards={statCards} />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-9"
          />
          {filter && (
            <button onClick={() => setFilter('')} className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All types</SelectItem>
            {TEMPLATE_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && <p className="text-sm text-destructive">Failed to load templates.</p>}

      <div className="nm-raised overflow-hidden rounded-xl">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border/50 hover:bg-transparent">
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Variables</TableHead>
              <TableHead>Default</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No templates found.</TableCell></TableRow>
            ) : (
              filtered.map((t) => (
                <TableRow key={t.id} className="border-b border-border/30">
                  <TableCell>
                    <div className="font-medium">{t.name}</div>
                    {t.description && <div className="text-xs text-muted-foreground">{t.description}</div>}
                  </TableCell>
                  <TableCell className="capitalize">{t.template_type || t.type || 'other'}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {PDF_TEMPLATE_VARIABLES.filter((v) => (t.html || '').includes(v.key) || (t.header || '').includes(v.key) || (t.footer || '').includes(v.key)).slice(0, 3).map((v) => (
                        <Badge key={v.key} variant="outline" className="text-[10px]"><Code className="h-3 w-3 mr-1" />{v.key.replace(/[{}]/g, '')}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>{t.is_default ? <Badge variant="default" className="gap-1"><Check className="h-3 w-3" /> Default</Badge> : <span className="text-muted-foreground text-sm">—</span>}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => { openEditor(t); setActiveField('html'); }} title="Edit / preview">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => cloneMutation.mutate(t.id)} disabled={cloneMutation.isPending} title="Duplicate">
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => defaultMutation.mutate(t.id)} disabled={defaultMutation.isPending} title="Set as default">
                        <Star className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(t.id)} disabled={removeMutation.isPending} title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editing || form.id !== 0} onOpenChange={(open) => { if (!open) closeEditor(); }}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden p-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>{editing ? 'Edit PDF Template' : 'New PDF Template'}</DialogTitle>
            <DialogDescription>Edit HTML/CSS and preview in real time using sample data.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 h-[75vh]">
            {/* Editor */}
            <div className="flex flex-col border-r border-border/50 overflow-hidden">
              <div className="p-4 space-y-3 overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Template Name</Label>
                    <Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="e.g. Modern Invoice" />
                  </div>
                  <div>
                    <Label>Type</Label>
                    <Select value={form.template_type} onValueChange={(v) => setForm((prev) => ({ ...prev, template_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TEMPLATE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Description</Label>
                  <Input value={form.description || ''} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Short description" />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="is-default"
                    type="checkbox"
                    checked={!!form.is_default}
                    onChange={(e) => setForm((prev) => ({ ...prev, is_default: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="is-default" className="font-normal">Use as default for this type</Label>
                </div>

                <div className="flex items-center gap-2 border-b border-border/50">
                  {fields.map((f) => (
                    <button
                      key={f.key}
                      onClick={() => setActiveField(f.key)}
                      className={cn(
                        'px-3 py-1.5 text-xs font-medium transition-colors',
                        activeField === f.key ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
                  {fields.map((f) => (
                    activeField === f.key && (
                      <Textarea
                        key={f.key}
                        id={`pdf-${f.key}`}
                        value={(form[f.key] as string) || ''}
                        onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                        rows={f.rows}
                        className="font-mono text-xs resize-none"
                        placeholder={`Enter ${f.label.toLowerCase()}...`}
                      />
                    )
                  ))}
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Click a variable to insert at cursor</Label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {PDF_TEMPLATE_VARIABLES.map((v) => (
                      <button
                        key={v.key}
                        onClick={() => insertVariable(v.key)}
                        className="inline-flex items-center px-2 py-1 text-[10px] rounded bg-muted hover:bg-primary/10 transition-colors"
                      >
                        <Code className="h-3 w-3 mr-1 text-primary" />{v.key}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <DialogFooter className="px-6 py-4 border-t border-border/50 mt-auto">
                <Button variant="outline" onClick={closeEditor}>Cancel</Button>
                <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
                  {(createMutation.isPending || updateMutation.isPending) && <RefreshCw className="mr-1 h-4 w-4 animate-spin" />}
                  Save Template
                </Button>
              </DialogFooter>
            </div>

            {/* Preview */}
            <div className="flex flex-col bg-muted/30">
              <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
                <span className="text-sm font-medium flex items-center gap-2"><Eye className="h-4 w-4" /> Preview</span>
                <Button variant="ghost" size="sm" onClick={() => { setPreviewLoading(true); previewMutation.mutate(form); }} disabled={previewLoading}>
                  <RefreshCw className={cn('h-4 w-4', previewLoading && 'animate-spin')} />
                </Button>
              </div>
              <div className="flex-1 p-4 overflow-hidden">
                {previewUrl ? (
                  <iframe
                    src={previewUrl}
                    title="PDF preview"
                    className="w-full h-full rounded-lg border border-border bg-white"
                    sandbox="allow-same-origin"
                  />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                    <FileText className="h-12 w-12 mb-3 opacity-50" />
                    <p className="text-sm">Save or edit to generate preview</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
