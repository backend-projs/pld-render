const WEAK_JWT_SECRETS = new Set(['secret', 'changeme', 'default', 'jwt_secret']);

function assertJwtSecretOrThrow() {
    const rawSecret = process.env.JWT_SECRET;
    const secret = typeof rawSecret === 'string' ? rawSecret.trim() : '';

    if (!secret || WEAK_JWT_SECRETS.has(secret.toLowerCase())) {
        throw new Error('Invalid JWT_SECRET: configure a non-default JWT secret before startup.');
    }

    return secret;
}

module.exports = {
    assertJwtSecretOrThrow
};
