const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('startup guard rejects missing JWT_SECRET', () => {
    const { assertJwtSecretOrThrow } = require('../utils/envValidation');
    const original = process.env.JWT_SECRET;

    delete process.env.JWT_SECRET;
    assert.throws(() => assertJwtSecretOrThrow(), /JWT_SECRET/i);

    process.env.JWT_SECRET = original;
});

test('startup guard rejects default-like JWT_SECRET values', () => {
    const { assertJwtSecretOrThrow } = require('../utils/envValidation');
    const original = process.env.JWT_SECRET;
    const defaults = ['secret', 'changeme', 'default', 'jwt_secret'];

    for (const value of defaults) {
        process.env.JWT_SECRET = value;
        assert.throws(() => assertJwtSecretOrThrow(), /JWT_SECRET/i);
    }

    process.env.JWT_SECRET = original;
});

test('auth verify/sign paths use shared getJwtSecret accessor', () => {
    const authMiddlewarePath = path.join(__dirname, '..', 'utils', 'authMiddleware.js');
    const authControllerPath = path.join(__dirname, '..', 'controllers', 'authController.js');
    const authMiddleware = fs.readFileSync(authMiddlewarePath, 'utf8');
    const authController = fs.readFileSync(authControllerPath, 'utf8');

    assert.match(authMiddleware, /getJwtSecret\s*\(\s*\)/);
    assert.match(authController, /getJwtSecret\s*\(\s*\)/);
    assert.doesNotMatch(authMiddleware, /process\.env\.JWT_SECRET\s*\|\|\s*['"]secret['"]/);
    assert.doesNotMatch(authController, /process\.env\.JWT_SECRET\s*\|\|\s*['"]secret['"]/);
});
