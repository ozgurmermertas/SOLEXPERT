// FRONTEND — takım arkadaşının alanı. Bu sadece geçici bir yer tutucu.
// Arayüz: adres kutusu → POST /api/analyze → TokenReport'u göster (bkz. API.md).
export default function Home() {
  return (
    <main style={{ fontFamily: "sans-serif", padding: 40 }}>
      <h1>Token Ekspertiz</h1>
      <p>Arayüz yakında. Backend testi için: /api/analyze?address=TOKEN_ADRESI</p>
    </main>
  );
}
