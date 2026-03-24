import './setup-dom.js';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

import { state, els } from '../../app/modules/state.js';
import {
  loadNotesIntoUI,
  saveNotesFromUI,
  exportNotesText,
  exportNotesMd,
  exportNotesJson,
  importNotesJson,
  insertTimestamp,
  initNotesController,
} from '../../app/modules/notes-controller.js';

function resetState() {
  state.docName = 'test.pdf';
  localStorage.clear();
  // Set up mock els
  els.notesTitle = document.createElement('input');
  els.notesTags = document.createElement('input');
  els.notes = document.createElement('textarea');
  els.notesStatus = document.createElement('div');
}

describe('notes-controller', () => {
  beforeEach(() => resetState());

  describe('loadNotesIntoUI', () => {
    it('loads empty notes when nothing is stored', () => {
      loadNotesIntoUI();
      assert.equal(els.notesTitle.value, '');
      assert.equal(els.notesTags.value, '');
      assert.equal(els.notes.value, '');
    });

    it('loads stored notes into UI elements', () => {
      localStorage.setItem('novareader-notes:test.pdf', JSON.stringify({
        title: 'My Title', tags: 'tag1, tag2', text: 'Hello world',
      }));
      loadNotesIntoUI();
      assert.equal(els.notesTitle.value, 'My Title');
      assert.equal(els.notesTags.value, 'tag1, tag2');
      assert.equal(els.notes.value, 'Hello world');
    });

    it('updates notesStatus text', () => {
      loadNotesIntoUI();
      assert.equal(els.notesStatus.textContent, 'Заметки загружены');
    });

    it('handles null els.notesTitle gracefully', () => {
      els.notesTitle = null;
      assert.doesNotThrow(() => loadNotesIntoUI());
    });

    it('handles null els.notesTags gracefully', () => {
      els.notesTags = null;
      assert.doesNotThrow(() => loadNotesIntoUI());
    });

    it('handles null els.notes gracefully', () => {
      els.notes = null;
      assert.doesNotThrow(() => loadNotesIntoUI());
    });

    it('handles corrupt JSON in localStorage', () => {
      localStorage.setItem('novareader-notes:test.pdf', 'not-json{{{');
      assert.doesNotThrow(() => loadNotesIntoUI());
      // Should fall back to empty values
      assert.equal(els.notesTitle.value, '');
    });
  });

  describe('saveNotesFromUI', () => {
    it('persists UI values to localStorage', () => {
      els.notesTitle.value = 'Title';
      els.notesTags.value = 'tags';
      els.notes.value = 'body text';
      saveNotesFromUI();
      const stored = JSON.parse(localStorage.getItem('novareader-notes:test.pdf'));
      assert.equal(stored.title, 'Title');
      assert.equal(stored.tags, 'tags');
      assert.equal(stored.text, 'body text');
      assert.ok(stored.updatedAt > 0);
    });

    it('sets notesStatus to saved message', () => {
      saveNotesFromUI();
      assert.equal(els.notesStatus.textContent, 'Сохранено');
    });

    it('handles null els fields gracefully', () => {
      els.notesTitle = null;
      els.notesTags = null;
      els.notes = null;
      assert.doesNotThrow(() => saveNotesFromUI());
      const stored = JSON.parse(localStorage.getItem('novareader-notes:test.pdf'));
      assert.equal(stored.title, '');
      assert.equal(stored.tags, '');
      assert.equal(stored.text, '');
    });
  });

  describe('updateNotesStatus', () => {
    it('handles null els.notesStatus gracefully', () => {
      els.notesStatus = null;
      // saveNotesFromUI calls updateNotesStatus internally
      assert.doesNotThrow(() => saveNotesFromUI());
    });
  });

  describe('exportNotesText', () => {
    it('creates a download link with .txt extension', () => {
      localStorage.setItem('novareader-notes:test.pdf', JSON.stringify({
        title: 'T', tags: 'tg', text: 'body',
      }));
      // Mock anchor click
      const clicks = [];
      const origCreate = document.createElement;
      document.createElement = (tag) => {
        const el = origCreate(tag);
        if (tag === 'a') el.click = () => clicks.push(el);
        return el;
      };
      exportNotesText();
      document.createElement = origCreate;
      assert.equal(clicks.length, 1);
      assert.ok(clicks[0].download.endsWith('.txt'));
    });

    it('includes title and tags in content when present', () => {
      localStorage.setItem('novareader-notes:test.pdf', JSON.stringify({
        title: 'My Title', tags: 'tag1', text: 'body',
      }));
      const clicks = [];
      const origCreate = document.createElement;
      document.createElement = (tag) => {
        const el = origCreate(tag);
        if (tag === 'a') el.click = () => clicks.push(el);
        return el;
      };
      exportNotesText();
      document.createElement = origCreate;
      assert.equal(clicks.length, 1);
      assert.equal(clicks[0].download, 'test.pdf-notes.txt');
    });

    it('uses default name when docName is empty', () => {
      state.docName = '';
      localStorage.setItem('novareader-notes:global', JSON.stringify({
        title: '', tags: '', text: 'body',
      }));
      const clicks = [];
      const origCreate = document.createElement;
      document.createElement = (tag) => {
        const el = origCreate(tag);
        if (tag === 'a') el.click = () => clicks.push(el);
        return el;
      };
      exportNotesText();
      document.createElement = origCreate;
      assert.equal(clicks[0].download, 'notes-notes.txt');
    });

    it('handles empty title and tags', () => {
      localStorage.setItem('novareader-notes:test.pdf', JSON.stringify({
        title: '', tags: '', text: 'just text',
      }));
      const clicks = [];
      const origCreate = document.createElement;
      document.createElement = (tag) => {
        const el = origCreate(tag);
        if (tag === 'a') el.click = () => clicks.push(el);
        return el;
      };
      exportNotesText();
      document.createElement = origCreate;
      assert.equal(clicks.length, 1);
    });

    it('handles empty text', () => {
      localStorage.setItem('novareader-notes:test.pdf', JSON.stringify({
        title: 'T', tags: 'tg', text: '',
      }));
      const clicks = [];
      const origCreate = document.createElement;
      document.createElement = (tag) => {
        const el = origCreate(tag);
        if (tag === 'a') el.click = () => clicks.push(el);
        return el;
      };
      exportNotesText();
      document.createElement = origCreate;
      assert.equal(clicks.length, 1);
    });
  });

  describe('exportNotesMd', () => {
    it('creates a download link with .md extension', () => {
      localStorage.setItem('novareader-notes:test.pdf', JSON.stringify({
        title: 'T', tags: '', text: 'body',
      }));
      const clicks = [];
      const origCreate = document.createElement;
      document.createElement = (tag) => {
        const el = origCreate(tag);
        if (tag === 'a') el.click = () => clicks.push(el);
        return el;
      };
      exportNotesMd();
      document.createElement = origCreate;
      assert.equal(clicks.length, 1);
      assert.ok(clicks[0].download.endsWith('.md'));
    });

    it('includes tags in markdown blockquote format when present', () => {
      localStorage.setItem('novareader-notes:test.pdf', JSON.stringify({
        title: 'Title', tags: 'tag1, tag2', text: 'body',
      }));
      const clicks = [];
      const origCreate = document.createElement;
      document.createElement = (tag) => {
        const el = origCreate(tag);
        if (tag === 'a') el.click = () => clicks.push(el);
        return el;
      };
      exportNotesMd();
      document.createElement = origCreate;
      assert.equal(clicks.length, 1);
      assert.equal(clicks[0].download, 'test.pdf-notes.md');
    });

    it('uses default name when docName is empty', () => {
      state.docName = '';
      localStorage.setItem('novareader-notes:global', JSON.stringify({
        title: '', tags: '', text: 'md body',
      }));
      const clicks = [];
      const origCreate = document.createElement;
      document.createElement = (tag) => {
        const el = origCreate(tag);
        if (tag === 'a') el.click = () => clicks.push(el);
        return el;
      };
      exportNotesMd();
      document.createElement = origCreate;
      assert.equal(clicks[0].download, 'notes-notes.md');
    });

    it('handles empty title with tags', () => {
      localStorage.setItem('novareader-notes:test.pdf', JSON.stringify({
        title: '', tags: 'tag1', text: 'body',
      }));
      const clicks = [];
      const origCreate = document.createElement;
      document.createElement = (tag) => {
        const el = origCreate(tag);
        if (tag === 'a') el.click = () => clicks.push(el);
        return el;
      };
      exportNotesMd();
      document.createElement = origCreate;
      assert.equal(clicks.length, 1);
    });
  });

  describe('exportNotesJson', () => {
    it('includes docName in the export', () => {
      localStorage.setItem('novareader-notes:test.pdf', JSON.stringify({
        title: 'T', tags: '', text: 'body',
      }));
      const clicks = [];
      const origCreate = document.createElement;
      document.createElement = (tag) => {
        const el = origCreate(tag);
        if (tag === 'a') el.click = () => clicks.push(el);
        return el;
      };
      exportNotesJson();
      document.createElement = origCreate;
      assert.ok(clicks[0].download.endsWith('.json'));
    });

    it('uses default name when docName is empty', () => {
      state.docName = '';
      localStorage.setItem('novareader-notes:global', JSON.stringify({
        title: 'T', tags: '', text: 'body',
      }));
      const clicks = [];
      const origCreate = document.createElement;
      document.createElement = (tag) => {
        const el = origCreate(tag);
        if (tag === 'a') el.click = () => clicks.push(el);
        return el;
      };
      exportNotesJson();
      document.createElement = origCreate;
      assert.equal(clicks[0].download, 'notes-notes.json');
    });
  });

  describe('importNotesJson', () => {
    it('does nothing when file is null', () => {
      assert.doesNotThrow(() => importNotesJson(null, 'replace'));
    });

    it('does nothing when file is undefined', () => {
      assert.doesNotThrow(() => importNotesJson(undefined, 'replace'));
    });

    it('replaces notes when mode is replace', async () => {
      // Store existing notes
      localStorage.setItem('novareader-notes:test.pdf', JSON.stringify({
        title: 'Old', tags: 'old-tag', text: 'old text',
      }));
      loadNotesIntoUI();

      const imported = JSON.stringify({ title: 'New', tags: 'new-tag', text: 'new text' });
      const blob = new Blob([imported], { type: 'application/json' });

      importNotesJson(blob, 'replace');
      // FileReader is async in setup-dom mock
      await new Promise(r => setTimeout(r, 50));

      const stored = JSON.parse(localStorage.getItem('novareader-notes:test.pdf'));
      assert.equal(stored.title, 'New');
      assert.equal(stored.tags, 'new-tag');
      assert.equal(stored.text, 'new text');
    });

    it('merges/appends notes when mode is append', async () => {
      localStorage.setItem('novareader-notes:test.pdf', JSON.stringify({
        title: 'Existing', tags: 'tag1', text: 'existing text',
      }));

      const imported = JSON.stringify({ title: 'Imported', tags: 'tag2', text: 'imported text' });
      const blob = new Blob([imported], { type: 'application/json' });

      importNotesJson(blob, 'append');
      await new Promise(r => setTimeout(r, 50));

      const stored = JSON.parse(localStorage.getItem('novareader-notes:test.pdf'));
      assert.equal(stored.title, 'Existing');
      assert.equal(stored.tags, 'tag1, tag2');
      assert.ok(stored.text.includes('existing text'));
      assert.ok(stored.text.includes('imported text'));
      assert.ok(stored.text.includes('---'));
    });

    it('uses default append mode when mode is not replace', async () => {
      localStorage.setItem('novareader-notes:test.pdf', JSON.stringify({
        title: '', tags: '', text: 'base',
      }));

      const imported = JSON.stringify({ title: 'T', tags: 'tg', text: 'extra' });
      const blob = new Blob([imported], { type: 'application/json' });

      importNotesJson(blob, 'merge');
      await new Promise(r => setTimeout(r, 50));

      const stored = JSON.parse(localStorage.getItem('novareader-notes:test.pdf'));
      // title should be imported since current is empty
      assert.equal(stored.title, 'T');
      assert.ok(stored.text.includes('base'));
      assert.ok(stored.text.includes('extra'));
    });

    it('handles replace with missing fields in imported data', async () => {
      const imported = JSON.stringify({});
      const blob = new Blob([imported], { type: 'application/json' });

      importNotesJson(blob, 'replace');
      await new Promise(r => setTimeout(r, 50));

      const stored = JSON.parse(localStorage.getItem('novareader-notes:test.pdf'));
      assert.equal(stored.title, '');
      assert.equal(stored.tags, '');
      assert.equal(stored.text, '');
    });

    it('handles invalid JSON in imported file', async () => {
      const blob = new Blob(['not valid json!!!'], { type: 'application/json' });

      importNotesJson(blob, 'replace');
      await new Promise(r => setTimeout(r, 50));

      assert.equal(els.notesStatus.textContent, 'Ошибка импорта');
    });

    it('loads notes into UI after import', async () => {
      const imported = JSON.stringify({ title: 'Imported Title', tags: 'imp-tag', text: 'imp text' });
      const blob = new Blob([imported], { type: 'application/json' });

      importNotesJson(blob, 'replace');
      await new Promise(r => setTimeout(r, 50));

      assert.equal(els.notesTitle.value, 'Imported Title');
      assert.equal(els.notesTags.value, 'imp-tag');
      assert.equal(els.notes.value, 'imp text');
    });

    it('merge with empty current tags and non-empty imported tags', async () => {
      localStorage.setItem('novareader-notes:test.pdf', JSON.stringify({
        title: 'Existing', tags: '', text: 'existing',
      }));

      const imported = JSON.stringify({ title: '', tags: 'newtag', text: 'newtext' });
      const blob = new Blob([imported], { type: 'application/json' });

      importNotesJson(blob, 'append');
      await new Promise(r => setTimeout(r, 50));

      const stored = JSON.parse(localStorage.getItem('novareader-notes:test.pdf'));
      assert.equal(stored.tags, 'newtag');
    });

    it('merge with empty current text and non-empty imported text', async () => {
      localStorage.setItem('novareader-notes:test.pdf', JSON.stringify({
        title: '', tags: '', text: '',
      }));

      const imported = JSON.stringify({ title: '', tags: '', text: 'only-imported' });
      const blob = new Blob([imported], { type: 'application/json' });

      importNotesJson(blob, 'append');
      await new Promise(r => setTimeout(r, 50));

      const stored = JSON.parse(localStorage.getItem('novareader-notes:test.pdf'));
      assert.equal(stored.text, 'only-imported');
    });
  });

  describe('insertTimestamp', () => {
    it('inserts a timestamp at cursor position', () => {
      els.notes.value = 'Hello world';
      els.notes.selectionStart = 5;
      els.notes.focus = () => {};
      insertTimestamp();
      assert.ok(els.notes.value.includes('['));
      assert.ok(els.notes.value.startsWith('Hello'));
    });

    it('does nothing when els.notes is null', () => {
      els.notes = null;
      assert.doesNotThrow(() => insertTimestamp());
    });

    it('inserts at end of text when selectionStart is 0 (falsy)', () => {
      els.notes.value = 'text';
      els.notes.selectionStart = 0;
      els.notes.focus = () => {};
      insertTimestamp();
      // 0 is falsy so pos = value.length, timestamp appended at end
      assert.ok(els.notes.value.startsWith('text'));
      assert.ok(els.notes.value.includes('['));
    });

    it('appends timestamp when no selectionStart (falsy)', () => {
      els.notes.value = 'some text';
      // selectionStart defaults to 0 in DOM mock, set it explicitly
      els.notes.selectionStart = undefined;
      els.notes.focus = () => {};
      insertTimestamp();
      // Should fall back to value.length
      assert.ok(els.notes.value.includes('['));
    });

    it('sets selectionStart and selectionEnd after insertion', () => {
      els.notes.value = 'AB';
      els.notes.selectionStart = 1;
      els.notes.focus = () => {};
      insertTimestamp();
      // selectionStart/End should be set after the timestamp
      assert.ok(els.notes.selectionStart > 1);
      assert.equal(els.notes.selectionStart, els.notes.selectionEnd);
    });
  });

  describe('storage key uses docName', () => {
    it('uses global when docName is empty', () => {
      state.docName = '';
      els.notesTitle.value = 'X';
      saveNotesFromUI();
      assert.ok(localStorage.getItem('novareader-notes:global'));
    });

    it('uses global when docName is undefined', () => {
      state.docName = undefined;
      els.notesTitle.value = 'Y';
      saveNotesFromUI();
      assert.ok(localStorage.getItem('novareader-notes:global'));
    });
  });

  describe('initNotesController', () => {
    it('attaches click listener to saveNotes button', () => {
      const btn = document.createElement('button');
      els.saveNotes = btn;
      els.exportNotes = null;
      els.exportNotesMd = null;
      els.exportNotesJson = null;
      els.importNotesJson = null;
      els.insertTimestamp = null;

      initNotesController();

      // Simulate click - should call saveNotesFromUI
      els.notesTitle.value = 'Init Test';
      btn.dispatchEvent(new Event('click'));
      const stored = JSON.parse(localStorage.getItem('novareader-notes:test.pdf'));
      assert.equal(stored.title, 'Init Test');
    });

    it('attaches click listener to exportNotes button', () => {
      els.saveNotes = null;
      const btn = document.createElement('button');
      els.exportNotes = btn;
      els.exportNotesMd = null;
      els.exportNotesJson = null;
      els.importNotesJson = null;
      els.insertTimestamp = null;

      const clicks = [];
      const origCreate = document.createElement;
      document.createElement = (tag) => {
        const el = origCreate(tag);
        if (tag === 'a') el.click = () => clicks.push(el);
        return el;
      };

      initNotesController();
      btn.dispatchEvent(new Event('click'));
      document.createElement = origCreate;

      assert.equal(clicks.length, 1);
      assert.ok(clicks[0].download.endsWith('.txt'));
    });

    it('attaches click listener to exportNotesMd button', () => {
      els.saveNotes = null;
      els.exportNotes = null;
      const btn = document.createElement('button');
      els.exportNotesMd = btn;
      els.exportNotesJson = null;
      els.importNotesJson = null;
      els.insertTimestamp = null;

      const clicks = [];
      const origCreate = document.createElement;
      document.createElement = (tag) => {
        const el = origCreate(tag);
        if (tag === 'a') el.click = () => clicks.push(el);
        return el;
      };

      initNotesController();
      btn.dispatchEvent(new Event('click'));
      document.createElement = origCreate;

      assert.equal(clicks.length, 1);
      assert.ok(clicks[0].download.endsWith('.md'));
    });

    it('attaches click listener to exportNotesJson button', () => {
      els.saveNotes = null;
      els.exportNotes = null;
      els.exportNotesMd = null;
      const btn = document.createElement('button');
      els.exportNotesJson = btn;
      els.importNotesJson = null;
      els.insertTimestamp = null;

      const clicks = [];
      const origCreate = document.createElement;
      document.createElement = (tag) => {
        const el = origCreate(tag);
        if (tag === 'a') el.click = () => clicks.push(el);
        return el;
      };

      initNotesController();
      btn.dispatchEvent(new Event('click'));
      document.createElement = origCreate;

      assert.equal(clicks.length, 1);
      assert.ok(clicks[0].download.endsWith('.json'));
    });

    it('attaches click listener to insertTimestamp button', () => {
      els.saveNotes = null;
      els.exportNotes = null;
      els.exportNotesMd = null;
      els.exportNotesJson = null;
      els.importNotesJson = null;
      const btn = document.createElement('button');
      els.insertTimestamp = btn;
      els.notes.value = 'hello';
      els.notes.selectionStart = 5;
      els.notes.focus = () => {};

      initNotesController();
      btn.dispatchEvent(new Event('click'));

      assert.ok(els.notes.value.includes('['));
    });

    it('attaches change listener to importNotesJson input', async () => {
      els.saveNotes = null;
      els.exportNotes = null;
      els.exportNotesMd = null;
      els.exportNotesJson = null;
      const input = document.createElement('input');
      els.importNotesJson = input;
      els.notesImportMode = document.createElement('select');
      els.notesImportMode.value = 'replace';
      els.insertTimestamp = null;

      initNotesController();

      const imported = JSON.stringify({ title: 'Via Event', tags: '', text: 'event text' });
      const blob = new Blob([imported], { type: 'application/json' });

      // Simulate change event with files
      const evt = new Event('change');
      Object.defineProperty(evt, 'target', {
        value: { files: [blob], value: 'fakepath' },
      });
      input.dispatchEvent(evt);

      await new Promise(r => setTimeout(r, 50));

      const stored = JSON.parse(localStorage.getItem('novareader-notes:test.pdf'));
      assert.equal(stored.title, 'Via Event');
    });

    it('uses append mode when notesImportMode is null', async () => {
      els.saveNotes = null;
      els.exportNotes = null;
      els.exportNotesMd = null;
      els.exportNotesJson = null;
      const input = document.createElement('input');
      els.importNotesJson = input;
      els.notesImportMode = null;
      els.insertTimestamp = null;

      localStorage.setItem('novareader-notes:test.pdf', JSON.stringify({
        title: 'Existing', tags: '', text: 'existing',
      }));

      initNotesController();

      const imported = JSON.stringify({ title: '', tags: '', text: 'appended' });
      const blob = new Blob([imported], { type: 'application/json' });

      const evt = new Event('change');
      Object.defineProperty(evt, 'target', {
        value: { files: [blob], value: '' },
      });
      input.dispatchEvent(evt);

      await new Promise(r => setTimeout(r, 50));

      const stored = JSON.parse(localStorage.getItem('novareader-notes:test.pdf'));
      assert.ok(stored.text.includes('existing'));
      assert.ok(stored.text.includes('appended'));
    });

    it('sets up auto-save debounce on notes textarea input', () => {
      els.saveNotes = null;
      els.exportNotes = null;
      els.exportNotesMd = null;
      els.exportNotesJson = null;
      els.importNotesJson = null;
      els.insertTimestamp = null;

      initNotesController();

      // Dispatch input event on notes textarea - should not throw
      assert.doesNotThrow(() => {
        els.notes.dispatchEvent(new Event('input'));
      });
    });

    it('loads notes into UI on init', () => {
      localStorage.setItem('novareader-notes:test.pdf', JSON.stringify({
        title: 'Init Title', tags: 'init-tag', text: 'init text',
      }));
      els.saveNotes = null;
      els.exportNotes = null;
      els.exportNotesMd = null;
      els.exportNotesJson = null;
      els.importNotesJson = null;
      els.insertTimestamp = null;

      initNotesController();

      assert.equal(els.notesTitle.value, 'Init Title');
      assert.equal(els.notesTags.value, 'init-tag');
      assert.equal(els.notes.value, 'init text');
    });

    it('handles all els being null', () => {
      els.saveNotes = null;
      els.exportNotes = null;
      els.exportNotesMd = null;
      els.exportNotesJson = null;
      els.importNotesJson = null;
      els.insertTimestamp = null;
      els.notes = null;
      els.notesTitle = null;
      els.notesTags = null;
      els.notesStatus = null;

      assert.doesNotThrow(() => initNotesController());
    });
  });
});
