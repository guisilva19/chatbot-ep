import { Request, Response } from "express";
import WhatsAppService from "../services/WhatsAppService";

class WebController {
  private whatsappService: WhatsAppService;

  constructor(whatsappService: WhatsAppService) {
    this.whatsappService = whatsappService;
  }

  // Renderiza a página principal
  renderMainPage(req: Request, res: Response): void {
    const html = this.generateHTML();
    res.send(html);
  }

  // API para buscar mensagens pendentes
  async getPendingMessages(req: Request, res: Response): Promise<void> {
    try {
      const messages = this.whatsappService.getPendingMessages();
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar mensagens" });
    }
  }

  // API para marcar mensagem como respondida
  markMessageAsResponded(req: Request, res: Response): void {
    try {
      const { messageId } = req.body;
      this.whatsappService.markMessageAsResponded(messageId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Erro ao marcar mensagem" });
    }
  }

  // API para buscar histórico de conversa
  async getConversationHistory(req: Request, res: Response): Promise<void> {
    try {
      const { number } = req.params;
      if (!number) {
        res.status(400).json({ error: "Número é obrigatório" });
        return;
      }
      const history = await this.whatsappService.getConversationHistory(number);
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar histórico" });
    }
  }

  // API para buscar todas as conversas
  async getAllConversations(req: Request, res: Response): Promise<void> {
    try {
      const conversations = await this.whatsappService.getAllConversations();
      res.json(conversations);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar conversas" });
    }
  }

  // API para enviar mensagem
  async sendMessage(req: Request, res: Response): Promise<void> {
    try {
      const { number, message } = req.body;
      
      if (!number || !message) {
        res.status(400).json({ error: "Número e mensagem são obrigatórios" });
        return;
      }

      const success = await this.whatsappService.sendMessage(number, message);
      
      if (success) {
        res.json({ success: true, message: "Mensagem enviada com sucesso" });
      } else {
        res.status(500).json({ error: "Erro ao enviar mensagem" });
      }
    } catch (error) {
      res.status(500).json({ error: "Erro ao enviar mensagem" });
    }
  }

  // API para status do WhatsApp
  getWhatsAppStatus(req: Request, res: Response): void {
    const isReady = this.whatsappService.isClientReady();
    res.json({ isReady });
  }

  private generateHTML(): string {
    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WhatsApp Bot - Interface de Atendimento</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        
        .header {
            background: #25D366;
            color: white;
            padding: 20px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 24px;
            margin-bottom: 5px;
        }
        
        .status-indicator {
            display: inline-block;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            margin-left: 10px;
        }
        
        .status-online {
            background: #4CAF50;
        }
        
        .status-offline {
            background: #f44336;
        }
        
        .content {
            display: flex;
            min-height: 600px;
        }
        
        .sidebar {
            width: 300px;
            background: #f8f9fa;
            border-right: 1px solid #e9ecef;
            overflow-y: auto;
        }
        
        .chat-area {
            flex: 1;
            display: flex;
            flex-direction: column;
        }
        
        .contact-item {
            padding: 15px;
            border-bottom: 1px solid #e9ecef;
            cursor: pointer;
            transition: background 0.2s;
        }
        
        .contact-item:hover {
            background: #e9ecef;
        }
        
        .contact-item.active {
            background: #007bff;
            color: white;
        }
        
        .contact-number {
            font-weight: bold;
            margin-bottom: 5px;
        }
        
        .contact-last-message {
            font-size: 12px;
            color: #6c757d;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        
        .chat-header {
            background: #f8f9fa;
            padding: 15px;
            border-bottom: 1px solid #e9ecef;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .chat-messages {
            flex: 1;
            padding: 20px;
            overflow-y: auto;
            max-height: 400px;
        }
        
        .message {
            margin-bottom: 15px;
            padding: 10px 15px;
            border-radius: 10px;
            max-width: 70%;
        }
        
        .message.client {
            background: #e3f2fd;
            margin-left: auto;
        }
        
        .message.bot {
            background: #f5f5f5;
        }
        
        .message-time {
            font-size: 11px;
            color: #666;
            margin-top: 5px;
        }
        
        .chat-input {
            padding: 20px;
            border-top: 1px solid #e9ecef;
            display: flex;
            gap: 10px;
        }
        
        .chat-input input {
            flex: 1;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 5px;
            font-size: 14px;
        }
        
        .chat-input button {
            padding: 10px 20px;
            background: #25D366;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
        }
        
        .chat-input button:hover {
            background: #128C7E;
        }
        
        .chat-input button:disabled {
            background: #ccc;
            cursor: not-allowed;
        }
        
        .no-chat {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: #666;
            font-size: 18px;
        }
        
        .loading {
            text-align: center;
            padding: 20px;
            color: #666;
        }
        
        .error {
            color: #f44336;
            padding: 10px;
            background: #ffebee;
            border-radius: 5px;
            margin: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>WhatsApp Bot Interface</h1>
            <p>Status: <span id="status-text">Verificando...</span>
                <span id="status-indicator" class="status-indicator status-offline"></span>
            </p>
        </div>
        
        <div class="content">
            <div class="sidebar" id="sidebar">
                <div class="loading">Carregando conversas...</div>
            </div>
            
            <div class="chat-area">
                <div class="chat-header">
                    <h3 id="chat-title">Selecione uma conversa</h3>
                    <button onclick="sendButtons()" id="send-buttons-btn" disabled>Enviar Botões</button>
                </div>
                
                <div class="chat-messages" id="chat-messages">
                    <div class="no-chat">
                        Selecione uma conversa para começar
                    </div>
                </div>
                
                <div class="chat-input">
                    <input type="text" id="message-input" placeholder="Digite sua mensagem..." disabled>
                    <button onclick="sendMessage()" id="send-btn" disabled>Enviar</button>
                </div>
            </div>
        </div>
    </div>

    <script>
        let currentChat = null;
        let conversations = [];
        
        // Verificar status do WhatsApp
        async function checkStatus() {
            try {
                const response = await fetch('/api/status');
                const data = await response.json();
                
                const statusText = document.getElementById('status-text');
                const statusIndicator = document.getElementById('status-indicator');
                
                if (data.isReady) {
                    statusText.textContent = 'Conectado';
                    statusIndicator.className = 'status-indicator status-online';
                } else {
                    statusText.textContent = 'Desconectado';
                    statusIndicator.className = 'status-indicator status-offline';
                }
            } catch (error) {
                console.error('Erro ao verificar status:', error);
            }
        }
        
        // Carregar conversas
        async function loadConversations() {
            try {
                const response = await fetch('/api/conversations');
                conversations = await response.json();
                
                const sidebar = document.getElementById('sidebar');
                sidebar.innerHTML = '';
                
                conversations.forEach(conv => {
                    const contactItem = document.createElement('div');
                    contactItem.className = 'contact-item';
                    contactItem.onclick = () => selectChat(conv.number);
                    
                    contactItem.innerHTML = \`
                        <div class="contact-number">\${conv.number}</div>
                        <div class="contact-last-message">\${conv.first_message}</div>
                    \`;
                    
                    sidebar.appendChild(contactItem);
                });
                
                if (conversations.length === 0) {
                    sidebar.innerHTML = '<div class="loading">Nenhuma conversa encontrada</div>';
                }
            } catch (error) {
                console.error('Erro ao carregar conversas:', error);
                document.getElementById('sidebar').innerHTML = '<div class="error">Erro ao carregar conversas</div>';
            }
        }
        
        // Selecionar chat
        async function selectChat(number) {
            currentChat = number;
            
            // Atualizar UI
            document.querySelectorAll('.contact-item').forEach(item => item.classList.remove('active'));
            event.target.closest('.contact-item').classList.add('active');
            
            document.getElementById('chat-title').textContent = \`Chat com \${number}\`;
            document.getElementById('message-input').disabled = false;
            document.getElementById('send-btn').disabled = false;
            document.getElementById('send-buttons-btn').disabled = false;
            
            // Carregar histórico
            await loadChatHistory(number);
        }
        
        // Carregar histórico do chat
        async function loadChatHistory(number) {
            try {
                const response = await fetch(\`/api/conversation/\${number}\`);
                const messages = await response.json();
                
                const chatMessages = document.getElementById('chat-messages');
                chatMessages.innerHTML = '';
                
                messages.reverse().forEach(msg => {
                    const messageDiv = document.createElement('div');
                    messageDiv.className = \`message \${msg.is_from_client ? 'client' : 'bot'}\`;
                    
                    const time = new Date(msg.timestamp).toLocaleTimeString();
                    
                    messageDiv.innerHTML = \`
                        <div>\${msg.message}</div>
                        <div class="message-time">\${time}</div>
                    \`;
                    
                    chatMessages.appendChild(messageDiv);
                });
                
                chatMessages.scrollTop = chatMessages.scrollHeight;
            } catch (error) {
                console.error('Erro ao carregar histórico:', error);
            }
        }
        
        // Enviar mensagem
        async function sendMessage() {
            if (!currentChat) return;
            
            const input = document.getElementById('message-input');
            const message = input.value.trim();
            
            if (!message) return;
            
            try {
                const response = await fetch('/api/send-message', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        number: currentChat,
                        message: message
                    })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    input.value = '';
                    await loadChatHistory(currentChat);
                } else {
                    alert('Erro ao enviar mensagem');
                }
            } catch (error) {
                console.error('Erro ao enviar mensagem:', error);
                alert('Erro ao enviar mensagem');
            }
        }
        
        // Enviar botões
        async function sendButtons() {
            if (!currentChat) return;
            
            try {
                const response = await fetch('/api/send-buttons', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        number: currentChat
                    })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    await loadChatHistory(currentChat);
                } else {
                    alert('Erro ao enviar botões');
                }
            } catch (error) {
                console.error('Erro ao enviar botões:', error);
                alert('Erro ao enviar botões');
            }
        }
        
        // Event listeners
        document.getElementById('message-input').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
        
        // Inicialização
        checkStatus();
        loadConversations();
        
        // Atualizar periodicamente
        setInterval(checkStatus, 10000);
        setInterval(loadConversations, 30000);
    </script>
</body>
</html>
    `;
  }
}

export default WebController; 