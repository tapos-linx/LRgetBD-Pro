import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Grounding Verification Route
  app.post('/api/gemini/verify-status', async (req, res) => {
    const { query } = req.body;
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: query || "What is the latest status of eporcha.tech and DLRMS services?",
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      res.status(200).json({
        text: response.text,
        groundingMetadata: response.candidates?.[0]?.groundingMetadata,
      });
    } catch (error) {
      console.error('Gemini API Error:', error);
      res.status(500).json({ error: 'Failed to verify status' });
    }
  });


  // Real HTTP check to https://eporcha.tech
  app.get('/api/eporcha-health', async (_req, res) => {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const response = await fetch('https://eporcha.tech', {
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Linux; Android 16; CPH2689) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const latencyMs = Date.now() - start;
      res.status(200).json({
        reachable: response.ok || response.status < 500,
        status: response.status,
        statusText: response.statusText,
        latencyMs,
        targetPortal: 'https://eporcha.tech',
        checkedAt: new Date().toISOString(),
      });
    } catch (error) {
      const latencyMs = Date.now() - start;
      res.status(200).json({
        reachable: false,
        status: 0,
        statusText: error instanceof Error ? error.message : 'Network error',
        latencyMs,
        targetPortal: 'https://eporcha.tech',
        checkedAt: new Date().toISOString(),
      });
    }
  });

  // Live GitHub Releases Check for tapos-linx/LR_Mass_Downloader (with optional ?repo=owner/repo override)
  app.get('/api/github-release-check', async (req, res) => {
    const requestedRepo = typeof req.query.repo === 'string' ? req.query.repo.trim() : '';
    const repo = isValidSlug ? requestedRepo : 'tapos-linx/LRgetBD-Pro';
    try {
      const response = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'LRgetBD-Pro-Release-Inspector',
        },
      });
      if (response.ok) {
        const data = await response.json();
        res.status(200).json({ ok: true, status: response.status, repo, data });
      } else {
        res.status(200).json({ ok: false, status: response.status, repo, data: null });
      }
    } catch (error) {
      res.status(200).json({
        ok: false,
        status: 0,
        repo,
        error: error instanceof Error ? error.message : 'Network error',
      });
    }
  });

  // Authentic Server-Side Relay for https://eporcha.tech (bypasses browser CORS without fabricating any data)
  app.all('/api/eporcha-proxy', async (req, res) => {
    const targetUrl = (req.query.url as string) || (req.body && req.body.url);
    if (!targetUrl || typeof targetUrl !== 'string') {
      res.status(400).json({ error: 'Missing required query parameter: url' });
      return;
    }

    let parsed: URL;
    try {
      parsed = new URL(targetUrl);
    } catch {
      res.status(400).json({ error: 'Invalid target URL format' });
      return;
    }

    const allowedHosts = ['eporcha.tech', 'www.eporcha.tech'];
    if (!allowedHosts.includes(parsed.hostname)) {
      res.status(403).json({
        error: `Domain ${parsed.hostname} is not permitted. Only https://eporcha.tech is allowed.`,
      });
      return;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);

      const fetchMethod = req.method === 'POST' && req.body?.method ? req.body.method : req.method;
      const upstreamResponse = await fetch(parsed.toString(), {
        method: fetchMethod === 'POST' ? 'POST' : 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Linux; Android 16; CPH2689) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
          Accept:
            'application/pdf,application/json,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'bn-BD,bn;q=0.9,en-US;q=0.8,en;q=0.7',
          Referer: 'https://eporcha.tech/',
          Origin: 'https://eporcha.tech',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const contentType = upstreamResponse.headers.get('content-type') || 'application/octet-stream';
      const arrayBuffer = await upstreamResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', contentType);
      res.setHeader('X-Upstream-Status', String(upstreamResponse.status));
      res.setHeader('X-Upstream-Content-Type', contentType);
      res.setHeader('X-Upstream-Url', parsed.toString());
      res.setHeader('X-Upstream-Byte-Length', String(buffer.byteLength));

      res.status(upstreamResponse.status).send(buffer);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upstream connection failed';
      res.status(502).json({
        error: 'EPORCHA_TECH_UPSTREAM_UNREACHABLE',
        message,
        targetUrl: parsed.toString(),
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
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
    console.log(`LRgetBD Pro (v2.1) server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
