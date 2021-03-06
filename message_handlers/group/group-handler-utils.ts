import { ActiveAirdropMember, GroupChatMember } from "@prisma/client";
import TelegramBot from "node-telegram-bot-api";
import { groupMemberService, walletService } from "services";

function getRandomInt(min: number, max: number) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function selectWinners(
  numberOfWinners: number,
  members: Array<GroupChatMember | ActiveAirdropMember>
) {
  const winners: Array<GroupChatMember | ActiveAirdropMember> = [];

  if (members.length < numberOfWinners) {
    numberOfWinners = members.length;
  }

  while (winners.length !== numberOfWinners) {
    const rand = getRandomInt(0, members.length - 1);
    const chosen = members[rand];
    const exist = winners.find((m) => chosen.userId === m.userId);
    if (!exist) {
      winners.push(members[rand]);
    }
  }
  return getAddresses(winners);
}

async function getAddresses(
  winners: Array<GroupChatMember | ActiveAirdropMember>
) {
  return await Promise.all(
    winners.map(async (winner) => {
      const userId = Number(winner.userId);
      const groupMember = await groupMemberService.getGroupChatMember(userId);
      const wallet = await walletService.getOrCreateWallet(userId, groupMember?.username ?? undefined);
      return wallet!.address;
    })
  );
}

async function isAdmin(userId: number, chatId: number, bot: TelegramBot) {
  const administrators = await bot.getChatAdministrators(chatId);

  const isAdmin = administrators.find((admin) => {
    return admin.user.id === userId;
  });
  return isAdmin;
}

const groupHandlerUtils = {
  selectWinners,
  isAdmin,
  getAddresses,
};

export default groupHandlerUtils;
