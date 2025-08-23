import { Client, LocalAuth, Message as WhatsAppMessage } from "whatsapp-web.js";
import qrcode from "qrcode-terminal";
import { ConversationService } from "./ConversationService";
import { MessageTemplates } from "./MessageTemplates";
import { ConversationState } from "@prisma/client";

class WhatsAppService {
  private client: Client | null = null;
  private isReady: boolean = false;
  private startTime: number = 0;
  private conversationService: ConversationService;
  private processingMessages: Set<string> = new Set(); // números sendo processados
  private currentQRCode: string | null = null; // QR code atual para exibir na web
  private lastActivity: number = Date.now(); // controle de atividade para hibernação
  private isHibernating: boolean = false;


  constructor() {
    this.conversationService = new ConversationService();
  }

  start(): void {
    this.client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-renderer-backgrounding",
          "--disable-features=TranslateUI",
          "--disable-ipc-flooding-protection",
          "--disable-extensions",
          "--disable-plugins",
          "--disable-default-apps",
          "--no-first-run",
          "--no-default-browser-check",
          "--single-process",
          "--memory-pressure-off"
        ],
        timeout: 60000
      }
    });

    this.setupEventHandlers();
    this.startTime = Date.now();
    this.client.initialize();
  }

  private setupEventHandlers(): void {
    if (!this.client) return;


    this.client.on("qr", (qr: string) => {
      console.log("\n📲 QR Code gerado! Acesse a URL do seu app para escanear.\n");
      this.currentQRCode = qr;
      
      // Se estiver em desenvolvimento local, mostra no terminal também
      if (process.env.NODE_ENV !== 'production') {
        qrcode.generate(qr, { small: true });
      }
    });

    this.client.on("ready", () => {
      this.isReady = true;
      this.currentQRCode = null; // Limpa o QR code quando conectar
      console.log("✅ WhatsApp conectado! Sistema de conversação ativado.");
      
      // Inicia o scheduler de limpeza automática
      this.startCleanupScheduler();
      
      // Inicia o sistema de hibernação
      this.startHibernationTimer();
    });

    this.client.on("authenticated", () => {
      const authTime = Date.now();
      const totalTime = authTime - this.startTime;
      console.log(`🔐 Autenticado com sucesso em ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)!`);
    });

    this.client.on("message", async (msg: WhatsAppMessage) => {
      await this.handleIncomingMessage(msg);
    });

    // Evento para quando o próprio número do bot enviar mensagem
    this.client.on("message_create", async (msg: WhatsAppMessage) => {
      if (msg.fromMe) {
        await this.handleOwnMessage(msg);
      }
    });

    this.client.on("disconnected", (reason: string) => {
      this.isReady = false;
    });

  }

  private async handleIncomingMessage(msg: WhatsAppMessage): Promise<void> {
    const rawNumber = msg.from;
    const messageText = msg.body;
    const numberE164 = `+${rawNumber.replace("@c.us", "")}`;

    // Atualiza atividade e acorda se estiver hibernando
    this.updateActivity();

    // Ignora mensagens de grupo
    const isGroup = rawNumber.includes("@g.us");
    if (isGroup) {
      return;
    }

      await this.handleEpMessage(numberE164, messageText);
  }

  private async handleOwnMessage(msg: WhatsAppMessage): Promise<void> {
    const rawNumber = msg.to;
    const messageText = msg.body;
    const numberE164 = `+${rawNumber.replace("@c.us", "")}`;
    
    // Verifica se a mensagem tem a marca do bot (Zero Width Space no final)
    const isFromBot = messageText.endsWith("\u200B");
    
    // Não bloqueia se for comando "stop" ou se for mensagem do bot
    if (!isFromBot && messageText.toLowerCase().trim() !== "stop") {
      await this.blockContact(numberE164);
    }
  }



  private async handleEpMessage(number: string, messageText: string): Promise<void> {
    try {
      // PRIMEIRA PRIORIDADE: Verifica se é comando "stop" para bloquear por 1 ano
      if (messageText.toLowerCase().trim() === "stop") {
        await this.conversationService.blockContactForOneYear(number);
        console.log(`🔒 Contato ${number} bloqueado por 1 ano devido ao comando "stop"`);
        return;
      }

      // SEGUNDA PRIORIDADE: Verifica se é comando "menu" para voltar ao menu principal
      // O comando "menu" sempre funciona, mesmo quando o bot está desativado
      if (messageText.toLowerCase().trim() === "menu") {
        await this.handleMenuCommand(number);
        return;
      }

      // TERCEIRA PRIORIDADE: Verifica se o contato está bloqueado por 1 ano
      if (await this.conversationService.isContactBlockedForOneYear(number)) {
        console.log(`🔒 Contato bloqueado por 1 ano: ${number}`);
        return;
      }

      // Verifica se o bot está desativado para este usuário (sistema de bloqueio por tempo)
      if (await this.conversationService.isBotDisabled(number)) {
        const remainingMinutes = await this.conversationService.getRemainingDisableTime(number);
        console.log(`🤖 Bot desativado para ${number} - Tempo restante: ${remainingMinutes} minutos`);
        return;
      }

      // Verifica se já está processando uma mensagem deste número
      if (this.processingMessages.has(number)) {
        console.log(`⏳ Já processando mensagem de ${number} - aguardando...`);
        return;
      }

      // Marca como processando
      this.processingMessages.add(number);

      try {
        await this.processConversationFlow(number, messageText);
      } finally {
        // Remove da lista de processamento
        this.processingMessages.delete(number);
      }

    } catch (error) {
      console.error("Erro ao processar mensagem:", error);
      this.processingMessages.delete(number); // Garante que remove em caso de erro
      await this.sendMessage(number, MessageTemplates.getErrorMessage());
    }
  }

  private async processConversationFlow(number: string, messageText: string): Promise<void> {
    // Busca ou cria a conversa
    const conversation = await this.conversationService.getOrCreateConversation(number, messageText);
    
    switch (conversation.state) {
      case ConversationState.INITIAL:
        await this.handleInitialState(number);
        break;
        
      case ConversationState.WAITING_NAME:
        await this.handleNameCapture(number, messageText);
        break;
        
      case ConversationState.WAITING_OPTION:
        await this.handleOptionSelection(number, messageText);
        break;
        
      case ConversationState.OPTION_1_DETAILS:
        await this.handleOption1Details(number, messageText);
        break;
        
      case ConversationState.OPTION_2_DETAILS:
        await this.handleOption2Details(number, messageText);
        break;
        
      case ConversationState.OPTION_3_DETAILS:
        await this.handleOption3Details(number, messageText);
        break;
        
      case ConversationState.OPTION_4_DETAILS:
        await this.handleOption4Details(number, messageText);
        break;
        
      case ConversationState.OPTION_5_DETAILS:
        await this.handleOption5Details(number, messageText);
        break;
        
      case ConversationState.FORWARDED_TO_HUMAN:
        // Não responde automaticamente quando já foi encaminhado
        console.log(`📨 Mensagem de ${number} encaminhada para humano: ${messageText}`);
        break;
        
      default:
        await this.handleInitialState(number);
        break;
    }
  }

  private async handleInitialState(number: string): Promise<void> {
    // Envia mensagem de boas-vindas
    await this.sendMessage(number, MessageTemplates.getWelcomeMessage());
    
    // Aguarda 1 segundo e solicita o nome
    setTimeout(async () => {
      await this.sendMessage(number, MessageTemplates.getNameRequestMessage());
      await this.conversationService.updateConversationState(
        number, 
        ConversationState.WAITING_NAME,
        "name_capture"
      );
    }, 1000);
  }

  private async handleMenuCommand(number: string): Promise<void> {
    // Busca os dados do usuário para pegar o nome
    const conversation = await this.conversationService.getConversation(number);
    const userData = (conversation?.userData as any) || {};
    const name = userData.name;

    // Reativa o bot removendo completamente a desativação temporária
    if (conversation?.botDisabledUntil) {
      await this.conversationService.updateConversationState(
        number,
        conversation.state,
        conversation.waitingFor || undefined,
        conversation.userData as any
      );
      // Remove especificamente o botDisabledUntil para desativar o bloqueio de 5 min
      await this.conversationService.removeBotDisabled(number);
      console.log(`🔄 Bot reativado para ${number} através do comando "menu" - Bloqueio de 5 min removido`);
    }

    // Volta para o menu principal
    await this.sendMessage(number, MessageTemplates.getMainMenu(name));
    await this.sendMessage(number, MessageTemplates.getMenuTip());
    await this.conversationService.updateConversationState(
      number, 
      ConversationState.WAITING_OPTION,
      "option_selection"
    );
  }

  private async handleNameCapture(number: string, messageText: string): Promise<void> {
    const name = messageText.trim();
    
    // Salva o nome do usuário
    await this.conversationService.updateUserData(number, { name });
    
        // Aguarda 500ms e envia o menu personalizado
    setTimeout(async () => {
      await this.sendMessage(number, MessageTemplates.getMainMenu(name));
      await this.sendMessage(number, MessageTemplates.getMenuTip());
      await this.conversationService.updateConversationState(
        number,
        ConversationState.WAITING_OPTION,
        "option_selection"
      );
    }, 500);
  }

  private async handleOptionSelection(number: string, messageText: string): Promise<void> {
    const option = messageText.trim();
    
    switch (option) {
      case "1":
        await this.sendMessage(number, MessageTemplates.getOption1Message());
        await this.conversationService.updateConversationState(
          number,
          ConversationState.OPTION_1_DETAILS,
          "residence_details",
          { selectedOption: "1" }
        );
        break;
        
      case "2":
        await this.sendMessage(number, MessageTemplates.getOption2Message());
        await this.conversationService.updateConversationState(
          number,
          ConversationState.OPTION_2_DETAILS,
          "well_details",
          { selectedOption: "2" }
        );
        break;
        
      case "3":
        await this.sendMessage(number, MessageTemplates.getOption3Message());
        await this.conversationService.updateConversationState(
          number,
          ConversationState.OPTION_3_DETAILS,
          "investment_details",
          { selectedOption: "3" }
        );
        break;
        
      case "4":
        await this.sendMessage(number, MessageTemplates.getOption4Message());
        await this.conversationService.updateConversationState(
          number,
          ConversationState.OPTION_4_DETAILS,
          "financing_details",
          { selectedOption: "4" }
        );
        break;
        
      case "5":
        await this.sendMessage(number, MessageTemplates.getOption5Message());
        await this.conversationService.updateConversationState(
          number,
          ConversationState.OPTION_5_DETAILS,
          "technical_details",
          { selectedOption: "5" }
        );
        break;
        
      case "6":
        await this.sendMessage(number, MessageTemplates.getOption6Message());
        await this.conversationService.updateConversationState(
          number,
          ConversationState.FORWARDED_TO_HUMAN,
          undefined,
          { selectedOption: "6" }
        );
        break;
        
      default:
        await this.sendMessage(number, MessageTemplates.getInvalidOptionMessage());
        // Mantém no mesmo estado para nova tentativa
        break;
    }
  }

  private async handleOption1Details(number: string, messageText: string): Promise<void> {
    const conversation = await this.conversationService.getConversation(number);
    const userData = (conversation?.userData as any) || {};
    
    // Coleta as informações sequencialmente
    if (!userData.energyConsumption) {
      await this.conversationService.updateUserData(number, { energyConsumption: messageText });
      await this.sendMessage(number, "Perfeito! Por último, você tem alguma preferência por tipo de painel solar ou inversor em específico?\n\n💡 _Digite \"menu\" para voltar_");
    } else if (!userData.panelPreference) {
      await this.conversationService.updateUserData(number, { panelPreference: messageText });
      
      // Finaliza a coleta de dados
      const finalUserData = await this.conversationService.getConversation(number);
      const summary = MessageTemplates.getPersonalizedSummary(finalUserData?.userData);
      await this.sendMessage(number, summary);
      await this.sendMessage(number, MessageTemplates.getThankYouMessage());
      
      await this.conversationService.markAsCompleted(number, 5); // Desativa por 5 minutos
    }
  }

  private async handleOption2Details(number: string, messageText: string): Promise<void> {
    const conversation = await this.conversationService.getConversation(number);
    const userData = (conversation?.userData as any) || {};
    
    if (!userData.wellDepth) {
      await this.conversationService.updateUserData(number, { wellDepth: messageText });
      await this.sendMessage(number, "Obrigado! Agora me informe qual é a vazão de água necessária:\n\n💡 _Digite \"menu\" para voltar_");
    } else if (!userData.waterFlow) {
      await this.conversationService.updateUserData(number, { waterFlow: messageText });
      await this.sendMessage(number, "Perfeito! Por último, você tem alguma preferência por tipo de bomba ou equipamento específico?");
    } else if (!userData.pumpPreference) {
      await this.conversationService.updateUserData(number, { pumpPreference: messageText });
      
      const finalUserData = await this.conversationService.getConversation(number);
      const summary = MessageTemplates.getPersonalizedSummary(finalUserData?.userData);
      await this.sendMessage(number, summary);
      await this.sendMessage(number, MessageTemplates.getThankYouMessage());
      
      await this.conversationService.markAsCompleted(number, 5); // Desativa por 5 minutos
    }
  }

  private async handleOption3Details(number: string, messageText: string): Promise<void> {
    const conversation = await this.conversationService.getConversation(number);
    const userData = (conversation?.userData as any) || {};
    
    if (!userData.investmentGoal) {
      await this.conversationService.updateUserData(number, { investmentGoal: messageText });
      await this.sendMessage(number, "Obrigado! Agora me informe qual é o seu perfil de risco (conservador, moderado ou arrojado):\n\n💡 _Digite \"menu\" para voltar_");
    } else if (!userData.riskProfile) {
      await this.conversationService.updateUserData(number, { riskProfile: messageText });
      await this.sendMessage(number, "Perfeito! Por último, você tem alguma preferência por tipo de investimento em energia solar?");
    } else if (!userData.investmentType) {
      await this.conversationService.updateUserData(number, { investmentType: messageText });
      
      const finalUserData = await this.conversationService.getConversation(number);
      const summary = MessageTemplates.getPersonalizedSummary(finalUserData?.userData);
      await this.sendMessage(number, summary);
      await this.sendMessage(number, MessageTemplates.getThankYouMessage());
      
      await this.conversationService.markAsCompleted(number, 5); // Desativa por 5 minutos
    }
  }

  private async handleOption4Details(number: string, messageText: string): Promise<void> {
    const conversation = await this.conversationService.getConversation(number);
    const userData = (conversation?.userData as any) || {};
    
    if (!userData.budget) {
      await this.conversationService.updateUserData(number, { budget: messageText });
      await this.sendMessage(number, "Obrigado! Agora me informe qual é sua preferência por tipo de financiamento:\n\n💡 _Digite \"menu\" para voltar_");
    } else if (!userData.financingPreference) {
      await this.conversationService.updateUserData(number, { financingPreference: messageText });
      await this.sendMessage(number, "Perfeito! Você gostaria de saber mais sobre os incentivos governamentais disponíveis? (Sim/Não)");
    } else if (!userData.wantsIncentives) {
      await this.conversationService.updateUserData(number, { wantsIncentives: messageText });
      
      const finalUserData = await this.conversationService.getConversation(number);
      const summary = MessageTemplates.getPersonalizedSummary(finalUserData?.userData);
      await this.sendMessage(number, summary);
      await this.sendMessage(number, MessageTemplates.getThankYouMessage());
      
      await this.conversationService.markAsCompleted(number, 5); // Desativa por 5 minutos
    }
  }

  private async handleOption5Details(number: string, messageText: string): Promise<void> {
    const conversation = await this.conversationService.getConversation(number);
    const userData = (conversation?.userData as any) || {};
    
    if (!userData.technicalProblem) {
      await this.conversationService.updateUserData(number, { technicalProblem: messageText });
      await this.sendMessage(number, "Obrigado! Você tem alguma mensagem de erro ou sintomas específicos que possa compartilhar?");
    } else if (!userData.errorMessage) {
      await this.conversationService.updateUserData(number, { errorMessage: messageText });
      await this.sendMessage(number, "Perfeito! Você gostaria de agendar uma visita técnica? (Sim/Não)");
    } else if (!userData.wantsTechnicalVisit) {
      await this.conversationService.updateUserData(number, { wantsTechnicalVisit: messageText });
      
      const finalUserData = await this.conversationService.getConversation(number);
      const summary = MessageTemplates.getPersonalizedSummary(finalUserData?.userData);
      await this.sendMessage(number, summary);
      await this.sendMessage(number, MessageTemplates.getThankYouMessage());
      
      await this.conversationService.markAsCompleted(number, 5); // Desativa por 5 minutos
    }
  }

  async sendMessage(number: string, message: string): Promise<boolean> {
    if (!this.client || !this.isReady) {
      return false;
    }

    try {
      const chatId = `${number.replace("+", "")}@c.us`;
      const messageWithBotTag = message + "\u200B"; 
      
      await this.client.sendMessage(chatId, messageWithBotTag);

      return true;
    } catch (error) {
      return false;
    }
  }

  // Bloqueia o bot para um contato por 24 horas (usando banco de dados)
  private async blockContact(number: string): Promise<void> {
    try {
      await this.conversationService.markAsCompleted(number, 24 * 60); // 24 horas = 1440 minutos
      console.log(`🚫 Bot bloqueado para ${number} por 24 horas`);
    } catch (error) {
      console.error(`Erro ao bloquear contato ${number}:`, error);
    }
  }

  // Método público para desbloquear um contato manualmente
  async unblockContact(number: string): Promise<boolean> {
    try {
      await this.conversationService.removeBotDisabled(number);
      console.log(`✅ Bot desbloqueado manualmente para ${number}`);
      return true;
    } catch (error) {
      console.error(`Erro ao desbloquear contato ${number}:`, error);
      return false;
    }
  }

  // Métodos públicos para gerenciar conversas
  async getConversationState(number: string) {
    const conversation = await this.conversationService.getConversation(number);
    return {
      state: conversation?.state || ConversationState.INITIAL,
      userData: conversation?.userData || {},
      waitingFor: conversation?.waitingFor || null,
      lastActivity: conversation?.lastActivity || null
    };
  }

  async resetConversation(number: string): Promise<boolean> {
    try {
      await this.conversationService.resetConversation(number);
      console.log(`🔄 Conversa resetada para ${number}`);
      return true;
    } catch (error) {
      console.error(`Erro ao resetar conversa para ${number}:`, error);
      return false;
    }
  }

  async forwardToHuman(number: string): Promise<boolean> {
    try {
      await this.conversationService.updateConversationState(
        number, 
        ConversationState.FORWARDED_TO_HUMAN
      );
      await this.sendMessage(number, MessageTemplates.getOption6Message());
      console.log(`👤 Conversa de ${number} encaminhada para humano`);
      return true;
    } catch (error) {
      console.error(`Erro ao encaminhar conversa de ${number}:`, error);
      return false;
    }
  }

  async getAllActiveConversations() {
    // Este método poderia ser implementado no ConversationService para buscar conversas ativas
    // Por enquanto, retorna uma mensagem informativa
    console.log("📊 Para visualizar conversas ativas, implemente método no ConversationService");
    return [];
  }

  async sendCustomMessage(number: string, message: string): Promise<boolean> {
    try {
      const success = await this.sendMessage(number, message);
      if (success) {
        // Atualiza a atividade da conversa
        const conversation = await this.conversationService.getConversation(number);
        if (conversation) {
          await this.conversationService.updateConversationState(
            conversation.number,
            conversation.state,
            conversation.waitingFor || undefined,
            conversation.userData as any
          );
        }
      }
      return success;
    } catch (error) {
      console.error(`Erro ao enviar mensagem customizada para ${number}:`, error);
      return false;
    }
  }

  // Método para limpar conversas antigas (executa automaticamente)
  private async startCleanupScheduler(): Promise<void> {
    // Executa limpeza de conversas antigas a cada 48 horas (reduzido para economizar recursos)
    setInterval(async () => {
      try {
        // Só executa se não estiver hibernando
        if (!this.isHibernating) {
          const result = await this.conversationService.cleanOldConversations();
          console.log(`🧹 Limpeza automática: ${result.count} conversas antigas removidas`);
        }
      } catch (error) {
        console.error("Erro na limpeza automática:", error);
      }
    }, 48 * 60 * 60 * 1000); // 48 horas (reduzido de 24h)

    // Inicia o scheduler para reset diário à meia-noite
    this.startMidnightResetScheduler();
  }

  // Scheduler para resetar conversas todo dia à meia-noite
  private startMidnightResetScheduler(): void {
    const scheduleNextReset = () => {
      const now = new Date();
      const nextMidnight = new Date();
      nextMidnight.setDate(now.getDate() + 1);
      nextMidnight.setHours(0, 0, 0, 0); // Meia-noite
      
      const timeUntilMidnight = nextMidnight.getTime() - now.getTime();
      
      console.log(`🌙 Próximo reset automático agendado para: ${nextMidnight.toLocaleString('pt-BR')}`);
      
      setTimeout(async () => {
        try {
          const result = await this.conversationService.resetAllConversationsExceptBlocked();
          
          if (result.success) {
            console.log(`🌙 Reset meia-noite executado: ${result.deletedNormal} conversas resetadas`);
          } else {
            console.error("❌ Falha no reset da meia-noite:", result.error);
          }
        } catch (error) {
          console.error("❌ Erro crítico no reset da meia-noite:", error);
        }
        
        // Agenda o próximo reset para a próxima meia-noite
        scheduleNextReset();
      }, timeUntilMidnight);
    };
    
    // Inicia o primeiro agendamento
    scheduleNextReset();
  }

  // Métodos públicos para interface web
  getQRCode(): string | null {
    return this.currentQRCode;
  }

  isConnected(): boolean {
    return this.isReady;
  }

  async stop(): Promise<void> {
    if (this.client) {
      this.client.destroy();
    }
  }

  // Sistema de hibernação para economizar recursos
  private updateActivity(): void {
    this.lastActivity = Date.now();
    if (this.isHibernating) {
      this.wakeUp();
    }
  }

  private wakeUp(): void {
    if (!this.isHibernating) return;
    
    console.log("🔄 Acordando do modo hibernação...");
    this.isHibernating = false;
    
    // Força garbage collection se disponível
    if (global.gc) {
      global.gc();
    }
  }

  private hibernate(): void {
    if (this.isHibernating) return;
    
    console.log("💤 Entrando em modo hibernação para economizar recursos...");
    this.isHibernating = true;
    
    // Força garbage collection se disponível
    if (global.gc) {
      global.gc();
    }
  }

  private startHibernationTimer(): void {
    setInterval(() => {
      const inactiveTime = Date.now() - this.lastActivity;
      const hibernationThreshold = 30 * 60 * 1000; // 30 minutos sem atividade
      
      if (inactiveTime > hibernationThreshold && !this.isHibernating) {
        this.hibernate();
      }
    }, 5 * 60 * 1000); // Verifica a cada 5 minutos
  }
}

export default WhatsAppService; 