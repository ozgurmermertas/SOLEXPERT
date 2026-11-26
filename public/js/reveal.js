// Kaydırınca kartların sağdan / soldan kayarak gelmesi.
// Bir grubun kartları sırayla soldan, sağdan gelir ve her biri biraz gecikir.
window.SolReveal = (() => {
  const GROUPS = [".cards .card", ".stats .stat", "#checks .check", ".report-grid .panel", ".partners .partner", ".steps .step", ".section-head"];
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
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
