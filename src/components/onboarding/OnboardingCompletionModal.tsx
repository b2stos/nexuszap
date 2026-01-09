/**
 * OnboardingCompletionModal Component
 * 
 * Modal de conclusão do onboarding
 */

import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PartyPopper, MessageSquare, Megaphone } from 'lucide-react';

interface OnboardingCompletionModalProps {
  open: boolean;
  onClose: () => void;
}

export function OnboardingCompletionModal({ open, onClose }: OnboardingCompletionModalProps) {
  const navigate = useNavigate();

  const handleGoToInbox = () => {
    onClose();
    navigate('/dashboard/inbox');
  };

  const handleGoToCampaigns = () => {
    onClose();
    navigate('/dashboard/campaigns');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md text-center">
        <DialogHeader className="text-center pb-2">
          <div className="mx-auto w-20 h-20 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mb-4 animate-bounce">
            <PartyPopper className="w-10 h-10 text-white" />
          </div>
          <DialogTitle className="text-2xl">
            Tudo pronto! 🎉
          </DialogTitle>
          <DialogDescription className="text-base pt-2">
            Você já pode usar o WhatsApp Oficial para enviar mensagens e atender clientes.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              size="lg"
              className="h-auto py-4 flex-col gap-2"
              onClick={handleGoToInbox}
            >
              <MessageSquare className="w-6 h-6" />
              <span className="text-sm">Ir para Inbox</span>
            </Button>
            <Button
              size="lg"
              className="h-auto py-4 flex-col gap-2"
              onClick={handleGoToCampaigns}
            >
              <Megaphone className="w-6 h-6" />
              <span className="text-sm">Criar Campanha</span>
            </Button>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          <p>Dica: Você pode acessar estas opções a qualquer momento no menu lateral.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
