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
- Dil: body'e `lang: "en"` eklenirse AI özeti İngilizce yazılır (varsayılan `"tr"`). Kontrol metinleri her zaman
  iki dilde gelir (`title`/`titleEn`, `detail`/`detailEn`); dil değişince sadece özet için yeni istek gerekir.
- Önbellek: aynı token 10 dk içinde tekrar sorulursa anında döner. Dil değişince zincir analizi
  önbellekten gelir, sadece AI özeti yeni dilde yazılır (birkaç saniye).
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
- `checks[].technical`: kısa teknik değer ("Teknik detay" altında), ör. `mintAuthority: null`
- `summary`: AI özeti (null olabilir)
- `positiveSignals`: yeşil etiketler
- `holderDistribution`: "Para kimin elinde?" paneli, arzın yüzdesi (0–100). Alınamazsa `null`.
  ```json
  { "wallet1": 9.95, "wallet2": 4.8, "wallet3": 2.54, "wallets4to10": 5.21, "others": 77.5 }
  ```
  En büyük hesaplar likidite havuzu olabilir.
- `websiteNotes`: "Web sitesinde bulunanlar" paneli. Site incelenmediyse (site yok / AI kapalı) boş dizi.
  ```json
  [{ "text": "Şüpheli bir vaat bulunmadı.", "textEn": "No suspicious promises found.", "level": "ok" }]
  ```
  `level`: `warn` = kırmızı bayrak, `ok` = olumlu/nötr gözlem. `textEn` null olabilir.
- `token`: isim, sembol, logo, linkler

SolExpert arayüzü (`public/js/app.js`) 11 kontrolü 5 karta toplar: basma · dondurma (+gizli ayarlar,
satış testi) · para kimin elinde (+bağlantılı cüzdanlar, geliştirici payı) · likidite (+kilit) ·
web sitesi (+token yaşı). Yan kontroller sadece sorunluysa kartın rengini ve metnini etkiler.

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
