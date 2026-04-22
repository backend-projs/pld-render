const { assertJwtSecretOrThrow } = require('./envValidation');

function getJwtSecret() {
    return assertJwtSecretOrThrow();
}

module.exports = {
    getJwtSecret
};
