/**
 * Inbox Page
 * 
 * Página principal do Inbox estilo WhatsApp Web com 3 colunas
 * PRODUCTION: Apenas dados reais do banco
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Loader2, 
  Building2, 
  ArrowLeft, 
  MoreVertical,
  CheckCircle2,
  MessageCircle,
  Pin,
  PinOff,
  Trash2,
  Ban,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { ConversationList } from '@/components/inbox/ConversationList';
import { ChatWindow } from '@/components/inbox/ChatWindow';
import { ContactPanel } from '@/components/inbox/ContactPanel';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import {
  useCurrentTenant,
  useConversations,
  useMessages,
  useContact,
  useMarkAsRead,
  useInboxRealtime,
  calculate24hWindow,
} from '@/hooks/useInbox';
import { 
  useDeleteConversation, 
  useResolveConversation, 
  useReopenConversation,
  useTogglePinConversation,
} from '@/hooks/useConversationActions';
import { InboxConversation, ConversationFilter } from '@/types/inbox';
import { useOnboarding } from '@/hooks/useOnboarding';

// Track inbox_opened onboarding step
function useTrackInboxOpened() {
  const { state, completeStep } = useOnboarding();
  
  useEffect(() => {
    // Mark inbox_opened step when entering the inbox
    if (state && !state.inbox_opened_at) {
      completeStep('inbox_opened');
    }
  }, [state?.inbox_opened_at]);
}

export default function Inbox() {
  const navigate = useNavigate();
  
  // State
  const [user, setUser] = useState<User | null>(null);
  const [activeConversation, setActiveConversation] = useState<InboxConversation | null>(null);
  const [filter, setFilter] = useState<ConversationFilter>({
    search: '',
    unreadOnly: false,
    status: 'all',
  });
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  // Track onboarding step
  useTrackInboxOpened();
  
  // Get user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);
  
  // Queries - ALWAYS use real data
  const { data: tenantData, isLoading: tenantLoading, error: tenantError } = useCurrentTenant();
  const tenantId = tenantData?.tenantId;
  
  const { 
    data: conversations = [], 
    isLoading: conversationsLoading 
  } = useConversations(tenantId, filter);
  
  const { 
    data: messages = [], 
    isLoading: messagesLoading 
  } = useMessages(activeConversation?.id);
  
  const { 
    data: contact 
  } = useContact(activeConversation?.contact_id);
  
  const markAsRead = useMarkAsRead();
  const deleteConversation = useDeleteConversation();
  const resolveConversation = useResolveConversation();
  const reopenConversation = useReopenConversation();
  const togglePinConversation = useTogglePinConversation();
  
  // Realtime - ALWAYS enabled for production
  useInboxRealtime(
    tenantId,
    activeConversation?.id,
    useCallback(() => {
      // Could play notification sound here
    }, []),
    useCallback(() => {
      // Refresh conversations
    }, [])
  );
  
  // Auto-select first conversation
  useEffect(() => {
    if (conversations.length > 0 && !activeConversation) {
      setActiveConversation(conversations[0]);
    }
  }, [conversations, activeConversation]);
  
  // Mark as read when conversation is selected
  useEffect(() => {
    if (activeConversation && activeConversation.unread_count > 0) {
      markAsRead.mutate(activeConversation.id);
      // Update local state
      setActiveConversation(prev => prev ? { ...prev, unread_count: 0 } : null);
    }
  }, [activeConversation?.id]);
  
  // Calculate 24h window
  const windowStatus = calculate24hWindow(activeConversation?.last_inbound_at || null);
  
  // Handle conversation selection
  const handleSelectConversation = (conv: InboxConversation) => {
    setActiveConversation(conv);
    setShowMobileChat(true);
  };
  
  // Handle back on mobile
  const handleMobileBack = () => {
    setShowMobileChat(false);
  };
  
  // Handle delete conversation
  const handleDeleteConversation = () => {
    if (!activeConversation) return;
    
    deleteConversation.mutate({ conversationId: activeConversation.id }, {
      onSuccess: () => {
        // Clear active conversation and go back to list
        setActiveConversation(null);
        setShowMobileChat(false);
        setShowDeleteDialog(false);
      },
    });
  };
  
  // Handle resolve/reopen
  const handleResolve = () => {
    if (activeConversation) {
      resolveConversation.mutate(activeConversation.id);
    }
  };
  
  const handleReopen = () => {
    if (activeConversation) {
      reopenConversation.mutate(activeConversation.id);
    }
  };
  
  // Handle pin/unpin
  const handleTogglePin = () => {
    if (activeConversation) {
      togglePinConversation.mutate({
        conversationId: activeConversation.id,
        isPinned: !activeConversation.is_pinned,
      });
    }
  };
  
  // Loading state
  if (tenantLoading) {
    return (
      <DashboardLayout user={user}>
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Carregando inbox...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }
  
  // No tenant state
  if (tenantError || !tenantId) {
    return (
      <DashboardLayout user={user}>
        <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] p-4">
          <Building2 className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Nenhuma organização encontrada</h2>
          <p className="text-muted-foreground text-center mb-4 max-w-md">
            Você precisa estar vinculado a uma organização para acessar o Inbox.
            Entre em contato com o administrador.
          </p>
          <Button onClick={() => navigate('/dashboard')} className="mt-4">
            Voltar ao Dashboard
          </Button>
        </div>
      </DashboardLayout>
    );
  }
  
  return (
    <DashboardLayout user={user}>
      <div className="h-[calc(100vh-4rem)] flex flex-col overflow-hidden bg-muted/30">
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column - Conversation List (hidden on mobile when chat is open) */}
          <div className={`
            w-full md:w-80 lg:w-96 flex-shrink-0 border-r border-border
            ${showMobileChat ? 'hidden md:block' : 'block'}
          `}>
            <ConversationList
              conversations={conversations}
              isLoading={conversationsLoading}
              activeId={activeConversation?.id}
              filter={filter}
              onFilterChange={setFilter}
              onSelect={handleSelectConversation}
            />
          </div>
          
          {/* Center Column - Chat */}
          <div className={`
            flex-1 min-w-0 flex flex-col
            ${!showMobileChat ? 'hidden md:flex' : 'flex'}
          `}>
            {/* Mobile header with back button and actions menu */}
            <div className="md:hidden flex items-center justify-between p-2 border-b border-border bg-card">
              <div className="flex items-center gap-2 min-w-0">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={handleMobileBack}
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                {activeConversation && (
                  <span className="font-medium truncate">
                    {activeConversation.contact?.name || 'Conversa'}
                  </span>
                )}
              </div>
              
              {/* Mobile actions dropdown */}
              {activeConversation && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="w-5 h-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 bg-popover">
                    {activeConversation.status === 'open' ? (
                      <DropdownMenuItem onClick={handleResolve}>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Marcar como resolvida
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={handleReopen}>
                        <MessageCircle className="w-4 h-4 mr-2" />
                        Reabrir conversa
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={handleTogglePin}>
                      {activeConversation.is_pinned ? (
                        <>
                          <PinOff className="w-4 h-4 mr-2" />
                          Desafixar
                        </>
                      ) : (
                        <>
                          <Pin className="w-4 h-4 mr-2" />
                          Fixar conversa
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => setShowDeleteDialog(true)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Apagar conversa
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive focus:text-destructive">
                      <Ban className="w-4 h-4 mr-2" />
                      Bloquear contato
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            
            {/* Delete confirmation dialog */}
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Apagar conversa?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Isso remove esta conversa e todas as mensagens do Nexus Zap. 
                    (Não apaga do WhatsApp do cliente.)
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteConversation}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={deleteConversation.isPending}
                  >
                    {deleteConversation.isPending ? 'Apagando...' : 'Apagar'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            
            <div className="flex-1">
              <ChatWindow
                conversation={activeConversation}
                messages={messages}
                isLoading={messagesLoading}
                windowStatus={windowStatus}
                tenantId={tenantId}
              />
            </div>
          </div>
          
          {/* Right Column - Contact Panel (hidden on mobile, visible on lg+) */}
          <div className="w-72 lg:w-80 flex-shrink-0 hidden lg:block">
            <ContactPanel
              conversation={activeConversation}
              contact={contact || activeConversation?.contact || null}
              windowStatus={windowStatus}
              onDeleteConversation={handleDeleteConversation}
              isDeletingConversation={deleteConversation.isPending}
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
