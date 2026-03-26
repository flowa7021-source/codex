// ─── Unit Tests: CLI Handler ────────────────────────────────────────────────
import './setup-dom.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { parseCliArgs, executeCli } from '../../app/modules/cli-handler.js';

// ─── parseCliArgs ───────────────────────────────────────────────────────────

describe('parseCliArgs', () => {
  it('parses merge with two input files and output', () => {
    const result = parseCliArgs(['merge', 'f1.pdf', 'f2.pdf', '-o', 'out.pdf']);
    assert.equal(result.command, 'merge');
    assert.deepEqual(result.inputFiles, ['f1.pdf', 'f2.pdf']);
    assert.equal(result.outputPath, 'out.pdf');
  });

  it('parses compress with --profile option', () => {
    const result = parseCliArgs(['compress', 'in.pdf', '--profile', 'screen']);
    assert.equal(result.command, 'compress');
    assert.deepEqual(result.inputFiles, ['in.pdf']);
    assert.equal(result.options.profile, 'screen');
  });

  it('parses --output long form', () => {
    const result = parseCliArgs(['split', 'doc.pdf', '--output', 'dir/']);
    assert.equal(result.outputPath, 'dir/');
  });

  it('parses boolean flags (no value after --)', () => {
    const result = parseCliArgs(['compress', 'in.pdf', '--verbose']);
    assert.equal(result.options.verbose, true);
  });

  it('parses ocr with --lang option', () => {
    const result = parseCliArgs(['ocr', 'scan.pdf', '--lang', 'deu']);
    assert.equal(result.command, 'ocr');
    assert.equal(result.options.lang, 'deu');
  });

  it('throws on unknown command', () => {
    assert.throws(() => parseCliArgs(['frobnicate', 'file.pdf']), { message: /Unknown command/ });
  });

  it('throws on empty args', () => {
    assert.throws(() => parseCliArgs([]), { message: /No command specified/ });
  });

  it('handles multiple input files', () => {
    const result = parseCliArgs(['merge', 'a.pdf', 'b.pdf', 'c.pdf', '-o', 'merged.pdf']);
    assert.deepEqual(result.inputFiles, ['a.pdf', 'b.pdf', 'c.pdf']);
  });

  it('handles convert command with --to option', () => {
    const result = parseCliArgs(['convert', 'doc.pdf', '--to', 'png']);
    assert.equal(result.command, 'convert');
    assert.equal(result.options.to, 'png');
  });
});

// ─── executeCli ─────────────────────────────────────────────────────────────

describe('executeCli', () => {
  it('merge returns success message with file count', async () => {
    const result = await executeCli({
      command: 'merge',
      inputFiles: ['a.pdf', 'b.pdf'],
      outputPath: 'out.pdf',
      options: {},
    });
    assert.equal(result.success, true);
    assert.ok(result.message.includes('2 files'));
    assert.ok(result.message.includes('out.pdf'));
  });

  it('merge fails with fewer than 2 files', async () => {
    const result = await executeCli({
      command: 'merge',
      inputFiles: ['only.pdf'],
      outputPath: 'out.pdf',
      options: {},
    });
    assert.equal(result.success, false);
    assert.ok(result.message.includes('at least 2'));
  });

  it('compress returns success with profile', async () => {
    const result = await executeCli({
      command: 'compress',
      inputFiles: ['doc.pdf'],
      outputPath: '',
      options: { profile: 'screen' },
    });
    assert.equal(result.success, true);
    assert.ok(result.message.includes('screen'));
  });

  it('compress uses default ebook profile', async () => {
    const result = await executeCli({
      command: 'compress',
      inputFiles: ['doc.pdf'],
      outputPath: '',
      options: {},
    });
    assert.equal(result.success, true);
    assert.ok(result.message.includes('ebook'));
  });

  it('ocr returns success with language', async () => {
    const result = await executeCli({
      command: 'ocr',
      inputFiles: ['scan.pdf'],
      outputPath: '',
      options: { lang: 'fra' },
    });
    assert.equal(result.success, true);
    assert.ok(result.message.includes('fra'));
  });

  it('split returns success', async () => {
    const result = await executeCli({
      command: 'split',
      inputFiles: ['big.pdf'],
      outputPath: '/out',
      options: {},
    });
    assert.equal(result.success, true);
    assert.ok(result.message.includes('Split'));
  });

  it('convert returns success with target format', async () => {
    const result = await executeCli({
      command: 'convert',
      inputFiles: ['doc.pdf'],
      outputPath: '',
      options: { to: 'png' },
    });
    assert.equal(result.success, true);
    assert.ok(result.message.includes('png'));
  });

  it('watermark command returns success', async () => {
    const result = await executeCli({
      command: 'watermark',
      inputFiles: ['doc.pdf'],
      outputPath: '',
      options: {},
    });
    assert.equal(result.success, true);
    assert.ok(result.message.includes('watermark'));
  });
});
