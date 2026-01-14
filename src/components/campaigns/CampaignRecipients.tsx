/**
 * CampaignRecipients Component
 * 
 * Recipients selection for campaign creation with:
 * - BM daily limit selector with explanation
 * - Auto-select up to limit
 * - Sent/Pending tabs
 * - Search and selection
 */

import { useState, useMemo, useCallback, memo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Search,
  Loader2,
  Info,
  Zap,
  ChevronDown,
  Check,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { 
  useAllMTContacts, 
  useSentLast24Hours,
  BM_LIMIT_TIERS,
  type CampaignContact,
  type BMLimitTier,
} from '@/hooks/useCampaignContacts';

// Selected contact with full data
export interface SelectedContactData {
  id: string;
  phone: string;
  name: string | null;
}

interface CampaignRecipientsProps {
  tenantId: string;
  selectedContactIds: Set<string>;
  onSelectionChange: (ids: Set<string>, contacts: SelectedContactData[]) => void;
  onBMLimitChange?: (tier: BMLimitTier) => void;
}

// BM Limit Dropdown Component
const BMLimitDropdown = memo(function BMLimitDropdown({
  tiers,
  selectedTier,
  onSelect,
}: {
  tiers: BMLimitTier[];
  selectedTier: BMLimitTier;
  onSelect: (tier: BMLimitTier) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        <span className="font-medium">{selectedTier.label}</span>
        <ChevronDown className={`h-4 w-4 opacity-50 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)} 
          />
          <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md">
            <div className="p-1">
              {tiers.map((tier) => (
                <div
                  key={tier.label}
                  onClick={() => {
                    onSelect(tier);
                    setIsOpen(false);
                  }}
                  className={`relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none transition-colors hover:bg-accent ${
                    selectedTier.value === tier.value ? 'bg-accent' : ''
                  }`}
                >
                  <span className="mr-2 flex h-4 w-4 items-center justify-center">
                    {selectedTier.value === tier.value && <Check className="h-4 w-4" />}
                  </span>
                  <div className="flex-1">
                    <span className="font-medium">{tier.label}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{tier.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
});

// Contact Row Component
const ContactRow = memo(function ContactRow({
  contact,
  isSelected,
  onToggle,
  isSent,
}: {
  contact: CampaignContact;
  isSelected: boolean;
  onToggle: (id: string) => void;
  isSent?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer ${
        isSent ? 'opacity-60' : ''
      }`}
      onClick={() => !isSent && onToggle(contact.id)}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => !isSent && onToggle(contact.id)}
        onClick={(e) => e.stopPropagation()}
        disabled={isSent}
        className="h-4 w-4 rounded border-primary text-primary focus:ring-primary disabled:opacity-50"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {contact.name || 'Sem nome'}
        </p>
        <p className="text-xs text-muted-foreground">
          {contact.phone}
        </p>
      </div>
      {isSent && (
        <Badge variant="secondary" className="text-xs">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Enviado
        </Badge>
      )}
    </div>
  );
});

