import groupHandlerUtils from "message_handlers/group/group-handler-utils";
import TelegramBot, { SendMessageOptions, Update } from "node-telegram-bot-api";
import {
  activeAirdropService,
  botMessageService,
  transactionService,
  walletService,
} from "services";
import { MessageConfigI } from "services/bot-message-service";
import { generateAirdropMessage } from "shared/utils";
import { CallbackData } from "./enums";
import { CallbackHandler } from "./types";

export class CloseAirdropCallbackHandler implements CallbackHandler {
  callbackData = CallbackData.CloseAirdrop;
  async handleCallback(bot: TelegramBot, update: Update): Promise<void> {
    const callbackQuery = update.callback_query!;

    if (!callbackQuery) {
      throw new Error("Callback Query not found");
    }
    const { message, from } = callbackQuery;

    const userId = from?.id;
    const chatId = message!.chat.id;
    const sendMessageConfig: SendMessageOptions = {
      parse_mode: "Markdown",
    };

    const botMessageConfig: MessageConfigI = {
      bot,
      chatId,
      sendMessageConfig,
    };

    if (!userId) {
      console.error("No User Id!", update);
      throw new Error("No User Id found");
    }
    const isAdmin = await groupHandlerUtils.isAdmin(userId, chatId, bot);

    if (!isAdmin) {
      await botMessageService.actionNotAllowed(
        "Only admins can close active-airdops",
        {
          bot,
          sendMessageConfig,
          chatId: userId,
        }
      );
      console.error("User is not an admin");
      return;
    }

    const messageId = message!.message_id;
    const activeAirdrop = await activeAirdropService.getActiveAirdrop(
      messageId
    );

    if (!activeAirdrop) {
      console.error(`No active airdrop with message_id: ${messageId}`);
      return;
    }

    const airdropMembers = activeAirdrop.ActiveAirdropMember;

    if (!airdropMembers || airdropMembers.length === 0) {
      await bot.editMessageText(
        "*Active Airdroped Canceled* ❌\nNo participants joined",
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: "Markdown",
        }
      );
      await activeAirdropService.removeActiveAirdrop(messageId);
      return;
    }

    const addresses = await groupHandlerUtils.selectWinners(
      activeAirdrop.count,
      airdropMembers
    );

    const wallet = await walletService.getWallet(userId);

    if (!wallet) {
      await botMessageService.noWalletMsg(botMessageConfig);
      return;
    }

    const amount = Number(activeAirdrop.amount);
    if (isNaN(amount) || amount <= 0) {
      console.error(`Invalid amount: ${amount}`);
      return;
    }

    const isBalanceSufficient =
      await transactionService.validateSufficientBalance(
        wallet.address,
        amount
      );

    if (!isBalanceSufficient) {
      await botMessageService.insufficientBalance(botMessageConfig);
      return;
    }

    let data = transactionService.airDrop(addresses);

    const transactionConfig =
      await transactionService.getTransactionConfigForContract(amount, data, wallet.address);

    const signedTransaction = await transactionService.signTransaction(
      wallet.privateKey,
      transactionConfig
    );

    let botMessage = generateAirdropMessage(
      addresses,
      transactionConfig,
      signedTransaction.rawTransaction!
    );

    await bot.sendMessage(from!.id, botMessage, {
      parse_mode: "Markdown",
      reply_markup: botMessageService.confirmAirdropReplyMarkup(messageId),
    });
  }
}
