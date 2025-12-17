import { Zap, Phone, Mail, MapPin } from "lucide-react";

export const Footer = () => {
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <footer className="bg-secondary text-secondary-foreground py-12 border-t border-border">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
                <Zap className="w-6 h-6 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">Nexus Zap</span>
            </div>
            <p className="text-secondary-foreground/70 text-sm mb-2">
              Um produto da <strong>B2 Digital</strong>
            </p>
            <p className="text-secondary-foreground/70 text-sm">
              O centro onde a mensagem ganha destino, impacto e visualização.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Produto</h3>
            <ul className="space-y-2">
              <li>
                <button 
                  onClick={() => scrollToSection('funcionalidades')} 
                  className="text-secondary-foreground/70 hover:text-accent transition-colors text-left text-sm"
                >
                  Funcionalidades
                </button>
              </li>
              <li>
                <button 
                  onClick={() => scrollToSection('solucao')} 
                  className="text-secondary-foreground/70 hover:text-accent transition-colors text-left text-sm"
                >
                  Solução
                </button>
              </li>
              <li>
                <button 
                  onClick={() => scrollToSection('funcionalidades')} 
                  className="text-secondary-foreground/70 hover:text-accent transition-colors text-left text-sm"
                >
                  Casos de uso
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Empresa</h3>
            <ul className="space-y-2">
              <li>
                <button 
                  onClick={() => scrollToSection('solucao')} 
                  className="text-secondary-foreground/70 hover:text-accent transition-colors text-left text-sm"
                >
                  Sobre
                </button>
              </li>
              <li>
                <a 
                  href="mailto:b2digitos@gmail.com" 
                  className="text-secondary-foreground/70 hover:text-accent transition-colors text-sm"
                >
                  Contato
                </a>
              </li>
              <li>
                <button 
                  onClick={() => scrollToSection('solucao')} 
                  className="text-secondary-foreground/70 hover:text-accent transition-colors text-left text-sm"
                >
                  Privacidade
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Contato</h3>
            <ul className="space-y-3">
              <li>
                <a 
                  href="tel:+5511947892299" 
                  className="text-secondary-foreground/70 hover:text-accent transition-colors text-sm flex items-center gap-2"
                >
                  <Phone className="w-4 h-4" />
                  (11) 94789-2299
                </a>
              </li>
              <li>
                <a 
                  href="mailto:b2digitos@gmail.com" 
                  className="text-secondary-foreground/70 hover:text-accent transition-colors text-sm flex items-center gap-2"
                >
                  <Mail className="w-4 h-4" />
                  b2digitos@gmail.com
                </a>
              </li>
              <li>
                <div className="text-secondary-foreground/70 text-sm flex items-start gap-2">
                  <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>Estrada da Roselandia, 198<br />Jardim Dinorah - Cotia/SP</span>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-secondary-foreground/10 pt-8 text-center text-sm text-secondary-foreground/60">
          <p>&copy; {new Date().getFullYear()} Nexus Zap - B2 Digital | CNPJ: 54.761.878/0001-79</p>
          <p className="mt-1">Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
};
