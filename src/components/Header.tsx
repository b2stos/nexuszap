import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";

export const Header = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
      <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow">
              <Zap className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">Nexus Zap</span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <a href="#solucao" className="text-sm font-medium hover:text-primary transition-colors">
              Solução
            </a>
            <a href="#funcionalidades" className="text-sm font-medium hover:text-primary transition-colors">
              Funcionalidades
            </a>
            <a href="#precos" className="text-sm font-medium hover:text-primary transition-colors">
              Preços
            </a>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm">
              Entrar
            </Button>
            <Button size="sm" className="bg-gradient-primary hover:shadow-glow transition-all">
              Começar grátis
            </Button>
          </div>
        </div>
      </nav>
    </header>
  );
};
