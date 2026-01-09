/**
 * HowItWorks Page
 * 
 * Página explicativa "Como funciona" para novos usuários
 */

import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Phone,
  FileText,
  Send,
  MessageSquare,
  Shield,
  Zap,
  Users,
  ArrowRight,
  CheckCircle2,
  Clock,
  Inbox,
} from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export default function HowItWorks() {
  const navigate = useNavigate();

  const steps = [
    {
      number: '1',
      icon: Phone,
      title: 'Conecte seu WhatsApp Oficial',
      description:
        'Use seu número do WhatsApp Business verificado pela Meta. A conexão é feita via API Oficial, sem risco de bloqueio.',
      details: [
        'Número verificado pela Meta',
        'Conexão via BSP homologado',
        'Sem instalação de apps',
        'Migração do número existente',
      ],
      time: '5 minutos',
    },
    {
      number: '2',
      icon: FileText,
      title: 'Crie templates aprovados',
      description:
        'Templates são mensagens pré-aprovadas pela Meta para iniciar conversas com seus clientes fora da janela de 24h.',
      details: [
        'Aprovação automática pela Meta',
        'Suporte a variáveis personalizadas',
        'Marketing, utilidade e autenticação',
        'Biblioteca de templates prontos',
      ],
      time: '2 minutos',
    },
    {
      number: '3',
      icon: Send,
      title: 'Envie mensagens e atenda no Inbox',
      description:
        'Envie mensagens individuais ou campanhas em massa, e atenda todas as respostas no Inbox profissional.',
      details: [
        'Inbox estilo WhatsApp Web',
        'Múltiplos atendentes',
        'Campanhas em massa',
        'Métricas em tempo real',
      ],
      time: '1 minuto',
    },
  ];

  const benefits = [
    {
      icon: Shield,
      title: 'Sem risco de bloqueio',
      description: 'API Oficial aprovada pela Meta, sem gambiarras ou violações',
    },
    {
      icon: Inbox,
      title: 'Inbox profissional',
      description: 'Atenda todos os clientes em um só lugar',
    },
    {
      icon: Users,
      title: 'Atendimento em equipe',
      description: 'Múltiplos atendentes no mesmo número',
    },
    {
      icon: Zap,
      title: 'Campanhas em massa',
      description: 'Envie para milhares com templates aprovados',
    },
  ];

  // Sales script section
  const salesPoints = [
    'Você usa WhatsApp hoje, mas corre risco de bloqueio?',
    'Nossa plataforma usa a API Oficial aprovada pela Meta.',
    'Você atende clientes e faz campanhas no mesmo lugar,',
    'com a experiência do WhatsApp Web,',
    'sem perder seu número.',
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-16">
        {/* Hero */}
        <div className="text-center mb-16 pt-8">
          <Badge variant="secondary" className="mb-4">
            WhatsApp API Oficial
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Como funciona o NexusZap
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Envie mensagens pelo WhatsApp Oficial e atenda clientes em um só lugar.
            Simples, seguro e profissional.
          </p>
        </div>

        {/* Time indicator */}
        <div className="flex items-center justify-center gap-2 mb-12">
          <Clock className="w-5 h-5 text-primary" />
          <span className="text-lg font-medium">Configure tudo em menos de 10 minutos</span>
        </div>

        {/* Steps */}
        <div className="max-w-4xl mx-auto mb-20">
          <div className="space-y-8">
            {steps.map((step) => (
              <Card key={step.number} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Left side - number and icon */}
                    <div className="bg-gradient-to-br from-primary/10 to-accent/10 p-8 flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                          <step.icon className="w-10 h-10 text-white" />
                        </div>
                        <span className="text-6xl font-bold text-primary/20">
                          {step.number}
                        </span>
                      </div>
                    </div>

                    {/* Right side - content */}
                    <div className="p-8">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-2xl font-bold">{step.title}</h3>
                        <Badge variant="outline" className="text-xs">
                          <Clock className="w-3 h-3 mr-1" />
                          {step.time}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground mb-4">{step.description}</p>
                      <ul className="space-y-2">
                        {step.details.map((detail) => (
                          <li key={detail} className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                            {detail}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Benefits */}
        <div className="mb-20">
          <h2 className="text-3xl font-bold text-center mb-8">
            Por que usar o NexusZap?
          </h2>
          <div className="grid md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            {benefits.map((benefit) => (
              <Card key={benefit.title} className="text-center p-6">
                <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <benefit.icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{benefit.title}</h3>
                <p className="text-sm text-muted-foreground">{benefit.description}</p>
              </Card>
            ))}
          </div>
        </div>

        {/* Sales pitch */}
        <div className="max-w-2xl mx-auto mb-20 p-8 rounded-2xl bg-muted/50 border">
          <h3 className="text-xl font-bold mb-6 text-center">
            💬 O que você precisa saber
          </h3>
          <div className="space-y-3">
            {salesPoints.map((point, index) => (
              <p
                key={index}
                className={`text-lg ${
                  index === 0 ? 'font-medium' : ''
                } ${index === salesPoints.length - 1 ? 'text-primary font-semibold' : ''}`}
              >
                {point}
              </p>
            ))}
          </div>
        </div>

        {/* Trust badges */}
        <div className="text-center mb-12">
          <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-muted/50">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>API Oficial</span>
            </div>
            <div className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-muted/50">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>BSP Homologado</span>
            </div>
            <div className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-muted/50">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>Sem risco de bloqueio</span>
            </div>
            <div className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-muted/50">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>Conforme regras Meta</span>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 rounded-2xl p-12">
          <h2 className="text-3xl font-bold mb-4">Pronto para começar?</h2>
          <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
            Configure seu WhatsApp Oficial em menos de 10 minutos e comece a
            enviar mensagens profissionais hoje mesmo.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" onClick={() => navigate('/auth')}>
              Criar conta grátis
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/precos')}>
              Ver preços
            </Button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
