/* Dashboard Pelaporan Mingguan SDP – versi GitHub Pages + Google Apps Script */
'use strict';
const SDP = {
  url: (window.SDP_CONFIG && window.SDP_CONFIG.SCRIPT_URL) || '',
  kod: () => { try { return localStorage.getItem('sdp-kod') || ''; } catch (e) { return SDP._kod || ''; } },
  simpanKod: (k) => { SDP._kod = k; try { localStorage.setItem('sdp-kod', k); } catch (e) { /* abaikan */ } },
  buangKod: () => { SDP._kod = ''; try { localStorage.removeItem('sdp-kod'); } catch (e) { /* abaikan */ } }
};

// Lapisan kecil yang menguruskan data, kiraan dan lukisan halaman.
const dash = (() => {
  const calcs = {}, draws = {}, onDatas = [];
  const base = { laporan: { status: 'loading', data: [] }, entri: { status: 'ok', data: [] } };
  let cache = {};
  function data(id) {
    if (base[id]) return base[id];
    if (cache[id]) return cache[id];
    const c = calcs[id];
    if (!c) return { status: 'missing', data: [] };
    const ins = c.inputs.map(data);
    const tak = ins.find((x) => x.status !== 'ok');
    if (tak) return { status: tak.status, data: null };
    try { cache[id] = { status: 'ok', data: c.fn(...ins.map((x) => x.data)) }; }
    catch (e) { console.error(id, e); cache[id] = { status: 'error', data: null, message: String(e) }; }
    return cache[id];
  }
  function lukis(n) { document.querySelectorAll(`[data-draw="${n}"]`).forEach((el) => { try { draws[n](el); } catch (e) { console.error(n, e); } }); }
  return {
    calc: (id, o) => { calcs[id] = o; },
    data,
    colors: ['#2E75B6', '#0F766E', '#7C3AED'],
    onData: (f) => { onDatas.push(f); },
    draw: (n, fn) => { if (fn) draws[n] = fn; else if (draws[n]) lukis(n); },
    set: (id, v) => { base[id] = v; cache = {}; },
    runAll: () => { cache = {}; onDatas.forEach((f) => { try { f(); } catch (e) { console.error(e); } }); Object.keys(draws).forEach(lukis); }
  };
})();

// ---------- Kiraan (calc) ----------
dash.calc('gabung', {
  title: 'Laporan mingguan (fail Excel + borang)',
  description: 'Isi daripada fail Excel; jika laporan minggu itu ditulis melalui borang, isi borang digunakan.',
  inputs: ['laporan', 'entri'],
  fn: (laporan, entri) => {
    const e = new Map(entri.map((r) => [String(r.kunci || r.id), r]));
    return laporan.map((r) => {
      const b = e.get(r.kunci);
      if (!b || typeof b.teks !== 'string') return { ...r, sumber: r.sumber || 'Fail Excel', dikemaskini: r.dikemaskini || '' };
      const ada = b.teks.replace(/^\s*\d+[.)]?\s*$/gm, '').trim() !== '';
      return { ...r, teks: ada ? b.teks.trim() : '', isi: ada ? 'ada' : 'kosong', sumber: 'Borang', dikemaskini: b.dikemaskini || '' };
    });
  }
});

dash.calc('status', {
  title: 'Status laporan setiap pegawai setiap minggu',
  description: 'Status setiap minggu berdasarkan isi laporan (fail Excel atau borang) dan tarikh hari ini (waktu Malaysia).',
  inputs: ['gabung'],
  fn: (laporan) => {
    const kini = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' });
    let semasa = 0;
    laporan.forEach((r) => { if (r.mula <= kini && r.idx > semasa) semasa = r.idx; });
    return laporan.map((r) => {
      let status;
      if (!r.aktif) status = 'Belum bertugas';
      else if (r.idx > semasa) status = r.isi === 'ada' ? 'Diisi awal' : 'Akan datang';
      else status = r.isi === 'ada' ? 'Dihantar' : 'Belum dihantar';
      return {
        kunci: r.kunci, bil: r.bil, nama: r.nama, jawatan: r.jawatan, idx: r.idx,
        bulan: r.bulan, minggu: r.minggu, tarikh: r.tarikh, status,
        semasa: r.idx === semasa, wajib: r.aktif && r.idx <= semasa,
        palsu: r.tandaRumusan && r.isi !== 'ada', sumber: r.sumber, aktif: r.aktif
      };
    });
  }
});

dash.calc('pegawai', {
  title: 'Kadar penghantaran setiap pegawai',
  description: 'Laporan dihantar dibahagi minggu wajib bagi setiap pegawai.',
  inputs: ['status'],
  fn: (status) => {
    const m = new Map();
    status.forEach((s) => {
      if (!m.has(s.bil)) m.set(s.bil, { bil: s.bil, nama: s.nama, jawatan: s.jawatan, wajib: 0, dihantar: 0, belum: [] });
      const p = m.get(s.bil);
      if (s.wajib) { p.wajib++; if (s.status === 'Dihantar') p.dihantar++; else p.belum.push(s.bulan + ' ' + s.minggu); }
    });
    return [...m.values()].map((p) => ({
      bil: p.bil, nama: p.nama, jawatan: p.jawatan, wajib: p.wajib, dihantar: p.dihantar,
      kadar: p.wajib ? Math.round((p.dihantar / p.wajib) * 1000) / 10 : null,
      mingguBelum: p.belum.join(', ')
    }));
  }
});

dash.calc('minggu', {
  title: 'Kadar penghantaran setiap minggu',
  description: 'Bilangan pegawai bertugas yang telah menghantar laporan bagi setiap minggu.',
  inputs: ['status'],
  fn: (status) => {
    const m = new Map();
    status.forEach((s) => {
      if (!m.has(s.idx)) m.set(s.idx, { idx: s.idx, bulan: s.bulan, minggu: s.minggu, tarikh: s.tarikh, bertugas: 0, dihantar: 0, lepas: false, semasa: false });
      const w = m.get(s.idx);
      if (s.status !== 'Belum bertugas') w.bertugas++;
      if (s.status === 'Dihantar' || s.status === 'Diisi awal') w.dihantar++;
      if (s.wajib) w.lepas = true;
      if (s.semasa) w.semasa = true;
    });
    return [...m.values()].sort((a, b) => a.idx - b.idx).map((w) => ({
      ...w, kadar: w.bertugas ? Math.round((w.dihantar / w.bertugas) * 1000) / 10 : 0
    }));
  }
});

dash.calc('bulan', {
  title: 'Pencapaian setiap bulan',
  description: 'Laporan dihantar berbanding laporan wajib bagi minggu yang sudah bermula dalam setiap bulan.',
  inputs: ['status'],
  fn: (status) => {
    const m = new Map();
    status.forEach((s) => {
      if (!m.has(s.bulan)) m.set(s.bulan, { bulan: s.bulan, mulaIdx: s.idx, minggu: new Set(), mingguLepas: new Set(), wajib: 0, dihantar: 0, semasa: false });
      const b = m.get(s.bulan);
      b.mulaIdx = Math.min(b.mulaIdx, s.idx); b.minggu.add(s.idx);
      if (s.wajib) { b.wajib++; b.mingguLepas.add(s.idx); if (s.status === 'Dihantar') b.dihantar++; }
      if (s.semasa) b.semasa = true;
    });
    return [...m.values()].sort((a, b) => a.mulaIdx - b.mulaIdx).map((b) => ({
      bulan: b.bulan, bilMinggu: b.minggu.size, mingguBermula: b.mingguLepas.size, wajib: b.wajib, dihantar: b.dihantar,
      kadar: b.wajib ? Math.round((b.dihantar / b.wajib) * 1000) / 10 : null, semasa: b.semasa
    }));
  }
});

