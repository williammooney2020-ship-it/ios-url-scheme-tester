// iOS URL Scheme & Universal Link Tester — browser-only.
// Validates URL scheme syntax, generates deep link test URLs, and
// creates an HTML test harness that opens links via iframe / window.open.

const SYSTEM_SCHEMES = [
  { scheme: "tel", example: "tel:+15551234567", desc: "Phone call" },
  { scheme: "mailto", example: "mailto:user@example.com?subject=Hello", desc: "Email compose" },
  { scheme: "sms", example: "sms:+15551234567", desc: "SMS compose" },
  { scheme: "facetime", example: "facetime:user@example.com", desc: "FaceTime audio" },
  { scheme: "facetime-audio", example: "facetime-audio:+15551234567", desc: "FaceTime audio by phone" },
  { scheme: "maps", example: "maps://?q=Apple+Park", desc: "Apple Maps search" },
  { scheme: "music", example: "music://", desc: "Apple Music" },
  { scheme: "itms-apps", example: "itms-apps://itunes.apple.com/app/id6782671358", desc: "App Store listing" },
  { scheme: "photos-redirect", example: "photos-redirect://", desc: "Photos app" },
  { scheme: "apple-shortcuts", example: "apple-shortcuts://", desc: "Shortcuts app" },
  { scheme: "prefs", example: "prefs:root=General", desc: "System Settings (iOS 17+)" },
  { scheme: "message", example: "message://", desc: "Messages" },
  { scheme: "x-web-search", example: "x-web-search://?q=hello", desc: "Safari web search" },
];

const UNIVERSAL_DOMAINS = [
  { pattern: "apple.com/app/", example: "https://apps.apple.com/app/id6782671358", desc: "App Store" },
  { pattern: "yourdomain.com/path/", example: "https://example.com/items/42", desc: "Custom domain (replace with yours)" },
];

const STORAGE_KEY = "url_scheme_tester_v1";

let state = {
  customScheme: "",
  customHost: "",
  queryParams: [],
  universalLink: "",
  history: [],
  activeTab: "custom",
};

function save() {
  state.customScheme = gv("schemeInput");
  state.customHost = gv("hostInput");
  state.universalLink = gv("universalLinkInput");
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = { ...state, ...JSON.parse(raw) };
  } catch (e) {}
}

function gv(id) { const el = document.getElementById(id); return el ? el.value : ""; }
function sv(id, val) { const el = document.getElementById(id); if (el) el.value = val; }

// ── Query params ──────────────────────────────────────────────────────────────

function addParam() {
  state.customScheme = gv("schemeInput");
  state.customHost = gv("hostInput");
  state.queryParams.push({ key: "", value: "" });
  renderParams();
  renderCustomPreview();
}

function removeParam(i) {
  state.queryParams.splice(i, 1);
  renderParams();
  renderCustomPreview();
}

function updateParam(i, field, value) {
  state.queryParams[i][field] = value;
  renderCustomPreview();
  save();
}

function renderParams() {
  const el = document.getElementById("paramsContainer");
  if (state.queryParams.length === 0) {
    el.innerHTML = `<div style="color:var(--muted);font-size:13px;padding:4px 0">No query parameters. Click "+ Add Parameter" to add one.</div>`;
    return;
  }
  el.innerHTML = state.queryParams.map((p, i) => `
    <div class="param-row">
      <input type="text" placeholder="key" value="${esc(p.key)}" oninput="updateParam(${i},'key',this.value)" />
      <span style="color:var(--muted);font-size:13px;flex:none">=</span>
      <input type="text" placeholder="value" value="${esc(p.value)}" oninput="updateParam(${i},'value',this.value)" />
      <button class="remove-param-btn" onclick="removeParam(${i})">✕</button>
    </div>`).join("");
}

// ── URL building ──────────────────────────────────────────────────────────────

function buildCustomURL() {
  let scheme = gv("schemeInput").trim().replace(/:\/\/$/, "").replace(/:$/, "");
  const host = gv("hostInput").trim().replace(/^\/+/, "");

  if (!scheme) return "";

  let url = `${scheme}://`;
  if (host) url += host;

  const params = state.queryParams.filter(p => p.key.trim());
  if (params.length > 0) {
    const qs = params.map(p => `${encodeURIComponent(p.key.trim())}=${encodeURIComponent(p.value)}`).join("&");
    url += (host.includes("?") ? "&" : "?") + qs;
  }

  return url;
}

function renderCustomPreview() {
  const url = buildCustomURL();
  const el = document.getElementById("customPreview");
  el.textContent = url || "(enter a scheme above)";

  // Validate
  const validEl = document.getElementById("schemeValid");
  const scheme = gv("schemeInput").trim().replace(/:\/\/$/, "").replace(/:$/, "");
  if (!scheme) {
    validEl.textContent = "";
    validEl.className = "";
    return;
  }
  const valid = /^[a-z][a-z0-9+\-.]*$/.test(scheme);
  validEl.textContent = valid ? "✓ Valid scheme format" : "⚠ Scheme must start with a letter and contain only letters, digits, +, -, or .";
  validEl.className = valid ? "valid-msg" : "invalid-msg";
}

function openCustomURL() {
  const url = buildCustomURL();
  if (!url) return;
  addToHistory(url);
  window.open(url, "_blank");
}

