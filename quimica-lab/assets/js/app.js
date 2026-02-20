const STORAGE_THEME = "quimicalab_theme";
const STORAGE_STUDY = "quimicalab_layout2_studied";

const state = {
  items: [],
  filter: "all",
  search: "",
  studied: new Set(JSON.parse(localStorage.getItem(STORAGE_STUDY) || "[]"))
};

const els = {
  themeToggle: document.getElementById("themeToggle"),
  searchInput: document.getElementById("searchInput"),
  chips: document.querySelectorAll(".chip"),
  cards: document.getElementById("cards"),
  summaryBody: document.getElementById("summaryBody"),
  progressFill: document.getElementById("progressFill"),
  progressText: document.getElementById("progressText"),
  year: document.getElementById("year")
};

init();

async function init() {
  initTheme();
  initYear();
  bindEvents();
  await loadData();
  render();
}

function initTheme() {
  const saved = localStorage.getItem(STORAGE_THEME);
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const initial = saved || (systemDark ? "dark" : "light");
  applyTheme(initial);

  els.themeToggle?.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    applyTheme(next);
    localStorage.setItem(STORAGE_THEME, next);
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  if (!els.themeToggle) return;

  const dark = theme === "dark";
  els.themeToggle.setAttribute("aria-pressed", String(dark));
  els.themeToggle.textContent = dark ? "☀️ Claro" : "🌙 Escuro";
}

function initYear() {
  if (els.year) els.year.textContent = String(new Date().getFullYear());
}

function bindEvents() {
  els.searchInput?.addEventListener("input", (e) => {
    state.search = normalize(e.target.value);
    renderCards();
  });

  els.chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      state.filter = chip.dataset.filter || "all";

      els.chips.forEach((c) => c.setAttribute("aria-pressed", "false"));
      chip.setAttribute("aria-pressed", "true");

      renderCards();
    });
  });

  els.cards?.addEventListener("click", (e) => {
    const btn = e.target.closest(".mark-btn");
    if (!btn) return;

    const id = btn.dataset.id;
    if (!id) return;

    if (state.studied.has(id)) state.studied.delete(id);
    else state.studied.add(id);

    localStorage.setItem(STORAGE_STUDY, JSON.stringify([...state.studied]));
    renderCards();
    updateProgress();
  });
}

async function loadData() {
  try {
    const res = await fetch("data/vidrarias.json");
    if (!res.ok) throw new Error("Erro ao carregar vidrarias.json");
    state.items = await res.json();
  } catch (err) {
    console.error(err);
    if (els.cards) {
      els.cards.innerHTML = `
        <p class="empty">
          Não consegui carregar os dados. Rode com servidor local (Live Server, http.server, etc.).
        </p>`;
    }
  }
}

function normalize(text) {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function labelCategory(cat) {
  const map = {
    medir: "Medir",
    aquecer: "Aquecer",
    transferir: "Transferir",
    separar: "Separar"
  };
  return map[cat] || cat;
}

function filterItems() {
  return state.items.filter((item) => {
    const passFilter = state.filter === "all" || item.categorias?.includes(state.filter);
    const passSearch = normalize(item.nome).includes(state.search);
    return passFilter && passSearch;
  });
}

function render() {
  renderCards();
  renderSummary();
  updateProgress();
}

function renderCards() {
  if (!els.cards) return;
  const list = filterItems();

  if (!list.length) {
    els.cards.innerHTML = `<p class="empty">Nenhum item encontrado com os filtros atuais.</p>`;
    return;
  }

  els.cards.innerHTML = list.map((item) => {
    const isDone = state.studied.has(item.id);
    const erros = (item.errosComuns || []).map((e) => `<li>${e}</li>`).join("");
    const seguranca = (item.seguranca || []).map((s) => `<li>${s}</li>`).join("");
    const badges = (item.categorias || [])
      .map((c) => `<span class="badge">${labelCategory(c)}</span>`)
      .join("");

    return `
      <article class="card" aria-labelledby="title-${item.id}">
        <div class="card-media">
          <img src="${item.imagem}" alt="${item.alt || item.nome}" loading="lazy" decoding="async" />
        </div>

        <div class="card-body">
          <h3 id="title-${item.id}">${item.nome}</h3>
          <div class="badges">${badges}</div>
          <p><strong>Função principal:</strong> ${item.funcao}</p>

          <details>
            <summary>Como usar + erros + segurança</summary>
            <p><strong>Como usar corretamente:</strong> ${item.comoUsar || "—"}</p>

            <p><strong>Erros comuns:</strong></p>
            <ul>${erros || "<li>—</li>"}</ul>

            <p><strong>Cuidados de segurança:</strong></p>
            <ul>${seguranca || "<li>—</li>"}</ul>

            <div class="callout tip"><strong>Dica de prova:</strong> ${item.dicaProva || "—"}</div>
            <div class="callout warn"><strong>Atenção: pegadinha comum:</strong> ${item.pegadinha || "—"}</div>
          </details>

          <button class="btn btn-ghost mark-btn ${isDone ? "done" : ""}" type="button" data-id="${item.id}" aria-pressed="${isDone}">
            ${isDone ? "✅ Revisado" : "Marcar como revisado"}
          </button>
        </div>
      </article>
    `;
  }).join("");
}

function renderSummary() {
  if (!els.summaryBody) return;

  const rows = [...state.items]
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    .map((item) => `
      <tr>
        <td>${item.nome}</td>
        <td>${item.funcao}</td>
        <td>${item.resumo?.precisao || "—"}</td>
        <td>${item.resumo?.podeAquecer || "—"}</td>
        <td>${item.pegadinha || "—"}</td>
      </tr>
    `);

  els.summaryBody.innerHTML = rows.join("");
}

function updateProgress() {
  if (!els.progressFill || !els.progressText) return;

  const total = state.items.length || 13;
  const value = Math.round((state.studied.size / total) * 100);

  els.progressFill.style.width = `${value}%`;
  els.progressFill.parentElement?.setAttribute("aria-valuenow", String(value));
  els.progressText.textContent = `${value}% concluído • ${state.studied.size}/${total} revisados`;
}