dash.calc('kpi', {
  title: 'Ringkasan keseluruhan',
  description: 'Jumlah laporan wajib, laporan dihantar, status minggu semasa dan minggu lengkap.',
  inputs: ['status'],
  fn: (status) => {
    const wajib = status.filter((s) => s.wajib);
    const dihantar = wajib.filter((s) => s.status === 'Dihantar').length;
    const cur = status.filter((s) => s.semasa && s.status !== 'Belum bertugas');
    const dihantarSemasa = cur.filter((s) => s.status === 'Dihantar').length;
    const c0 = status.find((s) => s.semasa);
    const ikutMinggu = new Map();
    wajib.forEach((s) => { const w = ikutMinggu.get(s.idx) || { n: 0, h: 0 }; w.n++; if (s.status === 'Dihantar') w.h++; ikutMinggu.set(s.idx, w); });
    return [{
      wajib: wajib.length, dihantar,
      kadar: wajib.length ? Math.round((dihantar / wajib.length) * 1000) / 10 : null,
      mingguSemasa: c0 ? c0.bulan + ' ' + c0.minggu : '',
      tarikhSemasa: c0 ? c0.tarikh : '',
      aktifSemasa: cur.length, dihantarSemasa, belumSemasa: cur.length - dihantarSemasa,
      mingguLepas: ikutMinggu.size, mingguLengkap: [...ikutMinggu.values()].filter((w) => w.h === w.n).length,
      tandaPalsu: status.filter((s) => s.palsu).length
    }];
  }
});

// ---------- Keadaan halaman dan pembantu ----------
const LP = (window.LP = window.LP || { bulan: '', nama: '', kata: '', bil: null, idx: null, anim: {} });
const GERAK = window.matchMedia && window.matchMedia('(prefers-reduced-motion: no-preference)').matches;
const AV_WARNA = ['#1F4E79', '#0F766E', '#7C3AED', '#C2410C', '#BE185D', '#15803D', '#4338CA', '#A16207', '#0369A1', '#9F1239'];
const pendek = (n) => n.split(/\s+(BINTI|BIN|A\/L|AK)\s+/)[0];
const cls = (s) => s.replace(/\s+/g, '-');
const fmtPct = (v) => (v == null ? '—' : (Math.round(v * 10) / 10).toLocaleString('ms-MY') + '%');
function inisial(nama) {
  const w = pendek(nama).replace(/^(PN\.|PUAN|CIK\.?|EN\.|ENCIK|DR\.|DATIN)\s+/i, '').split(/\s+/).filter((x) => /^[A-Z]/i.test(x));
  return (w[1] ? w[0][0] + w[1][0] : (w[0] || '?').slice(0, 2)).toUpperCase();
}
// Avatar ilustrasi: wanita korporat bertudung dan berblazer; pegawai lelaki berblazer dan bertali leher.
const TUDUNG = ['#C2185B', '#7B1FA2', '#00897B', '#EF6C00', '#6D4C41', '#1565C0', '#AD1457', '#00695C', '#5E35B1', '#D84315', '#2E7D32', '#0277BD'];
const BLAZER = ['#1F2A44', '#2F3E46', '#3B2F4A', '#243B55', '#3E3A36', '#1B3A4B', '#4A3B32', '#2C2C54'];
const KULIT = ['#F2C9A8', '#E9B892', '#DDA780', '#CF9670'];
const lelaki = (n) => /^(EN\.|ENCIK)\s/i.test(n) || /\s(BIN|A\/L)\s/.test(n);
function avatarMarkup(nama, bil) {
  const i = Math.max(0, bil - 1);
  const t = TUDUNG[i % TUDUNG.length], bz = BLAZER[(i * 3) % BLAZER.length], k = KULIT[(i * 7) % KULIT.length];
  const bg = `color-mix(in srgb, ${t} 20%, #ffffff)`;
  const muka = '<circle cx="28.3" cy="30.5" r="1.3" fill="#2B1D16"/><circle cx="35.7" cy="30.5" r="1.3" fill="#2B1D16"/>'
    + '<path d="M28.8 35.6 Q32 38.2 35.2 35.6" fill="none" stroke="#8A4B3A" stroke-width="1.4" stroke-linecap="round"/>'
    + '<circle cx="25.8" cy="34" r="1.9" fill="#E88F8F" opacity=".35"/><circle cx="38.2" cy="34" r="1.9" fill="#E88F8F" opacity=".35"/>';
  const badan = `<path d="M5 66 C7 52 18 46 32 46 C46 46 57 52 59 66 Z" fill="${bz}"/>`
    + '<path d="M25 46 L30.5 55 L26.5 66 L17.5 50 Z M39 46 L33.5 55 L37.5 66 L46.5 50 Z" fill="rgba(0,0,0,.22)"/>';
  if (lelaki(nama)) {
    return `<rect width="64" height="64" fill="${bg}"/>` + badan
      + '<path d="M26 46 L32 59 L38 46 Z" fill="#F4F6F8"/>'
      + `<path d="M30.6 48 L33.4 48 L34.4 57.5 L32 60.5 L29.6 57.5 Z" fill="${t}"/>`
      + `<rect x="28" y="38" width="8" height="9" rx="3" fill="${k}"/><ellipse cx="21.6" cy="30" rx="2" ry="3" fill="${k}"/><ellipse cx="42.4" cy="30" rx="2" ry="3" fill="${k}"/>`
      + `<ellipse cx="32" cy="29.5" rx="10" ry="11.5" fill="${k}"/>`
      + '<path d="M21.6 27.5 C21 16 27 13.5 32 13.5 C38 13.5 43 16.5 42.4 27.5 C41 21.8 37.5 19.6 32 19.6 C27 19.6 23 21.8 21.6 27.5 Z" fill="#2B2420"/>' + muka;
  }
  return `<rect width="64" height="64" fill="${bg}"/>` + badan
    + `<path d="M16.5 30 C16.5 15.5 24 9.5 32 9.5 C40 9.5 47.5 15.5 47.5 30 C47.5 41 43 48.5 36.5 52.5 L32 56 L27.5 52.5 C21 48.5 16.5 41 16.5 30 Z" fill="${t}"/>`
    + '<path d="M26.5 47.5 Q32 51.5 37.5 47.5" fill="none" stroke="rgba(0,0,0,.18)" stroke-width="1.2"/>'
    + `<ellipse cx="32" cy="30.8" rx="9.8" ry="11.3" fill="${k}"/>`
    + `<path d="M21.8 28.5 C22.3 21 26.5 18.2 32 18.2 C37.5 18.2 41.7 21 42.2 28.5 C40.2 23.8 36.6 21.8 32 21.8 C27.4 21.8 23.8 23.8 21.8 28.5 Z" fill="${t}"/>`
    + '<path d="M22.2 27 C23.5 21.5 27 19.2 32 19.2 C37 19.2 40.5 21.5 41.8 27" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1"/>' + muka;
}
function avatar(nama, bil, extra) {
  const a = document.createElement('span'); a.className = 'lp-av' + (extra ? ' ' + extra : ''); a.setAttribute('aria-hidden', 'true');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 64 64'); svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%');
  svg.innerHTML = avatarMarkup(nama, bil);
  a.appendChild(svg);
  return a;
}
function sedia(el, ids, blank) {
  const st = ids.map((id) => dash.data(id).status);
  if (st.includes('error')) { el.classList.remove('dash-skeleton'); el.textContent = 'Data tidak dapat dimuatkan.'; return false; }
  if (st.some((s) => s !== 'ok')) {
    if (st.includes('loading')) { el.replaceChildren(); el.classList.add('dash-skeleton'); }
    else { el.classList.remove('dash-skeleton'); el.textContent = blank ? '' : '—'; }
    return false;
  }
  el.classList.remove('dash-skeleton');
  return true;
}
const kpi = () => dash.data('kpi').data[0];
function teks(name, fn) { dash.draw(name, (el) => { if (!sedia(el, ['kpi'])) return; el.textContent = fn(); }); }
function pilih(bil, idx, skrol) {
  LP.bil = bil; LP.idx = idx;
  ['pilihPegawai', 'pilihMinggu', 'jalurMinggu', 'viewMeta', 'viewTeks', 'heatmap'].forEach((n) => dash.draw(n));
  if (skrol) { const t = document.getElementById('baca-laporan'); if (t) t.scrollIntoView({ behavior: GERAK ? 'smooth' : 'auto', block: 'start' }); }
}
function lalai() {
  const s = dash.data('status');
  if (s.status !== 'ok' || !s.data.length) return;
  if (LP.bil == null) LP.bil = s.data[0].bil;
  if (LP.idx == null) { const c = s.data.find((r) => r.semasa); LP.idx = c ? c.idx : 1; }
}
function tip(host) {
  const t = document.createElement('div'); t.className = 'lp-tip'; t.hidden = true; host.appendChild(t);
  return {
    show(ev, lines) {
      t.replaceChildren();
      lines.forEach((l, i) => { const d = document.createElement('div'); if (i === 0) { const b = document.createElement('b'); b.textContent = l; d.appendChild(b); } else { d.className = 'lp-tsub'; d.textContent = l; } t.appendChild(d); });
      t.hidden = false;
      const r = host.getBoundingClientRect();
      let x = ev.clientX - r.left + host.scrollLeft + 14, y = ev.clientY - r.top + host.scrollTop + 14;
      const w = t.offsetWidth, h = t.offsetHeight;
      if (x + w > host.scrollLeft + host.clientWidth) x = Math.max(host.scrollLeft, ev.clientX - r.left + host.scrollLeft - w - 14);
      if (y + h > host.scrollHeight) y = Math.max(0, ev.clientY - r.top + host.scrollTop - h - 14);
      t.style.left = x + 'px'; t.style.top = y + 'px';
    },
    hide() { t.hidden = true; }
  };
}
function cincin(svgSel, r, tebal, nilai, warna, jejak, kunci) {
  const arc = d3.arc().innerRadius(r - tebal).outerRadius(r).cornerRadius(tebal / 2).startAngle(0);
  svgSel.append('path').attr('d', arc({ endAngle: 2 * Math.PI })).style('fill', jejak);
  const akhir = 2 * Math.PI * Math.max(0, Math.min(100, nilai || 0)) / 100;
  const p = svgSel.append('path').style('fill', warna);
  if (GERAK && !LP.anim[kunci]) {
    LP.anim[kunci] = true;
    p.attr('d', arc({ endAngle: 0 })).transition().duration(1100).ease(d3.easeCubicOut)
      .attrTween('d', () => { const i = d3.interpolate(0, akhir); return (t) => arc({ endAngle: i(t) }); });
  } else p.attr('d', arc({ endAngle: akhir }));
}
const warnaKadar = (k) => (k == null ? 'var(--color-border-line)' : k >= 100 ? 'var(--color-ok)' : k >= 90 ? '#2E75B6' : k >= 80 ? '#F5B942' : 'var(--color-bad)');

