import { Client, LocalAuth, Message as WhatsAppMessage } from "whatsapp-web.js";
import qrcode from "qrcode-terminal";
import { ConversationService } from "./ConversationService";
import { MessageTemplates } from "./MessageTemplates";
import { ConversationState } from "@prisma/client";

interface PendingMessage {
  id: number;
  number: string;
  message: string;
  timestamp: Date;
}

class WhatsAppService {
  private client: Client | null = null;
  private pendingMessages: PendingMessage[] = [];
  private isReady: boolean = false;
  private startTime: number = 0;
  private blockedContacts: Map<string, number> = new Map(); // número -> timestamp do bloqueio
  private conversationService: ConversationService;
  private processingMessages: Set<string> = new Set(); // números sendo processados


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
          "--disable-gpu"
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
      console.log("\n📲 Escaneie o QR code abaixo com o WhatsApp:\n");
      qrcode.generate(qr, { small: true });
    });

    this.client.on("ready", () => {
      this.isReady = true;
      console.log("✅ WhatsApp conectado! Sistema de conversação ativado.");
      
      // Inicia o scheduler de limpeza automática
      this.startCleanupScheduler();
    });

    this.client.on("loading_screen", (percent: number, message: string) => {
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

    // Eventos adicionais para debug
    this.client.on("change_state", (state: string) => {
    });

    this.client.on("incoming_call", (call: any) => {
    });

    this.client.on("open", () => {
      console.log("🔓 Cliente aberto");
    });

    this.client.on("close", () => {
      console.log("🔒 Cliente fechado");
    });

  }

  private async handleIncomingMessage(msg: WhatsAppMessage): Promise<void> {
    const rawNumber = msg.from;
    const messageText = msg.body;
    const numberE164 = `+${rawNumber.replace("@c.us", "")}`;

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
      this.blockContact(numberE164);
    }
  }



  private async handleEpMessage(number: string, messageText: string): Promise<void> {
    try {
      // PRIMEIRA PRIORIDADE: Verifica se é comando "stop" para bloquear por 1 ano
      if (messageText.toLowerCase().trim() === "stop") {
        await this.conversationService.blockContactForOneYear(number);
        console.log(`🔒 Contato ${number} bloqueado por 1 ano devido ao comando "stop"`);
        // Remove do bloqueio de 1 hora se existir, pois agora está bloqueado por 1 ano
        if (this.blockedContacts.has(number)) {
          this.blockedContacts.delete(number);
        }
        return;
      }

      // SEGUNDA PRIORIDADE: Verifica se o contato está bloqueado por 1 ano
      if (await this.conversationService.isContactBlockedForOneYear(number)) {
        console.log(`🔒 Contato bloqueado por 1 ano: ${number} - Mensagem ignorada: "${messageText}"`);
        return;
      }

      // TERCEIRA PRIORIDADE: Verifica se o contato está bloqueado por 1 hora (sistema antigo)
      if (this.isContactBlocked(number)) {
        const remainingTime = this.getRemainingBlockTime(number);
        console.log(`🚫 Bot bloqueado para ${number} - Tempo restante: ${remainingTime} - Mensagem ignorada: "${messageText}"`);
        return;
      }

      // Verifica se o bot está desativado para este usuário (novo sistema)
      if (await this.conversationService.isBotDisabled(number)) {
        const remainingMinutes = await this.conversationService.getRemainingDisableTime(number);
        console.log(`🤖 Bot desativado para ${number} - Tempo restante: ${remainingMinutes} minutos - Mensagem ignorada: "${messageText}"`);
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
    
    // Aguarda 1 segundo e envia o menu
    setTimeout(async () => {
      await this.sendMessage(number, MessageTemplates.getMainMenu());
      await this.conversationService.updateConversationState(
        number, 
        ConversationState.WAITING_OPTION,
        "option_selection"
      );
    }, 1000);
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
      await this.sendMessage(number, "Perfeito! Por último, você tem alguma preferência por tipo de painel solar ou inversor em específico?");
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
      await this.sendMessage(number, "Obrigado! Agora me informe qual é a vazão de água necessária:");
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
      await this.sendMessage(number, "Obrigado! Agora me informe qual é o seu perfil de risco (conservador, moderado ou arrojado):");
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
      await this.sendMessage(number, "Obrigado! Agora me informe qual é sua preferência por tipo de financiamento:");
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

  // Bloqueia o bot para um contato por 1 hora
  private blockContact(number: string): void {
    const blockTime = Date.now();
    this.blockedContacts.set(number, blockTime);
    console.log(`🚫 Bot bloqueado para ${number} por 1 hora`);
    
    setTimeout(() => {
      this.blockedContacts.delete(number);
      console.log(`✅ Bot desbloqueado para ${number}`);
    }, 60 * 60 * 1000); // 1 hora em millisegundos
  }

  // Verifica se um contato está bloqueado
  private isContactBlocked(number: string): boolean {
    if (!this.blockedContacts.has(number)) {
      return false;
    }

    const blockTime = this.blockedContacts.get(number)!;
    const currentTime = Date.now();
    const oneHour = 60 * 60 * 1000; // 1 hora em millisegundos

    // Se passou mais de 1 hora, remove o bloqueio
    if (currentTime - blockTime > oneHour) {
      this.blockedContacts.delete(number);
      return false;
    }

    return true;
  }

  // Método público para desbloquear um contato manualmente
  unblockContact(number: string): boolean {
    if (this.blockedContacts.has(number)) {
      this.blockedContacts.delete(number);
      console.log(`✅ Bot desbloqueado manualmente para ${number}`);
      return true;
    }
    return false;
  }

  // Método helper para calcular tempo restante de bloqueio
  private getRemainingBlockTime(number: string): string {
    if (!this.blockedContacts.has(number)) {
      return "0 minutos";
    }
    
    const blockTime = this.blockedContacts.get(number)!;
    const currentTime = Date.now();
    const oneHour = 60 * 60 * 1000;
    const elapsed = currentTime - blockTime;
    const remaining = oneHour - elapsed;
    
    if (remaining <= 0) {
      return "0 minutos";
    }
    
    const remainingMinutes = Math.ceil(remaining / (60 * 1000));
    return `${remainingMinutes} minutos`;
  }

  getBlockedContacts(): { number: string, blockedAt: Date, remainingTime: string }[] {
    const currentTime = Date.now();
    const oneHour = 60 * 60 * 1000;
    
    return Array.from(this.blockedContacts.entries()).map(([number, blockTime]) => {
      const elapsed = currentTime - blockTime;
      const remaining = oneHour - elapsed;
      const remainingMinutes = Math.ceil(remaining / (60 * 1000));
      
      return {
        number,
        blockedAt: new Date(blockTime),
        remainingTime: `${remainingMinutes} minutos`
      };
    });
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
    // Executa limpeza de conversas antigas a cada 24 horas
    setInterval(async () => {
      try {
        const result = await this.conversationService.cleanOldConversations();
        console.log(`🧹 Limpeza automática: ${result.count} conversas antigas removidas`);
      } catch (error) {
        console.error("Erro na limpeza automática:", error);
      }
    }, 24 * 60 * 60 * 1000); // 24 horas
  }

  async stop(): Promise<void> {
    if (this.client) {
      this.client.destroy();
    }
  }
}

export default WhatsAppService; 