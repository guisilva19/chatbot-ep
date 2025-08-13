import { PrismaClient, Message, Conversation } from '@prisma/client';

class MessageModel {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async create(number: string, message: string, isFromClient: boolean = true): Promise<string> {
    try {
      const result = await this.prisma.message.create({
        data: {
          number,
          message,
          isFromClient
        }
      });
      return result.id;
    } catch (error) {
      console.error('Erro ao criar mensagem:', error);
      throw error;
    }
  }

  async getByNumber(number: string, limit: number = 50): Promise<Message[]> {
    try {
      return await this.prisma.message.findMany({
        where: { number },
        orderBy: { timestamp: 'desc' },
        take: limit
      });
    } catch (error) {
      console.error('Erro ao buscar mensagens por número:', error);
      return [];
    }
  }

  async getAll(limit: number = 100): Promise<Message[]> {
    try {
      return await this.prisma.message.findMany({
        orderBy: { timestamp: 'desc' },
        take: limit
      });
    } catch (error) {
      console.error('Erro ao buscar todas as mensagens:', error);
      return [];
    }
  }

  async getConversations(): Promise<Conversation[]> {
    try {
      return await this.prisma.conversation.findMany({
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      console.error('Erro ao buscar conversas:', error);
      return [];
    }
  }

  async createConversation(number: string, firstMessage: string): Promise<string | null> {
    try {
      const result = await this.prisma.conversation.upsert({
        where: { number },
        update: {},
        create: {
          number,
          firstMessage
        }
      });
      return result.id;
    } catch (error) {
      console.error('Erro ao criar conversa:', error);
      throw error;
    }
  }

  async getConversationByNumber(number: string): Promise<Conversation | null> {
    try {
      return await this.prisma.conversation.findUnique({
        where: { number }
      });
    } catch (error) {
      console.error('Erro ao buscar conversa por número:', error);
      return null;
    }
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

export default MessageModel; 