// ---------- Hero ----------
teks('semasaLabel', () => kpi().mingguSemasa);
teks('kadarAyat', () => fmtPct(kpi().kadar));
teks('semasaHantar', () => String(kpi().dihantarSemasa));
teks('semasaAktif', () => String(kpi().aktifSemasa));
dash.draw('heroRing', (el) => {
  if (!sedia(el, ['kpi'])) return;
  const k = kpi(); el.replaceChildren();
  const S = 190;
  const svg = d3.select(el).append('svg').attr('width', S).attr('height', S).attr('viewBox', `0 0 ${S} ${S}`)
    .attr('role', 'img').attr('aria-label', `Kadar penghantaran keseluruhan ${fmtPct(k.kadar)}`);
  cincin(svg.append('g').attr('transform', `translate(${S / 2},${S / 2})`), 90, 16, k.kadar, '#6EE7A8', 'rgba(255,255,255,.16)', 'hero');
  const c = document.createElement('div'); c.className = 'lp-ring-c';
  const inner = document.createElement('div');
  const b = document.createElement('b'); b.setAttribute('data-source', 'kpi'); b.setAttribute('data-field', 'kadar'); b.setAttribute('data-row', '0'); b.textContent = fmtPct(k.kadar);
  const s = document.createElement('span'); s.textContent = 'kadar penghantaran';
  inner.append(b, s); c.appendChild(inner); el.appendChild(c);
});

// ---------- Kad utama ----------
teks('tJumlah', () => kpi().dihantar.toLocaleString('ms-MY'));
teks('tWajib', () => kpi().wajib.toLocaleString('ms-MY'));
teks('tSemasaTarikh', () => kpi().tarikhSemasa);
teks('tLengkap', () => String(kpi().mingguLengkap));
teks('tLepas', () => String(kpi().mingguLepas));
teks('nSudah', () => String(kpi().dihantarSemasa));
teks('nBelum', () => String(kpi().belumSemasa));
dash.draw('tSemasa', (el) => {
  if (!sedia(el, ['kpi'])) return;
  const k = kpi(); el.replaceChildren();
  const s = document.createElement('small'); s.textContent = ' / ' + k.aktifSemasa;
  el.append(document.createTextNode(String(k.dihantarSemasa)), s);
});
dash.draw('tBelum', (el) => {
  if (!sedia(el, ['kpi'])) return;
  const n = kpi().belumSemasa; el.textContent = String(n);
  el.style.color = n > 0 ? 'var(--color-bad)' : 'var(--color-ok)';
});
function bar(el, v, warna) {
  el.replaceChildren(); const i = document.createElement('i');
  i.style.width = Math.max(0, Math.min(100, v)) + '%'; if (warna) i.style.background = warna; el.appendChild(i);
}
dash.draw('barJumlah', (el) => { if (!sedia(el, ['kpi'], true)) return; const k = kpi(); bar(el, k.wajib ? (k.dihantar / k.wajib) * 100 : 0); });
dash.draw('barSemasa', (el) => { if (!sedia(el, ['kpi'], true)) return; const k = kpi(); bar(el, k.aktifSemasa ? (k.dihantarSemasa / k.aktifSemasa) * 100 : 0, 'var(--color-ok)'); });

// ---------- Minggu ini ----------
function orang(el, list, kelas, kosong) {
  el.replaceChildren();
  if (!list.length) { const p = document.createElement('span'); p.className = 'lp-empty'; p.textContent = kosong; el.appendChild(p); return; }
  list.forEach((s) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'lp-person';
    b.setAttribute('data-source', 'status'); b.setAttribute('data-field', 'nama'); b.setAttribute('data-where', 'kunci=' + encodeURIComponent(s.kunci));
    b.setAttribute('aria-label', `${s.nama}: ${s.status}`);
    const n = document.createElement('span'); n.textContent = pendek(s.nama);
    b.append(avatar(s.nama, s.bil, kelas), n);
    b.addEventListener('click', () => pilih(s.bil, s.idx, true));
    el.appendChild(b);
  });
}
dash.draw('orangSudah', (el) => {
  if (!sedia(el, ['status'], true)) return;
  orang(el, dash.data('status').data.filter((s) => s.semasa && s.status === 'Dihantar'), 'ok', 'Belum ada pegawai yang menghantar laporan minggu ini.');
});
dash.draw('orangBelum', (el) => {
  if (!sedia(el, ['status'], true)) return;
  orang(el, dash.data('status').data.filter((s) => s.semasa && s.status === 'Belum dihantar'), 'bad', 'Semua pegawai telah menghantar laporan minggu ini. 🎉');
});

