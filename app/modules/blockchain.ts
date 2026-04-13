// @ts-check
// ─── Blockchain (educational) ────────────────────────────────────────────────
// A simple proof-of-work blockchain with transactions, mining, balance tracking,
// and full-chain validation. Uses Node's built-in `node:crypto` for SHA-256.

import { createHash } from 'node:crypto';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Transaction {
  from: string;
  to: string;
  amount: number;
  timestamp: number;
}

export interface Block {
  index: number;
  timestamp: number;
  transactions: Transaction[];
  previousHash: string;
  hash: string;
  nonce: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function hashBlock(
  index: number,
  timestamp: number,
  transactions: Transaction[],
  previousHash: string,
  nonce: number,
): string {
  return sha256(
    `${index}${timestamp}${JSON.stringify(transactions)}${previousHash}${nonce}`,
  );
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MINING_REWARD = 50;
const COINBASE_ADDRESS = 'COINBASE';

// ─── Blockchain ──────────────────────────────────────────────────────────────

/**
 * A minimal proof-of-work blockchain for educational purposes.
 *
 * - Blocks contain a list of transactions.
 * - Mining adds a coinbase reward transaction and searches for a nonce that
 *   produces a hash whose hex representation starts with `difficulty` zeros.
 * - The genesis block is created automatically in the constructor.
 */
export class Blockchain {
  readonly #difficulty: number;
  #chain: Block[];
  #pendingTransactions: Transaction[];

  constructor(difficulty: number = 2) {
    this.#difficulty = difficulty;
    this.#pendingTransactions = [];
    this.#chain = [this.#createGenesisBlock()];
  }

  // ─── Getters ──────────────────────────────────────────────────────────────

  /** The full chain of committed blocks (copy). */
  get chain(): Block[] {
    return [...this.#chain];
  }

  /** Transactions waiting to be mined (copy). */
  get pendingTransactions(): Transaction[] {
    return [...this.#pendingTransactions];
  }

  /** The mining difficulty (number of leading zero digits required). */
  get difficulty(): number {
    return this.#difficulty;
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Add a transaction to the pending pool.
   * @throws {Error} When `amount` is not a positive number.
   */
  addTransaction(tx: Transaction): void {
    if (tx.amount <= 0) {
      throw new Error('Transaction amount must be positive');
    }
    this.#pendingTransactions.push({ ...tx });
  }

  /**
   * Mine all pending transactions into a new block.
   *
   * A coinbase reward transaction is prepended automatically.  After mining,
   * `pendingTransactions` is cleared.
   *
   * @param minerAddress - Address that receives the block reward.
   * @returns The newly mined `Block`.
   */
  mineBlock(minerAddress: string): Block {
    const reward: Transaction = {
      from: COINBASE_ADDRESS,
      to: minerAddress,
      amount: MINING_REWARD,
      timestamp: Date.now(),
    };

    const transactions: Transaction[] = [reward, ...this.#pendingTransactions];
    const previousBlock = this.#chain[this.#chain.length - 1];
    const index = previousBlock.index + 1;
    const timestamp = Date.now();

    let nonce = 0;
    let hash = '';
    const prefix = '0'.repeat(this.#difficulty);

    do {
      hash = hashBlock(index, timestamp, transactions, previousBlock.hash, nonce);
      nonce++;
    } while (!hash.startsWith(prefix));

    const block: Block = {
      index,
      timestamp,
      transactions,
      previousHash: previousBlock.hash,
      hash,
      nonce: nonce - 1,
    };

    this.#chain.push(block);
    this.#pendingTransactions = [];

    return block;
  }

  /**
   * Verify the entire chain is internally consistent.
   *
   * Checks:
   * 1. Each block's stored hash matches a recomputed hash.
   * 2. Each block's `previousHash` matches the preceding block's `hash`.
   *
   * The genesis block's hash is recomputed but its `previousHash` is not
   * validated (it is allowed to be any value).
   *
   * @returns `true` if the chain is valid.
   */
  isValid(): boolean {
    for (let i = 0; i < this.#chain.length; i++) {
      const block = this.#chain[i];

      // Recompute and compare hash.
      const recomputed = hashBlock(
        block.index,
        block.timestamp,
        block.transactions,
        block.previousHash,
        block.nonce,
      );
      if (block.hash !== recomputed) return false;

      // Check linkage (skip genesis).
      if (i > 0 && block.previousHash !== this.#chain[i - 1].hash) return false;
    }
    return true;
  }

  /**
   * Compute the confirmed balance for an address by scanning all mined blocks.
   * Pending transactions are not included.
   *
   * @param address - The wallet address to query.
   * @returns Net balance (credits minus debits across all committed blocks).
   */
  getBalance(address: string): number {
    let balance = 0;
    for (const block of this.#chain) {
      for (const tx of block.transactions) {
        if (tx.to === address) balance += tx.amount;
        if (tx.from === address) balance -= tx.amount;
      }
    }
    return balance;
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  #createGenesisBlock(): Block {
    const index = 0;
    const timestamp = 0;
    const transactions: Transaction[] = [];
    const previousHash = '0';
    const nonce = 0;
    const hash = hashBlock(index, timestamp, transactions, previousHash, nonce);
    return { index, timestamp, transactions, previousHash, hash, nonce };
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/** Create a new `Blockchain` with an optional mining difficulty. */
export function createBlockchain(difficulty?: number): Blockchain {
  return new Blockchain(difficulty);
}
