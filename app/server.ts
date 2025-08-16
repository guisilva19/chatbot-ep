import dotenv from "dotenv";
import express from "express";

// Importar serviços
import WhatsAppService from "./services/WhatsAppService";
import CleanerService from "./services/CleanerService";

// Importar rotas
import createWebRoutes from "./routes/webRoutes";

// Configurações
const PORT = process.env.PORT || 3000;

// Inicializar aplicação
const app = express();

// Middleware para parsing JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Inicializar serviços
const whatsappService = new WhatsAppService();
const cleanerService = new CleanerService();

// Inicializar rotas
const webRoutes = createWebRoutes(whatsappService, cleanerService);

// Montar rotas
app.use("/", webRoutes);

// Iniciar serviços
whatsappService.start();
cleanerService.start();

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Encerrando aplicação...");
  whatsappService.stop();
  await cleanerService.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n🛑 Encerrando aplicação...");
  whatsappService.stop();
  await cleanerService.close();
  process.exit(0);
}); 