// ---------- Ikut bulan ----------
dash.draw('bulanKad', (el) => {
  if (!sedia(el, ['bulan'])) return;
  el.replaceChildren();
  dash.data('bulan').data.forEach((b, i) => {
    const d = document.createElement('div'); d.className = 'lp-month' + (b.wajib ? '' : ' fut') + (b.semasa ? ' cur' : '');
    d.setAttribute('data-source', 'bulan'); d.setAttribute('data-field', 'kadar'); d.setAttribute('data-where', 'bulan=' + encodeURIComponent(b.bulan));
    const S = 58;
    const svg = d3.select(d).append('svg').attr('width', S).attr('height', S).attr('viewBox', `0 0 ${S} ${S}`).attr('role', 'img')
      .attr('aria-label', `${b.bulan}: ${b.wajib ? fmtPct(b.kadar) : 'belum bermula'}`);
    const g = svg.append('g').attr('transform', `translate(${S / 2},${S / 2})`);
    cincin(g, 28, 7, b.kadar || 0, warnaKadar(b.kadar), 'color-mix(in srgb, var(--color-fg) 9%, transparent)', 'b' + i);
    g.append('text').attr('text-anchor', 'middle').attr('dy', '0.35em').style('font-size', '12px').style('font-weight', 600)
      .style('fill', 'var(--color-fg)').style('font-variant-numeric', 'tabular-nums').text(b.wajib ? Math.round(b.kadar) + '%' : '–');
    const t = document.createElement('div');
    const h = document.createElement('h3'); h.textContent = b.bulan;
    const p = document.createElement('p');
    p.textContent = b.wajib ? `${b.dihantar}/${b.wajib} laporan` : 'Belum bermula';
    const p2 = document.createElement('p');
    p2.textContent = b.semasa ? `${b.mingguBermula} daripada ${b.bilMinggu} minggu · semasa` : `${b.bilMinggu} minggu`;
    t.append(h, p, p2); d.appendChild(t); el.appendChild(d);
  });
});