function openURL(url) {
  addToHistory(url);
  window.open(url, "_blank");
}

function openUniversalLink() {
  const url = gv("universalLinkInput").trim();
  if (!url) return;
  addToHistory(url);
  window.open(url, "_blank");
}

// ── History ───────────────────────────────────────────────────────────────────

function addToHistory(url) {
  state.history.unshift({ url, ts: Date.now() });
  if (state.history.length > 20) state.history.pop();
  save();
  renderHistory();
}

function clearHistory() {
  state.history = [];
  save();
  renderHistory();
}

function renderHistory() {
  const el = document.getElementById("historyList");
  if (state.history.length === 0) {
    el.innerHTML = `<div style="color:var(--muted);font-size:13px;padding:8px 0">No links tested yet.</div>`;
    return;
  }
  el.innerHTML = state.history.map(h => {
    const dt = new Date(h.ts).toLocaleTimeString();
    return `
    <div class="history-row">
      <div class="history-url">${esc(h.url)}</div>
      <div class="history-meta">${dt}</div>
      <button class="history-copy" onclick="copyText('${esc(h.url)}', this)">Copy</button>
      <button class="history-open" onclick="openURL('${esc(h.url)}')">Open</button>
    </div>`;
  }).join("");
}

// ── Validation tab ────────────────────────────────────────────────────────────

function validateAASA() {
  const raw = document.getElementById("aasaInput").value.trim();
  const out = document.getElementById("aasaOutput");

  if (!raw) { out.textContent = "Paste your apple-app-site-association JSON above."; return; }

  let json;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    out.textContent = "❌ Invalid JSON: " + e.message;
    out.className = "aasa-output error";
    return;
  }

  const issues = [];
  const notes = [];

  if (!json.applinks) {
    issues.push("Missing required 'applinks' key.");
  } else {
    if (!json.applinks.apps && !json.applinks.details) {
      issues.push("applinks is empty — add 'details' array.");
    }
    const details = json.applinks.details;
    if (Array.isArray(details)) {
      details.forEach((d, i) => {
        if (!d.appID && !d.appIDs) issues.push(`details[${i}]: missing 'appID' or 'appIDs'.`);
        if (!d.paths && !d.components) issues.push(`details[${i}]: missing 'paths' or 'components'.`);
        if (d.paths && d.components) notes.push(`details[${i}]: has both 'paths' and 'components'. Prefer 'components' (iOS 13+).`);
        if (d.appID && typeof d.appID === "string") {
          if (!d.appID.includes(".")) issues.push(`details[${i}]: appID "${d.appID}" should be TEAMID.BUNDLEID format.`);
        }
      });
    }
  }

  if (json.webcredentials) {
    notes.push("Contains 'webcredentials' for Shared Web Credentials.");
  }
  if (json.activitycontinuation) {
    notes.push("Contains 'activitycontinuation' for Handoff.");
  }

  if (issues.length === 0) {
    out.textContent = "✅ AASA structure looks valid.\n\n" +
      (notes.length ? "Notes:\n" + notes.map(n => "• " + n).join("\n") : "No issues found.");
    out.className = "aasa-output ok";
  } else {
    out.textContent = "⚠ Issues found:\n" + issues.map(i => "• " + i).join("\n") +
      (notes.length ? "\n\nNotes:\n" + notes.map(n => "• " + n).join("\n") : "");
    out.className = "aasa-output warn";
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function copyText(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    if (btn) { const orig = btn.textContent; btn.textContent = "Copied!"; setTimeout(() => { btn.textContent = orig; }, 1400); }
  });
}

function copyPreview(btnId) {
  const url = buildCustomURL();
  if (url) copyText(url, document.getElementById(btnId));
}

function copyUniversal() {
  const url = gv("universalLinkInput").trim();
  if (url) copyText(url, document.getElementById("copyUniversalBtn"));
}

function switchTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll(".tab-btn").forEach(el => el.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(el => el.style.display = "none");
  document.getElementById("tab_" + tab).classList.add("active");
  document.getElementById("content_" + tab).style.display = "block";
  save();
}

function esc(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  load();

  sv("schemeInput", state.customScheme);
  sv("hostInput", state.customHost);
  sv("universalLinkInput", state.universalLink);

  renderParams();
  renderCustomPreview();
  renderHistory();
  switchTab(state.activeTab || "custom");

  // Wire inputs to live preview
  document.getElementById("schemeInput").addEventListener("input", () => { renderCustomPreview(); save(); });
  document.getElementById("hostInput").addEventListener("input", () => { renderCustomPreview(); save(); });
  document.getElementById("universalLinkInput").addEventListener("input", save);

  // Render system schemes table
  const tbl = document.getElementById("systemSchemesTable");
  tbl.innerHTML = SYSTEM_SCHEMES.map(s => `
    <tr>
      <td><code>${esc(s.scheme)}://</code></td>
      <td style="color:var(--muted);font-size:13px">${s.desc}</td>
      <td><code style="color:var(--accent);font-size:11px;word-break:break-all">${esc(s.example)}</code></td>
      <td>
        <button class="tbl-btn" onclick="copyText('${esc(s.example)}', this)">Copy</button>
        <button class="tbl-btn open" onclick="openURL('${esc(s.example)}')">Open</button>
      </td>
    </tr>`).join("");
});
