// POST /api/analyze  { "address": "..." }  → TokenReport
// GET  /api/analyze?address=...             → TokenReport (tarayıcıdan hızlı test için)
import { analyzeToken, InvalidAddressError } from "@/lib/analyze";
import { NotATokenError } from "@/lib/onchain/mint";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: { address?: string; withAi?: boolean; lang?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Gövde JSON olmalı: { \"address\": \"...\" }" }, { status: 400 });
  }
  return handle(body.address, body.withAi, body.lang);
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  return handle(params.get("address") ?? undefined, params.get("ai") !== "0", params.get("lang") ?? undefined);
}

async function handle(address?: string, withAi?: boolean, lang?: string) {
  if (!address) return Response.json({ error: "address gerekli." }, { status: 400 });
  try {
    // lang: AI özetinin dili ("tr" varsayılan, "en")
    const report = await analyzeToken(address, { withAi, lang: lang === "en" ? "en" : "tr" });
    return Response.json(report);
  } catch (e) {
    if (e instanceof InvalidAddressError || e instanceof NotATokenError) {
      return Response.json({ error: e.message }, { status: 400 });
    }
    console.error("[api/analyze]", e);
    return Response.json({ error: "Analiz sırasında bir hata oluştu." }, { status: 500 });
  }
}