// ---------- Carta mengikut minggu ----------
dash.draw('chartMinggu', (el) => {
  if (!sedia(el, ['minggu'])) return;
  const data = dash.data('minggu').data;
  el.replaceChildren();
  const W = Math.max(280, el.clientWidth), H = 280, m = { t: 34, r: 8, b: 46, l: 40 };
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`)
    .attr('role', 'img').attr('aria-label', 'Carta bar kadar penghantaran laporan bagi setiap minggu, Ogos hingga Disember 2026');
  const defs = svg.append('defs');
  const gr = (id, a, b) => { const lg = defs.append('linearGradient').attr('id', id).attr('x1', 0).attr('x2', 0).attr('y1', 0).attr('y2', 1); lg.append('stop').attr('offset', '0%').style('stop-color', a); lg.append('stop').attr('offset', '100%').style('stop-color', b); };
  gr('lpGBiru', '#4A90D9', '#1F4E79'); gr('lpGHijau', '#6EE7A8', 'var(--color-ok)');
  const x = d3.scaleBand().domain(data.map((d) => d.idx)).range([m.l, W - m.r]).padding(0.22);
  const y = d3.scaleLinear().domain([0, 100]).range([H - m.b, m.t]);
  const groups = d3.groups(data, (d) => d.bulan);
  groups.forEach(([b, ws], gi) => {
    if (gi % 2) return;
    const x0 = x(ws[0].idx) - x.step() * x.paddingInner() / 2, x1 = x(ws[ws.length - 1].idx) + x.bandwidth() + x.step() * x.paddingInner() / 2;
    svg.append('rect').attr('x', x0).attr('width', x1 - x0).attr('y', m.t - 8).attr('height', H - m.b - m.t + 8).attr('rx', 8)
      .style('fill', 'color-mix(in srgb, var(--color-fg) 4%, transparent)');
  });
  svg.append('g').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(4).tickFormat((v) => v + '%').tickSize(-(W - m.l - m.r)))
    .call((g) => g.select('.domain').remove()).call((g) => g.selectAll('.tick line').attr('stroke-opacity', 0.7).attr('stroke-dasharray', '2 4'));
  const t = tip(el);
  const masuk = GERAK && !LP.anim.minggu; LP.anim.minggu = true;
  const bars = svg.append('g').selectAll('rect').data(data.filter((d) => d.lepas)).join('rect')
    .attr('x', (d) => x(d.idx)).attr('width', x.bandwidth()).attr('rx', Math.min(6, x.bandwidth() / 3))
    .style('fill', (d) => (d.kadar >= 100 ? 'url(#lpGHijau)' : 'url(#lpGBiru)'))
    .style('stroke', (d) => (d.semasa ? 'var(--color-fg)' : 'none')).style('stroke-width', 1.5)
    .on('pointermove', (ev, d) => t.show(ev, [d.bulan + ' ' + d.minggu + (d.semasa ? ' (semasa)' : ''), d.tarikh, `${d.dihantar} daripada ${d.bertugas} pegawai menghantar (${fmtPct(d.kadar)})`]))
    .on('pointerleave', () => t.hide());
  if (masuk) {
    bars.attr('y', y(0)).attr('height', 0).transition().duration(900).delay((d, i) => i * 35).ease(d3.easeCubicOut)
      .attr('y', (d) => y(d.kadar)).attr('height', (d) => y(0) - y(d.kadar));
  } else bars.attr('y', (d) => y(d.kadar)).attr('height', (d) => y(0) - y(d.kadar));
  svg.append('g').selectAll('rect').data(data.filter((d) => !d.lepas)).join('rect')
    .attr('x', (d) => x(d.idx)).attr('width', x.bandwidth()).attr('y', y(100)).attr('height', y(0) - y(100)).attr('rx', Math.min(6, x.bandwidth() / 3))
    .style('fill', 'transparent').style('stroke', 'var(--color-border-line)').style('stroke-dasharray', '3 3')
    .on('pointermove', (ev, d) => t.show(ev, [d.bulan + ' ' + d.minggu, d.tarikh, 'Minggu akan datang' + (d.dihantar ? ` · ${d.dihantar} diisi awal` : '')]))
    .on('pointerleave', () => t.hide());
  if (x.bandwidth() >= 20) {
    svg.append('g').selectAll('text').data(data.filter((d) => d.lepas && !d.semasa)).join('text').attr('class', 'lp-axis-t')
      .attr('x', (d) => x(d.idx) + x.bandwidth() / 2).attr('y', (d) => y(d.kadar) - 6).attr('text-anchor', 'middle')
      .style('font-variant-numeric', 'tabular-nums').style('font-size', '11px').text((d) => Math.round(d.kadar));
  }
  const cur = data.find((d) => d.semasa);
  if (cur) {
    const cx = x(cur.idx) + x.bandwidth() / 2, cy = y(cur.kadar) - 12;
    const g = svg.append('g').attr('transform', `translate(${cx},${cy})`);
    const lbl = `Minggu ini · ${Math.round(cur.kadar)}%`;
    const tx = g.append('text').attr('text-anchor', 'middle').attr('dy', '0.35em').style('font-size', '11px').style('font-weight', 600).style('fill', '#fff').text(lbl);
    const wTxt = tx.node().getComputedTextLength() || 80;
    let shift = 0; if (cx + wTxt / 2 + 10 > W) shift = W - (cx + wTxt / 2 + 10); if (cx - wTxt / 2 - 10 < 0) shift = -(cx - wTxt / 2 - 10);
    g.insert('rect', 'text').attr('x', -wTxt / 2 - 8 + shift).attr('y', -11).attr('width', wTxt + 16).attr('height', 22).attr('rx', 11).style('fill', '#1F4E79');
    tx.attr('x', shift);
  }
  svg.append('g').selectAll('text').data(data).join('text').attr('class', 'lp-axis-t')
    .attr('x', (d) => x(d.idx) + x.bandwidth() / 2).attr('y', H - m.b + 16).attr('text-anchor', 'middle')
    .style('font-weight', (d) => (d.semasa ? 700 : 400)).text((d) => d.minggu.replace('Minggu ', 'M'));
  groups.forEach(([b, ws]) => {
    const x0 = x(ws[0].idx), x1 = x(ws[ws.length - 1].idx) + x.bandwidth();
    svg.append('text').attr('class', 'lp-axis-t').attr('x', (x0 + x1) / 2).attr('y', H - m.b + 36).attr('text-anchor', 'middle')
      .style('font-weight', 600).text(x1 - x0 < 60 ? b.slice(0, 3) : b);
  });
});

// ---------- Peta status ----------
dash.draw('heatmap', (el) => {
  if (!sedia(el, ['status'])) return;
  lalai();
  const all = dash.data('status').data;
  const weeks = d3.groups(all, (d) => d.idx).map(([idx, rs]) => rs[0]).sort((a, b) => a.idx - b.idx)
    .filter((w) => !LP.bulan || w.bulan === LP.bulan);
  const q = LP.nama.trim().toLowerCase();
  const staff = d3.groups(all, (d) => d.bil).map(([bil, rs]) => ({ bil, nama: rs[0].nama, jawatan: rs[0].jawatan, rs: new Map(rs.map((r) => [r.idx, r])) }))
    .filter((p) => !q || p.nama.toLowerCase().includes(q) || p.jawatan.toLowerCase().includes(q));
  el.replaceChildren();
  if (!staff.length) { const p = document.createElement('p'); p.className = 'lp-empty'; p.textContent = 'Tiada pegawai sepadan dengan carian.'; el.appendChild(p); return; }
  const t = tip(el);
  const tb = document.createElement('table'); tb.className = 'lp-hm';
  const th = document.createElement('thead');
  const r1 = document.createElement('tr'), r2 = document.createElement('tr');
  const e1 = document.createElement('th'); e1.className = 'lp-nm'; r1.appendChild(e1);
  const e2 = document.createElement('th'); e2.className = 'lp-nm'; e2.textContent = 'Pegawai'; r2.appendChild(e2);
  d3.groups(weeks, (w) => w.bulan).forEach(([b, ws]) => { const c = document.createElement('th'); c.className = 'lp-mo'; c.colSpan = ws.length; c.textContent = ws.length < 3 ? b.slice(0, 3) : b; r1.appendChild(c); });
  weeks.forEach((w) => { const c = document.createElement('th'); c.textContent = w.minggu.replace('Minggu ', 'M'); if (w.semasa) c.className = 'lp-cur'; r2.appendChild(c); });
  r1.appendChild(document.createElement('th'));
  const pc2 = document.createElement('th'); pc2.textContent = 'Hantar'; r2.appendChild(pc2);
  th.append(r1, r2); tb.appendChild(th);
  const body = document.createElement('tbody');
  staff.forEach((p) => {
    const tr = document.createElement('tr');
    const n = document.createElement('th'); n.className = 'lp-nm'; n.scope = 'row';
    const nw = document.createElement('div'); nw.className = 'lp-nmw';
    const ns = document.createElement('span'); ns.textContent = pendek(p.nama);
    nw.append(avatar(p.nama, p.bil, 'sm'), ns); n.appendChild(nw); tr.appendChild(n);
    let w = 0, h = 0;
    weeks.forEach((wk) => {
      const s = p.rs.get(wk.idx); const td = document.createElement('td');
      if (s) {
        if (s.wajib) { w++; if (s.status === 'Dihantar') h++; }
        const b = document.createElement('button'); b.type = 'button';
        b.className = 'lp-cell lp-s-' + cls(s.status) + (s.palsu ? ' lp-palsu' : '') + (LP.bil === s.bil && LP.idx === s.idx ? ' lp-sel' : '');
        b.setAttribute('aria-label', `${p.nama}, ${s.bulan} ${s.minggu}: ${s.status}`);
        b.addEventListener('click', () => pilih(s.bil, s.idx, true));
        b.addEventListener('pointermove', (ev) => t.show(ev, [pendek(p.nama), `${s.bulan} ${s.minggu} · ${s.tarikh}`, s.status + (s.palsu ? ' · ditanda ✅ dalam Rumusan tanpa isi' : '')]));
        b.addEventListener('pointerleave', () => t.hide());
        td.appendChild(b);
      }
      tr.appendChild(td);
    });
    const pc = document.createElement('td'); pc.className = 'lp-pct'; pc.textContent = w ? `${h}/${w}` : '–';
    if (w) pc.style.color = warnaKadar((h / w) * 100);
    tr.appendChild(pc);
    body.appendChild(tr);
  });
  tb.appendChild(body); el.appendChild(tb);
});

// ---------- Carta mengikut pegawai ----------
dash.draw('chartPegawai', (el) => {
  if (!sedia(el, ['pegawai'])) return;
  const data = dash.data('pegawai').data.filter((p) => p.wajib > 0).slice().sort((a, b) => a.kadar - b.kadar || a.bil - b.bil);
  el.replaceChildren();
  const W = Math.max(280, el.clientWidth), row = 32, m = { t: 6, r: 84, b: 26, l: 0 };
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('role', 'img').attr('aria-label', 'Carta bar mendatar kadar penghantaran laporan bagi setiap pegawai');
  const labels = svg.append('g').selectAll('text').data(data).join('text').attr('class', 'lp-axis-t').text((d) => pendek(d.nama));
  let lw = 0; labels.each(function () { lw = Math.max(lw, this.getComputedTextLength()); });
  lw = Math.min(lw || 120, W * 0.4); m.l = lw + 44;
  const H = m.t + m.b + data.length * row;
  svg.attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
  const defs = svg.append('defs');
  [['lpPBiru', '#1F4E79', '#4A90D9'], ['lpPHijau', 'var(--color-ok)', '#6EE7A8'], ['lpPMerah', 'var(--color-bad)', '#F49A9A'], ['lpPKuning', '#D99A1E', '#F5C969']].forEach(([id, a, b]) => {
    const lg = defs.append('linearGradient').attr('id', id); lg.append('stop').attr('offset', '0%').style('stop-color', a); lg.append('stop').attr('offset', '100%').style('stop-color', b);
  });
  const isi = (k) => (k >= 100 ? 'url(#lpPHijau)' : k >= 90 ? 'url(#lpPBiru)' : k >= 80 ? 'url(#lpPKuning)' : 'url(#lpPMerah)');
  const x = d3.scaleLinear().domain([0, 100]).range([m.l, W - m.r]);
  const y = d3.scaleBand().domain(data.map((d) => d.bil)).range([m.t, H - m.b]).padding(0.3);
  svg.insert('g', ':first-child').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(W < 420 ? 3 : 5).tickFormat((v) => v + '%').tickSize(0))
    .call((g) => g.select('.domain').remove()).call((g) => g.selectAll('text').attr('dy', '1.2em'));
  labels.attr('x', m.l - 10).attr('y', (d) => y(d.bil) + y.bandwidth() / 2).attr('dy', '0.35em').attr('text-anchor', 'end')
    .style('fill', 'var(--color-fg)').each(function (d) {
      let s = pendek(d.nama); this.textContent = s;
      while (this.getComputedTextLength() > lw && s.length > 4) { s = s.slice(0, -1); this.textContent = s + '…'; }
    });
  const av = svg.append('g').selectAll('g').data(data).join('g').attr('transform', (d) => `translate(${m.l - lw - 30},${y(d.bil) + y.bandwidth() / 2})`);
  av.each(function (d) {
    const s = d3.select(this).append('svg').attr('x', -12).attr('y', -12).attr('width', 24).attr('height', 24).attr('viewBox', '0 0 64 64');
    s.append('clipPath').attr('id', 'lpAvC' + d.bil).append('circle').attr('cx', 32).attr('cy', 32).attr('r', 32);
    s.append('g').attr('clip-path', `url(#lpAvC${d.bil})`).node().innerHTML = avatarMarkup(d.nama, d.bil);
  });
  svg.append('g').selectAll('rect').data(data).join('rect')
    .attr('x', m.l).attr('y', (d) => y(d.bil)).attr('height', y.bandwidth()).attr('width', x(100) - m.l).attr('rx', y.bandwidth() / 2)
    .style('fill', 'color-mix(in srgb, var(--color-fg) 7%, transparent)');
  const t = tip(el);
  const masuk = GERAK && !LP.anim.pegawai; LP.anim.pegawai = true;
  const bars = svg.append('g').selectAll('rect').data(data).join('rect')
    .attr('x', m.l).attr('y', (d) => y(d.bil)).attr('height', y.bandwidth()).attr('rx', y.bandwidth() / 2)
    .style('fill', (d) => isi(d.kadar)).style('cursor', 'pointer')
    .on('pointermove', (ev, d) => t.show(ev, [d.nama, d.jawatan, `${d.dihantar} daripada ${d.wajib} minggu (${fmtPct(d.kadar)})`].concat(d.mingguBelum ? ['Belum: ' + d.mingguBelum] : [])))
    .on('pointerleave', () => t.hide())
    .on('click', (ev, d) => { const s = dash.data('status').data.find((r) => r.bil === d.bil && r.status === 'Belum dihantar'); pilih(d.bil, s ? s.idx : LP.idx, true); });
  if (masuk) bars.attr('width', 0).transition().duration(900).delay((d, i) => i * 30).ease(d3.easeCubicOut).attr('width', (d) => Math.max(0, x(d.kadar) - m.l));
  else bars.attr('width', (d) => Math.max(0, x(d.kadar) - m.l));
  svg.append('g').selectAll('text').data(data).join('text').attr('class', 'lp-axis-t')
    .attr('x', W - m.r + 10).attr('y', (d) => y(d.bil) + y.bandwidth() / 2).attr('dy', '0.35em')
    .style('font-variant-numeric', 'tabular-nums').style('fill', 'var(--color-fg)')
    .text((d) => `${d.dihantar}/${d.wajib} · ${Math.round(d.kadar)}%`);
});

