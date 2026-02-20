// assets/js/minigames.js (substitua inteiro)

const STORAGE_THEME = "quimicalab_theme";

const REQUIRED_NAMES = [
  "Becker",
  "Erlenmayer",
  "Pipeta graduada",
  "Pipeta volumétrica",
  "Tubo de ensaio",
  "Bico de bunsen",
  "Proveta",
  "Balão volumétrico",
  "Bastão de vidro",
  "Vidro de relógio",
  "Funil de separação",
  "Funil comum",
  "Condensador",
  "Balão de destilação",
  "Balão de fundo redondo",
  "Bureta"
];

const state = {
  items: [],
  missingNames: []
};

/* ========= Tema ========= */
const themeBtn = document.getElementById("themeToggle");
const yearEl = document.getElementById("year");

/* ========= Memória ========= */
const memory = {
  deck: [],
  firstIndex: null,
  lock: false,
  matched: new Set(),
  moves: 0,
  targetPairs: 0
};

const memoryEls = {
  board: document.getElementById("memoryBoard"),
  moves: document.getElementById("memoryMoves"),
  pairs: document.getElementById("memoryPairs"),
  feedback: document.getElementById("memoryFeedback"),
  restart: document.getElementById("restartMemory")
};

/* ========= Sprint ========= */
const sprint = {
  active: false,
  time: 60,
  score: 0,
  timerId: null,
  current: null,
  correctDeck: []
};

const sprintEls = {
  start: document.getElementById("startSprint"),
  time: document.getElementById("sprintTime"),
  score: document.getElementById("sprintScore"),
  question: document.getElementById("sprintQuestion"),
  options: document.getElementById("sprintOptions"),
  feedback: document.getElementById("sprintFeedback")
};

/* ========= Desafio da Imagem ========= */
const imageQuiz = {
  active: false,
  round: 0,
  totalRounds: 0,
  score: 0,
  current: null,
  deck: []
};

const imageEls = {
  start: document.getElementById("startImageQuiz"),
  round: document.getElementById("imageRound"),
  score: document.getElementById("imageScore"),
  img: document.getElementById("imageQuizImg"),
  prompt: document.getElementById("imageQuizPrompt"),
  options: document.getElementById("imageQuizOptions"),
  feedback: document.getElementById("imageQuizFeedback"),
  next: document.getElementById("nextImageRound")
};

init();

async function init() {
  initTheme();
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  await loadData();

  setupMemoryGame();
  setupSprintGame();
  setupImageQuizGame();

  if (state.missingNames.length > 0) {
    const msg = `Atenção: faltam no JSON: ${state.missingNames.join(", ")}.`;
    setMemoryFeedback(msg);
    sprintEls.feedback.textContent = msg;
    imageEls.feedback.textContent = msg;
  }
}

function initTheme() {
  const saved = localStorage.getItem(STORAGE_THEME);
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const initial = saved || (systemDark ? "dark" : "light");
  applyTheme(initial);

  themeBtn?.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme");
    const next = cur === "dark" ? "light" : "dark";
    applyTheme(next);
    localStorage.setItem(STORAGE_THEME, next);
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  if (!themeBtn) return;
  const dark = theme === "dark";
  themeBtn.setAttribute("aria-pressed", String(dark));
  themeBtn.textContent = dark ? "☀️ Claro" : "🌙 Escuro";
}

async function loadData() {
  try {
    const res = await fetch("data/vidrarias.json");
    if (!res.ok) throw new Error("Falha ao carregar data/vidrarias.json");

    const all = await res.json();

    const byName = new Map();
    for (const item of all) {
      byName.set(normalize(item.nome), item);
    }

    state.items = REQUIRED_NAMES
      .map((name) => byName.get(normalize(name)))
      .filter(Boolean);

    state.missingNames = REQUIRED_NAMES.filter((name) => !byName.has(normalize(name)));
  } catch (e) {
    console.error(e);
    state.items = [];
    state.missingNames = [...REQUIRED_NAMES];
  }
}

