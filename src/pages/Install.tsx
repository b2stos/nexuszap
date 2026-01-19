import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { 
  Download, 
  Share, 
  Plus, 
  Smartphone, 
  CheckCircle2, 
  ArrowLeft,
  Chrome,
  Apple
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { usePWA } from '@/hooks/usePWA';

export default function Install() {
  const { 
    isInstalled, 
    isStandalone,
    isIOS, 
    isAndroid, 
    platform,
    promptInstall,
    isInstallable
  } = usePWA();

  const [installing, setInstalling] = useState(false);

  const handleInstall = async () => {
    setInstalling(true);
    try {
      await promptInstall();
    } finally {
      setInstalling(false);
    }
  };

  // Already installed view
  if (isInstalled || isStandalone) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Helmet>
          <title>App Instalado | Nexus Zap</title>
        </Helmet>
        
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              App Instalado!
            </h1>
            <p className="text-muted-foreground mb-6">
              O Nexus Zap já está instalado no seu dispositivo. 
              Você pode acessá-lo pela tela inicial.
            </p>
            <Button asChild className="w-full">
              <Link to="/dashboard">
                Ir para o Dashboard
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Instalar App | Nexus Zap</title>
        <meta name="description" content="Instale o Nexus Zap no seu dispositivo para acesso rápido e experiência nativa." />
      </Helmet>

      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center">
          <Link 
            to="/" 
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Voltar</span>
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="text-center mb-8">
          <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-4 shadow-lg">
            <img 
              src="/pwa-192x192.png" 
              alt="Nexus Zap" 
              className="w-14 h-14 rounded-xl"
            />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Instalar Nexus Zap
          </h1>
          <p className="text-muted-foreground">
            Acesse mais rápido direto da tela inicial do seu dispositivo
          </p>
        </div>

        {/* Benefits */}
        <div className="grid gap-3 mb-8">
          {[
            { icon: '⚡', text: 'Acesso instantâneo sem abrir o navegador' },
            { icon: '📱', text: 'Experiência de app nativo' },
            { icon: '🔔', text: 'Notificações em tempo real' },
            { icon: '💾', text: 'Funciona mesmo offline' },
          ].map((benefit, i) => (
            <div 
              key={i}
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
            >
              <span className="text-xl">{benefit.icon}</span>
              <span className="text-sm text-foreground">{benefit.text}</span>
            </div>
          ))}
        </div>

        {/* Installation Instructions */}
        <Card>
          <CardContent className="pt-6">
            {isIOS ? (
              <IOSInstructions />
            ) : isAndroid || isInstallable ? (
              <AndroidInstructions 
                onInstall={handleInstall} 
                installing={installing}
                isInstallable={isInstallable}
              />
            ) : (
              <DesktopInstructions 
                onInstall={handleInstall}
                installing={installing}
                isInstallable={isInstallable}
              />
            )}
          </CardContent>
        </Card>

        {/* Skip link */}
        <div className="text-center mt-6">
          <Link 
            to="/dashboard" 
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Continuar no navegador →
          </Link>
        </div>
      </main>
    </div>
  );
}

function IOSInstructions() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-4">
        <Apple className="h-4 w-4" />
        <span>Instruções para Safari (iOS)</span>
      </div>

      <div className="space-y-4">
        <Step 
          number={1}
          title="Toque no botão Compartilhar"
          description="Na barra inferior do Safari, toque no ícone de compartilhamento"
          icon={<Share className="h-5 w-5" />}
        />
        <Step 
          number={2}
          title='Selecione "Adicionar à Tela Inicial"'
          description="Role para baixo e toque na opção com o ícone +"
          icon={<Plus className="h-5 w-5" />}
        />
        <Step 
          number={3}
          title="Confirme a instalação"
          description='Toque em "Adicionar" no canto superior direito'
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
      </div>

      <div className="pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground text-center">
          💡 Dica: Certifique-se de estar usando o Safari para ver a opção de instalação
        </p>
      </div>
    </div>
  );
}

interface AndroidInstructionsProps {
  onInstall: () => void;
  installing: boolean;
  isInstallable: boolean;
}

function AndroidInstructions({ onInstall, installing, isInstallable }: AndroidInstructionsProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-4">
        <Chrome className="h-4 w-4" />
        <span>Instruções para Chrome (Android)</span>
      </div>

      {isInstallable ? (
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground mb-4">
            Clique no botão abaixo para instalar o app
          </p>
          <Button 
            size="lg" 
            onClick={onInstall}
            disabled={installing}
            className="gap-2"
          >
            <Download className="h-5 w-5" />
            {installing ? 'Instalando...' : 'Instalar Agora'}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <Step 
            number={1}
            title="Abra o menu do Chrome"
            description="Toque nos três pontos no canto superior direito"
            icon={<span className="text-lg">⋮</span>}
          />
          <Step 
            number={2}
            title='Toque em "Instalar app"'
            description="Ou 'Adicionar à tela inicial' em algumas versões"
            icon={<Download className="h-5 w-5" />}
          />
          <Step 
            number={3}
            title="Confirme a instalação"
            description='Toque em "Instalar" na janela que aparecer'
            icon={<CheckCircle2 className="h-5 w-5" />}
          />
        </div>
      )}
    </div>
  );
}

interface DesktopInstructionsProps {
  onInstall: () => void;
  installing: boolean;
  isInstallable: boolean;
}

function DesktopInstructions({ onInstall, installing, isInstallable }: DesktopInstructionsProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-4">
        <Chrome className="h-4 w-4" />
        <span>Instruções para Desktop</span>
      </div>

      {isInstallable ? (
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground mb-4">
            Clique no botão abaixo para instalar o app
          </p>
          <Button 
            size="lg" 
            onClick={onInstall}
            disabled={installing}
            className="gap-2"
          >
            <Download className="h-5 w-5" />
            {installing ? 'Instalando...' : 'Instalar Agora'}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <Step 
            number={1}
            title="Procure o ícone de instalação"
            description="Na barra de endereço, procure um ícone de instalação ou +"
            icon={<Plus className="h-5 w-5" />}
          />
          <Step 
            number={2}
            title='Clique em "Instalar"'
            description="Confirme a instalação na janela que aparecer"
            icon={<Download className="h-5 w-5" />}
          />
        </div>
      )}

      <div className="pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground text-center">
          💡 Funciona melhor no Chrome, Edge ou Safari
        </p>
      </div>
    </div>
  );
}

interface StepProps {
  number: number;
  title: string;
  description: string;
  icon: React.ReactNode;
}

function Step({ number, title, description, icon }: StepProps) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm">
        {number}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-muted-foreground">{icon}</span>
          <h3 className="font-medium text-foreground text-sm">{title}</h3>
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
