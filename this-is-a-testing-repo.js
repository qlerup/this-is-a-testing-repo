/* Goal Counter Card
 * - Simple local counter per goal id (persisted via backend integration `goal_counter`)
 * - Configurable goals in the card editor
 */

const DOMAIN = "goal_counter";
const CARD_VERSION = "0.1.0";

const CHECKLIST_PREFIX = "checklist:";

function safeText(v) {
  return (v ?? "").toString();
}

function clampInt(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.trunc(n);
}

function clampFloat(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return n;
}

function _pad2(n) {
  const v = Number(n);
  return v < 10 ? `0${v}` : `${v}`;
}

function formatLocalDate(d) {
  if (!(d instanceof Date) || !Number.isFinite(d.getTime())) return "";
  return `${_pad2(d.getDate())}-${_pad2(d.getMonth() + 1)}-${d.getFullYear()}`;
}

function slugify(s) {
  const raw = safeText(s).trim().toLowerCase();
  if (!raw) return "goal";
  return raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64) || "goal";
}

function checklistKey(itemId) {
  return `${CHECKLIST_PREFIX}${safeText(itemId).trim()}`;
}

function makeUniqueId(baseId, usedIds) {
  const base = safeText(baseId).trim() || "item";
  if (!usedIds || typeof usedIds.has !== "function") return base;
  if (!usedIds.has(base)) return base;
  for (let i = 2; i <= 99; i++) {
    const candidate = `${base}_${i}`;
    if (!usedIds.has(candidate)) return candidate;
  }
  return `${base}_${Date.now()}`;
}

function stripOuterQuotes(s) {
  const v = safeText(s).trim();
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) return v.slice(1, -1).trim();
  return v;
}

function parseFirstColumnFromDelimitedText(text) {
  const raw = safeText(text);
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];

  const sample = lines.slice(0, 20).join("\n");
  let delim = ",";
  if (sample.includes("\t")) delim = "\t";
  else {
    const semi = (sample.match(/;/g) || []).length;
    const comma = (sample.match(/,/g) || []).length;
    delim = semi > comma ? ";" : ",";
  }

  const values = [];
  for (const line of lines) {
    const first = line.split(delim)[0];
    const v = stripOuterQuotes(first);
    if (v) values.push(v);
  }

  // Skip common header labels
  const header = (values[0] || "").toLowerCase();
  if (["butik", "store", "navn", "name", "checkliste", "checklist"].includes(header) && values.length > 1) {
    values.shift();
  }
  return values;
}

async function callWS(hass, msg) {
  if (!hass) throw new Error("No hass");
  if (typeof hass.callWS === "function") return await hass.callWS(msg);
  const conn = hass.connection;
  if (conn && typeof conn.sendMessagePromise === "function") return await conn.sendMessagePromise(msg);
  throw new Error("No websocket connection");
}

function normalizeGoals(rawGoals) {
  const src = Array.isArray(rawGoals) ? rawGoals : [];
  const out = [];
  for (const g of src) {
    if (!g || typeof g !== "object") continue;
    const name = safeText(g.name || g.title || g.id).trim();
    const target = clampInt(g.target);
    const avgPerDay = clampFloat(g.avg_per_day ?? g.avgPerDay ?? g.per_day ?? g.perDay);
    if (!name) continue;
    const id = safeText(g.id).trim() || slugify(name);
    out.push({ id, name, target, avg_per_day: avgPerDay });
  }
  // stable unique by id
  const seen = new Set();
  const uniq = [];
  for (const g of out) {
    if (seen.has(g.id)) continue;
    seen.add(g.id);
    uniq.push(g);
  }
  return uniq;
}

function normalizeChecklist(rawItems) {
  const src = Array.isArray(rawItems) ? rawItems : [];
  const out = [];
  for (const it of src) {
    if (!it || typeof it !== "object") continue;
    const label = safeText(it.label || it.name || it.title || it.id).trim();
    if (!label) continue;
    const id = safeText(it.id).trim() || slugify(label);
    out.push({ id, label });
  }
  // stable unique by id
  const seen = new Set();
  const uniq = [];
  for (const it of out) {
    if (seen.has(it.id)) continue;
    seen.add(it.id);
    uniq.push(it);
  }
  return uniq;
}