/* ===========================
   JOGO 1 - MEMÓRIA
=========================== */
function setupMemoryGame() {
  memoryEls.restart?.addEventListener("click", startMemory);
  startMemory();
}

function startMemory() {
  if (state.items.length < 4) {
    memoryEls.board.innerHTML = `<p class="muted">Dados insuficientes para iniciar o jogo.</p>`;
    setMemoryFeedback("Adicione as vidrarias no JSON.");
    return;
  }

  memory.targetPairs = Math.min(8, state.items.length);
  const sample = sampleUnique(state.items, memory.targetPairs);

  const cards = sample.flatMap((item) => [
    { key: item.id, type: "nome", label: item.nome },
    { key: item.id, type: "funcao", label: shortFunction(item.funcao) }
  ]);

  memory.deck = shuffle(cards).map((c) => ({ ...c, revealed: false }));
  memory.firstIndex = null;
  memory.lock = false;
  memory.matched = new Set();
  memory.moves = 0;

  renderMemory();
  setMemoryFeedback("Encontre os pares corretos.");
}

function renderMemory() {
  if (!memoryEls.board) return;

  memoryEls.board.innerHTML = memory.deck.map((card, i) => {
    const isMatched = memory.matched.has(i);
    const isVisible = card.revealed || isMatched;
    const text = isVisible
      ? `${escapeHtml(card.label)} ${card.type === "funcao" ? "<span class='small'>função</span>" : "<span class='small'>nome</span>"}`
      : "❓";

    return `
      <button
        class="memory-card ${isVisible ? "revealed" : ""} ${isMatched ? "matched" : ""}"
        data-index="${i}"
        type="button"
        ${isMatched ? "disabled" : ""}
        aria-label="Carta ${i + 1}"
      >
        ${text}
      </button>`;
  }).join("");

  memoryEls.board.querySelectorAll(".memory-card").forEach((btn) => {
    btn.addEventListener("click", onMemoryCardClick);
  });

  const matchedPairs = memory.matched.size / 2;
  memoryEls.moves.textContent = String(memory.moves);
  memoryEls.pairs.textContent = `${matchedPairs}/${memory.targetPairs}`;

  if (matchedPairs === memory.targetPairs) {
    setMemoryFeedback(`Boa! Você fechou ${memory.targetPairs} pares em ${memory.moves} jogadas.`);
  }
}

function onMemoryCardClick(e) {
  if (memory.lock) return;

  const idx = Number(e.currentTarget.dataset.index);
  const card = memory.deck[idx];

  if (card.revealed || memory.matched.has(idx)) return;

  card.revealed = true;
  renderMemory();

  if (memory.firstIndex === null) {
    memory.firstIndex = idx;
    return;
  }

  memory.moves += 1;

  const aIdx = memory.firstIndex;
  const a = memory.deck[aIdx];
  const b = card;

  const isPair = a.key === b.key && a.type !== b.type;

  if (isPair) {
    memory.matched.add(aIdx);
    memory.matched.add(idx);
    memory.firstIndex = null;
    setMemoryFeedback("Boa! Par correto.");
    renderMemory();
    return;
  }

  memory.lock = true;
  setMemoryFeedback("Quase! Esse par não combina.");
  memory.firstIndex = null;

  setTimeout(() => {
    memory.deck[aIdx].revealed = false;
    memory.deck[idx].revealed = false;
    memory.lock = false;
    renderMemory();
  }, 700);
}

function setMemoryFeedback(msg) {
  if (memoryEls.feedback) memoryEls.feedback.textContent = msg;
}

function shortFunction(text = "") {
  const cleaned = text.replace(/\.$/, "");
  return cleaned.length <= 62 ? cleaned : `${cleaned.slice(0, 62)}...`;
}

