/**
 * ContactPanel Component
 * 
 * Painel direito com informações do contato
 */

import { 
  Phone, 
  Clock, 
  Tag, 
  StickyNote, 
  User,
  CheckCircle2,
  XCircle,
  Calendar
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { InboxConversation, InboxContact, WindowStatus } from '@/types/inbox';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ContactPanelProps {
  conversation: InboxConversation | null;
  contact: InboxContact | null;
  windowStatus: WindowStatus;
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) {
    const ddd = digits.substring(2, 4);
    const rest = digits.substring(4);
    if (rest.length === 9) {
      return `+55 (${ddd}) ${rest.substring(0, 5)}-${rest.substring(5)}`;
    }
    return `+55 (${ddd}) ${rest.substring(0, 4)}-${rest.substring(4)}`;
  }
  return `+${digits}`;
}

function EmptyPanel() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-4">
      <User className="w-12 h-12 opacity-50 mb-2" />
      <p className="text-sm text-center">Selecione uma conversa para ver os detalhes do contato</p>
    </div>
  );
}

export function ContactPanel({ conversation, contact, windowStatus }: ContactPanelProps) {
  if (!conversation || !contact) {
    return (
      <div className="h-full bg-card border-l border-border">
        <EmptyPanel />
      </div>
    );
  }
  
  const displayName = contact.name || 'Sem nome';
  const lastInteraction = contact.last_interaction_at 
    ? formatDistanceToNow(new Date(contact.last_interaction_at), { 
        addSuffix: true, 
        locale: ptBR 
      })
    : 'Nunca';
  
  return (
    <div className="h-full bg-card border-l border-border flex flex-col">
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Contact Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
                  <span className="text-xl font-semibold text-primary">
                    {(contact.name?.[0] || contact.phone?.[0] || '?').toUpperCase()}
                  </span>
                </div>
                <div>
                  <CardTitle className="text-lg">{displayName}</CardTitle>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {formatPhone(contact.phone)}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>Última interação: {lastInteraction}</span>
              </div>
            </CardContent>
          </Card>
          
          {/* 24h Window Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Janela de 24h
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {windowStatus.isOpen ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <div>
                      <p className="font-medium text-green-600">Janela Aberta</p>
                      <p className="text-xs text-muted-foreground">
                        {windowStatus.remainingFormatted}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-orange-500" />
                    <div>
                      <p className="font-medium text-orange-600">Janela Fechada</p>
                      <p className="text-xs text-muted-foreground">
                        Apenas templates permitidos
                      </p>
                    </div>
                  </>
                )}
              </div>
              
              {windowStatus.closesAt && windowStatus.isOpen && (
                <p className="text-xs text-muted-foreground mt-2">
                  Fecha em: {format(windowStatus.closesAt, "dd/MM 'às' HH:mm", { locale: ptBR })}
                </p>
              )}
            </CardContent>
          </Card>
          
          {/* Conversation Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Conversa
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge variant={conversation.status === 'open' ? 'default' : 'secondary'}>
                  {conversation.status === 'open' ? 'Aberta' : 'Resolvida'}
                </Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Não lidas</span>
                <Badge variant="outline">{conversation.unread_count}</Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Fixada</span>
                <span>{conversation.is_pinned ? 'Sim' : 'Não'}</span>
              </div>
              {conversation.channel && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Canal</span>
                    <span className="text-right text-xs">{conversation.channel.name}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          
          {/* Tags Card - Placeholder */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Tag className="w-4 h-4" />
                Tags
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground italic">
                Tags serão implementadas em breve
              </p>
            </CardContent>
          </Card>
          
          {/* Notes Card - Placeholder */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <StickyNote className="w-4 h-4" />
                Notas Internas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground italic">
                Notas internas serão implementadas em breve
              </p>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}
