const state = {
  settings: null,
  recognition: null,
  listening: false,
};

const els = {
  healthStatus: document.querySelector("#healthStatus"),
  keyBadge: document.querySelector("#keyBadge"),
  geminiApiKey: document.querySelector("#geminiApiKey"),
  model: document.querySelector("#model"),
  userName: document.querySelector("#userName"),
  temperature: document.querySelector("#temperature"),
  voiceRate: document.querySelector("#voiceRate"),
  voiceEnabled: document.querySelector("#voiceEnabled"),
  allowDestructive: document.querySelector("#allowDestructive"),
  allowTerminal: document.querySelector("#allowTerminal"),
  toggleKey: document.querySelector("#toggleKey"),
  saveSettings: document.querySelector("#saveSettings"),
  messages: document.querySelector("#messages"),
  sessionStatus: document.querySelector("#sessionStatus"),
  chatForm: document.querySelector("#chatForm"),
  messageInput: document.querySelector("#messageInput"),
  sendButton: document.querySelector("#sendButton"),
  micButton: document.querySelector("#micButton"),
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || data.error || "Falha na requisição");
  }
  return data;
}

async function loadSettings() {
  const [health, settings] = await Promise.all([api("/api/health"), api("/api/settings")]);
  state.settings = settings;
  els.healthStatus.textContent = health.ok ? "Online" : "Indisponível";
  els.model.value = settings.model || "gemini-2.5-flash";
  els.userName.value = settings.user_name || "Chefe";
  els.temperature.value = settings.temperature ?? 0.6;
  els.voiceRate.value = settings.voice_rate ?? 1.0;
  els.voiceEnabled.checked = settings.voice_enabled !== false;
  els.allowDestructive.checked = settings.allow_destructive_tools === true;
  els.allowTerminal.checked = settings.allow_terminal === true;
  renderKeyBadge(settings.gemini_api_key_set);
}

function renderKeyBadge(hasKey) {
  els.keyBadge.textContent = hasKey ? "Gemini salvo" : "Gemini pendente";
  els.keyBadge.classList.toggle("ready", Boolean(hasKey));
}

async function saveSettings() {
  els.saveSettings.disabled = true;
  try {
    const payload = {
      gemini_api_key: els.geminiApiKey.value.trim(),
      model: els.model.value.trim(),
      user_name: els.userName.value.trim(),
      temperature: Number(els.temperature.value || 0.6),
      voice_rate: Number(els.voiceRate.value || 1.0),
      voice_enabled: els.voiceEnabled.checked,
      allow_destructive_tools: els.allowDestructive.checked,
      allow_terminal: els.allowTerminal.checked,
    };
    const settings = await api("/api/settings", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    state.settings = settings;
    els.geminiApiKey.value = "";
    renderKeyBadge(settings.gemini_api_key_set);
    addMessage("assistant", "Configuração salva.");
  } catch (error) {
    addMessage("error", error.message);
  } finally {
    els.saveSettings.disabled = false;
  }
}

function addMessage(role, content) {
  const node = document.createElement("div");
  node.className = `message ${role}`;
  node.textContent = content;
  els.messages.appendChild(node);
  els.messages.scrollTop = els.messages.scrollHeight;
}

async function sendMessage(message) {
  const text = message.trim();
  if (!text) return;

  addMessage("user", text);
  els.messageInput.value = "";
  els.sendButton.disabled = true;
  els.sessionStatus.textContent = "Pensando";
  els.sessionStatus.classList.remove("ready");

  try {
    const data = await api("/api/chat", {
      method: "POST",
      body: JSON.stringify({ message: text }),
    });
    addMessage("assistant", data.reply);
    speak(data.reply);
    els.sessionStatus.textContent = "Pronto";
    els.sessionStatus.classList.add("ready");
  } catch (error) {
    addMessage("error", error.message);
    els.sessionStatus.textContent = "Erro";
  } finally {
    els.sendButton.disabled = false;
    els.messageInput.focus();
  }
}

function speak(text) {
  if (!els.voiceEnabled.checked || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text.replace(/\nResultado:.*/s, ""));
  utterance.lang = "pt-BR";
  utterance.rate = Number(els.voiceRate.value || 1);
  window.speechSynthesis.speak(utterance);
}

function setupSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    els.micButton.disabled = true;
    els.micButton.title = "Reconhecimento de voz indisponível";
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "pt-BR";
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    state.listening = true;
    els.micButton.classList.add("listening");
    els.sessionStatus.textContent = "Ouvindo";
  };
  recognition.onend = () => {
    state.listening = false;
    els.micButton.classList.remove("listening");
    if (els.sessionStatus.textContent === "Ouvindo") els.sessionStatus.textContent = "Pronto";
  };
  recognition.onerror = (event) => {
    addMessage("error", `Microfone: ${event.error}`);
  };
  recognition.onresult = (event) => {
    const transcript = event.results?.[0]?.[0]?.transcript || "";
    els.messageInput.value = transcript;
    sendMessage(transcript);
  };

  state.recognition = recognition;
}

els.chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  sendMessage(els.messageInput.value);
});

els.saveSettings.addEventListener("click", saveSettings);

els.toggleKey.addEventListener("click", () => {
  const visible = els.geminiApiKey.type === "text";
  els.geminiApiKey.type = visible ? "password" : "text";
  els.toggleKey.textContent = visible ? "Mostrar" : "Ocultar";
});

els.micButton.addEventListener("click", () => {
  if (!state.recognition) return;
  if (state.listening) {
    state.recognition.stop();
  } else {
    state.recognition.start();
  }
});

loadSettings()
  .then(() => {
    setupSpeechRecognition();
    addMessage("assistant", "Jarvis Zero online.");
  })
  .catch((error) => {
    els.healthStatus.textContent = "Erro";
    addMessage("error", error.message);
  });
