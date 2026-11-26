# Backend API — Frontend için kullanım rehberi

Frontend sadece bu iki uç noktayı çağırır. Veri şekli `lib/types.ts` içindeki `TokenReport`.
Backend hazır olmadan arayüz geliştirmek için `lib/mock/report.mock.ts` kullan.

## 1. Analiz

```ts
const res = await fetch("/api/analyze", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ address: "TOKEN_ADRESI" }),
});
const data = await res.json();
if (!res.ok) {
  // data.error → kullanıcıya gösterilecek Türkçe hata mesajı
} else {
  // data → TokenReport
}
```

- Süre: 5–25 saniye (site analizi ve AI özeti dahil). Arayüzde yükleniyor durumu şart.
- Hızlı mod (AI'sız): body'e `withAi: false` ekle → 2–5 saniye.
- Tarayıcıdan test: `http://localhost:3000/api/analyze?address=TOKEN_ADRESI`

### Hata kodları
| Kod | Anlamı |
|---|---|
| 400 | Geçersiz adres ya da adres bir token değil |
| 500 | Beklenmeyen sunucu hatası |

### Arayüzde gösterilecekler
- `score` (0–100) ve `level`: `dusuk` 🟢 / `dikkat` 🟡 / `yuksek` 🔴
- `checks`: `group` alanına göre 4 başlık altında kartlar
  - `anahtarlar` → "Anahtarlar kimde?"
  - `dagilim` → "Para kimin elinde?"
  - `alim_satim` → "Alıp satabilir misin?"
  - `proje` → "Proje gerçek mi?"
- Her kartta `status` ikonu: `gecti` 🟢, `dikkat` 🟡, `tehlikeli` 🔴, `bilinmiyor` ⚪
- `summary`: AI özeti (null olabilir)
- `positiveSignals`: yeşil etiketler
- `token`: isim, sembol, logo, linkler

## 2. Sesli okuma

```ts
const res = await fetch("/api/voice", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ text: report.summary }),
});
const blob = await res.blob();
new Audio(URL.createObjectURL(blob)).play();
```

503 dönerse ElevenLabs anahtarı henüz eklenmemiştir; ses butonunu gizle.

## Uyarı metni
Arayüzün altına: "Bu bir risk analizidir, yatırım tavsiyesi değildir."
