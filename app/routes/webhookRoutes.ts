import express, { Request, Response } from "express";
import bodyParser from "body-parser";
import WebhookController from "../controllers/WebhookController";
import WhatsAppService from "../services/WhatsAppService";

function createWebhookRoutes(whatsappService: WhatsAppService) {
  const router = express.Router();
  const webhookController = new WebhookController(whatsappService);

  // Middleware para parsing do body
  router.use(bodyParser.json());

  // Webhook principal
  router.post("/", (req: Request, res: Response) => webhookController.handleWebhook(req, res));

  // Endpoint de teste
  router.get("/test", (req: Request, res: Response) => webhookController.testWebhook(req, res));

  // Endpoint de status
  router.get("/status", (req: Request, res: Response) => webhookController.getWebhookStatus(req, res));

  return router;
}

export default createWebhookRoutes; 