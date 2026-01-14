/**
 * useCampaignContacts Hook
 * 
 * Unified hook for fetching all contacts for campaign creation
 * with sent/pending status per campaign
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CampaignContact {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  created_at: string;
  // Campaign-specific status (if checking against a campaign)
  sentStatus?: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  sentAt?: string | null;
}

export interface BMLimitTier {
  value: number | null; // null = unlimited
  label: string;
  description: string;
}

export const BM_LIMIT_TIERS: BMLimitTier[] = [
  { value: 250, label: '250', description: 'Tier 1 - Conta nova' },
  { value: 1000, label: '1.000', description: 'Tier 2 - Conta verificada' },
  { value: 10000, label: '10.000', description: 'Tier 3 - Conta ativa' },
  { value: 100000, label: '100.000', description: 'Tier 4 - Conta estabelecida' },
  { value: null, label: 'Ilimitado', description: 'Sem limite diário' },
];

/**
 * Fetch ALL contacts from the 'contacts' table (same source as Contacts page)
 * This is the legacy table used by /dashboard/contacts
 * No limit applied - returns all contacts for the current user
 */
export function useAllMTContacts(_tenantId: string | undefined) {
  return useQuery({
    queryKey: ['all-contacts-for-campaign'],
    queryFn: async () => {
      // The 'contacts' table is user-scoped via RLS, not tenant-scoped
      // This matches exactly what ContactsTable.tsx does
      const { data, error } = await supabase
        .from('contacts')
        .select('id, phone, name, created_at')
        .order('created_at', { ascending: true }); // Oldest first for deterministic selection
      
      if (error) throw error;
      
      // Map to CampaignContact format (contacts table doesn't have email)
      return (data || []).map(c => ({
        id: c.id,
        phone: c.phone,
        name: c.name,
        email: null,
        created_at: c.created_at,
      })) as CampaignContact[];
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Fetch contacts with their sent status for a specific campaign
 * Used for viewing campaign progress and resuming
 */
export function useCampaignContactsWithStatus(
  tenantId: string | undefined,
  campaignId: string | undefined
) {
  return useQuery({
    queryKey: ['campaign-contacts-status', tenantId, campaignId],
    queryFn: async () => {
      if (!tenantId || !campaignId) return { pending: [], sent: [] };
      
      // Get all contacts
      const { data: contacts, error: contactsError } = await supabase
        .from('mt_contacts')
        .select('id, phone, name, email, created_at')
        .eq('tenant_id', tenantId)
        .eq('is_blocked', false)
        .order('created_at', { ascending: true });
      
      if (contactsError) throw contactsError;
      
      // Get recipients for this campaign
      const { data: recipients, error: recipientsError } = await supabase
        .from('campaign_recipients')
        .select('contact_id, status, sent_at')
        .eq('campaign_id', campaignId);
      
      if (recipientsError) throw recipientsError;
      
      // Map recipient status by contact_id
      const recipientMap = new Map<string, { status: string; sent_at: string | null }>();
      (recipients || []).forEach(r => {
        recipientMap.set(r.contact_id, { status: r.status, sent_at: r.sent_at });
      });
      
      // Split into sent and pending
      const sent: CampaignContact[] = [];
      const pending: CampaignContact[] = [];
      
      (contacts || []).forEach(contact => {
        const recipientInfo = recipientMap.get(contact.id);
        
        if (recipientInfo && ['sent', 'delivered', 'read'].includes(recipientInfo.status)) {
          sent.push({
            ...contact,
            sentStatus: recipientInfo.status as CampaignContact['sentStatus'],
            sentAt: recipientInfo.sent_at,
          });
        } else {
          pending.push({
            ...contact,
            sentStatus: recipientInfo?.status === 'failed' ? 'failed' : 'pending',
            sentAt: null,
          });
        }
      });
      
      return { sent, pending };
    },
    enabled: !!tenantId && !!campaignId,
  });
}

/**
 * Get count of messages sent in the last 24 hours for a tenant
 * Used to calculate remaining BM limit
 */
export function useSentLast24Hours(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['sent-24h-count', tenantId],
    queryFn: async () => {
      if (!tenantId) return 0;
      
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      // Count sent messages from campaign_recipients in last 24h
      const { count, error } = await supabase
        .from('campaign_recipients')
        .select('id, campaign_id!inner(tenant_id)', { count: 'exact', head: true })
        .eq('campaign_id.tenant_id', tenantId)
        .gte('sent_at', twentyFourHoursAgo)
        .in('status', ['sent', 'delivered', 'read']);
      
      if (error) {
        // Fallback: use mt_messages
        const { count: msgCount, error: msgError } = await supabase
          .from('mt_messages')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('direction', 'outbound')
          .gte('sent_at', twentyFourHoursAgo);
        
        if (msgError) {
          console.warn('Could not fetch 24h count:', msgError);
          return 0;
        }
        
        return msgCount || 0;
      }
      
      return count || 0;
    },
    enabled: !!tenantId,
    staleTime: 60 * 1000, // 1 minute
  });
}
