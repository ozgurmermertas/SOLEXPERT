// Arka planda yavaşça süzülen, kendi ekseninde dönen coinler (yıldızların yerine).
(() => {
  const canvas = document.getElementById("coin-bg");
  const ctx = canvas.getContext("2d");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SYMBOLS = ["◎", "$", "◎", "₿", "◎", "¤"];
  const PALETTES = [
    ["#9945ff", "#14f195"], // Solana tonları
    ["#f7c948", "#b7791f"], // altın
    ["#c9ccd1", "#6b7280"], // gümüş
  ];
  let coins = [], w = 0, h = 0, dpr = 1, scrollY = 0;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.round(Math.min(70, (w * h) / 22000));
    coins = Array.from({ length: count }, () => makeCoin(Math.random() * h));
  }

  function makeCoin(y) {
    const depth = Math.random(); // 0 uzak, 1 yakın
    return {
      x: Math.random() * w,
      y,
      r: 3 + depth * 13,
      depth,
      vy: 0.08 + depth * 0.35,
      vx: (Math.random() - 0.5) * 0.15,
      spin: Math.random() * Math.PI * 2,
      vspin: 0.01 + Math.random() * 0.03,
      pal: PALETTES[Math.random() < 0.55 ? 0 : Math.random() < 0.6 ? 1 : 2],
      sym: SYMBOLS[(Math.random() * SYMBOLS.length) | 0],
      alpha: 0.25 + depth * 0.55,
    };
  }

  function drawCoin(c) {
    const py = c.y - scrollY * c.depth * 0.25; // parallax
    const y = ((py % (h + 40)) + h + 40) % (h + 40) - 20;
    const sx = Math.max(0.12, Math.abs(Math.cos(c.spin))); // dönme efekti
    ctx.save();
    ctx.translate(c.x, y);
    ctx.scale(sx, 1);
    ctx.globalAlpha = c.alpha;
    if (c.r > 4) {
      const g = ctx.createLinearGradient(-c.r, -c.r, c.r, c.r);
      g.addColorStop(0, c.pal[0]);
      g.addColorStop(1, c.pal[1]);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, c.r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, 0, c.r * 0.78, 0, Math.PI * 2); ctx.stroke();
      if (c.r > 8 && sx > 0.45) {
        ctx.fillStyle = "rgba(0,0,0,.55)";
        ctx.font = `${Math.round(c.r)}px sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(c.sym, 0, 1);
      }
    } else {
      ctx.fillStyle = c.pal[0];
      ctx.beginPath(); ctx.arc(0, 0, c.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function tick() {
    ctx.clearRect(0, 0, w, h);
    for (const c of coins) {
      if (!reduce) {
        c.y += c.vy; c.x += c.vx; c.spin += c.vspin;
        if (c.x < -20) c.x = w + 20;
        if (c.x > w + 20) c.x = -20;
      }
      drawCoin(c);
    }
    if (!reduce) requestAnimationFrame(tick);
  }

  window.addEventListener("resize", resize);
  window.addEventListener("scroll", () => { scrollY = window.scrollY; if (reduce) tick(); }, { passive: true });
  resize();
  tick();
})();
