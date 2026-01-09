/**
 * Inbox Page
 * 
 * Página principal do Inbox estilo WhatsApp Web com 3 colunas
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Building2, ArrowLeft, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  
  // Track onboarding step
  useTrackInboxOpened();
  
  // Get user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);
  
  // Queries
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
  
  // Realtime
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
          <Button onClick={() => navigate('/dashboard')}>
            Voltar ao Dashboard
          </Button>
        </div>
      </DashboardLayout>
    );
  }
  
  return (
    <DashboardLayout user={user}>
      <div className="h-[calc(100vh-4rem)] flex overflow-hidden bg-muted/30">
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
          {/* Mobile back button */}
          <div className="md:hidden flex items-center gap-2 p-2 border-b border-border bg-card">
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
        
        {/* Right Column - Contact Panel (hidden on mobile and tablet) */}
        <div className="w-80 flex-shrink-0 hidden xl:block">
          <ContactPanel
            conversation={activeConversation}
            contact={contact || activeConversation?.contact || null}
            windowStatus={windowStatus}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