/* ===========================
   JOGO 2 - SPRINT 60s
=========================== */
function setupSprintGame() {
  sprintEls.start?.addEventListener("click", startSprint);
  sprintEls.options?.addEventListener("click", onSprintOptionClick);
  updateSprintHud();
}

function startSprint() {
  if (state.items.length < 4) {
    sprintEls.feedback.textContent = "Dados insuficientes para iniciar o Sprint.";
    return;
  }

  stopSprintTimer();

  sprint.active = true;
  sprint.time = 60;
  sprint.score = 0;
  sprint.current = null;
  sprint.correctDeck = shuffle([...state.items]);

  sprintEls.start.textContent = "Reiniciar Sprint";
  sprintEls.feedback.textContent = "Valendo!";
  updateSprintHud();
  nextSprintQuestion();

  sprint.timerId = window.setInterval(() => {
    sprint.time -= 1;
    updateSprintHud();
    if (sprint.time <= 0) finishSprint();
  }, 1000);
}

function nextSprintQuestion() {
  if (!sprint.active) return;
  if (sprint.correctDeck.length === 0) sprint.correctDeck = shuffle([...state.items]);

  const correct = sprint.correctDeck.pop();
  const distractors = sampleUnique(
    state.items.filter((x) => x.id !== correct.id),
    3
  );
  const options = shuffle([correct, ...distractors]);

  sprint.current = {
    correctId: correct.id,
    correctName: correct.nome,
    clue: correct.funcao,
    options
  };

  sprintEls.question.innerHTML = `
    <strong>Qual vidraria corresponde à função:</strong><br>
    "${escapeHtml(sprint.current.clue)}"
  `;

  sprintEls.options.innerHTML = options.map((op, i) => `
    <button class="option" type="button" data-id="${op.id}">
      ${String.fromCharCode(65 + i)}) ${escapeHtml(op.nome)}
    </button>
  `).join("");
}

function onSprintOptionClick(e) {
  const btn = e.target.closest(".option");
  if (!btn || !sprint.active || !sprint.current) return;

  const chosen = btn.dataset.id;
  const isCorrect = chosen === sprint.current.correctId;

  const all = [...sprintEls.options.querySelectorAll(".option")];
  all.forEach((b) => (b.disabled = true));

  if (isCorrect) {
    sprint.score += 10;
    btn.classList.add("correct");
    sprintEls.feedback.textContent = "Boa! Você acertou.";
  } else {
    sprint.score = Math.max(0, sprint.score - 3);
    btn.classList.add("incorrect");
    const rightBtn = all.find((b) => b.dataset.id === sprint.current.correctId);
    if (rightBtn) rightBtn.classList.add("correct");
    sprintEls.feedback.textContent = `Quase! Resposta certa: ${sprint.current.correctName}.`;
  }

  updateSprintHud();

  setTimeout(() => {
    if (sprint.active) nextSprintQuestion();
  }, 700);
}

function finishSprint() {
  stopSprintTimer();
  sprint.active = false;
  sprintEls.question.textContent = `Tempo esgotado! Pontuação final: ${sprint.score}`;
  sprintEls.feedback.textContent =
    sprint.score >= 70 ? "Excelente retenção." : "Bom treino. Faz mais uma rodada.";
  sprintEls.options.innerHTML = "";
}

function stopSprintTimer() {
  if (sprint.timerId) {
    clearInterval(sprint.timerId);
    sprint.timerId = null;
  }
}

function updateSprintHud() {
  sprintEls.time.textContent = String(sprint.time);
  sprintEls.score.textContent = String(sprint.score);
}

/* ===========================
   JOGO 3 - DESAFIO DA IMAGEM
=========================== */
function setupImageQuizGame() {
  imageEls.start?.addEventListener("click", startImageQuiz);
  imageEls.options?.addEventListener("click", onImageOptionClick);
  imageEls.next?.addEventListener("click", loadImageRound);
  updateImageHud();
}

