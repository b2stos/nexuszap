/**
 * ContactPanel Component
 * 
 * Painel direito com informações do contato estilo WhatsApp Web
 */

import { useState } from 'react';
import { 
  Phone, 
  Clock, 
  Tag, 
  StickyNote, 
  User,
  CheckCircle2,
  XCircle,
  Calendar,
  Mail,
  Shield,
  Ban,
  MessageSquare,
  Send,
  Plus,
  X,
  Save
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
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

// Tags component
function TagsSection() {
  const [tags, setTags] = useState<string[]>(['Lead', 'Interessado']);
  const [newTag, setNewTag] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  
  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
      setIsAdding(false);
    }
  };
  
  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Tag className="w-4 h-4" />
            Tags
          </span>
          {!isAdding && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsAdding(true)}>
              <Plus className="w-3 h-3" />
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs flex items-center gap-1">
              {tag}
              <button onClick={() => removeTag(tag)} className="ml-1 hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
          {tags.length === 0 && !isAdding && (
            <p className="text-xs text-muted-foreground">Nenhuma tag</p>
          )}
        </div>
        {isAdding && (
          <div className="flex items-center gap-1 mt-2">
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Nova tag..."
              className="h-7 text-xs"
              onKeyDown={(e) => e.key === 'Enter' && addTag()}
            />
            <Button size="sm" className="h-7 px-2" onClick={addTag}>
              <Plus className="w-3 h-3" />
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setIsAdding(false)}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Notes component
function NotesSection() {
  const [notes, setNotes] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <StickyNote className="w-4 h-4" />
            Notas Internas
          </span>
          {!isEditing && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsEditing(true)}>
              <Plus className="w-3 h-3" />
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Adicione observações sobre este contato..."
              className="min-h-[80px] text-sm"
            />
            <div className="flex justify-end gap-1">
              <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={() => setIsEditing(false)}>
                <Save className="w-3 h-3 mr-1" />
                Salvar
              </Button>
            </div>
          </div>
        ) : notes ? (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{notes}</p>
        ) : (
          <p className="text-xs text-muted-foreground italic">Clique em + para adicionar notas</p>
        )}
      </CardContent>
    </Card>
  );
}

// Quick actions
function QuickActions({ 
  conversationStatus,
  onResolve,
  onReopen,
  onBlock
}: {
  conversationStatus: string;
  onResolve?: () => void;
  onReopen?: () => void;
  onBlock?: () => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Shield className="w-4 h-4" />
          Ações Rápidas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {conversationStatus === 'open' ? (
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full justify-start"
            onClick={onResolve}
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Marcar como resolvida
          </Button>
        ) : (
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full justify-start"
            onClick={onReopen}
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Reabrir conversa
          </Button>
        )}
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full justify-start text-destructive hover:text-destructive"
          onClick={onBlock}
        >
          <Ban className="w-4 h-4 mr-2" />
          Bloquear contato
        </Button>
      </CardContent>
    </Card>
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
  
  // Determine conversation origin (placeholder - would come from actual data)
  const origin = conversation.channel?.name || 'Manual';
  
  return (
    <div className="h-full bg-card border-l border-border flex flex-col">
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {/* Contact Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                {/* Avatar */}
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center mb-3">
                  <span className="text-2xl font-semibold text-primary">
                    {(contact.name?.[0] || contact.phone?.[0] || '?').toUpperCase()}
                  </span>
                </div>
                
                {/* Name & Phone */}
                <h3 className="font-semibold text-lg">{displayName}</h3>
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                  <Phone className="w-3 h-3" />
                  {formatPhone(contact.phone)}
                </p>
                
                {/* Last interaction */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-3">
                  <Clock className="w-3 h-3" />
                  <span>Última interação: {lastInteraction}</span>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* 24h Window Card */}
          <Card className={windowStatus.isOpen ? 'border-green-500/30' : 'border-orange-500/30'}>
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
                      <p className="font-medium text-green-600 text-sm">Janela Aberta</p>
                      <p className="text-xs text-muted-foreground">
                        {windowStatus.remainingFormatted}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-orange-500" />
                    <div>
                      <p className="font-medium text-orange-600 text-sm">Janela Fechada</p>
                      <p className="text-xs text-muted-foreground">
                        Apenas templates permitidos
                      </p>
                    </div>
                  </>
                )}
              </div>
              
              {windowStatus.closesAt && windowStatus.isOpen && (
                <p className="text-xs text-muted-foreground mt-2 pl-7">
                  Fecha em: {format(windowStatus.closesAt, "dd/MM 'às' HH:mm", { locale: ptBR })}
                </p>
              )}
            </CardContent>
          </Card>
          
          {/* Conversation Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
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
                <span className="text-muted-foreground">Origem</span>
                <Badge variant="outline" className="font-normal">
                  <Send className="w-3 h-3 mr-1" />
                  {origin}
                </Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Não lidas</span>
                <Badge variant={conversation.unread_count > 0 ? 'default' : 'outline'}>
                  {conversation.unread_count}
                </Badge>
              </div>
              {conversation.is_pinned && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Fixada</span>
                    <span className="text-xs">Sim</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          
          {/* Tags */}
          <TagsSection />
          
          {/* Notes */}
          <NotesSection />
          
          {/* Quick Actions */}
          <QuickActions conversationStatus={conversation.status} />
        </div>
      </ScrollArea>
    </div>
  );
}
