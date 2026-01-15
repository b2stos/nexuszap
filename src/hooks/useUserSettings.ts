import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type Theme = 'light' | 'dark' | 'system';
export type AccentColor = 'cyan' | 'blue' | 'purple' | 'green' | 'orange' | 'red' | 'pink' | 'slate';

export interface UserSettings {
  id?: string;
  user_id?: string;
  theme: Theme;
  accent_color: AccentColor;
  dashboard_widgets: string[];
  notify_campaign_complete: boolean;
  notify_send_failure: boolean;
  notify_new_message: boolean;
  created_at?: string;
  updated_at?: string;
}

const DEFAULT_SETTINGS: UserSettings = {
  theme: 'system',
  accent_color: 'cyan',
  dashboard_widgets: ['onboarding', 'metrics', 'webhooks', 'campaigns'],
  notify_campaign_complete: true,
  notify_send_failure: true,
  notify_new_message: true,
};

export function useUserSettings() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Fetch settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsLoading(false);
          return;
        }
        
        setUserId(user.id);
        
        const { data, error } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (error) {
          console.error('Error fetching user settings:', error);
          setIsLoading(false);
          return;
        }
        
        if (data) {
          setSettings({
            ...data,
            theme: data.theme as Theme,
            accent_color: data.accent_color as AccentColor,
            dashboard_widgets: Array.isArray(data.dashboard_widgets) 
              ? data.dashboard_widgets as string[]
              : DEFAULT_SETTINGS.dashboard_widgets,
          });
        }
      } catch (err) {
        console.error('Error in fetchSettings:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchSettings();
  }, []);

  // Apply theme whenever settings change
  useEffect(() => {
    applyTheme(settings.theme);
    applyAccentColor(settings.accent_color);
  }, [settings.theme, settings.accent_color]);

  const applyTheme = (theme: Theme) => {
    const root = document.documentElement;
    
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    } else {
      root.classList.toggle('dark', theme === 'dark');
    }
  };

  const applyAccentColor = (color: AccentColor) => {
    const root = document.documentElement;
    
    // Define accent colors in HSL
    const accentColors: Record<AccentColor, { primary: string; accent: string }> = {
      cyan: { primary: '200 85% 45%', accent: '285 70% 50%' },
      blue: { primary: '220 85% 50%', accent: '260 70% 55%' },
      purple: { primary: '270 85% 55%', accent: '320 70% 50%' },
      green: { primary: '150 80% 40%', accent: '180 70% 45%' },
      orange: { primary: '25 90% 50%', accent: '45 85% 50%' },
      red: { primary: '0 85% 55%', accent: '340 80% 50%' },
      pink: { primary: '330 85% 55%', accent: '290 70% 55%' },
      slate: { primary: '220 15% 45%', accent: '220 20% 55%' },
    };

    const colors = accentColors[color] || accentColors.cyan;
    root.style.setProperty('--primary', colors.primary);
    root.style.setProperty('--accent', colors.accent);
    root.style.setProperty('--ring', colors.primary);
    root.style.setProperty('--sidebar-primary', colors.primary);
    root.style.setProperty('--sidebar-ring', colors.primary);
  };

  const updateSettings = useCallback(async (updates: Partial<UserSettings>) => {
    if (!userId) {
      toast.error('Usuário não autenticado');
      return false;
    }

    setIsSaving(true);
    
    try {
      const newSettings = { ...settings, ...updates };
      setSettings(newSettings);
      
      // Check if settings exist
      const { data: existing } = await supabase
        .from('user_settings')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
      
      const payload = {
        user_id: userId,
        theme: newSettings.theme,
        accent_color: newSettings.accent_color,
        dashboard_widgets: newSettings.dashboard_widgets,
        notify_campaign_complete: newSettings.notify_campaign_complete,
        notify_send_failure: newSettings.notify_send_failure,
        notify_new_message: newSettings.notify_new_message,
      };
      
      let error;
      if (existing) {
        const result = await supabase
          .from('user_settings')
          .update(payload)
          .eq('user_id', userId);
        error = result.error;
      } else {
        const result = await supabase
          .from('user_settings')
          .insert(payload);
        error = result.error;
      }
      
      if (error) {
        console.error('Error saving settings:', error);
        toast.error('Erro ao salvar configurações');
        return false;
      }
      
      toast.success('Configurações salvas');
      return true;
    } catch (err) {
      console.error('Error in updateSettings:', err);
      toast.error('Erro ao salvar configurações');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [userId, settings]);

  return {
    settings,
    isLoading,
    isSaving,
    updateSettings,
  };
}
