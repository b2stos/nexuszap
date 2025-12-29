import { Helmet } from "react-helmet-async";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const Terms = () => {
  return (
    <>
      <Helmet>
        <title>Termos de Uso - Nexus Zap | B2 DIGITAL LTDA</title>
        <meta name="description" content="Termos de Uso do sistema Nexus Zap, operado pela B2 DIGITAL LTDA. CNPJ 54.761.878/0001-79." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://nexuszap.online/termos" />
      </Helmet>
      
      <div className="min-h-screen bg-background">
        <Header />
        
        <main className="pt-24 pb-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
            <article className="prose prose-lg max-w-none">
              <header className="text-center mb-12">
                <h1 className="text-4xl font-bold text-foreground mb-4">
                  Termos de Uso
                </h1>
                <p className="text-muted-foreground">
                  Última atualização: {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              </header>

              <section className="bg-card rounded-2xl p-8 border border-border mb-8">
                <h2 className="text-2xl font-semibold text-foreground mb-4">
                  1. Identificação do Responsável
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  Estes Termos de Uso são regidos pela empresa <strong>B2 DIGITAL LTDA</strong>, inscrita no CNPJ <strong>54.761.878/0001-79</strong>, responsável legal pelo sistema <strong>Nexus Zap</strong>.
                </p>
              </section>

              <section className="bg-card rounded-2xl p-8 border border-border mb-8">
                <h2 className="text-2xl font-semibold text-foreground mb-4">
                  2. Aceitação dos Termos
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  Ao acessar e utilizar o sistema Nexus Zap, você concorda integralmente com estes Termos de Uso. Caso não concorde com qualquer disposição aqui estabelecida, recomendamos que não utilize nossos serviços.
                </p>
              </section>

              <section className="bg-card rounded-2xl p-8 border border-border mb-8">
                <h2 className="text-2xl font-semibold text-foreground mb-4">
                  3. Descrição do Serviço
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  O Nexus Zap é um sistema de automação de mensagens e gerenciamento de campanhas de comunicação, desenvolvido e operado pela B2 DIGITAL LTDA. O serviço permite o envio de mensagens em massa, gestão de contatos e acompanhamento de métricas de campanhas.
                </p>
              </section>

              <section className="bg-card rounded-2xl p-8 border border-border mb-8">
                <h2 className="text-2xl font-semibold text-foreground mb-4">
                  4. Uso Adequado
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  O usuário compromete-se a utilizar o sistema de forma ética e legal, sendo vedado:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2">
                  <li>Enviar mensagens não solicitadas (spam)</li>
                  <li>Utilizar o serviço para fins ilegais ou fraudulentos</li>
                  <li>Violar direitos de terceiros</li>
                  <li>Compartilhar credenciais de acesso</li>
                  <li>Tentar burlar limitações técnicas do sistema</li>
                </ul>
              </section>

              <section className="bg-card rounded-2xl p-8 border border-border mb-8">
                <h2 className="text-2xl font-semibold text-foreground mb-4">
                  5. Responsabilidades do Usuário
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  O usuário é integralmente responsável pelo conteúdo das mensagens enviadas através do sistema, bem como pela obtenção do consentimento dos destinatários quando aplicável, conforme legislação vigente (LGPD e demais normas aplicáveis).
                </p>
              </section>

              <section className="bg-card rounded-2xl p-8 border border-border mb-8">
                <h2 className="text-2xl font-semibold text-foreground mb-4">
                  6. Limitação de Responsabilidade
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  A B2 DIGITAL LTDA não se responsabiliza por danos decorrentes do uso indevido do sistema pelo usuário, interrupções de serviço causadas por fatores externos, ou por decisões tomadas com base nas informações obtidas através do sistema.
                </p>
              </section>

              <section className="bg-card rounded-2xl p-8 border border-border mb-8">
                <h2 className="text-2xl font-semibold text-foreground mb-4">
                  7. Propriedade Intelectual
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  Todo o conteúdo do sistema Nexus Zap, incluindo mas não limitado a software, design, marcas e logotipos, é de propriedade exclusiva da B2 DIGITAL LTDA, protegido pela legislação brasileira de propriedade intelectual.
                </p>
              </section>

              <section className="bg-card rounded-2xl p-8 border border-border mb-8">
                <h2 className="text-2xl font-semibold text-foreground mb-4">
                  8. Modificações dos Termos
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  A B2 DIGITAL LTDA reserva-se o direito de modificar estes Termos de Uso a qualquer momento, sendo o usuário notificado através do sistema ou por e-mail. O uso continuado do serviço após as modificações constitui aceitação dos novos termos.
                </p>
              </section>

              <section className="bg-card rounded-2xl p-8 border border-border">
                <h2 className="text-2xl font-semibold text-foreground mb-4">
                  9. Foro e Legislação Aplicável
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  Estes Termos de Uso são regidos pela legislação brasileira. Fica eleito o foro da Comarca de Cotia, Estado de São Paulo, para dirimir quaisquer questões oriundas deste documento.
                </p>
              </section>

              <section className="mt-8 p-6 bg-secondary/50 rounded-xl">
                <p className="text-center text-muted-foreground">
                  <strong>B2 DIGITAL LTDA</strong><br />
                  CNPJ: 54.761.878/0001-79<br />
                  Estrada da Roselândia, 198 – Jardim Dinorah – Cotia – SP – CEP 06702-300<br />
                  E-mail: <a href="mailto:b2digital@nexuszap.online" className="text-primary hover:underline">b2digital@nexuszap.online</a>
                </p>
              </section>
            </article>
          </div>
        </main>
        
        <Footer />
      </div>
    </>
  );
};

export default Terms;
