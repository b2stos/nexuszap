import { Phone, Mail, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import logoIcon from "@/assets/logo-icon.png";

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
              <img 
                src={logoIcon} 
                alt="Nexus Zap Logo" 
                className="h-12 w-12 object-contain rounded-lg"
              />
              <span className="text-xl font-bold">
                <span className="text-primary">Nexus</span>
                <span className="text-accent">Zap</span>
              </span>
            </div>
            <p className="text-secondary-foreground/70 text-sm mb-4">
              Nexus Zap é um produto desenvolvido e operado pela <strong>B2 DIGITAL LTDA</strong>.
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
            <h3 className="font-semibold mb-4">Institucional</h3>
            <ul className="space-y-2">
              <li>
                <Link 
                  to="/sobre"
                  className="text-secondary-foreground/70 hover:text-accent transition-colors text-sm"
                >
                  Sobre a Empresa
                </Link>
              </li>
              <li>
                <Link 
                  to="/termos"
                  className="text-secondary-foreground/70 hover:text-accent transition-colors text-sm"
                >
                  Termos de Uso
                </Link>
              </li>
              <li>
                <Link 
                  to="/privacidade"
                  className="text-secondary-foreground/70 hover:text-accent transition-colors text-sm"
                >
                  Política de Privacidade
                </Link>
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
                  href="mailto:b2digital@nexuszap.online" 
                  className="text-secondary-foreground/70 hover:text-accent transition-colors text-sm flex items-center gap-2"
                >
                  <Mail className="w-4 h-4" />
                  b2digital@nexuszap.online
                </a>
              </li>
              <li>
                <div className="text-secondary-foreground/70 text-sm flex items-start gap-2">
                  <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>Estrada da Roselândia, 198<br />Jardim Dinorah – Cotia/SP<br />CEP 06702-300</span>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-secondary-foreground/10 pt-8 text-center text-sm text-secondary-foreground/60">
          <p>Nexus Zap é um produto desenvolvido e operado pela <strong>B2 DIGITAL LTDA</strong></p>
          <p className="mt-1">CNPJ: 54.761.878/0001-79</p>
          <p className="mt-2">&copy; {new Date().getFullYear()} Nexus Zap - B2 DIGITAL LTDA. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
};
