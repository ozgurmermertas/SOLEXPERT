// Token'ın adı, sembolü ve RESMİ linkleri (site, twitter, telegram).
// Linkler token'ı oluşturanın metadata'ya kendi yazdığı linklerdir.
import { fetchJson, rpc } from "../http";
import type { MetadataFacts } from "../facts";

interface DasAsset {
  content?: {
    json_uri?: string;
    metadata?: { name?: string; symbol?: string };
    links?: { image?: string; external_url?: string };
  };
}

interface OffchainJson {
  image?: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  external_url?: string;
  extensions?: { website?: string; twitter?: string; telegram?: string };
}

export async function getMetadataFacts(address: string): Promise<MetadataFacts> {
  const asset = await rpc<DasAsset>("getAsset", { id: address });
  const content = asset.content ?? {};

  let off: OffchainJson = {};
  if (content.json_uri) {
    try {
      off = await fetchJson<OffchainJson>(toHttp(content.json_uri), {}, 6_000);
    } catch {
      // Metadata dosyasına ulaşılamazsa sadece zincirdeki bilgilerle devam.
    }
  }

  return {
    name: clean(content.metadata?.name),
    symbol: clean(content.metadata?.symbol),
    imageUrl: content.links?.image ?? off.image ?? null,
    website: normalizeUrl(off.website ?? off.extensions?.website ?? off.external_url ?? content.links?.external_url),
    twitter: normalizeUrl(off.twitter ?? off.extensions?.twitter),
    telegram: normalizeUrl(off.telegram ?? off.extensions?.telegram),
  };
}

function clean(s?: string): string | null {
  const t = s?.replace(/\0/g, "").trim();
  return t ? t : null;
}

function toHttp(uri: string): string {
  if (uri.startsWith("ipfs://")) return `https://ipfs.io/ipfs/${uri.slice(7)}`;
  if (uri.startsWith("ar://")) return `https://arweave.net/${uri.slice(5)}`;
  return uri;
}

export function normalizeUrl(u?: string | null): string | null {
  const t = u?.trim();
  if (!t) return null;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}
