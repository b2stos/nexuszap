import { Upload, Send, BarChart3, Users, Lock, Zap } from "lucide-react";

export const Features = () => {
  const features = [
    {
      icon: Upload,
      title: "Importação Simples",
      description: "Carregue sua base de contatos facilmente via CSV ou XLSX. Processo rápido e seguro."
    },
    {
      icon: Send,
      title: "Envio Individual",
      description: "Cada mensagem é enviada de forma individual, maximizando visualização e engajamento."
    },
    {
      icon: BarChart3,
      title: "Dashboard Completo",
      description: "Métricas claras: disparos, entregas e visualizações em tempo real."
    },
    {
      icon: Users,
      title: "Gestão de Contatos",
      description: "Organize e gerencie seus contatos de forma eficiente e segura."
    },
    {
      icon: Lock,
      title: "Segurança LGPD",
      description: "Conformidade total com a Lei Geral de Proteção de Dados."
    },
    {
      icon: Zap,
      title: "Disparo Robusto",
      description: "Infraestrutura preparada para garantir entrega e performance."
    }
  ];

  return (
    <section className="py-24 bg-secondary text-secondary-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Funcionalidades que <span className="text-accent">transformam</span> resultados
          </h2>
          <p className="text-xl text-secondary-foreground/70 max-w-3xl mx-auto">
            Tudo que você precisa para se comunicar de forma eficiente via WhatsApp.
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
