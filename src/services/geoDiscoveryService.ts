import { Capacitor, CapacitorHttp } from '@capacitor/core';
import {
  DistrictNode,
  GeoSourceStatus,
  UpazilaNode,
  MouzaNode,
  SurveyType,
} from '../types/land';
import {
  BANGLADESH_NATIONWIDE_HIERARCHY,
  NABINAGAR_176_MOUZAS,
} from '../data/bangladeshNationwideHierarchy';
import bangladeshUpazilas from '../data/bangladeshUpazilasData.json';
import { geoDb } from './geographicDbService';

interface UpazilaBbsRecord {
  ID: number;
  LAMS_ID?: number;
  NAME: string;
  NAME_EN: string;
  BBS_CODE: string;
  DIVISION_BBS_CODE: string;
  DISTRICT_BBS_CODE: string;
  DISTRICT_NAME: string;
  DISTRICT_NAME_EN: string;
}

export interface DiscoveredMouzaSummary {
  upazilaId: string;
  upazilaNameEn: string;
  upazilaNameBn: string;
  totalFound: number;
  portalUrl: string;
  mouzas: MouzaNode[];
  sourceStatus: GeoSourceStatus;
  isLive: boolean;
  retrievedAt: string;
  errorMessage?: string;
}

export interface DiscoveredUpazilaSummary {
  districtId: string;
  districtNameEn: string;
  districtNameBn: string;
  totalFound: number;
  portalUrl: string;
  upazilas: UpazilaNode[];
  sourceStatus: GeoSourceStatus;
  isLive: boolean;
  retrievedAt: string;
  errorMessage?: string;
}

function formatPortalNameEn(raw: string): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return 'Unknown Upazila';
  if (trimmed === trimmed.toUpperCase()) {
    return trimmed
      .toLowerCase()
      .replace(/\b[a-z]/g, (c) => c.toUpperCase());
  }
  return trimmed;
}

