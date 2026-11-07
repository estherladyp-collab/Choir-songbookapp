(() => {
  const DEFAULT_CATS = ["Praise", "Worship", "Ministration", "Wedding", "Funeral", "Anointing Service", "Christmas Songs"];
  const OLD_CATS = { praise: "Praise", worship: "Worship", ministration: "Ministration" };
  const KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const LEADERS = window.LEADERS;
  const STORE = "songbook.songs.v1", CATKEY = "songbook.cats.v1", REVKEY = "songbook.seedrev.v1", SETKEY = "songbook.sets.v1", ATTKEY = "songbook.att.v1", ROLE = "songbook.role.v1", THEME = "songbook.theme.v1";
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
  let att = null;
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
  const view = { attGroup: "all", attMonth: "", tab: "songs", cat: "all", q: "", leader: LEADERS[0], onlyKeys: false };

  // older saves have one "category" per song; songs now carry a list of categories
  function normalize(list) {
    list.forEach(s => {
      if (!Array.isArray(s.categories)) s.categories = s.category ? [OLD_CATS[s.category] || s.category] : [];
      delete s.category;
    });
    return list;
  }
  // songs added to the built-in list later (seedRev 2, 3, ...) are merged into saved lists once, so deleted songs stay deleted
  function load() {
    const seed = () => JSON.parse(JSON.stringify(window.SEED_SONGS));
    const latest = Math.max(1, ...window.SEED_SONGS.map(s => s.seedRev || 1));
    let list = null;
    try { const s = JSON.parse(read(STORE)); if (Array.isArray(s) && s.length) list = s; } catch { /* fall through */ }
    if (!list) { write(REVKEY, String(latest)); return normalize(seed()); }
    const have = +read(REVKEY) || 1;
    if (have < latest) {
      seed().filter(s => (s.seedRev || 1) > have).forEach(s => {
        const mine = list.find(x => x.id === s.id);
        if (!mine) list.push(s); else {
          if (!mine.youtube && s.youtube) mine.youtube = s.youtube;
          if (s.addCategories) { normalize([mine]); s.addCategories.forEach(c => { if (!mine.categories.includes(c)) mine.categories.push(c); }); }
          if (!mine.note && s.note) mine.note = s.note;
          if (!mine.lyrics && s.lyrics) { mine.lyrics = s.lyrics; if (!mine.composer) mine.composer = s.composer; if (!mine.note) mine.note = s.note; }
        }
      });
      list.sort((x, y) => x.title.localeCompare(y.title, undefined, { sensitivity: "base" }));
      write(REVKEY, String(latest)); write(STORE, JSON.stringify(list));
    }
    return normalize(list);
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
  const lyricsSearch = s => "https://www.google.com/search?q=" + encodeURIComponent(s.title + " " + (s.composer || "") + " lyrics");
  const ytSearch = s => "https://www.youtube.com/results?search_query=" + encodeURIComponent(s.title + " " + (s.composer || "") + " worship");

  // ---------- list ----------
  function renderChrome() {
    $("cats").innerHTML = [...cats.map(c => [c, c]), ["all", "All"]]
      .map(([v, l]) => `<button class="chip${view.cat === v ? " on" : ""}" data-cat="${esc(v)}" type="button">${esc(l)}</button>`).join("");
    $("leaderbar").hidden = !canSeeKeys();
    $("leaderSel").innerHTML = LEADERS.map(l => `<option${l === view.leader ? " selected" : ""}>${esc(l)}</option>`).join("");
    $("onlyKeys").checked = view.onlyKeys;
    if (view.tab === "att" && !isDirector()) view.tab = "songs";
    $("addBtn").hidden = view.tab === "sets" ? false : view.tab === "songs" ? !isDirector() : true;
    $("addBtn").setAttribute("aria-label", view.tab === "sets" ? "New set list" : "Add song");
    document.querySelectorAll(".tab").forEach(b => b.classList.toggle("on", b.dataset.tab === view.tab));
    $("songTools").hidden = view.tab !== "songs";
    $("songsView").hidden = view.tab !== "songs";
    $("setsView").hidden = view.tab !== "sets";
    $("attTab").hidden = !isDirector();
    $("attView").hidden = view.tab !== "att";
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

  const refresh = () => { renderChrome(); renderList(); renderSets(); renderAtt(); };

  const WORSHIP = [
    { k: "Scripture", t: "This people have I formed for myself; they shall shew forth my praise.", r: "Isaiah 43:21" },
    { k: "Scripture", t: "Thou art worthy, O Lord, to receive glory and honour and power: for thou hast created all things, and for thy pleasure they are and were created.", r: "Revelation 4:11" },
    { k: "Scripture", t: "God is a Spirit: and they that worship him must worship him in spirit and in truth.", r: "John 4:24" },
    { k: "Scripture", t: "Make a joyful noise unto the LORD, all ye lands. Serve the LORD with gladness: come before his presence with singing.", r: "Psalm 100:1-2" },
    { k: "Reminder", t: "Worship is not a mood you wait for. It is a decision you make before the music even starts." },
    { k: "Scripture", t: "O come, let us worship and bow down: let us kneel before the LORD our maker.", r: "Psalm 95:6" },
    { k: "Scripture", t: "I will bless the LORD at all times: his praise shall continually be in my mouth.", r: "Psalm 34:1" },
    { k: "Reminder", t: "You were not created to impress a room. You were created to lift a name." },
    { k: "Scripture", t: "Let every thing that hath breath praise the LORD. Praise ye the LORD.", r: "Psalm 150:6" },
    { k: "Scripture", t: "By him therefore let us offer the sacrifice of praise to God continually, that is, the fruit of our lips giving thanks to his name.", r: "Hebrews 13:15" },
    { k: "Scripture", t: "But thou art holy, O thou that inhabitest the praises of Israel.", r: "Psalm 22:3" },
    { k: "Reminder", t: "A choir is not a group of voices. It is a family that learned to say the same thing to God at the same time." },
    { k: "Scripture", t: "Bless the LORD, O my soul: and all that is within me, bless his holy name.", r: "Psalm 103:1" },
    { k: "Scripture", t: "Let the word of Christ dwell in you richly in all wisdom; teaching and admonishing one another in psalms and hymns and spiritual songs, singing with grace in your hearts to the Lord.", r: "Colossians 3:16" },
    { k: "Scripture", t: "O worship the LORD in the beauty of holiness: fear before him, all the earth.", r: "Psalm 96:9" },
    { k: "Reminder", t: "Sing it like the chains are already off. Paul and Silas did, and the prison doors opened." },
    { k: "Scripture", t: "And at midnight Paul and Silas prayed, and sang praises unto God: and the prisoners heard them.", r: "Acts 16:25" },
    { k: "Scripture", t: "Because thy lovingkindness is better than life, my lips shall praise thee.", r: "Psalm 63:3" },
    { k: "Scripture", t: "O sing unto the LORD a new song; for he hath done marvellous things.", r: "Psalm 98:1" },
    { k: "Reminder", t: "Practice is where you learn the song. Worship is where you forget yourself. Do both." }
  ];
  let wIdx = Math.floor(Date.now() / 86400000) % WORSHIP.length, wTimer = null, raf = 0;
  const reduceMotion = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  function showVerse(animate) {
    const v = WORSHIP[wIdx], box = $("cvVerse");
    box.querySelector(".verse-kind").textContent = v.k;
    box.querySelector("blockquote").textContent = v.t;
    box.querySelector("cite").textContent = v.r || "";
    box.classList.remove("swap"); if (animate) { void box.offsetWidth; box.classList.add("swap"); }
  }
  function stepVerse(manual) {
    wIdx = (wIdx + 1) % WORSHIP.length; showVerse(true);
    if (manual) startRotation();
  }
  function stopRotation() { clearInterval(wTimer); wTimer = null; }
  function startRotation() { stopRotation(); if (!reduceMotion()) wTimer = setInterval(() => stepVerse(false), 9000); }

  function startDust() {
    const cv = $("dust");
    if (!cv || !cv.getContext || reduceMotion()) return;
    const ctx = cv.getContext("2d"), dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = cv.clientWidth, h = cv.clientHeight;
    cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const dots = Array.from({ length: 46 }, () => ({ x: Math.random() * w, y: Math.random() * h, r: 0.6 + Math.random() * 2, v: 0.12 + Math.random() * 0.35, p: Math.random() * 6.28 }));
    const frame = t => {
      ctx.clearRect(0, 0, w, h);
      dots.forEach(d => {
        d.y -= d.v; if (d.y < -4) { d.y = h + 4; d.x = Math.random() * w; }
        ctx.beginPath(); ctx.fillStyle = `rgba(242,212,138,${0.25 + 0.55 * Math.abs(Math.sin(t / 1200 + d.p))})`;
        ctx.arc(d.x, d.y, d.r, 0, 6.283); ctx.fill();
      });
      raf = requestAnimationFrame(frame);
    };
    cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
  }

  const setInert = on => ["header.hero", ".toolbar", "main", "#addBtn"].forEach(q => { const el = document.querySelector(q); if (el) el.inert = on; });

  function openCover() {
    const c = $("cover");
    c.hidden = false; c.classList.remove("leaving");
    setInert(true); showVerse(false); startRotation(); startDust();
    $("enterBtn").focus({ preventScroll: true });
  }
  function closeCover() {
    const c = $("cover");
    c.classList.add("leaving"); stopRotation(); setInert(false);
    setTimeout(() => { c.hidden = true; cancelAnimationFrame(raf); }, reduceMotion() ? 0 : 500);
  }

  // ---------- attendance: director only, saved on this device ----------
  const SESSION_TYPES = ["Rehearsal", "Service", "Other"];
  const MARKS = [["p", "Present", "✓"], ["e", "Excused", "E"], ["", "Absent", "–"]];
  const LATE = [[0, "On time"], [10, "+10 min"], [20, "+20 min"], [30, "+30 min"], [60, "+1 hr"]];
  const START_MEMBERS = ["Johanna", "Ella", "Anastasia", "Moses", "Avis", "Joel"];
  const sameName = (a, b) => a.toLowerCase() === b.toLowerCase();

  function loadAtt() {
    let a = null;
    try { const x = JSON.parse(read(ATTKEY)); if (x && Array.isArray(x.members) && Array.isArray(x.sessions)) a = x; } catch { /* start fresh */ }
    if (!a) a = { members: [], sessions: [] };
    if (a.v !== 2) {   // v2: leaders and members, arrival times
      const has = n => a.members.some(m => sameName(m.name, n));
      a.members.forEach(m => { if (!m.role) m.role = LEADERS.some(n => sameName(n, m.name)) ? "leader" : "member"; });
      LEADERS.forEach((n, i) => { if (!has(n)) a.members.push({ id: "m" + (i + 1), name: n, role: "leader" }); });
      START_MEMBERS.forEach((n, i) => { if (!has(n)) a.members.push({ id: "n" + (i + 1), name: n, role: "member" }); });
      a.sessions.forEach(x => { if (!x.late) x.late = {}; });
      a.v = 2; write(ATTKEY, JSON.stringify(a));
    }
    return a;
  }
  const saveAtt = () => write(ATTKEY, JSON.stringify(att));
  const todayStr = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  const roleOf = m => m.role || "member";
  const ordered = () => [...att.members.filter(m => roleOf(m) === "leader"), ...att.members.filter(m => roleOf(m) !== "leader")];
  const inGroup = m => view.attGroup === "all" || roleOf(m) === view.attGroup;
  const lateOf = (x, id) => (x.late && x.late[id]) || 0;
  const presentCount = x => att.members.filter(m => x.marks[m.id] === "p").length;
  const markWord = v => v === "p" ? "present" : v === "e" ? "excused" : "absent";
  const monthKey = d => String(d).slice(0, 7);
  const monthName = k => new Date(k + "-01T12:00:00").toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const monthKeys = () => [...new Set([...att.sessions.map(x => monthKey(x.date)), todayStr().slice(0, 7)])].sort().reverse();

  // excused absences do not count against anyone
  function attStats() {
    const sess = att.sessions.slice().sort((a, b) => a.date.localeCompare(b.date) || a.created - b.created);
    return ordered().filter(inGroup).map(m => {
      const p = sess.filter(x => x.marks[m.id] === "p").length, e = sess.filter(x => x.marks[m.id] === "e").length;
      const expected = sess.length - e;
      return { m, p, e, expected, pct: expected > 0 ? Math.round(100 * p / expected) : 0, recent: sess.slice(-8).map(x => x.marks[m.id] || "") };
    }).sort((a, b) => b.pct - a.pct || a.m.name.localeCompare(b.m.name));
  }

  function monthHtml() {
    const keys = monthKeys();
    if (!keys.includes(view.attMonth)) view.attMonth = keys[0];
    const sess = att.sessions.filter(x => monthKey(x.date) === view.attMonth);
    let P = 0, L = 0, MIN = 0, EXP = 0;
    const rows = ordered().filter(inGroup).map(m => {
      let p = 0, e = 0, a = 0, late = 0, mins = 0;
      sess.forEach(x => {
        const v = x.marks[m.id];
        if (v === "p") { p++; const l = lateOf(x, m.id); if (l > 0) { late++; mins += l; } } else if (v === "e") e++; else a++;
      });
      P += p; L += late; MIN += mins; EXP += sess.length - e;
      return { m, p, e, a, late, mins, pct: sess.length - e > 0 ? Math.round(100 * p / (sess.length - e)) : 0 };
    }).sort((x, y) => y.pct - x.pct || x.late - y.late || x.m.name.localeCompare(y.m.name));
    const tile = (n, w) => `<div class="tile"><b>${n}</b><span>${w}</span></div>`;
    const body = sess.length ? `<div class="tiles">${tile(sess.length, sess.length === 1 ? "session" : "sessions")}${tile((EXP ? Math.round(100 * P / EXP) : 0) + "%", "attendance")}${tile((P ? Math.round(100 * (P - L) / P) : 0) + "%", "on time")}${tile(MIN, "minutes late")}</div>
      <div class="scroll"><table class="mtab"><thead><tr><th scope="col">Name</th><th scope="col" title="Present">✓</th><th scope="col" title="Times late">Late</th><th scope="col" title="Minutes late in total">Min</th><th scope="col" title="Excused">E</th><th scope="col" title="Absent">–</th><th scope="col" title="Attendance">%</th></tr></thead>
      <tbody>${rows.map(r => `<tr><th scope="row">${esc(r.m.name)}${roleOf(r.m) === "leader" ? "<small>Leader</small>" : ""}</th><td>${r.p}</td><td>${r.late || ""}</td><td>${r.mins || ""}</td><td>${r.e || ""}</td><td>${r.a || ""}</td><td class="pc">${r.pct}%</td></tr>`).join("")}</tbody></table></div>
      <p class="muted" style="font-size:.82rem;margin:10px 0 0">✓ present · Late = times late · Min = minutes late in total · E excused · – absent. Excused absences do not count against the percentage.</p>`
      : `<p class="muted">No sessions in ${esc(monthName(view.attMonth))} yet.</p>`;
    return `<div class="sec"><h3>Month overview</h3><div class="mhead"><select id="attMonth" aria-label="Month">${keys.map(k => `<option value="${k}"${k === view.attMonth ? " selected" : ""}>${esc(monthName(k))}</option>`).join("")}</select></div>${body}</div>`;
  }

  function renderAtt() {
    if (!isDirector() || !att) { $("attView").innerHTML = ""; return; }
    const stats = attStats(), sess = att.sessions.slice().sort((a, b) => b.date.localeCompare(a.date) || b.created - a.created);
    const rows = stats.map(r => {
      const badge = r.expected >= 3 ? (r.pct >= 90 ? `<span class="abadge good">Always there</span>` : r.pct < 50 ? `<span class="abadge low">Often missing</span>` : "") : "";
      return `<li class="arow"><div class="an"><b>${esc(r.m.name)}</b>${badge}<span class="c">${r.p} of ${r.expected} sessions${r.e ? " · " + r.e + " excused" : ""}</span></div>
        <div class="ad" role="img" aria-label="Last ${r.recent.length}: ${r.recent.map(markWord).join(", ") || "none"}">${r.recent.map(v => `<i class="d ${v || "a"}"></i>`).join("")}</div>
        <div class="ap">${r.expected ? r.pct + "%" : "–"}</div></li>`;
    }).join("");
    const grp = [["all", "Everyone"], ["leader", "Leaders"], ["member", "Members"]];
    $("attView").innerHTML = `<div class="attbar"><button class="btn solid" data-newsess type="button">+ New rehearsal</button><button class="btn" data-members type="button">Members (${att.members.length})</button></div>
      <div class="chips" style="margin-top:14px">${grp.map(([v, l]) => `<button class="chip${view.attGroup === v ? " on" : ""}" data-agrp="${v}" type="button">${l}</button>`).join("")}</div>
      ${monthHtml()}
      ${sess.length ? `<div class="sec"><h3>All time</h3><ul class="alist">${rows}</ul><p class="muted" style="font-size:.82rem;margin:10px 0 0">The dots show the last 8 sessions: gold is present, ring is excused, grey is absent.</p></div>
      <div class="sec"><h3>Sessions</h3><ul class="list">${sess.map(x => `<li class="row"><button class="song" type="button" data-sess="${x.id}"><span class="main"><span class="t">${esc(x.label || "Rehearsal")}</span><span class="c">${esc(fmtDate(x.date))}</span></span><span class="medal">${presentCount(x)}</span></button></li>`).join("")}</ul></div>`
      : `<div class="empty">No rehearsals yet.<br>Tap "New rehearsal" and mark who is there.</div>`}`;
  }

  function openNewSession() {
    $("editDlg").innerHTML = `<form class="sheet" id="newSessForm">
      <div class="sheet-head"><h2>New rehearsal</h2><button class="x" data-close type="button" aria-label="Close">✕</button></div>
      <div class="grid2"><div><label for="nsDate">Date</label><input id="nsDate" name="date" type="date" required value="${todayStr()}"></div>
      <div><label for="nsType">Type</label><select id="nsType" name="label">${SESSION_TYPES.map(t => `<option>${t}</option>`).join("")}</select></div></div>
      <div class="actions"><button class="btn solid" type="submit">Start roll call</button></div></form>`;
    $("editDlg").showModal();
  }

  function openSession(id) {
    const x = att.sessions.find(y => y.id === id);
    if (!x) return;
    $("editDlg").innerHTML = `<form class="sheet" id="sessForm" data-sid="${x.id}">
      <div class="sheet-head"><div style="flex:1"><h2>${esc(x.label || "Rehearsal")}</h2><div class="sub" id="sessCount"></div></div><button class="x" data-close type="button" aria-label="Close">✕</button></div>
      <div class="grid2"><div><label for="sessDate">Date</label><input id="sessDate" type="date" value="${esc(x.date)}"></div>
      <div><label for="sessType">Type</label><select id="sessType">${SESSION_TYPES.map(t => `<option${t === x.label ? " selected" : ""}>${t}</option>`).join("")}</select></div></div>
      <div class="btns" style="margin:18px 0 6px"><button class="btn" id="allPresent" type="button">Mark everyone present</button></div>
      <p class="muted" style="font-size:.82rem;margin:0 0 6px">✓ present · E excused · – absent. For ✓ you can also tap when they arrived.</p>
      <ul class="roll">${ordered().map(m => { const v = x.marks[m.id] || "", l = lateOf(x, m.id); return `<li class="rr" data-mid="${m.id}">
        <div class="rtop"><span class="rn">${esc(m.name)}${roleOf(m) === "leader" ? "<small>Leader</small>" : ""}</span><div class="mk" role="group" aria-label="${esc(m.name)}">${MARKS.map(([k, w, g]) =>
          `<button type="button" class="mkb ${k || "a"}" data-mk="${k}" data-mid="${m.id}" aria-pressed="${v === k}" aria-label="${w}">${g}</button>`).join("")}</div></div>
        <div class="late" role="group" aria-label="Arrival of ${esc(m.name)}"${v === "p" ? "" : " hidden"}>${LATE.map(([n, w]) =>
          `<button type="button" class="lt" data-late="${n}" data-mid="${m.id}" aria-pressed="${l === n}">${w}</button>`).join("")}</div></li>`; }).join("")}</ul>
      <div class="actions"><button class="btn danger" id="delSess" type="button">Delete this session</button></div></form>`;
    $("editDlg").showModal();
    sessCount(x);
  }

  function sessCount(x) {
    const el = $("sessCount"), e = att.members.filter(m => x.marks[m.id] === "e").length, l = att.members.filter(m => x.marks[m.id] === "p" && lateOf(x, m.id) > 0).length;
    if (el) el.textContent = `${presentCount(x)} of ${att.members.length} present${l ? " · " + l + " late" : ""}${e ? " · " + e + " excused" : ""}`;
  }

  function syncRow(x, mid) {
    const row = document.querySelector(`.rr[data-mid="${mid}"]`), v = x.marks[mid] || "", l = lateOf(x, mid);
    if (!row) return;
    row.querySelectorAll(".mkb").forEach(b => b.setAttribute("aria-pressed", String(v === b.dataset.mk)));
    row.querySelector(".late").hidden = v !== "p";
    row.querySelectorAll(".lt").forEach(b => b.setAttribute("aria-pressed", String(l === +b.dataset.late)));
  }
  function setMark(x, mid, v) {
    if (v) x.marks[mid] = v; else delete x.marks[mid];
    if (v !== "p" && x.late) delete x.late[mid];
    saveAtt(); syncRow(x, mid); sessCount(x);
  }
  function setLate(x, mid, mins) {
    x.marks[mid] = "p"; if (!x.late) x.late = {};
    if (mins) x.late[mid] = mins; else delete x.late[mid];
    saveAtt(); syncRow(x, mid); sessCount(x);
  }

  function openMembers() {
    const lines = r => esc(att.members.filter(m => roleOf(m) === r).map(m => m.name).join("\n"));
    $("editDlg").innerHTML = `<form class="sheet" id="membersForm">
      <div class="sheet-head"><h2>Choir members</h2><button class="x" data-close type="button" aria-label="Close">✕</button></div>
      <label for="memLeaders">Leaders (one name per line)</label>
      <textarea id="memLeaders" name="leaders" style="min-height:22vh">${lines("leader")}</textarea>
      <label for="memNames">Members (one name per line)</label>
      <textarea id="memNames" name="names" style="min-height:34vh">${lines("member")}</textarea>
      <p class="muted" style="font-size:.85rem">If you remove a name, old sessions are kept but the person no longer appears in the list.</p>
      <div class="actions"><button class="btn solid" type="submit">Save</button></div></form>`;
    $("editDlg").showModal();
  }

  // ---------- set lists ----------
  const fmtDate = d => d ? new Date(d + "T12:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "";
  const setMeta = t => [t.type, fmtDate(t.date), t.leader ? "Leader: " + t.leader : ""].filter(Boolean).join(" · ");
  const songById = id => songs.find(x => x.id === id);

  function renderSets() {
    const list = sets.slice().sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.created - a.created);
    const newBtn = `<div class="newset"><button class="btn solid" data-newset type="button">+ New set list</button></div>`;
    $("setsView").innerHTML = newBtn + (list.length
      ? `<div class="count">${list.length} set ${list.length === 1 ? "list" : "lists"}</div><ul class="list">${list.map(t => `<li class="row"><button class="song" type="button" data-set="${t.id}">
          <span class="main"><span class="t">${esc(t.name)}</span><span class="c">${esc(setMeta(t))} · ${t.songIds.filter(songById).length} songs</span></span></button></li>`).join("")}</ul>`
      : `<div class="empty">No set lists yet.<br>Tap "New set list" to build one.</div>`);
  }

  const wantKeys = t => canSeeKeys() && !!t.leader && (!$("pdfKeys") || $("pdfKeys").checked);
  const waHref = t => "https://wa.me/?text=" + encodeURIComponent(setText(t, wantKeys(t)));
  const say = m => { const o = $("copyOut"); if (o) o.innerHTML = `<p class="muted">${esc(m)}</p>`; };

  function setText(t, withKeys) {
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
      <button class="btn" data-editset="${t.id}" type="button">Edit</button>
      <button class="x" data-close type="button" aria-label="Close">✕</button></div>
      ${t.note ? `<p class="note">${esc(t.note)}</p>` : ""}
      <div class="sec"><h3>Songs in this set</h3>${rows ? `<ol class="list setlist">${rows}</ol>` : `<p class="muted">No songs added yet.</p>`}</div>
      <div class="sec"><h3>Share</h3>
        ${canSeeKeys() && t.leader ? `<label class="check" style="margin-bottom:12px"><input type="checkbox" id="pdfKeys" checked> Include keys</label>` : ""}
        <div class="btns"><button class="btn solid" id="pdfSet" data-sid="${t.id}" type="button">Download PDF</button>
        <a class="btn" id="waLink" data-sid="${t.id}" href="${waHref(t)}" target="_blank" rel="noopener">WhatsApp text</a>
        <button class="btn" id="copySet" data-sid="${t.id}" type="button">Copy text</button></div>
        <div id="copyOut" role="status"></div></div></div>`;
    if (!$("setDlg").open) $("setDlg").showModal();
  }

  async function copySet(id) {
    const t = sets.find(x => x.id === id), text = setText(t, wantKeys(t)), out = $("copyOut");
    try { await navigator.clipboard.writeText(text); say("Copied. You can paste it into WhatsApp."); }
    catch {
      out.innerHTML = `<p class="muted">Select the text below and copy it.</p><textarea class="copybox" readonly></textarea>`;
      const ta = out.querySelector("textarea"); ta.value = text; ta.focus(); ta.select();
    }
  }

  // hands the PDF to the viewer: claude.ai save dialog, the phone's share sheet (WhatsApp), or a normal download
  async function deliver(blob, filename) {
    try {
      const dl = window.claude && window.claude.use ? await window.claude.use("downloads") : null;
      if (dl) { await dl.save({ filename, data: blob }); return "saved"; }
    } catch (e) { if (e && e.code === "declined") return "declined"; }
    const file = new File([blob], filename, { type: "application/pdf" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: filename }); return "shared"; }
      catch (e) { if (e && e.name === "AbortError") return "declined"; }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    return "downloaded";
  }

  async function pdfSet(id) {
    const t = sets.find(x => x.id === id);
    say("Preparing the PDF…");
    let logo = null;
    try { const r = await fetch("assets/logo-pdf.jpg"); if (r.ok) logo = new Uint8Array(await r.arrayBuffer()); } catch { /* the PDF works without the logo */ }
    const keys = wantKeys(t);
    const rows = t.songIds.map(songById).filter(Boolean).map(s => ({ title: s.title, composer: s.composer, key: keys ? s.keys[t.leader] || "" : "" }));
    const blob = window.makeSetPdf({ title: t.name, meta: setMeta(t), rows, note: t.note, logo });
    const name = (t.name + (t.date ? " " + t.date : "")).replace(/[^\w\s.-]+/g, "").trim().replace(/\s+/g, "-") || "set-list";
    const res = await deliver(blob, name + ".pdf");
    say({ saved: "PDF saved.", shared: "Shared.", downloaded: "PDF downloaded. Attach it from your files in the WhatsApp group.", declined: "Cancelled." }[res] || "Done.");
  }

  const newSet = () => openSetEdit();

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

  // ---------- lyrics: [Verse 1] / [Chorus] / [Bridge] markers on their own line split the text into labelled sections ----------
  function parseLyrics(txt) {
    const out = []; let cur = null;
    String(txt || "").split(/\r?\n/).forEach(line => {
      const m = line.match(/^\s*\[(.+?)\]\s*$/);
      if (m) { cur = { label: m[1].trim(), lines: [] }; out.push(cur); }
      else { if (!cur) { cur = { label: "", lines: [] }; out.push(cur); } cur.lines.push(line); }
    });
    return out.map(x => ({ label: x.label, text: x.lines.join("\n").trim() })).filter(x => x.label || x.text);
  }
  const lyricsHtml = txt => `<div class="lyrics">${parseLyrics(txt).map(x => `<div class="lsec">${x.label ? `<div class="llabel">${esc(x.label)}${x.text ? "" : " <em>(repeat)</em>"}</div>` : ""}${x.text ? `<div class="ltext">${esc(x.text)}</div>` : ""}</div>`).join("")}</div>`;

  // splits pasted lyrics at blank lines; blocks that repeat become the Chorus, a single block between choruses becomes the Bridge
  function autoArrange(txt) {
    const blocks = String(txt).replace(/\r/g, "").split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
    if (!blocks.length || blocks.some(b => /^\[.+\]/.test(b))) return txt;
    const norm = b => b.toLowerCase().replace(/[^a-z0-9\u00c0-\u024f ]+/g, "").replace(/\s+/g, " ").trim();
    const keys = blocks.map(norm), count = {};
    keys.forEach(k => { count[k] = (count[k] || 0) + 1; });
    const choruses = [...new Set(keys.filter(k => count[k] > 1))];
    const first = k => keys.indexOf(k), last = k => keys.lastIndexOf(k);
    const done = new Set(); let v = 0, bridge = false;
    return blocks.map((b, i) => {
      const k = keys[i], ci = choruses.indexOf(k);
      if (ci >= 0) {
        const name = choruses.length > 1 ? "Chorus " + (ci + 1) : "Chorus";
        if (done.has(k)) return `[${name}]`;
        done.add(k); return `[${name}]\n${b}`;
      }
      const between = choruses.some(c => first(c) < i && last(c) > i);
      if (between && !bridge && done.size && keys.slice(0, i).filter(x => choruses.includes(x)).length >= 2) { bridge = true; return `[Bridge]\n${b}`; }
      return `[Verse ${++v}]\n${b}`;
    }).join("\n\n");
  }

  // ---------- song sheet ----------
  function openSong(id) {
    const s = songs.find(x => x.id === id);
    if (!s) return;
    currentSong = id;
    const vid = ytId(s.youtube);
    let listen = "";
    const inPreview = !!(window.claude && window.claude.use);
    if (vid && inPreview) listen += `<div class="vidcard"><b>Video</b><span>This preview page cannot play YouTube. In the live app the video plays right here.</span></div>`;
    else if (vid) listen += `<iframe class="player" src="https://www.youtube-nocookie.com/embed/${vid}" title="${esc(s.title)}" allow="encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe>`;
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
      <div class="sec"><h3>Lyrics</h3>${isDirector() && s.lyrics ? `<div class="btns" style="margin-bottom:12px"><button class="btn sm" data-editlyr="${s.id}" type="button">Edit lyrics</button></div>` : ""}${s.lyrics ? lyricsHtml(s.lyrics) : `<p class="muted">Lyrics not added yet.</p>${isDirector() ? `<div class="btns"><button class="btn solid" data-editlyrics="${s.id}" type="button">Add lyrics</button><a class="btn" href="${lyricsSearch(s)}" target="_blank" rel="noopener">Search lyrics online</a></div>` : ""}`}</div>
    </div>`;
    const d = $("songDlg");
    if (!d.open) d.showModal();
    renderClips();
  }

  // ---------- role ----------
  function openRole(msg) {
    const d = $("roleDlg");
    d.innerHTML = `<div class="sheet"><div class="sheet-head"><h2>Who is using the book?</h2><button class="x" data-close type="button" aria-label="Close">✕</button></div>
      ${role === "member" ? `${msg ? `<p class="note">${esc(msg)}</p>` : ""}<form id="roleForm"><label for="code">Leader or Director code</label>
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
      <label for="lyr">Lyrics</label>
      <p class="muted" style="margin:0 0 8px;font-size:.85rem">Only add lyrics your choir may use, for example under your church license. Tap Auto-arrange to split them into Verse, Chorus and Bridge, or type [Verse 1], [Chorus] or [Bridge] on its own line.</p>
      <textarea id="lyr" name="lyrics">${esc(s.lyrics)}</textarea>
      <div class="btns" style="margin-top:10px"><button class="btn" id="arrange" type="button">Auto-arrange</button></div>
      <div class="actions"><button class="btn solid" type="submit">Save</button>
      ${id ? `<button class="btn danger" id="delSong" type="button">Delete</button>` : ""}</div></form>`;
    d.showModal();
  }

  // lyrics only: a focused editor for changing a line the way the choir sings it
  function openLyricsEdit(id) {
    const s = songs.find(x => x.id === id), d = $("editDlg");
    d.innerHTML = `<form class="sheet" id="lyrForm" data-id="${id}">
      <div class="sheet-head"><div style="flex:1"><h2>Edit lyrics</h2><div class="sub">${esc(s.title)}</div></div><button class="x" data-close type="button" aria-label="Close">✕</button></div>
      <p class="muted" style="margin:18px 0 6px;font-size:.88rem">Change any line the way your choir sings it. Lines like [Verse 1] or [Chorus] are the section labels.</p>
      <label for="lyr">Lyrics</label>
      <textarea id="lyr" name="lyrics" style="min-height:52vh">${esc(s.lyrics)}</textarea>
      <div class="actions"><button class="btn solid" type="submit">Save lyrics</button><button class="btn" id="arrange" type="button">Auto-arrange</button></div></form>`;
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
    if (t.closest("[data-newsess]")) return openNewSession();
    if (t.closest("[data-members]")) return openMembers();
    const ss = t.closest("[data-sess]"); if (ss) return openSession(ss.dataset.sess);
    const ag = t.closest("[data-agrp]"); if (ag) { view.attGroup = ag.dataset.agrp; return renderAtt(); }
    const lt = t.closest("[data-late]");
    if (lt) { const x = att.sessions.find(y => y.id === lt.closest("form").dataset.sid); return setLate(x, lt.dataset.mid, +lt.dataset.late); }
    const mk = t.closest("[data-mk]");
    if (mk) { const x = att.sessions.find(y => y.id === mk.closest("form").dataset.sid); return setMark(x, mk.dataset.mid, mk.dataset.mk); }
    if (t.id === "allPresent") { const x = att.sessions.find(y => y.id === $("sessForm").dataset.sid); att.members.forEach(m => setMark(x, m.id, "p")); return; }
    if (t.id === "delSess") {
      if (!t.dataset.sure) { t.dataset.sure = "1"; t.textContent = "Tap again to delete"; return; }
      const id = $("sessForm").dataset.sid; att.sessions = att.sessions.filter(y => y.id !== id); saveAtt(); $("editDlg").close(); return;
    }
    const tab = t.closest("[data-tab]"); if (tab) { view.tab = tab.dataset.tab; return refresh(); }
    const st = t.closest("[data-set]"); if (st && st.id !== "copySet") return openSet(st.dataset.set);
    if (t.closest("#copySet")) return copySet(t.closest("#copySet").dataset.sid);
    if (t.closest("#pdfSet")) return pdfSet(t.closest("#pdfSet").dataset.sid);
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
    const el2 = t.closest("[data-editlyr]"); if (el2) return openLyricsEdit(el2.dataset.editlyr);
    const el = t.closest("[data-editlyrics]");
    if (el) { $("songDlg").close(); openEdit(el.dataset.editlyrics); const ta = $("lyr"); ta.scrollIntoView({ block: "center" }); ta.focus(); return; }
    const ed = t.closest("[data-edit]"); if (ed) { $("songDlg").close(); return openEdit(ed.dataset.edit); }
    if (t.closest("#themeBtn")) return cycleTheme();
    if (t.id === "arrange") { const ta = $("lyr"); ta.value = autoArrange(ta.value); return; }
    if (t.id === "recBtn") return toggleRec();
    const dc = t.closest("[data-delclip]");
    if (dc) { if (dc.dataset.sure) delClip(dc.dataset.delclip).then(renderClips); else { dc.dataset.sure = "1"; dc.textContent = "Tap again to delete"; } return; }
    if (t.id === "roleBtn") return openRole();
    if (t.id === "addBtn") return view.tab === "sets" ? newSet() : openEdit();
    if (t.closest("[data-newset]")) return newSet();
    if (t.closest("[data-cover]")) return openCover();
    if (t.closest("#enterBtn")) return closeCover();
    if (t.closest("#cvVerse")) return stepVerse(true);
    if (t.id === "signOut") return setRole("member");
    if (t.id === "delSong") {
      if (!t.dataset.sure) { t.dataset.sure = "1"; t.textContent = "Tap again to delete for good"; return; }
      const id = $("editForm").dataset.id;
      songs = songs.filter(x => x.id !== id); sets.forEach(t => { t.songIds = t.songIds.filter(x => x !== id); }); save(); $("editDlg").close(); refresh();
      allClips().then(cl => Promise.all(cl.filter(c => c.songId === id).map(c => delClip(c.id)))).catch(() => {});
    }
    if (t.id === "exp") {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([JSON.stringify({ songs, sets, cats, attendance: att }, null, 1)], { type: "application/json" }));
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
      const c = $("code").value.trim().toLowerCase(), same = k => c === String(k).toLowerCase();
      if (same(window.CONFIG.DIRECTOR_CODE)) setRole("director");
      else if (same(window.CONFIG.LEADER_CODE)) setRole("leader");
      else $("roleMsg").textContent = "That code is not right.";
    }
    if (e.target.id === "editForm") saveEdit(e.target);
    if (e.target.id === "setForm") saveSet(e.target);
    if (e.target.id === "newSessForm") {
      const f = new FormData(e.target), x = { id: "a" + Date.now().toString(36), date: f.get("date"), label: f.get("label"), marks: {}, late: {}, created: Date.now() };
      att.sessions.push(x); saveAtt(); renderAtt(); openSession(x.id);
    }
    if (e.target.id === "membersForm") {
      const f = new FormData(e.target), seen = [], list = [];
      [["leader", f.get("leaders")], ["member", f.get("names")]].forEach(([role, txt]) => txt.split("\n").map(n => n.trim()).filter(Boolean).forEach(n => {
        if (seen.some(k => sameName(k, n))) return;
        seen.push(n);
        const old = att.members.find(m => sameName(m.name, n));
        list.push({ id: old ? old.id : "m" + Date.now().toString(36) + list.length, name: n, role });
      }));
      att.members = list; saveAtt(); $("editDlg").close();
    }
    if (e.target.id === "lyrForm") {
      const id = e.target.dataset.id, song = songs.find(x => x.id === id);
      song.lyrics = e.target.elements.lyrics.value.trim(); save(); $("editDlg").close(); refresh(); openSong(id);
    }
  });

  document.addEventListener("change", e => {
    if (e.target.id === "clipFile" && e.target.files.length) { uploadFiles([...e.target.files]); e.target.value = ""; }
    if (e.target.id === "sessDate" || e.target.id === "sessType") {
      const x = att.sessions.find(y => y.id === $("sessForm").dataset.sid);
      if (e.target.id === "sessDate" && e.target.value) x.date = e.target.value; else if (e.target.id === "sessType") x.label = e.target.value;
      saveAtt();
    }
    if (e.target.id === "attMonth") { view.attMonth = e.target.value; renderAtt(); }
    if (e.target.id === "pickCat") renderPick();
    if (e.target.id === "pdfKeys") { const a = $("waLink"); a.href = waHref(sets.find(x => x.id === a.dataset.sid)); }
    if (e.target.id === "leaderSel") { view.leader = e.target.value; renderList(); }
    if (e.target.id === "onlyKeys") { view.onlyKeys = e.target.checked; renderList(); }
    if (e.target.id === "imp" && e.target.files[0]) {
      e.target.files[0].text().then(txt => {
        try {
          const raw = JSON.parse(txt), s = Array.isArray(raw) ? raw : raw.songs;
          if (!Array.isArray(s)) throw 0;
          songs = normalize(s); if (raw.sets) sets = raw.sets; if (raw.attendance && Array.isArray(raw.attendance.members)) { att = raw.attendance; saveAtt(); } if (raw.cats) write(CATKEY, JSON.stringify(raw.cats)); cats = loadCats(); save(); $("roleDlg").close(); refresh();
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
  $("editDlg").addEventListener("close", () => renderAtt());
  ["songDlg", "setDlg", "roleDlg", "editDlg"].forEach(id => $(id).addEventListener("click", e => { if (e.target === e.currentTarget) e.currentTarget.close(); }));

  att = loadAtt();
  applyTheme();
  refresh();
  openCover();
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
