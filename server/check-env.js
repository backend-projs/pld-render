const path = require('path');
const dotenv = require('dotenv');

// Explicitly load .env from the same folder as this script
dotenv.config({ path: path.join(__dirname, '.env') });

console.log('--- Environment Check ---');
console.log('PORT:', process.env.PORT);
console.log('JWT_SECRET:', process.env.JWT_SECRET ? '✅ Defined' : '❌ NOT DEFINED');
console.log('-------------------------');
