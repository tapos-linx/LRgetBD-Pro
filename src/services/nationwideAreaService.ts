import { DivisionNode, DistrictNode, UpazilaNode, MouzaNode, GeoSourceStatus } from '../types/land';
import { GEO_HIERARCHY } from '../data/geoHierarchy';

export interface UpazilaFetchResult {
  division: DivisionNode;
  district: DistrictNode;
  upazila: UpazilaNode;
  mouzas: MouzaNode[];
  totalMouzasCount: number;
  sourceStatus: GeoSourceStatus;
}

/**
 * Local dataset lookup helper for embedded Mouza records.
 * Explicitly fails if division, district, or upazila ID does not exist rather than silently falling back.
 */
export async function fetchNationwideMouzas(
  divisionId: string,
  districtId: string,
  upazilaId: string,
  customMouzas: MouzaNode[] = []
): Promise<UpazilaFetchResult> {
  const division = GEO_HIERARCHY.find((d) => d.id === divisionId);
  if (!division) {
    throw new Error(`Division not found in local dataset: ${divisionId}`);
  }

  const district = division.districts.find((dist) => dist.id === districtId);
  if (!district) {
    throw new Error(`District ${districtId} does not belong to Division ${division.nameEn}`);
  }

  const upazila = district.upazilas.find((u) => u.id === upazilaId);
  if (!upazila) {
    throw new Error(`Upazila ${upazilaId} does not belong to District ${district.nameEn}`);
  }

  const existingIds = new Set(upazila.mouzas.map((m) => m.id));
  const allMouzas = [
    ...upazila.mouzas,
    ...customMouzas.filter((cm) => !existingIds.has(cm.id)),
  ];

  return {
    division,
    district,
    upazila,
    mouzas: allMouzas,
    totalMouzasCount: allMouzas.length,
    sourceStatus: 'LOCAL_DATASET',
  };
}

/**
 * Nationwide Statistics Helper
 */
export function getNationwideStats() {
  let districtCount = 0;
  let upazilaCount = 0;
  let mouzaCount = 0;

  for (const div of GEO_HIERARCHY) {
    districtCount += div.districts.length;
    for (const dist of div.districts) {
      upazilaCount += dist.upazilas.length;
      for (const upz of dist.upazilas) {
        mouzaCount += upz.mouzas.length;
      }
    }
  }

  return {
    totalDivisions: GEO_HIERARCHY.length,
    totalDistricts: districtCount,
    totalUpazilas: upazilaCount,
    totalMouzas: mouzaCount,
  };
}
