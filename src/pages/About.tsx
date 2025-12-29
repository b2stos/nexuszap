import { Helmet } from "react-helmet-async";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Building2, Mail, MapPin, FileText } from "lucide-react";

const About = () => {
  return (
    <>
      <Helmet>
        <title>Sobre a Empresa - B2 DIGITAL LTDA | Nexus Zap</title>
        <meta name="description" content="Conheça a B2 DIGITAL LTDA, empresa responsável pelo desenvolvimento e operação do sistema Nexus Zap. CNPJ 54.761.878/0001-79." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://nexuszap.online/sobre" />
      </Helmet>
      
      <div className="min-h-screen bg-background">
        <Header />
        
        <main className="pt-24 pb-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
            <article className="prose prose-lg max-w-none">
              <header className="text-center mb-12">
                <h1 className="text-4xl font-bold text-foreground mb-4">
                  Sobre a Empresa
                </h1>
                <p className="text-xl text-muted-foreground">
                  Conheça a empresa por trás do Nexus Zap
                </p>
              </header>

              <section className="bg-card rounded-2xl p-8 border border-border mb-8">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold text-foreground mb-4">
                      Quem Somos
                    </h2>
                    <p className="text-muted-foreground leading-relaxed">
                      A <strong>Nexus Zap</strong> é um sistema de automação desenvolvido e operado pela <strong>B2 DIGITAL LTDA</strong>, empresa brasileira especializada em automação de processos, sistemas digitais e soluções em tecnologia.
                    </p>
                  </div>
                </div>
              </section>

              <section className="bg-card rounded-2xl p-8 border border-border mb-8">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-6 h-6 text-primary" />
                  </div>
                  <div className="w-full">
                    <h2 className="text-2xl font-semibold text-foreground mb-6">
                      Dados Legais
                    </h2>
                    <dl className="space-y-4">
                      <div className="flex flex-col sm:flex-row sm:gap-4">
                        <dt className="font-semibold text-foreground min-w-[140px]">Razão Social:</dt>
                        <dd className="text-muted-foreground">B2 DIGITAL LTDA</dd>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:gap-4">
                        <dt className="font-semibold text-foreground min-w-[140px]">CNPJ:</dt>
                        <dd className="text-muted-foreground">54.761.878/0001-79</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </section>

              <section className="bg-card rounded-2xl p-8 border border-border mb-8">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-6 h-6 text-primary" />
                  </div>
                  <div className="w-full">
                    <h2 className="text-2xl font-semibold text-foreground mb-6">
                      Endereço
                    </h2>
                    <address className="not-italic text-muted-foreground leading-relaxed">
                      Estrada da Roselândia, 198<br />
                      Jardim Dinorah<br />
                      Cotia – São Paulo<br />
                      CEP: 06702-300<br />
                      Brasil
                    </address>
                  </div>
                </div>
              </section>

              <section className="bg-card rounded-2xl p-8 border border-border">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-6 h-6 text-primary" />
                  </div>
                  <div className="w-full">
                    <h2 className="text-2xl font-semibold text-foreground mb-6">
                      Contato
                    </h2>
                    <p className="text-muted-foreground">
                      E-mail: <a href="mailto:b2digital@nexuszap.online" className="text-primary hover:underline">b2digital@nexuszap.online</a>
                    </p>
                  </div>
                </div>
              </section>
            </article>
          </div>
        </main>
        
        <Footer />
      </div>
    </>
  );
};

export default About;
