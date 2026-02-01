/**
 * AddMTContactDialog Component
 * 
 * Reusable dialog for manually adding contacts to the mt_contacts table.
 * Used in both Campaign creation flow and Contacts page.
 */

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, UserPlus } from 'lucide-react';

// Validation schema
const mtContactSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo'),
  phone: z
    .string()
    .trim()
    .min(10, 'Telefone deve ter no mínimo 10 dígitos')
    .max(15, 'Telefone deve ter no máximo 15 dígitos')
    .regex(/^[0-9]+$/, 'Telefone deve conter apenas números'),
  email: z
    .string()
    .email('Email inválido')
    .optional()
    .or(z.literal('')),
});

type MTContactFormData = z.infer<typeof mtContactSchema>;

export interface MTContact {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
}

interface AddMTContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  onSuccess?: (contact: MTContact) => void;
}

export function AddMTContactDialog({
  open,
  onOpenChange,
  tenantId,
  onSuccess,
}: AddMTContactDialogProps) {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<MTContactFormData>({
    name: '',
    phone: '',
    email: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof MTContactFormData, string>>>({});

  const resetForm = () => {
    setFormData({ name: '', phone: '', email: '' });
    setErrors({});
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      resetForm();
    }
    onOpenChange(isOpen);
  };

  const normalizePhone = (phone: string): string => {
    return phone.replace(/\D/g, '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Normalize phone before validation
    const normalizedData = {
      ...formData,
      phone: normalizePhone(formData.phone),
    };

    // Validate
    const result = mtContactSchema.safeParse(normalizedData);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof MTContactFormData, string>> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as keyof MTContactFormData] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);

    try {
      // Upsert contact (insert or update if phone already exists for this tenant)
      const { data, error } = await supabase
        .from('mt_contacts')
        .upsert(
          {
            tenant_id: tenantId,
            phone: normalizedData.phone,
            name: normalizedData.name,
            email: normalizedData.email || null,
          },
          {
            onConflict: 'tenant_id,phone',
            ignoreDuplicates: false,
          }
        )
        .select('id, phone, name, email')
        .single();

      if (error) throw error;

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['mt-contacts', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['all-contacts-for-campaign-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] }); // Legacy query key

      toast({
        title: 'Contato adicionado!',
        description: `${normalizedData.name} foi adicionado com sucesso.`,
      });

      // Call success callback if provided
      if (onSuccess && data) {
        onSuccess(data as MTContact);
      }

      handleClose(false);
    } catch (error: any) {
      console.error('Error adding contact:', error);
      toast({
        title: 'Erro ao adicionar contato',
        description: error.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhoneChange = (value: string) => {
    // Allow typing with formatting, but store normalized
    setFormData({ ...formData, phone: value });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Adicionar Contato
          </DialogTitle>
          <DialogDescription>
            Adicione um novo contato manualmente. O telefone deve incluir DDI e DDD.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              Nome <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="Ex: João Silva"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              disabled={isLoading}
              autoFocus
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">
              Telefone (WhatsApp) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="phone"
              placeholder="Ex: 5511999999999"
              value={formData.phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Formato: DDI + DDD + número (somente números)
            </p>
            {errors.phone && (
              <p className="text-xs text-destructive">{errors.phone}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email (opcional)</Label>
            <Input
              id="email"
              type="email"
              placeholder="Ex: joao@email.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              disabled={isLoading}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adicionando...
                </>
              ) : (
                'Adicionar'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
