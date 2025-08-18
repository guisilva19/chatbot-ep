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

  async markAsCompleted(number: string, disableMinutes: number = 5) {
    // Calcula quando o bot deve ser reativado (padrão: 5 minutos)
    const disableUntil = new Date(Date.now() + (disableMinutes * 60 * 1000));
    
    return await prisma.conversation.update({
      where: { number },
      data: {
        state: ConversationState.COMPLETED,
        botDisabledUntil: disableUntil,
        lastActivity: new Date()
      }
    });
  }

  async resetConversation(number: string) {
    return await prisma.conversation.update({
      where: { number },
      data: {
        state: ConversationState.INITIAL,
        waitingFor: null,
        userData: {},
        botDisabledUntil: null,
        lastActivity: new Date()
      }
    });
  }

  async isBotDisabled(number: string): Promise<boolean> {
    const conversation = await prisma.conversation.findUnique({
      where: { number },
      select: { botDisabledUntil: true }
    });

    if (!conversation?.botDisabledUntil) {
      return false;
    }

    const now = new Date();
    if (now >= conversation.botDisabledUntil) {
      // Se o tempo de desativação passou, remove a desativação
      await prisma.conversation.update({
        where: { number },
        data: { botDisabledUntil: null }
      });
      return false;
    }

    return true;
  }

  async getRemainingDisableTime(number: string): Promise<number> {
    const conversation = await prisma.conversation.findUnique({
      where: { number },
      select: { botDisabledUntil: true }
    });

    if (!conversation?.botDisabledUntil) {
      return 0;
    }

    const now = new Date();
    const remaining = conversation.botDisabledUntil.getTime() - now.getTime();
    return Math.max(0, Math.ceil(remaining / (60 * 1000))); // retorna minutos restantes
  }

  async blockContactForOneYear(number: string): Promise<void> {
    const yearBlockedUntil = new Date();
    yearBlockedUntil.setFullYear(yearBlockedUntil.getFullYear() + 1); // Adiciona 1 ano

    await prisma.conversation.upsert({
      where: { number },
      update: {
        yearBlockedUntil,
        lastActivity: new Date()
      },
      create: {
        number,
        firstMessage: "stop",
        state: ConversationState.INITIAL,
        userData: {},
        yearBlockedUntil
      }
    });
  }

  async isContactBlockedForOneYear(number: string): Promise<boolean> {
    const conversation = await prisma.conversation.findUnique({
      where: { number },
      select: { yearBlockedUntil: true }
    });

    if (!conversation?.yearBlockedUntil) {
      return false;
    }

    const now = new Date();
    if (now >= conversation.yearBlockedUntil) {
      // Se o tempo de bloqueio passou, remove o bloqueio
      await prisma.conversation.update({
        where: { number },
        data: { yearBlockedUntil: null }
      });
      return false;
    }

    return true;
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
