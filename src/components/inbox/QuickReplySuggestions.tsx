/**
 * QuickReplySuggestions Component
 * 
 * Mostra sugestões de respostas rápidas ao digitar /
 */

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { QuickReply } from '@/hooks/useQuickReplies';

interface QuickReplySuggestionsProps {
  quickReplies: QuickReply[];
  searchText: string;
  onSelect: (reply: QuickReply) => void;
  visible: boolean;
}

export function QuickReplySuggestions({
  quickReplies,
  searchText,
  onSelect,
  visible,
}: QuickReplySuggestionsProps) {
  // Filter suggestions based on search text
  const suggestions = useMemo(() => {
    if (!searchText.startsWith('/')) return [];
    
    const query = searchText.slice(1).toLowerCase();
    
    if (!query) {
      // Show all if just "/"
      return quickReplies.slice(0, 5);
    }
    
    return quickReplies
      .filter(qr => 
        qr.shortcut.toLowerCase().includes(query) || 
        qr.title.toLowerCase().includes(query)
      )
      .slice(0, 5);
  }, [quickReplies, searchText]);
  
  if (!visible || suggestions.length === 0) return null;
  
  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 mx-3 bg-popover border border-border rounded-lg shadow-lg overflow-hidden z-10">
      <div className="p-2 border-b border-border bg-muted/50">
        <p className="text-xs text-muted-foreground">
          Respostas rápidas — pressione Tab ou clique para usar
        </p>
      </div>
      <div className="max-h-48 overflow-y-auto">
        {suggestions.map((reply, index) => (
          <button
            key={reply.id}
            onClick={() => onSelect(reply)}
            className={cn(
              "w-full text-left px-3 py-2 hover:bg-accent transition-colors",
              "flex flex-col gap-0.5",
              index === 0 && "bg-accent/50"
            )}
          >
            <div className="flex items-center gap-2">
              <code className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                {reply.shortcut}
              </code>
              <span className="text-sm font-medium">{reply.title}</span>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-1 pl-12">
              {reply.message}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
