// POST /api/voice  { "text": "..." }  → audio/mpeg (ElevenLabs ile sesli okuma)
import { config } from "@/lib/config";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!config.elevenLabsKey || !config.elevenLabsVoiceId) {
    return Response.json({ error: "ELEVENLABS_API_KEY veya ELEVENLABS_VOICE_ID eksik." }, { status: 503 });
  }
  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  if (!text?.trim()) return Response.json({ error: "text gerekli." }, { status: 400 });

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${config.elevenLabsVoiceId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": config.elevenLabsKey,
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({ text: text.slice(0, 2500), model_id: "eleven_multilingual_v2" }),
  });

  if (!res.ok) {
    console.error("[api/voice]", res.status, await res.text());
    return Response.json({ error: "Ses üretilemedi." }, { status: 502 });
  }
  return new Response(res.body, { headers: { "Content-Type": "audio/mpeg" } });
}
