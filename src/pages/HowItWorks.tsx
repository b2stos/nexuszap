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
} from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export default function HowItWorks() {
  const navigate = useNavigate();

  const steps = [
    {
      number: '1',
      icon: Phone,
      title: 'Conecte seu WhatsApp',
      description:
        'Use seu número oficial do WhatsApp Business aprovado pela Meta. A conexão é segura e sem risco de bloqueio.',
      details: [
        'Número verificado pela Meta',
        'Conexão via API Oficial',
        'Sem instalação de apps',
      ],
    },
    {
      number: '2',
      icon: FileText,
      title: 'Crie seus templates',
      description:
        'Templates são mensagens pré-aprovadas pela Meta para iniciar conversas com seus clientes.',
      details: [
        'Aprovação em até 24h',
        'Suporte a variáveis personalizadas',
        'Marketing, utilidade e autenticação',
      ],
    },
    {
      number: '3',
      icon: Send,
      title: 'Envie mensagens',
      description:
        'Envie mensagens individuais ou campanhas em massa para milhares de contatos ao mesmo tempo.',
      details: [
        'Envio em lote otimizado',
        'Relatórios em tempo real',
        'Respeitando limites da Meta',
      ],
    },
  ];

  const benefits = [
    {
      icon: Shield,
      title: 'Sem risco de bloqueio',
      description: 'API Oficial aprovada pela Meta, sem gambiarras ou violações',
    },
    {
      icon: Zap,
      title: 'Respostas em tempo real',
      description: 'Inbox profissional para atender todos os clientes',
    },
    {
      icon: Users,
      title: 'Atendimento em equipe',
      description: 'Múltiplos atendentes trabalhando nas mesmas conversas',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-16">
        {/* Hero */}
        <div className="text-center mb-16">
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

        {/* Steps */}
        <div className="max-w-4xl mx-auto mb-20">
          <div className="space-y-8">
            {steps.map((step, index) => (
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
                      <h3 className="text-2xl font-bold mb-3">{step.title}</h3>
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
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
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
            <Button size="lg" variant="outline" onClick={() => navigate('/dashboard')}>
              <MessageSquare className="mr-2 w-4 h-4" />
              Ir para Dashboard
            </Button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
