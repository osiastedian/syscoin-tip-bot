import TelegramBot, { Update } from "node-telegram-bot-api";
import { CallbackHandler } from "./types";

import { WalletService } from "services/wallet-service";
import { CallbackData } from "./enums";

export class PrivateKeyCallbackHandler implements CallbackHandler {
  callbackData = CallbackData.RevealPrivateKey;

  constructor(private walletService: WalletService) {}

  async handleCallback(bot: TelegramBot, update: Update): Promise<void> {
    const { message, from } = update.callback_query!;
    const {
      chat: { id },
    } = message!;

    const userId = from?.id;

    if (!userId) {
      console.error("No User Id!", update);
      throw new Error("No User Id found");
    }

    const wallet = await this.walletService.getWallet(userId);
    if (!wallet) {
      bot.sendMessage(id, "No wallet created yet.");
      return;
    }

    bot.sendMessage(
      id,
      `Please keep your private key safe and *DO NOT share it with ANYONE*\n\nPrivate key:\t\t\`${wallet.privateKey}\``,
      {
        parse_mode: "Markdown",
      }
    );
  }
}
