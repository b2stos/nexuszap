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
import { Users, Send, MessageSquare, UserCheck, Crown, Shield, Loader2, Trash2, Megaphone, Contact } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    
    // Fetch all profiles with roles
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email, full_name");

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      setLoading(false);
      return;
    }

    // Fetch all roles
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role");

    // Fetch campaigns with details
    const { data: campaignsData } = await supabase
      .from("campaigns")
      .select("id, name, status, created_at, user_id")
      .order("created_at", { ascending: false });

    // Fetch contacts with details
    const { data: contactsData } = await supabase
      .from("contacts")
      .select("id, name, phone, created_at, user_id")
      .order("created_at", { ascending: false });

    // Fetch messages count per campaign
    const { data: messages } = await supabase
      .from("messages")
      .select("id, campaign_id");

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

    // Build user stats
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

    // Calculate global stats
    setStats({
      total_users: profiles?.length || 0,
      total_campaigns: campaignsData?.length || 0,
      total_contacts: contactsData?.length || 0,
      total_messages: messages?.length || 0,
    });

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

        {/* Global Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_users}</div>
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
              <div className="text-2xl font-bold">{stats.total_contacts}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Mensagens</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_messages}</div>
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
                  Visualize e exclua campanhas de todos os usuários
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
                  Visualize e exclua contatos de todos os usuários
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
            )}
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>Gerenciamento de Usuários</CardTitle>
            <CardDescription>
              Visualize e gerencie os papéis dos usuários do sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
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
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
