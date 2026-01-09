import { MessageSquare, Send, BarChart3, Users, Shield, Inbox } from "lucide-react";

export const Features = () => {
  const features = [
    {
      icon: Inbox,
      title: "Inbox Profissional",
      description: "Atenda todos os clientes em um só lugar. Experiência idêntica ao WhatsApp Web."
    },
    {
      icon: Send,
      title: "Campanhas em Massa",
      description: "Envie mensagens para milhares de contatos usando templates aprovados pela Meta."
    },
    {
      icon: Users,
      title: "Multiusuários",
      description: "Toda sua equipe atendendo no mesmo número, com controle e organização."
    },
    {
      icon: MessageSquare,
      title: "Templates Aprovados",
      description: "Crie e gerencie templates para iniciar conversas fora da janela de 24h."
    },
    {
      icon: BarChart3,
      title: "Métricas em Tempo Real",
      description: "Acompanhe entregas, leituras e respostas com dashboards completos."
    },
    {
      icon: Shield,
      title: "Sem Risco de Bloqueio",
      description: "API Oficial aprovada pela Meta. Atende todas as regras de compliance."
    }
  ];

  return (
    <section id="funcionalidades" className="py-24 bg-secondary text-secondary-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Tudo para <span className="text-accent">vender e atender</span> pelo WhatsApp
          </h2>
          <p className="text-xl text-secondary-foreground/70 max-w-3xl mx-auto">
            Recursos profissionais para empresas que levam a comunicação a sério.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div key={index} className="group">
                <div className="bg-secondary-foreground/5 rounded-xl p-8 border border-secondary-foreground/10 hover:border-accent/50 transition-all duration-300">
                  <div className="w-14 h-14 rounded-lg bg-accent/20 flex items-center justify-center mb-6 group-hover:bg-accent/30 transition-colors">
                    <Icon className="w-7 h-7 text-accent" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                  <p className="text-secondary-foreground/70">{feature.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
