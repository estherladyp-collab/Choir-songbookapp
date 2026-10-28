(() => {
  const DEFAULT_CATS = ["Praise", "Worship", "Ministration", "Wedding", "Funeral", "Anointing Service", "Christmas Songs"];
  const OLD_CATS = { praise: "Praise", worship: "Worship", ministration: "Ministration" };
  const KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const LEADERS = window.LEADERS;
  const STORE = "songbook.songs.v1", CATKEY = "songbook.cats.v1", SETKEY = "songbook.sets.v1", ROLE = "songbook.role.v1", THEME = "songbook.theme.v1";
  const ICONS = {
    auto: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/></svg>',
    light: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    dark: '<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>'
  };
  const LABEL = { auto: "Automatic", light: "Light", dark: "Dark" };

  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const read = k => { try { return localStorage.getItem(k); } catch { return null; } };
  const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

  let songs = load();
  let cats = loadCats();
  let sets = loadSets();
  let draft = null;
  let role = read(ROLE) || "member";
  let theme = read(THEME) || "auto";

  function applyTheme() {
    const r = document.documentElement;
    if (theme === "auto") r.removeAttribute("data-theme"); else r.setAttribute("data-theme", theme);
    const b = $("themeBtn");
    b.innerHTML = ICONS[theme];
    b.title = "Appearance: " + LABEL[theme] + " (tap to change)";
    b.setAttribute("aria-label", b.title);
  }
  function cycleTheme() {
    theme = { auto: "light", light: "dark", dark: "auto" }[theme] || "auto";
    write(THEME, theme); applyTheme();
  }
  const view = { tab: "songs", cat: "all", q: "", leader: LEADERS[0], onlyKeys: false };

  // older saves have one "category" per song; songs now carry a list of categories
  function normalize(list) {
    list.forEach(s => {
      if (!Array.isArray(s.categories)) s.categories = s.category ? [OLD_CATS[s.category] || s.category] : [];
      delete s.category;
    });
    return list;
  }
  function load() {
    try { const s = JSON.parse(read(STORE)); if (Array.isArray(s) && s.length) return normalize(s); } catch { /* fall through */ }
    return normalize(JSON.parse(JSON.stringify(window.SEED_SONGS)));
  }
  function loadCats() {
    let extra = [];
    try { const c = JSON.parse(read(CATKEY)); if (Array.isArray(c)) extra = c; } catch { /* defaults only */ }
    songs.forEach(s => extra.push(...s.categories));
    return [...new Set([...DEFAULT_CATS, ...extra])];
  }
  function loadSets() {
    try { const x = JSON.parse(read(SETKEY)); if (Array.isArray(x)) return x; } catch { /* none yet */ }
    return [];
  }
  const save = () => { write(STORE, JSON.stringify(songs)); write(CATKEY, JSON.stringify(cats)); write(SETKEY, JSON.stringify(sets)); };
  const canSeeKeys = () => role === "leader" || role === "director";
  const isDirector = () => role === "director";

  function ytId(url) {
    const m = String(url || "").match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
    return m ? m[1] : "";
  }
  const ytSearch = s => "https://www.youtube.com/results?search_query=" + encodeURIComponent(s.title + " " + (s.composer || "") + " worship");

  // ---------- list ----------
  function renderChrome() {
    $("cats").innerHTML = [...cats.map(c => [c, c]), ["all", "All"]]
      .map(([v, l]) => `<button class="chip${view.cat === v ? " on" : ""}" data-cat="${esc(v)}" type="button">${esc(l)}</button>`).join("");
    $("leaderbar").hidden = !canSeeKeys();
    $("leaderSel").innerHTML = LEADERS.map(l => `<option${l === view.leader ? " selected" : ""}>${esc(l)}</option>`).join("");
    $("onlyKeys").checked = view.onlyKeys;
    $("addBtn").hidden = view.tab === "sets" ? !canSeeKeys() : !isDirector();
    $("addBtn").setAttribute("aria-label", view.tab === "sets" ? "New set list" : "Add song");
    document.querySelectorAll(".tab").forEach(b => b.classList.toggle("on", b.dataset.tab === view.tab));
    $("songTools").hidden = view.tab !== "songs";
    $("songsView").hidden = view.tab !== "songs";
    $("setsView").hidden = view.tab !== "sets";
    const rb = $("roleBtn");
    rb.textContent = role === "director" ? "Director" : role === "leader" ? "Song Leader" : "Member";
    rb.classList.toggle("on", role !== "member");
  }

  function renderList() {
    const q = view.q.trim().toLowerCase();
    const rows = songs.filter(s => {
      if (view.cat !== "all" && !s.categories.includes(view.cat)) return false;
      if (canSeeKeys() && view.onlyKeys && !s.keys[view.leader]) return false;
      if (!q) return true;
      return (s.title + " " + s.composer + " " + s.categories.join(" ") + " " + s.lyrics + " " + (s.note || "")).toLowerCase().includes(q);
    });
    $("count").textContent = rows.length + (rows.length === 1 ? " song" : " songs");
    $("empty").hidden = rows.length > 0;
    let html = "", cur = "";
    rows.forEach(s => {
      const first = (s.title.match(/[A-Za-z0-9]/) || ["#"])[0].toUpperCase();
      const letter = /\d/.test(first) ? "#" : first;
      if (letter !== cur) { if (cur) html += "</ul>"; html += `<div class="letter">${letter}</div><ul class="list">`; cur = letter; }
      const k = canSeeKeys() ? (s.keys[view.leader] ? `<span class="medal">${esc(s.keys[view.leader])}</span>` : `<span class="medal none">–</span>`) : "";
      html += `<li class="row"><button class="song" type="button" data-id="${s.id}">
        <span class="main"><span class="t">${esc(s.title)}</span><span class="c">${esc(s.composer || "Composer not added yet")} · <span class="cat">${esc(s.categories.join(" · ") || "No category")}</span></span></span>${k}</button>
        ${isDirector() ? `<button class="rowedit" data-edit="${s.id}" type="button" aria-label="Edit ${esc(s.title)}" title="Edit or delete"><svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/></svg></button>` : ""}</li>`;
    });
    $("list").innerHTML = html + (cur ? "</ul>" : "");
  }

  const refresh = () => { renderChrome(); renderList(); renderSets(); };

  // ---------- set lists ----------
  const fmtDate = d => d ? new Date(d + "T12:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "";
  const setMeta = t => [t.type, fmtDate(t.date), t.leader ? "Leader: " + t.leader : ""].filter(Boolean).join(" · ");
  const songById = id => songs.find(x => x.id === id);

  function renderSets() {
    const list = sets.slice().sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.created - a.created);
    $("setsView").innerHTML = list.length
      ? `<div class="count">${list.length} set ${list.length === 1 ? "list" : "lists"}</div><ul class="list">${list.map(t => `<li class="row"><button class="song" type="button" data-set="${t.id}">
          <span class="main"><span class="t">${esc(t.name)}</span><span class="c">${esc(setMeta(t))} · ${t.songIds.filter(songById).length} songs</span></span></button></li>`).join("")}</ul>`
      : `<div class="empty">No set lists yet.${canSeeKeys() ? "<br>Tap + to build the first one." : ""}</div>`;
  }

  function setText(t) {
    const withKeys = canSeeKeys() && t.leader;
    const lines = t.songIds.map(songById).filter(Boolean).map((s, i) => `${i + 1}. ${s.title}${withKeys && s.keys[t.leader] ? " (" + s.keys[t.leader] + ")" : ""}`);
    return `${t.name}\n${setMeta(t)}\n\n${lines.join("\n")}${t.note ? "\n\n" + t.note : ""}`;
  }

  function openSet(id) {
    const t = sets.find(x => x.id === id);
    if (!t) return;
    const rows = t.songIds.map(songById).filter(Boolean).map((s, i) => {
      const k = canSeeKeys() && t.leader ? (s.keys[t.leader] ? `<span class="medal">${esc(s.keys[t.leader])}</span>` : `<span class="medal none">–</span>`) : "";
      return `<li class="row"><button class="song" type="button" data-id="${s.id}"><span class="no">${i + 1}</span>
        <span class="main"><span class="t">${esc(s.title)}</span><span class="c">${esc(s.composer || "Composer not added yet")}</span></span>${k}</button></li>`;
    }).join("");
    $("setDlg").innerHTML = `<div class="sheet"><div class="sheet-head"><div style="flex:1"><h2>${esc(t.name)}</h2><div class="sub">${esc(setMeta(t))}</div></div>
      ${canSeeKeys() ? `<button class="btn" data-editset="${t.id}" type="button">Edit</button>` : ""}
      <button class="x" data-close type="button" aria-label="Close">✕</button></div>
      ${t.note ? `<p class="note">${esc(t.note)}</p>` : ""}
      <div class="sec"><h3>Songs in this set</h3>${rows ? `<ol class="list setlist">${rows}</ol>` : `<p class="muted">No songs added yet.</p>`}</div>
      <div class="sec"><div class="btns"><button class="btn solid" id="copySet" data-set="${t.id}" type="button">Copy as text</button></div>
      <div id="copyOut"></div></div></div>`;
    if (!$("setDlg").open) $("setDlg").showModal();
  }

  async function copySet(id) {
    const t = sets.find(x => x.id === id), text = setText(t), out = $("copyOut");
    try { await navigator.clipboard.writeText(text); out.innerHTML = `<p class="muted">Copied. You can paste it into WhatsApp.</p>`; }
    catch {
      out.innerHTML = `<p class="muted">Select the text below and copy it.</p><textarea class="copybox" readonly></textarea>`;
      const ta = out.querySelector("textarea"); ta.value = text; ta.focus(); ta.select();
    }
  }

  function openSetEdit(id) {
    const old = id && sets.find(x => x.id === id);
    draft = old ? JSON.parse(JSON.stringify(old)) : { name: "", type: "Worship", date: "", leader: "", note: "", songIds: [] };
    $("editDlg").innerHTML = `<form class="sheet" id="setForm" data-id="${id || ""}">
      <div class="sheet-head"><h2>${id ? "Edit set list" : "New set list"}</h2><button class="x" data-close type="button" aria-label="Close">✕</button></div>
      <label for="setName">Name</label><input id="setName" name="name" required placeholder="e.g. Sunday Worship" value="${esc(draft.name)}">
      <div class="grid2"><div><label for="setType">Type</label><select id="setType" name="type">${cats.map(c => `<option${c === draft.type ? " selected" : ""}>${esc(c)}</option>`).join("")}</select></div>
      <div><label for="setDate">Date</label><input id="setDate" name="date" type="date" value="${esc(draft.date)}"></div></div>
      <label for="setLeader">Song leader (shows their keys)</label>
      <select id="setLeader" name="leader"><option value="">–</option>${LEADERS.map(l => `<option${l === draft.leader ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>
      <label>Songs in this set</label><div id="picked"></div>
      <label for="pickQ">Add songs</label>
      <div class="grid2"><input id="pickQ" type="search" placeholder="Search songs" autocomplete="off">
      <select id="pickCat" aria-label="Category"><option value="all">All categories</option>${cats.map(c => `<option>${esc(c)}</option>`).join("")}</select></div>
      <div id="pickList"></div>
      <label for="setNote">Note (optional)</label><input id="setNote" name="note" value="${esc(draft.note || "")}">
      <div class="actions"><button class="btn solid" type="submit">Save set list</button>
      ${id ? `<button class="btn danger" id="delSet" type="button">Delete</button>` : ""}</div></form>`;
    $("editDlg").showModal();
    renderPicked(); renderPick();
  }

  function renderPicked() {
    const rows = draft.songIds.map(songById).filter(Boolean);
    draft.songIds = rows.map(s => s.id);
    $("picked").innerHTML = rows.length ? `<ol class="picked">${rows.map((s, i) => `<li><span class="no">${i + 1}</span><span class="pt">${esc(s.title)}</span>
      <button type="button" class="mini" data-up="${i}" aria-label="Move up"${i === 0 ? " disabled" : ""}>↑</button>
      <button type="button" class="mini" data-down="${i}" aria-label="Move down"${i === rows.length - 1 ? " disabled" : ""}>↓</button>
      <button type="button" class="mini" data-rm="${i}" aria-label="Remove">✕</button></li>`).join("")}</ol>` : `<p class="muted">Nothing added yet. Pick songs below.</p>`;
  }

  function renderPick() {
    const q = ($("pickQ").value || "").trim().toLowerCase(), c = $("pickCat").value;
    const found = songs.filter(s => (c === "all" || s.categories.includes(c)) && (!q || (s.title + " " + s.composer).toLowerCase().includes(q)));
    $("pickList").innerHTML = found.slice(0, 40).map(s => { const on = draft.songIds.includes(s.id);
      return `<button type="button" class="pick${on ? " on" : ""}" data-pick="${s.id}"><span>${esc(s.title)}<small>${esc(s.composer)}</small></span><b>${on ? "✓" : "+"}</b></button>`; }).join("")
      + (found.length > 40 ? `<p class="muted">Showing 40 of ${found.length}. Type to narrow it down.</p>` : found.length ? "" : `<p class="muted">No songs found.</p>`);
  }

  function saveSet(form) {
    const f = new FormData(form), id = form.dataset.id, old = id && sets.find(x => x.id === id);
    const t = { id: id || "t" + Date.now().toString(36), name: f.get("name").trim(), type: f.get("type"), date: f.get("date"), leader: f.get("leader"),
      note: f.get("note").trim(), songIds: draft.songIds, created: old ? old.created : Date.now() };
    if (old) Object.assign(old, t); else sets.push(t);
    save(); $("editDlg").close(); refresh(); openSet(t.id);
  }

  // ---------- recordings (saved on this device in IndexedDB) ----------
  const idb = () => new Promise((res, rej) => {
    const r = indexedDB.open("songbook.audio.v1", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("clips", { keyPath: "id" });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const clipTx = (mode, fn) => idb().then(db => new Promise((res, rej) => {
    const t = db.transaction("clips", mode), req = fn(t.objectStore("clips"));
    t.oncomplete = () => res(req.result);
    t.onerror = () => rej(t.error);
  }));
  const putClip = c => clipTx("readwrite", s => s.put(c));
  const delClip = id => clipTx("readwrite", s => s.delete(id));
  const allClips = () => clipTx("readonly", s => s.getAll());

  let currentSong = null, clipUrls = [], rec = null;

  const clipMsg = (t, ok) => { const m = $("clipMsg"); if (m) { m.textContent = t; m.style.color = ok ? "var(--gold)" : "var(--danger)"; } };

  async function renderClips() {
    const box = $("clips");
    if (!box || !currentSong) return;
    clipUrls.forEach(URL.revokeObjectURL); clipUrls = [];
    let clips = [];
    try { clips = (await allClips()).filter(c => c.songId === currentSong).sort((a, b) => a.created - b.created); }
    catch { clipMsg("Saving audio is not available in this browser mode."); }
    if (!$("clips")) return;
    const items = clips.map(c => {
      const url = URL.createObjectURL(c.blob); clipUrls.push(url);
      return `<div class="clip"><div class="clip-head"><b>${esc(c.label)}</b><span class="muted">${new Date(c.created).toLocaleDateString()}</span>
        ${isDirector() ? `<button class="btn danger sm" data-delclip="${c.id}" type="button">Delete</button>` : ""}</div>
        <audio controls preload="none" src="${url}"></audio></div>`;
    }).join("");
    const tools = canSeeKeys() ? `<div class="clip-tools"><label for="clipLabel">Label (optional)</label>
      <input id="clipLabel" placeholder="e.g. Alto part, Esther in D#">
      <div class="btns"><label class="btn solid" for="clipFile">Upload audio</label>
      <input id="clipFile" type="file" accept="audio/*" multiple hidden>
      <button class="btn" id="recBtn" type="button">● Record</button></div>
      <div class="msg" id="clipMsg" role="status"></div></div>` : "";
    box.innerHTML = (items || `<p class="muted">No recordings yet.</p>`) + tools;
  }

  async function saveClip(blob, label, fallback) {
    await putClip({ id: "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), songId: currentSong,
      label: (label || "").trim() || fallback, blob, created: Date.now() });
    try { navigator.storage?.persist?.(); } catch { /* optional */ }
  }

  async function uploadFiles(files) {
    const label = ($("clipLabel") || {}).value;
    try {
      for (const f of files) await saveClip(f, files.length === 1 ? label : "", (label ? label + " · " : "") + f.name.replace(/\.[^.]+$/, ""));
      await renderClips(); clipMsg("Saved.", true);
    } catch { clipMsg("Could not save this file. Free up some space and try again."); }
  }

  async function toggleRec() {
    const btn = $("recBtn");
    if (rec) { rec.mr.stop(); return; }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return clipMsg("Recording is not supported here. Use Upload audio instead.");
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { return clipMsg("The microphone is blocked. Allow it in your browser settings, or use Upload audio."); }
    const mr = new MediaRecorder(stream), chunks = [], t0 = Date.now(), label = ($("clipLabel") || {}).value;
    rec = { mr, stream };
    mr.ondataavailable = e => e.data.size && chunks.push(e.data);
    const tick = setInterval(() => { const b = $("recBtn"); if (b) { const s = Math.floor((Date.now() - t0) / 1000); b.textContent = "■ Stop " + Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); } }, 500);
    mr.onstop = async () => {
      clearInterval(tick); stream.getTracks().forEach(t => t.stop()); rec = null;
      if (chunks.length && currentSong) {
        let ok = true;
        try { await saveClip(new Blob(chunks, { type: mr.mimeType || "audio/webm" }), label, "Recording " + new Date().toLocaleString()); }
        catch { ok = false; }
        await renderClips();
        clipMsg(ok ? "Recording saved." : "Could not save the recording.", ok);
      } else renderClips();
    };
    mr.start(); btn.textContent = "■ Stop 0:00"; btn.classList.add("rec"); clipMsg("Recording… tap Stop when you are done.", true);
  }

  // ---------- song sheet ----------
  function openSong(id) {
    const s = songs.find(x => x.id === id);
    if (!s) return;
    currentSong = id;
    const vid = ytId(s.youtube);
    let listen = "";
    if (vid) listen += `<iframe class="player" src="https://www.youtube-nocookie.com/embed/${vid}" title="${esc(s.title)}" allow="encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe>`;
    else if (s.youtube) listen += `<a class="btn solid" href="${esc(s.youtube)}" target="_blank" rel="noopener">Open video</a>`;
    if (s.audio) listen += `<audio controls preload="none" src="${esc(s.audio)}"></audio>`;
    if (!vid && !s.youtube && !s.audio) listen = `<p class="muted">No video or audio added yet.</p>`;
    listen += `<div class="btns">${vid ? `<a class="btn solid" href="https://www.youtube.com/watch?v=${vid}" target="_blank" rel="noopener">Watch on YouTube</a>` : ""}<a class="btn" href="${ytSearch(s)}" target="_blank" rel="noopener">Search on YouTube</a></div>`;

    const keys = canSeeKeys() ? `<div class="sec"><h3>Keys by song leader</h3><div class="keys">${
      LEADERS.map(l => `<div class="keybox${s.keys[l] ? "" : " none"}"><b>${esc(s.keys[l] || "–")}</b><span>${esc(l)}</span></div>`).join("")}</div></div>` : "";

    $("songBody").innerHTML = `<div class="sheet">
      <div class="sheet-head"><div style="flex:1"><h2>${esc(s.title)}</h2><div class="sub">${esc(s.composer || "Composer not added yet")}${s.categories.length ? " · " + esc(s.categories.join(" · ")) : ""}</div></div>
        ${isDirector() ? `<button class="btn" data-edit="${s.id}" type="button">Edit</button>` : ""}
        <button class="x" data-close type="button" aria-label="Close">✕</button></div>
      ${s.needsCheck ? `<p class="note" style="margin-top:14px">Title typed from the handwritten song list. Please double-check the spelling.</p>` : ""}
      ${s.note ? `<p class="note" style="margin-top:14px">${esc(s.note)}</p>` : ""}
      <div class="sec"><h3>Listen</h3>${listen}</div>
      <div class="sec"><h3>Recordings</h3><div id="clips"></div></div>
      ${keys}
      <div class="sec"><h3>Lyrics</h3>${s.lyrics ? `<div class="lyrics">${esc(s.lyrics)}</div>` : `<p class="muted">Lyrics not added yet.</p>`}</div>
    </div>`;
    const d = $("songDlg");
    if (!d.open) d.showModal();
    renderClips();
  }

  // ---------- role ----------
  function openRole() {
    const d = $("roleDlg");
    d.innerHTML = `<div class="sheet"><div class="sheet-head"><h2>Who is using the book?</h2><button class="x" data-close type="button" aria-label="Close">✕</button></div>
      ${role === "member" ? `<form id="roleForm"><label for="code">Leader or Director code</label>
        <input id="code" type="password" autocomplete="off" placeholder="Enter code"><div class="msg" id="roleMsg"></div>
        <div class="actions"><button class="btn solid" type="submit">Unlock</button></div></form>
        <p class="muted" style="margin-top:20px">Members see the songs, lyrics and listening links. Song leaders also see the keys. The director can edit everything.</p>`
      : `<p>You are signed in as <b>${role === "director" ? "Director" : "Song Leader"}</b>.</p>
        <div class="actions"><button class="btn solid" id="signOut" type="button">Sign out</button></div>
        ${isDirector() ? `<div class="sec"><h3>Backup</h3><p class="muted">Edits are saved on this device. Download a backup file to keep or share them.</p>
        <div class="actions"><button class="btn" id="exp" type="button">Download backup</button>
        <label class="btn" style="margin:0">Restore backup<input id="imp" type="file" accept="application/json" hidden></label>
        <button class="btn danger" id="reset" type="button">Reset to original list</button></div><div class="msg" id="impMsg"></div></div>` : ""}`}
    </div>`;
    d.showModal();
  }

  function setRole(r) { role = r; write(ROLE, r); $("roleDlg").close(); refresh(); }

  // ---------- edit ----------
  function openEdit(id) {
    const s = id ? songs.find(x => x.id === id) : { title: "", composer: "", categories: [], youtube: "", audio: "", lyrics: "", keys: {}, note: "" };
    const d = $("editDlg");
    d.innerHTML = `<form class="sheet" id="editForm" data-id="${id || ""}">
      <div class="sheet-head"><h2>${id ? "Edit song" : "New song"}</h2><button class="x" data-close type="button" aria-label="Close">✕</button></div>
      <label>Title</label><input name="title" required value="${esc(s.title)}">
      <label>Composer / artist</label><input name="composer" value="${esc(s.composer)}">
      <label>Categories</label>
      <div class="cbxs">${cats.map(c => `<label class="cbx"><input type="checkbox" name="cat" value="${esc(c)}"${s.categories.includes(c) ? " checked" : ""}>${esc(c)}</label>`).join("")}</div>
      <input name="newcat" placeholder="Add a new category (optional)">
      <label>YouTube link</label><input name="youtube" inputmode="url" placeholder="https://youtu.be/..." value="${esc(s.youtube)}">
      <label>Audio file link (mp3)</label><input name="audio" inputmode="url" placeholder="https://..." value="${esc(s.audio)}">
      <label>Keys by song leader</label>
      <div class="grid2">${LEADERS.map(l => `<div><span class="muted" style="font-size:.8rem">${esc(l)}</span><select name="key_${esc(l)}"><option value="">–</option>${KEYS.map(k => `<option${s.keys[l] === k ? " selected" : ""}>${k}</option>`).join("")}</select></div>`).join("")}</div>
      <label>Note (optional)</label><input name="note" value="${esc(s.note || "")}">
      <label>Lyrics</label><textarea name="lyrics">${esc(s.lyrics)}</textarea>
      <div class="actions"><button class="btn solid" type="submit">Save</button>
      ${id ? `<button class="btn danger" id="delSong" type="button">Delete</button>` : ""}</div></form>`;
    d.showModal();
  }

  function saveEdit(form) {
    const f = new FormData(form), id = form.dataset.id;
    const keys = {};
    LEADERS.forEach(l => { if (f.get("key_" + l)) keys[l] = f.get("key_" + l); });
    const data = { title: f.get("title").trim(), composer: f.get("composer").trim(), categories: f.getAll("cat"),
      youtube: f.get("youtube").trim(), audio: f.get("audio").trim(), lyrics: f.get("lyrics"), note: f.get("note").trim(), keys, needsCheck: false };
    const nc = f.get("newcat").trim();
    if (nc) { const known = cats.find(c => c.toLowerCase() === nc.toLowerCase()); if (!known) cats.push(nc); if (!data.categories.includes(known || nc)) data.categories.push(known || nc); }
    if (id) Object.assign(songs.find(x => x.id === id), data);
    else songs.push({ id: "s" + Date.now().toString(36), ...data });
    songs.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
    save(); $("editDlg").close(); refresh();
    if (id) openSong(id);
  }

  // ---------- events ----------
  document.addEventListener("click", e => {
    const t = e.target;
    if (t.closest("[data-close]")) { t.closest("dialog").close(); return; }
    const song = t.closest(".song"); if (song && song.dataset.id) return openSong(song.dataset.id);
    const tab = t.closest("[data-tab]"); if (tab) { view.tab = tab.dataset.tab; return refresh(); }
    const st = t.closest("[data-set]"); if (st && st.id !== "copySet") return openSet(st.dataset.set);
    if (t.id === "copySet") return copySet(t.dataset.set);
    const es = t.closest("[data-editset]"); if (es) { $("setDlg").close(); return openSetEdit(es.dataset.editset); }
    const pk = t.closest("[data-pick]");
    if (pk) { const i = draft.songIds.indexOf(pk.dataset.pick); if (i < 0) draft.songIds.push(pk.dataset.pick); else draft.songIds.splice(i, 1); renderPicked(); return renderPick(); }
    const mv = t.closest("[data-up],[data-down],[data-rm]");
    if (mv) {
      const a = draft.songIds;
      if (mv.dataset.rm !== undefined) a.splice(+mv.dataset.rm, 1);
      else { const i = +(mv.dataset.up ?? mv.dataset.down), j = mv.dataset.up !== undefined ? i - 1 : i + 1; [a[i], a[j]] = [a[j], a[i]]; }
      renderPicked(); return renderPick();
    }
    if (t.id === "delSet") {
      if (!t.dataset.sure) { t.dataset.sure = "1"; t.textContent = "Tap again to delete"; return; }
      const id = $("setForm").dataset.id; sets = sets.filter(x => x.id !== id); save(); $("editDlg").close(); refresh(); return;
    }
    const cat = t.closest("[data-cat]"); if (cat) { view.cat = cat.dataset.cat; return refresh(); }
    const ed = t.closest("[data-edit]"); if (ed) { $("songDlg").close(); return openEdit(ed.dataset.edit); }
    if (t.closest("#themeBtn")) return cycleTheme();
    if (t.id === "recBtn") return toggleRec();
    const dc = t.closest("[data-delclip]");
    if (dc) { if (dc.dataset.sure) delClip(dc.dataset.delclip).then(renderClips); else { dc.dataset.sure = "1"; dc.textContent = "Tap again to delete"; } return; }
    if (t.id === "roleBtn") return openRole();
    if (t.id === "addBtn") return view.tab === "sets" ? openSetEdit() : openEdit();
    if (t.id === "signOut") return setRole("member");
    if (t.id === "delSong") {
      if (!t.dataset.sure) { t.dataset.sure = "1"; t.textContent = "Tap again to delete for good"; return; }
      const id = $("editForm").dataset.id;
      songs = songs.filter(x => x.id !== id); sets.forEach(t => { t.songIds = t.songIds.filter(x => x !== id); }); save(); $("editDlg").close(); refresh();
      allClips().then(cl => Promise.all(cl.filter(c => c.songId === id).map(c => delClip(c.id)))).catch(() => {});
    }
    if (t.id === "exp") {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([JSON.stringify({ songs, sets, cats }, null, 1)], { type: "application/json" }));
      a.download = "choir-songbook-backup.json"; a.click(); URL.revokeObjectURL(a.href);
    }
    if (t.id === "reset") {
      if (!t.dataset.sure) { t.dataset.sure = "1"; t.textContent = "Tap again: this removes all edits"; return; }
      songs = normalize(JSON.parse(JSON.stringify(window.SEED_SONGS))); cats = loadCats(); save(); $("roleDlg").close(); refresh();
    }
  });

  document.addEventListener("submit", e => {
    e.preventDefault();
    if (e.target.id === "roleForm") {
      const c = $("code").value.trim();
      if (c === window.CONFIG.DIRECTOR_CODE) setRole("director");
      else if (c === window.CONFIG.LEADER_CODE) setRole("leader");
      else $("roleMsg").textContent = "That code is not right.";
    }
    if (e.target.id === "editForm") saveEdit(e.target);
    if (e.target.id === "setForm") saveSet(e.target);
  });

  document.addEventListener("change", e => {
    if (e.target.id === "clipFile" && e.target.files.length) { uploadFiles([...e.target.files]); e.target.value = ""; }
    if (e.target.id === "pickCat") renderPick();
    if (e.target.id === "leaderSel") { view.leader = e.target.value; renderList(); }
    if (e.target.id === "onlyKeys") { view.onlyKeys = e.target.checked; renderList(); }
    if (e.target.id === "imp" && e.target.files[0]) {
      e.target.files[0].text().then(txt => {
        try {
          const raw = JSON.parse(txt), s = Array.isArray(raw) ? raw : raw.songs;
          if (!Array.isArray(s)) throw 0;
          songs = normalize(s); if (raw.sets) sets = raw.sets; if (raw.cats) write(CATKEY, JSON.stringify(raw.cats)); cats = loadCats(); save(); $("roleDlg").close(); refresh();
        } catch { const m = $("impMsg"); if (m) m.textContent = "That file is not a songbook backup."; }
      });
    }
  });

  document.addEventListener("input", e => { if (e.target.id === "pickQ") renderPick(); });
  $("q").addEventListener("input", e => { view.q = e.target.value; renderList(); });
  $("songDlg").addEventListener("close", () => {
    if (rec) { rec.mr.onstop = null; rec.mr.stop(); rec.stream.getTracks().forEach(t => t.stop()); rec = null; }
    clipUrls.forEach(URL.revokeObjectURL); clipUrls = []; currentSong = null;
  });
  ["songDlg", "setDlg", "roleDlg", "editDlg"].forEach(id => $(id).addEventListener("click", e => { if (e.target === e.currentTarget) e.currentTarget.close(); }));

  applyTheme();
  refresh();
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
