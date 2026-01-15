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
  Edit2
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
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [newRole, setNewRole] = useState<TenantUserRole>('agent');

  const canManageTeam = isOwner || isAdmin || isSuperAdmin;

  // Get current user id
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

      // Fetch profiles for each user
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
      // In a real implementation, this would send an invite email
      // For now, we'll just show a message
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
    if (member.role === 'owner' && member.user_id === currentUserId) {
      toast.error('Você não pode alterar sua própria função de Proprietário');
      return;
    }
    setEditingMember(member);
    setNewRole(member.role === 'owner' ? 'admin' : member.role);
  };

  const handleSaveRole = async () => {
    if (!editingMember) return;

    try {
      const { error } = await supabase
        .from('tenant_users')
        .update({ role: newRole })
        .eq('id', editingMember.id);

      if (error) throw error;

      toast.success('Função atualizada com sucesso');
      setEditingMember(null);
      fetchMembers();
    } catch (err) {
      console.error('Error updating role:', err);
      toast.error('Erro ao atualizar função');
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

  // Render member as card (for mobile)
  const renderMemberCard = (member: TeamMember) => {
    const role = roleConfig[member.role] || roleConfig.agent;
    const Icon = role.icon;
    const initials = getInitials(member);

    return (
      <div key={member.id} className="p-4 rounded-lg border bg-card space-y-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="text-sm">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">
              {member.profile?.full_name || 'Sem nome'}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {member.profile?.email}
            </p>
          </div>
          <Badge variant={member.is_active ? 'default' : 'secondary'} className="shrink-0">
            {member.is_active ? 'Ativo' : 'Inativo'}
          </Badge>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded ${role.color}`}>
              <Icon className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-medium">{role.label}</span>
          </div>
          {canManageTeam && member.role !== 'owner' && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleOpenEditRole(member)}
            >
              <Edit2 className="h-3.5 w-3.5 mr-1.5" />
              Alterar
            </Button>
          )}
        </div>
      </div>
    );
  };

  // Render member as table row (for desktop)
  const renderMemberRow = (member: TeamMember) => {
    const role = roleConfig[member.role] || roleConfig.agent;
    const Icon = role.icon;
    const initials = getInitials(member);

    return (
      <tr key={member.id} className="border-b last:border-0">
        <td className="py-3 pr-2">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-medium text-sm truncate max-w-[180px]">
                {member.profile?.full_name || 'Sem nome'}
              </p>
              <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                {member.profile?.email}
              </p>
            </div>
          </div>
        </td>
        <td className="py-3 px-2">
          <div className="flex items-center gap-2">
            <div className={`p-1 rounded ${role.color}`}>
              <Icon className="h-3 w-3 text-white" />
            </div>
            <span className="text-sm whitespace-nowrap">{role.label}</span>
          </div>
        </td>
        <td className="py-3 px-2">
          <Badge variant={member.is_active ? 'default' : 'secondary'}>
            {member.is_active ? 'Ativo' : 'Inativo'}
          </Badge>
        </td>
        {canManageTeam && (
          <td className="py-3 pl-2">
            {member.role !== 'owner' && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => handleOpenEditRole(member)}
              >
                <Edit2 className="h-3.5 w-3.5 mr-1" />
                Editar
              </Button>
            )}
          </td>
        )}
      </tr>
    );
  };

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
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
                  <select
                    id="role"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as TenantUserRole)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {Object.entries(roleConfig)
                      .filter(([key]) => key !== 'owner')
                      .map(([key, config]) => (
                        <option key={key} value={key}>
                          {config.label}
                        </option>
                      ))}
                  </select>
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

      {/* Roles Overview */}
      <Card>
        <CardHeader>
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
        <CardHeader>
          <CardTitle className="text-base">Membros da Equipe</CardTitle>
          <CardDescription>
            {members.length} {members.length === 1 ? 'membro' : 'membros'} no workspace
          </CardDescription>
        </CardHeader>
        <CardContent>
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
              {/* Mobile: Cards layout */}
              <div className="lg:hidden space-y-3">
                {members.map(renderMemberCard)}
              </div>

              {/* Desktop: Table layout */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-3 text-sm font-medium text-muted-foreground">Usuário</th>
                      <th className="pb-3 px-2 text-sm font-medium text-muted-foreground">Função</th>
                      <th className="pb-3 px-2 text-sm font-medium text-muted-foreground">Status</th>
                      {canManageTeam && <th className="pb-3 pl-2 text-sm font-medium text-muted-foreground w-[100px]">Ações</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {members.map(renderMemberRow)}
                  </tbody>
                </table>
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
          <div className="py-4">
            <Label htmlFor="newRole">Nova Função</Label>
            <select
              id="newRole"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as TenantUserRole)}
              className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {Object.entries(roleConfig)
                .filter(([key]) => key !== 'owner')
                .map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.label}
                  </option>
                ))}
            </select>
            <div className="mt-3 p-3 rounded-lg bg-muted">
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
            <Button onClick={handleSaveRole} className="w-full sm:w-auto">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
