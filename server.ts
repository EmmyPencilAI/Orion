import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  startBackgroundScanner,
  getScannerState,
  getSignal,
  getAllSignals,
  runScan,
  ALL_SYMBOLS,
} from './src/services/scanner.js';
import { SupportedSymbol } from './src/types/signal.js';
import { getForexMarketSession } from './src/services/marketHours.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json());

// CORS for public API consumption
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Start the persistent background scanner
startBackgroundScanner();

// ----------------------------------------------------
// MANDATORY API ENDPOINTS
// ----------------------------------------------------

/**
 * GET /health
 * Keep-alive endpoint. The external cron job pings this every 5 minutes.
 * Does NOT perform a scan.
 */
app.get('/health', (_req: Request, res: Response) => {
  const state = getScannerState();
  const session = getForexMarketSession();
  res.json({
    status: state.status,
    scanner: state.scanner,
    market_open: session.is_open,
    market_status: session.status,
    message: session.message,
    reopen_time: session.reopen_time,
  });
});

/**
 * GET /market-status
 * Detailed forex session status (Open vs Weekend Close)
 */
app.get('/market-status', (_req: Request, res: Response) => {
  res.json(getForexMarketSession());
});

/**
 * GET /signals
 * Returns the latest bot-generated signals for all instruments.
 */
app.get('/signals', (_req: Request, res: Response) => {
  res.json(getAllSignals());
});

/**
 * GET /signals/:symbol
 * Returns the latest analysis for XAUUSD, USDJPY, EURUSD, GBPUSD, or USDCAD.
 */
app.get('/signals/:symbol', (req: Request, res: Response) => {
  const symbol = req.params.symbol.toUpperCase() as SupportedSymbol;
  if (!ALL_SYMBOLS.includes(symbol)) {
    return res.status(404).json({ error: `Unsupported symbol: ${symbol}. Supported: ${ALL_SYMBOLS.join(', ')}` });
  }
  const signal = getSignal(symbol);
  res.json(signal);
});

// Status helper for UI dashboard
app.get('/api/status', (_req: Request, res: Response) => {
  res.json(getScannerState());
});

// Manual scan trigger (for testing / manual refresh)
app.post('/api/scan-now', async (_req: Request, res: Response) => {
  await runScan();
  res.json({ status: 'ok', message: 'Scan completed', data: getAllSignals() });
});

// Raw file viewer/download endpoint for Render deployment files
app.get('/api/raw/:filename', (req: Request, res: Response) => {
  const allowedFiles = [
    'main.py',
    'scanner.py',
    'indicators.py',
    'data_provider.py',
    'requirements.txt',
    'render.yaml',
    'Procfile',
    'README.md',
  ];
  const filename = req.params.filename;
  if (!allowedFiles.includes(filename)) {
    return res.status(404).send('File not found');
  }

  const filePath = path.join(__dirname, filename);
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'text/plain');
    return res.sendFile(filePath);
  }
  return res.status(404).send('File not created yet');
});

// ----------------------------------------------------
// VITE / STATIC SERVING
// ----------------------------------------------------
async function setupVite() {
  if (!isProduction) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[ORION MT5 Signal Bot] Server running on http://0.0.0.0:${PORT}`);
  });
}

setupVite().catch((err) => {
  console.error('[ORION MT5 Signal Bot] Failed to start server:', err);
});
