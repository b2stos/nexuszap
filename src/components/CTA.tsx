import { Button } from "@/components/ui/button";
import { ArrowRight, MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const CTA = () => {
  const navigate = useNavigate();
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/5 to-primary/10" />
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8">
            <MessageCircle className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Comece agora</span>
          </div>

          <h2 className="text-4xl md:text-6xl font-bold mb-6">
            Pronto para ver suas mensagens{" "}
            <span className="bg-gradient-accent bg-clip-text text-transparent">
              chegarem e gerarem resultados
            </span>?
          </h2>

          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            Junte-se a empresas, políticos e supermercados que já transformaram 
            sua comunicação com o Nexus Zap.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              className="group bg-gradient-primary hover:shadow-glow transition-all duration-300 text-lg px-8 py-6"
              onClick={() => navigate("/auth")}
            >
              Criar minha conta grátis
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="border-primary/20 hover:bg-primary/5 text-lg px-8 py-6"
              onClick={() => {
                const ctaSection = document.getElementById('contato');
                if (ctaSection) {
                  ctaSection.scrollIntoView({ behavior: 'smooth' });
                } else {
                  navigate("/auth");
                }
              }}
            >
              Falar com especialista
            </Button>
          </div>

          <p className="text-sm text-muted-foreground mt-6">
            ✓ Sem cartão de crédito necessário • ✓ Setup em minutos • ✓ Suporte completo
          </p>
        </div>
      </div>
    </section>
  );
};