// ---------- Pembaca laporan ----------
dash.draw('pilihPegawai', (sel) => {
  const s = dash.data('status'); if (s.status !== 'ok') { sel.replaceChildren(); return; }
  lalai();
  const staff = d3.groups(s.data, (d) => d.bil).map(([bil, rs]) => rs[0]);
  sel.replaceChildren(...staff.map((p) => new Option(p.nama, String(p.bil))));
  sel.value = String(LP.bil);
  sel.onchange = () => pilih(Number(sel.value), LP.idx, false);
});
dash.draw('pilihMinggu', (sel) => {
  const s = dash.data('status'); if (s.status !== 'ok') { sel.replaceChildren(); return; }
  lalai();
  const rs = s.data.filter((r) => r.bil === LP.bil).sort((a, b) => a.idx - b.idx);
  sel.replaceChildren(...rs.map((r) => new Option(`${r.bulan} ${r.minggu} (${r.tarikh}) · ${r.status}`, String(r.idx))));
  sel.value = String(LP.idx);
  sel.onchange = () => pilih(LP.bil, Number(sel.value), false);
});
dash.draw('jalurMinggu', (el) => {
  const s = dash.data('status'); if (s.status !== 'ok') { el.replaceChildren(); return; }
  lalai(); el.replaceChildren();
  s.data.filter((r) => r.bil === LP.bil).sort((a, b) => a.idx - b.idx).forEach((r) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'lp-s-' + cls(r.status) + (r.idx === LP.idx ? ' lp-sel' : '');
    b.setAttribute('aria-label', `${r.bulan} ${r.minggu}: ${r.status}`); b.title = `${r.bulan} ${r.minggu}`;
    b.addEventListener('click', () => pilih(LP.bil, r.idx, false));
    el.appendChild(b);
  });
});
dash.draw('viewMeta', (el) => {
  const s = dash.data('status'); if (s.status !== 'ok') { el.replaceChildren(); return; }
  lalai();
  const r = s.data.find((x) => x.bil === LP.bil && x.idx === LP.idx); el.replaceChildren(); if (!r) return;
  const b = document.createElement('span'); b.className = 'lp-badge ' + cls(r.status); b.textContent = r.status;
  const j = document.createElement('span'); j.textContent = `${r.bulan} ${r.minggu} · ${r.tarikh} · ${r.jawatan}`;
  el.append(avatar(r.nama, r.bil, 'sm'), b, j);
  if (r.sumber === 'Borang') { const sb = document.createElement('span'); sb.className = 'lp-src'; sb.textContent = 'Ditulis melalui borang'; el.appendChild(sb); }
  if (r.palsu) { const w = document.createElement('span'); w.style.color = 'var(--color-warn)'; w.textContent = 'Ditanda ✅ dalam Rumusan tetapi tiada isi'; el.appendChild(w); }
});
const HARI = /^(isnin|selasa|rabu|khamis|jumaat|sabtu|ahad)\b|^\d{1,2}\s+(ogos|september|oktober|november|disember)\s+\d{4}|^\d{1,2}[./]\d{1,2}[./]\d{2,4}\s*$/i;
dash.draw('viewTeks', (el) => {
  if (!sedia(el, ['gabung', 'status'])) return;
  lalai();
  const r = dash.data('gabung').data.find((x) => x.bil === LP.bil && x.idx === LP.idx);
  const st = dash.data('status').data.find((x) => x.bil === LP.bil && x.idx === LP.idx);
  el.replaceChildren();
  const box = document.createElement('div'); box.className = 'lp-paper';
  if (r && r.teks) {
    box.setAttribute('data-source', 'gabung'); box.setAttribute('data-field', 'teks'); box.setAttribute('data-where', 'kunci=' + encodeURIComponent(r.kunci));
    const ul = document.createElement('ul'); ul.className = 'lp-items';
    r.teks.split('\n').map((l) => l.trim()).filter(Boolean).forEach((l) => {
      const li = document.createElement('li'); const mm = l.match(/^(\d{1,2})[.)]\s+(.*)$/);
      if (mm) { const n = document.createElement('span'); n.className = 'lp-n'; n.textContent = mm[1]; const tx = document.createElement('span'); tx.textContent = mm[2]; li.append(n, tx); }
      else if (HARI.test(l) && l.length < 60) { li.className = 'lp-day'; li.textContent = l.replace(/:\s*$/, ''); }
      else { li.className = 'lp-plain'; li.textContent = l; }
      ul.appendChild(li);
    });
    box.appendChild(ul);
  } else {
    box.classList.add('lp-none');
    box.textContent = st && st.status === 'Belum bertugas' ? 'Pegawai belum bertugas di sektor pada minggu ini.'
      : st && st.status === 'Akan datang' ? 'Minggu ini belum bermula.' : 'Tiada laporan diisi untuk minggu ini.';
  }
  el.appendChild(box);
});

