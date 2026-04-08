// ─── Unit Tests: Notification Manager ────────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  isNotificationSupported,
  getPermissionStatus,
  requestPermission,
  showNotification,
  showIfPermitted,
} from '../../app/modules/notification-manager.js';

// ─── Mock setup ──────────────────────────────────────────────────────────────

let _instances = [];

beforeEach(() => {
  _instances = [];
  globalThis.Notification = class Notification {
    static permission = 'granted';
    static async requestPermission() { return Notification.permission; }
    constructor(title, opts) { this.title = title; this.opts = opts; _instances.push(this); }
  };
});

afterEach(() => {
  delete globalThis.Notification;
});

// ─── isNotificationSupported ──────────────────────────────────────────────────

describe('isNotificationSupported', () => {
  it('returns a boolean', () => {
    assert.equal(typeof isNotificationSupported(), 'boolean');
  });

  it('returns true when Notification is present in globalThis', () => {
    assert.equal(isNotificationSupported(), true);
  });

  it('returns false when Notification is absent', () => {
    delete globalThis.Notification;
    assert.equal(isNotificationSupported(), false);
  });
});

// ─── getPermissionStatus ──────────────────────────────────────────────────────

describe('getPermissionStatus', () => {
  it('returns the current permission from the mock (granted)', () => {
    assert.equal(getPermissionStatus(), 'granted');
  });

  it('reflects permission changes on the mock', () => {
    globalThis.Notification.permission = 'default';
    assert.equal(getPermissionStatus(), 'default');
  });

  it('returns "denied" when Notification is absent', () => {
    delete globalThis.Notification;
    assert.equal(getPermissionStatus(), 'denied');
  });
});

// ─── requestPermission ────────────────────────────────────────────────────────

describe('requestPermission', () => {
  it('resolves to "granted" when mock returns granted', async () => {
    const result = await requestPermission();
    assert.equal(result, 'granted');
  });

  it('resolves to "default" when mock permission is default', async () => {
    globalThis.Notification.permission = 'default';
    globalThis.Notification.requestPermission = async () => 'default';
    const result = await requestPermission();
    assert.equal(result, 'default');
  });

  it('resolves to "denied" when mock permission is denied', async () => {
    globalThis.Notification.permission = 'denied';
    globalThis.Notification.requestPermission = async () => 'denied';
    const result = await requestPermission();
    assert.equal(result, 'denied');
  });

  it('resolves to "denied" when Notification is absent', async () => {
    delete globalThis.Notification;
    const result = await requestPermission();
    assert.equal(result, 'denied');
  });
});

// ─── showNotification ─────────────────────────────────────────────────────────

describe('showNotification', () => {
  it('returns a Notification instance when permission is granted', () => {
    const notif = showNotification('OCR Complete');
    assert.ok(notif instanceof globalThis.Notification);
    assert.equal(notif.title, 'OCR Complete');
  });

  it('passes opts to the Notification constructor', () => {
    const opts = { body: 'Your document is ready', icon: '/icon.png' };
    const notif = showNotification('Download Done', opts);
    assert.ok(notif !== null);
    assert.equal(notif.opts, opts);
  });

  it('pushes the instance into the tracking array', () => {
    showNotification('Test');
    assert.equal(_instances.length, 1);
  });

  it('returns null when permission is denied', () => {
    globalThis.Notification.permission = 'denied';
    const result = showNotification('OCR Complete');
    assert.equal(result, null);
  });

  it('returns null when permission is default', () => {
    globalThis.Notification.permission = 'default';
    const result = showNotification('OCR Complete');
    assert.equal(result, null);
  });

  it('returns null when Notification is absent', () => {
    delete globalThis.Notification;
    const result = showNotification('OCR Complete');
    assert.equal(result, null);
  });

  it('catches constructor errors and returns null', () => {
    globalThis.Notification = class Notification {
      static permission = 'granted';
      constructor() { throw new Error('Construction failed'); }
    };
    const result = showNotification('Should fail');
    assert.equal(result, null);
  });
});

// ─── showIfPermitted ──────────────────────────────────────────────────────────

describe('showIfPermitted', () => {
  it('returns a Notification when permission is already granted', async () => {
    const notif = await showIfPermitted('OCR Complete', { body: 'Done' });
    assert.ok(notif instanceof globalThis.Notification);
    assert.equal(notif.title, 'OCR Complete');
  });

  it('requests permission when status is "default" and shows notification if granted', async () => {
    globalThis.Notification.permission = 'default';
    globalThis.Notification.requestPermission = async () => {
      globalThis.Notification.permission = 'granted';
      return 'granted';
    };
    const notif = await showIfPermitted('OCR Complete');
    assert.ok(notif instanceof globalThis.Notification);
  });

  it('returns null when permission is denied', async () => {
    globalThis.Notification.permission = 'denied';
    const result = await showIfPermitted('OCR Complete');
    assert.equal(result, null);
  });

  it('returns null when "default" permission request resolves to "denied"', async () => {
    globalThis.Notification.permission = 'default';
    globalThis.Notification.requestPermission = async () => {
      // permission stays 'default' / effectively denied — stays default, showNotification returns null
      return 'denied';
    };
    const result = await showIfPermitted('OCR Complete');
    assert.equal(result, null);
  });

  it('returns null when Notification is absent', async () => {
    delete globalThis.Notification;
    const result = await showIfPermitted('OCR Complete');
    assert.equal(result, null);
  });
});
