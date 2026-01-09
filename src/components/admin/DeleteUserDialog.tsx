/**
 * DeleteUserDialog Component
 * 
 * Modal de confirmação para exclusão (desativação) de usuário
 * Apenas Super Admins podem usar
 */

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuditLog } from "@/hooks/useAuditLog";

interface DeleteUserDialogProps {
  userId: string;
  userEmail: string;
  userName: string | null;
  currentUserId: string;
  onUserDeleted: (userId: string) => void;
}

export function DeleteUserDialog({
  userId,
  userEmail,
  userName,
  currentUserId,
  onUserDeleted,
}: DeleteUserDialogProps) {
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const { logAction } = useAuditLog();

  // Verificar se é self-delete
  const isSelfDelete = userId === currentUserId;

  const handleDelete = async () => {
    // Proteção extra: não permitir self-delete
    if (isSelfDelete) {
      toast({
        title: "Ação não permitida",
        description: "Você não pode excluir sua própria conta.",
        variant: "destructive",
      });
      setOpen(false);
      return;
    }

    setIsDeleting(true);

    try {
      // Verificar se é o último Super Admin (por email na lista de super admins)
      // Para isso, contamos quantos usuários ativos existem que são super admins
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email");

      // Importar a função de super admin
      const { isSuperAdminEmail, getSuperAdminEmails } = await import("@/utils/superAdmin");
      
      const superAdminEmails = getSuperAdminEmails();
      const activeSuperAdmins = profiles?.filter(p => 
        superAdminEmails.includes(p.email.toLowerCase())
      ) || [];

      // Se o usuário a ser excluído é um super admin e é o único
      if (isSuperAdminEmail(userEmail) && activeSuperAdmins.length <= 1) {
        toast({
          title: "Ação não permitida",
          description: "Não é possível excluir o último Super Admin do sistema.",
          variant: "destructive",
        });
        setIsDeleting(false);
        setOpen(false);
        return;
      }

      // Soft delete: desativar o usuário em tenant_users
      const { error: tenantError } = await supabase
        .from("tenant_users")
        .update({ is_active: false })
        .eq("user_id", userId);

      if (tenantError) {
        console.error("Error deactivating tenant user:", tenantError);
        // Continuar mesmo se não houver entrada em tenant_users
      }

      // Log da ação de auditoria
      await logAction({
        action: "user.deactivate",
        entity_type: "user",
        entity_id: userId,
        metadata: {
          target_email: userEmail,
          target_name: userName,
        },
      });

      toast({
        title: "Usuário desativado",
        description: `O usuário ${userEmail} foi desativado com sucesso.`,
      });

      onUserDeleted(userId);
      setOpen(false);
    } catch (error) {
      console.error("Error deleting user:", error);
      toast({
        title: "Erro",
        description: "Não foi possível desativar o usuário.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
          disabled={isSelfDelete}
          title={isSelfDelete ? "Você não pode excluir sua própria conta" : "Excluir usuário"}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-3">
            <div className="bg-muted p-3 rounded-lg space-y-1">
              <p className="text-sm">
                <span className="text-muted-foreground">Nome:</span>{" "}
                <span className="font-medium text-foreground">{userName || "Sem nome"}</span>
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">Email:</span>{" "}
                <span className="font-medium text-foreground">{userEmail}</span>
              </p>
            </div>
            <p className="text-destructive font-medium flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" />
              Essa ação é irreversível
            </p>
            <p className="text-sm text-muted-foreground">
              O usuário será desativado e não poderá mais acessar o sistema. 
              Os dados associados serão mantidos para fins de auditoria.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Excluindo...
              </>
            ) : (
              "Excluir usuário"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