class GoalCounterCard extends HTMLElement {
  static getStubConfig() {
    return {
      type: "custom:goal-counter-card",
      title: "Goals",
      goals: [{ name: "Mit mål", target: 100, avg_per_day: 1 }],
      checklist: [{ label: "Et punkt jeg kan krydse af" }],
    };
  }

  static getConfigElement() {
    return document.createElement("goal-counter-card-editor");
  }

  setConfig(config) {
    if (!config) throw new Error("Invalid config");
    this._config = config;
    this._goals = normalizeGoals(config.goals);
    this._checklist = normalizeChecklist(config.checklist);
    this._counts = this._counts || {};
    this._checks = this._checks || {};
    this._loadedKey = null;
    if (this._root) this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._root) this._initRoot();
    if (this._connected) this._ensureLoaded();
  }

  connectedCallback() {
    this._connected = true;
    if (!this._root) this._initRoot();
    this._ensureLoaded();
  }

  disconnectedCallback() {
    this._connected = false;
  }

  _initRoot() {
    this._root = this.attachShadow({ mode: "open" });
    this._render();
  }

  _configSignature() {
    const title = safeText(this._config?.title);
    const goals = normalizeGoals(this._config?.goals);
    const checklist = normalizeChecklist(this._config?.checklist);
    return JSON.stringify({ title, goals, checklist });
  }

  async _ensureLoaded() {
    const sig = this._configSignature();
    if (this._loadedKey === sig) {
      return;
    }
    this._loadedKey = sig;

    this._goals = normalizeGoals(this._config?.goals);
    this._checklist = normalizeChecklist(this._config?.checklist);
    this._counts = this._counts || {};
    this._checks = this._checks || {};
    this._loading = true;
    this._error = null;
    this._render();

    try {
      const hass = this._hass;
      const goals = this._goals;
      const checklist = this._checklist;
      const promises = goals.map(async (g) => {
        const res = await callWS(hass, { type: `${DOMAIN}/get`, key: g.id });
        this._counts[g.id] = clampInt(res?.value);
      });
      const checklistPromises = checklist.map(async (it) => {
        const res = await callWS(hass, { type: `${DOMAIN}/get`, key: checklistKey(it.id) });
        this._checks[it.id] = clampInt(res?.value) > 0;
      });
      promises.push(...checklistPromises);
      await Promise.all(promises);
    } catch (e) {
      this._error = safeText(e?.message || e);
    } finally {
      this._loading = false;
      this._render();
    }
  }

  _queueGoalDelta(goalId, delta) {
    const id = safeText(goalId).trim();
    const d = clampInt(delta);
    if (!id || d === 0) return;

    // Apply instantly in UI
    this._counts = this._counts || {};
    this._counts[id] = clampInt(this._counts[id]) + d;
    this._error = null;
    this._render();

    // Debounced backend flush
    this._goalFlush = this._goalFlush || {};
    const s = this._goalFlush[id] || { pending: 0, timer: null, inFlight: false };
    s.pending = clampInt(s.pending) + d;
    if (s.timer) clearTimeout(s.timer);
    s.timer = setTimeout(() => this._flushGoalDelta(id), 1000);
    this._goalFlush[id] = s;
  }

  async _flushGoalDelta(goalId) {
    const id = safeText(goalId).trim();
    if (!id) return;
    const s = this._goalFlush?.[id];
    if (!s) return;
    if (s.inFlight) return;

    const delta = clampInt(s.pending);
    if (delta === 0) return;

    s.inFlight = true;
    s.pending = 0;
    this._goalFlush[id] = s;

    try {
      const res = await callWS(this._hass, { type: `${DOMAIN}/set`, key: id, delta });
      this._counts[id] = clampInt(res?.value);
      this._error = null;
    } catch (e) {
      // Keep UI optimistic; show error.
      this._error = safeText(e?.message || e);
    } finally {
      s.inFlight = false;
      this._goalFlush[id] = s;
      this._render();
    }
  }

  async _applyChecklistSet(itemId, checked) {
    try {
      const cur = this._checks?.[itemId] ? 1 : 0;
      const next = checked ? 1 : 0;
      const delta = next - cur;
      if (delta === 0) return;

      this._busy = true;
      this._error = null;
      this._render();

      const res = await callWS(this._hass, {
        type: `${DOMAIN}/set`,
        key: checklistKey(itemId),
        delta: clampInt(delta),
      });
      this._checks[itemId] = clampInt(res?.value) > 0;
    } catch (e) {
      this._error = safeText(e?.message || e);
    } finally {
      this._busy = false;
      this._render();
    }
  }

  _applyChecklistFilter() {
    if (!this._root) return;
    const q = safeText(this._checkFilter || "")
      .trim()
      .toLowerCase();

    const rows = this._root.querySelectorAll(".chk");
    for (const row of rows) {
      const txt = safeText(row.querySelector(".chktext")?.textContent || "").toLowerCase();
      row.style.display = !q || txt.includes(q) ? "" : "none";
    }
  }

  _render() {
    const title = safeText(this._config?.title || "").trim();
    const goals = this._goals || [];
    const checklist = this._checklist || [];
    const counts = this._counts || {};
    const checks = this._checks || {};

    const css = `
      :host{ display:block; }
      .card{ padding: 12px 16px 14px; }
      .title{ font-size: 16px; font-weight: 600; margin: 0 0 10px; }
      .muted{ color: var(--secondary-text-color); font-size: 12px; }
      .err{ color: var(--error-color); font-size: 12px; margin-top: 8px; }

      .sectionRow{ display:flex; justify-content: space-between; align-items: baseline; margin-top: 12px; gap: 12px; }
      .sectionTitle{ font-size: 12px; color: var(--secondary-text-color); font-weight: 600; }
      .sectionNums{ display:flex; gap: 10px; justify-content: flex-end; align-items: center; flex-wrap: wrap; font-size: 12px; color: var(--secondary-text-color); }
      .sectionNums b{ color: var(--primary-text-color); font-weight: 700; }

      .panel{ border: 1px solid var(--divider-color); border-radius: 12px; padding: 10px 12px; margin-top: 12px; }
      .panel:first-of-type{ margin-top: 8px; }
      .panel .sectionRow{ margin-top: 0; }

      .goal{ display: grid; grid-template-columns: 1fr auto; gap: 8px 12px; padding: 10px 0; border-top: 1px solid var(--divider-color); }
      .goal:first-of-type{ border-top: 0; }

      .name{ font-weight: 600; }
      .nums{ display:flex; gap: 10px; justify-content: flex-end; align-items: center; flex-wrap: wrap; font-size: 12px; color: var(--secondary-text-color); }
      .nums b{ color: var(--primary-text-color); font-weight: 700; }
      .nums span{ white-space: nowrap; }

      .controls{ grid-column: 1 / -1; display:flex; gap: 8px; flex-wrap: wrap; align-items: center; }
      button{ height: 34px; min-width: 54px; padding: 0 10px; border-radius: 10px; border: 1px solid var(--divider-color); background: var(--card-background-color); color: var(--primary-text-color); cursor: pointer; }
      button:disabled{ opacity: .6; cursor: not-allowed; }
      .mid{ min-width: 74px; text-align: center; font-weight: 700; }

      .chk{ padding: 10px 0; border-top: 1px solid var(--divider-color); }
      .chk:first-of-type{ border-top: 0; }
      .chklabel{ display:flex; align-items:center; gap: 10px; cursor: pointer; user-select: none; }
      .chklabel input{ width: 18px; height: 18px; accent-color: var(--primary-color); }
      .chklabel input:disabled{ opacity: .6; cursor: not-allowed; }
      .chktext{ font-weight: 600; }

      .searchWrap{ margin-top: 10px; }
      .search{ width: 100%; height: 34px; box-sizing:border-box; padding: 6px 10px; border-radius: 10px; border: 1px solid var(--divider-color); background: var(--card-background-color); color: var(--primary-text-color); }

      @media (max-width: 520px){
        .card{ padding: 12px 14px 14px; }
        .goal{ grid-template-columns: 1fr; }
        .nums{ justify-content: flex-start; }
        button{ min-width: 48px; }
        .mid{ min-width: 56px; }
      }
    `;

    const header = title ? `<div class="title">${title}</div>` : "";

    const emptyGoals = !goals.length ? `<div class="muted">Tilføj mindst ét goal i editoren.</div>` : "";
    const emptyChecklist = !checklist.length ? `<div class="muted">Tilføj punkter i editoren.</div>` : "";

    const rows = goals
      .map((g) => {
        const cur = clampInt(counts[g.id]);
        const target = clampInt(g.target);
        const missing = Math.max(0, target - cur);
        const avg = clampFloat(g.avg_per_day);
        const daysLeft = avg > 0 ? Math.ceil(missing / avg) : null;
        const etaDate =
          daysLeft == null
            ? ""
            : (() => {
                const d = new Date();
                d.setHours(0, 0, 0, 0);
                d.setDate(d.getDate() + Math.max(0, daysLeft));
                return formatLocalDate(d);
              })();
        const disabled = this._loading;

        return `
          <div class="goal">
            <div class="name">${safeText(g.name)}</div>
            <div class="nums">
              <span>Mål: <b>${target}</b></span>
              <span>Manglende: <b>${missing}</b></span>
              <span>Dage: <b>${daysLeft == null ? "-" : daysLeft}</b></span>
              <span>Dato: <b>${daysLeft == null ? "-" : etaDate}</b></span>
            </div>

            <div class="controls">
              <button data-id="${g.id}" data-delta="-1" ${disabled ? "disabled" : ""}>-</button>
              <div class="mid">${cur}</div>
              <button data-id="${g.id}" data-delta="1" ${disabled ? "disabled" : ""}>+</button>
              <button data-id="${g.id}" data-delta="9" ${disabled ? "disabled" : ""}>+9</button>
              <button data-id="${g.id}" data-delta="18" ${disabled ? "disabled" : ""}>+18</button>
            </div>
          </div>
        `;
      })
      .join("");

    const checklistRows = checklist
      .map((it) => {
        const disabled = this._busy || this._loading;
        const checked = !!checks[it.id];
        return `
          <div class="chk">
            <label class="chklabel">
              <input type="checkbox" data-check-id="${it.id}" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""} />
              <span class="chktext">${safeText(it.label)}</span>
            </label>
          </div>
        `;
      })
      .join("");

    const checklistSearch = checklist.length
      ? `
        <div class="searchWrap">
          <input id="check_filter" class="search" type="search" placeholder="Søg i checklisten…" value="${safeText(this._checkFilter || "")}" />
        </div>
      `
      : "";

    const status = this._loading ? `<div class="muted">Indlæser…</div>` : "";
    const err = this._error ? `<div class="err">${safeText(this._error)}</div>` : "";

    const goalsHeader = `
      <div class="sectionRow">
        <div class="sectionTitle">Goals</div>
      </div>
    `;

    const totalItems = checklist.length;
    const doneItems = checklist.reduce((acc, it) => acc + (checks[it.id] ? 1 : 0), 0);
    const remainingItems = Math.max(0, totalItems - doneItems);

    const totalGoalCount = goals.reduce((acc, g) => acc + clampInt(counts[g.id]), 0);
    // Each checked checklist item represents one delivered 60-set.
    const deliveredCount = doneItems * 60;
    const adjustedGoalCount = Math.max(0, totalGoalCount - deliveredCount);
    const full60Sets = Math.floor(adjustedGoalCount / 60);
    const checklistHeader = `
      <div class="sectionRow">
        <div class="sectionTitle">Checkliste</div>
        <div class="sectionNums">
          <span>Antal lavet i alt: <b>${totalGoalCount}</b></span>
          <span>Antal tilbage: <b>${adjustedGoalCount}</b></span>
          <span>Sæt klar til levering: <b>${full60Sets}</b></span>
          <span>Fuldført: <b>${doneItems}/${totalItems}</b></span>
          <span>Mangler: <b>${remainingItems}</b></span>
        </div>
      </div>
    `;

    this._root.innerHTML = `
      <ha-card>
        <style>${css}</style>
        <div class="card">
          ${header}
          ${status}
          <div class="panel">
            ${goalsHeader}
            ${emptyGoals}
            ${rows}
          </div>

          <div class="panel">
            ${checklistHeader}
            ${checklistSearch}
            ${emptyChecklist}
            ${checklistRows}
          </div>
          ${err}
        </div>
      </ha-card>
    `;

    const btns = this._root.querySelectorAll("button[data-id][data-delta]");
    for (const b of btns) {
      b.onclick = (e) => {
        const el = e.currentTarget;
        const id = el.getAttribute("data-id") || "";
        const delta = clampInt(el.getAttribute("data-delta"));
        this._queueGoalDelta(id, delta);
      };
    }

    const chkInputs = this._root.querySelectorAll("input[type=checkbox][data-check-id]");
    for (const c of chkInputs) {
      c.onchange = (e) => {
        const el = e.currentTarget;
        const id = el.getAttribute("data-check-id") || "";
        const checked = !!el.checked;
        this._applyChecklistSet(id, checked);
      };
    }

    const filterEl = this._root.querySelector("#check_filter");
    if (filterEl) {
      // Avoid re-rendering on each keystroke; just hide/show rows.
      filterEl.oninput = (e) => {
        this._checkFilter = e.target.value;
        this._applyChecklistFilter();
      };
      this._applyChecklistFilter();
    }
  }
}

