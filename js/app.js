/* ═══════════════════════════════════════════
   Arabian Oryx Engineering Consultancy
   Receipts & invoices PWA — app.js
═══════════════════════════════════════════ */

// ── COMPANY DETAILS ──
const DEFAULT_SETTINGS = {
  compEN: 'Arabian Oryx Engineering Consultancy',
  compAR: 'المها العربية للاستشارات الهندسية',
  subEN: 'Design and Supervision',
  cr: '1337275',
  pobox: '1023400, PC 211',
  gsm: '+968 9912 4953 / +968 9360 3585',
  email: 'arabianoryx002@gmail.com',
  addr: 'Municipality of Dhofar, near KFC, Salalah',
  addrAR: 'بلدية ظفار، صلالة، سلطنة عُمان',
  tagline: 'Architectural and structural design, site supervision and project management across Dhofar.'
};
const SETTINGS_VERSION = 3;

function loadSettings() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem('ao_settings') || 'null'); } catch (e) {}
  if (!saved) return { ...DEFAULT_SETTINGS };
  const ver = parseInt(localStorage.getItem('ao_settings_version') || '1', 10);
  if (ver < SETTINGS_VERSION) {
    // Version 1 shipped a wrong P.O. Box, misspellings and an address that was only the city.
    if (/^\s*211\b/.test(saved.pobox || '')) saved.pobox = DEFAULT_SETTINGS.pobox;
    if (!saved.addr || /^Salalah, Sultanate of Oman$/i.test(saved.addr)) saved.addr = DEFAULT_SETTINGS.addr;
    if (!saved.addrAR || saved.addrAR === 'صلالة، سلطنة عُمان') saved.addrAR = DEFAULT_SETTINGS.addrAR;
    if (/orxy|consultance/i.test(saved.compEN || '')) saved.compEN = DEFAULT_SETTINGS.compEN;
    if (saved.compAR === 'المها العربية للإستشارات الهندسية') saved.compAR = DEFAULT_SETTINGS.compAR;
    if (saved.gsm === '+968 99124953 / +968 93603585') saved.gsm = DEFAULT_SETTINGS.gsm;
    // Version 3: the office wants 9912 4953 listed first.
    if (saved.gsm === '+968 9360 3585 / +968 9912 4953') saved.gsm = DEFAULT_SETTINGS.gsm;
    try {
      localStorage.setItem('ao_settings', JSON.stringify(saved));
      localStorage.setItem('ao_settings_version', String(SETTINGS_VERSION));
    } catch (e) {}
  }
  return { ...DEFAULT_SETTINGS, ...saved };
}

// ── STATE ──
let currentLang = 'en';
let currentPayMethod = 'cash';
let receipts = [];
try { receipts = JSON.parse(localStorage.getItem('ao_receipts') || '[]'); } catch (e) { receipts = []; }
let settings = loadSettings();

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  try { currentLang = localStorage.getItem('ao_lang') || 'en'; } catch (e) {}
  setTodayDate();
  loadSettingsToForm();
  initInvoiceDefaults();
  renderInvoiceItemsForm();
  applyLang();
  updatePreview();
  updateInvoicePreview();
  renderHistory();
  setupScalers();
  // Re-render once the document fonts are ready so the preview matches the print.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { updatePreview(); updateInvoicePreview(); });
});

// ── HELPERS ──
const $ = id => document.getElementById(id);
function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function t(en, ar) { return currentLang === 'ar' ? ar : en; }

// ── LANGUAGE (app interface only; documents are always bilingual) ──
function toggleLang() {
  currentLang = currentLang === 'en' ? 'ar' : 'en';
  try { localStorage.setItem('ao_lang', currentLang); } catch (e) {}
  applyLang();
  renderInvoiceItemsForm();
  renderHistory();
}

function applyLang() {
  const isAr = currentLang === 'ar';
  document.body.classList.toggle('lang-ar', isAr);
  document.documentElement.setAttribute('lang', currentLang);
  document.documentElement.setAttribute('dir', isAr ? 'rtl' : 'ltr');
  $('langLabel').textContent = isAr ? 'English' : 'العربية';
  $('langLabelMobile').textContent = isAr ? 'English' : 'العربية';
  document.querySelectorAll('[data-en]').forEach(el => {
    el.textContent = isAr ? el.dataset.ar : el.dataset.en;
  });
  fitAllSheets();
}

