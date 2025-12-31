import { Button } from "@/components/ui/button";
import { useNavigate, Link } from "react-router-dom";
import logoIcon from "@/assets/logo-icon.png";

export const Header = () => {
  const navigate = useNavigate();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
      <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <img 
              src={logoIcon} 
              alt="Nexus Zap Logo" 
              className="h-10 w-10 object-contain rounded-lg"
            />
            <span className="text-xl font-bold">
              <span className="text-primary">Nexus</span>
              <span className="text-accent">Zap</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <a href="/#solucao" className="text-sm font-medium hover:text-primary transition-colors">
              Solução
            </a>
            <a href="/#funcionalidades" className="text-sm font-medium hover:text-primary transition-colors">
              Funcionalidades
            </a>
            <Link to="/sobre" className="text-sm font-medium hover:text-primary transition-colors">
              Empresa
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>
              Entrar
            </Button>
            <Button size="sm" className="bg-gradient-primary hover:shadow-glow transition-all" onClick={() => navigate("/auth")}>
              Começar grátis
            </Button>
          </div>
        </div>
      </nav>
    </header>
  );
};
