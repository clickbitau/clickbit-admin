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
  Sparkles,
  ArrowUp,
  ArrowDown,
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
  previewPdfTemplateWithData,
  previewPdfTemplateWithDataPdf,
  seedPdfTemplates,
} from '@/lib/api';

const TEMPLATE_TYPES = [
  { value: 'invoice', label: 'Invoice', icon: FileText, color: 'text-blue-600' },
  { value: 'estimate', label: 'Estimate', icon: FileText, color: 'text-emerald-600' },
  { value: 'payslip', label: 'Payslip', icon: FileText, color: 'text-amber-600' },
  { value: 'contract', label: 'Contract', icon: FileText, color: 'text-purple-600' },
];

const PDF_TEMPLATE_VARIABLES = [
  { key: '{{document_title}}', label: 'Document Title' },
  { key: '{{invoice_number}}', label: 'Invoice Number' },
  { key: '{{quote_number}}', label: 'Quote Number' },
  { key: '{{date}}', label: 'Date' },
  { key: '{{due_date}}', label: 'Due Date' },
  { key: '{{client_name}}', label: 'Client Name' },
  { key: '{{client_company}}', label: 'Client Company' },
  { key: '{{client_email}}', label: 'Client Email' },
  { key: '{{company_name}}', label: 'Company Name' },
  { key: '{{company_address}}', label: 'Company Address' },
  { key: '{{company_phone}}', label: 'Company Phone' },
  { key: '{{company_email}}', label: 'Company Email' },
  { key: '{{company_abn}}', label: 'Company ABN' },
  { key: '{{items}}', label: 'Line Items Table' },
  { key: '{{subtotal}}', label: 'Subtotal' },
  { key: '{{tax}}', label: 'Tax' },
  { key: '{{discount}}', label: 'Discount' },
  { key: '{{total}}', label: 'Total' },
  { key: '{{amount_due}}', label: 'Amount Due' },
  { key: '{{notes}}', label: 'Notes' },
  { key: '{{payment_terms}}', label: 'Payment Terms' },
  { key: '{{bank_account_name}}', label: 'Bank Account Name' },
  { key: '{{bank_bsb}}', label: 'Bank BSB' },
  { key: '{{bank_account_number}}', label: 'Bank Account Number' },
  { key: '{{employee_name}}', label: 'Employee Name' },
  { key: '{{position}}', label: 'Position' },
  { key: '{{employment_type}}', label: 'Employment Type' },
  { key: '{{tfn}}', label: 'TFN' },
  { key: '{{pay_date}}', label: 'Pay Date' },
  { key: '{{pay_frequency}}', label: 'Pay Frequency' },
  { key: '{{hourly_rate}}', label: 'Hourly Rate' },
  { key: '{{super_fund}}', label: 'Super Fund' },
  { key: '{{hours_worked}}', label: 'Hours Worked' },
  { key: '{{ordinary_hours_pay}}', label: 'Ordinary Hours Pay' },
  { key: '{{gross_pay}}', label: 'Gross Pay' },
  { key: '{{net_pay}}', label: 'Net Pay' },
  { key: '{{tax_deduction}}', label: 'Tax Deduction' },
  { key: '{{superannuation}}', label: 'Superannuation' },
  { key: '{{total_deductions}}', label: 'Total Deductions' },
  { key: '{{ytd_gross}}', label: 'YTD Gross' },
  { key: '{{ytd_tax}}', label: 'YTD Tax' },
  { key: '{{ytd_super}}', label: 'YTD Super' },
  { key: '{{ytd_net}}', label: 'YTD Net' },
  { key: '{{annual_leave_balance}}', label: 'Annual Leave Balance' },
  { key: '{{sick_leave_balance}}', label: 'Sick Leave Balance' },
  { key: '{{bank_name}}', label: 'Bank Name' },
  { key: '{{pay_period}}', label: 'Pay Period' },
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
  settings: {},
  is_default: false,
};

const DEFAULT_SECTION_ORDER = ['header', 'itemsTable', 'totals', 'paymentHistory', 'notesAndTerms', 'paymentGrid', 'statusStamp'];
const SECTION_LABELS: Record<string, string> = {
  header: 'Header',
  itemsTable: 'Items Table',
  totals: 'Totals',
  paymentHistory: 'Payment History',
  notesAndTerms: 'Notes & Terms',
  paymentGrid: 'Payment / Verification',
  statusStamp: 'Status Stamp',
};

