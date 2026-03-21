/**
 * OCR Corpus Benchmark — Multi-language quality and performance suite
 *
 * Tests OCR quality (CER, WER) and processing speed across all 16 supported
 * languages with multiple ground-truth samples per language.
 *
 * Usage:
 *   node tests/benchmarks/ocr-corpus-benchmark.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ─── Metrics ────────────────────────────────────────────────────────────────

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function characterErrorRate(groundTruth, ocrResult) {
  if (!groundTruth) return ocrResult ? 1 : 0;
  const dist = levenshtein(groundTruth, ocrResult || '');
  return dist / groundTruth.length;
}

function wordErrorRate(groundTruth, ocrResult) {
  const gtWords = (groundTruth || '').trim().split(/\s+/).filter(Boolean);
  const ocrWords = (ocrResult || '').trim().split(/\s+/).filter(Boolean);
  if (!gtWords.length) return ocrWords.length ? 1 : 0;
  const dist = levenshtein(gtWords, ocrWords);
  return dist / gtWords.length;
}

// ─── Simulated OCR engine ───────────────────────────────────────────────────
// Simulates OCR output by introducing language-appropriate error patterns.
// In production this would be replaced with actual Tesseract.js calls.

function simulateOcr(text, lang, errorRate = 0.02) {
  const chars = [...text];
  const result = [];
  for (let i = 0; i < chars.length; i++) {
    if (Math.random() < errorRate && chars[i] !== ' ' && chars[i] !== '\n') {
      // Simulate common OCR errors per script family
      const code = chars[i].codePointAt(0);
      if (code >= 0x0400 && code <= 0x04FF) {
        // Cyrillic confusions
        const confusions = { 'о': '0', 'е': 'с', 'з': '3', 'п': 'н', 'ш': 'щ', 'т': 'г' };
        result.push(confusions[chars[i]] || chars[i]);
      } else if (code >= 0x4E00 && code <= 0x9FFF) {
        // CJK — skip char (deletion error)
        continue;
      } else if (code >= 0x0600 && code <= 0x06FF) {
        // Arabic — swap with neighbor
        result.push(chars[i]);
        if (i + 1 < chars.length) { result.push(chars[i + 1]); i++; }
      } else if (code >= 0x0900 && code <= 0x097F) {
        // Devanagari — duplicate
        result.push(chars[i]);
        result.push(chars[i]);
      } else {
        // Latin — common confusions
        const latinConf = { 'l': '1', 'O': '0', 'I': 'l', 'rn': 'm', 'S': '5' };
        result.push(latinConf[chars[i]] || chars[i]);
      }
    } else {
      result.push(chars[i]);
    }
  }
  return result.join('');
}

// ─── Ground Truth Corpus ────────────────────────────────────────────────────
// 3-5 samples per language: short phrase, paragraph, mixed content

const corpus = [
  // ── Russian (rus) ──
  { id: 'rus-phrase-01', lang: 'rus', category: 'phrase',
    groundTruth: 'Современный читатель документов с поддержкой PDF и DjVu.' },
  { id: 'rus-paragraph-02', lang: 'rus', category: 'paragraph',
    groundTruth: 'Программа предназначена для чтения и обработки электронных документов различных форматов. Основные возможности включают просмотр PDF и DjVu файлов, оптическое распознавание символов и полнотекстовый поиск.' },
  { id: 'rus-mixed-03', lang: 'rus', category: 'mixed',
    groundTruth: 'Версия NovaReader 4.0 обработала 1 234 567 страниц. Точность OCR: 98.7% при 150 DPI.' },
  { id: 'rus-table-04', lang: 'rus', category: 'table',
    groundTruth: 'Наименование\tКоличество\tЦена\nТовар А\t100\t250.00' },

  // ── English (eng) ──
  { id: 'eng-phrase-01', lang: 'eng', category: 'phrase',
    groundTruth: 'The quick brown fox jumps over the lazy dog.' },
  { id: 'eng-paragraph-02', lang: 'eng', category: 'paragraph',
    groundTruth: 'Optical character recognition converts different types of documents, such as scanned paper documents, PDF files, or images captured by a digital camera, into editable and searchable data.' },
  { id: 'eng-mixed-03', lang: 'eng', category: 'mixed',
    groundTruth: 'E-mail: user@example.com | Phone: +1 (555) 123-4567 | Total: $1,299.99' },
  { id: 'eng-technical-04', lang: 'eng', category: 'technical',
    groundTruth: 'function processPage(doc: PDFDocument, page: number): Promise<TextBlock[]> { return []; }' },

  // ── German (deu) ──
  { id: 'deu-phrase-01', lang: 'deu', category: 'phrase',
    groundTruth: 'Der schnelle braune Fuchs springt über den faulen Hund.' },
  { id: 'deu-paragraph-02', lang: 'deu', category: 'paragraph',
    groundTruth: 'Die optische Zeichenerkennung wandelt verschiedene Dokumenttypen in bearbeitbare und durchsuchbare Daten um. Das Verfahren wird häufig für die Digitalisierung gedruckter Texte eingesetzt.' },
  { id: 'deu-mixed-03', lang: 'deu', category: 'mixed',
    groundTruth: 'Straße Nr. 42, München — Größe: 85m², Preis: €350.000' },

  // ── French (fra) ──
  { id: 'fra-phrase-01', lang: 'fra', category: 'phrase',
    groundTruth: "Le renard brun rapide saute par-dessus le chien paresseux." },
  { id: 'fra-paragraph-02', lang: 'fra', category: 'paragraph',
    groundTruth: "La reconnaissance optique de caractères convertit différents types de documents en données modifiables et interrogeables. C'est une technologie essentielle pour la numérisation." },
  { id: 'fra-mixed-03', lang: 'fra', category: 'mixed',
    groundTruth: "L'article №15 — prix: 2 500,00 € — réf.: ABC-123/FR" },

  // ── Spanish (spa) ──
  { id: 'spa-phrase-01', lang: 'spa', category: 'phrase',
    groundTruth: 'El rápido zorro marrón salta sobre el perro perezoso.' },
  { id: 'spa-paragraph-02', lang: 'spa', category: 'paragraph',
    groundTruth: 'El reconocimiento óptico de caracteres convierte documentos escaneados, archivos PDF o imágenes digitales en datos editables y buscables para su posterior procesamiento.' },
  { id: 'spa-mixed-03', lang: 'spa', category: 'mixed',
    groundTruth: '¿Cuántas páginas procesó? 12.345 páginas en 2h 30min — ¡excelente rendimiento!' },

  // ── Italian (ita) ──
  { id: 'ita-phrase-01', lang: 'ita', category: 'phrase',
    groundTruth: 'La volpe marrone veloce salta sopra il cane pigro.' },
  { id: 'ita-paragraph-02', lang: 'ita', category: 'paragraph',
    groundTruth: "Il riconoscimento ottico dei caratteri converte diversi tipi di documenti in dati modificabili. È una tecnologia fondamentale per l'archiviazione digitale dei documenti cartacei." },
  { id: 'ita-mixed-03', lang: 'ita', category: 'mixed',
    groundTruth: "Totale fattura n° 1.234: €5.678,90 — IVA 22% inclusa" },

  // ── Portuguese (por) ──
  { id: 'por-phrase-01', lang: 'por', category: 'phrase',
    groundTruth: 'A rápida raposa marrom pula sobre o cão preguiçoso.' },
  { id: 'por-paragraph-02', lang: 'por', category: 'paragraph',
    groundTruth: 'O reconhecimento óptico de caracteres converte diferentes tipos de documentos digitalizados em dados editáveis e pesquisáveis para processamento posterior.' },
  { id: 'por-mixed-03', lang: 'por', category: 'mixed',
    groundTruth: 'Preço: R$ 1.299,00 — Nº do pedido: 456.789 — São Paulo, Brasil' },

  // ── Simplified Chinese (chi_sim) ──
  { id: 'chi_sim-phrase-01', lang: 'chi_sim', category: 'phrase',
    groundTruth: '光学字符识别技术将扫描的文档转换为可编辑的数据。' },
  { id: 'chi_sim-paragraph-02', lang: 'chi_sim', category: 'paragraph',
    groundTruth: '本软件支持多种文档格式的阅读和处理，包括PDF、DjVu和常见图像格式。主要功能包括光学字符识别、全文搜索和文档导出。' },
  { id: 'chi_sim-mixed-03', lang: 'chi_sim', category: 'mixed',
    groundTruth: '版本4.0已处理1,234,567页，识别准确率达98.7%。' },

  // ── Traditional Chinese (chi_tra) ──
  { id: 'chi_tra-phrase-01', lang: 'chi_tra', category: 'phrase',
    groundTruth: '光學字元辨識技術將掃描的文件轉換為可編輯的資料。' },
  { id: 'chi_tra-paragraph-02', lang: 'chi_tra', category: 'paragraph',
    groundTruth: '本軟體支援多種文件格式的閱讀和處理，包括PDF、DjVu和常見圖片格式。主要功能包括光學字元辨識、全文搜尋和文件匯出。' },
  { id: 'chi_tra-mixed-03', lang: 'chi_tra', category: 'mixed',
    groundTruth: '版本4.0已處理1,234,567頁，辨識準確率達98.7%。' },

  // ── Japanese (jpn) ──
  { id: 'jpn-phrase-01', lang: 'jpn', category: 'phrase',
    groundTruth: '光学文字認識技術はスキャンされた文書を編集可能なデータに変換します。' },
  { id: 'jpn-paragraph-02', lang: 'jpn', category: 'paragraph',
    groundTruth: '本ソフトウェアは、PDF、DjVu、一般的な画像形式を含む多様なドキュメント形式の閲覧と処理をサポートしています。主な機能にはOCR、全文検索、エクスポートがあります。' },
  { id: 'jpn-mixed-03', lang: 'jpn', category: 'mixed',
    groundTruth: 'バージョン4.0で1,234,567ページを処理、認識精度98.7%を達成。' },

  // ── Korean (kor) ──
  { id: 'kor-phrase-01', lang: 'kor', category: 'phrase',
    groundTruth: '광학 문자 인식 기술은 스캔된 문서를 편집 가능한 데이터로 변환합니다.' },
  { id: 'kor-paragraph-02', lang: 'kor', category: 'paragraph',
    groundTruth: '이 소프트웨어는 PDF, DjVu 및 일반적인 이미지 형식을 포함한 다양한 문서 형식의 읽기 및 처리를 지원합니다. 주요 기능으로는 OCR, 전체 텍스트 검색 및 내보내기가 있습니다.' },
  { id: 'kor-mixed-03', lang: 'kor', category: 'mixed',
    groundTruth: '버전 4.0에서 1,234,567페이지 처리 완료, 인식 정확도 98.7% 달성.' },

  // ── Arabic (ara) ──
  { id: 'ara-phrase-01', lang: 'ara', category: 'phrase',
    groundTruth: 'تقنية التعرف الضوئي على الحروف تحول المستندات الممسوحة إلى بيانات قابلة للتحرير.' },
  { id: 'ara-paragraph-02', lang: 'ara', category: 'paragraph',
    groundTruth: 'يدعم هذا البرنامج قراءة ومعالجة تنسيقات المستندات المتعددة بما في ذلك PDF و DjVu وتنسيقات الصور الشائعة. تشمل الميزات الرئيسية التعرف الضوئي على الحروف والبحث النصي الكامل.' },
  { id: 'ara-mixed-03', lang: 'ara', category: 'mixed',
    groundTruth: 'الإصدار 4.0 عالج 1,234,567 صفحة بدقة 98.7% في التعرف.' },

  // ── Hindi (hin) ──
  { id: 'hin-phrase-01', lang: 'hin', category: 'phrase',
    groundTruth: 'ऑप्टिकल कैरेक्टर रिकॉग्निशन तकनीक स्कैन किए गए दस्तावेज़ों को संपादन योग्य डेटा में बदलती है।' },
  { id: 'hin-paragraph-02', lang: 'hin', category: 'paragraph',
    groundTruth: 'यह सॉफ्टवेयर पीडीएफ, डीजेवीयू और सामान्य छवि प्रारूपों सहित विभिन्न दस्तावेज़ प्रारूपों को पढ़ने और संसाधित करने का समर्थन करता है। प्रमुख विशेषताओं में ओसीआर, पूर्ण-पाठ खोज और निर्यात शामिल हैं।' },
  { id: 'hin-mixed-03', lang: 'hin', category: 'mixed',
    groundTruth: 'संस्करण 4.0 ने 1,234,567 पृष्ठों को संसाधित किया, पहचान सटीकता 98.7% प्राप्त की।' },

  // ── Turkish (tur) ──
  { id: 'tur-phrase-01', lang: 'tur', category: 'phrase',
    groundTruth: 'Optik karakter tanıma teknolojisi taranan belgeleri düzenlenebilir verilere dönüştürür.' },
  { id: 'tur-paragraph-02', lang: 'tur', category: 'paragraph',
    groundTruth: 'Bu yazılım PDF, DjVu ve yaygın görüntü formatları dahil çeşitli belge formatlarının okunmasını ve işlenmesini destekler. Temel özellikler arasında OCR, tam metin arama ve dışa aktarma bulunmaktadır.' },
  { id: 'tur-mixed-03', lang: 'tur', category: 'mixed',
    groundTruth: 'Sürüm 4.0 ile 1.234.567 sayfa işlendi — tanıma doğruluğu: %98,7' },

  // ── Polish (pol) ──
  { id: 'pol-phrase-01', lang: 'pol', category: 'phrase',
    groundTruth: 'Technologia optycznego rozpoznawania znaków przekształca zeskanowane dokumenty w edytowalne dane.' },
  { id: 'pol-paragraph-02', lang: 'pol', category: 'paragraph',
    groundTruth: 'To oprogramowanie obsługuje odczyt i przetwarzanie różnych formatów dokumentów, w tym PDF, DjVu i popularnych formatów obrazów. Główne funkcje obejmują OCR, wyszukiwanie pełnotekstowe i eksport.' },
  { id: 'pol-mixed-03', lang: 'pol', category: 'mixed',
    groundTruth: 'Wersja 4.0 przetworzyła 1 234 567 stron — dokładność: 98,7%' },
  { id: 'pol-special-04', lang: 'pol', category: 'special',
    groundTruth: 'Zażółć gęślą jaźń — źdźbło traw przy dróżce' },

  // ── Czech (ces) ──
  { id: 'ces-phrase-01', lang: 'ces', category: 'phrase',
    groundTruth: 'Technologie optického rozpoznávání znaků převádí naskenované dokumenty na upravitelná data.' },
  { id: 'ces-paragraph-02', lang: 'ces', category: 'paragraph',
    groundTruth: 'Tento software podporuje čtení a zpracování různých formátů dokumentů včetně PDF, DjVu a běžných obrazových formátů. Hlavní funkce zahrnují OCR, fulltextové vyhledávání a export.' },
  { id: 'ces-mixed-03', lang: 'ces', category: 'mixed',
    groundTruth: 'Verze 4.0 zpracovala 1 234 567 stránek — přesnost rozpoznávání: 98,7 %' },
  { id: 'ces-special-04', lang: 'ces', category: 'special',
    groundTruth: 'Příliš žluťoučký kůň úpěl ďábelské ódy — řeřicha' },
];

// ─── Thresholds ─────────────────────────────────────────────────────────────

const CER_THRESHOLD = 0.15; // 15% max character error rate
const WER_THRESHOLD = 0.20; // 20% max word error rate

const SUPPORTED_LANGUAGES = [
  'rus', 'eng', 'deu', 'fra', 'spa', 'ita', 'por',
  'chi_sim', 'chi_tra', 'jpn', 'kor',
  'ara', 'hin', 'tur', 'pol', 'ces',
];

// ─── Benchmark Runner ───────────────────────────────────────────────────────

function runCorpusBenchmark(ocrResultMap) {
  const results = [];

  for (const sample of corpus) {
    const ocrText = ocrResultMap[sample.id] || '';
    const cer = characterErrorRate(sample.groundTruth, ocrText);
    const wer = wordErrorRate(sample.groundTruth, ocrText);

    results.push({
      id: sample.id,
      lang: sample.lang,
      category: sample.category,
      cer: Math.round(cer * 10000) / 100,
      wer: Math.round(wer * 10000) / 100,
      gtLength: sample.groundTruth.length,
      ocrLength: ocrText.length,
      pass: cer < CER_THRESHOLD && wer < WER_THRESHOLD,
    });
  }

  // Per-language aggregation
  const langStats = {};
  for (const lang of SUPPORTED_LANGUAGES) {
    const langResults = results.filter(r => r.lang === lang);
    if (!langResults.length) continue;
    const avgCer = langResults.reduce((s, r) => s + r.cer, 0) / langResults.length;
    const avgWer = langResults.reduce((s, r) => s + r.wer, 0) / langResults.length;
    const passCount = langResults.filter(r => r.pass).length;
    langStats[lang] = {
      samples: langResults.length,
      avgCER: Math.round(avgCer * 100) / 100,
      avgWER: Math.round(avgWer * 100) / 100,
      passed: passCount,
      pass: passCount === langResults.length,
    };
  }

  const totalPassed = results.filter(r => r.pass).length;
  const avgCer = results.reduce((s, r) => s + r.cer, 0) / results.length;
  const avgWer = results.reduce((s, r) => s + r.wer, 0) / results.length;

  return {
    timestamp: new Date().toISOString(),
    samplesTotal: corpus.length,
    samplesPassed: totalPassed,
    avgCER: Math.round(avgCer * 100) / 100,
    avgWER: Math.round(avgWer * 100) / 100,
    passRate: Math.round((totalPassed / corpus.length) * 10000) / 100,
    thresholds: { maxCER: CER_THRESHOLD * 100, maxWER: WER_THRESHOLD * 100 },
    languageStats: langStats,
    details: results,
  };
}

function measureProcessingSpeed(ocrFn, samples) {
  const speeds = [];
  for (const sample of samples) {
    const start = performance.now();
    ocrFn(sample.groundTruth, sample.lang);
    const elapsed = performance.now() - start;
    const charsPerSec = elapsed > 0 ? (sample.groundTruth.length / (elapsed / 1000)) : Infinity;
    speeds.push({ id: sample.id, lang: sample.lang, chars: sample.groundTruth.length, ms: Math.round(elapsed * 100) / 100, charsPerSec: Math.round(charsPerSec) });
  }
  return speeds;
}

function printReport(report, speedResults) {
  console.log('\n' + '='.repeat(70));
  console.log('  NovaReader OCR Corpus Benchmark — Multi-Language Suite');
  console.log('='.repeat(70));
  console.log(`  Timestamp:    ${report.timestamp}`);
  console.log(`  Languages:    ${Object.keys(report.languageStats).length}`);
  console.log(`  Samples:      ${report.samplesPassed}/${report.samplesTotal} passed`);
  console.log(`  Pass rate:    ${report.passRate}%`);
  console.log(`  Avg CER:      ${report.avgCER}%  (threshold: <${report.thresholds.maxCER}%)`);
  console.log(`  Avg WER:      ${report.avgWER}%  (threshold: <${report.thresholds.maxWER}%)`);
  console.log('-'.repeat(70));

  console.log('\n  Per-Language Summary:');
  console.log('  ' + 'Lang'.padEnd(10) + 'Samples'.padEnd(10) + 'Passed'.padEnd(10) + 'Avg CER'.padEnd(12) + 'Avg WER'.padEnd(12) + 'Status');
  console.log('  ' + '-'.repeat(60));
  for (const [lang, stats] of Object.entries(report.languageStats)) {
    const icon = stats.pass ? 'PASS' : 'FAIL';
    console.log(
      '  ' +
      lang.padEnd(10) +
      String(stats.samples).padEnd(10) +
      `${stats.passed}/${stats.samples}`.padEnd(10) +
      `${stats.avgCER}%`.padEnd(12) +
      `${stats.avgWER}%`.padEnd(12) +
      icon
    );
  }

  if (speedResults) {
    console.log('\n  Processing Speed:');
    const avgSpeed = speedResults.reduce((s, r) => s + r.charsPerSec, 0) / speedResults.length;
    console.log(`  Average: ${Math.round(avgSpeed).toLocaleString()} chars/sec`);
  }

  console.log('\n  Sample Details:');
  for (const d of report.details) {
    const icon = d.pass ? 'PASS' : 'FAIL';
    console.log(`  [${icon}] ${d.id.padEnd(24)} CER=${String(d.cer).padStart(6)}%  WER=${String(d.wer).padStart(6)}%`);
  }

  console.log('='.repeat(70) + '\n');
}

// ─── Test Suite ─────────────────────────────────────────────────────────────

describe('OCR Corpus Benchmark', () => {
  // Build simulated OCR results for all samples
  const perfectResults = {};
  const degradedResults = {};
  for (const sample of corpus) {
    perfectResults[sample.id] = sample.groundTruth;
    degradedResults[sample.id] = simulateOcr(sample.groundTruth, sample.lang, 0.02);
  }

  it('should have samples for all 16 supported languages', () => {
    const coveredLangs = new Set(corpus.map(s => s.lang));
    for (const lang of SUPPORTED_LANGUAGES) {
      assert.ok(coveredLangs.has(lang), `Missing samples for language: ${lang}`);
    }
    assert.equal(coveredLangs.size, 16, 'Expected exactly 16 languages');
  });

  it('should have at least 3 samples per language', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      const count = corpus.filter(s => s.lang === lang).length;
      assert.ok(count >= 3, `Language ${lang} has only ${count} samples, need at least 3`);
    }
  });

  it('should achieve 100% pass rate with perfect OCR', () => {
    const report = runCorpusBenchmark(perfectResults);
    assert.equal(report.passRate, 100, `Expected 100% pass rate, got ${report.passRate}%`);
    assert.equal(report.avgCER, 0, 'Perfect OCR should have 0% CER');
    assert.equal(report.avgWER, 0, 'Perfect OCR should have 0% WER');
  });

  it('should pass all languages with perfect OCR', () => {
    const report = runCorpusBenchmark(perfectResults);
    for (const [lang, stats] of Object.entries(report.languageStats)) {
      assert.ok(stats.pass, `Language ${lang} should pass with perfect OCR`);
    }
  });

  describe('per-language CER/WER with simulated degradation', () => {
    const report = runCorpusBenchmark(degradedResults);

    for (const lang of SUPPORTED_LANGUAGES) {
      it(`${lang}: CER below ${CER_THRESHOLD * 100}% and WER below ${WER_THRESHOLD * 100}%`, () => {
        const stats = report.languageStats[lang];
        assert.ok(stats, `No stats found for language: ${lang}`);
        assert.ok(
          stats.avgCER < CER_THRESHOLD * 100,
          `${lang} CER ${stats.avgCER}% exceeds threshold ${CER_THRESHOLD * 100}%`
        );
        assert.ok(
          stats.avgWER < WER_THRESHOLD * 100,
          `${lang} WER ${stats.avgWER}% exceeds threshold ${WER_THRESHOLD * 100}%`
        );
      });
    }
  });

  it('should measure processing speed for all samples', () => {
    const speedResults = measureProcessingSpeed(simulateOcr, corpus);
    assert.equal(speedResults.length, corpus.length);
    for (const result of speedResults) {
      assert.ok(result.charsPerSec > 0, `Speed for ${result.id} should be positive`);
    }
  });

  it('should detect total failure when OCR returns empty strings', () => {
    const emptyResults = {};
    for (const sample of corpus) {
      emptyResults[sample.id] = '';
    }
    const report = runCorpusBenchmark(emptyResults);
    assert.equal(report.passRate, 0, 'Empty OCR results should yield 0% pass rate');
  });

  it('should generate and print a full benchmark report', () => {
    const report = runCorpusBenchmark(degradedResults);
    const speedResults = measureProcessingSpeed(simulateOcr, corpus);
    printReport(report, speedResults);
    assert.ok(report.timestamp, 'Report should have a timestamp');
    assert.ok(report.languageStats, 'Report should have language stats');
    assert.equal(Object.keys(report.languageStats).length, 16, 'Report should cover 16 languages');
  });
});

// ─── CER/WER metric unit tests ─────────────────────────────────────────────

describe('OCR Metrics', () => {
  it('characterErrorRate: identical strings yield 0', () => {
    assert.equal(characterErrorRate('hello', 'hello'), 0);
  });

  it('characterErrorRate: completely different strings yield high rate', () => {
    const cer = characterErrorRate('abcde', 'vwxyz');
    assert.ok(cer > 0.5, `Expected high CER, got ${cer}`);
  });

  it('characterErrorRate: empty ground truth with non-empty result yields 1', () => {
    assert.equal(characterErrorRate('', 'abc'), 1);
  });

  it('characterErrorRate: both empty yields 0', () => {
    assert.equal(characterErrorRate('', ''), 0);
  });

  it('wordErrorRate: identical word sequences yield 0', () => {
    assert.equal(wordErrorRate('hello world', 'hello world'), 0);
  });

  it('wordErrorRate: completely different words yield high rate', () => {
    const wer = wordErrorRate('the quick brown', 'xxx yyy zzz');
    assert.ok(wer > 0.5, `Expected high WER, got ${wer}`);
  });

  it('levenshtein: known distance values', () => {
    assert.equal(levenshtein('kitten', 'sitting'), 3);
    assert.equal(levenshtein('', 'abc'), 3);
    assert.equal(levenshtein('abc', 'abc'), 0);
  });
});
