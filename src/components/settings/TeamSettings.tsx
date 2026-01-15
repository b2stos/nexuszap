import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  UserPlus, 
  Shield, 
  Crown, 
  User, 
  Megaphone, 
  Headphones, 
  Eye,
  Loader2,
  MoreHorizontal,
  UserCog,
  UserX,
  Power,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantRole } from '@/hooks/useTenantRole';
import { toast } from 'sonner';

type TenantUserRole = 'owner' | 'admin' | 'manager' | 'marketing' | 'agent' | 'attendant' | 'readonly';

interface TeamMember {
  id: string;
  user_id: string;
  role: TenantUserRole;
  is_active: boolean;
  created_at: string;
  profile?: {
    email: string;
    full_name: string | null;
  };
}

const roleConfig: Record<TenantUserRole, { label: string; icon: typeof User; color: string; permissions: string[] }> = {
  owner: { 
    label: 'Proprietário', 
    icon: Crown, 
    color: 'bg-amber-500',
    permissions: ['Acesso total', 'Gerenciar equipe', 'Configurações do tenant']
  },
  admin: { 
    label: 'Administrador', 
    icon: Shield, 
    color: 'bg-blue-500',
    permissions: ['Acesso total', 'Gerenciar equipe']
  },
  manager: { 
    label: 'Gerente', 
    icon: User, 
    color: 'bg-purple-500',
    permissions: ['Inbox', 'Campanhas', 'Templates', 'Contatos', 'Canais']
  },
  marketing: { 
    label: 'Marketing', 
    icon: Megaphone, 
    color: 'bg-green-500',
    permissions: ['Campanhas', 'Templates', 'Contatos']
  },
  agent: { 
    label: 'Agente', 
    icon: Headphones, 
    color: 'bg-cyan-500',
    permissions: ['Inbox', 'Contatos']
  },
  attendant: { 
    label: 'Atendente', 
    icon: Headphones, 
    color: 'bg-teal-500',
    permissions: ['Inbox', 'Contatos']
  },
  readonly: { 
    label: 'Somente Leitura', 
    icon: Eye, 
    color: 'bg-gray-500',
    permissions: ['Visualizar tudo (sem editar)']
  },
};

