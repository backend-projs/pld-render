// server/utils/verificationStore.js

/**
 * Shared in-memory store for Discord verification codes.
 * Format: { [discordUsername]: { code: string, expiresAt: number } }
 */
const verifications = {};

module.exports = verifications;
