import { useState } from 'react';
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useProtectedUser } from "@/components/auth/ProtectedRoute";
import { Loader2, Settings as SettingsIcon } from "lucide-react";
import { SettingsLayout, SettingsSection } from '@/components/settings/SettingsLayout';
import { AppearanceSettings } from '@/components/settings/AppearanceSettings';
import { DashboardSettings } from '@/components/settings/DashboardSettings';
import { TeamSettings } from '@/components/settings/TeamSettings';
import { NotificationsSettings } from '@/components/settings/NotificationsSettings';
import { IntegrationsSettings } from '@/components/settings/IntegrationsSettings';
import { SecuritySettings } from '@/components/settings/SecuritySettings';
import { SupportSettings } from '@/components/settings/SupportSettings';
import { useUserSettings } from '@/hooks/useUserSettings';

export default function Settings() {
  const user = useProtectedUser();
  const [activeSection, setActiveSection] = useState<SettingsSection>('appearance');
  const { settings, isLoading: isLoadingSettings, isSaving, updateSettings } = useUserSettings();

  if (!user) {
    return (
      <DashboardLayout user={null}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  const renderSection = () => {
    if (isLoadingSettings) {
      return (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }

    switch (activeSection) {
      case 'appearance':
        return <AppearanceSettings settings={settings} onUpdate={updateSettings} isSaving={isSaving} />;
      case 'dashboard':
        return <DashboardSettings settings={settings} onUpdate={updateSettings} isSaving={isSaving} />;
      case 'team':
        return <TeamSettings />;
      case 'notifications':
        return <NotificationsSettings settings={settings} onUpdate={updateSettings} isSaving={isSaving} />;
      case 'integrations':
        return <IntegrationsSettings />;
      case 'security':
        return <SecuritySettings />;
      case 'support':
        return <SupportSettings />;
      default:
        return null;
    }
  };

  return (
    <DashboardLayout user={user}>
      <div className="space-y-6 max-w-6xl">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <SettingsIcon className="h-8 w-8" />
            Configurações
          </h2>
          <p className="text-muted-foreground mt-2">
            Gerencie as configurações da sua conta e do workspace
          </p>
        </div>

        <SettingsLayout 
          activeSection={activeSection} 
          onSectionChange={setActiveSection}
        >
          {renderSection()}
        </SettingsLayout>
      </div>
    </DashboardLayout>
  );
}
