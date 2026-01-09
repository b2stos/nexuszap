import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const CTA = () => {
  const navigate = useNavigate();
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/5 to-primary/10" />
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20 mb-8">
            <Shield className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-600">WhatsApp API Oficial</span>
          </div>

          <h2 className="text-4xl md:text-6xl font-bold mb-6">
            Pronto para usar{" "}
            <span className="bg-gradient-accent bg-clip-text text-transparent">
              WhatsApp Oficial sem medo
            </span>?
          </h2>

          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            Envie mensagens e atenda clientes pelo WhatsApp Oficial, sem risco de bloqueio.
            Configure em menos de 10 minutos.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              className="group bg-gradient-primary hover:shadow-glow transition-all duration-300 text-lg px-8 py-6"
              onClick={() => navigate("/auth")}
            >
              Usar WhatsApp Oficial
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="border-primary/20 hover:bg-primary/5 text-lg px-8 py-6"
              onClick={() => navigate("/como-funciona")}
            >
              Ver como funciona
            </Button>
          </div>

          <div className="flex flex-wrap justify-center gap-6 mt-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>Sem cartão de crédito</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>Setup em minutos</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>Suporte completo</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
