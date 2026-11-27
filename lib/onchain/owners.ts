// Token hesaplarının sahiplerini bulur ve sahibin gerçek bir cüzdan mı, yoksa likidite havuzu /
// program hesabı mı olduğunu ayırt eder. Bundle kontrolü ve holder dağılımı aynı yöntemi kullanır.
//
// Yöntem: gerçek cüzdan = zincirde var olan, System Program'a ait, çalıştırılamayan hesap.
// Havuz kasalarının (ve pump.fun eğrisinin) sahibi bir PDA'dır: ya zincirde hesabı yoktur
// ya da bir programa aittir → "havuz/program".
import { rpc as defaultRpc } from "../http";

export const SYSTEM_PROGRAM = "11111111111111111111111111111111";

type Rpc = <T>(method: string, params: unknown) => Promise<T>;

interface AccountInfo {
  owner: string;
  executable: boolean;
  data: unknown;
}

/** Token hesaplarının sahipleri (girdi sırasıyla; okunamayan için null). */
export async function tokenAccountOwners(tokenAccounts: string[], call: Rpc = defaultRpc): Promise<(string | null)[]> {
  if (tokenAccounts.length === 0) return [];
  const res = await call<{ value: (AccountInfo | null)[] }>("getMultipleAccounts", [
    tokenAccounts,
    { encoding: "jsonParsed" },
  ]);
  return res.value.map((acc) =>
    (acc?.data as { parsed?: { info?: { owner?: string } } } | undefined)?.parsed?.info?.owner ?? null);
}

/** Her sahip için: true = gerçek cüzdan, false = likidite havuzu / program hesabı. */
export async function isWalletOwner(owners: string[], call: Rpc = defaultRpc): Promise<boolean[]> {
  if (owners.length === 0) return [];
  const res = await call<{ value: (AccountInfo | null)[] }>("getMultipleAccounts", [
    owners,
    { encoding: "base64", dataSlice: { offset: 0, length: 0 } },
  ]);
  return res.value.map((a) => !!a && a.owner === SYSTEM_PROGRAM && !a.executable);
}