function startImageQuiz() {
  if (state.items.length < 4) {
    imageEls.feedback.textContent = "Dados insuficientes para iniciar o Desafio da Imagem.";
    return;
  }

  imageQuiz.active = true;
  imageQuiz.round = 0;
  imageQuiz.totalRounds = state.items.length; // 16 rodadas = cobre toda a lista
  imageQuiz.score = 0;
  imageQuiz.current = null;
  imageQuiz.deck = shuffle([...state.items]);

  imageEls.start.textContent = "Reiniciar Desafio";
  imageEls.feedback.textContent = "Valendo!";
  imageEls.next.disabled = true;

  updateImageHud();
  loadImageRound();
}

function loadImageRound() {
  if (!imageQuiz.active) return;

  if (imageQuiz.round >= imageQuiz.totalRounds || imageQuiz.deck.length === 0) {
    finishImageQuiz();
    return;
  }

  const correct = imageQuiz.deck.pop();
  const distractors = sampleUnique(
    state.items.filter((x) => x.id !== correct.id),
    3
  );
  const options = shuffle([correct, ...distractors]);

  imageQuiz.current = {
    correctId: correct.id,
    correctName: correct.nome,
    image: correct.imagem,
    options
  };

  imageQuiz.round += 1;
  updateImageHud();

  imageEls.img.src = imageQuiz.current.image;
  imageEls.img.alt = `Imagem da vidraria: ${imageQuiz.current.correctName}`;
  imageEls.img.onerror = () => {
    imageEls.img.alt = "Imagem não encontrada";
  };

  imageEls.prompt.textContent = "Qual é o nome desta vidraria?";
  imageEls.options.innerHTML = options.map((op, i) => `
    <button class="option" type="button" data-id="${op.id}">
      ${String.fromCharCode(65 + i)}) ${escapeHtml(op.nome)}
    </button>
  `).join("");

  imageEls.feedback.textContent = "";
  imageEls.next.disabled = true;
}

function onImageOptionClick(e) {
  const btn = e.target.closest(".option");
  if (!btn || !imageQuiz.active || !imageQuiz.current) return;
  if (!imageEls.next.disabled) return; // já respondeu rodada

  const chosen = btn.dataset.id;
  const isCorrect = chosen === imageQuiz.current.correctId;

  const all = [...imageEls.options.querySelectorAll(".option")];
  all.forEach((b) => (b.disabled = true));

  if (isCorrect) {
    imageQuiz.score += 10;
    btn.classList.add("correct");
    imageEls.feedback.textContent = "Boa! Você acertou.";
  } else {
    btn.classList.add("incorrect");
    const rightBtn = all.find((b) => b.dataset.id === imageQuiz.current.correctId);
    if (rightBtn) rightBtn.classList.add("correct");
    imageEls.feedback.textContent = `Quase! A resposta correta é ${imageQuiz.current.correctName}.`;
  }

  updateImageHud();
  imageEls.next.disabled = false;
}

function finishImageQuiz() {
  imageQuiz.active = false;
  imageEls.options.innerHTML = "";
  imageEls.next.disabled = true;
  imageEls.prompt.textContent = `Desafio concluído! Pontuação final: ${imageQuiz.score}/${imageQuiz.totalRounds * 10}`;
  imageEls.feedback.textContent =
    imageQuiz.score >= imageQuiz.totalRounds * 7
      ? "Excelente! Memória visual consolidada."
      : "Bom treino! Repita para fixar melhor.";
}

function updateImageHud() {
  imageEls.round.textContent = `${Math.min(imageQuiz.round, imageQuiz.totalRounds)}/${imageQuiz.totalRounds}`;
  imageEls.score.textContent = String(imageQuiz.score);
}

/* ===========================
   Utils
=========================== */
function normalize(text = "") {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function sampleUnique(arr, count) {
  return shuffle([...arr]).slice(0, Math.min(count, arr.length));
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function escapeHtml(text = "") {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
