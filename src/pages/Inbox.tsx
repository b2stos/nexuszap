/**
 * Inbox Page
 * 
 * Página principal do Inbox estilo WhatsApp Web com 3 colunas
 * PRODUCTION: Apenas dados reais do banco
 */

import { useState, useEffect, useCallback, useRef, Component, ReactNode, ErrorInfo } from 'react';
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
  AlertCircle,
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

// ============================================
// ERROR BOUNDARY - Previne blank screen no iPad
// ============================================

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class InboxErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Inbox] Error caught by boundary:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-muted/20">
          <AlertCircle className="w-12 h-12 text-destructive mb-4" />
          <h3 className="text-lg font-semibold mb-2">Algo deu errado</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-xs">
            Ocorreu um erro ao carregar esta conversa.
          </p>
          <Button onClick={this.handleReset} variant="outline">
            Tentar novamente
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

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
  const [deleteTargetConversationId, setDeleteTargetConversationId] = useState<string | null>(null);
  const [hardDeleteMode, setHardDeleteMode] = useState(false);
  const didAutoSelectRef = useRef(false);
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
  
  // Sync activeConversation with conversations list
  // If selected conversation was deleted/filtered, clear it
  useEffect(() => {
    if (activeConversation) {
      const stillExists = conversations.some(c => c.id === activeConversation.id);
      if (!stillExists && !conversationsLoading) {
        console.log('[Inbox] Active conversation no longer exists, clearing selection');
        setActiveConversation(null);
        setShowMobileChat(false);
      }
    }
  }, [conversations, activeConversation, conversationsLoading]);
  
  // Auto-select first conversation (only once per tenant, and only if none selected)
  useEffect(() => {
    didAutoSelectRef.current = false;
  }, [tenantId]);

  useEffect(() => {
    if (conversations.length > 0 && !activeConversation && !didAutoSelectRef.current && !conversationsLoading) {
      setActiveConversation(conversations[0]);
      didAutoSelectRef.current = true;
    }
  }, [conversations, activeConversation, tenantId, conversationsLoading]);
  
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
  
  const openDeleteDialog = (conversationId: string, hardMode = false) => {
    setDeleteTargetConversationId(conversationId);
    setHardDeleteMode(hardMode);
    setShowDeleteDialog(true);
  };

  const runDeleteConversation = (conversationId: string) => {
    const prevActive = activeConversation;
    const wasActive = activeConversation?.id === conversationId;
    
    // Find next conversation to select after delete
    let nextConversation: InboxConversation | null = null;
    if (wasActive && conversations.length > 1) {
      const currentIndex = conversations.findIndex(c => c.id === conversationId);
      // Try next conversation, or previous if at end
      if (currentIndex < conversations.length - 1) {
        nextConversation = conversations[currentIndex + 1];
      } else if (currentIndex > 0) {
        nextConversation = conversations[currentIndex - 1];
      }
    }

    // Optimistic UI: if deleting the open conversation, select next one immediately
    if (wasActive) {
      setActiveConversation(nextConversation);
      if (!nextConversation) {
        setShowMobileChat(false);
      }
    }

    console.log(`[Inbox] Deleting conversation: ${conversationId}, hardDelete: ${hardDeleteMode}`);

    deleteConversation.mutate(
      { conversationId, hardDelete: hardDeleteMode },
      {
        onSuccess: () => {
          console.log(`[Inbox] Delete successful for: ${conversationId}`);
          setShowDeleteDialog(false);
          setDeleteTargetConversationId(null);
          setHardDeleteMode(false);
        },
        onError: (error) => {
          console.error(`[Inbox] Delete failed:`, error);
          // Rollback local UI selection if needed (list rollback is handled in the hook)
          if (wasActive && prevActive) {
            setActiveConversation(prevActive);
          }
        },
      }
    );
  };

  // Handle delete conversation (from central confirmation dialog)
  const handleDeleteConversation = () => {
    const targetId = deleteTargetConversationId || activeConversation?.id;
    if (!targetId) return;
    runDeleteConversation(targetId);
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
      {/* Use dvh for iOS Safari compatibility */}
      <div className="inbox-container flex flex-col overflow-hidden bg-muted/30">
        <div className="flex-1 flex overflow-hidden min-h-0 w-full">
          {/* Left Column - Conversation List */}
          <aside 
            className={`
              w-full md:w-80 lg:w-96 flex-shrink-0 flex-grow-0 border-r border-border bg-card
              ${showMobileChat ? 'hidden md:flex' : 'flex'}
            `}
            style={{ minWidth: 320, maxWidth: 384 }}
          >
            <div className="h-full w-full flex flex-col">
              <ConversationList
                conversations={conversations}
                isLoading={conversationsLoading}
                activeId={activeConversation?.id}
                filter={filter}
                onFilterChange={setFilter}
                onSelect={handleSelectConversation}
                onDeleteConversation={(conversationId) => {
                  openDeleteDialog(conversationId);
                }}
              />
            </div>
          </aside>
          
          {/* Center Column - Chat (MUST have flex-1 and min-w-0) */}
          <main 
            className={`
              flex-1 min-w-0 min-h-0 flex flex-col bg-background
              ${!showMobileChat ? 'hidden md:flex' : 'flex'}
            `}
          >
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
                      onClick={() => openDeleteDialog(activeConversation.id)}
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
            <AlertDialog
              open={showDeleteDialog}
              onOpenChange={(open) => {
                setShowDeleteDialog(open);
                if (!open) {
                  setDeleteTargetConversationId(null);
                  setHardDeleteMode(false);
                }
              }}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Apagar conversa?</AlertDialogTitle>
                  <AlertDialogDescription className="space-y-3">
                    <span className="block">
                      Isso remove esta conversa e todas as mensagens do Nexus Zap. 
                      (Não apaga do WhatsApp do cliente.)
                    </span>
                    <label className="flex items-center gap-2 text-sm cursor-pointer mt-4">
                      <input
                        type="checkbox"
                        checked={hardDeleteMode}
                        onChange={(e) => setHardDeleteMode(e.target.checked)}
                        className="h-4 w-4 rounded border-border"
                      />
                      <span className="text-foreground">
                        Excluir permanentemente (não pode ser desfeito)
                      </span>
                    </label>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleteConversation.isPending}>
                    Cancelar
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteConversation}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={deleteConversation.isPending}
                  >
                    {deleteConversation.isPending ? 'Apagando...' : hardDeleteMode ? 'Excluir permanentemente' : 'Apagar'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            
            <div className="flex-1 min-h-0 overflow-hidden">
              <InboxErrorBoundary onReset={() => setActiveConversation(null)}>
                <ChatWindow
                  conversation={activeConversation}
                  messages={messages}
                  isLoading={messagesLoading}
                  windowStatus={windowStatus}
                  tenantId={tenantId}
                />
              </InboxErrorBoundary>
            </div>
          </main>
          
          {/* Right Column - Contact Panel (only visible when conversation selected on lg+) */}
          {activeConversation && (
            <aside className="w-72 lg:w-80 flex-shrink-0 flex-grow-0 hidden lg:block border-l border-border">
              <ContactPanel
                conversation={activeConversation}
                contact={contact || activeConversation?.contact || null}
                windowStatus={windowStatus}
                onDeleteConversation={handleDeleteConversation}
                isDeletingConversation={deleteConversation.isPending}
              />
            </aside>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
