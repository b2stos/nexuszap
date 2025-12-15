import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useProtectedUser } from "@/components/auth/ProtectedRoute";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Send, MessageSquare, UserCheck, Crown, Shield, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface UserWithStats {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "user";
  campaigns_count: number;
  contacts_count: number;
  messages_count: number;
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
  const [stats, setStats] = useState<GlobalStats>({ 
    total_users: 0, 
    total_campaigns: 0, 
    total_contacts: 0, 
    total_messages: 0 
  });
  const [loading, setLoading] = useState(true);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);

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

    // Fetch campaigns count per user
    const { data: campaigns } = await supabase
      .from("campaigns")
      .select("user_id");

    // Fetch contacts count per user
    const { data: contacts } = await supabase
      .from("contacts")
      .select("user_id");

    // Fetch messages count
    const { data: messages } = await supabase
      .from("messages")
      .select("id, campaign_id");

    // Build user stats
    const usersWithStats: UserWithStats[] = profiles?.map(profile => {
      const userRole = roles?.find(r => r.user_id === profile.id);
      const userCampaigns = campaigns?.filter(c => c.user_id === profile.id) || [];
      const userContacts = contacts?.filter(c => c.user_id === profile.id) || [];
      
      return {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        role: (userRole?.role as "admin" | "user") || "user",
        campaigns_count: userCampaigns.length,
        contacts_count: userContacts.length,
        messages_count: 0, // Will calculate below
      };
    }) || [];

    // Calculate global stats
    setStats({
      total_users: profiles?.length || 0,
      total_campaigns: campaigns?.length || 0,
      total_contacts: contacts?.length || 0,
      total_messages: messages?.length || 0,
    });

    setUsers(usersWithStats);
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

  return (
    <DashboardLayout user={user}>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Crown className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Painel Administrativo</h1>
            <p className="text-muted-foreground">Gerencie usuários e visualize métricas globais</p>
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
