/**
 * MessageBubble Component
 * 
 * Bolha de mensagem estilo WhatsApp
 */

import { 
  Clock, 
  Check, 
  CheckCheck, 
  AlertCircle, 
  FileText, 
  Image as ImageIcon,
  Film,
  Mic,
  MapPin,
  User,
  RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { InboxMessage } from '@/types/inbox';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';

interface MessageBubbleProps {
  message: InboxMessage;
  showDate?: boolean;
  onRetry?: (message: InboxMessage) => void;
}

function StatusIcon({ status, errorDetail }: { status: string; errorDetail?: string | null }) {
  const iconClass = "w-3.5 h-3.5";
  
  switch (status) {
    case 'queued':
      return <Clock className={cn(iconClass, "text-muted-foreground")} />;
    case 'sent':
      return <Check className={cn(iconClass, "text-muted-foreground")} />;
    case 'delivered':
      return <CheckCheck className={cn(iconClass, "text-muted-foreground")} />;
    case 'read':
      return <CheckCheck className={cn(iconClass, "text-primary")} />;
    case 'failed':
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <AlertCircle className={cn(iconClass, "text-destructive")} />
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs">{errorDetail || 'Erro no envio'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    default:
      return null;
  }
}

function MediaContent({ message }: { message: InboxMessage }) {
  const { type, media_url, media_filename, media_mime_type } = message;
  
  if (type === 'image') {
    return (
      <div className="mb-1">
        {media_url ? (
          <img 
            src={media_url} 
            alt="Imagem" 
            className="max-w-[280px] rounded-lg object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground">
            <ImageIcon className="w-5 h-5" />
            <span className="text-sm">Imagem</span>
          </div>
        )}
      </div>
    );
  }
  
  if (type === 'document') {
    return (
      <a 
        href={media_url || '#'}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 p-2 bg-background/50 rounded-lg hover:bg-background/80 transition-colors mb-1"
      >
        <FileText className="w-8 h-8 text-primary" />
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">
            {media_filename || 'Documento'}
          </p>
          <p className="text-xs text-muted-foreground">
            {media_mime_type || 'application/pdf'}
          </p>
        </div>
      </a>
    );
  }
  
  if (type === 'video') {
    return (
      <div className="flex items-center gap-2 p-2 bg-background/50 rounded-lg mb-1">
        <Film className="w-6 h-6 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Vídeo</span>
      </div>
    );
  }
  
  if (type === 'audio') {
    return (
      <div className="flex items-center gap-2 p-2 bg-background/50 rounded-lg mb-1">
        <Mic className="w-6 h-6 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Áudio</span>
      </div>
    );
  }
  
  if (type === 'location') {
    return (
      <div className="flex items-center gap-2 p-2 bg-background/50 rounded-lg mb-1">
        <MapPin className="w-6 h-6 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Localização</span>
      </div>
    );
  }
  
  if (type === 'contact') {
    return (
      <div className="flex items-center gap-2 p-2 bg-background/50 rounded-lg mb-1">
        <User className="w-6 h-6 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Contato</span>
      </div>
    );
  }
  
  if (type === 'sticker') {
    return media_url ? (
      <img 
        src={media_url} 
        alt="Sticker" 
        className="w-32 h-32 object-contain"
        loading="lazy"
      />
    ) : (
      <div className="text-3xl">🏷️</div>
    );
  }
  
  return null;
}

export function MessageBubble({ message, showDate, onRetry }: MessageBubbleProps) {
  const isInbound = message.direction === 'inbound';
  const isFailed = message.status === 'failed';
  const time = format(new Date(message.created_at), 'HH:mm', { locale: ptBR });
  
  return (
    <div className={cn(
      "flex mb-1",
      isInbound ? "justify-start" : "justify-end"
    )}>
      <div className="flex items-end gap-2">
        {/* Retry button for failed outbound messages */}
        {!isInbound && isFailed && onRetry && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => onRetry(message)}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Reenviar mensagem</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        
        <div
          className={cn(
            "max-w-[70%] rounded-lg px-3 py-2 shadow-sm",
            isInbound 
              ? "bg-card border border-border rounded-tl-none" 
              : isFailed
                ? "bg-destructive/10 border border-destructive/30 text-foreground rounded-tr-none"
                : "bg-primary text-primary-foreground rounded-tr-none"
          )}
        >
          {/* Media content */}
          {message.type !== 'text' && <MediaContent message={message} />}
          
          {/* Text content */}
          {message.content && (
            <p className="text-sm whitespace-pre-wrap break-words">
              {message.content}
            </p>
          )}
          
          {/* Template indicator */}
          {message.type === 'template' && message.template_name && (
            <p className="text-xs opacity-70 mt-1">
              📋 Template: {message.template_name}
            </p>
          )}
          
          {/* Error message for failed */}
          {isFailed && message.error_detail && (
            <p className="text-xs text-destructive mt-1 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {message.error_detail}
            </p>
          )}
          
          {/* Footer with time and status */}
          <div className={cn(
            "flex items-center justify-end gap-1 mt-1",
            isInbound 
              ? "text-muted-foreground" 
              : isFailed 
                ? "text-destructive" 
                : "text-primary-foreground/70"
          )}>
            <span className="text-[10px]">{time}</span>
            {!isInbound && (
              <StatusIcon status={message.status} errorDetail={message.error_detail} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Date separator component
export function DateSeparator({ date }: { date: Date }) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  let dateText: string;
  
  if (date.toDateString() === today.toDateString()) {
    dateText = 'Hoje';
  } else if (date.toDateString() === yesterday.toDateString()) {
    dateText = 'Ontem';
  } else {
    dateText = format(date, "dd 'de' MMMM", { locale: ptBR });
  }
  
  return (
    <div className="flex items-center justify-center my-4">
      <span className="px-3 py-1 bg-muted rounded-full text-xs text-muted-foreground">
        {dateText}
      </span>
    </div>
  );
}