// ---------- Perlu disemak ----------
dash.draw('palsuList', (el) => {
  if (!sedia(el, ['status'], true)) return;
  const list = dash.data('status').data.filter((s) => s.palsu);
  el.replaceChildren();
  if (!list.length) { const p = document.createElement('span'); p.className = 'lp-empty'; p.textContent = 'Tiada percanggahan antara Rumusan dan tab pegawai.'; el.appendChild(p); return; }
  list.forEach((s) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'lp-chip';
    b.setAttribute('data-source', 'status'); b.setAttribute('data-field', 'nama'); b.setAttribute('data-where', 'kunci=' + encodeURIComponent(s.kunci));
    b.append(avatar(s.nama, s.bil, 'sm'), document.createTextNode(`${pendek(s.nama)} · ${s.bulan} ${s.minggu}`));
    b.addEventListener('click', () => pilih(s.bil, s.idx, true));
    el.appendChild(b);
  });
});

// ---------- Carian ----------
function serlah(parent, text, q) {
  const lo = text.toLowerCase(); let i = 0;
  while (true) {
    const j = lo.indexOf(q, i);
    if (j < 0) { parent.appendChild(document.createTextNode(text.slice(i))); break; }
    parent.appendChild(document.createTextNode(text.slice(i, j)));
    const mk = document.createElement('mark'); mk.textContent = text.slice(j, j + q.length); parent.appendChild(mk);
    i = j + q.length;
  }
}
function cari() {
  const q = LP.kata.trim().toLowerCase(); const L = dash.data('gabung');
  if (q.length < 2 || L.status !== 'ok') return null;
  return L.data.filter((r) => r.teks && r.teks.toLowerCase().includes(q)).sort((a, b) => b.idx - a.idx || a.bil - b.bil);
}
dash.draw('carianKiraan', (el) => {
  const hits = cari();
  if (!hits) { el.textContent = LP.kata.trim().length === 1 ? 'Taip sekurang-kurangnya 2 aksara.' : ''; return; }
  const q = LP.kata.trim().toLowerCase();
  const n = hits.reduce((a, r) => a + r.teks.toLowerCase().split(q).length - 1, 0);
  const p = new Set(hits.map((r) => r.bil)).size;
  el.textContent = hits.length ? `${n} padanan dalam ${hits.length} laporan oleh ${p} pegawai` + (hits.length > 60 ? ' · 60 terkini dipaparkan' : '') : 'Tiada padanan.';
});
dash.draw('carianHasil', (el) => {
  el.classList.remove('dash-skeleton');
  const hits = cari(); el.replaceChildren(); if (!hits) return;
  const q = LP.kata.trim().toLowerCase();
  hits.slice(0, 60).forEach((r) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'lp-res';
    b.setAttribute('data-source', 'gabung'); b.setAttribute('data-field', 'teks'); b.setAttribute('data-where', 'kunci=' + encodeURIComponent(r.kunci));
    const body = document.createElement('div');
    const h = document.createElement('div'); h.className = 'lp-rh';
    const nb = document.createElement('b'); nb.textContent = pendek(r.nama); h.append(nb, document.createTextNode(` · ${r.bulan} ${r.minggu} · ${r.tarikh}`));
    const s = document.createElement('div'); s.className = 'lp-rs';
    const lines = r.teks.split('\n').filter((l) => l.toLowerCase().includes(q));
    const shown = lines.slice(0, 3).map((l) => { if (l.length <= 240) return l; const j = l.toLowerCase().indexOf(q); const a = Math.max(0, j - 100); return (a ? '…' : '') + l.slice(a, a + 240) + '…'; });
    shown.forEach((l, i) => { if (i) s.appendChild(document.createElement('br')); serlah(s, l.trim(), q); });
    if (lines.length > 3) { s.appendChild(document.createElement('br')); s.appendChild(document.createTextNode(`+${lines.length - 3} baris lagi`)); }
    body.append(h, s);
    b.append(avatar(r.nama, r.bil), body);
    b.addEventListener('click', () => pilih(r.bil, r.idx, true));
    el.appendChild(b);
  });
});

