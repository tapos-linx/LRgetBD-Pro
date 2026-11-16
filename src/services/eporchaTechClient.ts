import { Capacitor, CapacitorHttp } from '@capacitor/core';

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
          'User-Agent':
            'Mozilla/5.0 (Linux; Android 16; CPH2689) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
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
  if (isCapacitorNativeRuntime()) {
    const start = Date.now();
    try {
      const response = await CapacitorHttp.get({
        url: 'https://eporcha.tech',
        connectTimeout: 8000,
        readTimeout: 8000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Linux; Android 16; CPH2689) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });
      const latencyMs = Date.now() - start;
      return {
        reachable: response.status > 0 && response.status < 500,
        status: response.status,
        latencyMs,
        checkedAt: new Date().toISOString(),
      };
    } catch {
      return {
        reachable: false,
        status: 0,
        latencyMs: Date.now() - start,
        checkedAt: new Date().toISOString(),
      };
    }
  }

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
  let rawHtml = '';
  if (isCapacitorNativeRuntime()) {
    const nativeRes = await CapacitorHttp.get({
      url: portalPageUrl,
      connectTimeout: 8500,
      readTimeout: 8500,
      responseType: 'text',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Linux; Android 16; CPH2689) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
        Referer: 'https://eporcha.tech/',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    if (!nativeRes || nativeRes.status < 200 || nativeRes.status >= 300) {
      throw new Error(`eporcha.tech HTML fetch failed: HTTP ${nativeRes?.status ?? 0}`);
    }
    rawHtml =
      typeof nativeRes.data === 'string'
        ? nativeRes.data
        : JSON.stringify(nativeRes.data ?? '');
  } else {
    const proxyUrl = `/api/eporcha-proxy?url=${encodeURIComponent(portalPageUrl)}`;
    const response = await fetch(proxyUrl);
    if (!response.ok) {
      throw new Error(`eporcha.tech HTML fetch failed: HTTP ${response.status}`);
    }
    rawHtml = await response.text();
  }
  const anchors: Array<{ href: string; className: string; linkText: string }> = [];

  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(rawHtml, 'text/html');
    doc.querySelectorAll('a[href]').forEach((el) => {
      anchors.push({
        href: el.getAttribute('href') || '',
        className: el.getAttribute('class') || '',
        linkText: (el.textContent || '').trim(),
      });
    });
  } else {
    const anchorRegex = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;
    while ((match = anchorRegex.exec(rawHtml)) !== null) {
      const attrs = match[1] || '';
      const inner = (match[2] || '').replace(/<[^>]*>/g, '').trim();
      const hrefMatch = attrs.match(/\bhref\s*=\s*["']([^"']*)["']/i);
      const classMatch = attrs.match(/\bclass\s*=\s*["']([^"']*)["']/i);
      if (hrefMatch?.[1]) {
        anchors.push({
          href: hrefMatch[1],
          className: classMatch?.[1] || '',
          linkText: inner,
        });
      }
    }
  }

  let targetPdfUrl: string | null = null;
  const originBase = portalPageUrl.startsWith('http')
    ? portalPageUrl
    : 'https://eporcha.tech/';

  for (const { href, className, linkText } of anchors) {
    const isTargetDoc =
      linkText.toLowerCase().includes(docType.toLowerCase()) ||
      href.toLowerCase().includes(docType.toLowerCase()) ||
      className.includes('download-pdf');

    if (isTargetDoc && href.toLowerCase().endsWith('.pdf')) {
      try {
        const resolved = new URL(href, originBase);
        if (resolved.hostname.endsWith('eporcha.tech')) {
          targetPdfUrl = resolved.toString();
          break;
        }
      } catch {
        // Ignore invalid href
      }
    }
  }

  if (!targetPdfUrl) {
    throw new Error(`Could not find the ${docType} PDF link in the HTML for Mouza ${mouza}`);
  }

  return targetPdfUrl;
}


