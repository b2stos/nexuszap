import { CheckCircle, Shield, MessageSquare, Users, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";

export const Solution = () => {
  const features = [
    {
      icon: Shield,
      title: "Sem Risco de Bloqueio",
      description: "API Oficial aprovada pela Meta. Seu número está 100% protegido."
    },
    {
      icon: MessageSquare,
      title: "Inbox Profissional",
      description: "Atenda todos os clientes em um só lugar, com experiência igual ao WhatsApp Web."
    },
    {
      icon: Zap,
      title: "Campanhas em Massa",
      description: "Envie para milhares de contatos com templates aprovados pela Meta."
    },
    {
      icon: Users,
      title: "Atendimento em Equipe",
      description: "Múltiplos atendentes trabalhando no mesmo número, com controle total."
    }
  ];

  return (
    <section id="solucao" className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/5 to-background" />
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20 mb-6">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-600">A solução oficial</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="bg-gradient-accent bg-clip-text text-transparent">Nexus Zap</span>: WhatsApp Oficial
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Tudo o que sua empresa precisa para usar WhatsApp API Oficial, em um só lugar.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card key={index} className="p-6 border-primary/20 bg-card/50 backdrop-blur hover:shadow-glow transition-all duration-300">
                <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-primary-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </Card>
            );
          })}
        </div>

        {/* Value Proposition */}
        <div className="bg-gradient-hero rounded-2xl p-12 text-center text-primary-foreground shadow-glow">
          <h3 className="text-3xl md:text-4xl font-bold mb-4">
            Atendimento e campanhas no WhatsApp Oficial
          </h3>
          <p className="text-xl opacity-90 mb-8 max-w-2xl mx-auto">
            Com experiência de WhatsApp Web, sem gambiarras e sem risco de bloqueio.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <div className="bg-white/10 backdrop-blur rounded-lg px-6 py-3 border border-white/20">
              <div className="text-2xl font-bold">API Oficial</div>
              <div className="text-sm opacity-80">Aprovada pela Meta</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg px-6 py-3 border border-white/20">
              <div className="text-2xl font-bold">BSP</div>
              <div className="text-sm opacity-80">Homologado</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg px-6 py-3 border border-white/20">
              <div className="text-2xl font-bold">100%</div>
              <div className="text-sm opacity-80">Conforme regras Meta</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
