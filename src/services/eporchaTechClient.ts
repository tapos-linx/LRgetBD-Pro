import { Capacitor, CapacitorHttp } from '@capacitor/core';
import {
  BinaryValidationResult,
  ProxyConfig,
  QueueTask,
  TransportMode,
} from '../types/land';
import { inspectBinaryPayload } from './binaryValidator';

export interface EporchaFetchOutcome {
  ok: boolean;
  httpStatus: number;
  transportUsed: TransportMode;
  buffer?: ArrayBuffer;
  validation?: BinaryValidationResult;
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

  // 1. Native Android APK Path via CapacitorHttp (100% CORS-Free on Android)
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

      const validation = inspectBinaryPayload(buffer, validationContext);
      return {
        ok: response.status >= 200 && response.status < 300,
        httpStatus: response.status,
        transportUsed: 'CAPACITOR_NATIVE_HTTP',
        buffer,
        validation,
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
    const response = await fetch(requestUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/pdf,application/json,text/html,*/*',
      },
    });

    const upstreamStatusHeader = response.headers.get('X-Upstream-Status');
    const effectiveStatus = upstreamStatusHeader
      ? parseInt(upstreamStatusHeader, 10)
      : response.status;

    const buffer = await response.arrayBuffer();
    const validation = inspectBinaryPayload(buffer, validationContext);

    return {
      ok: effectiveStatus >= 200 && effectiveStatus < 300,
      httpStatus: effectiveStatus,
      transportUsed: activeTransport,
      buffer,
      validation,
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
