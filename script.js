// ================== CONFIG ==================
const TIME_LIMIT_SECONDS = 60 * 60; // 60 minutos
const ATTEMPT_KEY = "diag_windows_attempt_used_v1";
const START_KEY = "diag_windows_start_ts_v1";

// Cole aqui a URL do seu Google Apps Script Web App (passo abaixo)
const SHEETS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbzbpqy_jPs93pF8VanfiZ-WDGWqJs-k7MwWjjYWbsEV1JdiJlYnfgXsYGlKB06bdHE/exec";

// Gabarito (múltipla escolha)
const ANSWERS = { q1:"B", q2:"C", q3:"B", q4:"B", q5:"B", q6:"C" };

// Regras simples de nível (somente MC)
// 0-2: Iniciante | 3-4: Intermediário | 5-6: Avançado
function levelFromScore(score){
  if(score <= 2) return "Iniciante";
  if(score <= 4) return "Intermediário";
  return "Avançado";
}

// ================== HELPERS ==================
function $(id){ return document.getElementById(id); }

function formatTime(totalSeconds){
  const m = String(Math.floor(totalSeconds/60)).padStart(2,"0");
  const s = String(totalSeconds%60).padStart(2,"0");
  return `${m}:${s}`;
}

function getRemainingSeconds(){
  const start = Number(localStorage.getItem(START_KEY));
  if(!start) return TIME_LIMIT_SECONDS;
  const elapsed = Math.floor((Date.now() - start) / 1000);
  return Math.max(0, TIME_LIMIT_SECONDS - elapsed);
}

function lockAttempt(){
  localStorage.setItem(ATTEMPT_KEY, "1");
}

function isLocked(){
  return localStorage.getItem(ATTEMPT_KEY) === "1";
}

function setStatus(msg){
  $("status").textContent = msg;
}

// ================== UI FLOW ==================
const lockBox = $("lockBox");
const loginBox = $("loginBox");
const formBox  = $("formBox");
const topBar   = $("topBar");
const startBtn = $("startBtn");
const whoSpan  = $("who");
const timeSpan = $("time");

let timerInterval = null;
let studentName = "";

// Se já usou tentativa: trava tudo
if(isLocked()){
  lockBox.classList.remove("hide");
  loginBox.classList.add("hide");
} else {
  // se já começou antes (recarregou a página), volta direto pro teste
  const existingStart = localStorage.getItem(START_KEY);
  const existingName  = localStorage.getItem("diag_windows_student_v1");
  if(existingStart && existingName){
    studentName = existingName;
    startExam();
  }
}

startBtn.addEventListener("click", () => {
  const name = $("studentName").value.trim();
  if(name.length < 5){
    alert("Digite seu nome completo (mínimo 5 caracteres).");
    return;
  }
  studentName = name;
  localStorage.setItem("diag_windows_student_v1", studentName);
  localStorage.setItem(START_KEY, String(Date.now()));
  startExam();
});

function startExam(){
  loginBox.classList.add("hide");
  formBox.classList.remove("hide");
  topBar.classList.remove("hide");
  whoSpan.textContent = studentName;

  // iniciar timer
  tick();
  timerInterval = setInterval(tick, 1000);
}

function tick(){
  const remain = getRemainingSeconds();
  timeSpan.textContent = formatTime(remain);

  if(remain <= 0){
    clearInterval(timerInterval);
    setStatus("⛔ Tempo esgotado. O envio foi bloqueado.");
    $("sendBtn").disabled = true;
    // trava tentativa ao estourar o tempo
    lockAttempt();
  }
}

// ================== SUBMIT ==================
$("quizForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  // bloqueia envio se tempo acabou
  if(getRemainingSeconds() <= 0){
    setStatus("⛔ Tempo esgotado. Não é possível enviar.");
    $("sendBtn").disabled = true;
    lockAttempt();
    return;
  }

  if(SHEETS_WEBAPP_URL.includes("COLE_AQUI")){
    alert("Você ainda não colou a URL do Web App do Google Sheets no script.js");
    return;
  }

  $("sendBtn").disabled = true;
  setStatus("Enviando...");

  const fd = new FormData(e.target);
  const payload = {
    studentName,
    startedAt: Number(localStorage.getItem(START_KEY)),
    submittedAt: Date.now(),
    remainingSeconds: getRemainingSeconds(),
    answers: {},
    scoreMC: 0,
    levelMC: ""
  };

  // coletar respostas
  for(const [k,v] of fd.entries()){
    payload.answers[k] = v;
  }

  // corrigir MC
  let score = 0;
  Object.keys(ANSWERS).forEach(q => {
    if(payload.answers[q] === ANSWERS[q]) score++;
  });
  payload.scoreMC = score;
  payload.levelMC = levelFromScore(score);

  // enviar para Sheets
  try{
    const res = await fetch(SHEETS_WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });

    const text = await res.text();
    if(!res.ok) throw new Error(text);

    // trava tentativa
    lockAttempt();

    setStatus(`✅ Enviado com sucesso! Pontuação (MC): ${score}/6 • Nível: ${payload.levelMC}`);
  } catch(err){
    console.error(err);
    $("sendBtn").disabled = false;
    setStatus("❌ Erro ao enviar. Verifique a URL do Web App e se ele está publicado como 'Qualquer pessoa'.");
  }
});
// ================== MODO PROFESSOR (OPÇÃO 2) ==================
// Troque a senha abaixo por uma sua (não use "1234").
const TEACHER_PASSWORD = "aluno Mickael";

// Botão do professor
const teacherBtn = document.getElementById("teacherBtn");
if (teacherBtn) {
  teacherBtn.addEventListener("click", () => {
    const pass = prompt("Senha do professor para liberar nova tentativa:");
    if (pass !== TEACHER_PASSWORD) {
      alert("Senha incorreta.");
      return;
    }

    // Limpa as chaves que travam a tentativa
    localStorage.removeItem(ATTEMPT_KEY);
    localStorage.removeItem(START_KEY);
    localStorage.removeItem("diag_windows_student_v1");

    alert("✅ Nova tentativa liberada neste dispositivo. Recarregando...");
    location.reload();
  });
}
