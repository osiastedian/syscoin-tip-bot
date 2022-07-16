import { ERC20Token } from "types/supported-erc20-token";
import { TokenInfo } from "types/token-info";

export const supportedTokens: Record<ERC20Token, TokenInfo> = {
  PSYS: {
    symbol: "PSYS",
    address: "0xE18c200A70908c89fFA18C628fE1B83aC0065EA4",
  },
  ETK: {
    symbol: "ETK",
    address: "0xe2318b19B93f920838ec5fa2B4FD51bEe92B3e77",
  },
};
