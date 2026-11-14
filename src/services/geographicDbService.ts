import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  Timestamp,
  Firestore,
} from 'firebase/firestore';
import {
  DivisionNode,
  DistrictNode,
  UpazilaNode,
  MouzaNode,
} from '../types/land';
import { auth, db as configuredDb } from './firebaseClient';

export interface GeographicProvenanceMeta {
  sourceUrl?: string;
  rawSourceId?: string;
}

/**
 * Normalized Geographic Database Service.
 * Stores geographic hierarchy records with honest provenance metadata.
 * Records saved from discovery or import are marked UNVERIFIED until explicitly verified.
 */
export class GeographicDbService {
  private getDb(): Firestore {
    return configuredDb || getFirestore();
  }

  private getAuthenticatedUid(): string | null {
    return auth?.currentUser?.uid ?? null;
  }

  async saveDivision(
    div: DivisionNode,
    source: string = 'eporcha.tech',
    meta?: GeographicProvenanceMeta
  ) {
    const uid = this.getAuthenticatedUid();
    if (!uid) return;
    const db = this.getDb();
    const ref = doc(db, 'divisions', div.id);
    await setDoc(
      ref,
      {
        id: div.id,
        nameEn: div.nameEn,
        nameBn: div.nameBn,
        eporchaSlug: div.eporchaSlug,
        recordedByUid: uid,
        source,
        sourceUrl: meta?.sourceUrl ?? null,
        rawSourceId: meta?.rawSourceId ?? div.id,
        retrievedAt: Timestamp.now(),
        verificationMethod: null,
        verifiedAt: null,
        status: 'UNVERIFIED',
        isValid: false,
      },
      { merge: true }
    );
  }

  async saveDistrict(
    dist: DistrictNode,
    divisionId: string,
    source: string = 'eporcha.tech',
    meta?: GeographicProvenanceMeta
  ) {
    const uid = this.getAuthenticatedUid();
    if (!uid) return;
    const db = this.getDb();
    const ref = doc(db, 'districts', dist.id);
    await setDoc(
      ref,
      {
        id: dist.id,
        code: dist.code,
        nameEn: dist.nameEn,
        nameBn: dist.nameBn,
        eporchaSlug: dist.eporchaSlug,
        divisionId,
        parentId: divisionId,
        recordedByUid: uid,
        source,
        sourceUrl: meta?.sourceUrl ?? null,
        rawSourceId: meta?.rawSourceId ?? dist.code ?? dist.id,
        retrievedAt: Timestamp.now(),
        verificationMethod: null,
        verifiedAt: null,
        status: 'UNVERIFIED',
        isValid: false,
      },
      { merge: true }
    );
  }

  async saveUpazila(
    upz: UpazilaNode,
    districtId: string,
    source: string = 'eporcha.tech',
    meta?: GeographicProvenanceMeta
  ) {
    const uid = this.getAuthenticatedUid();
    if (!uid) return;
    const db = this.getDb();
    const ref = doc(db, 'upazilas', upz.id);
    await setDoc(
      ref,
      {
        id: upz.id,
        nameEn: upz.nameEn,
        nameBn: upz.nameBn,
        eporchaSlug: upz.eporchaSlug,
        districtId,
        parentId: districtId,
        recordedByUid: uid,
        source,
        sourceUrl: meta?.sourceUrl ?? null,
        rawSourceId: meta?.rawSourceId ?? upz.id,
        retrievedAt: Timestamp.now(),
        verificationMethod: null,
        verifiedAt: null,
        status: 'UNVERIFIED',
        isValid: false,
      },
      { merge: true }
    );
  }

  async saveMouzas(
    mouzas: MouzaNode[],
    upazilaId: string,
    source: string = 'eporcha.tech',
    meta?: GeographicProvenanceMeta
  ) {
    const uid = this.getAuthenticatedUid();
    if (!uid) return;
    const db = this.getDb();
    const batch = mouzas.map((m) => {
      const ref = doc(db, 'mouzas', m.id);
      return setDoc(
        ref,
        {
          id: m.id,
          jlNo: m.jlNo,
          nameEn: m.nameEn,
          nameBn: m.nameBn,
          unionNameEn: m.unionNameEn,
          unionNameBn: m.unionNameBn,
          availableSurveys: m.availableSurveys.slice(0, 5),
          estimatedKhatians: m.estimatedKhatians,
          estimatedDags: m.estimatedDags,
          mapSheets: m.mapSheets.slice(0, 50),
          upazilaId,
          parentId: upazilaId,
          recordedByUid: uid,
          source,
          sourceUrl: meta?.sourceUrl ?? null,
          rawSourceId: meta?.rawSourceId ?? m.jlNo ?? m.id,
          retrievedAt: Timestamp.now(),
          verificationMethod: null,
          verifiedAt: null,
          status: 'UNVERIFIED',
          isValid: false,
        },
        { merge: true }
      );
    });
    await Promise.all(batch);
  }

  async verifyGeographicRecord(
    collectionName: 'divisions' | 'districts' | 'upazilas' | 'mouzas',
    recordId: string,
    verificationMethod: string
  ) {
    const uid = this.getAuthenticatedUid();
    if (!uid) return;
    const db = this.getDb();
    const ref = doc(db, collectionName, recordId);
    await setDoc(
      ref,
      {
        status: 'VERIFIED',
        isValid: true,
        verificationMethod,
        verifiedAt: Timestamp.now(),
      },
      { merge: true }
    );
  }

  async getDistricts(divisionId: string): Promise<DistrictNode[]> {
    const uid = this.getAuthenticatedUid();
    if (!uid) return [];
    const db = this.getDb();
    const q = query(
      collection(db, 'districts'),
      where('recordedByUid', '==', uid),
      where('divisionId', '==', divisionId)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as DistrictNode);
  }

  async getUpazilas(districtId: string): Promise<UpazilaNode[]> {
    const uid = this.getAuthenticatedUid();
    if (!uid) return [];
    const db = this.getDb();
    const q = query(
      collection(db, 'upazilas'),
      where('recordedByUid', '==', uid),
      where('districtId', '==', districtId)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as UpazilaNode);
  }

  async getMouzas(upazilaId: string, verifiedOnly: boolean = false): Promise<MouzaNode[]> {
    const uid = this.getAuthenticatedUid();
    if (!uid) return [];
    const db = this.getDb();
    const q = verifiedOnly
      ? query(
          collection(db, 'mouzas'),
          where('recordedByUid', '==', uid),
          where('upazilaId', '==', upazilaId),
          where('isValid', '==', true)
        )
      : query(
          collection(db, 'mouzas'),
          where('recordedByUid', '==', uid),
          where('upazilaId', '==', upazilaId)
        );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as MouzaNode);
  }

  async logRejection(record: unknown, reason: string, source: string) {
    const uid = this.getAuthenticatedUid();
    if (!uid) return;
    const db = this.getDb();
    const ref = doc(collection(db, 'geographic_data_quality_logs'));
    await setDoc(ref, {
      recordedByUid: uid,
      originalRecord: typeof record === 'string' ? record.slice(0, 2000) : JSON.stringify(record).slice(0, 2000),
      reason: reason.slice(0, 500),
      source: source.slice(0, 200),
      rejectedAt: Timestamp.now(),
    });
  }
}

export const geoDb = new GeographicDbService();

