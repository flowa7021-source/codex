// ─── Payment Request API ──────────────────────────────────────────────────────
// Payment Request API wrapper for handling browser-native payment flows.

// @ts-check

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Whether the Payment Request API is supported.
 */
export function isPaymentRequestSupported(): boolean {
  return typeof PaymentRequest !== 'undefined';
}

/**
 * Whether a specific payment method is supported.
 * Common methods: 'basic-card', 'https://google.com/pay', 'https://apple.com/apple-pay'
 */
export async function isPaymentMethodSupported(method: string): Promise<boolean> {
  if (!isPaymentRequestSupported()) return false;
  try {
    const request = new PaymentRequest(
      [{ supportedMethods: method }],
      { total: { label: 'test', amount: { currency: 'USD', value: '0' } } },
    );
    return await request.canMakePayment() ?? false;
  } catch {
    return false;
  }
}

/**
 * Create a simple payment request for a fixed amount.
 * Returns a PaymentRequest instance or null if unsupported.
 */
export function createPaymentRequest(
  methods: PaymentMethodData[],
  details: PaymentDetailsInit,
  options?: PaymentOptions,
): PaymentRequest | null {
  if (!isPaymentRequestSupported()) return null;
  try {
    return new PaymentRequest(methods, details, options);
  } catch {
    return null;
  }
}

/**
 * Show a payment UI and return the PaymentResponse or null on failure/cancel.
 */
export async function requestPayment(
  methods: PaymentMethodData[],
  details: PaymentDetailsInit,
  options?: PaymentOptions,
): Promise<PaymentResponse | null> {
  const request = createPaymentRequest(methods, details, options);
  if (!request) return null;
  try {
    return await request.show();
  } catch {
    return null;
  }
}

/**
 * Build a simple PaymentDetailsInit for a single total amount.
 */
export function buildPaymentDetails(
  label: string,
  amount: string,
  currency: string,
): PaymentDetailsInit {
  return {
    total: {
      label,
      amount: { currency, value: amount },
    },
  };
}