// ---------- Borang laporan mingguan ----------
LP.f = LP.f || { bil: null, bulan: null, idx: null, dimuat: null, draf: {} };
LP.f.draf = LP.f.draf || {};
function fInit() {
  const s = dash.data('status');
  if (LP.f.bil != null || s.status !== 'ok' || !s.data.length) return;
  const z = s.data.find((r) => /ZURIATI/.test(r.nama));
  const c = s.data.find((r) => r.semasa) || s.data[0];
  LP.f.bil = z ? z.bil : s.data[0].bil; LP.f.idx = c.idx; LP.f.bulan = c.bulan;
}
const fTeks = () => document.getElementById('borang-teks');
function mesej(id) { document.querySelectorAll('#borang-mesej [data-m]').forEach((m) => { m.hidden = m.getAttribute('data-m') !== id; }); }
function isiBorang(paksa) {
  const g = dash.data('gabung'); const ta = fTeks();
  if (g.status !== 'ok' || !ta || LP.f.bil == null) return;
  const k = LP.f.bil + '-' + LP.f.idx;
  if (!paksa && (LP.f.dimuat === k || document.activeElement === ta)) return;
  const r = g.data.find((x) => x.kunci === k);
  ta.value = LP.f.draf[k] != null ? LP.f.draf[k] : (r && r.teks ? r.teks : ''); LP.f.dimuat = k;
}
function tukarBorang(perubahan) {
  Object.assign(LP.f, perubahan); mesej('');
  ['borangPegawai', 'borangMinggu', 'borangInfo'].forEach((n) => dash.draw(n));
  isiBorang(true);
}
dash.draw('borangPegawai', (sel) => {
  const s = dash.data('status'); if (s.status !== 'ok') { sel.replaceChildren(); return; }
  fInit();
  const staff = d3.groups(s.data, (d) => d.bil).map(([bil, rs]) => rs[0]);
  sel.replaceChildren(...staff.map((p) => new Option(p.nama, String(p.bil))));
  sel.value = String(LP.f.bil);
  sel.onchange = () => tukarBorang({ bil: Number(sel.value) });
});
dash.draw('borangMinggu', (sel) => {
  const s = dash.data('status'); if (s.status !== 'ok') { sel.replaceChildren(); return; }
  fInit();
  const rs = s.data.filter((r) => r.bil === LP.f.bil && r.bulan === LP.f.bulan).sort((a, b) => a.idx - b.idx);
  sel.replaceChildren(...rs.map((r) => new Option(`${r.minggu} (${r.tarikh})${r.status === 'Dihantar' || r.status === 'Diisi awal' ? ' ✓' : ''}`, String(r.idx))));
  sel.value = String(LP.f.idx);
  sel.onchange = () => tukarBorang({ idx: Number(sel.value) });
});
dash.draw('borangInfo', (el) => {
  const s = dash.data('status'); if (s.status !== 'ok') { el.replaceChildren(); return; }
  fInit();
  const r = s.data.find((x) => x.bil === LP.f.bil && x.idx === LP.f.idx); el.replaceChildren(); if (!r) return;
  const b = document.createElement('span'); b.className = 'lp-badge ' + cls(r.status); b.textContent = r.status;
  const t = document.createElement('span');
  t.textContent = r.status === 'Belum bertugas' ? 'Pegawai belum bertugas di sektor pada minggu ini.'
    : r.sumber === 'Borang' ? 'Laporan sedia ada dari borang dimuatkan di bawah. Ubah dan simpan untuk mengemas kini.'
    : r.status === 'Dihantar' || r.status === 'Diisi awal' ? 'Laporan sedia ada dari fail Excel dimuatkan di bawah. Simpan untuk menggantikannya.'
    : 'Belum ada laporan untuk minggu ini.';
  el.append(avatar(r.nama, r.bil, 'sm'), b, t);
});
dash.onData(() => {
  fInit();
  document.querySelectorAll('#borang-bulan').forEach((s) => { if (LP.f.bulan && document.activeElement !== s) s.value = LP.f.bulan; });
  isiBorang(false);
});
async function simpanBorang() {
  const ta = fTeks(); if (!ta || LP.f.bil == null) return;
  const teks = ta.value.replace(/\s+$/, '');
  if (!teks.replace(/^\s*\d+[.)]?\s*$/gm, '').trim()) { mesej('kosong'); return; }
  const kunci = LP.f.bil + '-' + LP.f.idx;
  mesej('simpan');
  document.querySelectorAll('#borang-simpan').forEach((b) => { b.disabled = true; });
  let ok = true;
  try {
    const res = await fetch(SDP.url, { method: 'POST', body: JSON.stringify({ kod: SDP.kod(), kunci, teks }) });
    const j = await res.json();
    if (!j.ok) throw new Error(j.ralat || 'Gagal');
    const rows = dash.data('laporan').data.map((r) => (r.kunci === kunci ? { ...r, teks: j.teks, isi: j.isi, sumber: j.sumber, dikemaskini: j.dikemaskini } : r));
    dash.set('laporan', { status: 'ok', data: rows });
    dash.runAll();
  } catch (e) { ok = false; }
  document.querySelectorAll('#borang-simpan').forEach((b) => { b.disabled = false; });
  if (ok) { delete LP.f.draf[kunci]; LP.f.dimuat = kunci; mesej('ok'); pilih(LP.f.bil, LP.f.idx, false); }
  else mesej('gagal');
}
document.querySelectorAll('#borang-bulan').forEach((s) => s.addEventListener('change', () => {
  const st = dash.data('status'); if (st.status !== 'ok') return;
  const ws = st.data.filter((r) => r.bil === LP.f.bil && r.bulan === s.value).sort((a, b) => a.idx - b.idx);
  const cur = ws.find((r) => r.semasa) || ws[0];
  tukarBorang({ bulan: s.value, idx: cur ? cur.idx : LP.f.idx });
}));
const simpanDraf = () => { const ta = fTeks(); if (ta && LP.f.bil != null) LP.f.draf[LP.f.bil + '-' + LP.f.idx] = ta.value; };
document.querySelectorAll('#borang-teks').forEach((t) => t.addEventListener('input', () => { simpanDraf(); mesej(''); }));
document.querySelectorAll('#borang-simpan').forEach((b) => b.addEventListener('click', simpanBorang));
document.querySelectorAll('#borang-batal').forEach((b) => b.addEventListener('click', () => { delete LP.f.draf[LP.f.bil + '-' + LP.f.idx]; isiBorang(true); mesej(''); }));
document.querySelectorAll('#borang-nombor').forEach((b) => b.addEventListener('click', () => {
  const ta = fTeks(); if (!ta) return;
  let n = 0;
  ta.value = ta.value.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    if (/^(isnin|selasa|rabu|khamis|jumaat|sabtu|ahad)\b/i.test(l)) { n = 0; return l; }
    n++; return n + '. ' + l.replace(/^\d{1,2}[.)]\s*/, '');
  }).join('\n');
  simpanDraf();
}));

// ---------- Pendengar kawalan ----------
document.querySelectorAll('#tapis-bulan').forEach((s) => s.addEventListener('change', () => { LP.bulan = s.value; dash.draw('heatmap'); }));
document.querySelectorAll('#tapis-nama').forEach((s) => s.addEventListener('input', () => { LP.nama = s.value; dash.draw('heatmap'); }));
let tmCari;
document.querySelectorAll('#kata-kunci').forEach((s) => s.addEventListener('input', () => {
  clearTimeout(tmCari); tmCari = setTimeout(() => { LP.kata = s.value; dash.draw('carianKiraan'); dash.draw('carianHasil'); }, 200);
}));
const langkah = (d) => { if (LP.idx == null) return; const n = Math.min(22, Math.max(1, LP.idx + d)); if (n !== LP.idx) pilih(LP.bil, n, false); };
document.querySelectorAll('#minggu-sebelum').forEach((b) => b.addEventListener('click', () => langkah(-1)));
document.querySelectorAll('#minggu-seterus').forEach((b) => b.addEventListener('click', () => langkah(1)));


// ---------- Kod akses dan muat data ----------
const pintu = document.getElementById('pintu');
const pintuRalat = document.getElementById('pintu-ralat');
const pintuMasuk = document.getElementById('pintu-masuk');
let mataMuat = 0;
async function muatData(kod) {
  if (!SDP.url || /PASTE|TAMPAL/.test(SDP.url)) throw new Error('URL Apps Script belum ditetapkan dalam config.js.');
  const res = await fetch(SDP.url + '?kod=' + encodeURIComponent(kod) + '&t=' + Date.now());
  const j = await res.json();
  if (!j.ok) throw new Error(j.ralat || 'Data tidak dapat dimuatkan.');
  return j;
}
function paparMasa(iso) {
  const el = document.getElementById('masa-data'); if (!el) return;
  const d = iso ? new Date(iso) : new Date();
  el.textContent = 'Data dimuatkan ' + d.toLocaleString('ms-MY', { timeZone: 'Asia/Kuala_Lumpur', dateStyle: 'medium', timeStyle: 'short' });
}
async function masuk(kod, senyap) {
  pintuMasuk.disabled = true; pintuRalat.textContent = senyap ? '' : 'Memuatkan data…';
  try {
    const j = await muatData(kod);
    SDP.simpanKod(kod);
    pintu.hidden = true; pintuRalat.textContent = '';
    dash.set('laporan', { status: 'ok', data: j.rows });
    dash.runAll(); paparMasa(j.masa);
  } catch (e) {
    pintu.hidden = false; pintuRalat.textContent = e.message || 'Tidak dapat menyambung. Cuba lagi.';
    if (/Kod akses/.test(e.message || '')) SDP.buangKod();
  } finally { pintuMasuk.disabled = false; }
}
document.getElementById('pintu-borang').addEventListener('submit', (ev) => {
  ev.preventDefault(); const k = document.getElementById('pintu-kod').value.trim(); if (k) masuk(k, false);
});
document.getElementById('keluar').addEventListener('click', () => { SDP.buangKod(); location.reload(); });
document.getElementById('muat-semula').addEventListener('click', async (ev) => {
  const b = ev.currentTarget; b.disabled = true; const asal = b.textContent; b.textContent = 'Memuatkan…';
  try { const j = await muatData(SDP.kod()); dash.set('laporan', { status: 'ok', data: j.rows }); dash.runAll(); paparMasa(j.masa); }
  catch (e) { alert(e.message || 'Data tidak dapat dimuatkan.'); }
  finally { b.disabled = false; b.textContent = asal; }
});
window.addEventListener('resize', () => { clearTimeout(mataMuat); mataMuat = setTimeout(() => { dash.draw('chartMinggu'); dash.draw('chartPegawai'); }, 200); });

dash.runAll();
if (SDP.kod()) { pintu.hidden = true; masuk(SDP.kod(), true); }
else document.getElementById('pintu-kod').focus();