// ── PAGES ──
function showPage(page, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  $('page-' + page).classList.add('active');
  const nav = btn || document.querySelector(`.nav-item[data-page="${page}"]`);
  if (nav) nav.classList.add('active');
  if (page === 'history') renderHistory();
  if (page === 'new-invoice') updateInvoicePreview();
  if (page === 'new-receipt') updatePreview();
  closeSidebar();
  fitAllSheets();
  window.scrollTo(0, 0);
}

function toggleSidebar() {
  $('sidebar').classList.toggle('open');
  let overlay = $('sidebar-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    overlay.id = 'sidebar-overlay';
    overlay.onclick = closeSidebar;
    document.body.appendChild(overlay);
  }
  overlay.classList.toggle('visible');
}
function closeSidebar() {
  $('sidebar').classList.remove('open');
  const overlay = $('sidebar-overlay');
  if (overlay) overlay.classList.remove('visible');
}

// ── PREVIEW SCALING: the sheet is real A4, scaled down to fit the column ──
function fitSheet(scalerId) {
  const scaler = $(scalerId);
  if (!scaler || !scaler.offsetParent) return;
  const inner = scaler.firstElementChild;
  const sheet = inner && inner.firstElementChild;
  if (!sheet) return;
  const natural = sheet.offsetWidth || 794;
  const scale = Math.min(1, scaler.clientWidth / natural);
  inner.style.transform = `scale(${scale})`;
  scaler.style.height = (sheet.offsetHeight * scale) + 'px';
}
function fitAllSheets() { fitSheet('receiptScaler'); fitSheet('invoiceScaler'); }
function setupScalers() {
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(fitAllSheets);
    ro.observe($('receiptScaler'));
    ro.observe($('invoiceScaler'));
  }
  window.addEventListener('resize', fitAllSheets);
}

// ── DATES & NUMBERS ──
function isoToday() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
}
function setTodayDate() { $('recDate').value = isoToday(); }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

const CURRENCY_NAMES = {
  'R.O.': { en: ['Rial', 'Rials'], ar: 'ريال عماني', minorEn: ['Baisa', 'Baisa'], minorAr: 'بيسة', minorDiv: 1000, dp: 3 },
  '$': { en: ['Dollar', 'Dollars'], ar: 'دولار', minorEn: ['Cent', 'Cents'], minorAr: 'سنت', minorDiv: 100, dp: 2 },
  '€': { en: ['Euro', 'Euros'], ar: 'يورو', minorEn: ['Cent', 'Cents'], minorAr: 'سنت', minorDiv: 100, dp: 2 },
  '£': { en: ['Pound', 'Pounds'], ar: 'جنيه إسترليني', minorEn: ['Penny', 'Pence'], minorAr: 'بنس', minorDiv: 100, dp: 2 },
  'AED': { en: ['Dirham', 'Dirhams'], ar: 'درهم إماراتي', minorEn: ['Fils', 'Fils'], minorAr: 'فلس', minorDiv: 100, dp: 2 },
  'SAR': { en: ['Riyal', 'Riyals'], ar: 'ريال سعودي', minorEn: ['Halala', 'Halalas'], minorAr: 'هللة', minorDiv: 100, dp: 2 },
  '₹': { en: ['Rupee', 'Rupees'], ar: 'روبية', minorEn: ['Paisa', 'Paise'], minorAr: 'بيسة', minorDiv: 100, dp: 2 }
};
function cur(sym) { return CURRENCY_NAMES[sym] || CURRENCY_NAMES['R.O.']; }
function roundCur(n, sym) { const f = cur(sym).minorDiv; return Math.round((n + Number.EPSILON) * f) / f; }
function num(n, sym) {
  const dp = cur(sym).dp;
  return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}
function money(n, sym) { return `${sym} ${num(n, sym)}`; }
function vatLabel(rate) { return `${+(+rate).toFixed(2)}%`; }

// ── AMOUNT IN WORDS ──
const ONES_EN = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS_EN = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
function numToWordsEN(n) {
  if (n === 0) return 'Zero';
  const chunk = x => {
    let s = '';
    if (x >= 100) { s += ONES_EN[Math.floor(x / 100)] + ' Hundred '; x %= 100; }
    if (x >= 20) { s += TENS_EN[Math.floor(x / 10)] + (x % 10 ? '-' : ' '); x %= 10; }
    if (x > 0) s += ONES_EN[x] + ' ';
    return s.trim();
  };
  const units = ['', ' Thousand', ' Million', ' Billion'];
  const parts = []; let i = 0;
  while (n > 0) { const r = n % 1000; if (r) parts.unshift(chunk(r) + units[i]); n = Math.floor(n / 1000); i++; }
  return parts.join(' ').trim();
}

