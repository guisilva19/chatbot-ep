import { Client, LocalAuth, Message as WhatsAppMessage } from "whatsapp-web.js";
import qrcode from "qrcode-terminal";
import MessageModel from "../models/Message";

interface PendingMessage {
  id: number;
  number: string;
  message: string;
  timestamp: Date;
}

class WhatsAppService {
  private client: Client | null = null;
  private messageModel: MessageModel;
  private pendingMessages: PendingMessage[] = [];
  private isReady: boolean = false;
  private startTime: number = 0;
  private blockedContacts: Map<string, number> = new Map(); // número -> timestamp do bloqueio


  constructor() {
    this.messageModel = new MessageModel();
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

    try {
      // Salva mensagem no banco
      await this.messageModel.create(numberE164, messageText, true);

      await this.handleEpMessage(numberE164, messageText);

    } catch (error) {
    }
  }

  private async handleOwnMessage(msg: WhatsAppMessage): Promise<void> {
    const rawNumber = msg.to;
    const messageText = msg.body;
    const numberE164 = `+${rawNumber.replace("@c.us", "")}`;
    
    // Verifica se a mensagem tem a marca do bot (Zero Width Space no final)
    const isFromBot = messageText.endsWith("\u200B");
    
    if (!isFromBot) {
      // Esta mensagem foi enviada manualmente pelo celular
      console.log(`📱 Mensagem MANUAL enviada para ${numberE164}: ${messageText}`);
      
      // Bloqueia bot para este contato por 1 hora
      this.blockContact(numberE164);
      
      try {
        // Salva mensagem manual no banco como não sendo do cliente (isFromClient = false)
        await this.messageModel.create(numberE164, messageText, false);
      } catch (error) {
        console.error("❌ Erro ao salvar mensagem manual:", error);
      }
    } else {
      console.log(`🤖 Mensagem do BOT detectada para ${numberE164}`);
    }
  }



  private async handleEpMessage(number: string, messageText: string): Promise<void> {
    try {
      // Verifica se o contato está bloqueado
      if (this.isContactBlocked(number)) {
        console.log(`🚫 Bot bloqueado para ${number} - mensagem ignorada`);
        return;
      }

      // Cria conversa se for nova
      await this.messageModel.createConversation(number, messageText);

      // Envia resposta automática
      const autoResponse = "Opa, baauuum dms? 😎\n\nO que você gostaria de fazer?";
      await this.sendMessage(number, autoResponse);

    } catch (error) {
      console.error("Erro ao processar mensagem 'ep':", error);
    }
  }

  async sendMessage(number: string, message: string): Promise<boolean> {
    if (!this.client || !this.isReady) {
      return false;
    }

    try {
      const chatId = `${number.replace("+", "")}@c.us`;
      // Adiciona marca invisível para identificar mensagens do bot
      const messageWithBotTag = message + "\u200B"; // Zero Width Space - invisível
      
      await this.client.sendMessage(chatId, messageWithBotTag);

      // Salva mensagem enviada no banco (sem a marca invisível)
      await this.messageModel.create(number, message, false);

      return true;
    } catch (error) {
      return false;
    }
  }

  getClient(): Client | null {
    return this.client;
  }

  isClientReady(): boolean {
    return this.isReady;
  }

  getPendingMessages(): PendingMessage[] {
    return this.pendingMessages;
  }

  markMessageAsResponded(messageId: number): void {
    this.pendingMessages = this.pendingMessages.filter(msg => msg.id !== messageId);
  }

  async getConversationHistory(number: string) {
    try {
      return await this.messageModel.getByNumber(number);
    } catch (error) {
      console.error("Erro ao buscar histórico:", error);
      return [];
    }
  }

  async getAllConversations() {
    try {
      return await this.messageModel.getConversations();
    } catch (error) {
      console.error("Erro ao buscar conversas:", error);
      return [];
    }
  }

  // Bloqueia o bot para um contato por 1 hora
  private blockContact(number: string): void {
    const blockTime = Date.now();
    this.blockedContacts.set(number, blockTime);
    console.log(`🚫 Bot bloqueado para ${number} por 1 hora`);
    
    // Remove o bloqueio após 1 hora
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

  // Método público para verificar contatos bloqueados
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

  async stop(): Promise<void> {
    if (this.client) {
      this.client.destroy();
    }
    if (this.messageModel) {
      await this.messageModel.close();
    }
  }
}

export default WhatsAppService; 