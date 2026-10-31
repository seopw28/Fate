const test = require('node:test');
const assert = require('node:assert/strict');
const { createInventory, applyCardReward } = require('../account/inventory-ledger.js');

const validCards = new Set(['core.estelle-frostblade']);
const reward = {
  eventVersion: 1,
  rewardEventId: 'reward-001',
  userId: 'user-1',
  characterId: 'estelle',
  conversationId: 'conversation-9',
  achievementId: 'bond-3',
  cardId: 'core.estelle-frostblade',
  quantity: 1,
  grantedAt: '2026-10-31T00:00:00.000Z',
  claimedAt: null,
  sourceVersion: 'character-chat-v1'
};

test('character-chat reward adds a card and provenance', () => {
  const result = applyCardReward(createInventory('user-1'), reward, validCards);
  assert.equal(result.ok, true);
  assert.equal(result.inventory.cards[reward.cardId], 1);
  assert.equal(result.inventory.rewardLedger[reward.rewardEventId].conversationId, 'conversation-9');
});

test('rewardEventId makes reward delivery idempotent', () => {
  const first = applyCardReward(createInventory('user-1'), reward, validCards);
  const second = applyCardReward(first.inventory, reward, validCards);
  assert.equal(second.duplicate, true);
  assert.equal(second.inventory.cards[reward.cardId], 1);
  assert.equal(second.inventory.revision, 1);
});

test('unknown cards and wrong users are rejected', () => {
  assert.equal(applyCardReward(createInventory('user-1'), { ...reward, cardId: 'missing' }, validCards).reason, 'UNKNOWN_CARD');
  assert.equal(applyCardReward(createInventory('user-2'), reward, validCards).reason, 'WRONG_USER');
});
