import { Zap } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="bg-secondary text-secondary-foreground py-12 border-t border-border">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
                <Zap className="w-6 h-6 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">Nexus Zap</span>
            </div>
            <p className="text-secondary-foreground/70 max-w-md">
              O centro onde a mensagem ganha destino, impacto e visualização. 
              Sua mensagem chega. Seu resultado aparece.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Produto</h3>
            <ul className="space-y-2">
              <li><a href="#" className="text-secondary-foreground/70 hover:text-accent transition-colors">Funcionalidades</a></li>
              <li><a href="#" className="text-secondary-foreground/70 hover:text-accent transition-colors">Preços</a></li>
              <li><a href="#" className="text-secondary-foreground/70 hover:text-accent transition-colors">Casos de uso</a></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Empresa</h3>
            <ul className="space-y-2">
              <li><a href="#" className="text-secondary-foreground/70 hover:text-accent transition-colors">Sobre</a></li>
              <li><a href="#" className="text-secondary-foreground/70 hover:text-accent transition-colors">Contato</a></li>
              <li><a href="#" className="text-secondary-foreground/70 hover:text-accent transition-colors">Privacidade</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-secondary-foreground/10 pt-8 text-center text-sm text-secondary-foreground/60">
          <p>&copy; {new Date().getFullYear()} Nexus Zap. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
};
