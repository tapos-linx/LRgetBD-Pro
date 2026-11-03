import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
  where, 
  Timestamp 
} from 'firebase/firestore';
import { 
  DivisionNode, 
  DistrictNode, 
  UpazilaNode, 
  MouzaNode 
} from '../types/land';

/**
 * Normalized Geographic Database Service.
 * Implements Phase 6 requirements: Stable official identifiers, unique constraints,
 * data provenance, and quality logging.
 */
export class GeographicDbService {
  private db = getFirestore();

  async saveDivision(div: DivisionNode, source: string = 'eporcha.tech') {
    const ref = doc(this.db, 'divisions', div.id);
    await setDoc(ref, {
      ...div,
      source,
      lastVerifiedAt: Timestamp.now(),
      status: 'VERIFIED'
    }, { merge: true });
  }

  async saveDistrict(dist: DistrictNode, divisionId: string, source: string = 'eporcha.tech') {
    const ref = doc(this.db, 'districts', dist.id);
    await setDoc(ref, {
      ...dist,
      divisionId,
      source,
      lastVerifiedAt: Timestamp.now(),
      status: 'VERIFIED'
    }, { merge: true });
  }

  async saveUpazila(upz: UpazilaNode, districtId: string, source: string = 'eporcha.tech') {
    const ref = doc(this.db, 'upazilas', upz.id);
    await setDoc(ref, {
      ...upz,
      districtId,
      source,
      lastVerifiedAt: Timestamp.now(),
      status: 'VERIFIED'
    }, { merge: true });
  }

  async saveMouzas(mouzas: MouzaNode[], upazilaId: string, source: string = 'eporcha.tech') {
    const batch = mouzas.map(m => {
      const ref = doc(this.db, 'mouzas', m.id);
      return setDoc(ref, {
        ...m,
        upazilaId,
        source,
        lastVerifiedAt: Timestamp.now(),
        status: 'VERIFIED',
        isValid: true
      }, { merge: true });
    });
    await Promise.all(batch);
  }

  async getDistricts(divisionId: string): Promise<DistrictNode[]> {
    const q = query(collection(this.db, 'districts'), where('divisionId', '==', divisionId));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as DistrictNode);
  }

  async getUpazilas(districtId: string): Promise<UpazilaNode[]> {
    const q = query(collection(this.db, 'upazilas'), where('districtId', '==', districtId));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as UpazilaNode);
  }

  async getMouzas(upazilaId: string): Promise<MouzaNode[]> {
    const q = query(collection(this.db, 'mouzas'), where('upazilaId', '==', upazilaId), where('isValid', '==', true));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as MouzaNode);
  }

  async logRejection(record: any, reason: string, source: string) {
    const ref = doc(collection(this.db, 'geographic_data_quality_logs'));
    await setDoc(ref, {
      originalRecord: record,
      reason,
      source,
      rejectedAt: Timestamp.now()
    });
  }
}

export const geoDb = new GeographicDbService();
