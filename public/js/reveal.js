// Kaydırınca kartların sağdan / soldan kayarak gelmesi.
// Ekrana her girişte tekrar oynar.
// Bir grubun kartları sırayla soldan, sağdan gelir ve her biri biraz gecikir.
window.SolReveal = (() => {
  const GROUPS = [".cards .card", ".stats .stat", "#checks .check", "#flags .flag", ".partners .partner", ".steps .step", ".section-head"];
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      // Her girişte gelir, ekrandan çıkınca sıfırlanır: animasyon her seferinde tekrarlanır
      en.target.classList.toggle("in", en.isIntersecting);
    });
  }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });

  function scan() {
    GROUPS.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el, i) => {
        if (el.dataset.reveal) return;
        el.dataset.reveal = sel === ".section-head" ? "up" : i % 2 === 0 ? "left" : "right";
        el.style.setProperty("--d", `${Math.min(i, 6) * 90}ms`);
        io.observe(el);
      });
    });
  }
  scan();
  return { scan };
})();
