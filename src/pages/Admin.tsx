import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useProtectedUser } from "@/components/auth/ProtectedRoute";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Users, Send, MessageSquare, UserCheck, Crown, Shield, Loader2, Trash2, Megaphone, Contact, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { isSuperAdminEmail } from "@/utils/superAdmin";
import { DeleteUserDialog } from "@/components/admin/DeleteUserDialog";
import { UserManagementDialog } from "@/components/admin/UserManagementDialog";

interface UserWithStats {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "user";
  campaigns_count: number;
  contacts_count: number;
  messages_count: number;
}

interface CampaignWithOwner {
  id: string;
  name: string;
  status: string;
  created_at: string;
  user_id: string;
  owner_email: string;
  messages_count: number;
}

interface ContactWithOwner {
  id: string;
  name: string;
  phone: string;
  created_at: string;
  user_id: string;
  owner_email: string;
}

interface GlobalStats {
  total_users: number;
  total_campaigns: number;
  total_contacts: number;
  total_messages: number;
}

export default function Admin() {
  const navigate = useNavigate();
  const user = useProtectedUser();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithStats[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignWithOwner[]>([]);
  const [contacts, setContacts] = useState<ContactWithOwner[]>([]);
  const [stats, setStats] = useState<GlobalStats>({ 
    total_users: 0, 
    total_campaigns: 0, 
    total_contacts: 0, 
    total_messages: 0 
  });
  const [loading, setLoading] = useState(true);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);
  const [deletingCampaign, setDeletingCampaign] = useState<string | null>(null);
  const [deletingContact, setDeletingContact] = useState<string | null>(null);
  
  // User Management Dialog state
  const [userManagementOpen, setUserManagementOpen] = useState(false);
  
  // Check if current user is Super Admin
  const currentUserIsSuperAdmin = isSuperAdminEmail(user?.email);
  
  // Handler for when a user is deleted
  const handleUserDeleted = (userId: string) => {
    setUsers(prev => prev.filter(u => u.id !== userId));
    setStats(prev => ({
      ...prev,
      total_users: prev.total_users - 1,
    }));
  };

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    
    // Fetch real counts using COUNT(*) - bypasses 1000 row limit
    const [
      { count: usersCount },
      { count: campaignsCount },
      { count: contactsCount },
      { count: messagesCount }
    ] = await Promise.all([
      supabase.from("profiles").select("*", { count: 'exact', head: true }),
      supabase.from("campaigns").select("*", { count: 'exact', head: true }),
      supabase.from("contacts").select("*", { count: 'exact', head: true }),
      supabase.from("messages").select("*", { count: 'exact', head: true }),
    ]);

    // Set accurate stats from COUNT queries
    setStats({
      total_users: usersCount || 0,
      total_campaigns: campaignsCount || 0,
      total_contacts: contactsCount || 0,
      total_messages: messagesCount || 0,
    });

    // Fetch limited data for display tables (first 100 of each for preview)
    const [
      { data: profiles },
      { data: roles },
      { data: campaignsData },
      { data: contactsData },
      { data: messages }
    ] = await Promise.all([
      supabase.from("profiles").select("id, email, full_name").limit(100),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("campaigns").select("id, name, status, created_at, user_id").order("created_at", { ascending: false }).limit(50),
      supabase.from("contacts").select("id, name, phone, created_at, user_id").order("created_at", { ascending: false }).limit(50),
      supabase.from("messages").select("id, campaign_id").limit(1000),
    ]);

    // Build campaigns with owner info
    const campaignsWithOwner: CampaignWithOwner[] = campaignsData?.map(campaign => {
      const owner = profiles?.find(p => p.id === campaign.user_id);
      const campaignMessages = messages?.filter(m => m.campaign_id === campaign.id) || [];
      return {
        ...campaign,
        owner_email: owner?.email || "Desconhecido",
        messages_count: campaignMessages.length,
      };
    }) || [];

    // Build contacts with owner info
    const contactsWithOwner: ContactWithOwner[] = contactsData?.map(contact => {
      const owner = profiles?.find(p => p.id === contact.user_id);
      return {
        ...contact,
        owner_email: owner?.email || "Desconhecido",
      };
    }) || [];

    // Build user stats (for display only, limited)
    const usersWithStats: UserWithStats[] = profiles?.map(profile => {
      const userRole = roles?.find(r => r.user_id === profile.id);
      const userCampaigns = campaignsData?.filter(c => c.user_id === profile.id) || [];
      const userContacts = contactsData?.filter(c => c.user_id === profile.id) || [];
      
      return {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        role: (userRole?.role as "admin" | "user") || "user",
        campaigns_count: userCampaigns.length,
        contacts_count: userContacts.length,
        messages_count: 0,
      };
    }) || [];

    setUsers(usersWithStats);
    setCampaigns(campaignsWithOwner);
    setContacts(contactsWithOwner);
    setLoading(false);
  }

  async function toggleUserRole(userId: string, currentRole: "admin" | "user") {
    if (userId === user?.id) {
      toast({
        title: "Ação não permitida",
        description: "Você não pode alterar seu próprio papel.",
        variant: "destructive",
      });
      return;
    }

    setUpdatingRole(userId);
    const newRole = currentRole === "admin" ? "user" : "admin";

    const { error } = await supabase
      .from("user_roles")
      .update({ role: newRole })
      .eq("user_id", userId);

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o papel do usuário.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Sucesso",
        description: `Usuário ${newRole === "admin" ? "promovido a administrador" : "rebaixado para usuário"}.`,
      });
      setUsers(prev => prev.map(u => 
        u.id === userId ? { ...u, role: newRole } : u
      ));
    }

    setUpdatingRole(null);
  }

  async function deleteCampaign(campaignId: string) {
    setDeletingCampaign(campaignId);

    // First delete all messages associated with this campaign
    const { error: messagesError } = await supabase
      .from("messages")
      .delete()
      .eq("campaign_id", campaignId);

    if (messagesError) {
      toast({
        title: "Erro",
        description: "Não foi possível excluir as mensagens da campanha.",
        variant: "destructive",
      });
      setDeletingCampaign(null);
      return;
    }

    // Then delete the campaign
    const { error: campaignError } = await supabase
      .from("campaigns")
      .delete()
      .eq("id", campaignId);

    if (campaignError) {
      toast({
        title: "Erro",
        description: "Não foi possível excluir a campanha.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Sucesso",
        description: "Campanha excluída com sucesso.",
      });
      setCampaigns(prev => prev.filter(c => c.id !== campaignId));
      // Update stats
      setStats(prev => ({
        ...prev,
        total_campaigns: prev.total_campaigns - 1,
      }));
    }

    setDeletingCampaign(null);
  }

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
      setContacts(prev => prev.filter(c => c.id !== contactId));
      setStats(prev => ({
        ...prev,
        total_contacts: prev.total_contacts - 1,
      }));
    }

    setDeletingContact(null);
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      draft: { label: "Rascunho", variant: "secondary" },
      sending: { label: "Enviando", variant: "default" },
      completed: { label: "Concluída", variant: "outline" },
      failed: { label: "Falhou", variant: "destructive" },
      cancelled: { label: "Cancelada", variant: "destructive" },
    };
    const config = statusMap[status] || { label: status, variant: "secondary" as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <DashboardLayout user={user}>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Crown className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Painel Administrativo</h1>
            <p className="text-muted-foreground">Gerencie usuários, campanhas e visualize métricas globais</p>
          </div>
        </div>

        {/* Global Stats - Clickable Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          {/* Users Card - Clickable */}
          <Card 
            className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50 group"
            onClick={() => setUserManagementOpen(true)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">{stats.total_users}</div>
                <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Clique para gerenciar</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Campanhas</CardTitle>
              <Send className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_campaigns}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Contatos</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_contacts.toLocaleString('pt-BR')}</div>
              <p className="text-xs text-muted-foreground mt-1">Atualizado em tempo real</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Mensagens</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_messages.toLocaleString('pt-BR')}</div>
            </CardContent>
          </Card>
        </div>

        {/* Campaigns Management */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Gerenciamento de Campanhas</CardTitle>
                <CardDescription>
                  Visualize e exclua campanhas de todos os usuários (exibindo últimas 50)
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : campaigns.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma campanha encontrada
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campanha</TableHead>
                      <TableHead>Proprietário</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-center">Mensagens</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.map((campaign) => (
                      <TableRow key={campaign.id}>
                        <TableCell className="font-medium">{campaign.name}</TableCell>
                        <TableCell className="text-muted-foreground">{campaign.owner_email}</TableCell>
                        <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(campaign.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-center">{campaign.messages_count}</TableCell>
                        <TableCell className="text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={deletingCampaign === campaign.id}
                              >
                                {deletingCampaign === campaign.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação não pode ser desfeita. Isso excluirá permanentemente a campanha 
                                  <strong> "{campaign.name}"</strong> e todas as {campaign.messages_count} mensagens associadas.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteCampaign(campaign.id)}
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
          </CardContent>
        </Card>

        {/* Contacts Management */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Contact className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Gerenciamento de Contatos</CardTitle>
                <CardDescription>
                  Visualize e exclua contatos de todos os usuários (exibindo últimos 50 de {stats.total_contacts.toLocaleString('pt-BR')} total)
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : contacts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum contato encontrado
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Proprietário</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.map((contact) => (
                      <TableRow key={contact.id}>
                        <TableCell className="font-medium">{contact.name}</TableCell>
                        <TableCell className="text-muted-foreground">{contact.phone}</TableCell>
                        <TableCell className="text-muted-foreground">{contact.owner_email}</TableCell>
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
          </CardContent>
        </Card>

        {/* Users Table (Quick View) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Gerenciamento de Usuários</CardTitle>
                <CardDescription>
                  Visualize e gerencie os papéis dos usuários do sistema
                </CardDescription>
              </div>
              <Button variant="outline" onClick={() => setUserManagementOpen(true)}>
                Ver todos
                <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Papel</TableHead>
                      <TableHead className="text-center">Campanhas</TableHead>
                      <TableHead className="text-center">Contatos</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">
                          {u.full_name || "Sem nome"}
                          {u.id === user?.id && (
                            <Badge variant="outline" className="ml-2">Você</Badge>
                          )}
                        </TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>
                          <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                            {u.role === "admin" ? (
                              <><Crown className="h-3 w-3 mr-1" /> Admin</>
                            ) : (
                              <><Shield className="h-3 w-3 mr-1" /> Usuário</>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">{u.campaigns_count}</TableCell>
                        <TableCell className="text-center">{u.contacts_count}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {u.id !== user?.id && (
                              <Button
                                variant={u.role === "admin" ? "destructive" : "default"}
                                size="sm"
                                onClick={() => toggleUserRole(u.id, u.role)}
                                disabled={updatingRole === u.id}
                              >
                                {updatingRole === u.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : u.role === "admin" ? (
                                  "Rebaixar"
                                ) : (
                                  "Promover"
                                )}
                              </Button>
                            )}
                            {/* Botão de exclusão - apenas para Super Admin */}
                            {currentUserIsSuperAdmin && (
                              <DeleteUserDialog
                                userId={u.id}
                                userEmail={u.email}
                                userName={u.full_name}
                                currentUserId={user?.id || ""}
                                onUserDeleted={handleUserDeleted}
                              />
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* User Management Dialog */}
      <UserManagementDialog
        open={userManagementOpen}
        onOpenChange={setUserManagementOpen}
        currentUserId={user?.id || ""}
        currentUserEmail={user?.email}
        onUserUpdated={fetchData}
      />
    </DashboardLayout>
  );
}