function TemplateSettingsPanel({ form, setForm }: { form: PdfTemplate; setForm: (updater: (prev: PdfTemplate) => PdfTemplate) => void }) {
  const [json, setJson] = useState(() => JSON.stringify(form.settings || {}, null, 2));

  useEffect(() => {
    setJson(JSON.stringify(form.settings || {}, null, 2));
  }, [form.settings]);

  const settings = form.settings || {};
  const sectionOrder = Array.isArray(settings.sectionOrder) && settings.sectionOrder.length ? settings.sectionOrder : DEFAULT_SECTION_ORDER;
  const visibility = settings.visibility || {};
  const isInvoiceLike = (form.template_type || 'invoice') === 'invoice' || (form.template_type || 'invoice') === 'estimate';

  function updateSettings(next: any) {
    setForm((prev) => ({ ...prev, settings: next }));
  }

  function setSectionOrder(order: string[]) {
    updateSettings({ ...settings, sectionOrder: order });
  }

  function toggleSection(key: string) {
    updateSettings({ ...settings, visibility: { ...visibility, [key]: visibility[key] === false ? true : false } });
  }

  function moveSection(index: number, direction: -1 | 1) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= sectionOrder.length) return;
    const next = [...sectionOrder];
    [next[index], next[newIndex]] = [next[newIndex], next[index]];
    setSectionOrder(next);
  }

  function handleJsonBlur() {
    try {
      const parsed = JSON.parse(json);
      updateSettings(parsed);
    } catch (e) {
      toast.error('Invalid JSON in settings');
    }
  }

  return (
    <div className="space-y-4">
      {isInvoiceLike && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Section Order</Label>
          <p className="text-xs text-muted-foreground">Reorder sections and toggle visibility for the generated PDF.</p>
          <div className="space-y-1">
            {sectionOrder.map((key: string, i: number) => (
              <div key={key} className="flex items-center gap-2 nm-raised-sm px-2 py-1.5">
                <button onClick={() => moveSection(i, -1)} disabled={i === 0} className="p-1 hover:bg-muted rounded disabled:opacity-30"><ArrowUp className="h-3 w-3" /></button>
                <button onClick={() => moveSection(i, 1)} disabled={i === sectionOrder.length - 1} className="p-1 hover:bg-muted rounded disabled:opacity-30"><ArrowDown className="h-3 w-3" /></button>
                <span className="flex-1 text-xs">{SECTION_LABELS[key] || key}</span>
                <button
                  onClick={() => toggleSection(key)}
                  className={cn('text-xs px-2 py-0.5 rounded', visibility[key] === false ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary')}
                >
                  {visibility[key] === false ? 'Hidden' : 'Visible'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-sm font-medium">Settings JSON</Label>
        <p className="text-xs text-muted-foreground">Edit colors, labels and other PDF overrides. Use the Section Order controls above for invoice templates.</p>
        <Textarea
          value={json}
          onChange={(e) => setJson(e.target.value)}
          onBlur={handleJsonBlur}
          rows={10}
          className="font-mono text-xs resize-none"
          placeholder='{"colors":{"teal":"#1FBBD2"},"labels":{"header":"INVOICE"}}'
        />
      </div>
    </div>
  );
}

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
  const [previewTab, setPreviewTab] = useState<'html' | 'pdf'>('html');
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState('');
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);

  const debouncedForm = useDebounce(form, 600);

  const { data: templates = [], isLoading, error, refetch } = useQuery({
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

  const seedMutation = useMutation({
    mutationFn: () => seedPdfTemplates(token!),
    onSuccess: (res) => { refresh(); toast.success(res.message); },
    onError: (err: Error) => toast.error(err.message || 'Failed to seed templates'),
  });

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

  const previewPdfMutation = useMutation({
    mutationFn: (data: Partial<PdfTemplate>) => previewPdfTemplateWithDataPdf(token!, data),
    onSuccess: (blob) => {
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(URL.createObjectURL(blob));
      setPdfPreviewLoading(false);
    },
    onError: () => { setPdfPreviewLoading(false); toast.error('PDF preview failed'); },
  });

  function openEditor(template?: PdfTemplate) {
    const t = template ? { ...template } : { ...emptyTemplate, id: Date.now() };
    setForm({
      ...t,
      html: t.html ?? DEFAULT_HTML,
      css: t.css ?? DEFAULT_CSS,
      header: t.header ?? DEFAULT_HEADER,
      footer: t.footer ?? DEFAULT_FOOTER,
      settings: t.settings || {},
      template_type: t.template_type || t.type || 'invoice',
    });
    setEditing(template || null);
    setPreviewHtml('');
    setPdfPreviewUrl('');
    setActiveField('html');
    if (template && template.id) {
      setPreviewLoading(true);
      previewMutation.mutate(t);
    }
  }

  function closeEditor() {
    setEditing(null);
    setForm(emptyTemplate);
    setPreviewHtml('');
    setPdfPreviewUrl('');
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
    if (!editing && !form.id) return;
    setPreviewLoading(true);
    previewMutation.mutate(debouncedForm);
  }, [debouncedForm, editing, form.id, previewMutation]);

  const previewUrl = useMemo(() => {
    if (!previewHtml) return '';
    const blob = new Blob([previewHtml], { type: 'text/html' });
    return URL.createObjectURL(blob);
  }, [previewHtml]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    };
  }, [previewUrl, pdfPreviewUrl]);

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

  const statCards = useMemo(() => {
    const byType = (type: string) => templates.filter((t) => (t.template_type || t.type) === type).length;
    return [
      { label: 'Total Templates', value: templates.length, icon: LayoutTemplate },
      { label: 'Default', value: templates.filter((t) => t.is_default).length, icon: Star },
      { label: 'Invoice', value: byType('invoice'), icon: FileText, onClick: () => setTypeFilter('invoice') },
      { label: 'Estimate', value: byType('estimate'), icon: FileText, onClick: () => setTypeFilter('estimate') },
      { label: 'Payslip', value: byType('payslip'), icon: FileText, onClick: () => setTypeFilter('payslip') },
      { label: 'Contract', value: byType('contract'), icon: FileText, onClick: () => setTypeFilter('contract') },
    ];
  }, [templates]);

  const fields = [
    { key: 'html' as const, label: 'Body HTML', rows: 12 },
    { key: 'css' as const, label: 'CSS', rows: 6 },
    { key: 'header' as const, label: 'Header HTML', rows: 4 },
    { key: 'footer' as const, label: 'Footer HTML', rows: 4 },
    { key: 'settings' as const, label: 'PDF Settings', rows: 0 },
  ];

  const typeMeta = (type?: string) => TEMPLATE_TYPES.find((t) => t.value === (type || 'other')) ?? TEMPLATE_TYPES[TEMPLATE_TYPES.length - 1];

  const variablesUsed = (t: PdfTemplate) => PDF_TEMPLATE_VARIABLES.filter((v) =>
    (t.html || '').includes(v.key) || (t.header || '').includes(v.key) || (t.footer || '').includes(v.key)
  );

  return (
    <PageShell
      title="PDF Templates"
      icon={FileText}
      description="Design and preview invoice, quote, payslip and contract PDF templates"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending || isLoading}>
            <Sparkles className="mr-1 h-4 w-4" /> Load defaults
          </Button>
          <Button onClick={() => openEditor()}>
            <Plus className="mr-1 h-4 w-4" /> New Template
          </Button>
        </div>
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

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="nm-raised h-40 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="space-y-6">
          <div className="nm-raised p-8 text-center">
            <div className="mx-auto mb-3 w-12 h-12 rounded-full nm-inset-sm flex items-center justify-center">
              <LayoutTemplate className="w-5 h-5 text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-1">No PDF templates yet</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">Get started by loading the default invoice, estimate and payslip templates, or build your own.</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
                <Sparkles className="mr-1 h-4 w-4" /> Load default templates
              </Button>
              <Button variant="outline" onClick={() => openEditor()}>
                <Plus className="mr-1 h-4 w-4" /> New template
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {TEMPLATE_TYPES.slice(0, 4).map((type) => (
              <button
                key={type.value}
                onClick={() => {
                  setForm((prev) => ({ ...prev, template_type: type.value }));
                  openEditor();
                }}
                className="nm-raised-sm p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-[var(--nm-shadow-raised)]"
              >
                <type.icon className={cn('h-8 w-8 mb-3', type.color)} />
                <h3 className="font-semibold">{type.label}</h3>
                <p className="text-xs text-muted-foreground mt-1">Create a {type.label.toLowerCase()} template from scratch.</p>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((t) => {
            const meta = typeMeta(t.template_type || t.type);
            const vars = variablesUsed(t);
            return (
              <div
                key={t.id}
                className="nm-raised p-5 flex flex-col gap-3 transition-all hover:-translate-y-0.5 hover:shadow-[var(--nm-shadow-raised)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="nm-raised-sm w-10 h-10 flex items-center justify-center flex-shrink-0">
                      <meta.icon className={cn('h-5 w-5', meta.color)} />
                    </div>
                    <div>
                      <h3 className="font-semibold leading-tight">{t.name}</h3>
                      <p className="text-xs text-muted-foreground capitalize">{meta.label}</p>
                    </div>
                  </div>
                  {t.is_default ? (
                    <Badge variant="default" className="gap-1"><Check className="h-3 w-3" /> Default</Badge>
                  ) : (
                    <Badge variant="outline">Custom</Badge>
                  )}
                </div>

                {t.description && <p className="text-sm text-muted-foreground line-clamp-2">{t.description}</p>}

                <div className="flex flex-wrap gap-1.5">
                  {vars.slice(0, 4).map((v) => (
                    <Badge key={v.key} variant="secondary" className="text-[10px]"><Code className="h-3 w-3 mr-1" />{v.key.replace(/[{}]/g, '')}</Badge>
                  ))}
                  {vars.length > 4 && (
                    <Badge variant="secondary" className="text-[10px]">+{vars.length - 4}</Badge>
                  )}
                </div>

                <div className="flex items-center gap-1 mt-auto pt-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => { openEditor(t); setActiveField('html'); }}>
                    <Eye className="mr-1 h-4 w-4" /> Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => cloneMutation.mutate(t.id)} disabled={cloneMutation.isPending} title="Duplicate">
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => defaultMutation.mutate(t.id)} disabled={defaultMutation.isPending} title="Set as default">
                    <Star className={cn('h-4 w-4', t.is_default && 'fill-current text-primary')} />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(t.id)} disabled={removeMutation.isPending} title="Delete">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
                  {fields.map((f) => {
                    if (activeField !== f.key) return null;
                    if (f.key === 'settings') {
                      return <TemplateSettingsPanel key="settings" form={form} setForm={setForm} />;
                    }
                    return (
                      <Textarea
                        key={f.key}
                        id={`pdf-${f.key}`}
                        value={(form[f.key] as string) || ''}
                        onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                        rows={f.rows}
                        className="font-mono text-xs resize-none"
                        placeholder={`Enter ${f.label.toLowerCase()}...`}
                      />
                    );
                  })}
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Click a variable to insert at cursor</Label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {PDF_TEMPLATE_VARIABLES.map((v) => (
                      <button
                        key={v.key}
                        onClick={() => insertVariable(v.key)}
                        className="nm-raised-sm inline-flex items-center px-2 py-1 text-[10px] hover:-translate-y-0.5 transition-all"
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
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium flex items-center gap-2"><Eye className="h-4 w-4" /> Preview</span>
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={() => setPreviewTab('html')}
                      className={cn('px-2 py-1 text-xs rounded', previewTab === 'html' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
                    >HTML</button>
                    <button
                      onClick={() => {
                        setPreviewTab('pdf');
                        if (!pdfPreviewUrl) { setPdfPreviewLoading(true); previewPdfMutation.mutate(form); }
                      }}
                      className={cn('px-2 py-1 text-xs rounded', previewTab === 'pdf' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
                    >PDF</button>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => {
                  if (previewTab === 'html') { setPreviewLoading(true); previewMutation.mutate(form); }
                  else { setPdfPreviewLoading(true); previewPdfMutation.mutate(form); }
                }} disabled={previewLoading || pdfPreviewLoading}>
                  <RefreshCw className={cn('h-4 w-4', (previewLoading || pdfPreviewLoading) && 'animate-spin')} />
                </Button>
              </div>
              <div className="flex-1 p-4 overflow-hidden">
                {previewTab === 'html' && previewUrl ? (
                  <iframe
                    src={previewUrl}
                    title="HTML preview"
                    className="w-full h-full rounded-lg border border-border bg-white"
                    sandbox="allow-same-origin"
                  />
                ) : previewTab === 'pdf' && pdfPreviewUrl ? (
                  <iframe
                    src={pdfPreviewUrl}
                    title="PDF preview"
                    className="w-full h-full rounded-lg border border-border bg-white"
                  />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground nm-raised-sm m-4">
                    <FileText className="h-12 w-12 mb-3 opacity-50" />
                    <p className="text-sm">{previewTab === 'pdf' ? 'Click refresh to generate PDF preview' : 'Start editing to generate a preview'}</p>
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
