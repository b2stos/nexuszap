/**
 * FirstTimeTooltip Component
 * 
 * Tooltip para guiar usuários na primeira vez
 */

import { useState, useEffect } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface FirstTimeTooltipProps {
  id: string; // Unique ID to track if user has seen this tooltip
  children: React.ReactNode;
  title: string;
  description: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

export function FirstTimeTooltip({
  id,
  children,
  title,
  description,
  side = 'bottom',
}: FirstTimeTooltipProps) {
  const [open, setOpen] = useState(false);
  const storageKey = `tooltip_seen_${id}`;

  useEffect(() => {
    // Check if user has already seen this tooltip
    const hasSeen = localStorage.getItem(storageKey);
    if (!hasSeen) {
      // Small delay to let the page load
      const timer = setTimeout(() => setOpen(true), 500);
      return () => clearTimeout(timer);
    }
  }, [storageKey]);

  const handleDismiss = () => {
    localStorage.setItem(storageKey, 'true');
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent side={side} className="w-64 p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium text-sm">{title}</p>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 flex-shrink-0"
            onClick={handleDismiss}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
        <Button
          size="sm"
          className="w-full mt-3"
          onClick={handleDismiss}
        >
          Entendi
        </Button>
      </PopoverContent>
    </Popover>
  );
}
