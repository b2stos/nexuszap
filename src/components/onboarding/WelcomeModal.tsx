/**
 * WelcomeModal Component
 * 
 * Modal de boas-vindas exibido no primeiro login
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MessageSquare, Shield, Zap, PlayCircle } from 'lucide-react';

interface WelcomeModalProps {
  open: boolean;
  onComplete: () => void;
}

export function WelcomeModal({ open, onComplete }: WelcomeModalProps) {
  const [showVideo, setShowVideo] = useState(false);

  const features = [
    {
      icon: MessageSquare,
      title: 'Atendimento em tempo real',
      description: 'Receba e responda mensagens no Inbox',
    },
    {
      icon: Shield,
      title: 'Sem risco de bloqueio',
      description: 'API Oficial aprovada pela Meta',
    },
    {
      icon: Zap,
      title: 'Campanhas em massa',
      description: 'Envie para milhares de contatos',
    },
  ];

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-lg" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center mb-4">
            <MessageSquare className="w-8 h-8 text-white" />
          </div>
          <DialogTitle className="text-2xl">
            Bem-vindo ao NexusZap! 🚀
          </DialogTitle>
          <DialogDescription className="text-base pt-2">
            Envie mensagens pelo WhatsApp Oficial e atenda clientes em um só lugar.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <p className="text-center text-sm text-muted-foreground mb-6">
            Sem bloqueios. Sem gambiarras. 100% API Oficial.
          </p>

          <div className="space-y-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <feature.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-medium text-sm">{feature.title}</h4>
                  <p className="text-xs text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <Button size="lg" onClick={onComplete} className="w-full">
            Começar agora
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowVideo(true)}
            className="text-muted-foreground"
          >
            <PlayCircle className="w-4 h-4 mr-2" />
            Ver como funciona (2 min)
          </Button>
        </div>

        {/* Video placeholder - can be replaced with actual video embed */}
        {showVideo && (
          <div className="mt-4 p-4 bg-muted rounded-lg text-center">
            <p className="text-sm text-muted-foreground">
              📹 Vídeo de demonstração em breve
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