customElements.define("goal-counter-card", GoalCounterCard);

class GoalCounterCardEditor extends HTMLElement {
  setConfig(config) {
    const next = config || {};
    const nextSig = JSON.stringify(next);
    if (this._lastConfigSig === nextSig && this._root) {
      // Avoid re-render loops that steal focus.
      this._config = next;
      this._goals = normalizeGoals(this._config.goals);
      this._checklist = normalizeChecklist(this._config.checklist);
      return;
    }
    this._lastConfigSig = nextSig;
    this._config = next;
    this._goals = normalizeGoals(this._config.goals);
    this._checklist = normalizeChecklist(this._config.checklist);
    if (!this._root) this._initRoot();
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    // Don't re-render on hass updates; HA calls this frequently in the UI editor
    // and it will steal focus/selection from text inputs.
  }

  _initRoot() {
    this._root = this.attachShadow({ mode: "open" });
  }

  _emitChange() {
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: this._config },
        bubbles: true,
        composed: true,
      })
    );
  }

  _setTitle(v, emit = false, rerender = false) {
    this._config = { ...this._config, title: safeText(v) };
    if (emit) this._emitChange();
    if (rerender) this._render();
  }

  _setGoals(goals, emit = false, rerender = false) {
    this._config = {
      ...this._config,
      goals: goals.map((g) => ({ id: g.id, name: g.name, target: g.target, avg_per_day: g.avg_per_day })),
    };
    this._goals = normalizeGoals(this._config.goals);
    if (emit) this._emitChange();
    if (rerender) this._render();
  }

  _setChecklist(items, emit = false, rerender = false) {
    this._config = {
      ...this._config,
      checklist: items.map((it) => ({ id: it.id, label: it.label })),
    };
    this._checklist = normalizeChecklist(this._config.checklist);
    if (emit) this._emitChange();
    if (rerender) this._render();
  }

  async _importChecklistFile(file) {
    this._importError = "";
    if (!file) return;

    try {
      const name = safeText(file.name).toLowerCase();
      let labels = [];

      if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
        const XLSX = window.XLSX;
        if (!XLSX || !XLSX.read || !XLSX.utils?.sheet_to_json) {
          throw new Error(
            "XLSX import kræver XLSX (SheetJS) library. Gem filen som CSV, eller tilføj XLSX som Lovelace resource (fx /local/xlsx.full.min.js)."
          );
        }

        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const firstSheetName = wb.SheetNames?.[0];
        if (!firstSheetName) throw new Error("Ingen sheets i XLSX-filen");
        const sheet = wb.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
        labels = (rows || [])
          .map((r) => stripOuterQuotes(r?.[0] ?? ""))
          .map((v) => safeText(v).trim())
          .filter(Boolean);

        const header = (labels[0] || "").toLowerCase();
        if (["butik", "store", "navn", "name", "checkliste", "checklist"].includes(header) && labels.length > 1) {
          labels.shift();
        }
      } else {
        const text = await file.text();
        labels = parseFirstColumnFromDelimitedText(text);
      }

      if (!labels.length) throw new Error("Fandt ingen punkter i filen");

      const curItems = normalizeChecklist(this._config?.checklist);
      const used = new Set(curItems.map((it) => it.id));
      const usedLabels = new Set(curItems.map((it) => safeText(it.label).trim().toLowerCase()).filter(Boolean));

      const added = [];
      for (const labelRaw of labels) {
        const label = safeText(labelRaw).trim();
        if (!label) continue;
        const key = label.toLowerCase();
        if (usedLabels.has(key)) continue;
        const id = makeUniqueId(slugify(label), used);
        used.add(id);
        usedLabels.add(key);
        added.push({ id, label });
      }

      if (!added.length) throw new Error("Ingen nye punkter at tilføje (alt fandtes allerede)");

      const next = [...curItems, ...added];
      this._setChecklist(next, true, true);
    } catch (e) {
      this._importError = safeText(e?.message || e);
      this._render();
    }
  }

  _render() {
    const title = safeText(this._config?.title || "");
    const goals = this._goals || [];
    const checklist = this._checklist || [];
    const importErr = safeText(this._importError || "");

    const css = `
      :host{ display:block; }
      .wrap{ padding: 8px 0; }
      .row{ display:grid; grid-template-columns: 1fr 110px 120px 70px; gap: 8px; align-items:center; margin-bottom: 8px; }
      .hdr{ color: var(--secondary-text-color); font-size: 12px; margin: 8px 0 6px; }
      .row2{ display:grid; grid-template-columns: 1fr 70px; gap: 8px; align-items:center; margin-bottom: 8px; }
      .row3{ display:grid; grid-template-columns: 1fr auto; gap: 8px; align-items:center; margin: 6px 0 10px; }
      .hint{ color: var(--secondary-text-color); font-size: 12px; margin: 4px 0 8px; }
      .err{ color: var(--error-color); font-size: 12px; margin: 6px 0 8px; }
      input{ width:100%; height: 36px; box-sizing:border-box; padding: 6px 10px; border-radius: 10px; border: 1px solid var(--divider-color); background: var(--card-background-color); color: var(--primary-text-color); }
      button{ height: 36px; padding: 0 10px; border-radius: 10px; border: 1px solid var(--divider-color); background: var(--card-background-color); color: var(--primary-text-color); cursor: pointer; }
      .small{ min-width: 70px; }
    `;

    const goalRows = goals
      .map((g, idx) => {
        return `
          <div class="row" data-idx="${idx}">
            <input class="name" placeholder="Navn" value="${safeText(g.name)}" />
            <input class="target" type="number" step="1" placeholder="Mål" value="${clampInt(g.target)}" />
            <input class="avg" type="number" step="0.01" placeholder="Pr. dag" value="${clampFloat(g.avg_per_day) || ""}" />
            <button class="remove small">Fjern</button>
          </div>
        `;
      })
      .join("");

    const checklistRows = checklist
      .map((it, idx) => {
        return `
          <div class="row2" data-check-idx="${idx}">
            <input class="label" placeholder="Punkt" value="${safeText(it.label)}" />
            <button class="remove small">Fjern</button>
          </div>
        `;
      })
      .join("");

    this._root.innerHTML = `
      <style>${css}</style>
      <div class="wrap">
        <div class="hdr">Titel</div>
        <input id="title" placeholder="(valgfri)" value="${title}" />

        <div class="hdr">Goals</div>
        ${goalRows || `<div class="hdr">Ingen goals endnu</div>`}
        <button id="add">Tilføj goal</button>

        <div class="hdr">Checkliste</div>
        <div class="row3">
          <input id="import_check" type="file" accept=".csv,.tsv,.txt,.xlsx,.xls" />
          <button id="import_check_btn" class="small">Importér</button>
        </div>
        <div class="hint">Importer første kolonne fra CSV/TSV/TXT (eller XLSX hvis XLSX library er tilføjet).</div>
        ${importErr ? `<div class="err">${importErr}</div>` : ""}
        ${checklistRows || `<div class="hdr">Ingen punkter endnu</div>`}
        <button id="add_check">Tilføj punkt</button>
      </div>
    `;

    const titleEl = this._root.querySelector("#title");
    if (titleEl) {
      // Avoid re-render on each keystroke (it steals focus/selection).
      titleEl.oninput = (e) => this._setTitle(e.target.value, false, false);
      titleEl.onchange = (e) => this._setTitle(e.target.value, true, true);
      titleEl.onblur = (e) => this._setTitle(e.target.value, true, true);
    }

    const addBtn = this._root.querySelector("#add");
    if (addBtn) {
      addBtn.onclick = () => {
        const curGoals = normalizeGoals(this._config?.goals);
        const used = new Set(curGoals.map((g) => g.id));
        const name = "Nyt mål";
        const id = makeUniqueId(slugify(name), used);
        const next = [...curGoals, { id, name, target: 0, avg_per_day: 0 }];
        this._setGoals(next, true, true);
      };
    }

    const addCheckBtn = this._root.querySelector("#add_check");
    if (addCheckBtn) {
      addCheckBtn.onclick = () => {
        const curItems = normalizeChecklist(this._config?.checklist);
        const used = new Set(curItems.map((it) => it.id));
        const label = "Nyt punkt";
        const id = makeUniqueId(slugify(label), used);
        const next = [...curItems, { id, label }];
        this._setChecklist(next, true, true);
      };
    }

    const importInput = this._root.querySelector("#import_check");
    const importBtn = this._root.querySelector("#import_check_btn");
    const runImport = async () => {
      const file = importInput?.files?.[0];
      await this._importChecklistFile(file);
      if (importInput) importInput.value = "";
    };
    if (importBtn) importBtn.onclick = runImport;
    if (importInput) importInput.onchange = runImport;

    const rows = this._root.querySelectorAll(".row[data-idx]");
    rows.forEach((rowEl) => {
      const idx = clampInt(rowEl.getAttribute("data-idx"));
      const nameEl = rowEl.querySelector("input.name");
      const targetEl = rowEl.querySelector("input.target");
      const avgEl = rowEl.querySelector("input.avg");
      const rmEl = rowEl.querySelector("button.remove");

      const update = () => {
        const liveGoals = normalizeGoals(this._config?.goals);
        const cur = liveGoals[idx];
        if (!cur) return;
        const name = safeText(nameEl?.value).trim();
        const target = clampInt(targetEl?.value);
        const avg_per_day = clampFloat(avgEl?.value);
        const id = cur.id || slugify(name);
        const next = liveGoals.map((g, i) => (i === idx ? { id, name, target, avg_per_day } : g));
        // Do not emit config-changed on each keystroke.
        this._setGoals(next, false, false);
      };

      const updateAndRerender = () => {
        const liveGoals = normalizeGoals(this._config?.goals);
        const cur = liveGoals[idx];
        if (!cur) return;
        const name = safeText(nameEl?.value).trim();
        const target = clampInt(targetEl?.value);
        const avg_per_day = clampFloat(avgEl?.value);
        const id = cur.id || slugify(name);
        const next = liveGoals.map((g, i) => (i === idx ? { id, name, target, avg_per_day } : g));
        this._setGoals(next, true, true);
      };

      if (nameEl) {
        nameEl.oninput = update;
        nameEl.onchange = updateAndRerender;
        nameEl.onblur = updateAndRerender;
      }
      if (targetEl) {
        targetEl.oninput = update;
        targetEl.onchange = updateAndRerender;
        targetEl.onblur = updateAndRerender;
      }
      if (avgEl) {
        avgEl.oninput = update;
        avgEl.onchange = updateAndRerender;
        avgEl.onblur = updateAndRerender;
      }
      if (rmEl) {
        rmEl.onclick = () => {
          const liveGoals = normalizeGoals(this._config?.goals);
          const next = liveGoals.filter((_, i) => i !== idx);
          this._setGoals(next, true, true);
        };
      }
    });

    const checkRows = this._root.querySelectorAll(".row2[data-check-idx]");
    checkRows.forEach((rowEl) => {
      const idx = clampInt(rowEl.getAttribute("data-check-idx"));
      const labelEl = rowEl.querySelector("input.label");
      const rmEl = rowEl.querySelector("button.remove");

      const update = () => {
        const live = normalizeChecklist(this._config?.checklist);
        const cur = live[idx];
        if (!cur) return;
        const label = safeText(labelEl?.value).trim();
        const id = cur.id || slugify(label);
        const next = live.map((it, i) => (i === idx ? { id, label } : it));
        this._setChecklist(next, false, false);
      };

      const updateAndRerender = () => {
        const live = normalizeChecklist(this._config?.checklist);
        const cur = live[idx];
        if (!cur) return;
        const label = safeText(labelEl?.value).trim();
        const id = cur.id || slugify(label);
        const next = live.map((it, i) => (i === idx ? { id, label } : it));
        this._setChecklist(next, true, true);
      };

      if (labelEl) {
        labelEl.oninput = update;
        labelEl.onchange = updateAndRerender;
        labelEl.onblur = updateAndRerender;
      }
      if (rmEl) {
        rmEl.onclick = () => {
          const live = normalizeChecklist(this._config?.checklist);
          const next = live.filter((_, i) => i !== idx);
          this._setChecklist(next, true, true);
        };
      }
    });
  }
}

customElements.define("goal-counter-card-editor", GoalCounterCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "goal-counter-card",
  name: "Goal Counter",
  preview: true,
  description: "Simple goal counter with checklist",
});

console.info(`GOAL-COUNTER-CARD ${CARD_VERSION}`);
