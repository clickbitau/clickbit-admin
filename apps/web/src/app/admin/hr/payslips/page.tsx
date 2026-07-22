'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Banknote,
  Calculator,
  Mail,
  ChevronRight,
  Download,
  Eye,
  FileText,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { PageShell } from '@/components/design-system/PageShell';
import { StatCards } from '@/components/design-system/StatCards';
import { PersonAvatar } from '@/components/design-system/PersonAvatar';
import { StatusBadge } from '@/components/design-system/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/components/auth/AuthProvider';
import { useDebounce } from '@/lib/useDebounce';
import { useRealtimeRefresh } from '@/lib/realtime';
import {
  bulkCreatePayslips,
  calculatePayslip,
  deletePayslip,
  fetchHrStats,
  fetchPayslipPdf,
  fetchPayslips,
  nextPayRun,
  resendPayslipEmail,
} from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Payslip, PayslipCalcResult } from '@/types/hr';

function currentFYYear(): string {
  const now = new Date();
  return now.getMonth() >= 6 ? String(now.getFullYear() + 1) : String(now.getFullYear());
}

function fyLabel(year: string): string {
  const y = parseInt(year, 10);
  return `FY ${y - 1}-${String(y).slice(2)}`;
}

function fyOptions(): string[] {
  const current = parseInt(currentFYYear(), 10);
  return Array.from({ length: 5 }, (_, i) => String(current - i));
}

const statusOptions = [
  { value: '', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'generated', label: 'Generated' },
  { value: 'pending', label: 'Pending' },
  { value: 'sent', label: 'Sent' },
  { value: 'paid', label: 'Paid' },
];

const sortOptions = [
  { value: 'payment_date', label: 'Payment date' },
  { value: 'employee', label: 'Employee' },
  { value: 'net_pay', label: 'Net pay' },
  { value: 'status', label: 'Status' },
];

