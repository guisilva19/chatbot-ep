import express, { Request, Response } from "express";
import WebController from "../controllers/WebController";
import WhatsAppService from "../services/WhatsAppService";
import CleanerService from "../services/CleanerService";

function createWebRoutes(whatsappService: WhatsAppService, cleanerService?: CleanerService) {
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
  
  router.post("/api/mark-responded", (req: Request, res: Response) => webController.markMessageAsResponded(req, res));

  // Cleaner routes (se o cleanerService foi fornecido)
  if (cleanerService) {
    router.get("/api/cleaner/status", (req: Request, res: Response) => {
      const status = cleanerService.getStatus();
      res.json(status);
    });

    router.post("/api/cleaner/clean-now", async (req: Request, res: Response) => {
      try {
        await cleanerService.cleanNow();
        res.json({ success: true, message: "Limpeza executada com sucesso" });
      } catch (error) {
        res.status(500).json({ success: false, error: "Erro ao executar limpeza" });
      }
    });
  }

  return router;
}

export default createWebRoutes; 