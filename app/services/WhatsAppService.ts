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
          "--disable-gpu",
          "--disable-web-security",
          "--disable-features=VizDisplayCompositor",
          "--disable-extensions",
          "--disable-plugins",
          "--disable-default-apps",
          "--disable-sync",
          "--disable-translate",
          "--no-first-run",
          "--no-default-browser-check",
          "--hide-scrollbars",
          "--mute-audio",
          "--disable-accelerated-2d-canvas",
          "--no-zygote",
          "--single-process",
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-renderer-backgrounding",
          "--disable-ipc-flooding-protection"
        ],
        timeout: 60000,
        ignoreDefaultArgs: ['--disable-extensions'],
        ignoreHTTPSErrors: true
      }
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    if (!this.client) return;

    
    this.client.on("qr", (qr: string) => {
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
      console.log(`🔐 Autenticado com sucesso em ${totalTime}ms (${(totalTime/1000).toFixed(2)}s)!`);
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

    console.log("🔍 Mensagem recebida:", msg);

    // Ignora mensagens de grupo
    const isGroup = rawNumber.includes("@g.us");
    if (isGroup) {
      return;
    }

    try {
      // Salva mensagem no banco
      await this.messageModel.create(numberE164, messageText, true);

      console.log(`📱 Nova mensagem de ${numberE164}: ${messageText}`);

      // Verifica se é mensagem "ep"
      if (messageText.toLowerCase().trim() === "ep") {
        await this.handleEpMessage(numberE164, messageText);
      }

    } catch (error) {
    }
  }

  private async handleOwnMessage(msg: WhatsAppMessage): Promise<void> {
    console.log("🔍 Mensagem recebida:", msg);
  }

  private async handleEpMessage(number: string, messageText: string): Promise<void> {
    console.log(`🆕 Mensagem "ep" detectada de ${number}`);
    
    try {
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
      await this.client.sendMessage(chatId, message);
      
      // Salva mensagem enviada no banco
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