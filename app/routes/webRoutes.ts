import express, { Request, Response } from "express";
import WhatsAppService from "../services/WhatsAppService";
import CleanerService from "../services/CleanerService";

function createWebRoutes(whatsappService: WhatsAppService, cleanerService?: CleanerService) {
  const router = express.Router();

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