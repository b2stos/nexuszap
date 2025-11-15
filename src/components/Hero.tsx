import { Button } from "@/components/ui/button";
import { ArrowRight, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import heroImage from "@/assets/hero-nexus.jpg";

export const Hero = () => {
  const navigate = useNavigate();
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-background via-background to-primary/5">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-primary/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-accent/5 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <div className="text-left space-y-8 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Comunicação que chega</span>
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-tight">
              <span className="text-foreground">Sua mensagem</span>{" "}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                chega.
              </span>
              <br />
              <span className="text-foreground">Seu resultado</span>{" "}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                aparece.
              </span>
            </h1>

            <p className="text-xl text-muted-foreground max-w-2xl">
              O Nexus Zap é a plataforma que resolve o problema da entrega e visualização de mensagens no WhatsApp. 
              Envie mensagens individuais com alta eficácia e impacto real.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                size="lg" 
                className="group bg-gradient-primary hover:shadow-glow transition-all duration-300"
                onClick={() => navigate("/auth")}
              >
                Começar agora
                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                className="border-primary/20 hover:bg-primary/5"
                onClick={() => {
                  const featuresSection = document.getElementById('funcionalidades');
                  featuresSection?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Ver demonstração
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 pt-8 border-t border-border">
              <div>
                <div className="text-3xl font-bold text-primary">98%</div>
                <div className="text-sm text-muted-foreground">Taxa de entrega</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-primary">2x</div>
                <div className="text-sm text-muted-foreground">Mais visualizações</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-primary">100%</div>
                <div className="text-sm text-muted-foreground">Individual</div>
              </div>
            </div>
          </div>

          {/* Image */}
          <div className="relative lg:block hidden">
            <div className="absolute inset-0 bg-gradient-accent opacity-20 blur-3xl rounded-full" />
            <img 
              src={heroImage} 
              alt="Nexus Zap Platform" 
              className="relative rounded-2xl shadow-2xl border border-border/50"
            />
          </div>
        </div>
      </div>
    </section>
  );
};
