'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { ThemeToggle } from '@/components/admin/ThemeToggle';
import { PersonAvatar } from '@/components/design-system/PersonAvatar';
import { Logo } from '@/components/Logo';
import {
  LayoutDashboard, Users, Building2, Receipt, FolderKanban, Ticket,
  LogOut, Menu, X, User, Briefcase, Loader2,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { href: '/agent/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/agent/clients', label: 'Clients', icon: Users },
  { href: '/agent/companies', label: 'Companies', icon: Building2 },
  { href: '/agent/invoices', label: 'Invoices', icon: Receipt },
  { href: '/agent/projects', label: 'Projects', icon: FolderKanban },
  { href: '/agent/tickets', label: 'Tickets', icon: Ticket },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AgentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

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



  const Nav = ({ collapsed = false }: { collapsed?: boolean }) => (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-6 mt-4 px-3">
        {!collapsed && (
          <Link href="/agent/dashboard" className="flex items-center gap-2 px-2">
            <Logo width={36} height={36} />
            <span className="font-bold text-lg tracking-tight">ClickBit</span>
          </Link>
        )}
        {collapsed && (
          <div className="mx-auto">
            <Logo width={36} height={36} />
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto space-y-1 px-2 pb-2">
        {navItems.map((item) => {
          const ItemIcon = item.icon;
          const active = isActive(pathname || '', item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active
                  ? 'nm-inset-sm text-primary'
                  : 'text-muted-foreground hover:nm-raised-sm hover:text-foreground'
              }`}
            >
              <ItemIcon className="h-4 w-4" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="pt-3 border-t border-border/50 px-2">
        <button
          onClick={logout}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-destructive hover:nm-raised-sm transition-all ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen admin-surface overflow-hidden">
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/45 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 nm-raised lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } w-64`}
      >
        <div className="flex flex-col h-full p-3">
          <div className="flex lg:hidden justify-end pb-2">
            <button onClick={() => setMobileOpen(false)} className="p-2 text-muted-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>
          <Nav />
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="hidden lg:flex nm-raised m-2 mb-0 px-6 py-3 items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <Briefcase className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Agent Portal</h1>
            {user && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-sm text-muted-foreground capitalize">{user.role}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:nm-raised-sm transition-all">
              <PersonAvatar name={`${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.email || 'Agent'} avatar_url={user?.avatar} size="sm" />
              <span className="text-sm font-medium hidden xl:inline">
                {user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email : 'Agent'}
              </span>
            </div>
          </div>
        </header>

        <header className="lg:hidden nm-raised m-2 px-4 py-3 flex items-center justify-between flex-shrink-0">
          <button onClick={() => setMobileOpen(true)} className="p-2 text-muted-foreground">
            <Menu className="h-6 w-6" />
          </button>
          <span className="font-semibold">Agent Portal</span>
          <ThemeToggle />
        </header>

        <main className="flex-1 overflow-y-auto p-2 lg:p-4">{children}</main>
      </div>
    </div>
  );
}
