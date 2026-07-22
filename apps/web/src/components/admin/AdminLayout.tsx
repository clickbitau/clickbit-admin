'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/components/auth/AuthProvider';
import { ThemeToggle } from './ThemeToggle';
import { NotificationBell } from './NotificationBell';
import { Button } from '@/components/ui/button';
import { PersonAvatar } from '@/components/design-system/PersonAvatar';
import { Logo } from '@/components/Logo';
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
  BellDot,
  Calendar,
  Clock,
  FileClock,
  CreditCard,
  Receipt,
  ClipboardList,
  HandCoins,
  ListTodo,
  CheckSquare,
  Star,
  TrendingUp,
  BarChart3,
  BookOpen,
  Layers,
  ShoppingBag,
  UserCircle,
  Settings,
  Bug,
  Lock,
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
  Rocket,
} from 'lucide-react';

interface NavLink {
  href: string;
  label: string;
  icon: React.ElementType;
  roles?: string[];
}

interface NavSection {
  id: string;
  label: string;
  icon: React.ElementType;
  href?: string;
  flat?: boolean;
  roles?: string[];
  links: NavLink[];
}

const sections: NavSection[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: Home,
    flat: true,
    links: [{ href: '/admin', label: 'Dashboard', icon: Home }],
  },
  {
    id: 'tasks',
    label: 'Tasks',
    icon: CheckSquare,
    flat: true,
    roles: ['admin', 'manager'],
    links: [{ href: '/admin/tasks', label: 'All Tasks', icon: CheckSquare }],
  },
  {
    id: 'my-work',
    label: 'My Work',
    icon: Briefcase,
    roles: ['admin', 'manager', 'employee'],
    links: [
      { href: '/employee/tasks', label: 'My Tasks', icon: ListTodo },
      { href: '/employee/time-clock', label: 'Time Clock', icon: Clock },
      { href: '/employee/time-off', label: 'Time Off', icon: Calendar },
      { href: '/employee/contracts', label: 'My Contracts', icon: FileText },
      { href: '/employee/payslips', label: 'My Payslips', icon: Banknote },
      { href: '/employee/it-support', label: 'IT Support', icon: Ticket },
    ],
  },
  {
    id: 'crm',
    label: 'CRM',
    icon: HeartHandshake,
    roles: ['admin', 'manager'],
    links: [
      { href: '/admin/crm/pipeline', label: 'Sales Pipeline', icon: Kanban },
      { href: '/admin/crm/deals', label: 'Deals', icon: Target },
      { href: '/admin/crm/companies', label: 'Companies', icon: Building2 },
      { href: '/admin/crm/projects', label: 'Projects', icon: FolderKanban },
      { href: '/admin/crm/project-tasks', label: 'Project Tasks', icon: ListTodo },
      { href: '/admin/crm/leads', label: 'Contacts', icon: UserPlus },
      { href: '/admin/crm/customers', label: 'Customers', icon: Users },
      { href: '/admin/crm/agents', label: 'Agents', icon: Briefcase },
    ],
  },
  {
    id: 'hr',
    label: 'HR',
    icon: Users,
    roles: ['admin', 'manager'],
    links: [
      { href: '/admin/hr/employees', label: 'Employees', icon: Users },
      { href: '/admin/hr/timesheets', label: 'Timesheets', icon: FileClock },
      { href: '/admin/hr/payslips', label: 'Payslips', icon: Banknote },
      { href: '/admin/hr/contracts', label: 'Contracts', icon: FileText },
      { href: '/admin/hr/kpi', label: 'KPI', icon: BarChart3 },
      { href: '/admin/hr/time-off', label: 'Time Off Requests', icon: Calendar },
      { href: '/admin/hr/announcements', label: 'Announcements', icon: Megaphone },
      { href: '/admin/hr/reminders', label: 'Reminders', icon: Bell },
      { href: '/admin/hr/public-holidays', label: 'Public Holidays', icon: Clock },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: DollarSign,
    roles: ['admin', 'manager'],
    links: [
      { href: '/admin/finance/orders', label: 'Orders', icon: ShoppingBag },
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
    flat: true,
    roles: ['admin', 'manager'],
    links: [
      { href: '/admin/support', label: 'Tickets', icon: Ticket },
      { href: '/admin/support/automation', label: 'Automation', icon: TrendingUp },
    ],
  },
  {
    id: 'communication',
    label: 'Communication',
    icon: MessageSquare,
    roles: ['admin', 'manager'],
    links: [
      { href: '/admin/communication/chat', label: 'Chat', icon: MessageSquare },
      { href: '/admin/communication/mail', label: 'Mail', icon: FileText },
    ],
  },
  {
    id: 'content',
    label: 'Content',
    icon: FileText,
    roles: ['admin', 'manager'],
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
    roles: ['admin', 'manager'],
    href: '/admin/documents',
    links: [],
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: BellDot,
    href: '/admin/notifications',
    links: [],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: BarChart3,
    roles: ['admin', 'manager'],
    href: '/admin/analytics',
    links: [],
  },
  {
    id: 'bug-reports',
    label: 'Bug Reports',
    icon: Bug,
    roles: ['admin', 'manager'],
    href: '/admin/bug-reports',
    links: [],
  },
  {
    id: 'settings',
    label: 'Admin',
    icon: Settings,
    roles: ['admin', 'manager'],
    links: [
      { href: '/admin/settings/users', label: 'Users', icon: Users },
      { href: '/admin/settings/credentials', label: 'Credentials', icon: Lock },
      { href: '/admin/settings/audit-logs', label: 'Audit Logs', icon: Activity },
      { href: '/admin/settings/pdf-templates', label: 'PDF Templates', icon: FileText },
      { href: '/admin/settings/public-content', label: 'Public Content', icon: Globe },
      { href: '/admin/clickdeploy', label: 'ClickDeploy', icon: Rocket },
      { href: '/admin/settings/billing', label: 'Billing', icon: CreditCard },
      { href: '/admin/settings/profile', label: 'Profile', icon: UserCircle },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === '/admin') return pathname === '/admin' || pathname === '/admin/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function canSee(userRole: string | undefined, allowed?: string[]) {
  return !allowed || allowed.includes(userRole || '');
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('adminSidebarCollapsed') === 'true';
  });
  const [expanded, setExpanded] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('adminSidebarExpanded');
      if (saved) return saved;
    }
    const current = sections.find(
      (s) => s.links.some((l) => isActive(pathname || '', l.href)) || (s.href && isActive(pathname || '', s.href))
    );
    return current ? current.id : 'dashboard';
  });

  useEffect(() => {
    const current = sections.find(
      (s) => s.links.some((l) => isActive(pathname || '', l.href)) || (s.href && isActive(pathname || '', s.href))
    );
    if (current && current.id !== expanded) setExpanded(current.id);
  }, [pathname, expanded]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('adminSidebarCollapsed', String(collapsed));
    }
  }, [collapsed]);

  useEffect(() => {
    if (typeof window !== 'undefined' && expanded) {
      localStorage.setItem('adminSidebarExpanded', expanded);
    }
  }, [expanded]);

  const toggleSection = (id: string) => {
    setExpanded((prev) => (prev === id ? null : id));
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

  const userRole = user?.role;

  const Nav = ({ collapsedMode = false }: { collapsedMode?: boolean }) => {
    const [hovered, setHovered] = useState<string | null>(null);

    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-6 mt-4 px-2">
          {!collapsedMode && (
            <Link href="/admin" className="flex items-center gap-2 px-2">
              <Logo width={36} height={36} />
              <span className="font-bold text-lg tracking-tight">ClickBit</span>
            </Link>
          )}
          {collapsedMode && (
            <div className="mx-auto">
              <Logo width={36} height={36} />
            </div>
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

        <nav className="flex-1 overflow-y-auto overflow-x-visible space-y-1 px-2 pb-2">
          {sections.map((section) => {
            if (!canSee(userRole, section.roles)) return null;
            const visibleLinks = section.links.filter((l) => canSee(userRole, l.roles));
            const hasHref = section.href && canSee(userRole, section.roles);
            if (visibleLinks.length === 0 && !hasHref) return null;

            const SectionIcon = section.icon;
            const isExpanded = expanded === section.id;
            const hasActive = visibleLinks.some((l) => isActive(pathname || '', l.href)) || (hasHref && isActive(pathname || '', section.href!));
            const sectionHref = section.href || visibleLinks[0]?.href || '/admin';

            if (collapsedMode) {
              return (
                <div
                  key={section.id}
                  className="relative"
                  onMouseEnter={() => setHovered(section.id)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <Link
                    href={sectionHref}
                    className={`flex items-center justify-center p-2.5 rounded-xl transition-all ${
                      hasActive
                        ? 'nm-inset-sm text-primary'
                        : 'text-muted-foreground hover:nm-raised-sm hover:text-foreground'
                    }`}
                    title={section.label}
                  >
                    <SectionIcon className="h-5 w-5" />
                  </Link>
                  {hovered === section.id && visibleLinks.length > 0 && (
                    <AnimatePresence>
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="absolute left-full ml-2 top-0 nm-raised rounded-xl z-50 min-w-[200px] py-1 border border-border/50 bg-background"
                      >
                        <div className="px-3 py-2 border-b border-border/50 text-sm font-semibold flex items-center gap-2">
                          <SectionIcon className="h-4 w-4" /> {section.label}
                        </div>
                        {visibleLinks.map((link) => {
                          const LinkIcon = link.icon;
                          const active = isActive(pathname || '', link.href);
                          return (
                            <Link
                              key={link.href}
                              href={link.href}
                              onClick={() => { setMobileOpen(false); setHovered(null); }}
                              className={`flex items-center gap-2 px-3 py-2 text-sm ${
                                active ? 'nm-inset-sm text-primary' : 'text-muted-foreground hover:nm-raised-sm hover:text-foreground'
                              }`}
                            >
                              <LinkIcon className="h-4 w-4" /> {link.label}
                            </Link>
                          );
                        })}
                      </motion.div>
                    </AnimatePresence>
                  )}
                </div>
              );
            }

            if (section.flat) {
              return (
                <div key={section.id} className="space-y-0.5 mb-1">
                  {visibleLinks.length > 1 && (
                    <div className="px-3 pt-2 pb-0.5">
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                        {section.label}
                      </span>
                    </div>
                  )}
                  {visibleLinks.map((link) => {
                    const LinkIcon = link.icon;
                    const active = isActive(pathname || '', link.href);
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                          active
                            ? 'nm-inset-sm text-primary'
                            : 'text-foreground/80 hover:nm-raised-sm hover:text-foreground'
                        }`}
                      >
                        <LinkIcon className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{link.label}</span>
                      </Link>
                    );
                  })}
                </div>
              );
            }

            return (
              <div key={section.id} className="mb-1">
                <div
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                    hasActive
                      ? 'nm-inset-sm text-primary'
                      : 'text-foreground/80 hover:nm-raised-sm hover:text-foreground'
                  }`}
                >
                  <Link
                    href={sectionHref}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2.5 flex-1 min-w-0"
                  >
                    <SectionIcon className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{section.label}</span>
                  </Link>
                  {visibleLinks.length > 0 && (
                    <button
                      onClick={(e) => { e.preventDefault(); toggleSection(section.id); }}
                      className="ml-1 p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10"
                      aria-label={isExpanded ? 'Collapse section' : 'Expand section'}
                    >
                      {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </div>
                <AnimatePresence>
                  {isExpanded && visibleLinks.length > 0 && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="ml-3 mt-1 space-y-0.5 border-l-2 border-border/50 pl-3 overflow-hidden"
                    >
                      {visibleLinks.map((link) => {
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
  };

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
            <h1 className="text-lg font-semibold">
              {user?.role === 'manager' ? 'Manager Panel' : user?.role === 'admin' ? 'Admin Panel' : 'Admin Panel'}
            </h1>
            {user && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-sm text-muted-foreground capitalize">{user.role}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <ThemeToggle />
            <Link href="/admin/settings/profile" className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:nm-raised-sm transition-all">
              <PersonAvatar name={`${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.email || 'Admin'} avatar_url={user?.avatar} size="sm" />
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
          <span className="font-semibold">
            {user?.role === 'manager' ? 'Manager Panel' : user?.role === 'admin' ? 'Admin Panel' : 'Admin Panel'}
          </span>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <ThemeToggle />
            <Link href="/admin/settings/profile" className="p-2 text-muted-foreground hover:text-foreground">
              <UserCircle className="h-6 w-6" />
            </Link>
            <button onClick={logout} className="p-2 text-destructive" aria-label="Logout">
              <LogOut className="h-6 w-6" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-2 lg:p-4">{children}</main>
      </div>
    </div>
  );
}
