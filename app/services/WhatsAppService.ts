import dotenv from "dotenv";
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
    const startTime = Date.now();
    console.log("🔄 Iniciando WhatsApp client...");
    
    const clientStartTime = Date.now();
    console.log("📱 Criando WhatsApp client...");
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
    const clientTime = Date.now() - clientStartTime;
    console.log(`✅ Client criado em ${clientTime}ms`);

    const handlersStartTime = Date.now();
    console.log("⚙️ Configurando event handlers...");
    this.setupEventHandlers();
    const handlersTime = Date.now() - handlersStartTime;
    console.log(`✅ Event handlers configurados em ${handlersTime}ms`);
    
    const initStartTime = Date.now();
    console.log("🚀 Inicializando client...");
    this.client.initialize();
    const initTime = Date.now() - initStartTime;
    console.log(`✅ Client inicializado em ${initTime}ms`);
    
    // Timer para medir tempo total
    this.startTime = startTime;
    const totalInitTime = Date.now() - startTime;
    console.log(`⏱️ Tempo total de inicialização: ${totalInitTime}ms (${(totalInitTime/1000).toFixed(2)}s)`);
  }

  private setupEventHandlers(): void {
    if (!this.client) return;

    console.log("📡 Configurando eventos do WhatsApp...");
    
    this.client.on("qr", (qr: string) => {
      console.log("🔍 Evento QR detectado!");
      const qrTime = Date.now();
      const totalTime = qrTime - this.startTime;
      console.log(`📱 QR Code gerado em ${totalTime}ms (${(totalTime/1000).toFixed(2)}s):`);
      qrcode.generate(qr, { small: true });
    });

    this.client.on("ready", () => {
      const readyTime = Date.now();
      const totalTime = readyTime - this.startTime;
      console.log(`✅ Conectado ao WhatsApp em ${totalTime}ms (${(totalTime/1000).toFixed(2)}s)!`);
      this.isReady = true;
    });

    this.client.on("loading_screen", (percent: number, message: string) => {
      const loadingTime = Date.now();
      const totalTime = loadingTime - this.startTime;
      console.log(`⏳ Carregando ${percent}% - ${message} (${totalTime}ms)`);
    });

    this.client.on("authenticated", () => {
      const authTime = Date.now();
      const totalTime = authTime - this.startTime;
      console.log(`🔐 Autenticado com sucesso em ${totalTime}ms (${(totalTime/1000).toFixed(2)}s)!`);
    });

    this.client.on("auth_failure", (msg: string) => {
      const failTime = Date.now();
      const totalTime = failTime - this.startTime;
      console.log(`❌ Falha na autenticação em ${totalTime}ms: ${msg}`);
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
      console.log("❌ WhatsApp desconectado:", reason);
      this.isReady = false;
    });

    // Eventos adicionais para debug
    this.client.on("change_state", (state: string) => {
      console.log(`🔄 Estado do cliente mudou para: ${state}`);
    });

    this.client.on("incoming_call", (call: any) => {
      console.log("📞 Chamada recebida");
    });

    this.client.on("open", () => {
      console.log("🔓 Cliente aberto");
    });

    this.client.on("close", () => {
      console.log("🔒 Cliente fechado");
    });

    console.log("✅ Event handlers configurados");
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
      console.error("Erro ao processar mensagem:", error);
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
      console.error("WhatsApp client não está pronto");
      return false;
    }

    try {
      const chatId = `${number.replace("+", "")}@c.us`;
      await this.client.sendMessage(chatId, message);
      
      // Salva mensagem enviada no banco
      await this.messageModel.create(number, message, false);
      
      console.log(`✅ Mensagem enviada para ${number}: ${message}`);
      return true;
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      return false;
    }
  }

  async sendButtons(number: string): Promise<boolean> {
    const buttons = [
      { body: "1️⃣ - Falar com atendente" },
      { body: "2️⃣ - Ver produtos" },
      { body: "3️⃣ - Falar sobre preços" },
      { body: "4️⃣ - Outras opções" }
    ];

    let message = "Escolha uma opção:\n\n";
    buttons.forEach((button) => {
      message += `${button.body}\n`;
    });

    return await this.sendMessage(number, message);
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