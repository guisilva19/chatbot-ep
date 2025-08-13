import express, { Request, Response } from "express";
import WebController from "../controllers/WebController";
import WhatsAppService from "../services/WhatsAppService";

function createWebRoutes(whatsappService: WhatsAppService) {
  const router = express.Router();
  const webController = new WebController(whatsappService);

  // Página principal
  router.get("/", (req: Request, res: Response) => webController.renderMainPage(req, res));

  // API Routes
  router.get("/api/status", (req: Request, res: Response) => webController.getWhatsAppStatus(req, res));
  router.get("/api/conversations", (req: Request, res: Response) => webController.getAllConversations(req, res));
  router.get("/api/conversation/:number", (req: Request, res: Response) => webController.getConversationHistory(req, res));
  router.get("/api/pending-messages", (req: Request, res: Response) => webController.getPendingMessages(req, res));
  
  router.post("/api/send-message", (req: Request, res: Response) => webController.sendMessage(req, res));
  router.post("/api/send-buttons", async (req: Request, res: Response) => {
    try {
      const { number } = req.body;
      
      if (!number) {
        res.status(400).json({ error: "Número é obrigatório" });
        return;
      }

      const success = await whatsappService.sendButtons(number);
      
      if (success) {
        res.json({ success: true, message: "Botões enviados com sucesso" });
      } else {
        res.status(500).json({ error: "Erro ao enviar botões" });
      }
    } catch (error) {
      res.status(500).json({ error: "Erro ao enviar botões" });
    }
  });
  
  router.post("/api/mark-responded", (req: Request, res: Response) => webController.markMessageAsResponded(req, res));

  return router;
}

export default createWebRoutes; 