import { DivisionNode, DistrictNode, UpazilaNode, MouzaNode, QueueTask } from '../types/land';
import { GEO_HIERARCHY } from '../data/geoHierarchy';

export interface UpazilaFetchResult {
  division: DivisionNode;
  district: DistrictNode;
  upazila: UpazilaNode;
  mouzas: MouzaNode[];
  totalMouzasCount: number;
}

/**
 * Mock API & data fetching function for nationwide Mouzas.
 * Fetches all Mouzas for any division -> district -> upazila in Bangladesh.
 */
export async function fetchNationwideMouzas(
  divisionId: string,
  districtId: string,
  upazilaId: string,
  customMouzas: MouzaNode[] = []
): Promise<UpazilaFetchResult> {
  // Simulate rapid realistic async network resolution (< 60ms)
  await new Promise((resolve) => setTimeout(resolve, 30));

  const division =
    GEO_HIERARCHY.find((d) => d.id === divisionId) || GEO_HIERARCHY[0];
  const district =
    division.districts.find((dist) => dist.id === districtId) ||
    division.districts[0];
  const upazila =
    district.upazilas.find((u) => u.id === upazilaId) || district.upazilas[0];

  const allMouzas = [...upazila.mouzas, ...customMouzas];

  return {
    division,
    district,
    upazila,
    mouzas: allMouzas,
    totalMouzasCount: allMouzas.length,
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
