/* global pdfjsLib, Tesseract */
(() => {
  'use strict';

  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  const PRODUCT_DICTIONARY_KEY = 'tire-size-analyzer-product-dictionary-v1';
  const BUILTIN_PRODUCT_NAMES = {
    '01642920': 'オートバックス マックスラン エクセラ',
    '01642921': 'オートバックス マックスラン エクセラ',
    '01642923': 'オートバックス マックスラン エクセラ',
    '01642924': 'オートバックス マックスラン エクセラ',
    '01642925': 'オートバックス マックスラン エクセラ',
    '01642926': 'オートバックス マックスラン エクセラ',
    '01642927': 'オートバックス マックスラン エクセラ',
    '01642928': 'オートバックス マックスラン エクセラ',
    '01642929': 'オートバックス マックスラン エクセラ',
    '01642932': 'オートバックス マックスラン エクセラ',
    '01642934': 'オートバックス マックスラン エクセラ',
    '01642935': 'オートバックス マックスラン エクセラ',
    '01642939': 'オートバックス マックスラン エクセラ',
    '01319975': 'ファルケン シンセラ SN832i',
    '01319988': 'ファルケン シンセラ SN832i',
    '01506300': 'ダンロップ エナセーブ EC204',
    '01506326': 'ダンロップ エナセーブ EC204',
    '01838701': 'ダンロップ エナセーブ EC205',
    '01838712': 'ダンロップ エナセーブ EC205',
    '01838715': 'ダンロップ エナセーブ EC205',
    '01838717': 'ダンロップ エナセーブ EC205',
    '01838721': 'ダンロップ エナセーブ EC205',
    '01838722': 'ダンロップ エナセーブ EC205',
    '01838723': 'ダンロップ エナセーブ EC205',
    '01838727': 'ダンロップ エナセーブ EC205',
    '01838728': 'ダンロップ エナセーブ EC205',
    '01838732': 'ダンロップ エナセーブ EC205',
    '01577473': 'ダンロップ エナセーブ RV505',
    '01367685': 'ダンロップ エナセーブ VAN01',
    '01771342': 'ダンロップ シンクロウェザー',
    '01831015': 'ダンロップ シンクロウェザー',
    '01676476': 'ヨコハマ ブルーアースES ES32',
    '01676484': 'ヨコハマ ブルーアースES ES32',
    '01676507': 'ヨコハマ ブルーアースES ES32',
  };

  const els = {
    dropZone: document.getElementById('dropZone'),
    fileInput: document.getElementById('fileInput'),
    fileList: document.getElementById('fileList'),
    analyzeBtn: document.getElementById('analyzeBtn'),
    clearBtn: document.getElementById('clearBtn'),
    progressArea: document.getElementById('progressArea'),
    progressText: document.getElementById('progressText'),
    progressPercent: document.getElementById('progressPercent'),
    progressBar: document.getElementById('progressBar'),
    progressDetail: document.getElementById('progressDetail'),
    errorBox: document.getElementById('errorBox'),
    resultSection: document.getElementById('resultSection'),
    sizeCount: document.getElementById('sizeCount'),
    totalQty: document.getElementById('totalQty'),
    rowCount: document.getElementById('rowCount'),
    warningCount: document.getElementById('warningCount'),
    summaryBody: document.getElementById('summaryBody'),
    detailBody: document.getElementById('detailBody'),
    warningPanel: document.getElementById('warningPanel'),
    warningList: document.getElementById('warningList'),
    exportSummaryBtn: document.getElementById('exportSummaryBtn'),
    exportDetailBtn: document.getElementById('exportDetailBtn'),
    sizeFilter: document.getElementById('sizeFilter'),
    renderScale: document.getElementById('renderScale'),
    quantityX: document.getElementById('quantityX'),
    quantityTolerance: document.getElementById('quantityTolerance'),
    enhanceImage: document.getElementById('enhanceImage'),
  };

  const state = {
    files: [],
    rows: [],
    warnings: [],
    running: false,
    productDictionary: loadProductDictionary(),
  };

  const SIZE_RE = /(\d{3})\s*[\/／]\s*(\d{2})\s*[RＲ]\s*(\d{2})/i;

  els.dropZone.addEventListener('click', () => els.fileInput.click());
  els.dropZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      els.fileInput.click();
    }
  });
  ['dragenter', 'dragover'].forEach((eventName) => {
    els.dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      els.dropZone.classList.add('dragover');
    });
  });
  ['dragleave', 'drop'].forEach((eventName) => {
    els.dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      els.dropZone.classList.remove('dragover');
    });
  });
  els.dropZone.addEventListener('drop', (e) => setFiles([...e.dataTransfer.files]));
  els.fileInput.addEventListener('change', (e) => setFiles([...e.target.files]));
  els.analyzeBtn.addEventListener('click', analyzeFiles);
  els.clearBtn.addEventListener('click', clearAll);
  els.exportSummaryBtn.addEventListener('click', exportSummaryCsv);
  els.exportDetailBtn.addEventListener('click', exportDetailCsv);
  els.sizeFilter.addEventListener('input', renderSummary);

  function setFiles(files) {
    const pdfs = files.filter((file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
    state.files = pdfs;
    els.fileInput.value = '';
    renderFileList();
    els.analyzeBtn.disabled = pdfs.length === 0 || state.running;
    els.clearBtn.disabled = pdfs.length === 0 || state.running;
    hideError();
  }

  function renderFileList() {
    if (!state.files.length) {
      els.fileList.className = 'file-list empty';
      els.fileList.textContent = 'PDFが選択されていません';
      return;
    }
    els.fileList.className = 'file-list';
    els.fileList.innerHTML = state.files.map((file) =>
      `<span class="file-chip">${escapeHtml(file.name)} <span>${formatBytes(file.size)}</span></span>`
    ).join('');
  }

  function clearAll() {
    if (state.running) return;
    state.files = [];
    state.rows = [];
    state.warnings = [];
    renderFileList();
    els.analyzeBtn.disabled = true;
    els.clearBtn.disabled = true;
    els.resultSection.classList.add('hidden');
    els.progressArea.classList.add('hidden');
    hideError();
  }

  async function analyzeFiles() {
    if (!state.files.length || state.running) return;

    state.running = true;
    state.rows = [];
    state.warnings = [];
    els.analyzeBtn.disabled = true;
    els.clearBtn.disabled = true;
    els.resultSection.classList.add('hidden');
    els.progressArea.classList.remove('hidden');
    hideError();
    setProgress(0, 'OCRエンジンを準備中...', '初回は日本語データを読み込みます');

    let worker;
    try {
      worker = await Tesseract.createWorker(['jpn', 'eng'], 1, {
        logger: (message) => {
          if (message.status === 'recognizing text' && Number.isFinite(message.progress)) {
            const percent = Math.round(message.progress * 100);
            els.progressDetail.textContent = `OCR処理 ${percent}%`;
          }
        },
      });
      await worker.setParameters({
        tessedit_pageseg_mode: '6',
        preserve_interword_spaces: '1',
      });

      const docs = [];
      let totalPages = 0;
      for (const file of state.files) {
        const data = new Uint8Array(await file.arrayBuffer());
        const pdf = await pdfjsLib.getDocument({ data }).promise;
        docs.push({ file, pdf });
        totalPages += pdf.numPages;
      }

      let completed = 0;
      for (const { file, pdf } of docs) {
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          const base = completed / totalPages;
          setProgress(base * 100, `${escapeText(file.name)} - ${pageNumber}/${pdf.numPages}頁`, 'PDFを画像化しています');
          const page = await pdf.getPage(pageNumber);
          const scale = Number(els.renderScale.value) || 3.5;
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const context = canvas.getContext('2d', { willReadFrequently: true });
          await page.render({ canvasContext: context, viewport }).promise;

          const crop = cropReportBody(canvas);
          if (els.enhanceImage.checked) enhanceCanvas(crop.canvas);

          const pageBase = completed / totalPages;
          setProgress(pageBase * 100, `${escapeText(file.name)} - ${pageNumber}/${pdf.numPages}頁`, '商品名・サイズ・数量を読み取っています');

          const result = await worker.recognize(crop.canvas, {}, { text: true, tsv: true });
          const parsed = parseTsv(
            result.data.tsv || '',
            file.name,
            pageNumber,
            canvas.width,
            crop.x,
            Number(els.quantityX.value) / 100,
            Number(els.quantityTolerance.value) / 100,
          );
          state.rows.push(...parsed.rows);
          state.warnings.push(...parsed.warnings);

          canvas.width = 1;
          canvas.height = 1;
          crop.canvas.width = 1;
          crop.canvas.height = 1;
          completed += 1;
          setProgress((completed / totalPages) * 100, `${escapeText(file.name)} - ${pageNumber}/${pdf.numPages}頁 完了`, `${parsed.rows.length}行を抽出`);
        }
      }

      if (!state.rows.length) {
        throw new Error('タイヤサイズと数量を抽出できませんでした。読み取り設定の数量列位置を調整してください。');
      }

      renderAll();
      els.resultSection.classList.remove('hidden');
      setProgress(100, '集計が完了しました', `${state.rows.length}行を抽出しました`);
    } catch (error) {
      console.error(error);
      showError(error instanceof Error ? error.message : String(error));
    } finally {
      if (worker) await worker.terminate();
      state.running = false;
      els.analyzeBtn.disabled = state.files.length === 0;
      els.clearBtn.disabled = state.files.length === 0;
    }
  }

  function cropReportBody(source) {
    // 添付帳票の固定レイアウトに合わせ、商品コード～売上数量列だけをOCRする。
    const x = Math.floor(source.width * 0.22);
    const y = Math.floor(source.height * 0.13);
    const right = Math.floor(source.width * 0.68);
    const bottom = Math.floor(source.height * 0.97);
    const width = Math.max(1, right - x);
    const height = Math.max(1, bottom - y);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(source, x, y, width, height, 0, 0, width, height);
    return { canvas, x, y };
  }

  function enhanceCanvas(canvas) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = image.data;
    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
      const enhanced = Math.max(0, Math.min(255, 255 - (255 - gray) * 1.35));
      data[i] = enhanced;
      data[i + 1] = enhanced;
      data[i + 2] = enhanced;
    }
    ctx.putImageData(image, 0, 0);
  }

  function parseTsv(tsv, fileName, pageNumber, fullWidth, cropX, quantityRatio, tolerance) {
    const rows = [];
    const warnings = [];
    const lines = new Map();
    const rawRows = tsv.trim().split(/\r?\n/);

    for (let i = 1; i < rawRows.length; i += 1) {
      const cols = rawRows[i].split('\t');
      if (cols.length < 12 || cols[0] !== '5') continue;
      const text = cols.slice(11).join('\t').trim();
      if (!text) continue;
      const word = {
        page: Number(cols[1]),
        block: Number(cols[2]),
        par: Number(cols[3]),
        line: Number(cols[4]),
        left: Number(cols[6]),
        top: Number(cols[7]),
        width: Number(cols[8]),
        height: Number(cols[9]),
        conf: Number(cols[10]),
        text,
      };
      const key = `${word.page}-${word.block}-${word.par}-${word.line}`;
      if (!lines.has(key)) lines.set(key, []);
      lines.get(key).push(word);
    }

    for (const words of lines.values()) {
      words.sort((a, b) => a.left - b.left);
      const rawLine = words.map((word) => word.text).join(' ');
      const normalizedLine = normalizeOcr(rawLine);
      const sizeMatch = normalizedLine.match(SIZE_RE);
      if (!sizeMatch) continue;

      const size = `${sizeMatch[1]}/${sizeMatch[2]}R${sizeMatch[3]}`;
      const sizeSpan = findSizeWordSpan(words);
      const quantityCandidates = words
        .filter((word) => /^\d{1,5}$/.test(toHalfWidth(word.text)))
        .map((word) => ({
          ...word,
          value: Number(toHalfWidth(word.text)),
          xRatio: (cropX + word.left + word.width / 2) / fullWidth,
        }))
        .filter((word) => Math.abs(word.xRatio - quantityRatio) <= tolerance)
        .sort((a, b) => Math.abs(a.xRatio - quantityRatio) - Math.abs(b.xRatio - quantityRatio));

      if (!quantityCandidates.length) {
        warnings.push({ type: 'quantity', fileName, pageNumber, size, rawLine });
        continue;
      }

      const quantityWord = quantityCandidates[0];
      const sizeWords = sizeSpan ? words.slice(sizeSpan.start, sizeSpan.end + 1) : words.filter((word) => SIZE_RE.test(normalizeOcr(word.text)));
      const sizeConf = sizeWords.length ? average(sizeWords.map((word) => word.conf)) : 70;
      const productInfo = extractProductInfo(words, sizeSpan);
      const productName = resolveProductName(productInfo.productCode, productInfo.ocrProductName);
      const productConf = productInfo.productWords.length ? average(productInfo.productWords.map((word) => word.conf)) : 50;
      const confidence = Math.max(0, Math.min(100, Math.round((sizeConf + quantityWord.conf + productConf) / 3)));

      if (!productInfo.productCode || !productName || productName === '商品名未検出') {
        warnings.push({ type: 'product', fileName, pageNumber, size, rawLine });
      }

      rows.push({
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        fileName,
        pageNumber,
        productCode: productInfo.productCode,
        productName,
        ocrProductName: productInfo.ocrProductName,
        size,
        quantity: quantityWord.value,
        confidence,
        rawLine,
      });
    }
    return { rows, warnings };
  }

  function findSizeWordSpan(words) {
    for (let length = 1; length <= Math.min(4, words.length); length += 1) {
      for (let start = 0; start <= words.length - length; start += 1) {
        const end = start + length - 1;
        const candidate = normalizeOcr(words.slice(start, end + 1).map((word) => word.text).join(''));
        if (SIZE_RE.test(candidate)) return { start, end };
      }
    }
    return null;
  }

  function extractProductInfo(words, sizeSpan) {
    const sizeStart = sizeSpan ? sizeSpan.start : words.length;
    let codeIndex = -1;
    let productCode = '';

    for (let i = 0; i < sizeStart; i += 1) {
      const compact = toHalfWidth(words[i].text).replace(/\s/g, '');
      const digits = compact.replace(/\D/g, '');
      if (digits.length === 8 && digits.length / Math.max(compact.length, 1) >= 0.75) {
        codeIndex = i;
        productCode = digits;
        break;
      }
    }

    const productWords = words.slice(codeIndex >= 0 ? codeIndex + 1 : 0, sizeStart);
    const ocrProductName = cleanProductName(productWords.map((word) => word.text).join(' '));
    return { productCode, ocrProductName, productWords };
  }

  function cleanProductName(value) {
    return String(value || '')
      .normalize('NFKC')
      .replace(/[\t\r\n]+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^[\s,.;:|・\/\\_-]+|[\s,.;:|・\/\\_-]+$/g, '')
      .trim();
  }

  function resolveProductName(productCode, ocrName) {
    const saved = productCode ? state.productDictionary[productCode] : '';
    const builtIn = productCode ? BUILTIN_PRODUCT_NAMES[productCode] : '';
    return cleanProductName(saved || builtIn || ocrName) || '商品名未検出';
  }

  function loadProductDictionary() {
    try {
      const parsed = JSON.parse(localStorage.getItem(PRODUCT_DICTIONARY_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      console.warn('商品名辞書を読み込めませんでした', error);
      return {};
    }
  }

  function saveProductDictionary() {
    try {
      localStorage.setItem(PRODUCT_DICTIONARY_KEY, JSON.stringify(state.productDictionary));
    } catch (error) {
      console.warn('商品名辞書を保存できませんでした', error);
    }
  }

  function normalizeOcr(value) {
    return toHalfWidth(value)
      .replace(/[／]/g, '/')
      .replace(/[Ｒｒ]/g, 'R')
      .replace(/\s*\/\s*/g, '/')
      .replace(/\s*[Rr]\s*/g, 'R')
      .toUpperCase();
  }

  function toHalfWidth(value) {
    return String(value).replace(/[！-～]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xFEE0)).replace(/　/g, ' ');
  }

  function renderAll() {
    renderSummary();
    renderDetails();
    renderWarnings();
    const summary = aggregateRowsByProduct();
    els.sizeCount.textContent = summary.length.toLocaleString('ja-JP');
    els.totalQty.textContent = state.rows.reduce((sum, row) => sum + validQuantity(row.quantity), 0).toLocaleString('ja-JP');
    els.rowCount.textContent = state.rows.length.toLocaleString('ja-JP');
    els.warningCount.textContent = state.warnings.length.toLocaleString('ja-JP');
  }

  function aggregateRowsByProduct() {
    const sizeMap = new Map();
    for (const row of state.rows) {
      const size = standardizeSize(row.size);
      const quantity = validQuantity(row.quantity);
      if (!size || quantity < 0) continue;

      if (!sizeMap.has(size)) sizeMap.set(size, { size, quantity: 0, products: new Map() });
      const sizeGroup = sizeMap.get(size);
      sizeGroup.quantity += quantity;

      const productName = cleanProductName(row.productName) || '商品名未検出';
      const productKey = row.productCode ? `code:${row.productCode}` : `name:${normalizeProductKey(productName)}`;
      if (!sizeGroup.products.has(productKey)) {
        sizeGroup.products.set(productKey, {
          productCode: row.productCode || '',
          productName,
          quantity: 0,
          confidence: row.confidence || 0,
        });
      }
      const product = sizeGroup.products.get(productKey);
      product.quantity += quantity;
      if ((!product.productName || product.productName === '商品名未検出') && productName !== '商品名未検出') {
        product.productName = productName;
      } else if ((row.confidence || 0) > product.confidence && productName !== '商品名未検出') {
        product.productName = productName;
        product.confidence = row.confidence || 0;
      }
    }

    return [...sizeMap.values()]
      .map((group) => ({
        size: group.size,
        quantity: group.quantity,
        products: [...group.products.values()].sort((a, b) => b.quantity - a.quantity || a.productName.localeCompare(b.productName, 'ja')),
      }))
      .sort((a, b) => compareSizes(a.size, b.size));
  }

  function normalizeProductKey(value) {
    return cleanProductName(value).toUpperCase().replace(/[\s・･\-ー_\/\\.,'"`]/g, '');
  }

  function renderSummary() {
    const rawFilter = (els.sizeFilter.value || '').trim();
    const normalizedSizeFilter = normalizeOcr(rawFilter);
    const normalizedProductFilter = normalizeProductKey(rawFilter);
    const allGroups = aggregateRowsByProduct();
    const total = state.rows.reduce((sum, row) => sum + validQuantity(row.quantity), 0);

    const groups = allGroups.map((group) => {
      if (!rawFilter) return group;
      const sizeMatches = group.size.includes(normalizedSizeFilter);
      const products = sizeMatches
        ? group.products
        : group.products.filter((product) =>
          normalizeProductKey(product.productName).includes(normalizedProductFilter) || product.productCode.includes(rawFilter)
        );
      return products.length ? { ...group, products } : null;
    }).filter(Boolean);

    if (!groups.length) {
      els.summaryBody.innerHTML = '<tr><td colspan="5" class="empty-row">該当するサイズ・商品がありません</td></tr>';
      return;
    }

    els.summaryBody.innerHTML = groups.map((group) => {
      const ratio = total ? (group.quantity / total * 100).toFixed(1) : '0.0';
      const rowCount = Math.max(group.products.length, 1);
      return group.products.map((product, index) => `
        <tr class="${index === 0 ? 'size-group-start' : ''}">
          ${index === 0 ? `<td class="size-cell size-group-cell" rowspan="${rowCount}">${escapeHtml(group.size)}</td>` : ''}
          <td>
            <div class="product-name">${escapeHtml(product.productName)}</div>
            ${product.productCode ? `<div class="product-code">商品コード ${escapeHtml(product.productCode)}</div>` : ''}
          </td>
          <td class="number"><strong>${product.quantity.toLocaleString('ja-JP')}</strong></td>
          ${index === 0 ? `<td class="number size-total" rowspan="${rowCount}"><strong>${group.quantity.toLocaleString('ja-JP')}</strong></td><td class="number" rowspan="${rowCount}">${ratio}%</td>` : ''}
        </tr>
      `).join('');
    }).join('');
  }

  function renderDetails() {
    if (!state.rows.length) {
      els.detailBody.innerHTML = '<tr><td colspan="8" class="empty-row">抽出明細がありません</td></tr>';
      return;
    }
    els.detailBody.innerHTML = state.rows.map((row) => `
      <tr data-id="${escapeHtml(row.id)}">
        <td title="${escapeHtml(row.fileName)}">${escapeHtml(shorten(row.fileName, 20))}</td>
        <td>${row.pageNumber}</td>
        <td class="code-cell">${escapeHtml(row.productCode || '未検出')}</td>
        <td><input class="detail-input product-input" value="${escapeHtml(row.productName)}" aria-label="商品名" /></td>
        <td><input class="detail-input size-input" value="${escapeHtml(row.size)}" aria-label="タイヤサイズ" /></td>
        <td class="number"><input class="detail-input qty-input" type="number" min="0" step="1" value="${validQuantity(row.quantity)}" aria-label="数量" /></td>
        <td class="number ${row.confidence < 75 ? 'confidence-low' : ''}">${row.confidence}%</td>
        <td><button class="delete-btn" type="button">削除</button></td>
      </tr>
    `).join('');

    els.detailBody.querySelectorAll('tr[data-id]').forEach((tr) => {
      const id = tr.dataset.id;
      tr.querySelector('.product-input').addEventListener('change', (e) => updateRow(id, { productName: cleanProductName(e.target.value) || '商品名未検出' }));
      tr.querySelector('.size-input').addEventListener('change', (e) => updateRow(id, { size: standardizeSize(e.target.value) || e.target.value.trim() }));
      tr.querySelector('.qty-input').addEventListener('change', (e) => updateRow(id, { quantity: validQuantity(e.target.value) }));
      tr.querySelector('.delete-btn').addEventListener('click', () => {
        state.rows = state.rows.filter((row) => row.id !== id);
        renderAll();
      });
    });
  }

  function updateRow(id, patch) {
    const row = state.rows.find((item) => item.id === id);
    if (!row) return;

    if (Object.prototype.hasOwnProperty.call(patch, 'productName')) {
      const productName = cleanProductName(patch.productName) || '商品名未検出';
      if (row.productCode) {
        state.productDictionary[row.productCode] = productName;
        saveProductDictionary();
        state.rows.forEach((item) => {
          if (item.productCode === row.productCode) item.productName = productName;
        });
      } else {
        row.productName = productName;
      }
    }

    const otherPatch = { ...patch };
    delete otherPatch.productName;
    Object.assign(row, otherPatch);
    renderAll();
  }

  function renderWarnings() {
    if (!state.warnings.length) {
      els.warningPanel.classList.add('hidden');
      els.warningList.innerHTML = '';
      return;
    }
    els.warningPanel.classList.remove('hidden');
    els.warningList.innerHTML = state.warnings.map((warning) => `
      <div class="warning-item">
        <strong>${warning.type === 'product' ? '商品名・商品コード要確認' : '数量要確認'}：</strong>
        ${escapeHtml(warning.fileName)} / ${warning.pageNumber}頁 / ${escapeHtml(warning.size)}<br />
        <code>${escapeHtml(warning.rawLine)}</code>
      </div>
    `).join('');
  }

  function exportSummaryCsv() {
    const groups = aggregateRowsByProduct();
    const dataRows = [];
    for (const group of groups) {
      for (const product of group.products) {
        dataRows.push([group.size, product.productCode, product.productName, product.quantity, group.quantity]);
      }
    }
    downloadCsv('タイヤサイズ商品別集計.csv', [
      ['タイヤサイズ', '商品コード', '商品名', '商品別売上本数', 'サイズ合計'],
      ...dataRows,
      ['全サイズ合計', '', '', groups.reduce((sum, group) => sum + group.quantity, 0), ''],
    ]);
  }

  function exportDetailCsv() {
    downloadCsv('タイヤ売上抽出明細.csv', [
      ['ファイル名', 'ページ', '商品コード', '商品名', 'タイヤサイズ', '売上数量', 'OCR信頼度', 'OCR原文'],
      ...state.rows.map((row) => [row.fileName, row.pageNumber, row.productCode, row.productName, row.size, validQuantity(row.quantity), row.confidence, row.rawLine]),
    ]);
  }

  function downloadCsv(fileName, rows) {
    const csv = '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function csvCell(value) {
    const text = String(value ?? '');
    return `"${text.replace(/"/g, '""')}"`;
  }

  function standardizeSize(value) {
    const match = normalizeOcr(value).match(SIZE_RE);
    return match ? `${match[1]}/${match[2]}R${match[3]}` : '';
  }

  function compareSizes(a, b) {
    const pa = parseSize(a);
    const pb = parseSize(b);
    return pa.rim - pb.rim || pa.width - pb.width || pa.aspect - pb.aspect || a.localeCompare(b, 'ja');
  }

  function parseSize(size) {
    const match = size.match(/(\d{3})\/(\d{2})R(\d{2})/);
    return match ? { width: Number(match[1]), aspect: Number(match[2]), rim: Number(match[3]) } : { width: 999, aspect: 999, rim: 999 };
  }

  function validQuantity(value) {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  function setProgress(percent, text, detail = '') {
    const safe = Math.max(0, Math.min(100, Math.round(percent)));
    els.progressBar.style.width = `${safe}%`;
    els.progressPercent.textContent = `${safe}%`;
    els.progressText.textContent = text;
    els.progressDetail.textContent = detail;
  }

  function showError(message) {
    els.errorBox.textContent = message;
    els.errorBox.classList.remove('hidden');
  }
  function hideError() {
    els.errorBox.classList.add('hidden');
    els.errorBox.textContent = '';
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
  }
  function average(values) { return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1); }
  function shorten(value, length) { return value.length <= length ? value : `${value.slice(0, length - 1)}…`; }
  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }
  function escapeText(value) { return String(value); }
})();
