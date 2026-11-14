import { Capacitor, CapacitorHttp } from '@capacitor/core';
import * as cheerio from 'cheerio';

import {
  BinaryValidationResult,
  ProxyConfig,
  QueueTask,
  TransportMode,
} from '../types/land';
import { inspectBinaryPayloadWithChecksum } from './binaryValidator';

export interface EporchaFetchOutcome {
  ok: boolean;
  httpStatus: number;
  transportUsed: TransportMode;
  buffer?: ArrayBuffer;
  validation?: BinaryValidationResult;
  finalUrl?: string;
  mimeType?: string;
  retrievedAt?: string;
  errorMessage?: string;
}

export function isCapacitorNativeRuntime(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function detectDefaultTransportMode(): TransportMode {
  if (isCapacitorNativeRuntime()) {
    return 'CAPACITOR_NATIVE_HTTP';
  }
  return 'SERVER_EXPRESS_RELAY';
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const clean = base64.replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
  const binaryString = atob(clean);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function stringToArrayBuffer(str: string): ArrayBuffer {
  return new TextEncoder().encode(str).buffer;
}

const clientPayloadCache = new Map<
  string,
  {
    status: number;
    buffer: ArrayBuffer;
    finalUrl: string;
    mimeType: string;
    cachedAt: number;
  }
>();
const CLIENT_CACHE_TTL_MS = 10 * 60 * 1000;

export async function fetchFromEporchaTech(
  task: QueueTask,
  proxyConfig: ProxyConfig
): Promise<EporchaFetchOutcome> {
  const activeTransport: TransportMode = isCapacitorNativeRuntime()
    ? 'CAPACITOR_NATIVE_HTTP'
    : proxyConfig.preferredMode === 'CAPACITOR_NATIVE_HTTP'
    ? 'SERVER_EXPRESS_RELAY'
    : proxyConfig.preferredMode;

  const validationContext = {
    districtName: task.districtNameEn,
    upazilaName: task.upazilaNameEn,
    unionName: task.unionNameEn,
    mouzaNameEn: task.mouzaNameEn,
    mouzaNameBn: task.mouzaNameBn,
    mouzaJlNo: task.mouzaJlNo,
    surveyType: task.surveyType,
    sourceUrl: task.targetUrl,
  };

  // 1. Native Android APK Path via CapacitorHttp
  if (activeTransport === 'CAPACITOR_NATIVE_HTTP') {
    try {
      const response = await CapacitorHttp.request({
        url: task.targetUrl,
        method: 'GET',
        responseType: 'arraybuffer',
        headers: {
          Accept: 'application/pdf,application/json,text/html,*/*',
          'Accept-Language': 'bn-BD,bn;q=0.9,en-US;q=0.8,en;q=0.7',
          Referer: 'https://eporcha.tech/',
        },
      });

      let buffer: ArrayBuffer;
      if (response.data instanceof ArrayBuffer) {
        buffer = response.data;
      } else if (typeof response.data === 'string') {
        try {
          buffer = base64ToArrayBuffer(response.data);
        } catch {
          buffer = stringToArrayBuffer(response.data);
        }
      } else {
        buffer = stringToArrayBuffer(JSON.stringify(response.data ?? ''));
      }

      const validation = await inspectBinaryPayloadWithChecksum(buffer, validationContext);
      const mimeType =
        response.headers?.['content-type'] ||
        response.headers?.['Content-Type'] ||
        'application/octet-stream';
      const retrievedAt = new Date().toISOString();

      return {
        ok: response.status >= 200 && response.status < 300,
        httpStatus: response.status,
        transportUsed: 'CAPACITOR_NATIVE_HTTP',
        buffer,
        validation,
        finalUrl: response.url || task.targetUrl,
        mimeType,
        retrievedAt,
      };
    } catch (error) {
      return {
        ok: false,
        httpStatus: 0,
        transportUsed: 'CAPACITOR_NATIVE_HTTP',
        errorMessage:
          error instanceof Error ? error.message : 'CapacitorHttp native request failed',
      };
    }
  }

  // 2. Web / Relay Transport Paths
  let requestUrl = task.targetUrl;
  if (activeTransport === 'SERVER_EXPRESS_RELAY') {
    requestUrl = `/api/eporcha-proxy?url=${encodeURIComponent(task.targetUrl)}`;
  } else if (activeTransport === 'TERMUX_LOCAL_PROXY') {
    const base = proxyConfig.termuxProxyUrl.trim() || 'http://127.0.0.1:8787/proxy?url=';
    requestUrl = `${base}${encodeURIComponent(task.targetUrl)}`;
  } else if (activeTransport === 'CLOUDFLARE_WORKER_PROXY') {
    const base = proxyConfig.customCloudflareProxyUrl.trim();
    if (!base) {
      return {
        ok: false,
        httpStatus: 0,
        transportUsed: 'CLOUDFLARE_WORKER_PROXY',
        errorMessage:
          'Cloudflare Worker Proxy URL is not configured. Enter a Worker URL or switch to Server Express Relay / Android APK.',
      };
    }
    requestUrl = `${base}${encodeURIComponent(task.targetUrl)}`;
  }

  try {
    const cached = clientPayloadCache.get(task.targetUrl);
    if (
      cached &&
      Date.now() - cached.cachedAt < CLIENT_CACHE_TTL_MS &&
      cached.buffer.byteLength > 0
    ) {
      const validation = await inspectBinaryPayloadWithChecksum(
        cached.buffer,
        validationContext
      );
      return {
        ok: cached.status >= 200 && cached.status < 300,
        httpStatus: cached.status,
        transportUsed: activeTransport,
        buffer: cached.buffer,
        validation,
        finalUrl: cached.finalUrl,
        mimeType: cached.mimeType,
        retrievedAt: new Date(cached.cachedAt).toISOString(),
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8500);

    const response = await fetch(requestUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        Accept: 'application/pdf,application/json,text/html,*/*',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const upstreamStatusHeader = response.headers.get('X-Upstream-Status');
    const effectiveStatus = upstreamStatusHeader
      ? parseInt(upstreamStatusHeader, 10)
      : response.status;
    const finalUrl =
      response.headers.get('X-Upstream-Final-Url') ||
      response.url ||
      task.targetUrl;
    const mimeType =
      response.headers.get('Content-Type') || 'application/octet-stream';
    const retrievedAt = new Date().toISOString();

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > 0) {
      if (clientPayloadCache.size >= 400) {
        const firstKey = clientPayloadCache.keys().next().value;
        if (firstKey) clientPayloadCache.delete(firstKey);
      }
      clientPayloadCache.set(task.targetUrl, {
        status: effectiveStatus,
        buffer,
        finalUrl,
        mimeType,
        cachedAt: Date.now(),
      });
    }

    const validation = await inspectBinaryPayloadWithChecksum(buffer, validationContext);

    return {
      ok: effectiveStatus >= 200 && effectiveStatus < 300,
      httpStatus: effectiveStatus,
      transportUsed: activeTransport,
      buffer,
      validation,
      finalUrl,
      mimeType,
      retrievedAt,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Browser network or CORS error';
    return {
      ok: false,
      httpStatus: 0,
      transportUsed: activeTransport,
      errorMessage: `CORS / Transport blocked (${activeTransport}): ${msg}`,
    };
  }
}

export async function checkEporchaPortalHealth(): Promise<{
  reachable: boolean;
  status: number;
  latencyMs: number;
  checkedAt: string;
}> {
  try {
    const res = await fetch('/api/eporcha-health');
    if (!res.ok) {
      return {
        reachable: false,
        status: res.status,
        latencyMs: 0,
        checkedAt: new Date().toISOString(),
      };
    }
    return await res.json();
  } catch {
    return {
      reachable: false,
      status: 0,
      latencyMs: 0,
      checkedAt: new Date().toISOString(),
    };
  }
}

export async function extractPdfUrl(
  mouza: string,
  docType: string,
  portalPageUrl: string
): Promise<string> {
  const proxyUrl = `/api/eporcha-proxy?url=${encodeURIComponent(portalPageUrl)}`;
  const response = await fetch(proxyUrl);
  if (!response.ok) {
    throw new Error(`eporcha.tech HTML fetch failed: HTTP ${response.status}`);
  }

  const rawHtml = await response.text();
  const $ = cheerio.load(rawHtml);
  const anchorTags = $('a[href]');

  let targetPdfUrl: string | null = null;
  const originBase = portalPageUrl.startsWith('http')
    ? portalPageUrl
    : 'https://eporcha.tech/';

  anchorTags.each((_, el) => {
    const linkText = $(el).text().trim();
    const href = $(el).attr('href') || '';
    const className = $(el).attr('class') || '';

    const isTargetDoc =
      linkText.toLowerCase().includes(docType.toLowerCase()) ||
      href.toLowerCase().includes(docType.toLowerCase()) ||
      className.includes('download-pdf');

    if (isTargetDoc && href.toLowerCase().endsWith('.pdf')) {
      try {
        const resolved = new URL(href, originBase);
        if (resolved.hostname.endsWith('eporcha.tech')) {
          targetPdfUrl = resolved.toString();
          return false;
        }
      } catch {
        // Ignore invalid href
      }
    }
  });

  if (!targetPdfUrl) {
    throw new Error(`Could not find the ${docType} PDF link in the HTML for Mouza ${mouza}`);
  }

  return targetPdfUrl;
}


