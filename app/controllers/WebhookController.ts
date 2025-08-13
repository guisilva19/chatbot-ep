import { Request, Response } from "express";
import WhatsAppService from "../services/WhatsAppService";

interface WebhookPayload {
  message_type: string;
  private?: boolean;
  conversation: {
    meta?: {
      sender?: {
        phone_number?: string;
        identifier?: string;
      };
    };
  };
  content: string;
}

class WebhookController {
  private whatsappService: WhatsAppService;

  constructor(whatsappService: WhatsAppService) {
    this.whatsappService = whatsappService;
  }

  // Processa webhook recebido
  async handleWebhook(req: Request, res: Response): Promise<void> {
    const payload = req.body as WebhookPayload;

    // Ignora mensagens que não são de saída
    if (payload.message_type !== "outgoing") {
      res.sendStatus(200);
      return;
    }

    // Ignora mensagens privadas (ex: anotações internas dos agentes)
    if (payload.private === true) {
      res.sendStatus(200);
      return;
    }

    const conversation = payload.conversation;
    const whatsappNumber =
      conversation.meta?.sender?.phone_number ||
      conversation.meta?.sender?.identifier;
    const messageContent = payload.content;

    if (whatsappNumber && messageContent) {
      const chatId = `${whatsappNumber.replace("+", "")}@c.us`;

      try {
        const client = this.whatsappService.getClient();

        if (client && this.whatsappService.isClientReady()) {
          await client.sendMessage(chatId, messageContent);
          console.log(`✅ Mensagem enviada via webhook para ${whatsappNumber}: ${messageContent}`);
        } else {
          console.error("❌ WhatsApp client não está pronto para enviar mensagem via webhook");
        }
      } catch (error) {
        console.error("❌ Erro ao enviar mensagem via webhook:", error instanceof Error ? error.message : error);
      }
    }

    res.sendStatus(200);
  }

  // Endpoint de teste do webhook
  testWebhook(req: Request, res: Response): void {
    res.json({
      status: "success",
      message: "Webhook endpoint está funcionando",
      timestamp: new Date().toISOString()
    });
  }

  // Endpoint para verificar status do webhook
  getWebhookStatus(req: Request, res: Response): void {
    const isReady = this.whatsappService.isClientReady();
    res.json({
      webhook_active: true,
      whatsapp_ready: isReady,
      timestamp: new Date().toISOString()
    });
  }
}

export default WebhookController; 