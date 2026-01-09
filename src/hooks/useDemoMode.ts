/**
 * useDemoMode Hook
 * 
 * Controla o Demo Mode para visualização de dados fictícios no Inbox
 * Apenas Super Admins podem ativar/desativar
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isSuperAdminEmail } from '@/utils/superAdmin';

const DEMO_MODE_KEY = 'nexuszap_demo_mode';

export function useDemoMode() {
  const [isDemoMode, setIsDemoMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(DEMO_MODE_KEY) === 'true';
    }
    return false;
  });
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkSuperAdmin = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setIsSuperAdmin(isSuperAdminEmail(user?.email));
      } catch (error) {
        console.error('Error checking super admin:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkSuperAdmin();
  }, []);

  const toggleDemoMode = () => {
    const newValue = !isDemoMode;
    setIsDemoMode(newValue);
    localStorage.setItem(DEMO_MODE_KEY, String(newValue));
  };

  const enableDemoMode = () => {
    setIsDemoMode(true);
    localStorage.setItem(DEMO_MODE_KEY, 'true');
  };

  const disableDemoMode = () => {
    setIsDemoMode(false);
    localStorage.setItem(DEMO_MODE_KEY, 'false');
  };

  return {
    isDemoMode,
    isSuperAdmin,
    isLoading,
    toggleDemoMode,
    enableDemoMode,
    disableDemoMode,
    canUseDemoMode: isSuperAdmin,
  };
}