const ONES_AR = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة',
  'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
const TENS_AR = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const HUNDREDS_AR = ['', 'مائة', 'مئتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];
function numToWordsAR(n) {
  if (n === 0) return 'صفر';
  const chunk = x => {
    const p = [];
    if (x >= 100) { p.push(HUNDREDS_AR[Math.floor(x / 100)]); x %= 100; }
    if (x >= 20) { const tt = Math.floor(x / 10), o = x % 10; p.push(o ? ONES_AR[o] + ' و' + TENS_AR[tt] : TENS_AR[tt]); }
    else if (x > 0) p.push(ONES_AR[x]);
    return p.join(' و');
  };
  const scale = (r, i) => {
    if (i === 0) return chunk(r);
    const names = [null, ['ألف', 'ألفان', 'آلاف'], ['مليون', 'مليونان', 'ملايين'], ['مليار', 'ملياران', 'مليارات']][i];
    if (r === 1) return names[0];
    if (r === 2) return names[1];
    if (r >= 3 && r <= 10) return chunk(r) + ' ' + names[2];
    return chunk(r) + ' ' + names[0];
  };
  const parts = []; let i = 0;
  while (n > 0) { const r = n % 1000; if (r) parts.unshift(scale(r, i)); n = Math.floor(n / 1000); i++; }
  return parts.join(' و');
}

function amountWords(amount, sym) {
  const c = cur(sym);
  const total = Math.round(amount * c.minorDiv);
  const whole = Math.floor(total / c.minorDiv);
  const minor = total - whole * c.minorDiv;
  let en = `${numToWordsEN(whole)} ${whole === 1 ? c.en[0] : c.en[1]}`;
  if (minor > 0) en += ` and ${numToWordsEN(minor)} ${minor === 1 ? c.minorEn[0] : c.minorEn[1]}`;
  let ar = `${numToWordsAR(whole)} ${c.ar}`;
  if (minor > 0) ar += ` و${numToWordsAR(minor)} ${c.minorAr}`;
  return { en: en + ' Only', ar: ar + ' فقط لا غير' };
}

// ═══════════════════════════════════════════
// DOCUMENT TEMPLATE — shared by voucher and invoice
// ═══════════════════════════════════════════
function stampCell(stamp) {
  let inner = '';
  if (stamp === 'paid') inner = `<img src="${STAMP_URI}" alt="Company stamp">`;
  else if (stamp === 'unpaid') inner = `<div class="mark-txt unpaid">UNPAID<span class="ar">غير مدفوع</span></div>`;
  else if (stamp === 'draft') inner = `<div class="mark-txt draft">DRAFT<span class="ar">مسودة</span></div>`;
  return `<div class="sign">${inner}<div class="lbl"><span>Stamp and signature</span><span class="ar">الختم والتوقيع</span></div></div>`;
}

function titleBlock(stamp, docWord) {
  const s = settings;
  const phones = esc(s.gsm).split(/\s*[\/,]\s*/).filter(Boolean).join(' / ');
  return `
  <div class="foot">${stampCell(stamp)}</div>
  <div class="tb">
    <p class="contact">For queries regarding this ${docWord}, please contact us at <b>${phones}</b> or <b>${esc(s.email)}</b>.</p>
  </div>`;
}

function docHeader(titleURI, titleEN, titleAR) {
  return `
    <div class="head">
      <div class="brand">
        <div class="mark-col"><img class="mark" src="${MARK_URI}" alt="AOEC"><div class="services">${esc(settings.subEN)}</div></div>
        <span class="div"></span>
        <div>
          <img class="word" src="${WORD_URI}" alt="Arabian Oryx">
          <img class="en" src="${ENG_LINE_URI}" alt="Engineering Consultancy">
          <div class="arn">${esc(settings.compAR)}</div>
        </div>
      </div>
      <div class="doctype"><h1><img src="${titleURI}" alt="${titleEN}"></h1><div class="ar">${titleAR}</div></div>
    </div>`;
}

function linesTable(lines, sym) {
  const rows = lines.map((l, i) => `
    <tr><td class="no">${String(i + 1).padStart(2, '0')}</td>
      <td><div class="d1" dir="auto">${l.desc ? esc(l.desc) : '<span class="empty">—</span>'}</div></td>
      <td class="n">${num(l.amount, sym)}</td></tr>`).join('');
  return `
    <table>
      <thead><tr>
        <th>No.<span class="ar">م</span></th>
        <th>Description<span class="ar">البيان</span></th>
        <th class="n">Amount (${esc(sym)})<span class="ar">المبلغ</span></th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function summaryBlock(sub, vat, total, rate, sym, grandEN, grandAR) {
  const w = amountWords(total, sym);
  return `
    <div class="sum">
      <div class="words">
        <div class="lbl"><span>Amount in words</span><span class="ar">المبلغ كتابةً</span></div>
        <p>${w.en}</p>
        <p class="ar">${w.ar}</p>
      </div>
      <div class="tot">
        <div><span>Subtotal<span class="ar">المجموع</span></span><span>${num(sub, sym)}</span></div>
        <div><span>VAT ${vatLabel(rate)}<span class="ar">الضريبة</span></span><span>${num(vat, sym)}</span></div>
        <div class="grand"><span>${grandEN}<span class="ar">${grandAR}</span></span><strong>${money(total, sym)}</strong></div>
      </div>
    </div>`;
}

function sheet(body, stamp, lineCount = 1, docWord = 'document') {
  // Tighten the table on long invoices so they still fit one A4 sheet.
  const density = lineCount > 14 ? ' denser' : lineCount > 8 ? ' dense' : '';
  return `<div class="sheet${density}"><div class="frame"><div class="inner">${body}</div>${titleBlock(stamp, docWord)}</div></div>`;
}

// ═══════════════════════════════════════════
// RECEIPT VOUCHER
// ═══════════════════════════════════════════
function selectPayment(method, btn) {
  currentPayMethod = method;
  document.querySelectorAll('.pay-tab').forEach(tb => tb.classList.toggle('active', tb === btn));
  $('cheque-fields').hidden = method !== 'cheque';
  $('bank-fields').hidden = method !== 'bank';
  updatePreview();
}

function calcAmounts() {
  const sym = $('currency').value;
  const raw = roundCur(parseFloat($('amount').value) || 0, sym);
  const vatRate = parseFloat($('vatRate').value) || 0;
  const vat = roundCur(raw * vatRate / 100, sym);
  return { raw, vat, total: roundCur(raw + vat, sym), vatRate, sym };
}

function receiptData() {
  const a = calcAmounts();
  return {
    type: 'receipt',
    num: $('recNum').value.trim() || 'RV-001',
    date: $('recDate').value,
    client: $('clientName').value.trim(),
    description: $('description').value.trim(),
    amount: a.raw, vat: a.vat, total: a.total, vatRate: a.vatRate, sym: a.sym,
    payMethod: currentPayMethod,
    chequeNo: $('chequeNo').value.trim(),
    bankName: currentPayMethod === 'bank' ? $('bankName2').value.trim() : $('bankName').value.trim(),
    stamp: $('stamp').value
  };
}

function receiptHTML(r) {
  const pay = { cash: ['Cash', 'نقداً'], cheque: ['Cheque', 'شيك'], bank: ['Bank transfer', 'تحويل بنكي'] }[r.payMethod] || ['Cash', 'نقداً'];
  let payExtra = '';
  if (r.payMethod === 'cheque' && r.chequeNo) payExtra += `No. ${esc(r.chequeNo)}`;
  if (r.payMethod !== 'cash' && r.bankName) payExtra += (payExtra ? ', ' : '') + `<span dir="auto">${esc(r.bankName)}</span>`;
  const body = `
    ${docHeader(TITLE_RECEIPT_URI, 'Receipt Voucher', 'سند قبض')}
    <div class="grid g4">
      <div class="cell"><div class="lbl"><span>Received from</span><span class="ar">استلمنا من</span></div>
        <div class="val big" dir="auto">${esc(r.client) || '—'}</div></div>
      <div class="cell"><div class="lbl"><span>Receipt no.</span><span class="ar">رقم السند</span></div><div class="val">${esc(r.num)}</div></div>
      <div class="cell"><div class="lbl"><span>Date</span><span class="ar">التاريخ</span></div><div class="val">${fmtDate(r.date)}</div></div>
      <div class="cell"><div class="lbl"><span>Paid by</span><span class="ar">طريقة الدفع</span></div><div class="val">${pay[0]} <span class="ar val-ar">${pay[1]}</span></div>${payExtra ? `<div class="sub">${payExtra}</div>` : ''}</div>
    </div>
    ${linesTable([{ desc: r.description, amount: r.amount }], r.sym).replace('<th>Description<span class="ar">البيان</span></th>', '<th>Being settlement of<span class="ar">وذلك عن</span></th>')}
    ${summaryBlock(r.amount, r.vat, r.total, r.vatRate, r.sym, 'Total received', 'المبلغ المستلم')}`;
  return sheet(body, r.stamp, 1, 'receipt');
}

function updatePreview() {
  const r = receiptData();
  $('totalDisplay').textContent = money(r.total, r.sym);
  $('receiptPreview').innerHTML = receiptHTML(r);
  fitSheet('receiptScaler');
}

// ═══════════════════════════════════════════
// TAX INVOICE
// ═══════════════════════════════════════════
let invoiceItems = [];
let invItemIdCounter = 0;
const newInvoiceItemId = () => 'item_' + (++invItemIdCounter);

function initInvoiceDefaults() {
  if (invoiceItems.length === 0) invoiceItems.push({ id: newInvoiceItemId(), desc: '', amount: 0 });
  if (!$('invDate').value) $('invDate').value = isoToday();
  if (!$('invDueDate').value) {
    const due = new Date(); due.setDate(due.getDate() + 30);
    $('invDueDate').value = new Date(due.getTime() - due.getTimezoneOffset() * 60000).toISOString().split('T')[0];
  }
}

function renderInvoiceItemsForm() {
  const c = $('invItemsList');
  c.innerHTML = invoiceItems.map((it, i) => `
    <div class="inv-item-row">
      <div class="field">
        <label for="desc-${it.id}">${t('Description', 'البيان')} ${i + 1}</label>
        <textarea id="desc-${it.id}" dir="auto" rows="2" placeholder="${t('Service or payment stage', 'الخدمة أو الدفعة')}"
          oninput="updateInvoiceItem('${it.id}','desc',this.value)">${esc(it.desc)}</textarea>
      </div>
      <div class="field">
        <label for="amt-${it.id}">${t('Amount', 'المبلغ')}</label>
        <input id="amt-${it.id}" type="number" inputmode="decimal" min="0" step="any" value="${it.amount || ''}" placeholder="0"
          oninput="updateInvoiceItem('${it.id}','amount',this.value)">
      </div>
      <button type="button" class="inv-item-del" onclick="removeInvoiceItem('${it.id}')" aria-label="${t('Remove line', 'حذف البند')}" title="${t('Remove line', 'حذف البند')}">×</button>
    </div>`).join('');
}

function addInvoiceItem() {
  invoiceItems.push({ id: newInvoiceItemId(), desc: '', amount: 0 });
  renderInvoiceItemsForm();
  updateInvoicePreview();
  const last = invoiceItems[invoiceItems.length - 1];
  const el = $('desc-' + last.id); if (el) el.focus();
}

function removeInvoiceItem(id) {
  if (invoiceItems.length <= 1) { showToast(t('An invoice needs at least one line.', 'يجب أن تحتوي الفاتورة على بند واحد على الأقل.')); return; }
  invoiceItems = invoiceItems.filter(it => it.id !== id);
  renderInvoiceItemsForm();
  updateInvoicePreview();
}

function updateInvoiceItem(id, field, value) {
  const item = invoiceItems.find(it => it.id === id);
  if (!item) return;
  if (field === 'desc') item.desc = value;
  else item.amount = parseFloat(value) || 0;
  updateInvoicePreview(); // never re-render the form here — it would steal focus
}

function invoiceData() {
  const sym = $('invCurrency').value;
  const lines = invoiceItems.map(it => ({ desc: it.desc.trim(), amount: roundCur(it.amount, sym) }));
  const subtotal = roundCur(lines.reduce((s, l) => s + l.amount, 0), sym);
  const vatRate = parseFloat($('invVatRate').value) || 0;
  const vat = roundCur(subtotal * vatRate / 100, sym);
  return {
    type: 'invoice',
    num: $('invNum').value.trim() || 'INV-001',
    date: $('invDate').value,
    dueDate: $('invDueDate').value,
    client: $('invClientName').value.trim(),
    clientAddr: $('invClientAddr').value.trim(),
    items: lines,
    notes: $('invNotes').value.trim(),
    subtotal, vat, total: roundCur(subtotal + vat, sym), vatRate, sym,
    stamp: $('invStamp').value
  };
}

function invoiceHTML(d) {
  const body = `
    ${docHeader(TITLE_INVOICE_URI, 'Tax Invoice', 'فاتورة ضريبية')}
    <div class="grid g4">
      <div class="cell"><div class="lbl"><span>Bill to</span><span class="ar">فاتورة إلى</span></div>
        <div class="val big" dir="auto">${esc(d.client) || '—'}</div>
        ${d.clientAddr ? `<div class="sub" dir="auto">${esc(d.clientAddr)}</div>` : ''}</div>
      <div class="cell"><div class="lbl"><span>Invoice no.</span><span class="ar">رقم الفاتورة</span></div><div class="val">${esc(d.num)}</div></div>
      <div class="cell"><div class="lbl"><span>Issue date</span><span class="ar">التاريخ</span></div><div class="val">${fmtDate(d.date)}</div></div>
      <div class="cell"><div class="lbl"><span>Due date</span><span class="ar">الاستحقاق</span></div><div class="val">${fmtDate(d.dueDate)}</div></div>
    </div>
    ${linesTable(d.items, d.sym)}
    ${summaryBlock(d.subtotal, d.vat, d.total, d.vatRate, d.sym, 'Total due', 'الإجمالي المستحق')}
    ${d.notes ? `<p class="notes" dir="auto"><b>Notes.</b> ${esc(d.notes)}</p>` : ''}`;
  return sheet(body, d.stamp, d.items.length, 'invoice');
}

function updateInvoicePreview() {
  const d = invoiceData();
  $('invTotalDisplay').textContent = money(d.total, d.sym);
  $('invoicePreview').innerHTML = invoiceHTML(d);
  fitSheet('invoiceScaler');
}

// ═══════════════════════════════════════════
// SAVE, PRINT, PDF
// ═══════════════════════════════════════════
function saveRecord(rec) {
  rec.id = Date.now();
  rec.savedAt = new Date().toISOString();
  // Printing the same number twice updates the saved copy instead of duplicating it.
  receipts = receipts.filter(r => !(r.type === rec.type && r.num === rec.num));
  receipts.unshift(rec);
  try { localStorage.setItem('ao_receipts', JSON.stringify(receipts)); } catch (e) {}
}

function bumpNumber(inputId, refresh) {
  const el = $(inputId);
  const m = el.value.match(/^(.*?)(\d+)$/);
  if (m) { el.value = m[1] + String(parseInt(m[2], 10) + 1).padStart(m[2].length, '0'); refresh(); }
}

async function fontsReady() {
  try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch (e) {}
}

// Print the true-size A4 copy with the browser's own print engine (sharp vector text).
async function printDoc(html, title) {
  const root = $('printRoot');
  root.innerHTML = html;
  await fontsReady();
  await Promise.all([...root.querySelectorAll('img')].map(img => img.complete ? 0 : new Promise(res => { img.onload = img.onerror = res; })));
  const s = root.querySelector('.sheet');
  if (s && s.scrollHeight > 1130) s.classList.add('long');
  const oldTitle = document.title;
  document.title = title;
  window.print();
  setTimeout(() => { document.title = oldTitle; }, 500);
}

async function exportDocPDF(html, filename) {
  showToast(t('Preparing PDF…', 'جاري تجهيز ملف PDF…'));
  const root = $('printRoot');
  root.innerHTML = html;
  await fontsReady();
  const el = root.querySelector('.sheet');
  try {
    const canvas = await html2canvas(el, { scale: 3, backgroundColor: '#ffffff', logging: false, useCORS: true });
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const pageW = 210, pageH = 297;
    const pxPerMm = canvas.width / pageW;
    const pagePx = Math.round(pageH * pxPerMm);
    // Keep the true proportions; split onto extra pages only if the document is longer than A4.
    for (let y = 0, page = 0; y < canvas.height - 4; y += pagePx, page++) {
      const h = Math.min(pagePx, canvas.height - y);
      const slice = document.createElement('canvas');
      slice.width = canvas.width; slice.height = h;
      slice.getContext('2d').drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
      if (page) pdf.addPage();
      pdf.addImage(slice.toDataURL('image/png'), 'PNG', 0, 0, pageW, h / pxPerMm, undefined, 'FAST');
    }
    downloadPDFBlob(pdf, filename);
  } catch (err) {
    console.error('PDF export failed:', err);
    showToast(t('The PDF could not be created. Use Save and print, then choose Save as PDF.', 'تعذر إنشاء ملف PDF. استخدم حفظ وطباعة ثم اختر الحفظ كـ PDF.'));
  } finally {
    root.innerHTML = '';
  }
}

function downloadPDFBlob(pdf, filename) {
  try {
    const blob = pdf.output('blob');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.style.display = 'none';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    showToast(t('PDF downloaded', 'تم تنزيل ملف PDF'));
  } catch (e) {
    try { window.open(URL.createObjectURL(pdf.output('blob')), '_blank'); showToast(t('PDF opened in a new tab. Save it from there.', 'تم فتح الملف في تبويب جديد. احفظه من هناك.')); }
    catch (e2) { showToast(t('Download failed. Try another browser.', 'فشل التنزيل. جرّب متصفحاً آخر.')); }
  }
}

const fileBase = num => `${settings.compEN.replace(/[^\w]+/g, '_')}_${String(num).replace(/[^\w-]+/g, '_')}.pdf`;

// receipt actions
function printReceipt() {
  const r = receiptData();
  saveRecord({ ...r });
  printDoc(receiptHTML(r), `Receipt ${r.num}`).then(() => bumpNumber('recNum', updatePreview));
}
function saveAndExportPDF() {
  const r = receiptData();
  saveRecord({ ...r });
  exportDocPDF(receiptHTML(r), fileBase(r.num)).then(() => bumpNumber('recNum', updatePreview));
}
// invoice actions
function printInvoice() {
  const d = invoiceData();
  saveRecord({ ...d });
  printDoc(invoiceHTML(d), `Invoice ${d.num}`).then(() => bumpNumber('invNum', updateInvoicePreview));
}
function saveAndExportInvoicePDF() {
  const d = invoiceData();
  saveRecord({ ...d });
  exportDocPDF(invoiceHTML(d), fileBase(d.num)).then(() => bumpNumber('invNum', updateInvoicePreview));
}

// ── CLEAR ──
function clearForm() {
  ['clientName', 'description', 'chequeNo', 'bankName', 'bankName2'].forEach(id => { $(id).value = ''; });
  $('amount').value = '0';
  $('vatRate').value = '5';
  $('stamp').value = 'paid';
  selectPayment('cash', document.querySelector('.pay-tab[data-method="cash"]'));
  setTodayDate();
  updatePreview();
}
function clearInvoiceForm() {
  ['invClientName', 'invClientAddr', 'invNotes', 'invDate', 'invDueDate'].forEach(id => { $(id).value = ''; });
  $('invVatRate').value = '5';
  $('invStamp').value = 'paid';
  invoiceItems = [];
  initInvoiceDefaults();
  renderInvoiceItemsForm();
  updateInvoicePreview();
}

// ═══════════════════════════════════════════
// HISTORY
// ═══════════════════════════════════════════
// Older invoices stored qty × price; newer ones store one amount per line.
function normalizeLines(r) {
  return (r.items || []).map(it => ({
    desc: it.desc || '',
    amount: it.amount != null ? +it.amount : (+it.qty || 0) * (+it.price || 0)
  }));
}

function renderHistory() {
  const c = $('historyList');
  if (!receipts.length) {
    c.innerHTML = `<div class="history-empty">${t('Nothing saved yet. Vouchers and invoices appear here after you print or download them.', 'لا توجد مستندات محفوظة بعد. تظهر هنا بعد الطباعة أو التنزيل.')}</div>`;
    return;
  }
  c.innerHTML = receipts.map((r, i) => {
    const isInv = r.type === 'invoice';
    return `
    <div class="history-item">
      <div class="history-item-info">
        <div class="history-item-num">${esc(r.num)}<span class="hist-type">${isInv ? t('Tax invoice', 'فاتورة ضريبية') : t('Receipt voucher', 'سند قبض')}</span></div>
        <div class="history-item-client" dir="auto">${esc(r.client || '—')}</div>
        <div class="history-item-date">${fmtDate(r.date)}</div>
      </div>
      <div class="history-item-total">${esc(r.sym)} ${num(r.total, r.sym)}</div>
      <div class="history-item-actions">
        <button class="hist-btn" onclick="openFromHistory(${i})">${t('Open', 'فتح')}</button>
        <button class="hist-btn" onclick="reprintFromHistory(${i})">${t('Print', 'طباعة')}</button>
        <button class="hist-btn hist-btn-del" onclick="deleteReceipt(${i})">${t('Delete', 'حذف')}</button>
      </div>
    </div>`;
  }).join('');
}

function deleteReceipt(i) {
  const r = receipts[i];
  if (!confirm(t(`Delete ${r.num}? This can't be undone.`, `حذف ${r.num}؟ لا يمكن التراجع عن ذلك.`))) return;
  receipts.splice(i, 1);
  try { localStorage.setItem('ao_receipts', JSON.stringify(receipts)); } catch (e) {}
  renderHistory();
  showToast(t('Deleted', 'تم الحذف'));
}

function loadIntoForm(r) {
  if (r.type === 'invoice') {
    $('invNum').value = r.num;
    $('invDate').value = r.date || '';
    $('invDueDate').value = r.dueDate || '';
    $('invClientName').value = r.client === '—' ? '' : (r.client || '');
    $('invClientAddr').value = r.clientAddr || '';
    $('invNotes').value = r.notes || '';
    $('invVatRate').value = r.vatRate != null ? r.vatRate : 5;
    $('invStamp').value = r.stamp || 'paid';
    $('invCurrency').value = r.sym || 'R.O.';
    invoiceItems = normalizeLines(r).map(l => ({ id: newInvoiceItemId(), ...l }));
    if (!invoiceItems.length) invoiceItems = [{ id: newInvoiceItemId(), desc: '', amount: 0 }];
    renderInvoiceItemsForm();
    showPage('new-invoice');
  } else {
    $('recNum').value = r.num;
    $('recDate').value = r.date || '';
    $('clientName').value = r.client === '—' ? '' : (r.client || '');
    $('description').value = r.description || '';
    $('amount').value = r.amount || 0;
    $('vatRate').value = r.vatRate != null ? r.vatRate : 5;
    $('stamp').value = r.stamp || 'paid';
    $('currency').value = r.sym || 'R.O.';
    $('chequeNo').value = r.chequeNo || '';
    $('bankName').value = r.payMethod === 'cheque' ? (r.bankName || '') : '';
    $('bankName2').value = r.payMethod === 'bank' ? (r.bankName || '') : '';
    selectPayment(r.payMethod || 'cash', document.querySelector(`.pay-tab[data-method="${r.payMethod || 'cash'}"]`));
    showPage('new-receipt');
  }
}

function openFromHistory(i) { loadIntoForm(receipts[i]); }

function reprintFromHistory(i) {
  const r = receipts[i];
  loadIntoForm(r);
  // Reprint without re-saving or changing the next number.
  if (r.type === 'invoice') printDoc(invoiceHTML(invoiceData()), `Invoice ${r.num}`);
  else printDoc(receiptHTML(receiptData()), `Receipt ${r.num}`);
}

// ═══════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════
const SETTING_KEYS = ['compEN', 'compAR', 'subEN', 'tagline', 'cr', 'pobox', 'gsm', 'email', 'addr', 'addrAR'];
function loadSettingsToForm() { SETTING_KEYS.forEach(k => { $('s-' + k).value = settings[k] || ''; }); }
function saveSettings() {
  SETTING_KEYS.forEach(k => { settings[k] = $('s-' + k).value; });
  try {
    localStorage.setItem('ao_settings', JSON.stringify(settings));
    localStorage.setItem('ao_settings_version', String(SETTINGS_VERSION));
  } catch (e) {}
  updatePreview();
  updateInvoicePreview();
}
function resetSettings() {
  settings = { ...DEFAULT_SETTINGS };
  loadSettingsToForm();
  saveSettings();
  showToast(t('Original details restored', 'تمت استعادة البيانات الأصلية'));
}

// ── TOAST ──
let toastTimer;
function showToast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

// ── SERVICE WORKER (offline use) ──
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
