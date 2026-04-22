const express = require('express');

const app = express();
app.get('/', (req, res) => {
    try {
        res.cookie('test', '123', { secure: 'my-string-url' });
        res.json({ success: true });
    } catch(e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

app.listen(3000, () => console.log('started'));