function normalizeLookupKey(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function isNativeCapacitorRuntime(): boolean {
  try {
    return typeof Capacitor?.isNativePlatform === 'function' && Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

const NATIVE_PORTAL_HEADERS: Record<string, string> = {
  Accept: 'application/json,text/plain,*/*',
  'Accept-Language': 'bn-BD,bn;q=0.9,en-US;q=0.8,en;q=0.7',
  Referer: 'https://eporcha.tech/',
  Origin: 'https://eporcha.tech',
  'X-Requested-With': 'XMLHttpRequest',
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 16; CPH2689) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
};

/**
 * Live Geographic Discovery Service for eporcha.tech.
 * Enforces strict parent-child matching, malformed/HTML rejection,
 * native CapacitorHttp execution on Android APK (avoiding localhost SPA fallback),
 * and honest provenance (LIVE_SOURCE vs LOCAL_DATASET vs FAILED / NOT_FOUND).
 */
export class GeoDiscoveryService {
  private baseUrl = 'https://eporcha.tech/api';

  private parseJsonValue(raw: unknown): unknown {
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (!trimmed) {
        throw new Error('Empty upstream response body');
      }
      const lower = trimmed.toLowerCase();
      if (trimmed.startsWith('<') || lower.startsWith('<!doctype')) {
        throw new Error('Upstream response is HTML instead of JSON');
      }
      try {
        return JSON.parse(trimmed);
      } catch (err) {
        throw new Error(
          `Invalid JSON response: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
    if (raw === null || raw === undefined) {
      throw new Error('Empty upstream response body');
    }
    return raw;
  }

  private async safeParseJson(response: Response): Promise<unknown> {
    if (!response) {
      throw new Error('Missing HTTP response object');
    }

    // Prefer .text() when implemented so HTML/empty bodies are caught prior to JSON.parse
    if (typeof (response as { text?: unknown }).text === 'function') {
      const text = await response.text();
      return this.parseJsonValue(text);
    }

    // Support test mocks or response wrappers that only implement .json()
    if (typeof (response as { json?: unknown }).json === 'function') {
      const parsed = await response.json();
      return this.parseJsonValue(parsed);
    }

    throw new Error('Response object does not implement text() or json()');
  }

  /**
   * Executes a GET request for JSON against https://eporcha.tech.
   * - Inside Capacitor Android/iOS APK: calls CapacitorHttp.get() directly to avoid hitting
   *   https://localhost/api/eporcha-proxy (which does not exist in the packaged APK and serves index.html).
   * - In Web browser / Express relay / tests: calls `/api/eporcha-proxy?url=...`.
   */
  private async fetchPortalJson(targetPortalUrl: string): Promise<unknown> {
    if (isNativeCapacitorRuntime()) {
      const nativeRes = await CapacitorHttp.get({
        url: targetPortalUrl,
        headers: NATIVE_PORTAL_HEADERS,
        connectTimeout: 10000,
        readTimeout: 10000,
      });

      if (!nativeRes || nativeRes.status < 200 || nativeRes.status >= 300) {
        throw new Error(
          `Upstream HTTP ${nativeRes?.status ?? 'unknown'} while querying portal`
        );
      }
      return this.parseJsonValue(nativeRes.data);
    }

    const proxyUrl = `/api/eporcha-proxy?url=${encodeURIComponent(targetPortalUrl)}`;
    const response = await fetch(proxyUrl);
    if (!response || !response.ok) {
      throw new Error(
        `Upstream HTTP ${response?.status ?? 'unknown'} while querying portal`
      );
    }
    return this.safeParseJson(response);
  }

  private findAuthoritativeDivision(divisionId: string) {
    const clean = divisionId.toLowerCase();
    return (
      BANGLADESH_NATIONWIDE_HIERARCHY.find(
        (d) =>
          d.id === divisionId ||
          d.eporchaSlug === clean ||
          d.nameEn.toLowerCase() === clean
      ) || null
    );
  }

  private findAuthoritativeDistrict(districtId: string): DistrictNode | null {
    const clean = districtId.replace(/^dist-/, '').toLowerCase();
    for (const div of BANGLADESH_NATIONWIDE_HIERARCHY) {
      const found = div.districts.find(
        (d) =>
          d.id === districtId ||
          d.eporchaSlug === clean ||
          d.code === clean ||
          d.nameEn.toLowerCase() === clean
      );
      if (found) return found;
    }
    return null;
  }

  private findAuthoritativeUpazila(
    upazilaId: string,
    districtId?: string | null
  ): UpazilaNode | null {
    const clean = upazilaId.replace(/^upz-/, '').toLowerCase();
    if (districtId) {
      const authDist = this.findAuthoritativeDistrict(districtId);
      if (!authDist) return null;
      return (
        authDist.upazilas.find(
          (u) =>
            u.id === upazilaId ||
            u.eporchaSlug === clean ||
            u.nameEn.toLowerCase() === clean
        ) || null
      );
    }

    for (const div of BANGLADESH_NATIONWIDE_HIERARCHY) {
      for (const dist of div.districts) {
        const found = dist.upazilas.find(
          (u) =>
            u.id === upazilaId ||
            u.eporchaSlug === clean ||
            u.nameEn.toLowerCase() === clean
        );
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * Resolves district and upazila BBS codes from the 527-Upazila reference dataset.
   * Enforces strict parent-district boundaries when districtId is supplied so an Upazila
   * is never silently attached to the wrong District.
   */
  public findUpazilaBbs(
    upazilaId: string,
    districtId?: string | null
  ): UpazilaBbsRecord | null {
    const cleanUpzRaw = upazilaId.replace(/^upz-/, '').trim();
    const cleanUpz = normalizeLookupKey(cleanUpzRaw);
    if (!cleanUpz) return null;

    const upzList = bangladeshUpazilas as UpazilaBbsRecord[];

    // Strict parent district scoping whenever districtId is provided
    if (districtId !== undefined && districtId !== null && districtId.trim() !== '') {
      const cleanDistRaw = districtId.replace(/^dist-/, '').trim();
      const cleanDist = normalizeLookupKey(cleanDistRaw);
      let distCode: string | null = null;

      for (const div of BANGLADESH_NATIONWIDE_HIERARCHY) {
        const matchDist = div.districts.find(
          (d) =>
            d.id === districtId ||
            normalizeLookupKey(d.code) === cleanDist ||
            normalizeLookupKey(d.eporchaSlug) === cleanDist ||
            normalizeLookupKey(d.nameEn) === cleanDist
        );
        if (matchDist) {
          distCode = matchDist.code;
          break;
        }
      }

      if (!distCode && /^\d{1,3}$/.test(cleanDistRaw)) {
        distCode = cleanDistRaw.padStart(2, '0');
      }

      // If caller passed a specific districtId that does not resolve, refuse to guess cross-district
      if (!distCode) {
        return null;
      }

      const paddedDist = String(distCode).padStart(2, '0');
      const distMatches = upzList.filter(
        (u) => String(u.DISTRICT_BBS_CODE).trim().padStart(2, '0') === paddedDist
      );

      const exactWithinDist = distMatches.find(
        (u) =>
          normalizeLookupKey(u.NAME_EN) === cleanUpz ||
          String(u.BBS_CODE).trim() === cleanUpzRaw
      );
      return exactWithinDist || null;
    }

    // Unscoped lookup (districtId omitted): match ONLY exact unique name across districts
    const exactMatches = upzList.filter(
      (u) => normalizeLookupKey(u.NAME_EN) === cleanUpz
    );
    if (exactMatches.length === 1) {
      return exactMatches[0];
    }
    return null;
  }

  private resolveDivisionBbsCode(divisionId: string): string | null {
    const authDiv = this.findAuthoritativeDivision(divisionId);
    if (authDiv && authDiv.districts.length > 0) {
      const sampleDistCode = String(authDiv.districts[0].code).trim().padStart(2, '0');
      const upzMatch = (bangladeshUpazilas as UpazilaBbsRecord[]).find(
        (u) => String(u.DISTRICT_BBS_CODE).trim().padStart(2, '0') === sampleDistCode
      );
      if (upzMatch?.DIVISION_BBS_CODE) {
        return String(upzMatch.DIVISION_BBS_CODE).trim().padStart(2, '0');
      }
    }
    const clean = divisionId.replace(/^div-/, '').trim();
    return /^\d{1,2}$/.test(clean) ? clean.padStart(2, '0') : null;
  }

  async discoverDistricts(divisionId: string): Promise<DistrictNode[]> {
    const divBbsCode = this.resolveDivisionBbsCode(divisionId);
    const url = divBbsCode
      ? `${this.baseUrl}/dlrms/districts?DIVISION_BBS_CODE=${encodeURIComponent(divBbsCode)}`
      : `${this.baseUrl}/get-districts?division_id=${encodeURIComponent(divisionId)}`;
    try {
      const raw = await this.fetchPortalJson(url);
      const rawList = Array.isArray(raw)
        ? raw
        : Array.isArray((raw as { data?: unknown })?.data)
        ? ((raw as { data: unknown[] }).data)
        : [];
      if (rawList.length > 0) {
        const seenIds = new Set<string>();
        const districts: DistrictNode[] = [];
        for (const item of rawList as Record<string, unknown>[]) {
          const rawCode = String(item.BBS_CODE ?? item.code ?? item.id ?? '').trim();
          const baseId = String(item.id ?? item.BBS_CODE ?? '').trim();
          if (!baseId && !rawCode) continue;
          const id = baseId.startsWith('dist-') ? baseId : `dist-${baseId || rawCode}`;
          if (seenIds.has(id)) continue;
          seenIds.add(id);
          const nameEn = formatPortalNameEn(
            String(item.NAME_EN ?? item.name_en ?? item.name ?? 'Unknown District')
          );
          const nameBn = String(item.NAME ?? item.name_bn ?? item.name_bd ?? item.name ?? '').trim();
          if (!nameEn) continue;
          districts.push({
            id,
            code: rawCode || id.replace(/^dist-/, ''),
            nameEn,
            nameBn: nameBn || nameEn,
            eporchaSlug: nameEn.toLowerCase().replace(/\s+/g, '-'),
            upazilas: [],
          });
        }

        for (const d of districts) {
          try {
            void Promise.resolve(geoDb.saveDistrict(d, divisionId)).catch(() => {});
          } catch {
            // Ignore Firestore write error if offline/unauthenticated
          }
        }
        if (districts.length > 0) return districts;
      }
    } catch (error) {
      console.error('District Discovery Error:', error);
    }

    const fallbackDiv = this.findAuthoritativeDivision(divisionId);
    if (fallbackDiv && fallbackDiv.districts.length > 0) {
      return [...fallbackDiv.districts];
    }

    return [];
  }

  /**
   * Discovers ALL Upazilas for the selected District directly from eporcha.tech URL
   */
  async discoverUpazilas(districtId: string): Promise<UpazilaNode[]> {
    const summary = await this.queryUpazilasFromPortalUrl(districtId);
    return summary.upazilas;
  }

  /**
   * Queries `https://eporcha.tech/api/dlrms/upazilas?DISTRICT_BBS_CODE=...`
   * to fetch all Upazilas for the selected District, counts how many were found, and returns the full list
   * with honest provenance (`LIVE_SOURCE` vs `LOCAL_DATASET` vs `FAILED` / `NOT_FOUND`).
   */
  async queryUpazilasFromPortalUrl(
    districtId: string
  ): Promise<DiscoveredUpazilaSummary> {
    const cleanId = districtId.replace(/^dist-/, '');
    const authDist = this.findAuthoritativeDistrict(districtId);
    const distCode = authDist?.code || (/^\d+$/.test(cleanId) ? cleanId : null);
    const retrievedAt = new Date().toISOString();

    const targetPortalUrl = distCode
      ? `${this.baseUrl}/dlrms/upazilas?DISTRICT_BBS_CODE=${encodeURIComponent(distCode)}`
      : `${this.baseUrl}/get-upazilas?district_id=${encodeURIComponent(cleanId)}`;

    let lastError: string | undefined;

    try {
      const json = await this.fetchPortalJson(targetPortalUrl);
      let rawList: Record<string, unknown>[] = Array.isArray(json)
        ? (json as Record<string, unknown>[])
        : Array.isArray((json as { data?: unknown })?.data)
        ? ((json as { data: Record<string, unknown>[] }).data)
        : [];

      // Enforce strict parent District BBS code match if upstream returns DISTRICT_BBS_CODE
      if (distCode && rawList.length > 0 && rawList[0]?.DISTRICT_BBS_CODE !== undefined) {
        const paddedDist = String(distCode).padStart(2, '0');
        rawList = rawList.filter(
          (u) => String(u.DISTRICT_BBS_CODE).trim().padStart(2, '0') === paddedDist
        );
      }

      if (rawList.length > 0) {
        const upazilas: UpazilaNode[] = [];
        const seenIds = new Set<string>();
        const seenSourceKeys = new Set<string>();

        for (const u of rawList) {
          const rawNameEn = u.NAME_EN ?? u.name_en ?? u.name;
          const rawNameBn = u.NAME ?? u.name_bn ?? u.name_bd ?? rawNameEn;
          if (!rawNameEn && !rawNameBn) continue;

          const formattedEn = formatPortalNameEn(String(rawNameEn || rawNameBn));
          const upzSlug = formattedEn
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

          const isNabinagar =
            (upzSlug === 'nabinagar' && (!distCode || String(distCode).padStart(2, '0') === '12')) ||
            (String(u.DISTRICT_BBS_CODE) === '12' && String(u.BBS_CODE) === '85');

          let id = isNabinagar
            ? 'upz-nabinagar'
            : u.id && String(u.id).startsWith('upz-')
            ? String(u.id)
            : upzSlug
            ? `upz-${upzSlug}`
            : `upz-${u.BBS_CODE || u.ID || u.id}`;

          const sourceKey =
            u.BBS_CODE !== undefined
              ? `bbs:${String(u.DISTRICT_BBS_CODE || distCode || '').trim()}:${String(u.BBS_CODE).trim()}`
              : u.ID !== undefined
              ? `rawid:${String(u.ID)}`
              : `slug:${id}`;

          if (seenSourceKeys.has(sourceKey)) {
            continue;
          }
          seenSourceKeys.add(sourceKey);

          if (seenIds.has(id)) {
            id = `${id}-${u.BBS_CODE || u.ID || upazilas.length + 1}`;
          }
          seenIds.add(id);

          upazilas.push({
            id,
            nameEn: isNabinagar ? 'Nabinagar' : formattedEn,
            nameBn: isNabinagar ? 'নবীনগর' : String(rawNameBn).trim(),
            eporchaSlug: isNabinagar ? 'nabinagar' : upzSlug,
            mouzas: isNabinagar ? [...NABINAGAR_176_MOUZAS] : [],
          });
        }

        if (upazilas.length > 0) {
          for (const u of upazilas) {
            try {
              void Promise.resolve(geoDb.saveUpazila(u, districtId)).catch(() => {});
            } catch {
              // Ignore Firestore write error
            }
          }

          return {
            districtId,
            districtNameEn: authDist?.nameEn || cleanId,
            districtNameBn: authDist?.nameBn || cleanId,
            totalFound: upazilas.length,
            portalUrl: targetPortalUrl,
            upazilas,
            sourceStatus: 'LIVE_SOURCE',
            isLive: true,
            retrievedAt,
          };
        }
      }
      lastError = `Portal returned 0 Upazilas for district ${authDist?.nameEn || cleanId}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      console.warn('Primary Upazila URL discovery error:', error);
    }

    if (authDist && authDist.upazilas.length > 0) {
      return {
        districtId,
        districtNameEn: authDist.nameEn,
        districtNameBn: authDist.nameBn,
        totalFound: authDist.upazilas.length,
        portalUrl: targetPortalUrl,
        upazilas: [...authDist.upazilas],
        sourceStatus: 'LOCAL_DATASET',
        isLive: false,
        retrievedAt,
        errorMessage: lastError,
      };
    }

    return {
      districtId,
      districtNameEn: authDist?.nameEn || cleanId,
      districtNameBn: authDist?.nameBn || cleanId,
      totalFound: 0,
      portalUrl: targetPortalUrl,
      upazilas: [],
      sourceStatus: lastError ? 'FAILED' : 'NOT_FOUND',
      isLive: false,
      retrievedAt,
      errorMessage: lastError || `No Upazilas found for ${cleanId}`,
    };
  }

  /**
   * Discovers ALL Mouzas for the chosen Upazila directly from eporcha.tech portal URL.
   */
  async discoverMouzas(
    upazilaId: string,
    districtId?: string | null
  ): Promise<MouzaNode[]> {
    const summary = await this.queryMouzasFromPortalUrl(upazilaId, districtId);
    return summary.mouzas;
  }

  /**
   * Queries eporcha.tech for all Mouzas of an Upazila and tracks honest source provenance.
   */
  async queryMouzasFromPortalUrl(
    upazilaId: string,
    districtId?: string | null
  ): Promise<DiscoveredMouzaSummary> {
    const cleanId = upazilaId.replace(/^upz-/, '');
    const retrievedAt = new Date().toISOString();
    const bbsMatch = this.findUpazilaBbs(upazilaId, districtId);

    if (
      districtId &&
      districtId.trim() !== '' &&
      !bbsMatch &&
      !this.findAuthoritativeUpazila(upazilaId, districtId)
    ) {
      return {
        upazilaId,
        upazilaNameEn: cleanId,
        upazilaNameBn: cleanId,
        totalFound: 0,
        portalUrl: '',
        mouzas: [],
        sourceStatus: 'NOT_FOUND',
        isLive: false,
        retrievedAt,
        errorMessage: `Upazila '${upazilaId}' does not match parent district '${districtId}'.`,
      };
    }

    const targetPortalUrl = bbsMatch
      ? `${this.baseUrl}/dlrms/mouzas/jl-numbers?DISTRICT_BBS_CODE=${bbsMatch.DISTRICT_BBS_CODE}&UPAZILA_BBS_CODE=${bbsMatch.BBS_CODE}`
      : `${this.baseUrl}/get-mouzas?upazila_id=${encodeURIComponent(cleanId)}`;

    let lastError: string | undefined;

    try {
      const json = await this.fetchPortalJson(targetPortalUrl);
      const rawList: Record<string, unknown>[] = Array.isArray(json)
        ? (json as Record<string, unknown>[])
        : Array.isArray((json as { data?: unknown })?.data)
        ? ((json as { data: Record<string, unknown>[] }).data)
        : [];

      if (rawList.length > 0) {
        const mouzas: MouzaNode[] = [];
        const seenJlNos = new Set<string>();

        for (const item of rawList) {
          const rawJl = item.JL_NUMBER ?? item.jl_no ?? item.jlNo;
          const rawNameBn =
            item.MOUZA_NAME ?? item.name_bn ?? item.nameBn ?? item.name;
          const rawNameEn =
            item.MOUZA_NAME_EN ??
            item.name_en ??
            item.nameEn ??
            item.SURVEY_NAME_EN ??
            (rawNameBn ? String(rawNameBn) : `Mouza ${rawJl}`);

          if (!rawJl || (!rawNameBn && !rawNameEn)) {
            try {
              void Promise.resolve(
                geoDb.logRejection(
                  item,
                  'Missing mandatory identifiers (JL No or Name)',
                  'eporcha.tech'
                )
              ).catch(() => {});
            } catch {
              // Ignore logging errors
            }
            continue;
          }

          const jlNo = String(rawJl).trim();
          const id = `mz-${cleanId}-${jlNo}`;

          if (seenJlNos.has(jlNo)) {
            try {
              void Promise.resolve(
                geoDb.logRejection(
                  item,
                  `Duplicate Mouza JL record (${jlNo}) skipped`,
                  'eporcha.tech'
                )
              ).catch(() => {});
            } catch {
              // Ignore logging errors
            }
            continue;
          }

          seenJlNos.add(jlNo);
          mouzas.push({
            id,
            jlNo,
            nameEn: String(rawNameEn).trim(),
            nameBn: String(rawNameBn || rawNameEn).trim(),
            unionNameEn: String(
              item.union_en ||
                item.unionNameEn ||
                (bbsMatch ? `${bbsMatch.NAME_EN} Area` : 'Discovered Union')
            ),
            unionNameBn: String(
              item.union_bn ||
                item.unionNameBn ||
                (bbsMatch ? `${bbsMatch.NAME} এলাকা` : 'ডিসকভার্ড এলাকা')
            ),
            availableSurveys: [
              'CS',
              'SA',
              'RS',
              'BS',
              'MUTATION',
            ] as SurveyType[],
            estimatedKhatians: Number(item.khatian_count) || 450,
            estimatedDags: Number(item.dag_count) || 1150,
            mapSheets: [1],
          });
        }

        if (mouzas.length > 0) {
          try {
            void Promise.resolve(geoDb.saveMouzas(mouzas, upazilaId)).catch(() => {});
          } catch {
            // Ignore Firestore write error
          }

          return {
            upazilaId,
            upazilaNameEn: bbsMatch?.NAME_EN || cleanId,
            upazilaNameBn: bbsMatch?.NAME || cleanId,
            totalFound: mouzas.length,
            portalUrl: targetPortalUrl,
            mouzas,
            sourceStatus: 'LIVE_SOURCE',
            isLive: true,
            retrievedAt,
          };
        }
      }
      lastError = `Portal returned 0 valid Mouzas for ${bbsMatch?.NAME_EN || cleanId}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      console.warn('Primary eporcha.tech URL query failed:', error);
    }

    // Explicit local dataset fallback ONLY for matching authoritative upazilas (strict parent check)
    const authUpz = this.findAuthoritativeUpazila(upazilaId, districtId);
    if (authUpz && authUpz.mouzas.length > 0) {
      return {
        upazilaId: authUpz.id,
        upazilaNameEn: authUpz.nameEn,
        upazilaNameBn: authUpz.nameBn,
        totalFound: authUpz.mouzas.length,
        portalUrl: targetPortalUrl,
        mouzas: [...authUpz.mouzas],
        sourceStatus: 'LOCAL_DATASET',
        isLive: false,
        retrievedAt,
        errorMessage: lastError,
      };
    }

    return {
      upazilaId,
      upazilaNameEn: bbsMatch?.NAME_EN || cleanId,
      upazilaNameBn: bbsMatch?.NAME || cleanId,
      totalFound: 0,
      portalUrl: targetPortalUrl,
      mouzas: [],
      sourceStatus: lastError ? 'FAILED' : 'NOT_FOUND',
      isLive: false,
      retrievedAt,
      errorMessage: lastError || `No Mouzas found for ${cleanId}`,
    };
  }
}

export const geoDiscovery = new GeoDiscoveryService();

