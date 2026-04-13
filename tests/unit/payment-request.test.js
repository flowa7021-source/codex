// ─── Unit Tests: Payment Request API ─────────────────────────────────────────
import './setup-dom.js';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  isPaymentRequestSupported,
  isPaymentMethodSupported,
  createPaymentRequest,
  requestPayment,
  buildPaymentDetails,
} from '../../app/modules/payment-request.js';

// ─── Mock setup ──────────────────────────────────────────────────────────────

class MockPaymentRequest {
  constructor(methods, details, options) {
    this.methods = methods;
    this.details = details;
    this.options = options;
  }
  async canMakePayment() { return true; }
  async show() {
    return {
      methodName: this.methods[0]?.supportedMethods || 'basic-card',
      details: {},
      complete: async () => {},
    };
  }
}

beforeEach(() => {
  globalThis.PaymentRequest = MockPaymentRequest;
});

afterEach(() => {
  delete globalThis.PaymentRequest;
});

// ─── isPaymentRequestSupported ────────────────────────────────────────────────

describe('isPaymentRequestSupported', () => {
  it('returns a boolean', () => {
    assert.equal(typeof isPaymentRequestSupported(), 'boolean');
  });

  it('returns true when PaymentRequest is present', () => {
    assert.equal(isPaymentRequestSupported(), true);
  });

  it('returns false when PaymentRequest is absent', () => {
    delete globalThis.PaymentRequest;
    assert.equal(isPaymentRequestSupported(), false);
  });
});

// ─── isPaymentMethodSupported ─────────────────────────────────────────────────

describe('isPaymentMethodSupported', () => {
  it('returns a boolean', async () => {
    const result = await isPaymentMethodSupported('basic-card');
    assert.equal(typeof result, 'boolean');
  });

  it('returns true when canMakePayment resolves true', async () => {
    const result = await isPaymentMethodSupported('basic-card');
    assert.equal(result, true);
  });

  it('returns false when PaymentRequest is absent', async () => {
    delete globalThis.PaymentRequest;
    const result = await isPaymentMethodSupported('basic-card');
    assert.equal(result, false);
  });

  it('returns false when canMakePayment rejects', async () => {
    globalThis.PaymentRequest = class {
      constructor() {}
      async canMakePayment() { throw new Error('not supported'); }
    };
    const result = await isPaymentMethodSupported('basic-card');
    assert.equal(result, false);
  });
});

// ─── createPaymentRequest ────────────────────────────────────────────────────

describe('createPaymentRequest', () => {
  it('returns a PaymentRequest instance when supported', () => {
    const methods = [{ supportedMethods: 'basic-card' }];
    const details = buildPaymentDetails('Total', '9.99', 'USD');
    const request = createPaymentRequest(methods, details);
    assert.ok(request instanceof MockPaymentRequest);
  });

  it('returns null when PaymentRequest is absent', () => {
    delete globalThis.PaymentRequest;
    const methods = [{ supportedMethods: 'basic-card' }];
    const details = buildPaymentDetails('Total', '9.99', 'USD');
    const request = createPaymentRequest(methods, details);
    assert.equal(request, null);
  });

  it('passes methods and details to PaymentRequest constructor', () => {
    const methods = [{ supportedMethods: 'basic-card' }];
    const details = buildPaymentDetails('Order Total', '19.99', 'EUR');
    const request = createPaymentRequest(methods, details);
    assert.deepEqual(request.methods, methods);
    assert.deepEqual(request.details, details);
  });

  it('passes options to PaymentRequest constructor when provided', () => {
    const methods = [{ supportedMethods: 'basic-card' }];
    const details = buildPaymentDetails('Total', '5.00', 'USD');
    const options = { requestShipping: true };
    const request = createPaymentRequest(methods, details, options);
    assert.deepEqual(request.options, options);
  });

  it('returns null when PaymentRequest constructor throws', () => {
    globalThis.PaymentRequest = class {
      constructor() { throw new Error('constructor error'); }
    };
    const methods = [{ supportedMethods: 'basic-card' }];
    const details = buildPaymentDetails('Total', '9.99', 'USD');
    const request = createPaymentRequest(methods, details);
    assert.equal(request, null);
  });
});

// ─── buildPaymentDetails ──────────────────────────────────────────────────────

describe('buildPaymentDetails', () => {
  it('returns an object', () => {
    const details = buildPaymentDetails('Total', '9.99', 'USD');
    assert.ok(details !== null && typeof details === 'object');
  });

  it('returns object with total.label', () => {
    const details = buildPaymentDetails('Order Total', '9.99', 'USD');
    assert.equal(details.total.label, 'Order Total');
  });

  it('returns object with total.amount.currency', () => {
    const details = buildPaymentDetails('Total', '9.99', 'EUR');
    assert.equal(details.total.amount.currency, 'EUR');
  });

  it('returns object with total.amount.value', () => {
    const details = buildPaymentDetails('Total', '14.50', 'USD');
    assert.equal(details.total.amount.value, '14.50');
  });

  it('returns a well-formed PaymentDetailsInit structure', () => {
    const details = buildPaymentDetails('Subscription', '4.99', 'GBP');
    assert.deepEqual(details, {
      total: {
        label: 'Subscription',
        amount: { currency: 'GBP', value: '4.99' },
      },
    });
  });
});

// ─── requestPayment ───────────────────────────────────────────────────────────

describe('requestPayment', () => {
  it('returns a PaymentResponse when show() resolves', async () => {
    const methods = [{ supportedMethods: 'basic-card' }];
    const details = buildPaymentDetails('Total', '9.99', 'USD');
    const response = await requestPayment(methods, details);
    assert.ok(response !== null);
    assert.equal(typeof response.methodName, 'string');
  });

  it('returns the correct methodName from mock', async () => {
    const methods = [{ supportedMethods: 'basic-card' }];
    const details = buildPaymentDetails('Total', '9.99', 'USD');
    const response = await requestPayment(methods, details);
    assert.equal(response.methodName, 'basic-card');
  });

  it('returns null when PaymentRequest is absent', async () => {
    delete globalThis.PaymentRequest;
    const methods = [{ supportedMethods: 'basic-card' }];
    const details = buildPaymentDetails('Total', '9.99', 'USD');
    const response = await requestPayment(methods, details);
    assert.equal(response, null);
  });

  it('returns null when show() rejects', async () => {
    globalThis.PaymentRequest = class {
      constructor() {}
      async canMakePayment() { return true; }
      async show() { throw new Error('user cancelled'); }
    };
    const methods = [{ supportedMethods: 'basic-card' }];
    const details = buildPaymentDetails('Total', '9.99', 'USD');
    const response = await requestPayment(methods, details);
    assert.equal(response, null);
  });

  it('response has a complete function', async () => {
    const methods = [{ supportedMethods: 'basic-card' }];
    const details = buildPaymentDetails('Total', '9.99', 'USD');
    const response = await requestPayment(methods, details);
    assert.equal(typeof response.complete, 'function');
  });
});
