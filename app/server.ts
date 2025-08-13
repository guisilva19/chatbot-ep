import dotenv from "dotenv";
import express from "express";

// Importar serviços
import WhatsAppService from "./services/WhatsAppService";

// Importar rotas
import createWebRoutes from "./routes/webRoutes";

// Configurações
const PORT = process.env.PORT || 3000;

// Inicializar aplicação
const app = express();

// Middleware para parsing JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Inicializar serviço WhatsApp
const whatsappService = new WhatsAppService();

// Inicializar rotas
const webRoutes = createWebRoutes(whatsappService);

// Montar rotas
app.use("/", webRoutes);

// Iniciar WhatsApp client
whatsappService.start();

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Encerrando aplicação...");
  whatsappService.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n🛑 Encerrando aplicação...");
  whatsappService.stop();
  process.exit(0);
}); 