export function TeamSettings() {
  const { tenantId, isOwner, isAdmin, isSuperAdmin } = useTenantRole();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<TenantUserRole>('agent');
  const [isInviting, setIsInviting] = useState(false);
  
  // Edit role state
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [newRole, setNewRole] = useState<TenantUserRole>('agent');
  const [isSavingRole, setIsSavingRole] = useState(false);
  
  // Delete confirmation state
  const [deletingMember, setDeletingMember] = useState<TeamMember | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Toggle status state
  const [togglingMember, setTogglingMember] = useState<string | null>(null);

  const canManageTeam = isOwner || isSuperAdmin;
  const canViewActions = isOwner || isAdmin || isSuperAdmin;
  
  // Count owners to prevent removing last one
  const ownerCount = members.filter(m => m.role === 'owner').length;

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    getUser();
  }, []);

  useEffect(() => {
    if (tenantId) {
      fetchMembers();
    }
  }, [tenantId]);

  const fetchMembers = async () => {
    if (!tenantId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('tenant_users')
        .select(`
          id,
          user_id,
          role,
          is_active,
          created_at
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const memberIds = data?.map(m => m.user_id) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', memberIds);

      const membersWithProfiles = (data || []).map(member => ({
        ...member,
        role: member.role as TenantUserRole,
        profile: profiles?.find(p => p.id === member.user_id),
      }));

      setMembers(membersWithProfiles);
    } catch (err) {
      console.error('Error fetching team members:', err);
      toast.error('Erro ao carregar equipe');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail || !tenantId) return;
    
    setIsInviting(true);
    try {
      toast.info('Funcionalidade de convite por email em desenvolvimento');
      setIsInviteOpen(false);
      setInviteEmail('');
    } catch (err) {
      console.error('Error inviting user:', err);
      toast.error('Erro ao convidar usuário');
    } finally {
      setIsInviting(false);
    }
  };

  const handleOpenEditRole = (member: TeamMember) => {
    // Check if trying to edit own owner role
    if (member.role === 'owner' && member.user_id === currentUserId) {
      toast.error('Você não pode alterar sua própria função de Proprietário');
      return;
    }
    // Check if trying to change last owner
    if (member.role === 'owner' && ownerCount <= 1) {
      toast.error('Não é possível alterar a função do único Proprietário');
      return;
    }
    setEditingMember(member);
    setNewRole(member.role === 'owner' ? 'admin' : member.role);
  };

  const handleSaveRole = async () => {
    if (!editingMember) return;

    setIsSavingRole(true);
    
    // Optimistic update
    const previousMembers = [...members];
    setMembers(prev => prev.map(m => 
      m.id === editingMember.id ? { ...m, role: newRole } : m
    ));

    try {
      const { error } = await supabase
        .from('tenant_users')
        .update({ role: newRole })
        .eq('id', editingMember.id);

      if (error) throw error;

      toast.success('Função atualizada com sucesso');
      setEditingMember(null);
    } catch (err) {
      console.error('Error updating role:', err);
      setMembers(previousMembers); // Rollback
      toast.error('Erro ao atualizar função');
    } finally {
      setIsSavingRole(false);
    }
  };

  const handleToggleStatus = async (member: TeamMember) => {
    // Check permissions
    if (!canManageTeam) {
      toast.error('Sem permissão para alterar status');
      return;
    }
    
    // Prevent deactivating self if owner
    if (member.user_id === currentUserId && member.role === 'owner') {
      toast.error('Você não pode desativar a si mesmo como Proprietário');
      return;
    }
    
    // Prevent deactivating last owner
    if (member.role === 'owner' && ownerCount <= 1 && member.is_active) {
      toast.error('Não é possível desativar o único Proprietário');
      return;
    }

    setTogglingMember(member.id);
    const newStatus = !member.is_active;
    
    // Optimistic update
    const previousMembers = [...members];
    setMembers(prev => prev.map(m => 
      m.id === member.id ? { ...m, is_active: newStatus } : m
    ));

    try {
      const { error } = await supabase
        .from('tenant_users')
        .update({ is_active: newStatus })
        .eq('id', member.id);

      if (error) throw error;

      toast.success(newStatus ? 'Membro ativado' : 'Membro desativado');
    } catch (err) {
      console.error('Error toggling status:', err);
      setMembers(previousMembers); // Rollback
      toast.error('Erro ao alterar status');
    } finally {
      setTogglingMember(null);
    }
  };

  const handleOpenDelete = (member: TeamMember) => {
    // Check permissions
    if (!canManageTeam) {
      toast.error('Sem permissão para excluir membros');
      return;
    }
    
    // Prevent deleting self if owner
    if (member.user_id === currentUserId && member.role === 'owner') {
      toast.error('Você não pode excluir a si mesmo como Proprietário');
      return;
    }
    
    // Prevent deleting last owner
    if (member.role === 'owner' && ownerCount <= 1) {
      toast.error('Não é possível excluir o único Proprietário');
      return;
    }

    setDeletingMember(member);
  };

  const handleConfirmDelete = async () => {
    if (!deletingMember) return;

    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from('tenant_users')
        .delete()
        .eq('id', deletingMember.id);

      if (error) throw error;

      setMembers(prev => prev.filter(m => m.id !== deletingMember.id));
      toast.success('Membro removido');
      setDeletingMember(null);
    } catch (err) {
      console.error('Error deleting member:', err);
      toast.error('Erro ao remover membro');
    } finally {
      setIsDeleting(false);
    }
  };

  const getInitials = (member: TeamMember) => {
    return member.profile?.full_name
      ?.split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || member.profile?.email?.[0]?.toUpperCase() || '?';
  };

  const canEditMember = (member: TeamMember) => {
    if (!canManageTeam) return false;
    if (member.user_id === currentUserId && member.role === 'owner') return false;
    if (member.role === 'owner' && ownerCount <= 1) return false;
    return true;
  };

  // Actions menu component
  const MemberActionsMenu = ({ member }: { member: TeamMember }) => {
    const canEdit = canEditMember(member);
    const isSelf = member.user_id === currentUserId;
    const isLastOwner = member.role === 'owner' && ownerCount <= 1;

    if (!canViewActions) return null;

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Ações</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem 
            onClick={() => handleOpenEditRole(member)}
            disabled={!canEdit}
            className="gap-2"
          >
            <UserCog className="h-4 w-4" />
            Alterar função
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => handleToggleStatus(member)}
            disabled={!canEdit || togglingMember === member.id}
            className="gap-2"
          >
            <Power className="h-4 w-4" />
            {member.is_active ? 'Desativar' : 'Ativar'}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={() => handleOpenDelete(member)}
            disabled={!canEdit}
            className="gap-2 text-destructive focus:text-destructive"
          >
            <UserX className="h-4 w-4" />
            Excluir membro
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  // Render member as card (for mobile/tablet)
  const renderMemberCard = (member: TeamMember) => {
    const role = roleConfig[member.role] || roleConfig.agent;
    const Icon = role.icon;
    const initials = getInitials(member);
    const isSelf = member.user_id === currentUserId;

    return (
      <div key={member.id} className="p-4 rounded-lg border bg-card">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarFallback className="text-sm">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm truncate">
                {member.profile?.full_name || 'Sem nome'}
                {isSelf && <span className="text-muted-foreground ml-1">(você)</span>}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {member.profile?.email}
              </p>
            </div>
          </div>
          <MemberActionsMenu member={member} />
        </div>
        <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded ${role.color}`}>
              <Icon className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-medium">{role.label}</span>
          </div>
          <Badge 
            variant={member.is_active ? 'default' : 'secondary'}
            className={member.is_active ? 'bg-green-500/10 text-green-600 hover:bg-green-500/20' : ''}
          >
            {member.is_active ? 'Ativo' : 'Inativo'}
          </Badge>
        </div>
      </div>
    );
  };

  // Render member as table row (for desktop)
  const renderMemberRow = (member: TeamMember) => {
    const role = roleConfig[member.role] || roleConfig.agent;
    const Icon = role.icon;
    const initials = getInitials(member);
    const isSelf = member.user_id === currentUserId;

    return (
      <tr key={member.id} className="border-b last:border-0 hover:bg-muted/50">
        <td className="py-3 pr-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">
                {member.profile?.full_name || 'Sem nome'}
                {isSelf && <span className="text-muted-foreground ml-1">(você)</span>}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {member.profile?.email}
              </p>
            </div>
          </div>
        </td>
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded ${role.color}`}>
              <Icon className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm whitespace-nowrap">{role.label}</span>
          </div>
        </td>
        <td className="py-3 px-4">
          <Badge 
            variant={member.is_active ? 'default' : 'secondary'}
            className={member.is_active ? 'bg-green-500/10 text-green-600 hover:bg-green-500/20' : ''}
          >
            {member.is_active ? 'Ativo' : 'Inativo'}
          </Badge>
        </td>
        <td className="py-3 pl-4 text-right">
          <MemberActionsMenu member={member} />
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Equipe e Permissões</h3>
          <p className="text-sm text-muted-foreground">
            Gerencie os membros do seu workspace
          </p>
        </div>
        {canManageTeam && (
          <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <UserPlus className="h-4 w-4 mr-2" />
                Convidar
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Convidar Membro</DialogTitle>
                <DialogDescription>
                  Envie um convite por email para adicionar um novo membro à equipe
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="nome@empresa.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Função</Label>
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as TenantUserRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(roleConfig)
                        .filter(([key]) => key !== 'owner')
                        .map(([key, config]) => (
                          <SelectItem key={key} value={key}>
                            {config.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={() => setIsInviteOpen(false)} className="w-full sm:w-auto">
                  Cancelar
                </Button>
                <Button onClick={handleInvite} disabled={isInviting || !inviteEmail} className="w-full sm:w-auto">
                  {isInviting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Enviar Convite
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Roles Overview - Collapsible on mobile */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Funções Disponíveis</CardTitle>
          <CardDescription>
            Cada função tem permissões específicas para diferentes módulos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
            {Object.entries(roleConfig).map(([key, config]) => {
              const Icon = config.icon;
              return (
                <div key={key} className="p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`p-1.5 rounded ${config.color}`}>
                      <Icon className="h-4 w-4 text-white" />
                    </div>
                    <span className="font-medium text-sm">{config.label}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {config.permissions.map((perm) => (
                      <Badge key={perm} variant="secondary" className="text-xs">
                        {perm}
                      </Badge>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Team Members */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Membros da Equipe</CardTitle>
          <CardDescription>
            {members.length} {members.length === 1 ? 'membro' : 'membros'} no workspace
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum membro encontrado
            </div>
          ) : (
            <>
              {/* Mobile/Tablet: Cards layout */}
              <div className="lg:hidden space-y-3">
                {members.map(renderMemberCard)}
              </div>

              {/* Desktop: Table layout */}
              <div className="hidden lg:block -mx-2">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[500px]">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-3 pr-4 text-sm font-medium text-muted-foreground">Usuário</th>
                        <th className="pb-3 px-4 text-sm font-medium text-muted-foreground">Função</th>
                        <th className="pb-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                        <th className="pb-3 pl-4 text-sm font-medium text-muted-foreground text-right w-16">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map(renderMemberRow)}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit Role Modal */}
      <Dialog open={!!editingMember} onOpenChange={(open) => !open && setEditingMember(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Alterar Função</DialogTitle>
            <DialogDescription>
              Altere a função de {editingMember?.profile?.full_name || editingMember?.profile?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Nova Função</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as TenantUserRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(roleConfig)
                    .filter(([key]) => key !== 'owner')
                    .map(([key, config]) => {
                      const Icon = config.icon;
                      return (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            <div className={`p-1 rounded ${config.color}`}>
                              <Icon className="h-3 w-3 text-white" />
                            </div>
                            {config.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
            </div>
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-xs text-muted-foreground mb-2">Permissões da função:</p>
              <div className="flex flex-wrap gap-1">
                {roleConfig[newRole]?.permissions.map((perm) => (
                  <Badge key={perm} variant="secondary" className="text-xs">
                    {perm}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setEditingMember(null)} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button onClick={handleSaveRole} disabled={isSavingRole} className="w-full sm:w-auto">
              {isSavingRole && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <AlertDialog open={!!deletingMember} onOpenChange={(open) => !open && setDeletingMember(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Excluir membro?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação remove o acesso de{' '}
              <strong>{deletingMember?.profile?.full_name || deletingMember?.profile?.email}</strong>{' '}
              a este workspace. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto">Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
