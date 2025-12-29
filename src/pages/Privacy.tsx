import { Helmet } from "react-helmet-async";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const Privacy = () => {
  return (
    <>
      <Helmet>
        <title>Política de Privacidade - Nexus Zap | B2 DIGITAL LTDA</title>
        <meta name="description" content="Política de Privacidade do sistema Nexus Zap, administrada pela B2 DIGITAL LTDA. CNPJ 54.761.878/0001-79." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://nexuszap.online/privacidade" />
      </Helmet>
      
      <div className="min-h-screen bg-background">
        <Header />
        
        <main className="pt-24 pb-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
            <article className="prose prose-lg max-w-none">
              <header className="text-center mb-12">
                <h1 className="text-4xl font-bold text-foreground mb-4">
                  Política de Privacidade
                </h1>
                <p className="text-muted-foreground">
                  Última atualização: {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              </header>

              <section className="bg-card rounded-2xl p-8 border border-border mb-8">
                <h2 className="text-2xl font-semibold text-foreground mb-4">
                  1. Identificação do Controlador
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  Esta Política de Privacidade é aplicada e administrada pela empresa <strong>B2 DIGITAL LTDA</strong>, inscrita no CNPJ <strong>54.761.878/0001-79</strong>, responsável pelo tratamento dos dados do sistema <strong>Nexus Zap</strong>.
                </p>
              </section>

              <section className="bg-card rounded-2xl p-8 border border-border mb-8">
                <h2 className="text-2xl font-semibold text-foreground mb-4">
                  2. Dados Coletados
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Para a prestação dos nossos serviços, coletamos os seguintes dados:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2">
                  <li>Dados de identificação (nome, e-mail, telefone)</li>
                  <li>Dados de acesso (logs de utilização, endereço IP)</li>
                  <li>Dados de contatos importados pelo usuário</li>
                  <li>Conteúdo das mensagens enviadas através do sistema</li>
                  <li>Métricas de campanhas e engajamento</li>
                </ul>
              </section>

              <section className="bg-card rounded-2xl p-8 border border-border mb-8">
                <h2 className="text-2xl font-semibold text-foreground mb-4">
                  3. Finalidade do Tratamento
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Os dados são tratados para as seguintes finalidades:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2">
                  <li>Prestação e melhoria dos serviços contratados</li>
                  <li>Comunicação com o usuário sobre o serviço</li>
                  <li>Cumprimento de obrigações legais e regulatórias</li>
                  <li>Prevenção de fraudes e segurança do sistema</li>
                  <li>Análise e aprimoramento da experiência do usuário</li>
                </ul>
              </section>

              <section className="bg-card rounded-2xl p-8 border border-border mb-8">
                <h2 className="text-2xl font-semibold text-foreground mb-4">
                  4. Base Legal
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  O tratamento de dados pela B2 DIGITAL LTDA está fundamentado na Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018), utilizando as seguintes bases legais: execução de contrato, cumprimento de obrigação legal, legítimo interesse e consentimento do titular, conforme aplicável a cada situação.
                </p>
              </section>

              <section className="bg-card rounded-2xl p-8 border border-border mb-8">
                <h2 className="text-2xl font-semibold text-foreground mb-4">
                  5. Compartilhamento de Dados
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Os dados poderão ser compartilhados com:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2">
                  <li>Provedores de infraestrutura e tecnologia essenciais ao serviço</li>
                  <li>Autoridades competentes, quando exigido por lei</li>
                  <li>Parceiros comerciais, mediante consentimento do usuário</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  Não comercializamos dados pessoais para terceiros.
                </p>
              </section>

              <section className="bg-card rounded-2xl p-8 border border-border mb-8">
                <h2 className="text-2xl font-semibold text-foreground mb-4">
                  6. Segurança dos Dados
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  A B2 DIGITAL LTDA emprega medidas técnicas e organizacionais apropriadas para proteger os dados pessoais contra acesso não autorizado, alteração, divulgação ou destruição. Isso inclui criptografia de dados, controles de acesso, monitoramento de segurança e backups regulares.
                </p>
              </section>

              <section className="bg-card rounded-2xl p-8 border border-border mb-8">
                <h2 className="text-2xl font-semibold text-foreground mb-4">
                  7. Retenção de Dados
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  Os dados pessoais são mantidos pelo período necessário para a prestação dos serviços e cumprimento de obrigações legais. Após o término da relação contratual, os dados podem ser retidos por período adicional conforme exigências legais ou para exercício regular de direitos.
                </p>
              </section>

              <section className="bg-card rounded-2xl p-8 border border-border mb-8">
                <h2 className="text-2xl font-semibold text-foreground mb-4">
                  8. Direitos do Titular
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Conforme a LGPD, você tem direito a:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2">
                  <li>Confirmar a existência de tratamento de dados</li>
                  <li>Acessar seus dados pessoais</li>
                  <li>Corrigir dados incompletos ou desatualizados</li>
                  <li>Solicitar anonimização, bloqueio ou eliminação de dados desnecessários</li>
                  <li>Solicitar portabilidade dos dados</li>
                  <li>Revogar consentimento quando aplicável</li>
                </ul>
              </section>

              <section className="bg-card rounded-2xl p-8 border border-border mb-8">
                <h2 className="text-2xl font-semibold text-foreground mb-4">
                  9. Cookies e Tecnologias Similares
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  O sistema Nexus Zap utiliza cookies e tecnologias similares para melhorar a experiência do usuário, manter sessões ativas e coletar dados de navegação. Você pode configurar seu navegador para recusar cookies, embora isso possa afetar a funcionalidade do sistema.
                </p>
              </section>

              <section className="bg-card rounded-2xl p-8 border border-border mb-8">
                <h2 className="text-2xl font-semibold text-foreground mb-4">
                  10. Contato do Encarregado (DPO)
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  Para exercer seus direitos ou esclarecer dúvidas sobre o tratamento de dados, entre em contato através do e-mail: <a href="mailto:b2digital@nexuszap.online" className="text-primary hover:underline">b2digital@nexuszap.online</a>
                </p>
              </section>

              <section className="bg-card rounded-2xl p-8 border border-border">
                <h2 className="text-2xl font-semibold text-foreground mb-4">
                  11. Alterações na Política
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  Esta Política de Privacidade pode ser atualizada periodicamente. Recomendamos que os usuários revisem este documento regularmente. Alterações significativas serão comunicadas através do sistema ou por e-mail.
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

export default Privacy;
