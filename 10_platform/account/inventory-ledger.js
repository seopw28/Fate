'use strict';

function createInventory(userId) {
  return { schemaVersion: 1, userId: String(userId), cards: {}, rewardLedger: {}, revision: 0 };
}

function applyCardReward(inventory, reward, validCardIds) {
  if (!inventory || inventory.schemaVersion !== 1) return { ok: false, reason: 'INVALID_INVENTORY', inventory };
  if (!reward?.rewardEventId || reward.eventVersion !== 1) return { ok: false, reason: 'INVALID_REWARD', inventory };
  if (String(reward.userId) !== inventory.userId) return { ok: false, reason: 'WRONG_USER', inventory };
  if (!validCardIds.has(reward.cardId)) return { ok: false, reason: 'UNKNOWN_CARD', inventory };
  if (!Number.isInteger(reward.quantity) || reward.quantity < 1) return { ok: false, reason: 'INVALID_QUANTITY', inventory };
  if (inventory.rewardLedger[reward.rewardEventId]) return { ok: true, duplicate: true, inventory };

  const next = structuredClone(inventory);
  next.cards[reward.cardId] = (next.cards[reward.cardId] ?? 0) + reward.quantity;
  next.rewardLedger[reward.rewardEventId] = {
    cardId: reward.cardId,
    quantity: reward.quantity,
    characterId: reward.characterId,
    conversationId: reward.conversationId,
    achievementId: reward.achievementId,
    grantedAt: reward.grantedAt,
    claimedAt: reward.claimedAt ?? null,
    sourceVersion: reward.sourceVersion
  };
  next.revision += 1;
  return { ok: true, duplicate: false, inventory: next };
}

module.exports = { createInventory, applyCardReward };
