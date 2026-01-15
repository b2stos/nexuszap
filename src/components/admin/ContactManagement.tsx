import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { 
  Contact, Search, ChevronLeft, ChevronRight, Trash2, Loader2, 
  ArrowLeft, Users, Crown, Shield
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OwnerWithCount {
  id: string;
  email: string;
  full_name: string | null;
  role?: "admin" | "user";
  contacts_count: number;
}

interface ContactItem {
  id: string;
  name: string;
  phone: string;
  created_at: string;
  owner_email: string;
}

interface ContactManagementProps {
  onContactDeleted?: () => void;
}

const PAGE_SIZE = 10;
const CONTACTS_PAGE_SIZE = 20;

export function ContactManagement({ onContactDeleted }: ContactManagementProps) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  // Level 1: Owners list
  const [owners, setOwners] = useState<OwnerWithCount[]>([]);
  const [ownersLoading, setOwnersLoading] = useState(true);
  const [ownerSearch, setOwnerSearch] = useState("");
  const [ownerPage, setOwnerPage] = useState(1);
  const [ownerTotal, setOwnerTotal] = useState(0);
  
  // Level 2: Selected owner's contacts
  const [selectedOwner, setSelectedOwner] = useState<OwnerWithCount | null>(null);
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [contactPage, setContactPage] = useState(1);
  const [contactTotal, setContactTotal] = useState(0);
  const [deletingContact, setDeletingContact] = useState<string | null>(null);

  // Fetch owners with contact counts using exact COUNT(*) queries
  const fetchOwners = useCallback(async () => {
    setOwnersLoading(true);
    
    try {
      // Get all profiles with search filter
      let profilesQuery = supabase
        .from("profiles")
        .select("id, email, full_name", { count: 'exact' });
      
      if (ownerSearch) {
        profilesQuery = profilesQuery.or(`email.ilike.%${ownerSearch}%,full_name.ilike.%${ownerSearch}%`);
      }
      
      const { data: profiles, count: profilesCount, error: profilesError } = await profilesQuery
        .order("email", { ascending: true })
        .range((ownerPage - 1) * PAGE_SIZE, ownerPage * PAGE_SIZE - 1);

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
        setOwnersLoading(false);
        return;
      }

      if (!profiles || profiles.length === 0) {
        setOwners([]);
        setOwnerTotal(profilesCount || 0);
        setOwnersLoading(false);
        return;
      }

      // Get EXACT contact counts for each user using COUNT(*) - bypasses 1000 row limit
      const countPromises = profiles.map(async (profile) => {
        const { count, error } = await supabase
          .from("contacts")
          .select("*", { count: 'exact', head: true })
          .eq("user_id", profile.id);
        
        if (error) {
          console.error(`Error counting contacts for ${profile.id}:`, error);
          return { userId: profile.id, count: 0 };
        }
        
        return { userId: profile.id, count: count || 0 };
      });

      const countResults = await Promise.all(countPromises);
      
      // Build count map from exact counts
      const countMap: Record<string, number> = {};
      countResults.forEach(result => {
        countMap[result.userId] = result.count;
      });

      // Get roles
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", profiles.map(p => p.id));

      const roleMap: Record<string, "admin" | "user"> = {};
      roles?.forEach(r => {
        roleMap[r.user_id] = r.role as "admin" | "user";
      });

      // Combine data
      const ownersWithCounts: OwnerWithCount[] = profiles.map(profile => ({
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        role: roleMap[profile.id] || "user",
        contacts_count: countMap[profile.id] || 0,
      }));

      // Sort by contacts count (descending)
      ownersWithCounts.sort((a, b) => b.contacts_count - a.contacts_count);

      setOwners(ownersWithCounts);
      setOwnerTotal(profilesCount || 0);
    } catch (err) {
      console.error("Error in fetchOwners:", err);
    } finally {
      setOwnersLoading(false);
    }
  }, [ownerSearch, ownerPage]);

  // Fetch contacts for selected owner
  const fetchContacts = useCallback(async () => {
    if (!selectedOwner) return;
    
    setContactsLoading(true);
    
    try {
      let query = supabase
        .from("contacts")
        .select("id, name, phone, created_at", { count: 'exact' })
        .eq("user_id", selectedOwner.id);
      
      if (contactSearch) {
        query = query.or(`name.ilike.%${contactSearch}%,phone.ilike.%${contactSearch}%`);
      }
      
      const { data, count, error } = await query
        .order("created_at", { ascending: false })
        .range((contactPage - 1) * CONTACTS_PAGE_SIZE, contactPage * CONTACTS_PAGE_SIZE - 1);

      if (error) {
        console.error("Error fetching contacts:", error);
        setContactsLoading(false);
        return;
      }

      const contactItems: ContactItem[] = data?.map(c => ({
        ...c,
        owner_email: selectedOwner.email,
      })) || [];

      setContacts(contactItems);
      setContactTotal(count || 0);
    } catch (err) {
      console.error("Error in fetchContacts:", err);
    } finally {
      setContactsLoading(false);
    }
  }, [selectedOwner, contactSearch, contactPage]);

  // Effects
  useEffect(() => {
    if (!selectedOwner) {
      fetchOwners();
    }
  }, [fetchOwners, selectedOwner]);

  useEffect(() => {
    if (selectedOwner) {
      fetchContacts();
    }
  }, [fetchContacts, selectedOwner]);

  // Handle owner selection
  const handleSelectOwner = (owner: OwnerWithCount) => {
    setSelectedOwner(owner);
    setContactPage(1);
    setContactSearch("");
  };

  // Handle back to owners list
  const handleBackToOwners = () => {
    setSelectedOwner(null);
    setContacts([]);
    setContactTotal(0);
  };

  // Delete contact
  async function deleteContact(contactId: string) {
    setDeletingContact(contactId);

    const { error } = await supabase
      .from("contacts")
      .delete()
      .eq("id", contactId);

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível excluir o contato.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Sucesso",
        description: "Contato excluído com sucesso.",
      });
      
      // Update local state
      setContacts(prev => prev.filter(c => c.id !== contactId));
      setContactTotal(prev => prev - 1);
      
      // Update owner's contact count
      if (selectedOwner) {
        setOwners(prev => prev.map(o => 
          o.id === selectedOwner.id 
            ? { ...o, contacts_count: o.contacts_count - 1 }
            : o
        ));
        setSelectedOwner(prev => prev ? { ...prev, contacts_count: prev.contacts_count - 1 } : null);
      }
      
      // Notify parent to update global stats
      onContactDeleted?.();
    }

    setDeletingContact(null);
  }

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  const ownerTotalPages = Math.ceil(ownerTotal / PAGE_SIZE);
  const contactTotalPages = Math.ceil(contactTotal / CONTACTS_PAGE_SIZE);

  // Level 2: Contact list for selected owner
  if (selectedOwner) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleBackToOwners}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Contact className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Contatos de {selectedOwner.full_name || selectedOwner.email}</CardTitle>
              </div>
              <CardDescription>
                {selectedOwner.email} • {contactTotal.toLocaleString('pt-BR')} contatos
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou telefone..."
              value={contactSearch}
              onChange={(e) => {
                setContactSearch(e.target.value);
                setContactPage(1);
              }}
              className="pl-9"
            />
          </div>

          {/* Contacts table */}
          {contactsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {contactSearch ? "Nenhum contato encontrado" : "Este usuário não possui contatos"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell className="font-medium">{contact.name}</TableCell>
                      <TableCell className="text-muted-foreground">{contact.phone}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(contact.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={deletingContact === contact.id}
                            >
                              {deletingContact === contact.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir contato?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação não pode ser desfeita. Isso excluirá permanentemente o contato 
                                <strong> "{contact.name}"</strong> ({contact.phone}).
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteContact(contact.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {contactTotalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Exibindo {((contactPage - 1) * CONTACTS_PAGE_SIZE) + 1} - {Math.min(contactPage * CONTACTS_PAGE_SIZE, contactTotal)} de {contactTotal.toLocaleString('pt-BR')}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setContactPage(p => Math.max(1, p - 1))}
                  disabled={contactPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground px-2">
                  {contactPage} / {contactTotalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setContactPage(p => Math.min(contactTotalPages, p + 1))}
                  disabled={contactPage === contactTotalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Level 1: Owners list
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Contact className="h-5 w-5 text-primary" />
          <div>
            <CardTitle>Gerenciamento de Contatos</CardTitle>
            <CardDescription>
              Visualize e exclua contatos por usuário
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar usuário por nome ou email..."
            value={ownerSearch}
            onChange={(e) => {
              setOwnerSearch(e.target.value);
              setOwnerPage(1);
            }}
            className="pl-9"
          />
        </div>

        {/* Owners list */}
        {ownersLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : owners.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {ownerSearch ? "Nenhum usuário encontrado" : "Nenhum usuário cadastrado"}
          </div>
        ) : isMobile ? (
          // Mobile: Cards
          <div className="space-y-3">
            {owners.map((owner) => (
              <Card 
                key={owner.id} 
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => handleSelectOwner(owner)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {getInitials(owner.full_name, owner.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {owner.full_name || "Sem nome"}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">{owner.email}</p>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {owner.contacts_count.toLocaleString('pt-BR')} contatos
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          // Desktop: Table
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead className="text-center">Total de Contatos</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {owners.map((owner) => (
                  <TableRow 
                    key={owner.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSelectOwner(owner)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">
                            {getInitials(owner.full_name, owner.email)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate max-w-[150px]">
                          {owner.full_name || "Sem nome"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {owner.email}
                    </TableCell>
                    <TableCell>
                      <Badge variant={owner.role === "admin" ? "default" : "secondary"} className="gap-1">
                        {owner.role === "admin" ? <Crown className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
                        {owner.role === "admin" ? "Admin" : "Usuário"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="font-mono">
                        {owner.contacts_count.toLocaleString('pt-BR')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectOwner(owner);
                        }}
                      >
                        <Users className="h-4 w-4 mr-2" />
                        Ver contatos
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination */}
        {ownerTotalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              {ownerTotal} usuário{ownerTotal !== 1 ? "s" : ""} no total
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setOwnerPage(p => Math.max(1, p - 1))}
                disabled={ownerPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground px-2">
                {ownerPage} / {ownerTotalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setOwnerPage(p => Math.min(ownerTotalPages, p + 1))}
                disabled={ownerPage === ownerTotalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
