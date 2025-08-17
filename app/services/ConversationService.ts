import { PrismaClient, ConversationState } from '@prisma/client';

const prisma = new PrismaClient();

interface UserData {
  selectedOption?: string;
  residenceSize?: string;
  energyConsumption?: string;
  panelPreference?: string;
  wellDepth?: string;
  waterFlow?: string;
  pumpPreference?: string;
  investmentGoal?: string;
  riskProfile?: string;
  investmentType?: string;
  budget?: string;
  financingPreference?: string;
  wantsIncentives?: string;
  technicalProblem?: string;
  errorMessage?: string;
  wantsTechnicalVisit?: string;
  [key: string]: any;
}

export class ConversationService {
  
  async getOrCreateConversation(number: string, firstMessage: string) {
    try {
      // Usa upsert para evitar erro de constraint único
      const conversation = await prisma.conversation.upsert({
        where: { number },
        update: {
          // Atualiza a última atividade se a conversa já existe
          lastActivity: new Date()
        },
        create: {
          number,
          firstMessage,
          state: ConversationState.INITIAL,
          userData: {}
        }
      });

      return conversation;
    } catch (error) {
      console.error(`Erro ao buscar/criar conversa para ${number}:`, error);
      
      // Fallback: tenta buscar a conversa que já existe
      const existingConversation = await prisma.conversation.findUnique({
        where: { number }
      });
      
      if (existingConversation) {
        return existingConversation;
      }
      
      throw error;
    }
  }

  async updateConversationState(
    number: string, 
    state: ConversationState, 
    waitingFor?: string, 
    userData?: UserData
  ) {
    const updateData: any = {
      state,
      lastActivity: new Date()
    };

    if (waitingFor !== undefined) {
      updateData.waitingFor = waitingFor;
    }

    if (userData !== undefined) {
      updateData.userData = userData;
    }

    return await prisma.conversation.update({
      where: { number },
      data: updateData
    });
  }

  async updateUserData(number: string, newData: Partial<UserData>) {
    const conversation = await prisma.conversation.findUnique({
      where: { number }
    });

    if (!conversation) {
      throw new Error('Conversa não encontrada');
    }

    const currentData = (conversation.userData as UserData) || {};
    const updatedData = { ...currentData, ...newData };

    return await prisma.conversation.update({
      where: { number },
      data: {
        userData: updatedData,
        lastActivity: new Date()
      }
    });
  }

  async getConversation(number: string) {
    return await prisma.conversation.findUnique({
      where: { number }
    });
  }

  async markAsCompleted(number: string) {
    return await this.updateConversationState(number, ConversationState.COMPLETED);
  }

  async resetConversation(number: string) {
    return await prisma.conversation.update({
      where: { number },
      data: {
        state: ConversationState.INITIAL,
        waitingFor: null,
        userData: {},
        lastActivity: new Date()
      }
    });
  }

  // Método para limpar conversas antigas (mais de 30 dias sem atividade)
  async cleanOldConversations() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return await prisma.conversation.deleteMany({
      where: {
        lastActivity: {
          lt: thirtyDaysAgo
        }
      }
    });
  }
}

export default ConversationService;
