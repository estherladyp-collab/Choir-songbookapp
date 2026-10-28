(() => {
  const CATS = [["all", "All"], ["praise", "Praise"], ["worship", "Worship"], ["ministration", "Ministration"]];
  const KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const LEADERS = window.LEADERS;
  const STORE = "songbook.songs.v1", ROLE = "songbook.role.v1";

  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const read = k => { try { return localStorage.getItem(k); } catch { return null; } };
  const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

  let songs = load();
  let role = read(ROLE) || "member";
  const view = { cat: "all", q: "", leader: LEADERS[0], onlyKeys: false };

  function load() {
    try { const s = JSON.parse(read(STORE)); if (Array.isArray(s) && s.length) return s; } catch { /* fall through */ }
    return JSON.parse(JSON.stringify(window.SEED_SONGS));
  }
  const save = () => write(STORE, JSON.stringify(songs));
  const canSeeKeys = () => role === "leader" || role === "director";
  const isDirector = () => role === "director";

  function ytId(url) {
    const m = String(url || "").match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
    return m ? m[1] : "";
  }
  const ytSearch = s => "https://www.youtube.com/results?search_query=" + encodeURIComponent(s.title + " " + (s.composer || "") + " worship");

  // ---------- list ----------
  function renderChrome() {
    $("cats").innerHTML = CATS.map(([v, l]) => `<button class="chip${view.cat === v ? " on" : ""}" data-cat="${v}" type="button">${l}</button>`).join("");
    $("leaderbar").hidden = !canSeeKeys();
    $("leaderSel").innerHTML = LEADERS.map(l => `<option${l === view.leader ? " selected" : ""}>${esc(l)}</option>`).join("");
    $("onlyKeys").checked = view.onlyKeys;
    $("addBtn").hidden = !isDirector();
    const rb = $("roleBtn");
    rb.textContent = role === "director" ? "Director" : role === "leader" ? "Song Leader" : "Member";
    rb.classList.toggle("on", role !== "member");
  }

  function renderList() {
    const q = view.q.trim().toLowerCase();
    const rows = songs.filter(s => {
      if (view.cat !== "all" && s.category !== view.cat) return false;
      if (canSeeKeys() && view.onlyKeys && !s.keys[view.leader]) return false;
      if (!q) return true;
      return (s.title + " " + s.composer + " " + s.lyrics + " " + (s.note || "")).toLowerCase().includes(q);
    });
    $("count").textContent = rows.length + (rows.length === 1 ? " song" : " songs");
    $("empty").hidden = rows.length > 0;
    $("list").innerHTML = rows.map(s => {
      const k = canSeeKeys() ? (s.keys[view.leader] ? `<span class="key">${esc(s.keys[view.leader])}</span>` : `<span class="key none">–</span>`) : "";
      return `<li><button class="song" type="button" data-id="${s.id}">
        <span class="main"><span class="t">${esc(s.title)}</span><br><span class="c">${esc(s.composer || "Composer not added yet")}</span></span>
        <span class="badge">${esc(s.category)}</span>${k}</button></li>`;
    }).join("");
  }

  const refresh = () => { renderChrome(); renderList(); };

  // ---------- song sheet ----------
  function openSong(id) {
    const s = songs.find(x => x.id === id);
    if (!s) return;
    const vid = ytId(s.youtube);
    let listen = "";
    if (vid) listen += `<iframe class="player" src="https://www.youtube-nocookie.com/embed/${vid}" title="${esc(s.title)}" allow="encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe>`;
    else if (s.youtube) listen += `<a class="btn solid" href="${esc(s.youtube)}" target="_blank" rel="noopener">Open video</a>`;
    if (s.audio) listen += `<audio controls preload="none" src="${esc(s.audio)}"></audio>`;
    if (!vid && !s.youtube && !s.audio) listen = `<p class="muted">No video or audio added yet.</p>`;
    listen += `<p><a class="btn" href="${ytSearch(s)}" target="_blank" rel="noopener">Search on YouTube</a></p>`;

    const keys = canSeeKeys() ? `<div class="sec"><h3>Keys by song leader</h3><div class="keys">${
      LEADERS.map(l => `<div class="keybox"><b>${esc(s.keys[l] || "–")}</b><span>${esc(l)}</span></div>`).join("")}</div></div>` : "";

    $("songBody").innerHTML = `<div class="sheet">
      <div class="sheet-head"><div style="flex:1"><h2>${esc(s.title)}</h2><div class="sub">${esc(s.composer || "Composer not added yet")} · ${esc(s.category)}</div></div>
        ${isDirector() ? `<button class="btn" data-edit="${s.id}" type="button">Edit</button>` : ""}
        <button class="x" data-close type="button" aria-label="Close">✕</button></div>
      ${s.needsCheck ? `<p class="note" style="margin-top:14px">Title typed from the handwritten song list. Please double-check the spelling.</p>` : ""}
      ${s.note ? `<p class="note" style="margin-top:14px">${esc(s.note)}</p>` : ""}
      <div class="sec"><h3>Listen</h3>${listen}</div>
      ${keys}
      <div class="sec"><h3>Lyrics</h3>${s.lyrics ? `<div class="lyrics">${esc(s.lyrics)}</div>` : `<p class="muted">Lyrics not added yet.</p>`}</div>
    </div>`;
    const d = $("songDlg");
    if (!d.open) d.showModal();
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
        <button class="btn danger" id="reset" type="button">Reset to original list</button></div></div>` : ""}`}
    </div>`;
    d.showModal();
  }

  function setRole(r) { role = r; write(ROLE, r); $("roleDlg").close(); refresh(); }

  // ---------- edit ----------
  function openEdit(id) {
    const s = id ? songs.find(x => x.id === id) : { title: "", composer: "", category: "praise", youtube: "", audio: "", lyrics: "", keys: {}, note: "" };
    const d = $("editDlg");
    d.innerHTML = `<form class="sheet" id="editForm" data-id="${id || ""}">
      <div class="sheet-head"><h2>${id ? "Edit song" : "New song"}</h2><button class="x" data-close type="button" aria-label="Close">✕</button></div>
      <label>Title</label><input name="title" required value="${esc(s.title)}">
      <div class="grid2"><div><label>Composer / artist</label><input name="composer" value="${esc(s.composer)}"></div>
      <div><label>Category</label><select name="category">${CATS.slice(1).map(([v, l]) => `<option value="${v}"${s.category === v ? " selected" : ""}>${l}</option>`).join("")}</select></div></div>
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
    const data = { title: f.get("title").trim(), composer: f.get("composer").trim(), category: f.get("category"),
      youtube: f.get("youtube").trim(), audio: f.get("audio").trim(), lyrics: f.get("lyrics"), note: f.get("note").trim(), keys, needsCheck: false };
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
    const song = t.closest(".song"); if (song) return openSong(song.dataset.id);
    const cat = t.closest("[data-cat]"); if (cat) { view.cat = cat.dataset.cat; return refresh(); }
    const ed = t.closest("[data-edit]"); if (ed) { $("songDlg").close(); return openEdit(ed.dataset.edit); }
    if (t.id === "roleBtn") return openRole();
    if (t.id === "addBtn") return openEdit();
    if (t.id === "signOut") return setRole("member");
    if (t.id === "delSong") {
      const id = $("editForm").dataset.id;
      if (confirm("Delete this song for good?")) { songs = songs.filter(x => x.id !== id); save(); $("editDlg").close(); refresh(); }
    }
    if (t.id === "exp") {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([JSON.stringify(songs, null, 1)], { type: "application/json" }));
      a.download = "choir-songbook-backup.json"; a.click(); URL.revokeObjectURL(a.href);
    }
    if (t.id === "reset" && confirm("Throw away all edits on this device and go back to the original list?")) {
      songs = JSON.parse(JSON.stringify(window.SEED_SONGS)); save(); $("roleDlg").close(); refresh();
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
  });

  document.addEventListener("change", e => {
    if (e.target.id === "leaderSel") { view.leader = e.target.value; renderList(); }
    if (e.target.id === "onlyKeys") { view.onlyKeys = e.target.checked; renderList(); }
    if (e.target.id === "imp" && e.target.files[0]) {
      e.target.files[0].text().then(txt => {
        try { const s = JSON.parse(txt); if (!Array.isArray(s)) throw 0; songs = s; save(); $("roleDlg").close(); refresh(); }
        catch { alert("That file is not a songbook backup."); }
      });
    }
  });

  $("q").addEventListener("input", e => { view.q = e.target.value; renderList(); });
  ["songDlg", "roleDlg", "editDlg"].forEach(id => $(id).addEventListener("click", e => { if (e.target === e.currentTarget) e.currentTarget.close(); }));

  refresh();
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
