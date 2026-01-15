import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  UserPlus, 
  Shield, 
  Crown, 
  User, 
  Megaphone, 
  Headphones, 
  Eye,
  MoreHorizontal,
  Loader2
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
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<TenantUserRole>('agent');
  const [isInviting, setIsInviting] = useState(false);

  const canManageTeam = isOwner || isAdmin || isSuperAdmin;

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

  const updateMemberRole = async (memberId: string, newRole: TenantUserRole) => {
    try {
      const { error } = await supabase
        .from('tenant_users')
        .update({ role: newRole })
        .eq('id', memberId);

      if (error) throw error;

      toast.success('Função atualizada');
      fetchMembers();
    } catch (err) {
      console.error('Error updating role:', err);
      toast.error('Erro ao atualizar função');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Equipe e Permissões</h3>
          <p className="text-sm text-muted-foreground">
            Gerencie os membros do seu workspace
          </p>
        </div>
        {canManageTeam && (
          <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Convidar
              </Button>
            </DialogTrigger>
            <DialogContent>
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
                      {Object.entries(roleConfig).filter(([key]) => key !== 'owner').map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            <config.icon className="h-4 w-4" />
                            {config.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsInviteOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleInvite} disabled={isInviting || !inviteEmail}>
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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

      {/* Team Members Table */}
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Status</TableHead>
                  {canManageTeam && <TableHead className="w-[50px]"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => {
                  const role = roleConfig[member.role] || roleConfig.agent;
                  const Icon = role.icon;
                  const initials = member.profile?.full_name
                    ?.split(' ')
                    .map(n => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase() || member.profile?.email?.[0]?.toUpperCase() || '?';

                  return (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-sm">
                              {member.profile?.full_name || 'Sem nome'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {member.profile?.email}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {canManageTeam && member.role !== 'owner' ? (
                          <Select 
                            value={member.role} 
                            onValueChange={(v) => updateMemberRole(member.id, v as TenantUserRole)}
                          >
                            <SelectTrigger className="w-[160px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(roleConfig).filter(([key]) => key !== 'owner').map(([key, config]) => (
                                <SelectItem key={key} value={key}>
                                  <div className="flex items-center gap-2">
                                    <config.icon className="h-4 w-4" />
                                    {config.label}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className={`p-1 rounded ${role.color}`}>
                              <Icon className="h-3 w-3 text-white" />
                            </div>
                            <span className="text-sm">{role.label}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={member.is_active ? 'default' : 'secondary'}>
                          {member.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      {canManageTeam && (
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
