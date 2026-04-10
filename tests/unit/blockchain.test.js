// ─── Unit Tests: Blockchain ───────────────────────────────────────────────────
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Blockchain, createBlockchain } from '../../app/modules/blockchain.js';

// ─── Genesis Block ───────────────────────────────────────────────────────────

describe('Blockchain – genesis block', () => {
  it('chain starts with exactly one block', () => {
    const bc = new Blockchain();
    assert.equal(bc.chain.length, 1);
  });

  it('genesis block has index 0', () => {
    const bc = new Blockchain();
    assert.equal(bc.chain[0].index, 0);
  });

  it('genesis block has no transactions', () => {
    const bc = new Blockchain();
    assert.equal(bc.chain[0].transactions.length, 0);
  });

  it('genesis block previousHash is "0"', () => {
    const bc = new Blockchain();
    assert.equal(bc.chain[0].previousHash, '0');
  });

  it('genesis block has a non-empty hash string', () => {
    const bc = new Blockchain();
    assert.equal(typeof bc.chain[0].hash, 'string');
    assert.ok(bc.chain[0].hash.length > 0);
  });
});

// ─── addTransaction ───────────────────────────────────────────────────────────

describe('Blockchain – addTransaction', () => {
  it('adds a transaction to pendingTransactions', () => {
    const bc = new Blockchain();
    bc.addTransaction({ from: 'alice', to: 'bob', amount: 10, timestamp: 1 });
    assert.equal(bc.pendingTransactions.length, 1);
    assert.equal(bc.pendingTransactions[0].from, 'alice');
    assert.equal(bc.pendingTransactions[0].to, 'bob');
    assert.equal(bc.pendingTransactions[0].amount, 10);
  });

  it('accumulates multiple transactions', () => {
    const bc = new Blockchain();
    bc.addTransaction({ from: 'a', to: 'b', amount: 1, timestamp: 1 });
    bc.addTransaction({ from: 'b', to: 'c', amount: 2, timestamp: 2 });
    assert.equal(bc.pendingTransactions.length, 2);
  });

  it('throws when amount is zero', () => {
    const bc = new Blockchain();
    assert.throws(
      () => bc.addTransaction({ from: 'a', to: 'b', amount: 0, timestamp: 1 }),
      /positive/,
    );
  });

  it('throws when amount is negative', () => {
    const bc = new Blockchain();
    assert.throws(
      () => bc.addTransaction({ from: 'a', to: 'b', amount: -5, timestamp: 1 }),
      /positive/,
    );
  });
});

// ─── mineBlock ────────────────────────────────────────────────────────────────

describe('Blockchain – mineBlock', () => {
  it('adds a new block to the chain', () => {
    const bc = new Blockchain(1);
    bc.mineBlock('miner');
    assert.equal(bc.chain.length, 2);
  });

  it('new block has the correct index', () => {
    const bc = new Blockchain(1);
    const block = bc.mineBlock('miner');
    assert.equal(block.index, 1);
  });

  it('new block links to genesis via previousHash', () => {
    const bc = new Blockchain(1);
    const genesis = bc.chain[0];
    const block = bc.mineBlock('miner');
    assert.equal(block.previousHash, genesis.hash);
  });

  it('block hash starts with the required leading zeros', () => {
    const bc = new Blockchain(2);
    const block = bc.mineBlock('miner');
    assert.ok(block.hash.startsWith('00'), `hash ${block.hash} should start with '00'`);
  });

  it('clears pendingTransactions after mining', () => {
    const bc = new Blockchain(1);
    bc.addTransaction({ from: 'a', to: 'b', amount: 5, timestamp: 1 });
    bc.mineBlock('miner');
    assert.equal(bc.pendingTransactions.length, 0);
  });

  it('includes pending transactions in the mined block', () => {
    const bc = new Blockchain(1);
    bc.addTransaction({ from: 'alice', to: 'bob', amount: 20, timestamp: 1 });
    const block = bc.mineBlock('miner');
    const txs = block.transactions;
    // First tx is the coinbase reward; user tx should also be present.
    const userTx = txs.find((tx) => tx.from === 'alice');
    assert.ok(userTx, 'user transaction should be in the mined block');
    assert.equal(userTx.amount, 20);
  });

  it('includes a coinbase reward transaction for the miner', () => {
    const bc = new Blockchain(1);
    const block = bc.mineBlock('minerAddr');
    const reward = block.transactions.find((tx) => tx.to === 'minerAddr' && tx.from === 'COINBASE');
    assert.ok(reward, 'coinbase reward transaction should be present');
    assert.ok(reward.amount > 0);
  });

  it('can mine multiple blocks sequentially', () => {
    const bc = new Blockchain(1);
    bc.mineBlock('miner');
    bc.mineBlock('miner');
    assert.equal(bc.chain.length, 3);
    assert.equal(bc.chain[2].previousHash, bc.chain[1].hash);
  });
});

