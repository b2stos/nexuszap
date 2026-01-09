/**
 * Pricing Page
 * 
 * Página de planos e preços
 */

import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Check,
  MessageSquare,
  Users,
  Zap,
  Shield,
  ArrowRight,
  Star,
} from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

interface PlanFeature {
  text: string;
  included: boolean;
}

interface Plan {
  name: string;
  description: string;
  price: string;
  period: string;
  popular?: boolean;
  features: PlanFeature[];
  cta: string;
}

const plans: Plan[] = [
  {
    name: 'Start',
    description: 'Para pequenas empresas começando no WhatsApp Oficial',
    price: 'Sob consulta',
    period: '',
    features: [
      { text: '1 número de WhatsApp', included: true },
      { text: '1 usuário', included: true },
      { text: 'Inbox completo', included: true },
      { text: 'Templates ilimitados', included: true },
      { text: 'Até 1.000 conversas/mês', included: true },
      { text: 'Suporte por email', included: true },
      { text: 'Campanhas em massa', included: false },
      { text: 'Métricas avançadas', included: false },
    ],
    cta: 'Começar agora',
  },
  {
    name: 'Pro',
    description: 'Para empresas em crescimento que precisam de escala',
    price: 'Sob consulta',
    period: '',
    popular: true,
    features: [
      { text: '1 número de WhatsApp', included: true },
      { text: 'Até 5 usuários', included: true },
      { text: 'Inbox completo', included: true },
      { text: 'Templates ilimitados', included: true },
      { text: 'Até 10.000 conversas/mês', included: true },
      { text: 'Campanhas em massa', included: true },
      { text: 'Métricas avançadas', included: true },
      { text: 'Suporte prioritário', included: true },
    ],
    cta: 'Escolher Pro',
  },
  {
    name: 'Scale',
    description: 'Para operações de alto volume com necessidades avançadas',
    price: 'Sob consulta',
    period: '',
    features: [
      { text: 'Múltiplos números', included: true },
      { text: 'Usuários ilimitados', included: true },
      { text: 'Inbox completo', included: true },
      { text: 'Templates ilimitados', included: true },
      { text: 'Conversas ilimitadas', included: true },
      { text: 'Campanhas em massa', included: true },
      { text: 'Métricas avançadas', included: true },
      { text: 'Suporte dedicado', included: true },
    ],
    cta: 'Falar com vendas',
  },
];

function PlanCard({ plan }: { plan: Plan }) {
  const navigate = useNavigate();

  return (
    <Card
      className={`relative flex flex-col ${
        plan.popular
          ? 'border-primary shadow-glow scale-105'
          : 'border-border'
      }`}
    >
      {plan.popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-primary text-primary-foreground px-3 py-1">
            <Star className="w-3 h-3 mr-1" />
            Mais popular
          </Badge>
        </div>
      )}
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-2xl">{plan.name}</CardTitle>
        <CardDescription className="min-h-[40px]">{plan.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <div className="text-center mb-6">
          <div className="text-4xl font-bold text-primary">{plan.price}</div>
          {plan.period && (
            <div className="text-sm text-muted-foreground">{plan.period}</div>
          )}
        </div>

        <ul className="space-y-3 flex-1 mb-6">
          {plan.features.map((feature, index) => (
            <li
              key={index}
              className={`flex items-center gap-2 text-sm ${
                feature.included ? '' : 'text-muted-foreground line-through'
              }`}
            >
              <Check
                className={`w-4 h-4 flex-shrink-0 ${
                  feature.included ? 'text-green-500' : 'text-muted-foreground/50'
                }`}
              />
              {feature.text}
            </li>
          ))}
        </ul>

        <Button
          size="lg"
          variant={plan.popular ? 'default' : 'outline'}
          className="w-full"
          onClick={() => navigate('/auth')}
        >
          {plan.cta}
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
}

export default function Pricing() {
  const navigate = useNavigate();

  const benefits = [
    {
      icon: Shield,
      title: 'API Oficial',
      description: '100% aprovada pela Meta',
    },
    {
      icon: MessageSquare,
      title: 'Inbox Premium',
      description: 'Experiência WhatsApp Web',
    },
    {
      icon: Users,
      title: 'Multiusuários',
      description: 'Toda equipe no mesmo número',
    },
    {
      icon: Zap,
      title: 'Sem Bloqueios',
      description: 'Seu número protegido',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-16">
        {/* Hero */}
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4">
            Planos simples, sem surpresas
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Escolha o plano ideal para sua empresa
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Comece a usar WhatsApp Oficial hoje mesmo.
            Todos os planos incluem API Oficial e Inbox premium.
          </p>
        </div>

        {/* Benefits bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
          {benefits.map((benefit) => (
            <div
              key={benefit.title}
              className="flex items-center gap-3 p-4 rounded-lg bg-muted/50"
            >
              <benefit.icon className="w-5 h-5 text-primary flex-shrink-0" />
              <div>
                <div className="font-medium text-sm">{benefit.title}</div>
                <div className="text-xs text-muted-foreground">{benefit.description}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Plans */}
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-20">
          {plans.map((plan) => (
            <PlanCard key={plan.name} plan={plan} />
          ))}
        </div>

        {/* FAQ / Trust */}
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-4">Perguntas frequentes</h2>
          <div className="space-y-4 text-left">
            <div className="p-4 rounded-lg bg-muted/50">
              <h3 className="font-medium mb-1">O que é WhatsApp API Oficial?</h3>
              <p className="text-sm text-muted-foreground">
                É a forma oficial aprovada pela Meta para empresas usarem o WhatsApp.
                Diferente de soluções não oficiais, não há risco de bloqueio do seu número.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <h3 className="font-medium mb-1">Posso migrar meu número atual?</h3>
              <p className="text-sm text-muted-foreground">
                Sim! Você pode migrar seu número existente do WhatsApp Business para a API Oficial.
                Nossa equipe ajuda em todo o processo.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <h3 className="font-medium mb-1">Há custos adicionais?</h3>
              <p className="text-sm text-muted-foreground">
                O custo das mensagens é cobrado separadamente pela Meta conforme a tabela oficial.
                Nós cobramos apenas pela plataforma.
              </p>
            </div>
          </div>
        </div>

        {/* Final CTA */}
        <div className="text-center mt-16 p-12 rounded-2xl bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10">
          <h2 className="text-3xl font-bold mb-4">Ainda tem dúvidas?</h2>
          <p className="text-muted-foreground mb-6">
            Fale com nossa equipe e descubra como o Nexus Zap pode ajudar sua empresa.
          </p>
          <Button size="lg" onClick={() => navigate('/auth')}>
            Criar conta grátis
            <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </div>
      </main>

      <Footer />
    </div>
  );
}
