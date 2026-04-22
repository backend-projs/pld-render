const crypto = require('crypto');

function generateCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 4; i++) {
        code += chars[crypto.randomInt(0, chars.length)];
    }
    return code;
}

module.exports = generateCode;
