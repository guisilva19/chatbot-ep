import express, { Request, Response } from "express";
import WhatsAppService from "../services/WhatsAppService";

function createWebRoutes(whatsappService: WhatsAppService) {
  const router = express.Router();

  // Rota para mostrar QR code na web
  router.get("/", (req: Request, res: Response) => {
    const qrCodeData = whatsappService.getQRCode();
    
    if (qrCodeData) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>WhatsApp Bot - QR Code</title>
          <meta charset="UTF-8">
          <style>
            body { 
              font-family: Arial, sans-serif; 
              text-align: center; 
              padding: 20px;
              background: #f0f0f0;
            }
            .container {
              max-width: 500px;
              margin: 0 auto;
              background: white;
              padding: 30px;
              border-radius: 10px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .qr-code {
              margin: 20px 0;
              padding: 20px;
              background: white;
              border: 2px solid #ddd;
              border-radius: 10px;
            }
            .status {
              padding: 10px;
              border-radius: 5px;
              margin: 10px 0;
            }
            .waiting { background: #fff3cd; color: #856404; }
            .connected { background: #d4edda; color: #155724; }
            .refresh-btn {
              background: #007bff;
              color: white;
              padding: 10px 20px;
              border: none;
              border-radius: 5px;
              cursor: pointer;
              margin-top: 20px;
            }
            .refresh-btn:hover { background: #0056b3; }
          </style>

        </head>
        <body>
          <div class="container">
            <h1>🤖 WhatsApp Bot</h1>
            <div class="status waiting">
              <strong>📱 Aguardando conexão...</strong><br>
              Escaneie o QR code abaixo com seu WhatsApp
            </div>
            <div class="qr-code">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCodeData)}" alt="QR Code" />
            </div>

            <button class="refresh-btn" onclick="window.location.reload()">🔄 Atualizar</button>
          </div>
        </body>
        </html>
      `);
    } else if (whatsappService.isConnected()) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>WhatsApp Bot - Conectado</title>
          <meta charset="UTF-8">
          <style>
            body { 
              font-family: Arial, sans-serif; 
              text-align: center; 
              padding: 20px;
              background: #f0f0f0;
            }
            .container {
              max-width: 500px;
              margin: 0 auto;
              background: white;
              padding: 30px;
              border-radius: 10px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .status {
              padding: 15px;
              border-radius: 5px;
              margin: 20px 0;
            }
            .connected { background: #d4edda; color: #155724; }
            .success-icon { font-size: 48px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🤖 WhatsApp Bot</h1>
            <div class="success-icon">✅</div>
            <div class="status connected">
              <strong>WhatsApp Conectado com Sucesso!</strong><br>
              O bot está funcionando e pronto para receber mensagens.
            </div>
          </div>
        </body>
        </html>
      `);
    } else {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>WhatsApp Bot - Carregando</title>
          <meta charset="UTF-8">
          <style>
            body { 
              font-family: Arial, sans-serif; 
              text-align: center; 
              padding: 20px;
              background: #f0f0f0;
            }
            .container {
              max-width: 500px;
              margin: 0 auto;
              background: white;
              padding: 30px;
              border-radius: 10px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .loading { color: #6c757d; }
          </style>

        </head>
        <body>
          <div class="container">
            <h1>🤖 WhatsApp Bot</h1>
            <div class="loading">
              <h3>⏳ Carregando...</h3>
              <p>Aguarde enquanto o bot inicializa...</p>

            </div>
          </div>
        </body>
        </html>
      `);
    }
  });



  return router;
}

export default createWebRoutes; 