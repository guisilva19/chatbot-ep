export class MessageTemplates {
  
  static getWelcomeMessage(): string {
    return `EP ENGENHARIA

Olá! Seja bem-vindo(a)! ☀️

_Estamos aqui para ajudar você com qualquer dúvida ou informação que precise. Enquanto aguardamos o atendimento, gostaríamos de convidá-lo(a) a nos seguir nas redes sociais para ficar por dentro dos nossos trabalhos!_

⁠Instagram 👇🏻
https://www.instagram.com/ep.energiasolar`;
  }

  static getNameRequestMessage(): string {
    return `_Qual é o seu nome?_ 😊`;
  }

  static getMainMenu(name?: string): string {
    const greeting = name ? `Olá, ${name}!` : 'Olá!';
    return `${greeting}

_Para atendê-lo(a) de forma personalizada, precisamos saber um pouco mais sobre o que você precisa. Por favor, selecione uma das opções abaixo:_

1️⃣ Reduzir conta de luz em até 95% 📉:
Se você está pronto para solicitar um orçamento ou proposta para a instalação de painéis solares.

2️⃣ Poço artesiano com painel solar 💧:
A solução perfeita para quem busca eficiência, economia e sustentabilidade no manejo de água, sendo ideais para áreas remotas ou locais sem acesso à rede elétrica.

3️⃣ Usinas de investimentos 📊:
Se você quer saber mais sobre como a energia solar pode ser um investimento sustentável.

4️⃣ Financiamento e Incentivos 💰:
Se você quer saber mais sobre opções de financiamento e incentivos para a instalação de energia solar.

5️⃣ Suporte técnico 👷🏻‍♂️:
Preciso de ajuda com a minha instalação.

6️⃣ Falar com um(a) atendente 🧑🏻‍💻:
Se você tiver alguma outra dúvida ou assunto que não esteja listado acima.

_Digite o número da opção desejada_`;
  }

  // Método para adicionar a dica do menu
  static getMenuTip(): string {
    return `💡 _Digite "menu" para voltar_`;
  }

  static getOption1Message(): string {
    return `_Quero reduzir a minha conta de energia em até 95% 💰_

Para prosseguir, gostaríamos de saber mais sobre sua residência ou empresa. Por favor, responda com as seguintes informações:

_⁠Quantos kWh atende sua necessidade?_
Obs: se você não souber, pode responder com o valor aproximado da sua conta de luz.

${this.getMenuTip()}`;
  }

  static getOption2Message(): string {
    return `_Quero instalar meu poço artesiano com painel solar💦_

Para prosseguir, gostaríamos de saber mais sobre o seu poço artesiano. Por favor, responda com as seguintes informações:

_⁠Qual é a profundidade do seu poço artesiano?_

${this.getMenuTip()}`;
  }

  static getOption3Message(): string {
    return `_Estou interessado em usinas de investimento📊_

Para prosseguir, gostaríamos de saber mais sobre o seu interesse em investir em energia solar. Por favor, responda com as seguintes informações:

_⁠Qual é o seu objetivo de investimento?_

${this.getMenuTip()}`;
  }

  static getOption4Message(): string {
    return `_Financiamento e Incentivos 🏦_

Para prosseguir, gostaríamos de saber mais sobre o seu interesse em financiamento e incentivos. Por favor, responda com as seguintes informações:

_⁠Qual é o seu orçamento para a instalação de painéis solares?_

${this.getMenuTip()}`;
  }

  static getOption5Message(): string {
    return `_Suporte técnico 🛠️_

Para prosseguir, gostaríamos de saber mais sobre o problema técnico que você está enfrentando. Por favor, responda com as seguintes informações:

_⁠Qual é o problema técnico que você está enfrentando?_

${this.getMenuTip()}`;
  }

  static getOption6Message(): string {
    return `_Falar com um(a) atendente 👩‍💻👨‍💻_

Um de nossos atendentes entrará em contato com você em breve. Por favor, aguarde alguns minutos.

_Estamos aqui para ajudar! 😊_`;
  }

  static getThankYouMessage(): string {
    return `_Obrigado pelas informações!_

Nossa equipe irá analisar seus dados e entrará em contato em breve com uma proposta personalizada.

_O atendimento automatizado será pausado por alguns minutos para que você possa processar as informações. Se precisar de algo urgente, nossa equipe estará disponível em breve! 😊_`;
  }

  static getInvalidOptionMessage(): string {
    return `_Desculpe, não entendi sua opção. Por favor, digite apenas o número correspondente à opção desejada._

${this.getMenuTip()}`;
  }

  static getErrorMessage(): string {
    return `_Ops! Ocorreu um erro inesperado. Nossa equipe foi notificada e irá resolver em breve._ 

_Você pode tentar novamente ou aguardar que entraremos em contato! 😊_

${this.getMenuTip()}`;
  }

  static getTimeoutMessage(): string {
    return `_Olá! Notei que você iniciou uma conversa conosco mas não finalizou. 

_Se ainda tiver interesse, é só responder esta mensagem que continuamos de onde paramos! 😊_

${this.getMenuTip()}`;
  }

  // Método para personalizar mensagens com dados do usuário
  static getPersonalizedSummary(userData: any): string {
    const name = userData.name ? `${userData.name}` : '';
    let summary = name ? `_📋 Resumo das informações de ${name}:_\n\n` : "_📋 Resumo das suas informações:_\n\n";
    
    if (userData.name) summary += `👤 Nome: ${userData.name}\n`;
    
    if (userData.selectedOption) {
      const optionNames = {
        '1': 'Reduzir conta de luz em até 95%',
        '2': 'Poço artesiano com painel solar',
        '3': 'Usinas de investimentos',
        '4': 'Financiamento e Incentivos',
        '5': 'Suporte técnico'
      };
      summary += `🎯 Opção escolhida: ${optionNames[userData.selectedOption as keyof typeof optionNames]}\n`;
    }

    // Opção 1 - Energia Solar Residencial
    if (userData.energyConsumption) summary += `🏠 Quantos kWh atende sua necessidade: ${userData.energyConsumption}\n`;
    if (userData.panelPreference) summary += `🔋 Preferência de equipamento: ${userData.panelPreference}\n`;

    // Opção 2 - Poço Artesiano
    if (userData.wellDepth) summary += `🕳️ Profundidade do poço: ${userData.wellDepth}\n`;
    if (userData.waterFlow) summary += `💧 Vazão necessária: ${userData.waterFlow}\n`;
    if (userData.pumpPreference) summary += `🔧 Preferência de bomba: ${userData.pumpPreference}\n`;

    // Opção 3 - Investimentos
    if (userData.investmentGoal) summary += `🎯 Objetivo de investimento: ${userData.investmentGoal}\n`;
    if (userData.riskProfile) summary += `📊 Perfil de risco: ${userData.riskProfile}\n`;
    if (userData.investmentType) summary += `💼 Tipo de investimento: ${userData.investmentType}\n`;

    // Opção 4 - Financiamento
    if (userData.budget) summary += `💰 Orçamento: ${userData.budget}\n`;
    if (userData.financingPreference) summary += `🏦 Preferência de financiamento: ${userData.financingPreference}\n`;
    if (userData.wantsIncentives) summary += `🎁 Interesse em incentivos: ${userData.wantsIncentives}\n`;

    // Opção 5 - Suporte Técnico
    if (userData.technicalProblem) summary += `🔧 Problema técnico: ${userData.technicalProblem}\n`;
    if (userData.errorMessage) summary += `❌ Mensagem de erro: ${userData.errorMessage}\n`;
    if (userData.wantsTechnicalVisit) summary += `🚗 Visita técnica: ${userData.wantsTechnicalVisit}\n`;

    return summary;
  }
}

export default MessageTemplates;

