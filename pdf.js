// Minimal PDF writer for set lists: A4, built-in Times/Helvetica fonts, one embedded JPEG logo. No dependencies, works offline.
(() => {
  const W = 595.28, H = 841.89, M = 48;
  const NAVY = "0.039 0.063 0.188", GOLD = "0.788 0.604 0.180", GRAY = "0.45 0.47 0.55", INK = "0.05 0.08 0.2", WHITE = "1 1 1";
  const WIN = { "–": 0x96, "—": 0x97, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "…": 0x85, "•": 0x95, "€": 0x80 };
  const HB = { A: 722, B: 722, C: 722, D: 722, E: 667, F: 611, G: 778, "#": 556, b: 611 };
  const f = n => n.toFixed(2);
  const u8 = s => { const a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i) & 255; return a; };
  const enc = s => {
    let o = "";
    for (const ch of String(s).replace(/[\r\n\t]+/g, " ")) {
      let c = WIN[ch] ?? ch.charCodeAt(0);
      if (c > 255) c = 63;
      o += (c === 40 || c === 41 || c === 92) ? "\\" + String.fromCharCode(c) : String.fromCharCode(c);
    }
    return o;
  };
  const text = (font, size, x, y, color, s) => `BT /${font} ${size} Tf ${color} rg ${f(x)} ${f(y)} Td (${enc(s)}) Tj ET\n`;
  const rect = (x, y, w, h, color) => `${color} rg ${f(x)} ${f(y)} ${f(w)} ${f(h)} re f\n`;
  const hair = (y, color) => `${color} RG 0.5 w ${f(M)} ${f(y)} m ${f(W - M)} ${f(y)} l S\n`;
  const circle = (cx, cy, r, color) => {
    const k = 0.5523 * r;
    return `${color} rg ${f(cx + r)} ${f(cy)} m ${f(cx + r)} ${f(cy + k)} ${f(cx + k)} ${f(cy + r)} ${f(cx)} ${f(cy + r)} c ` +
      `${f(cx - k)} ${f(cy + r)} ${f(cx - r)} ${f(cy + k)} ${f(cx - r)} ${f(cy)} c ${f(cx - r)} ${f(cy - k)} ${f(cx - k)} ${f(cy - r)} ${f(cx)} ${f(cy - r)} c ` +
      `${f(cx + k)} ${f(cy - r)} ${f(cx + r)} ${f(cy - k)} ${f(cx + r)} ${f(cy)} c f\n`;
  };
  const wrap = (s, max) => {
    const out = []; let line = "";
    String(s).split(/\s+/).forEach(w => { if ((line + " " + w).trim().length > max && line) { out.push(line); line = w; } else line = (line + " " + w).trim(); });
    if (line) out.push(line);
    return out.length ? out : [""];
  };
  const keyWidth = (k, size) => [...k].reduce((a, c) => a + (HB[c] || 600), 0) / 1000 * size;
  function jpegSize(b) {
    for (let i = 2; i < b.length - 9;) {
      if (b[i] !== 0xFF) { i++; continue; }
      const m = b[i + 1];
      if (m >= 0xC0 && m <= 0xC3) return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8] };
      i += 2 + ((b[i + 2] << 8) | b[i + 3]);
    }
    return null;
  }

  function layout(opts) {
    const pages = []; let cur = "", y = 0, first = true;
    const startPage = () => {
      if (cur) pages.push(cur);
      cur = ""; first = pages.length === 0;
      if (first) {
        cur += rect(0, H - 132, W, 132, NAVY);
        if (opts.logo) cur += `q 78 0 0 78 ${M} ${f(H - 105)} cm /Im1 Do Q\n`;
        const tx = opts.logo ? M + 96 : M;
        const lines = wrap(opts.title, opts.logo ? 30 : 38).slice(0, 2);
        lines.forEach((l, i) => { cur += text("F2", 24, tx, H - 58 - i * 28, WHITE, l); });
        cur += text("F4", 10, tx, H - 58 - lines.length * 28 + 6, GOLD, opts.meta);
        y = H - 168;
      } else {
        cur += text("F3", 11, M, H - 44, GRAY, opts.title) + hair(H - 52, GOLD);
        y = H - 84;
      }
    };
    startPage();
    opts.rows.forEach((r, i) => {
      const lines = wrap(r.title, 46), h = lines.length * 19 + (r.composer ? 14 : 4) + 14;
      if (y - h < 70) startPage();
      cur += text("F2", 16, M, y, GOLD, String(i + 1));
      lines.forEach((l, j) => { cur += text("F1", 16, M + 34, y - j * 19, INK, l); });
      if (r.composer) cur += text("F4", 9, M + 34, y - lines.length * 19 + 4, GRAY, r.composer);
      if (r.key) {
        const cx = W - M - 16, cy = y + 5;
        cur += circle(cx, cy, 13, GOLD) + text("F5", 11, cx - keyWidth(r.key, 11) / 2, cy - 3.8, NAVY, r.key);
      }
      cur += hair(y - (lines.length - 1) * 19 - (r.composer ? 17 : 6) - 9, "0.86 0.87 0.92"); y -= h;
    });
    if (opts.note) {
      if (y < 110) startPage();
      wrap(opts.note, 80).forEach((l, i) => { cur += text("F3", 11, M, y - 14 - i * 15, GRAY, l); });
    }
    pages.push(cur);
    return pages;
  }

  window.makeSetPdf = function (opts) {
    const pages = layout(opts), total = pages.length;
    const img = opts.logo && jpegSize(opts.logo) ? opts.logo : null;
    const objs = [];
    objs.push(["<< /Type /Catalog /Pages 2 0 R >>"]);
    const kids = []; const firstPage = img ? 9 : 8;
    pages.forEach((_, i) => kids.push(`${firstPage + i * 2 + 1} 0 R`));
    objs.push([`<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${total} >>`]);
    ["Times-Roman", "Times-Bold", "Times-Italic", "Helvetica", "Helvetica-Bold"].forEach(n =>
      objs.push([`<< /Type /Font /Subtype /Type1 /BaseFont /${n} /Encoding /WinAnsiEncoding >>`]));
    if (img) { const s = jpegSize(img); objs.push([`<< /Type /XObject /Subtype /Image /Width ${s.w} /Height ${s.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.length} >>\nstream\n`, img, "\nendstream"]); }
    pages.forEach((p, i) => {
      const body = p + text("F4", 8, M, 30, GRAY, `Victory Outreach Ministry International  ·  Choir Songbook  ·  Page ${i + 1} of ${total}`);
      const c = objs.length + 1;
      objs.push([`<< /Length ${body.length} >>\nstream\n${body}\nendstream`]);
      objs.push([`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R /F4 6 0 R /F5 7 0 R >>${img ? " /XObject << /Im1 8 0 R >>" : ""} >> /Contents ${c} 0 R >>`]);
    });
    const chunks = [], offs = []; let pos = 0;
    const push = p => { const a = typeof p === "string" ? u8(p) : p; chunks.push(a); pos += a.length; };
    push("%PDF-1.4\n");
    objs.forEach((parts, i) => { offs.push(pos); push(`${i + 1} 0 obj\n`); parts.forEach(push); push("\nendobj\n"); });
    const xref = pos;
    push(`xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`);
    offs.forEach(o => push(String(o).padStart(10, "0") + " 00000 n \n"));
    push(`trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
    return new Blob(chunks, { type: "application/pdf" });
  };
})();
