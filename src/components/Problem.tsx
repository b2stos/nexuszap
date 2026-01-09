import { AlertTriangle, Ban, Users, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";

export const Problem = () => {
  const problems = [
    {
      icon: Ban,
      title: "Medo de Perder o Número",
      description: "Ferramentas não oficiais colocam seu número em risco. Um bloqueio pode acabar com anos de relacionamento com clientes."
    },
    {
      icon: ShieldAlert,
      title: "Bloqueios Repentinos",
      description: "Sem aviso, seu WhatsApp pode ser banido. E com ele, toda sua comunicação com clientes vai embora."
    },
    {
      icon: Users,
      title: "Atendimento Bagunçado",
      description: "Vários atendentes no mesmo número, sem controle. Conversas perdidas e clientes insatisfeitos."
    }
  ];

  return (
    <section className="py-24 bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-destructive/10 border border-destructive/20 mb-6">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <span className="text-sm font-medium text-destructive">Os riscos</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Por que ferramentas não oficiais são <span className="text-destructive">perigosas</span>?
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Usar gambiarras pode parecer mais barato, mas o custo de um bloqueio é muito maior.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {problems.map((problem, index) => {
            const Icon = problem.icon;
            return (
              <Card key={index} className="p-8 border-destructive/20 bg-card hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 rounded-lg bg-destructive/10 flex items-center justify-center mb-6">
                  <Icon className="w-6 h-6 text-destructive" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{problem.title}</h3>
                <p className="text-muted-foreground">{problem.description}</p>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};
