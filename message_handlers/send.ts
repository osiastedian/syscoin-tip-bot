import TelegramBot, { SendMessageOptions, Update } from "node-telegram-bot-api";
import {
  BotMessageService,
  MessageConfigI,
} from "services/bot-message-service";
import { TransactionService } from "services/transaction-service";
import { WalletService } from "services/wallet-service";
import web3 from "services/web3";
import { TransactionConfig } from "web3-core";
import { MessageHandler } from "./types";

export class SendMessageHandler implements MessageHandler {
  identifier = /\/send*/g;

  constructor(
    private walletService: WalletService,
    private transactionService: TransactionService,
    private botMessageService: BotMessageService
  ) {}

  async handleMessage(bot: TelegramBot, update: Update): Promise<void> {
    const {
      message_id,
      chat: { id },
      text,
      from,
    } = update.message!;
    const sendMessageConfig: SendMessageOptions = {
      parse_mode: "Markdown",
      reply_to_message_id: message_id,
    };

    const botMessageConfig: MessageConfigI = {
      bot,
      chatId: id,
      sendMessageConfig,
    };

    const userId = from?.id;

    if (!userId) {
      console.error("No User Id!", update);
      throw new Error("No User Id found");
    }

    const tokens = (text ?? "").split(" ");

    const properSyntax = "Must be: `/send <address> <amount>`";

    if (tokens.length !== 3) {
      await bot.sendMessage(
        id,
        `*Invalid Syntax*:\n${properSyntax}`,
        sendMessageConfig
      );
      return;
    }

    const [_, address, amountInText] = (text ?? "").split(" ");

    if (!web3.utils.isAddress(address)) {
      await bot.sendMessage(
        id,
        `*Invalid wallet address.*\n${properSyntax}`,
        sendMessageConfig
      );
      return;
    }

    const wallet = await this.walletService.getWallet(userId);

    if (!wallet) {
      await this.botMessageService.noWalletMsg(botMessageConfig);
      return;
    }

    if (wallet.address === address) {
      await bot.sendMessage(
        id,
        "You have entered your own wallet address. Please try again."
      );
      return;
    }

    const amount = Number(amountInText);
    if (isNaN(amount) || amount <= 0) {
      await this.botMessageService.invalidAmountTextMsg(
        amountInText,
        botMessageConfig
      );
      return;
    }

    const isBalanceSufficient =
      await this.transactionService.validateSufficientBalance(
        wallet.address,
        amount
      );

    if (!isBalanceSufficient) {
      await this.botMessageService.insufficientBalance(botMessageConfig);
      return;
    }

    if (!web3.utils.isAddress(address)) {
      await this.botMessageService.invalidAddressMsg(address, botMessageConfig);
      return;
    }

    const account = web3.eth.accounts.privateKeyToAccount(wallet.privateKey);

    const transactionConfig =
      await this.transactionService.getTransactionConfig(address, amount);

    const signedTransaction = await account.signTransaction(transactionConfig);

    if (!signedTransaction.rawTransaction) {
      await bot.sendMessage(
        id,
        "Failed to sign transaction.",
        sendMessageConfig
      );
      return;
    }

    let message = this.generateBotMessage(
      transactionConfig,
      signedTransaction.rawTransaction!
    );

    await bot.sendMessage(id, message, {
      parse_mode: "Markdown",
      reply_to_message_id: message_id,
      reply_markup: this.botMessageService.confirmTxReplyMarkup,
    });
  }

  generateBotMessage(
    transactionConfig: TransactionConfig,
    rawTransaction: string
  ) {
    const amountFromWei = web3.utils.fromWei(
      transactionConfig.value!.toString(),
      "ether"
    );

    return `Confirming your transaction:\n\nAddress: ${transactionConfig.to}\nAmount: ${amountFromWei}\n\nPlease reply "yes" to this message to confirm.\n\n\nRAW Transaction: ${rawTransaction}`;
  }
}
