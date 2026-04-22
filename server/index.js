const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const dns = require('node:dns');
const { assertJwtSecretOrThrow } = require('./utils/envValidation');
const { startCronJob } = require('./cron');

// Fix for Node.js 17+ on Render silently hanging on Discord IPv6 WebSockets
dns.setDefaultResultOrder('ipv4first');

const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });
console.log('--- Startup Info ---');
console.log('PORT:', process.env.PORT);
console.log('--------------------');
assertJwtSecretOrThrow();

const app = express();
app.set('trust proxy', true); // Trust proxies (Railway/Render) for secure cookies
const PORT = process.env.PORT || 5000;

// Middleware
app.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowedOrigins = [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:5174',
        process.env.VITE_FRONTEND_URL,
        process.env.FRONTEND_URL
    ].filter(Boolean);

    if (process.env.NODE_ENV === 'production' && origin) {
        console.log(`[CORS DEBUG] Incoming Origin: ${origin}`);
    }

    if (origin) {
        if (allowedOrigins.includes(origin) || allowedOrigins.includes('*') || process.env.NODE_ENV !== 'production') {
            res.header('Access-Control-Allow-Origin', origin);
            res.header('Access-Control-Allow-Credentials', 'true');
        }
    } else if (process.env.NODE_ENV !== 'production') {
        // For tools like Postman or direct browser access without origin
        res.header('Access-Control-Allow-Origin', '*');
    }

    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, x-admin-password, Cookie');
    res.header('Access-Control-Expose-Headers', 'set-cookie');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});

app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));

// Debug logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} Origin: ${req.headers.origin}`);
    next();
});

// Normalize double slashes in URL
app.use((req, res, next) => {
    const oldUrl = req.url;
    req.url = req.url.replace(/\/{2,}/g, '/');
    if (oldUrl !== req.url) {
        console.log(`[URL FIX] ${oldUrl} -> ${req.url}`);
    }
    next();
});

const verifications = {};
module.exports.verifications = verifications;

// Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Discord Bot Setup
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Channel] // Required to receive DMs
});

client.on('debug', console.log);
client.on('error', console.error);
client.on('warn', console.warn);
client.on('clientReady', () => console.log('Client has emitted the ready event!'));

if (process.env.DISCORD_TOKEN) {
    const t = process.env.DISCORD_TOKEN;
    console.log(`[DISCORD] Connecting with token starting with ${t.substring(0, 5)}... length: ${t.length}`);

    console.log('[DIAGNOSTICS] Pinging Discord API natively to check for Render IP blocks...');
    fetch('https://discord.com/api/v10/gateway/bot', {
        headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` },
        signal: AbortSignal.timeout(10000)
    }).then(async res => {
        console.log(`[DIAGNOSTICS] SUCCESS! Status: ${res.status} ${res.statusText}`);
        const body = await res.text();
        console.log(`[DIAGNOSTICS] Body: ${body.substring(0, 150)}`);
    }).catch(err => {
        console.error('[DIAGNOSTICS] FAILED TO PING DISCORD:', err.message);
    });

    client.login(process.env.DISCORD_TOKEN).then(() => {
        console.log(`Logged in as ${client.user.tag}!`);
    }).catch(err => {
        console.error('Discord login failed:', err);
    });
} else {
    console.log('No DISCORD_TOKEN found in .env, skipping Discord login.');
}

// Make discord client available in routes
app.use((req, res, next) => {
    req.discordClient = client;
    next();
});

// Discord Verification Routes
app.use('/register', require('./routes/register'));
app.use('/verify', require('./routes/verify'));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/students', require('./routes/students'));
app.use('/api/questions', require('./routes/questions'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/users', require('./routes/users'));
app.use('/api/announcements', require('./routes/announcements'));
app.use('/api/majors', require('./routes/majors'));
app.use('/api/ai', require('./routes/ai'));


app.get('/', (req, res) => {
    res.send('PLD Management API is running');
});

// Catch-all 404 for debugging
app.use((req, res) => {
    console.warn(`[404] No route found for: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Start the background notification processor
startCronJob(client);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
