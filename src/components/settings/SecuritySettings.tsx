import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Shield, 
  Key, 
  LogOut, 
  AlertTriangle,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export function SecuritySettings() {
  const navigate = useNavigate();
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChanging, setIsChanging] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setIsChanging(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast.success('Senha alterada com sucesso');
      setIsChangePasswordOpen(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error('Error changing password:', err);
      toast.error(err?.message || 'Erro ao alterar senha');
    } finally {
      setIsChanging(false);
    }
  };

  const handleSignOutAll = async () => {
    setIsSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: 'global' });

      if (error) throw error;

      toast.success('Desconectado de todos os dispositivos');
      navigate('/auth');
    } catch (err: any) {
      console.error('Error signing out:', err);
      toast.error(err?.message || 'Erro ao desconectar');
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Segurança</h3>
        <p className="text-sm text-muted-foreground">
          Gerencie a segurança da sua conta
        </p>
      </div>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-5 w-5" />
            Senha
          </CardTitle>
          <CardDescription>
            Altere sua senha de acesso
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={isChangePasswordOpen} onOpenChange={setIsChangePasswordOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                Alterar Senha
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Alterar Senha</DialogTitle>
                <DialogDescription>
                  Digite sua nova senha abaixo
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">Nova Senha</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmar Senha</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                {newPassword && confirmPassword && newPassword !== confirmPassword && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>As senhas não coincidem</AlertDescription>
                  </Alert>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsChangePasswordOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleChangePassword} 
                  disabled={isChanging || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                >
                  {isChanging ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  Salvar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* Sign Out All Devices */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <LogOut className="h-5 w-5" />
            Sessões
          </CardTitle>
          <CardDescription>
            Gerencie suas sessões ativas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              Isso irá desconectar você de todos os dispositivos, incluindo este.
              Você precisará fazer login novamente.
            </AlertDescription>
          </Alert>
          <Button 
            variant="destructive" 
            onClick={handleSignOutAll}
            disabled={isSigningOut}
          >
            {isSigningOut ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4 mr-2" />
            )}
            Sair de Todos os Dispositivos
          </Button>
        </CardContent>
      </Card>

      {/* Security Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dicas de Segurança</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span>Use uma senha forte com pelo menos 8 caracteres</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span>Não compartilhe suas credenciais com terceiros</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span>Revogue acessos de dispositivos não reconhecidos</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span>Mantenha seu token da Meta em sigilo</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
