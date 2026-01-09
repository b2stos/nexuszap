/**
 * MessageBubble Component
 * 
 * Bolha de mensagem estilo WhatsApp Web com suporte a mídia
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
  RotateCcw,
  Download,
  Play
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
      return <Clock className={cn(iconClass, "text-muted-foreground/70")} />;
    case 'sent':
      return <Check className={cn(iconClass, "text-muted-foreground/70")} />;
    case 'delivered':
      return <CheckCheck className={cn(iconClass, "text-muted-foreground/70")} />;
    case 'read':
      return <CheckCheck className={cn(iconClass, "text-sky-400")} />;
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
  const { type, media_url, media_filename, media_mime_type, content } = message;
  
  if (type === 'image') {
    return (
      <div className="mb-1.5">
        {media_url ? (
          <a href={media_url} target="_blank" rel="noopener noreferrer">
            <img 
              src={media_url} 
              alt="Imagem" 
              className="max-w-[280px] rounded-lg object-cover hover:opacity-90 transition-opacity cursor-pointer"
              loading="lazy"
            />
          </a>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground p-3 bg-background/30 rounded-lg">
            <ImageIcon className="w-8 h-8" />
            <span className="text-sm">Imagem não disponível</span>
          </div>
        )}
        {content && (
          <p className="text-sm mt-1.5 whitespace-pre-wrap break-words">{content}</p>
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
        className="flex items-center gap-3 p-3 bg-background/30 rounded-lg hover:bg-background/50 transition-colors mb-1.5"
      >
        <div className="w-10 h-12 bg-primary/20 rounded flex items-center justify-center">
          <FileText className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {media_filename || 'Documento'}
          </p>
          <p className="text-xs text-muted-foreground">
            {media_mime_type?.split('/')[1]?.toUpperCase() || 'PDF'}
          </p>
        </div>
        <Download className="w-5 h-5 text-muted-foreground" />
      </a>
    );
  }
  
  if (type === 'video') {
    return (
      <div className="mb-1.5">
        {media_url ? (
          <div className="relative">
            <video 
              src={media_url}
              className="max-w-[280px] rounded-lg"
              controls
              preload="metadata"
            />
          </div>
        ) : (
          <div className="flex items-center gap-3 p-3 bg-background/30 rounded-lg">
            <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
              <Play className="w-6 h-6 text-primary ml-1" />
            </div>
            <span className="text-sm text-muted-foreground">Vídeo</span>
          </div>
        )}
      </div>
    );
  }
  
  if (type === 'audio') {
    return (
      <div className="mb-1.5">
        {media_url ? (
          <audio 
            src={media_url}
            controls
            className="max-w-[280px]"
            preload="metadata"
          />
        ) : (
          <div className="flex items-center gap-3 p-3 bg-background/30 rounded-lg">
            <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
              <Mic className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 h-1 bg-muted rounded-full" />
            <span className="text-xs text-muted-foreground">0:00</span>
          </div>
        )}
      </div>
    );
  }
  
  if (type === 'location') {
    return (
      <div className="flex items-center gap-2 p-3 bg-background/30 rounded-lg mb-1.5">
        <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
          <MapPin className="w-5 h-5 text-red-500" />
        </div>
        <div>
          <p className="text-sm font-medium">Localização</p>
          <p className="text-xs text-muted-foreground">Clique para ver no mapa</p>
        </div>
      </div>
    );
  }
  
  if (type === 'contact') {
    return (
      <div className="flex items-center gap-2 p-3 bg-background/30 rounded-lg mb-1.5">
        <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
          <User className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium">Contato compartilhado</p>
          <p className="text-xs text-muted-foreground">{content || 'Toque para ver'}</p>
        </div>
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
      <div className="text-5xl">🏷️</div>
    );
  }
  
  return null;
}

export function MessageBubble({ message, showDate, onRetry }: MessageBubbleProps) {
  const isInbound = message.direction === 'inbound';
  const isFailed = message.status === 'failed';
  const time = format(new Date(message.created_at), 'HH:mm', { locale: ptBR });
  const hasMedia = message.type !== 'text' && message.type !== 'template';
  
  return (
    <div className={cn(
      "flex mb-2",
      isInbound ? "justify-start" : "justify-end"
    )}>
      <div className="flex items-end gap-1.5 max-w-[80%]">
        {/* Retry button for failed outbound messages */}
        {!isInbound && isFailed && onRetry && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
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
            "rounded-lg shadow-sm overflow-hidden",
            hasMedia ? "p-1" : "px-3 py-2",
            isInbound 
              ? "bg-card border border-border rounded-bl-none" 
              : isFailed
                ? "bg-destructive/10 border border-destructive/30 text-foreground rounded-br-none"
                : "bg-[#005c4b] text-white rounded-br-none"
          )}
        >
          {/* Media content */}
          {hasMedia && <MediaContent message={message} />}
          
          {/* Text content for text-only messages */}
          {message.type === 'text' && message.content && (
            <p className="text-sm whitespace-pre-wrap break-words">
              {message.content}
            </p>
          )}
          
          {/* Template indicator */}
          {message.type === 'template' && (
            <div>
              {message.content && (
                <p className="text-sm whitespace-pre-wrap break-words">
                  {message.content}
                </p>
              )}
              <p className={cn(
                "text-xs mt-1",
                isInbound ? "text-muted-foreground" : "text-white/70"
              )}>
                📋 Template: {message.template_name}
              </p>
            </div>
          )}
          
          {/* Error message for failed */}
          {isFailed && message.error_detail && (
            <p className="text-xs text-destructive mt-1.5 flex items-center gap-1">
              <AlertCircle className="h-3 w-3 flex-shrink-0" />
              <span className="line-clamp-2">{message.error_detail}</span>
            </p>
          )}
          
          {/* Footer with time and status */}
          <div className={cn(
            "flex items-center justify-end gap-1 mt-1",
            hasMedia && "px-2 pb-1",
            isInbound 
              ? "text-muted-foreground" 
              : isFailed 
                ? "text-destructive" 
                : "text-white/70"
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
    dateText = format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  }
  
  return (
    <div className="flex items-center justify-center my-4">
      <span className="px-3 py-1 bg-muted/80 backdrop-blur-sm rounded-lg text-xs text-muted-foreground shadow-sm">
        {dateText}
      </span>
    </div>
  );
}