export default function AdminHrPayslipsPage() {
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'history' | 'run'>('history');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [status, setStatus] = useState('');
  const [year, setYear] = useState(currentFYYear());
  const [sortBy, setSortBy] = useState('payment_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [expandedIds, setExpandedIds] = useState<number[]>([]);
  const [autoEmail, setAutoEmail] = useState(true);
  const [preview, setPreview] = useState<PayslipCalcResult[]>([]);
  const [summary, setSummary] = useState<{ total_payslips: number; total_employees: number; overdue: number } | null>(null);
  const [previewEdits, setPreviewEdits] = useState<Record<number, { manualHours: string; manualBonus: string; annualLeave: string; sickLeave: string }>>({});

  const params = useMemo(() => {
    const p: Record<string, string | number> = { limit: 100, page: 1 };
    if (status) p.status = status;
    if (year) p.year = year;
    if (debouncedSearch) p.search = debouncedSearch;
    return p;
  }, [status, year, debouncedSearch]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['payslips', token, params],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      return fetchPayslips(token, params);
    },
    enabled: !!token,
  });

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['hr-stats', token],
    queryFn: async () => { if (!token) throw new Error('No token'); return fetchHrStats(token); },
    enabled: !!token,
  });

  useRealtimeRefresh(['payslips'], ['payslips'], { enabled: !!token });

  const payslips = useMemo(() => data?.data ?? [], [data?.data]);
  const stats = statsData?.data;

  const sortedPayslips = useMemo(() => {
    const rows = [...payslips];
    rows.sort((a, b) => {
      const dir = sortOrder === 'asc' ? 1 : -1;
      if (sortBy === 'employee') {
        return (a.employee?.name || `Employee ${a.employee_id}`).localeCompare(b.employee?.name || `Employee ${b.employee_id}`) * dir;
      }
      if (sortBy === 'net_pay') {
        return ((Number(a.net_pay) || 0) - (Number(b.net_pay) || 0)) * dir;
      }
      if (sortBy === 'status') {
        return ((a.status || '').localeCompare(b.status || '')) * dir;
      }
      return (new Date(a.payment_date || 0).getTime() - new Date(b.payment_date || 0).getTime()) * dir;
    });
    return rows;
  }, [payslips, sortBy, sortOrder]);

  const groupedByEmployee = useMemo(() => {
    const groups: Record<number, { employee: Payslip['employee']; payslips: Payslip[] }> = {};
    for (const p of sortedPayslips) {
      if (!groups[p.employee_id]) {
        groups[p.employee_id] = { employee: p.employee, payslips: [] };
      }
      groups[p.employee_id].payslips.push(p);
    }
    return Object.entries(groups)
      .map(([empId, g]) => ({ empId: Number(empId), employee: g.employee, payslips: g.payslips }))
      .sort((a, b) => new Date(b.payslips[0].payment_date || 0).getTime() - new Date(a.payslips[0].payment_date || 0).getTime());
  }, [sortedPayslips]);

  const statsByCurrency = useMemo(() => {
    const result: Record<string, { netPaid: number; taxWithheld: number; count: number }> = {};
    for (const p of payslips) {
      const currency = p.currency || 'AUD';
      if (!result[currency]) result[currency] = { netPaid: 0, taxWithheld: 0, count: 0 };
      if (p.status === 'paid' || p.status === 'sent') {
        result[currency].netPaid += Number(p.net_pay) || 0;
        result[currency].taxWithheld += Number(p.tax_withheld) || 0;
      }
      result[currency].count++;
    }
    return result;
  }, [payslips]);

  const pendingCount = useMemo(() => payslips.filter((p) => ['pending', 'generated', 'draft'].includes(p.status || '')).length, [payslips]);

  const statCards = stats
    ? [
        { label: 'Total', value: stats.payslips.total, icon: FileText, onClick: () => { setStatus(''); } },
        { label: 'Generated', value: stats.payslips.generated, icon: FileText, accent: 'warning' as const, onClick: () => { setStatus('generated'); } },
        { label: 'Paid', value: stats.payslips.paid, icon: Banknote, accent: 'success' as const, onClick: () => { setStatus('paid'); } },
        { label: 'Sent', value: stats.payslips.sent, icon: Banknote, onClick: () => { setStatus('sent'); } },
      ]
    : [
        { label: 'Total', value: data?.pagination?.total ?? 0, icon: FileText },
        { label: 'Total Gross', value: formatCurrency(payslips.reduce((s, p) => s + (Number(p.gross_pay) || 0), 0)), icon: Banknote },
        { label: 'Total Net', value: formatCurrency(payslips.reduce((s, p) => s + (Number(p.net_pay) || 0), 0)), icon: Banknote, accent: 'success' as const },
        { label: 'Pending', value: pendingCount, icon: FileText, accent: 'warning' as const },
      ];

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['payslips', token] });
    queryClient.invalidateQueries({ queryKey: ['hr-stats', token] });
  };

  const downloadPdf = async (id: number, employeeName?: string, paymentDate?: string) => {
    if (!token) return;
    try {
      const blob = await fetchPayslipPdf(token, id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(employeeName || `payslip-${id}`).replace(/\s+/g, '')}_Payslip_${paymentDate || id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to download PDF');
    }
  };

  const resendMutation = useMutation({
    mutationFn: (id: number) => { if (!token) throw new Error('No token'); return resendPayslipEmail(token, id); },
    onSuccess: () => toast.success('Payslip email resent'),
    onError: () => toast.error('Failed to resend email'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => { if (!token) throw new Error('No token'); return deletePayslip(token, id); },
    onSuccess: () => { toast.success('Payslip deleted'); refresh(); },
    onError: () => toast.error('Failed to delete payslip'),
  });

  const nextPayRunMutation = useMutation({
    mutationFn: () => { if (!token) throw new Error('No token'); return nextPayRun(token); },
    onSuccess: (res) => {
      setPreview(res.data ?? []);
      setSummary(res.summary ?? null);
      const edits: typeof previewEdits = {};
      for (const p of res.data ?? []) {
        const base = (p.line_items as any[])?.find((li: any) => li.description?.includes('Base'));
        edits[p.employee_id] = {
          manualHours: base?.quantity?.toString() || '',
          manualBonus: '',
          annualLeave: (p.leave_data as any)?.annual?.toString() || '',
          sickLeave: (p.leave_data as any)?.sick?.toString() || '',
        };
      }
      setPreviewEdits(edits);
    },
    onError: () => toast.error('Failed to calculate next pay run'),
  });

  const recalcMutation = useMutation({
    mutationFn: async (p: PayslipCalcResult) => {
      if (!token) throw new Error('No token');
      const editsForEmp = previewEdits[p.employee_id] || { manualHours: '', manualBonus: '', annualLeave: '', sickLeave: '' };
      return calculatePayslip(token, {
        employeeId: p.employee_id,
        periodStart: p.pay_period_start,
        periodEnd: p.pay_period_end,
        paymentDate: p.payment_date,
        manualHours: parseFloat(editsForEmp.manualHours) || undefined,
        manualBonus: parseFloat(editsForEmp.manualBonus) || undefined,
        leaveTaken: {
          annual: parseFloat(editsForEmp.annualLeave) || 0,
          sick: parseFloat(editsForEmp.sickLeave) || 0,
        },
      });
    },
    onSuccess: (res, p) => {
      const updated = res.data;
      setPreview((prev) => prev.map((row) => (row.employee_id === p.employee_id ? { ...row, ...updated } : row)));
      toast.success('Recalculated');
    },
    onError: () => toast.error('Failed to recalculate'),
  });

  const generateMutation = useMutation({
    mutationFn: () => { if (!token) throw new Error('No token'); return bulkCreatePayslips(token, preview); },
    onSuccess: () => {
      toast.success(`Generated ${preview.length} payslips` + (autoEmail ? ' and queued emails' : ''));
      setPreview([]);
      setSummary(null);
      setTab('history');
      refresh();
    },
    onError: () => toast.error('Failed to generate payslips'),
  });

  const toggleExpanded = (empId: number) => {
    setExpandedIds((prev) => (prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]));
  };

  const employeeName = (e?: { name?: string } | null, id?: number) => e?.name || `Employee ${id}`;

  function updatePreviewEdit(empId: number, field: keyof typeof previewEdits[number], value: string) {
    setPreviewEdits((prev) => ({
      ...prev,
      [empId]: { ...(prev[empId] || { manualHours: '', manualBonus: '', annualLeave: '', sickLeave: '' }), [field]: value },
    }));
  }

  return (
    <PageShell
      title="Payslips"
      icon={Banknote}
      description="Calculate, review, and manage employee payslips."
    >
      <StatCards cards={statCards.map((s) => ({ ...s, value: statsLoading ? '...' : s.value }))} />

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'history' | 'run')} className="space-y-6">
        <TabsList className="nm-raised">
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="run">Run Payroll</TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="space-y-4">
          <div className="nm-raised p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={status} onValueChange={(v) => { setStatus(v); }}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>{statusOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={year} onValueChange={(v) => { setYear(v); }}>
                <SelectTrigger><SelectValue placeholder="FY" /></SelectTrigger>
                <SelectContent>
                  {fyOptions().map((y) => <SelectItem key={y} value={y}>{fyLabel(y)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v)}>
                <SelectTrigger><SelectValue placeholder="Sort by" /></SelectTrigger>
                <SelectContent>{sortOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))} className="flex-1">
                  {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                </Button>
                <Button onClick={() => setTab('run')}><Calculator className="mr-1 h-4 w-4" /> Run</Button>
              </div>
            </div>
          </div>

          <Card className="nm-raised overflow-hidden">
            <CardHeader className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-base">Payslip History</CardTitle>
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  {Object.entries(statsByCurrency).map(([currency, d]) => (
                    <div key={currency} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-muted-foreground">Net Paid ({currency})</span>
                      <span className="font-semibold">{formatCurrency(d.netPaid, currency)}</span>
                      <span className="text-xs text-muted-foreground">({d.count})</span>
                    </div>
                  ))}
                  {pendingCount > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      <span className="font-medium text-amber-600 dark:text-amber-400">{pendingCount} pending</span>
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <div className="divide-y">
              {error ? (
                <div className="p-6 text-destructive text-sm">Failed to load payslips.</div>
              ) : isLoading ? (
                <div className="p-12 text-center text-muted-foreground">Loading…</div>
              ) : groupedByEmployee.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p>No payslips found.</p>
                </div>
              ) : (
                groupedByEmployee.map(({ empId, employee, payslips: empPayslips }) => {
                  const latest = empPayslips[0];
                  const older = empPayslips.slice(1);
                  const expanded = expandedIds.includes(empId);
                  return (
                    <div key={empId}>
                      <div
                        className={`flex items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors ${expanded ? 'bg-muted/30' : ''}`}
                      >
                        <button
                          onClick={() => older.length > 0 && toggleExpanded(empId)}
                          disabled={older.length === 0}
                          className={`p-1 rounded ${older.length > 0 ? 'text-muted-foreground hover:text-foreground' : 'text-transparent cursor-default'}`}
                        >
                          <ChevronRight className={`h-4 w-4 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                        </button>
                        <div className="flex items-center gap-3 min-w-[160px]">
                          <PersonAvatar name={employeeName(employee, empId)} />
                          <div>
                            <div className="text-sm font-medium">{employeeName(employee, empId)}</div>
                            {older.length > 0 && <div className="text-[10px] text-muted-foreground">{empPayslips.length} payslips</div>}
                          </div>
                        </div>
                        <div className="flex-1 hidden md:flex items-center gap-6 text-sm text-muted-foreground">
                          <span>{formatDate(latest.pay_period_start)} – {formatDate(latest.pay_period_end)}</span>
                          <span className="font-medium text-foreground">{formatCurrency(Number(latest.net_pay), latest.currency)}</span>
                        </div>
                        <StatusBadge status={latest.status || 'generated'} />
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" onClick={() => router.push(`/admin/hr/payslips/${latest.id}`)} title="View"><Eye className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => downloadPdf(latest.id, employeeName(employee, empId), latest.payment_date)} title="Download"><Download className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => resendMutation.mutate(latest.id)} disabled={resendMutation.isPending} title="Resend"><Mail className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => window.confirm('Delete this payslip?') && removeMutation.mutate(latest.id)} disabled={removeMutation.isPending} title="Delete"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>

                      {expanded && older.map((ps) => (
                        <div key={ps.id} className="flex items-center gap-4 px-5 py-2.5 pl-14 bg-muted/30 border-t text-sm">
                          <div className="text-muted-foreground min-w-[130px]">{formatDate(ps.pay_period_start)} – {formatDate(ps.pay_period_end)}</div>
                          <div className="text-muted-foreground text-xs hidden md:block">{formatDate(ps.payment_date)}</div>
                          <div className="font-medium hidden lg:block">{formatCurrency(Number(ps.net_pay), ps.currency)}</div>
                          <StatusBadge status={ps.status || 'generated'} />
                          <div className="ml-auto flex items-center gap-1">
                            <Button size="sm" variant="ghost" onClick={() => router.push(`/admin/hr/payslips/${ps.id}`)} title="View"><Eye className="h-3.5 w-3.5" /></Button>
                            <Button size="sm" variant="ghost" onClick={() => downloadPdf(ps.id, employeeName(employee, empId), ps.payment_date)} title="Download"><Download className="h-3.5 w-3.5" /></Button>
                            <Button size="sm" variant="ghost" onClick={() => resendMutation.mutate(ps.id)} disabled={resendMutation.isPending} title="Resend"><Mail className="h-3.5 w-3.5" /></Button>
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => window.confirm('Delete this payslip?') && removeMutation.mutate(ps.id)} disabled={removeMutation.isPending} title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="run" className="space-y-4">
          {preview.length === 0 ? (
            <Card className="nm-raised p-12 text-center">
              <Calculator className="h-12 w-12 mx-auto mb-4 text-primary opacity-60" />
              <h3 className="text-lg font-semibold mb-2">Run Payroll</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                Calculate the next pay run based on approved timesheets and current employee settings. Review the preview before generating payslips.
              </p>
              <Button onClick={() => nextPayRunMutation.mutate()} disabled={nextPayRunMutation.isPending}>
                {nextPayRunMutation.isPending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
                Calculate Next Pay Run
              </Button>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="nm-raised p-4 text-center">
                  <p className="text-xs text-muted-foreground">Total Payslips</p>
                  <p className="text-2xl font-bold">{summary?.total_payslips ?? preview.length}</p>
                </Card>
                <Card className="nm-raised p-4 text-center">
                  <p className="text-xs text-muted-foreground">Employees</p>
                  <p className="text-2xl font-bold">{summary?.total_employees ?? preview.length}</p>
                </Card>
                <Card className="nm-raised p-4 text-center">
                  <p className="text-xs text-muted-foreground">Overdue</p>
                  <p className="text-2xl font-bold text-amber-600">{summary?.overdue ?? 0}</p>
                </Card>
              </div>

              <Card className="nm-raised overflow-hidden">
                <CardHeader className="p-4">
                  <CardTitle className="text-base">Pay Run Preview</CardTitle>
                </CardHeader>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium">Employee</th>
                        <th className="text-left px-4 py-2 font-medium">Period</th>
                        <th className="text-left px-4 py-2 font-medium">Hours</th>
                        <th className="text-left px-4 py-2 font-medium">Bonus</th>
                        <th className="text-left px-4 py-2 font-medium">Leave</th>
                        <th className="text-right px-4 py-2 font-medium">Gross</th>
                        <th className="text-right px-4 py-2 font-medium">Tax</th>
                        <th className="text-right px-4 py-2 font-medium">Super</th>
                        <th className="text-right px-4 py-2 font-medium">Net</th>
                        <th className="px-4 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {preview.map((p) => {
                        const edits = previewEdits[p.employee_id] || { manualHours: '', manualBonus: '', annualLeave: '', sickLeave: '' };
                        return (
                          <tr key={p.employee_id} className="hover:bg-muted/30">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <PersonAvatar name={p.employee_name || employeeName(p.employee, p.employee_id)} />
                                <span className="font-medium">{p.employee_name || employeeName(p.employee, p.employee_id)}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {formatDate(p.pay_period_start)} – {formatDate(p.pay_period_end)}
                            </td>
                            <td className="px-4 py-2">
                              <Input type="number" step="0.1" value={edits.manualHours} onChange={(e) => updatePreviewEdit(p.employee_id, 'manualHours', e.target.value)} className="w-24 h-8 text-sm" />
                            </td>
                            <td className="px-4 py-2">
                              <Input type="number" value={edits.manualBonus} onChange={(e) => updatePreviewEdit(p.employee_id, 'manualBonus', e.target.value)} className="w-24 h-8 text-sm" />
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex gap-2">
                                <Input type="number" placeholder="A" value={edits.annualLeave} onChange={(e) => updatePreviewEdit(p.employee_id, 'annualLeave', e.target.value)} className="w-16 h-8 text-sm" />
                                <Input type="number" placeholder="S" value={edits.sickLeave} onChange={(e) => updatePreviewEdit(p.employee_id, 'sickLeave', e.target.value)} className="w-16 h-8 text-sm" />
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-medium">{formatCurrency(Number(p.gross_pay), p.currency)}</td>
                            <td className="px-4 py-3 text-right text-muted-foreground">{formatCurrency(Number(p.tax_withheld), p.currency)}</td>
                            <td className="px-4 py-3 text-right text-muted-foreground">{formatCurrency(Number(p.superannuation), p.currency)}</td>
                            <td className="px-4 py-3 text-right font-bold">{formatCurrency(Number(p.net_pay), p.currency)}</td>
                            <td className="px-4 py-3">
                              <Button size="sm" variant="outline" onClick={() => recalcMutation.mutate(p)} disabled={recalcMutation.isPending}>
                                <RefreshCw className={`h-3.5 w-3.5 ${recalcMutation.isPending ? 'animate-spin' : ''}`} />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="p-4 border-t flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={autoEmail} onChange={(e) => setAutoEmail(e.target.checked)} className="rounded border-input" />
                    Send payslip emails automatically
                  </label>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => { setPreview([]); setSummary(null); }}>
                      <X className="mr-1 h-4 w-4" /> Cancel
                    </Button>
                    <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
                      <Calculator className="mr-1 h-4 w-4" /> Generate All
                    </Button>
                  </div>
                </div>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
