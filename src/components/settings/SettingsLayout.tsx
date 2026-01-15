import { useState } from 'react';
import { cn } from '@/lib/utils';
import { 
  Palette, 
  LayoutDashboard, 
  Users, 
  Bell, 
  Plug, 
  Shield, 
  LifeBuoy,
  ChevronRight
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useTenantRole } from '@/hooks/useTenantRole';

export type SettingsSection = 
  | 'appearance' 
  | 'dashboard' 
  | 'team' 
  | 'notifications' 
  | 'integrations' 
  | 'security' 
  | 'support';

interface SettingsLayoutProps {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
  children: React.ReactNode;
}

const sections = [
  { id: 'appearance' as const, label: 'Aparência', icon: Palette, description: 'Tema e cores' },
  { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard, description: 'Widgets e layout' },
  { id: 'team' as const, label: 'Equipe', icon: Users, description: 'Usuários e permissões', adminOnly: true },
  { id: 'notifications' as const, label: 'Notificações', icon: Bell, description: 'Alertas e avisos' },
  { id: 'integrations' as const, label: 'Integrações', icon: Plug, description: 'Canais e status' },
  { id: 'security' as const, label: 'Segurança', icon: Shield, description: 'Senha e sessões' },
  { id: 'support' as const, label: 'Suporte', icon: LifeBuoy, description: 'Ajuda e diagnóstico' },
];

export function SettingsLayout({ activeSection, onSectionChange, children }: SettingsLayoutProps) {
  const { isOwner, isAdmin, isSuperAdmin } = useTenantRole();
  const canManageTeam = isOwner || isAdmin || isSuperAdmin;

  const visibleSections = sections.filter(s => !s.adminOnly || canManageTeam);

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-[600px]">
      {/* Sidebar Navigation */}
      <aside className="lg:w-64 shrink-0">
        <nav className="space-y-1">
          {visibleSections.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            
            return (
              <Button
                key={section.id}
                variant="ghost"
                className={cn(
                  'w-full justify-start gap-3 h-auto py-3 px-4',
                  isActive && 'bg-muted font-medium'
                )}
                onClick={() => onSectionChange(section.id)}
              >
                <Icon className={cn('h-5 w-5', isActive ? 'text-primary' : 'text-muted-foreground')} />
                <div className="flex-1 text-left">
                  <div className={cn('text-sm', isActive ? 'text-foreground' : 'text-foreground')}>
                    {section.label}
                  </div>
                  <div className="text-xs text-muted-foreground hidden sm:block">
                    {section.description}
                  </div>
                </div>
                <ChevronRight className={cn(
                  'h-4 w-4 text-muted-foreground transition-transform',
                  isActive && 'text-primary rotate-90'
                )} />
              </Button>
            );
          })}
        </nav>
      </aside>

      {/* Content Area */}
      <div className="flex-1 min-w-0">
        <ScrollArea className="h-full">
          {children}
        </ScrollArea>
      </div>
    </div>
  );
}
