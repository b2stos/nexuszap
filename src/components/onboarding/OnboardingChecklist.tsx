/**
 * OnboardingChecklist Component
 * 
 * Checklist visual guiado para onboarding
 */

import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  Circle,
  Phone,
  FileText,
  Send,
  MessageSquare,
  ChevronRight,
  PartyPopper,
  X,
} from 'lucide-react';
import { useOnboarding, OnboardingStep } from '@/hooks/useOnboarding';
import { cn } from '@/lib/utils';

interface ChecklistItem {
  id: OnboardingStep;
  title: string;
  description: string;
  icon: React.ElementType;
  route: string;
  actionLabel: string;
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: 'channel_connected',
    title: 'Conectar WhatsApp',
    description: 'Configure seu número oficial',
    icon: Phone,
    route: '/dashboard/channels',
    actionLabel: 'Conectar',
  },
  {
    id: 'template_created',
    title: 'Criar template',
    description: 'Cadastre seu primeiro template',
    icon: FileText,
    route: '/dashboard/templates',
    actionLabel: 'Criar',
  },
  {
    id: 'first_message_sent',
    title: 'Enviar mensagem',
    description: 'Envie sua primeira mensagem',
    icon: Send,
    route: '/dashboard/inbox',
    actionLabel: 'Enviar',
  },
  {
    id: 'inbox_opened',
    title: 'Abrir Inbox',
    description: 'Veja as conversas chegando',
    icon: MessageSquare,
    route: '/dashboard/inbox',
    actionLabel: 'Abrir',
  },
];

interface OnboardingChecklistProps {
  collapsed?: boolean;
  onDismiss?: () => void;
}

export function OnboardingChecklist({ collapsed = false, onDismiss }: OnboardingChecklistProps) {
  const navigate = useNavigate();
  const { steps, progress, isComplete, completeOnboarding } = useOnboarding();
  
  // Don't show if onboarding is complete
  if (isComplete) {
    return null;
  }

  // Check if a step is completed
  const isStepCompleted = (stepId: OnboardingStep) => {
    return steps.find(s => s.id === stepId)?.completed || false;
  };

  // Find the next incomplete step
  const nextStep = CHECKLIST_ITEMS.find(item => !isStepCompleted(item.id));

  // Handle completion
  const handleComplete = () => {
    completeOnboarding();
    onDismiss?.();
  };

  // Collapsed view (just progress bar)
  if (collapsed) {
    return (
      <div className="px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium">Configuração</span>
              <span className="text-xs text-muted-foreground">{progress}%</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => nextStep && navigate(nextStep.route)}
          >
            Continuar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-background to-muted/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">📋 Comece por aqui</CardTitle>
            <Badge variant="secondary" className="text-xs">
              {progress}%
            </Badge>
          </div>
          {onDismiss && (
            <Button variant="ghost" size="icon" onClick={onDismiss} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <Progress value={progress} className="h-2 mt-2" />
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {CHECKLIST_ITEMS.map((item, index) => {
          const completed = isStepCompleted(item.id);
          const isNext = nextStep?.id === item.id;
          const Icon = item.icon;

          return (
            <div
              key={item.id}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg transition-colors',
                completed && 'bg-green-500/5',
                isNext && 'bg-primary/5 ring-1 ring-primary/20',
                !completed && !isNext && 'opacity-60'
              )}
            >
              {/* Status icon */}
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                  completed && 'bg-green-500/20',
                  isNext && 'bg-primary/20',
                  !completed && !isNext && 'bg-muted'
                )}
              >
                {completed ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                ) : (
                  <Icon className={cn('w-4 h-4', isNext ? 'text-primary' : 'text-muted-foreground')} />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    'text-sm font-medium',
                    completed && 'line-through text-muted-foreground'
                  )}
                >
                  {item.title}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {item.description}
                </p>
              </div>

              {/* Action */}
              {!completed && (
                <Button
                  variant={isNext ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => navigate(item.route)}
                  className="flex-shrink-0"
                >
                  {item.actionLabel}
                  <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              )}
            </div>
          );
        })}

        {/* Completion state */}
        {progress === 100 && !isComplete && (
          <div className="pt-3 border-t mt-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10">
              <PartyPopper className="w-6 h-6 text-green-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-700">Tudo pronto! 🎉</p>
                <p className="text-xs text-green-600/80">
                  Você já pode usar o WhatsApp Oficial.
                </p>
              </div>
              <Button size="sm" onClick={handleComplete}>
                Concluir
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