// ─── isValid ─────────────────────────────────────────────────────────────────

describe('Blockchain – isValid', () => {
  it('a fresh chain is valid', () => {
    const bc = new Blockchain(1);
    assert.ok(bc.isValid());
  });

  it('chain with mined blocks is valid', () => {
    const bc = new Blockchain(1);
    bc.addTransaction({ from: 'a', to: 'b', amount: 3, timestamp: 1 });
    bc.mineBlock('miner');
    bc.mineBlock('miner');
    assert.ok(bc.isValid());
  });

  it('detects a tampered block hash', () => {
    const bc = new Blockchain(1);
    bc.mineBlock('miner');

    // Directly mutate the chain copy won't work — we need to use the internal
    // chain. Access via the getter, then tamper with the object reference.
    const chain = bc.chain;
    // The getter returns a copy of the array but the Block objects are shared.
    chain[1].hash = 'deadbeef';

    // isValid should now fail because block[1].hash no longer matches its data,
    // AND block[2] (if any) would have a broken previousHash link. Here we
    // only tamper the second block's hash field.
    // Re-fetch the live chain via bc.chain — the mutation applied to the object.
    assert.ok(!bc.isValid());
  });

  it('detects a tampered previousHash', () => {
    const bc = new Blockchain(1);
    bc.mineBlock('miner');

    const chain = bc.chain;
    chain[1].previousHash = 'tampered';
    assert.ok(!bc.isValid());
  });

  it('detects tampered transaction data', () => {
    const bc = new Blockchain(1);
    bc.addTransaction({ from: 'alice', to: 'bob', amount: 10, timestamp: 1 });
    bc.mineBlock('miner');

    const chain = bc.chain;
    // Mutate the amount in the mined transaction.
    const tx = chain[1].transactions.find((t) => t.from === 'alice');
    if (tx) tx.amount = 9999;

    assert.ok(!bc.isValid());
  });
});

// ─── getBalance ──────────────────────────────────────────────────────────────

describe('Blockchain – getBalance', () => {
  it('returns 0 for an unknown address', () => {
    const bc = new Blockchain(1);
    assert.equal(bc.getBalance('nobody'), 0);
  });

  it('reflects mining reward in miner balance', () => {
    const bc = new Blockchain(1);
    bc.mineBlock('miner');
    assert.ok(bc.getBalance('miner') > 0);
  });

  it('tracks send and receive across blocks', () => {
    const bc = new Blockchain(1);
    // Give 'alice' some coins first.
    bc.mineBlock('alice'); // alice earns mining reward
    const reward = bc.getBalance('alice');

    // Now alice sends 10 to bob.
    bc.addTransaction({ from: 'alice', to: 'bob', amount: 10, timestamp: Date.now() });
    bc.mineBlock('miner');

    assert.equal(bc.getBalance('alice'), reward - 10);
    assert.equal(bc.getBalance('bob'), 10);
  });

  it('pending transactions are not counted in balance', () => {
    const bc = new Blockchain(1);
    bc.mineBlock('alice');
    const balanceBefore = bc.getBalance('alice');

    bc.addTransaction({ from: 'alice', to: 'bob', amount: 5, timestamp: Date.now() });
    // Not mined yet — balance should be unchanged.
    assert.equal(bc.getBalance('alice'), balanceBefore);
  });

  it('multiple blocks accumulate balance correctly', () => {
    const bc = new Blockchain(1);
    bc.mineBlock('miner');
    bc.mineBlock('miner');
    bc.mineBlock('miner');
    const balance = bc.getBalance('miner');
    // Three mining rewards.
    assert.ok(balance > 0);
    // Each additional mine adds the same reward.
    const singleReward = bc.chain[1].transactions[0].amount;
    assert.equal(balance, singleReward * 3);
  });
});

// ─── difficulty ──────────────────────────────────────────────────────────────

describe('Blockchain – difficulty', () => {
  it('defaults to 2 when not specified', () => {
    const bc = new Blockchain();
    assert.equal(bc.difficulty, 2);
  });

  it('uses the provided difficulty', () => {
    const bc = new Blockchain(3);
    assert.equal(bc.difficulty, 3);
  });
});

// ─── createBlockchain factory ────────────────────────────────────────────────

describe('createBlockchain', () => {
  it('returns a Blockchain instance', () => {
    const bc = createBlockchain(1);
    assert.ok(bc instanceof Blockchain);
  });

  it('uses default difficulty when called with no args', () => {
    const bc = createBlockchain();
    assert.equal(bc.difficulty, 2);
  });
});
