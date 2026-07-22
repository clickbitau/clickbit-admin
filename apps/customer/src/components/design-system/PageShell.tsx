import { LucideIcon } from 'lucide-react';

interface PageShellProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function PageShell({ title, description, icon: Icon, actions, children }: PageShellProps) {
  return (
    <div className="admin-page animate-fade-in">
        <div className="admin-header">
          <div className="flex items-center gap-4">
            {Icon && (
              <div className="nm-raised-sm w-11 h-11 flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-primary" />
              </div>
            )}
            <div>
              <h1 className="admin-title">{title}</h1>
              {description && <p className="admin-subtitle">{description}</p>}
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-3 flex-shrink-0">{actions}</div>}
        </div>
      {children}
    </div>
  );
}
