import { CheckCircle, Target, TrendingUp, Shield } from "lucide-react";
import { Card } from "@/components/ui/card";

export const Solution = () => {
  const features = [
    {
      icon: Target,
      title: "Entrega Individual Garantida",
      description: "Cada mensagem é enviada individualmente, garantindo chegada direta na caixa de entrada do destinatário."
    },
    {
      icon: TrendingUp,
      title: "Alta Taxa de Visualização",
      description: "Mensagens individuais têm até 10x mais chances de serem visualizadas do que grupos ou listas."
    },
    {
      icon: CheckCircle,
      title: "Métricas em Tempo Real",
      description: "Acompanhe entregas, visualizações e engajamento com dados precisos e acionáveis."
    },
    {
      icon: Shield,
      title: "Conformidade e Segurança",
      description: "Totalmente em conformidade com LGPD, garantindo a proteção dos dados dos seus contatos."
    }
  ];

  return (
    <section id="solucao" className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/5 to-background" />
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 mb-6">
            <CheckCircle className="w-4 h-4 text-accent" />
            <span className="text-sm font-medium text-accent-foreground">A Solução</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            O <span className="bg-gradient-accent bg-clip-text text-transparent">Nexus Zap</span> resolve isso
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Uma plataforma completa que garante que sua mensagem não apenas chegue, mas seja vista e gere resultados.
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
            Não é só disparo. É entrega real.
          </h3>
          <p className="text-xl opacity-90 mb-8 max-w-2xl mx-auto">
            O Nexus Zap é o centro onde a mensagem ganha destino, impacto e visualização, 
            criando um novo padrão de resultado.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <div className="bg-white/10 backdrop-blur rounded-lg px-6 py-3 border border-white/20">
              <div className="text-2xl font-bold">98%</div>
              <div className="text-sm opacity-80">Taxa de entrega</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg px-6 py-3 border border-white/20">
              <div className="text-2xl font-bold">85%</div>
              <div className="text-sm opacity-80">Visualização média</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg px-6 py-3 border border-white/20">
              <div className="text-2xl font-bold">100%</div>
              <div className="text-sm opacity-80">Individual</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
