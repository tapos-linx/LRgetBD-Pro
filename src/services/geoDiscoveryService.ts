import { 
  DistrictNode, 
  UpazilaNode, 
  MouzaNode, 
  SurveyType 
} from '../types/land';
import { geoDb } from './geographicDbService';

/**
 * Live Geographic Discovery Service for eporcha.tech.
 * Implements Phase 4 & 5 requirements: Fetching verified child regions
 * and live Mouza discovery.
 */
export class GeoDiscoveryService {
  private baseUrl = '/api/eporcha-proxy?url=https://eporcha.tech/api';

  async discoverDistricts(divisionId: string): Promise<DistrictNode[]> {
    const url = `${this.baseUrl}/get-districts?division_id=${divisionId}`;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Discovery failed: ${response.status}`);
      const raw = await response.json();
      
      // Strict mapping & validation (Phase 5)
      const districts: DistrictNode[] = raw.map((d: any) => ({
        id: `dist-${d.id}`,
        code: String(d.code || d.id),
        nameEn: d.name_en || d.name || 'Unknown District',
        nameBn: d.name_bn || d.name_bd || d.name,
        eporchaSlug: (d.name_en || d.name).toLowerCase().replace(/\s+/g, '-'),
        upazilas: []
      })).filter((d: DistrictNode) => d.nameEn && d.id);

      // Persist to Normalized DB
      for (const d of districts) {
        await geoDb.saveDistrict(d, divisionId);
      }
      return districts;
    } catch (error) {
      console.error('District Discovery Error:', error);
      return [];
    }
  }

  async discoverUpazilas(districtId: string): Promise<UpazilaNode[]> {
    const cleanId = districtId.replace('dist-', '');
    const url = `${this.baseUrl}/get-upazilas?district_id=${cleanId}`;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Discovery failed: ${response.status}`);
      const raw = await response.json();
      
      const upazilas: UpazilaNode[] = raw.map((u: any) => ({
        id: `upz-${u.id}`,
        nameEn: u.name_en || u.name || 'Unknown Upazila',
        nameBn: u.name_bn || u.name_bd || u.name,
        eporchaSlug: (u.name_en || u.name).toLowerCase().replace(/\s+/g, '-'),
        mouzas: []
      })).filter((u: UpazilaNode) => u.nameEn && u.id);

      for (const u of upazilas) {
        await geoDb.saveUpazila(u, districtId);
      }
      return upazilas;
    } catch (error) {
      console.error('Upazila Discovery Error:', error);
      return [];
    }
  }

  async discoverMouzas(upazilaId: string): Promise<MouzaNode[]> {
    const cleanId = upazilaId.replace('upz-', '');
    const url = `${this.baseUrl}/get-mouzas?upazila_id=${cleanId}`;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Discovery failed: ${response.status}`);
      const raw = await response.json();
      
      // Strict Null & Duplicate Handling (Phase 5)
      const mouzas: MouzaNode[] = [];
      const seenIds = new Set<string>();

      for (const m of raw) {
        if (!m.jl_no || (!m.name_en && !m.name_bn)) {
          await geoDb.logRejection(m, 'Missing mandatory identifiers (JL No or Name)', 'eporcha.tech');
          continue;
        }

        const id = `mz-${upazilaId}-${m.jl_no}-${(m.name_en || '').toLowerCase().replace(/[^a-z0-9]/g, '')}`;
        if (seenIds.has(id)) {
          await geoDb.logRejection(m, 'Duplicate Mouza record detected', 'eporcha.tech');
          continue;
        }

        mouzas.push({
          id,
          jlNo: String(m.jl_no),
          nameEn: m.name_en || m.name_bn,
          nameBn: m.name_bn || m.name_en,
          unionNameEn: m.union_en || 'Discovered Union',
          unionNameBn: m.union_bn || 'ডিসকভার্ড ইউনিয়ন',
          availableSurveys: ['CS', 'SA', 'RS', 'BS', 'MUTATION'] as SurveyType[],
          estimatedKhatians: Number(m.khatian_count) || 500,
          estimatedDags: Number(m.dag_count) || 1200,
          mapSheets: [1]
        });
        seenIds.add(id);
      }

      if (mouzas.length > 0) {
        await geoDb.saveMouzas(mouzas, upazilaId);
      }
      return mouzas;
    } catch (error) {
      console.error('Mouza Discovery Error:', error);
      return [];
    }
  }
}

export const geoDiscovery = new GeoDiscoveryService();
