/**
 * OCR Quality Regression Baseline
 *
 * Measures Character Error Rate (CER) and Word Error Rate (WER)
 * against known ground-truth text samples.
 *
 * Usage:
 *   node tests/benchmarks/ocr-quality-baseline.js
 *
 * This script can be run standalone (Node.js) or imported as a module.
 * In production, it runs inside the browser with actual OCR results.
 */

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

// ─── Ground Truth Corpus (Russian + English) ────────────────────────────────

const corpus = [
  {
    id: 'ru-simple-01',
    lang: 'ru',
    category: 'clean-print',
    groundTruth: 'Современный читатель документов с поддержкой PDF, DjVu и изображений.',
    description: 'Clean printed Russian text, standard font',
  },
  {
    id: 'ru-mixed-02',
    lang: 'ru',
    category: 'mixed-case',
    groundTruth: 'Приложение NovaReader v2.0 поддерживает OCR распознавание текста на русском и английском языках.',
    description: 'Mixed Latin/Cyrillic with version numbers',
  },
  {
    id: 'ru-numbers-03',
    lang: 'ru',
    category: 'numbers',
    groundTruth: 'Всего обработано 1 234 567 страниц за 2024 год. Точность: 98.7%.',
    description: 'Russian text with numbers, decimals, and formatted numbers',
  },
  {
    id: 'en-simple-04',
    lang: 'en',
    category: 'clean-print',
    groundTruth: 'The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.',
    description: 'English pangrams, clean print',
  },
  {
    id: 'en-technical-05',
    lang: 'en',
    category: 'technical',
    groundTruth: 'function calculateCRC32(data: Uint8Array): number { return crc ^ 0xFFFFFFFF; }',
    description: 'English technical/code text with special characters',
  },
  {
    id: 'ru-degraded-06',
    lang: 'ru',
    category: 'degraded',
    groundTruth: 'Этот текст имитирует сканирование старого документа с пятнами и артефактами.',
    description: 'Simulated degraded scan quality',
  },
  {
    id: 'ru-table-07',
    lang: 'ru',
    category: 'table',
    groundTruth: 'Наименование\tКоличество\tЦена\nТовар А\t100\t250.00\nТовар Б\t50\t499.99',
    description: 'Tabular data with tabs and numbers',
  },
  {
    id: 'en-mixed-08',
    lang: 'en',
    category: 'mixed-case',
    groundTruth: 'PDF/A-1b compliant document exported from NovaReader 2.0 on 2024-12-15.',
    description: 'Mixed uppercase, abbreviations, dates',
  },
  {
    id: 'ru-long-09',
    lang: 'ru',
    category: 'paragraph',
    groundTruth: 'Программа предназначена для чтения и обработки электронных документов различных форматов. Основные возможности включают просмотр PDF и DjVu файлов, оптическое распознавание символов, аннотирование, полнотекстовый поиск и экспорт в редактируемые форматы.',
    description: 'Long paragraph, formal Russian',
  },
  {
    id: 'en-special-10',
    lang: 'en',
    category: 'special-chars',
    groundTruth: 'E-mail: user@example.com | Phone: +7 (495) 123-4567 | Price: $99.99',
    description: 'Special characters, emails, phone numbers, currency',
  },
];

// ─── Benchmark Runner ───────────────────────────────────────────────────────

function runBenchmark(ocrResults) {
  const results = [];

  for (const sample of corpus) {
    const ocrText = ocrResults[sample.id] || '';
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
      pass: cer < 0.15 && wer < 0.20,
    });
  }

  const avgCer = results.reduce((s, r) => s + r.cer, 0) / results.length;
  const avgWer = results.reduce((s, r) => s + r.wer, 0) / results.length;
  const passCount = results.filter(r => r.pass).length;

  return {
    timestamp: new Date().toISOString(),
    samplesTotal: corpus.length,
    samplesPassed: passCount,
    avgCER: Math.round(avgCer * 100) / 100,
    avgWER: Math.round(avgWer * 100) / 100,
    passRate: Math.round((passCount / corpus.length) * 10000) / 100,
    thresholds: { maxCER: 15, maxWER: 20 },
    details: results,
  };
}

function printReport(report) {
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  NovaReader OCR Quality Regression Baseline');
  console.log('══════════════════════════════════════════════════════════');
  console.log(`  Timestamp:    ${report.timestamp}`);
  console.log(`  Samples:      ${report.samplesPassed}/${report.samplesTotal} passed`);
  console.log(`  Pass rate:    ${report.passRate}%`);
  console.log(`  Avg CER:      ${report.avgCER}%  (threshold: <${report.thresholds.maxCER}%)`);
  console.log(`  Avg WER:      ${report.avgWER}%  (threshold: <${report.thresholds.maxWER}%)`);
  console.log('──────────────────────────────────────────────────────────');

  for (const d of report.details) {
    const icon = d.pass ? '✓' : '✗';
    console.log(`  ${icon} ${d.id.padEnd(20)} CER=${String(d.cer).padStart(6)}%  WER=${String(d.wer).padStart(6)}%  [${d.lang}/${d.category}]`);
  }

  console.log('══════════════════════════════════════════════════════════\n');
}

// ─── Self-test: simulate perfect OCR ────────────────────────────────────────
if (typeof require !== 'undefined' && require.main === module) {
  console.log('Running self-test with perfect OCR (all ground truth = OCR output)...');

  const perfectResults = {};
  for (const sample of corpus) {
    perfectResults[sample.id] = sample.groundTruth;
  }

  const report = runBenchmark(perfectResults);
  printReport(report);

  if (report.passRate < 100) {
    console.error('FAIL: perfect OCR should pass all samples');
    process.exit(1);
  }

  // Simulate degraded OCR
  console.log('Running self-test with degraded OCR (introduce errors)...');
  const degradedResults = {};
  for (const sample of corpus) {
    let text = sample.groundTruth;
    // Introduce ~5% character substitutions
    const chars = text.split('');
    for (let i = 0; i < chars.length; i += 20) {
      if (chars[i] !== ' ') chars[i] = 'X';
    }
    degradedResults[sample.id] = chars.join('');
  }

  const degradedReport = runBenchmark(degradedResults);
  printReport(degradedReport);

  console.log('Self-test completed successfully.');
}

// ─── Exports ────────────────────────────────────────────────────────────────
if (typeof module !== 'undefined') {
  module.exports = {
    corpus,
    levenshtein,
    characterErrorRate,
    wordErrorRate,
    runBenchmark,
    printReport,
  };
}
