// Kontroller: basma yetkisi, dondurma yetkisi, Token-2022 gizli ayarları.
import { rpc } from "../http";
import type { MintFacts, Token2022Flags } from "../facts";

const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

interface ParsedExtension {
  extension: string;
  state?: Record<string, unknown>;
}

interface AccountInfoResult {
  value: {
    owner: string;
    data: {
      program?: string;
      parsed?: {
        type: string;
        info: {
          mintAuthority: string | null;
          freezeAuthority: string | null;
          supply: string;
          decimals: number;
          extensions?: ParsedExtension[];
        };
      };
    };
  } | null;
}

export class NotATokenError extends Error {}

export async function getMintFacts(address: string): Promise<MintFacts> {
  const res = await rpc<AccountInfoResult>("getAccountInfo", [address, { encoding: "jsonParsed" }]);
  const parsed = res.value?.data?.parsed;
  if (!res.value || !parsed || parsed.type !== "mint") {
    throw new NotATokenError("Bu adres bir Solana token'ı değil.");
  }
  const info = parsed.info;
  const isToken2022 = res.value.owner === TOKEN_2022_PROGRAM;

  return {
    isToken2022,
    mintAuthority: info.mintAuthority ?? null,
    freezeAuthority: info.freezeAuthority ?? null,
    supply: BigInt(info.supply),
    decimals: info.decimals,
    token2022: isToken2022 ? readExtensions(info.extensions ?? [], info.freezeAuthority ?? null) : null,
  };
}

function readExtensions(exts: ParsedExtension[], freezeAuthority: string | null): Token2022Flags {
  const find = (name: string) => exts.find((e) => e.extension === name)?.state;

  const fee = find("transferFeeConfig") as
    | {
        newerTransferFee?: { transferFeeBasisPoints?: number };
        olderTransferFee?: { transferFeeBasisPoints?: number };
        transferFeeConfigAuthority?: string | null;
      }
    | undefined;
  const transferFeeBps = Math.max(
    fee?.newerTransferFee?.transferFeeBasisPoints ?? 0,
    fee?.olderTransferFee?.transferFeeBasisPoints ?? 0,
  );

  const delegate = find("permanentDelegate") as { delegate?: string | null } | undefined;
  const hook = find("transferHook") as { programId?: string | null; authority?: string | null } | undefined;
  const defaultState = find("defaultAccountState") as { accountState?: string } | undefined;
  const hasDefaultState = exts.some((e) => e.extension === "defaultAccountState");

  return {
    transferFeeBps,
    permanentDelegate: delegate?.delegate ?? null,
    transferHook: hook?.programId ?? null,
    nonTransferable: exts.some((e) => e.extension === "nonTransferable"),
    defaultFrozen: defaultState?.accountState === "frozen",
    transferFeeAuthority: fee?.transferFeeConfigAuthority ?? null,
    transferHookAuthority: hook?.authority ?? null,
    // Varsayılan hesap durumunu Token-2022'de dondurma yetkilisi değiştirir; ayrı bir alanı yoktur.
    defaultStateAuthority: hasDefaultState ? freezeAuthority : null,
  };
}
