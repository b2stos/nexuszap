import { AlertCircle, Users, Eye, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";

export const Problem = () => {
  const problems = [
    {
      icon: Eye,
      title: "Baixa Visualização",
      description: "Grupos e listas de transmissão resultam em poucas visualizações das suas mensagens importantes."
    },
    {
      icon: Users,
      title: "Dependência de Contatos Salvos",
      description: "Listas de transmissão exigem que todos tenham seu número salvo, limitando drasticamente o alcance."
    },
    {
      icon: XCircle,
      title: "Perda de Oportunidades",
      description: "Comunicação ineficiente significa oportunidades perdidas de engajar sua audiência."
    }
  ];

  return (
    <section className="py-24 bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-destructive/10 border border-destructive/20 mb-6">
            <AlertCircle className="w-4 h-4 text-destructive" />
            <span className="text-sm font-medium text-destructive">O Problema</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Por que métodos tradicionais <span className="text-destructive">falham</span>?
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            No cenário atual, a atenção é o bem mais valioso. Métodos tradicionais não garantem que sua mensagem seja vista.
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
