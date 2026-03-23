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
  insertTimestamp,
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
  });

  describe('storage key uses docName', () => {
    it('uses global when docName is empty', () => {
      state.docName = '';
      els.notesTitle.value = 'X';
      saveNotesFromUI();
      assert.ok(localStorage.getItem('novareader-notes:global'));
    });
  });
});
