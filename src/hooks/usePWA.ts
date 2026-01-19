import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

type Platform = 'ios' | 'android' | 'desktop' | 'unknown';

interface UsePWAReturn {
  isInstalled: boolean;
  isInstallable: boolean;
  isStandalone: boolean;
  platform: Platform;
  isIOS: boolean;
  isAndroid: boolean;
  promptInstall: () => Promise<boolean>;
  dismissPrompt: () => void;
  shouldShowPrompt: boolean;
}

const DISMISS_KEY = 'pwa-install-dismissed';
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

export function usePWA(): UsePWAReturn {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [platform, setPlatform] = useState<Platform>('unknown');
  const [isDismissed, setIsDismissed] = useState(false);

  // Detect platform
  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (/iphone|ipad|ipod/.test(userAgent)) {
      setPlatform('ios');
    } else if (/android/.test(userAgent)) {
      setPlatform('android');
    } else if (/windows|macintosh|linux/.test(userAgent)) {
      setPlatform('desktop');
    } else {
      setPlatform('unknown');
    }
  }, []);

  // Check if running in standalone mode
  useEffect(() => {
    const checkStandalone = () => {
      const standalone = 
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
        document.referrer.includes('android-app://');
      
      setIsStandalone(standalone);
      setIsInstalled(standalone);
    };

    checkStandalone();

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleChange = () => checkStandalone();
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Check dismiss status
  useEffect(() => {
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const dismissedTime = parseInt(dismissedAt, 10);
      if (Date.now() - dismissedTime < DISMISS_DURATION) {
        setIsDismissed(true);
      } else {
        localStorage.removeItem(DISMISS_KEY);
      }
    }
  }, []);

  // Listen for beforeinstallprompt event
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Listen for app installed event
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) {
      return false;
    }

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[PWA] Error prompting install:', error);
      return false;
    }
  }, [deferredPrompt]);

  const dismissPrompt = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setIsDismissed(true);
  }, []);

  const isInstallable = !!deferredPrompt || (platform === 'ios' && !isStandalone);
  const shouldShowPrompt = isInstallable && !isInstalled && !isDismissed;

  return {
    isInstalled,
    isInstallable,
    isStandalone,
    platform,
    isIOS: platform === 'ios',
    isAndroid: platform === 'android',
    promptInstall,
    dismissPrompt,
    shouldShowPrompt,
  };
}
