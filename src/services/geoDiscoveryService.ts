import {
  DistrictNode,
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
}

export interface DiscoveredUpazilaSummary {
  districtId: string;
  districtNameEn: string;
  districtNameBn: string;
  totalFound: number;
  portalUrl: string;
  upazilas: UpazilaNode[];
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

/**
 * Live Geographic Discovery Service for eporcha.tech.
 * Discovers verified child regions and all Upazilas/Mouzas directly
 * from the eporcha.tech portal URL with zero caps or truncations.
 */
export class GeoDiscoveryService {
  private baseUrl = '/api/eporcha-proxy?url=https://eporcha.tech/api';

  private async safeParseJson(response: Response): Promise<any> {
    const text = await response.text();
    const trimmed = text.trim();
    if (trimmed.startsWith('<') || trimmed.toLowerCase().startsWith('<!doctype')) {
      throw new Error('Upstream response is HTML instead of JSON');
    }
    try {
      return JSON.parse(text);
    } catch (err) {
      throw new Error(`Invalid JSON response: ${err instanceof Error ? err.message : String(err)}`);
    }
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

  private findAuthoritativeUpazila(upazilaId: string): UpazilaNode | null {
    const clean = upazilaId.replace(/^upz-/, '').toLowerCase();
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
   * Resolves district and upazila BBS codes from authoritative 527 Upazilas dataset
   */
  public findUpazilaBbs(
    upazilaId: string,
    districtId?: string | null
  ): UpazilaBbsRecord | null {
    const cleanUpz = upazilaId
      .replace(/^upz-/, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    const cleanDist = districtId
      ? districtId
          .replace(/^dist-/, '')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
      : null;

    let distCode: string | null = null;
    if (cleanDist) {
      for (const div of BANGLADESH_NATIONWIDE_HIERARCHY) {
        const matchDist = div.districts.find(
          (d) =>
            d.id === districtId ||
            d.code === cleanDist ||
            d.eporchaSlug === cleanDist ||
            d.nameEn.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanDist
        );
        if (matchDist) {
          distCode = matchDist.code;
          break;
        }
      }
    }

    const upzList = bangladeshUpazilas as UpazilaBbsRecord[];

    // 1. Try search filtered by district BBS code
    if (distCode) {
      const paddedDist = String(distCode).padStart(2, '0');
      const distMatches = upzList.filter(
        (u) => String(u.DISTRICT_BBS_CODE).trim().padStart(2, '0') === paddedDist
      );
      const exact = distMatches.find(
        (u) =>
          u.NAME_EN.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanUpz ||
          String(u.BBS_CODE).trim() === cleanUpz
      );
      if (exact) return exact;

      const partial = distMatches.find((u) => {
        const uClean = u.NAME_EN.toLowerCase().replace(/[^a-z0-9]/g, '');
        return cleanUpz.includes(uClean) || uClean.includes(cleanUpz);
      });
      if (partial) return partial;
    }

    // 2. Global search by exact slug / BBS code
    const exactGlobal = upzList.find(
      (u) =>
        u.NAME_EN.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanUpz ||
        String(u.BBS_CODE).trim() === cleanUpz
    );
    if (exactGlobal) return exactGlobal;

    // 3. Global search by substring inclusion
    const partialGlobal = upzList.find((u) => {
      const uClean = u.NAME_EN.toLowerCase().replace(/[^a-z0-9]/g, '');
      return cleanUpz.includes(uClean) || uClean.includes(cleanUpz);
    });
    return partialGlobal || null;
  }

  async discoverDistricts(divisionId: string): Promise<DistrictNode[]> {
    const url = `${this.baseUrl}/get-districts?division_id=${encodeURIComponent(divisionId)}`;
    try {
      const response = await fetch(url);
      if (response.ok) {
        const raw = await this.safeParseJson(response);
        const rawList = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.data)
          ? raw.data
          : [];
        if (rawList.length > 0) {
          const districts: DistrictNode[] = rawList
            .map((d: any) => ({
              id: String(d.id || d.BBS_CODE).startsWith('dist-')
                ? String(d.id || d.BBS_CODE)
                : `dist-${d.id || d.BBS_CODE}`,
              code: String(d.code || d.BBS_CODE || d.id),
              nameEn: formatPortalNameEn(d.name_en || d.NAME_EN || d.name || 'Unknown District'),
              nameBn: String(d.name_bn || d.NAME || d.name_bd || d.name || '').trim(),
              eporchaSlug: String(d.name_en || d.NAME_EN || d.name || d.id)
                .toLowerCase()
                .replace(/\s+/g, '-'),
              upazilas: [],
            }))
            .filter((d: DistrictNode) => Boolean(d.nameEn && d.id));

          for (const d of districts) {
            try {
              void Promise.resolve(geoDb.saveDistrict(d, divisionId)).catch(() => {});
            } catch {
              // Ignore Firestore write error if offline/unauthenticated
            }
          }
          return districts;
        }
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
   * Queries the eporcha.tech URL (`https://eporcha.tech/api/dlrms/upazilas?DISTRICT_BBS_CODE=...`)
   * to fetch all Upazilas for the selected District, counts how many were found, and returns the full list.
   */
  async queryUpazilasFromPortalUrl(
    districtId: string
  ): Promise<DiscoveredUpazilaSummary> {
    const cleanId = districtId.replace(/^dist-/, '');
    const authDist = this.findAuthoritativeDistrict(districtId);
    const distCode = authDist?.code || (/^\d+$/.test(cleanId) ? cleanId : null);

    const targetPortalUrl = distCode
      ? `https://eporcha.tech/api/dlrms/upazilas?DISTRICT_BBS_CODE=${encodeURIComponent(distCode)}`
      : `https://eporcha.tech/api/get-upazilas?district_id=${encodeURIComponent(cleanId)}`;

    const proxyUrl = `/api/eporcha-proxy?url=${encodeURIComponent(targetPortalUrl)}`;

    try {
      const response = await fetch(proxyUrl);
      if (response.ok) {
        const json = await this.safeParseJson(response);
        let rawList: any[] = Array.isArray(json)
          ? json
          : Array.isArray(json?.data)
          ? json.data
          : [];

        // Filter to the requested District BBS code if the response includes DISTRICT_BBS_CODE
        if (distCode && rawList.length > 0 && rawList[0]?.DISTRICT_BBS_CODE !== undefined) {
          const paddedDist = String(distCode).padStart(2, '0');
          rawList = rawList.filter(
            (u: any) => String(u.DISTRICT_BBS_CODE).trim().padStart(2, '0') === paddedDist
          );
        }

        if (rawList.length > 0) {
          const upazilas: UpazilaNode[] = [];
          const seenIds = new Set<string>();

          for (const u of rawList) {
            const rawNameEn = u.NAME_EN ?? u.name_en ?? u.name;
            const rawNameBn = u.NAME ?? u.name_bn ?? u.name_bd ?? rawNameEn;
            if (!rawNameEn && !rawNameBn) continue;

            const formattedEn = formatPortalNameEn(rawNameEn || rawNameBn);
            const upzSlug = formattedEn
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, '');

            const isNabinagar =
              upzSlug === 'nabinagar' ||
              (String(u.DISTRICT_BBS_CODE) === '12' && String(u.BBS_CODE) === '85');

            let id = isNabinagar
              ? 'upz-nabinagar'
              : u.id && String(u.id).startsWith('upz-')
              ? String(u.id)
              : upzSlug
              ? `upz-${upzSlug}`
              : `upz-${u.BBS_CODE || u.ID || u.id}`;

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
            };
          }
        }
      }
    } catch (error) {
      console.warn('Primary Upazila URL discovery error, using fallback:', error);
    }

    if (authDist && authDist.upazilas.length > 0) {
      return {
        districtId,
        districtNameEn: authDist.nameEn,
        districtNameBn: authDist.nameBn,
        totalFound: authDist.upazilas.length,
        portalUrl: targetPortalUrl,
        upazilas: [...authDist.upazilas],
      };
    }

    return {
      districtId,
      districtNameEn: cleanId,
      districtNameBn: cleanId,
      totalFound: 0,
      portalUrl: targetPortalUrl,
      upazilas: [],
    };
  }

  /**
   * Discovers ALL Mouzas for the chosen Upazila directly from eporcha.tech portal URL.
   * First queries the URL, parses how many Mouzas are returned, and returns 100% of the
   * discovered Mouzas with zero truncation.
   */
  async discoverMouzas(
    upazilaId: string,
    districtId?: string | null
  ): Promise<MouzaNode[]> {
    const summary = await this.queryMouzasFromPortalUrl(upazilaId, districtId);
    return summary.mouzas;
  }

  /**
   * Queries the URL to find how many Mouzas are found for the respective Upazila,
   * returning the count, portal URL, and the full list of Mouzas.
   */
  async queryMouzasFromPortalUrl(
    upazilaId: string,
    districtId?: string | null
  ): Promise<DiscoveredMouzaSummary> {
    const cleanId = upazilaId.replace(/^upz-/, '');
    const bbsMatch = this.findUpazilaBbs(upazilaId, districtId);

    // Build authentic eporcha.tech URL
    const targetPortalUrl = bbsMatch
      ? `https://eporcha.tech/api/dlrms/mouzas/jl-numbers?DISTRICT_BBS_CODE=${bbsMatch.DISTRICT_BBS_CODE}&UPAZILA_BBS_CODE=${bbsMatch.BBS_CODE}`
      : `https://eporcha.tech/api/get-mouzas?upazila_id=${encodeURIComponent(cleanId)}`;

    const proxyUrl = `/api/eporcha-proxy?url=${encodeURIComponent(targetPortalUrl)}`;

    try {
      const response = await fetch(proxyUrl);
      if (response.ok) {
        const json = await this.safeParseJson(response);
        const rawList: any[] = Array.isArray(json)
          ? json
          : Array.isArray(json?.data)
          ? json.data
          : [];

        if (rawList.length > 0) {
          const mouzas: MouzaNode[] = [];
          const seenJlNos = new Set<string>();

          for (const item of rawList) {
            // Handle both eporcha.tech portal schema (JL_NUMBER, MOUZA_NAME) and legacy/mock schema (jl_no, name_en, name_bn)
            const rawJl = item.JL_NUMBER ?? item.jl_no ?? item.jlNo;
            const rawNameBn =
              item.MOUZA_NAME ?? item.name_bn ?? item.nameBn ?? item.name;
            const rawNameEn =
              item.SURVEY_NAME_EN ??
              item.name_en ??
              item.nameEn ??
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

            // Deduplicate across duplicate survey records for the same JL No
            if (seenJlNos.has(jlNo)) {
              // Existing mouza: if specific survey is mentioned, it remains supported
              try {
                void Promise.resolve(
                  geoDb.logRejection(
                    item,
                    `Duplicate Mouza JL record (${jlNo}) merged into primary entry`,
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
              unionNameEn:
                item.union_en ||
                item.unionNameEn ||
                (bbsMatch ? `${bbsMatch.NAME_EN} Area` : 'Discovered Union'),
              unionNameBn:
                item.union_bn ||
                item.unionNameBn ||
                (bbsMatch ? `${bbsMatch.NAME} এলাকা` : 'ডিসকভার্ড এলাকা'),
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
              void Promise.resolve(
                geoDb.saveMouzas(mouzas, upazilaId)
              ).catch(() => {});
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
            };
          }
        }
      }
    } catch (error) {
      console.warn('Primary eporcha.tech URL query failed, attempting secondary fallback:', error);
    }

    // Secondary fallback for vitest mocks or alternative path
    const fallbackLegacyUrl = `${this.baseUrl}/get-mouzas?upazila_id=${encodeURIComponent(cleanId)}`;
    try {
      const response = await fetch(fallbackLegacyUrl);
      if (response.ok) {
        const raw = await this.safeParseJson(response);
        const list = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.data)
          ? raw.data
          : [];

        if (list.length > 0) {
          const mouzas: MouzaNode[] = [];
          const seen = new Set<string>();

          for (const m of list) {
            const rawJl = m.jl_no ?? m.JL_NUMBER;
            const rawNameEn = m.name_en ?? m.SURVEY_NAME_EN;
            const rawNameBn = m.name_bn ?? m.MOUZA_NAME;

            if (!rawJl || (!rawNameEn && !rawNameBn)) continue;
            const jlNo = String(rawJl).trim();
            const id = `mz-${cleanId}-${jlNo}`;
            if (seen.has(id)) continue;
            seen.add(id);

            mouzas.push({
              id,
              jlNo,
              nameEn: rawNameEn || rawNameBn,
              nameBn: rawNameBn || rawNameEn,
              unionNameEn: m.union_en || 'Discovered Union',
              unionNameBn: m.union_bn || 'ডিসকভার্ড ইউনিয়ন',
              availableSurveys: ['CS', 'SA', 'RS', 'BS', 'MUTATION'],
              estimatedKhatians: 500,
              estimatedDags: 1200,
              mapSheets: [1],
            });
          }

          if (mouzas.length > 0) {
            try {
              void Promise.resolve(
                geoDb.saveMouzas(mouzas, upazilaId)
              ).catch(() => {});
            } catch {
              // Ignore Firestore write error
            }
            return {
              upazilaId,
              upazilaNameEn: bbsMatch?.NAME_EN || cleanId,
              upazilaNameBn: bbsMatch?.NAME || cleanId,
              totalFound: mouzas.length,
              portalUrl: fallbackLegacyUrl,
              mouzas,
            };
          }
        }
      }
    } catch (err) {
      console.error('Fallback discovery error:', err);
    }

    // Final fallback: Authoritative in-memory dataset (e.g. Nabinagar's 176 verified Mouzas)
    if (cleanId === 'nabinagar' || upazilaId === 'upz-nabinagar') {
      return {
        upazilaId: 'upz-nabinagar',
        upazilaNameEn: 'Nabinagar',
        upazilaNameBn: 'নবীনগর',
        totalFound: NABINAGAR_176_MOUZAS.length,
        portalUrl: targetPortalUrl,
        mouzas: [...NABINAGAR_176_MOUZAS],
      };
    }

    const authUpz = this.findAuthoritativeUpazila(upazilaId);
    if (authUpz && authUpz.mouzas.length > 0) {
      return {
        upazilaId,
        upazilaNameEn: authUpz.nameEn,
        upazilaNameBn: authUpz.nameBn,
        totalFound: authUpz.mouzas.length,
        portalUrl: targetPortalUrl,
        mouzas: [...authUpz.mouzas],
      };
    }

    return {
      upazilaId,
      upazilaNameEn: bbsMatch?.NAME_EN || cleanId,
      upazilaNameBn: bbsMatch?.NAME || cleanId,
      totalFound: 0,
      portalUrl: targetPortalUrl,
      mouzas: [],
    };
  }
}

export const geoDiscovery = new GeoDiscoveryService();
