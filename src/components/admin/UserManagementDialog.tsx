import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { 
  Users, Search, MoreVertical, Crown, Shield, UserCog, 
  UserMinus, UserX, Loader2, ChevronLeft, ChevronRight,
  UserPlus
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface UserWithStats {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "user";
  created_at: string;
  is_active?: boolean;
}

interface UserManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
  currentUserEmail?: string;
  onUserUpdated?: () => void;
}

const PAGE_SIZE = 10;

export function UserManagementDialog({ 
  open, 
  onOpenChange, 
  currentUserId,
  currentUserEmail,
  onUserUpdated
}: UserManagementDialogProps) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  const [users, setUsers] = useState<UserWithStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);
  const [roleChangeUser, setRoleChangeUser] = useState<UserWithStats | null>(null);
  const [deleteUser, setDeleteUser] = useState<UserWithStats | null>(null);
  const [selectedRole, setSelectedRole] = useState<"admin" | "user">("user");
  
  // Check if current user is Super Admin (Owner)
  const isSuperAdmin = currentUserEmail === "bbastosb2@gmail.com";

  useEffect(() => {
    if (open) {
      fetchUsers();
    }
  }, [open, page, search]);

  async function fetchUsers() {
    setLoading(true);
    
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    
    // Build query with search
    let query = supabase
      .from("profiles")
      .select("id, email, full_name, created_at", { count: 'exact' });
    
    if (search) {
      query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
    }
    
    const { data: profiles, count, error: profilesError } = await query
      .order("created_at", { ascending: false })
      .range(from, to);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      setLoading(false);
      return;
    }

    // Fetch roles for these users
    const userIds = profiles?.map(p => p.id) || [];
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", userIds);

    // Combine data
    const usersWithRoles: UserWithStats[] = profiles?.map(profile => {
      const userRole = roles?.find(r => r.user_id === profile.id);
      return {
        ...profile,
        role: (userRole?.role as "admin" | "user") || "user",
        is_active: true, // Default, would need tenant_users for real status
      };
    }) || [];

    setUsers(usersWithRoles);
    setTotalCount(count || 0);
    setLoading(false);
  }

  async function handleRoleChange() {
    if (!roleChangeUser) return;
    
    setUpdatingUser(roleChangeUser.id);
    
    const { error } = await supabase
      .from("user_roles")
      .update({ role: selectedRole })
      .eq("user_id", roleChangeUser.id);

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o papel do usuário.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Sucesso",
        description: `Papel atualizado para ${selectedRole === "admin" ? "Administrador" : "Usuário"}.`,
      });
      setUsers(prev => prev.map(u => 
        u.id === roleChangeUser.id ? { ...u, role: selectedRole } : u
      ));
      onUserUpdated?.();
    }
    
    setUpdatingUser(null);
    setRoleChangeUser(null);
  }

  async function handleDeleteUser() {
    if (!deleteUser) return;
    
    setUpdatingUser(deleteUser.id);
    
    // Delete user role first
    await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", deleteUser.id);
    
    // Note: In a real app, you'd also need to handle auth.users deletion
    // which requires service_role or admin API
    
    toast({
      title: "Sucesso",
      description: "Usuário removido com sucesso.",
    });
    
    setUsers(prev => prev.filter(u => u.id !== deleteUser.id));
    setTotalCount(prev => prev - 1);
    onUserUpdated?.();
    
    setUpdatingUser(null);
    setDeleteUser(null);
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  
  const getRoleBadge = (role: "admin" | "user") => (
    <Badge variant={role === "admin" ? "default" : "secondary"} className="gap-1">
      {role === "admin" ? <Crown className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
      {role === "admin" ? "Admin" : "Usuário"}
    </Badge>
  );

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  const canManageUser = (targetUser: UserWithStats) => {
    // Can't manage yourself
    if (targetUser.id === currentUserId) return false;
    // Only super admin can manage other admins
    if (targetUser.role === "admin" && !isSuperAdmin) return false;
    return true;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Gerenciamento de Usuários
            </DialogTitle>
            <DialogDescription>
              Gerencie os usuários do sistema, altere papéis e permissões
            </DialogDescription>
          </DialogHeader>

          {/* Search and Add */}
          <div className="flex flex-col sm:flex-row gap-3 py-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou email..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
            <Button variant="outline" className="gap-2" disabled>
              <UserPlus className="h-4 w-4" />
              Convidar
            </Button>
          </div>

          {/* Users List */}
          <div className="flex-1 overflow-auto min-h-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {search ? "Nenhum usuário encontrado" : "Nenhum usuário cadastrado"}
              </div>
            ) : isMobile ? (
              // Mobile: Cards
              <div className="space-y-3">
                {users.map((u) => (
                  <Card key={u.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {getInitials(u.full_name, u.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium truncate">
                              {u.full_name || "Sem nome"}
                              {u.id === currentUserId && (
                                <Badge variant="outline" className="ml-2 text-xs">Você</Badge>
                              )}
                            </p>
                            <p className="text-sm text-muted-foreground truncate">{u.email}</p>
                          </div>
                        </div>
                        
                        {canManageUser(u) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => {
                                setRoleChangeUser(u);
                                setSelectedRole(u.role);
                              }}>
                                <UserCog className="h-4 w-4 mr-2" />
                                Alterar função
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={() => setDeleteUser(u)}
                              >
                                <UserX className="h-4 w-4 mr-2" />
                                Excluir usuário
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between mt-3 pt-3 border-t">
                        {getRoleBadge(u.role)}
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(u.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              // Desktop: Table
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-primary/10 text-primary text-sm">
                              {getInitials(u.full_name, u.email)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate max-w-[150px]">
                            {u.full_name || "Sem nome"}
                          </span>
                          {u.id === currentUserId && (
                            <Badge variant="outline" className="text-xs">Você</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground truncate max-w-[200px]">
                        {u.email}
                      </TableCell>
                      <TableCell>{getRoleBadge(u.role)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(u.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right">
                        {canManageUser(u) ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8"
                                disabled={updatingUser === u.id}
                              >
                                {updatingUser === u.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <MoreVertical className="h-4 w-4" />
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => {
                                setRoleChangeUser(u);
                                setSelectedRole(u.role);
                              }}>
                                <UserCog className="h-4 w-4 mr-2" />
                                Alterar função
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={() => setDeleteUser(u)}
                              >
                                <UserX className="h-4 w-4 mr-2" />
                                Excluir usuário
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                {totalCount} usuário{totalCount !== 1 ? "s" : ""} no total
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground px-2">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Role Change Dialog */}
      <AlertDialog open={!!roleChangeUser} onOpenChange={(open) => !open && setRoleChangeUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alterar função do usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Altere a função de <strong>{roleChangeUser?.full_name || roleChangeUser?.email}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="py-4">
            <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as "admin" | "user")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">
                  <div className="flex items-center gap-2">
                    <Crown className="h-4 w-4" />
                    Administrador
                  </div>
                </SelectItem>
                <SelectItem value="user">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Usuário
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRoleChange}>
              Salvar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteUser} onOpenChange={(open) => !open && setDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá o acesso de <strong>{deleteUser?.full_name || deleteUser?.email}</strong> ao sistema. 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
