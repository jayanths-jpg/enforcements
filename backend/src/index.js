require('dotenv').config();
const express = require('express');
const cors = require('cors');
const enforcementRoutes = require('./routes/enforcements');
const scrapeRoutes = require('./routes/scrape');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST'],
}));
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

app.use('/api/enforcements', enforcementRoutes);
app.use('/api/scrape', scrapeRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Fed enforcement API running on port ${PORT}`);
});
