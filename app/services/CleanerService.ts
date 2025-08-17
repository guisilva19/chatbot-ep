import { PrismaClient } from '@prisma/client';

class CleanerService {
  private prisma: PrismaClient;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Inicia o serviço de limpeza automática
   * Executa a cada 60 segundos
   */
  start(): void {
    if (this.isRunning) {
      console.log('⚠️ CleanerService já está rodando');
      return;
    }

    console.log('🧹 Iniciando CleanerService...');
    this.isRunning = true;

    // Executa imediatamente na primeira vez
    this.cleanOldRecords();

    // Configura para executar a cada 60 segundos (60000ms)
    this.intervalId = setInterval(() => {
      this.cleanOldRecords();
    }, 60000);

    console.log('✅ CleanerService iniciado com sucesso');
  }

  /**
   * Para o serviço de limpeza automática
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('⚠️ CleanerService não está rodando');
      return;
    }

    console.log('🛑 Parando CleanerService...');
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    console.log('✅ CleanerService parado com sucesso');
  }

  /**
   * Remove conversas antigas (mais de 1 hora sem atividade)
   */
  private async cleanOldRecords(): Promise<void> {
    try {
      console.log('🧹 Executando limpeza de conversas antigas...');

      // Calcula o timestamp de 1 hora atrás
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);

      // Remove conversas antigas (baseado na última atividade)
      const deletedConversations = await this.prisma.conversation.deleteMany({
        where: {
          lastActivity: {
            lt: oneHourAgo
          }
        }
      });

      if (deletedConversations.count > 0) {
        console.log(`🗑️ Limpeza concluída: ${deletedConversations.count} conversas antigas removidas`);
      } else {
        console.log('✨ Nenhuma conversa antiga encontrada para remoção');
      }

    } catch (error) {
      console.error('❌ Erro durante a limpeza de registros:', error);
    }
  }

  /**
   * Executa limpeza manual (para testes ou execução sob demanda)
   */
  async cleanNow(): Promise<void> {
    console.log('🧹 Executando limpeza manual...');
    await this.cleanOldRecords();
  }

  /**
   * Verifica se o serviço está rodando
   */
  getStatus(): { isRunning: boolean; intervalMs: number } {
    return {
      isRunning: this.isRunning,
      intervalMs: 60000
    };
  }

  /**
   * Fecha a conexão com o banco de dados
   */
  async close(): Promise<void> {
    this.stop();
    await this.prisma.$disconnect();
    console.log('🔌 Conexão do CleanerService com o banco fechada');
  }
}

export default CleanerService;