export function CampaignRecipients({
  tenantId,
  selectedContactIds,
  onSelectionChange,
  onBMLimitChange,
}: CampaignRecipientsProps) {
  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'sent'>('pending');
  const [bmLimit, setBMLimit] = useState<BMLimitTier>(BM_LIMIT_TIERS[0]); // Default: 250
  
  // Notify parent when BM limit changes
  const handleBMLimitChange = useCallback((tier: BMLimitTier) => {
    setBMLimit(tier);
    onBMLimitChange?.(tier);
  }, [onBMLimitChange]);
  
  // Fetch all contacts (same source as Contacts page)
  const { data: allContacts, isLoading: contactsLoading } = useAllMTContacts(tenantId);
  const { data: sentLast24h = 0 } = useSentLast24Hours(tenantId);
  
  // Calculate remaining limit
  const remainingLimit = useMemo(() => {
    if (bmLimit.value === null) return Infinity;
    return Math.max(0, bmLimit.value - sentLast24h);
  }, [bmLimit.value, sentLast24h]);
  
  // Filter contacts by search
  const filteredContacts = useMemo(() => {
    if (!allContacts) return [];
    if (!searchTerm) return allContacts;
    
    const term = searchTerm.toLowerCase();
    return allContacts.filter(c => 
      c.name?.toLowerCase().includes(term) ||
      c.phone.includes(term)
    );
  }, [allContacts, searchTerm]);
  
  // Separate pending from sent (for now, all are pending in new campaign)
  const pendingContacts = filteredContacts;
  const sentContacts: CampaignContact[] = []; // Empty for new campaigns
  
  // Is selection over limit?
  const isOverLimit = useMemo(() => {
    if (bmLimit.value === null) return false;
    return selectedContactIds.size > remainingLimit;
  }, [selectedContactIds.size, remainingLimit, bmLimit.value]);
  
  // Helper to get selected contacts data
  const getSelectedContactsData = useCallback((selection: Set<string>): SelectedContactData[] => {
    if (!allContacts) return [];
    return allContacts
      .filter(c => selection.has(c.id))
      .map(c => ({ id: c.id, phone: c.phone, name: c.name }));
  }, [allContacts]);
  
  // Toggle contact selection
  const toggleContact = useCallback((contactId: string) => {
    const newSelection = new Set(selectedContactIds);
    
    if (newSelection.has(contactId)) {
      newSelection.delete(contactId);
    } else {
      // Check if adding would exceed limit
      if (bmLimit.value !== null && newSelection.size >= remainingLimit) {
        return; // Don't add if at limit
      }
      newSelection.add(contactId);
    }
    
    onSelectionChange(newSelection, getSelectedContactsData(newSelection));
  }, [selectedContactIds, onSelectionChange, bmLimit.value, remainingLimit, getSelectedContactsData]);
  
  // Select all visible (up to limit)
  const handleSelectAllVisible = useCallback(() => {
    const newSelection = new Set(selectedContactIds);
    const maxToAdd = bmLimit.value === null 
      ? pendingContacts.length 
      : Math.min(remainingLimit, pendingContacts.length);
    
    let added = 0;
    for (const contact of pendingContacts) {
      if (added >= maxToAdd) break;
      if (!newSelection.has(contact.id)) {
        newSelection.add(contact.id);
        added++;
      } else {
        // Already selected, count toward limit
      }
    }
    
    // If already all selected, deselect all
    if (added === 0 && pendingContacts.every(c => newSelection.has(c.id))) {
      pendingContacts.forEach(c => newSelection.delete(c.id));
    }
    
    onSelectionChange(newSelection, getSelectedContactsData(newSelection));
  }, [selectedContactIds, pendingContacts, bmLimit.value, remainingLimit, onSelectionChange, getSelectedContactsData]);
  
  // Auto-select up to daily limit
  const handleSelectUpToLimit = useCallback(() => {
    const newSelection = new Set<string>();
    const maxToSelect = bmLimit.value === null 
      ? pendingContacts.length 
      : remainingLimit;
    
    // Select first N pending contacts (ordered by created_at)
    for (let i = 0; i < Math.min(maxToSelect, pendingContacts.length); i++) {
      newSelection.add(pendingContacts[i].id);
    }
    
    onSelectionChange(newSelection, getSelectedContactsData(newSelection));
  }, [pendingContacts, bmLimit.value, remainingLimit, onSelectionChange, getSelectedContactsData]);
  
  // Clear selection
  const handleClearSelection = useCallback(() => {
    onSelectionChange(new Set(), []);
  }, [onSelectionChange]);
  
  // Are all visible selected?
  const allVisibleSelected = pendingContacts.length > 0 && 
    pendingContacts.every(c => selectedContactIds.has(c.id));
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Destinatários
        </CardTitle>
        <CardDescription>
          Selecione os contatos que receberão a campanha
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* BM Limit Section */}
        <div className="p-4 rounded-lg border bg-muted/30">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1 space-y-3">
              <div>
                <h4 className="font-medium text-sm">Limite da Business Manager (24h)</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Sua BM pode enviar até X mensagens a cada 24 horas. 
                  Você pode importar quantos contatos quiser, mas o envio deve respeitar esse limite.
                </p>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="w-40">
                  <BMLimitDropdown
                    tiers={BM_LIMIT_TIERS}
                    selectedTier={bmLimit}
                    onSelect={handleBMLimitChange}
                  />
                </div>
                
                <div className="text-sm">
                  <span className="text-muted-foreground">Enviados (24h): </span>
                  <span className="font-medium">{sentLast24h.toLocaleString('pt-BR')}</span>
                  {bmLimit.value !== null && (
                    <>
                      <span className="text-muted-foreground"> / </span>
                      <span className="font-medium">{bmLimit.label}</span>
                      <span className="text-muted-foreground ml-2">
                        (restante: <span className="text-green-600 font-medium">{remainingLimit.toLocaleString('pt-BR')}</span>)
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Stats Bar */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-4">
            <span className="text-sm">
              Total: <strong>{allContacts?.length || 0}</strong>
            </span>
            <span className="text-sm">
              Selecionados: <strong className={isOverLimit ? 'text-destructive' : 'text-primary'}>
                {selectedContactIds.size}
              </strong>
              {bmLimit.value !== null && (
                <span className="text-muted-foreground"> / {remainingLimit}</span>
              )}
            </span>
          </div>
          
          {isOverLimit && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              Excede limite
            </Badge>
          )}
        </div>
        
        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSelectUpToLimit}
            className="gap-2"
          >
            <Zap className="h-4 w-4" />
            Selecionar até o limite ({bmLimit.value === null ? 'todos' : remainingLimit.toLocaleString('pt-BR')})
          </Button>
          
          {selectedContactIds.size > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearSelection}
            >
              Limpar seleção
            </Button>
          )}
        </div>
        
        {/* Search & Select All */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="select-all-visible"
              checked={allVisibleSelected}
              onChange={handleSelectAllVisible}
              className="h-4 w-4 rounded border-primary text-primary focus:ring-primary"
            />
            <Label htmlFor="select-all-visible" className="text-sm cursor-pointer whitespace-nowrap">
              Selecionar visíveis
            </Label>
          </div>
        </div>
        
        {/* Tabs: Pending / Sent */}
        <div className="flex border-b">
          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'pending'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Clock className="inline h-4 w-4 mr-1.5" />
            Pendentes ({pendingContacts.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sent')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'sent'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <CheckCircle2 className="inline h-4 w-4 mr-1.5" />
            Enviados ({sentContacts.length})
          </button>
        </div>
        
        {/* Contact List */}
        <div className="h-[300px] rounded-md border overflow-y-auto">
          {contactsLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Carregando contatos...</span>
            </div>
          ) : activeTab === 'pending' ? (
            pendingContacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Users className="h-8 w-8 mb-2" />
                <p>{searchTerm ? 'Nenhum contato encontrado' : 'Nenhum contato importado'}</p>
                {!searchTerm && (
                  <p className="text-xs mt-1">Importe contatos na aba Contatos</p>
                )}
              </div>
            ) : (
              <div className="p-4 space-y-1">
                {pendingContacts.map((contact) => (
                  <ContactRow
                    key={contact.id}
                    contact={contact}
                    isSelected={selectedContactIds.has(contact.id)}
                    onToggle={toggleContact}
                  />
                ))}
              </div>
            )
          ) : (
            sentContacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mb-2" />
                <p>Nenhum contato enviado ainda</p>
                <p className="text-xs mt-1">Os contatos aparecerão aqui após o envio</p>
              </div>
            ) : (
              <div className="p-4 space-y-1">
                {sentContacts.map((contact) => (
                  <ContactRow
                    key={contact.id}
                    contact={contact}
                    isSelected={true}
                    onToggle={() => {}}
                    isSent={true}
                  />
                ))}
              </div>
            )
          )}
        </div>
        
        {/* Limit Warning */}
        {bmLimit.value !== null && selectedContactIds.size > 0 && selectedContactIds.size < (allContacts?.length || 0) && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-amber-800 dark:text-amber-200">
                  Você selecionou <strong>{selectedContactIds.size}</strong> de <strong>{allContacts?.length || 0}</strong> contatos.
                </p>
                <p className="text-amber-700 dark:text-amber-300 text-xs mt-1">
                  Os demais contatos ficarão como "Pendentes" e poderão ser enviados nos próximos dias.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
