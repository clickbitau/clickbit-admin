'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/components/auth/AuthProvider';
import { ThemeToggle } from './ThemeToggle';
import { Button } from '@/components/ui/button';
import {
  Home,
  Banknote,
  Users,
  DollarSign,
  FileText,
  MessageSquare,
  Ticket,
  Building2,
  Kanban,
  Target,
  FolderKanban,
  UserPlus,
  Briefcase,
  Megaphone,
  Bell,
  Calendar,
  Clock,
  FileClock,
  CreditCard,
  Receipt,
  ClipboardList,
  HandCoins,
  Star,
  TrendingUp,
  BarChart3,
  BookOpen,
  Layers,
  UserCircle,
  Settings,
  Shield,
  Bug,
  Server,
  Lock,
  Rocket,
  Activity,
  Globe,
  Menu,
  X,
  LogOut,
  ChevronRight,
  Loader2,
  ChevronLeft,
  ChevronDown,
  HeartHandshake,
} from 'lucide-react';

interface NavLink {
  href: string;
  label: string;
  icon: React.ElementType;
}

interface NavSection {
  id: string;
  label: string;
  icon: React.ElementType;
  href?: string;
  links: NavLink[];
}

const sections: NavSection[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: Home,
    href: '/admin',
    links: [],
  },
  {
    id: 'crm',
    label: 'CRM',
    icon: HeartHandshake,
    links: [
      { href: '/admin/crm/pipeline', label: 'Sales Pipeline', icon: Kanban },
      { href: '/admin/crm/deals', label: 'Deals', icon: Target },
      { href: '/admin/crm/companies', label: 'Companies', icon: Building2 },
      { href: '/admin/crm/projects', label: 'Projects', icon: FolderKanban },
      { href: '/admin/crm/leads', label: 'Contacts', icon: UserPlus },
      { href: '/admin/crm/customers', label: 'Customers', icon: Users },
      { href: '/admin/crm/agents', label: 'Agents', icon: Briefcase },
    ],
  },
  {
    id: 'hr',
    label: 'HR',
    icon: Users,
    links: [
      { href: '/admin/hr/employees', label: 'Employees', icon: Users },
      { href: '/admin/hr/time-clock', label: 'Time Clock', icon: Clock },
      { href: '/admin/hr/timesheets', label: 'Timesheets', icon: FileClock },
      { href: '/admin/hr/shifts', label: 'Shifts', icon: Calendar },
      { href: '/admin/hr/payslips', label: 'Payslips', icon: Banknote },
      { href: '/admin/hr/contracts', label: 'Contracts', icon: FileText },
      { href: '/admin/hr/kpi', label: 'KPI', icon: BarChart3 },
      { href: '/admin/hr/time-off', label: 'Time Off', icon: Megaphone },
      { href: '/admin/hr/announcements', label: 'Announcements', icon: Megaphone },
      { href: '/admin/hr/reminders', label: 'Reminders', icon: Bell },
      { href: '/admin/hr/public-holidays', label: 'Public Holidays', icon: Clock },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: DollarSign,
    links: [
      { href: '/admin/finance/invoices', label: 'Invoices', icon: Receipt },
      { href: '/admin/finance/payments', label: 'Payments', icon: CreditCard },
      { href: '/admin/finance/expenses', label: 'Expenses', icon: ClipboardList },
      { href: '/admin/finance/staff-advances', label: 'Staff Advances', icon: HandCoins },
    ],
  },
  {
    id: 'support',
    label: 'Support',
    icon: Ticket,
    href: '/admin/support',
    links: [
      { href: '/admin/support', label: 'Tickets', icon: Ticket },
      { href: '/admin/support/automation', label: 'Automation', icon: TrendingUp },
    ],
  },
  {
    id: 'communication',
    label: 'Communication',
    icon: MessageSquare,
    href: '/admin/communication/chat',
    links: [
      { href: '/admin/communication/chat', label: 'Chat', icon: MessageSquare },
      { href: '/admin/communication/mail', label: 'Mail', icon: FileText },
    ],
  },
  {
    id: 'content',
    label: 'Content',
    icon: FileText,
    href: '/admin/content',
    links: [
      { href: '/admin/content/services', label: 'Services', icon: Layers },
      { href: '/admin/content/team', label: 'Team', icon: UserCircle },
      { href: '/admin/content/portfolio', label: 'Portfolio', icon: Briefcase },
      { href: '/admin/content/reviews', label: 'Reviews', icon: Star },
      { href: '/admin/content/blog', label: 'Blog', icon: BookOpen },
      { href: '/admin/content/marketing', label: 'Marketing', icon: TrendingUp },
    ],
  },
  {
    id: 'documents',
    label: 'Documents',
    icon: FileText,
    href: '/admin/documents',
    links: [],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: BarChart3,
    href: '/admin/analytics',
    links: [],
  },
  {
    id: 'bug-reports',
    label: 'Bug Reports',
    icon: Bug,
    href: '/admin/bug-reports',
    links: [],
  },
  {
    id: 'settings',
    label: 'Admin',
    icon: Settings,
    href: '/admin/settings',
    links: [
      { href: '/admin/settings/users', label: 'Users', icon: Users },
      { href: '/admin/settings/audit-logs', label: 'Audit Logs', icon: Activity },
      { href: '/admin/settings/dashboard', label: 'Dashboard', icon: BarChart3 },
      { href: '/admin/settings/pdf-templates', label: 'PDF Templates', icon: FileText },
      { href: '/admin/settings/public-content', label: 'Public Content', icon: Globe },
      { href: '/admin/settings/billing', label: 'Billing', icon: CreditCard },
      { href: '/admin/settings/profile', label: 'Profile', icon: UserCircle },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === '/admin') return pathname === '/admin' || pathname === '/admin/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState<string[]>(() => {
    const initial = sections
      .filter((s) => s.links.some((l) => isActive(pathname || '', l.href)))
      .map((s) => s.id);
    return initial.length ? initial : ['dashboard'];
  });

  useEffect(() => {
    const current = sections.find(
      (s) => s.links.some((l) => isActive(pathname || '', l.href)) || (s.href && isActive(pathname || '', s.href))
    );
    if (current && !expanded.includes(current.id)) {
      setExpanded((prev) => [...prev, current.id]);
    }
  }, [pathname]);

  const toggleSection = (id: string) => {
    setExpanded((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center admin-surface">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const initials = `${user?.first_name?.[0] ?? ''}${user?.last_name?.[0] ?? ''}`;

  const Nav = ({ collapsedMode = false }: { collapsedMode?: boolean }) => (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-6 mt-4 px-2">
        {!collapsedMode && (
          <Link href="/admin" className="flex items-center gap-2 px-2">
            <div className="nm-raised-sm w-9 h-9 flex items-center justify-center text-primary font-bold">C</div>
            <span className="font-bold text-lg tracking-tight">ClickBit</span>
          </Link>
        )}
        {collapsedMode && (
          <div className="mx-auto nm-raised-sm w-9 h-9 flex items-center justify-center text-primary font-bold">C</div>
        )}
        {!collapsedMode && (
          <button
            onClick={() => setCollapsed(true)}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors hidden lg:block"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto space-y-1 px-2 pb-2">
        {sections.map((section) => {
          const SectionIcon = section.icon;
          const isExpanded = expanded.includes(section.id);
          const hasActive = section.links.some((l) => isActive(pathname || '', l.href)) || (section.href && isActive(pathname || '', section.href));

          if (collapsedMode) {
            return (
              <div key={section.id} className="relative group">
                <Link
                  href={section.links[0]?.href || section.href || '/admin'}
                  className={`flex items-center justify-center p-2.5 rounded-xl transition-all ${
                    hasActive
                      ? 'nm-inset-sm text-primary'
                      : 'text-muted-foreground hover:nm-raised-sm hover:text-foreground'
                  }`}
                >
                  <SectionIcon className="h-5 w-5" />
                </Link>
              </div>
            );
          }

          return (
            <div key={section.id} className="mb-1">
              <button
                onClick={() => toggleSection(section.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                  hasActive
                    ? 'nm-inset-sm text-primary'
                    : 'text-foreground/80 hover:nm-raised-sm hover:text-foreground'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <SectionIcon className="h-4 w-4" />
                  <span>{section.label}</span>
                </div>
                {section.links.length > 0 && (
                  isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>
              <AnimatePresence>
                {isExpanded && section.links.length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="ml-3 mt-1 space-y-0.5 border-l-2 border-border/50 pl-3 overflow-hidden"
                  >
                    {section.links.map((link) => {
                      const LinkIcon = link.icon;
                      const active = isActive(pathname || '', link.href);
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => setMobileOpen(false)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all ${
                            active
                              ? 'nm-inset-sm text-primary'
                              : 'text-muted-foreground hover:nm-raised-sm hover:text-foreground'
                          }`}
                        >
                          <LinkIcon className="h-3.5 w-3.5" />
                          <span className="truncate">{link.label}</span>
                        </Link>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>

      <div className="pt-3 border-t border-border/50 px-2">
        {collapsedMode ? (
          <button
            onClick={() => setCollapsed(false)}
            className="w-full flex items-center justify-center p-2.5 rounded-xl text-muted-foreground hover:nm-raised-sm transition-colors"
            aria-label="Expand sidebar"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        ) : (
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-destructive hover:nm-raised-sm transition-all"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen admin-surface overflow-hidden">
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/45 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 nm-raised lg:relative lg:translate-x-0 transition-all duration-300 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'lg:w-[72px]' : 'lg:w-64'} ${collapsed ? 'w-[72px]' : 'w-64'}`}
      >
        <div className="flex flex-col h-full p-3">
          <div className="flex lg:hidden justify-end pb-2">
            <button onClick={() => setMobileOpen(false)} className="p-2 text-muted-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>
          <Nav collapsedMode={collapsed} />
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="hidden lg:flex nm-raised m-2 mb-0 px-6 py-3 items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold">{user?.role === 'employee' ? 'Employee Portal' : 'Admin Panel'}</h1>
            {user && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-sm text-muted-foreground capitalize">{user.role}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/admin/settings/profile" className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:nm-raised-sm transition-all">
              {user?.avatar ? (
                <img src={user.avatar} alt="" className="w-8 h-8 rounded-full object-cover border border-border" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground text-xs font-bold">
                  {initials || 'A'}
                </div>
              )}
              <span className="text-sm font-medium hidden xl:inline">{user?.first_name || 'Admin'}</span>
            </Link>
            <Button variant="ghost" size="sm" onClick={logout} className="text-destructive hidden xl:flex">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </header>

        <header className="lg:hidden nm-raised m-2 px-4 py-3 flex items-center justify-between flex-shrink-0">
          <button onClick={() => setMobileOpen(true)} className="p-2 text-muted-foreground">
            <Menu className="h-6 w-6" />
          </button>
          <span className="font-semibold">{user?.role === 'employee' ? 'Employee Portal' : 'Admin Panel'}</span>
          <ThemeToggle />
        </header>

        <main className="flex-1 overflow-y-auto p-2 lg:p-4">{children}</main>
      </div>
    </div>
  );
}
