import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDocs,
  collection,
  query,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { KhatianRecord } from '../types/land';

// 1. Initialize Firebase App
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// 2. Initialize Firestore with specific database ID if provided
export const db = (firebaseConfig as any).firestoreDatabaseId
  ? getFirestore(app, (firebaseConfig as any).firestoreDatabaseId)
  : getFirestore(app);

// 3. Initialize Firebase Auth
export const auth = getAuth(app);

// 4. Configure Google Auth Provider with Google Drive Scopes
export const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.addScope('https://www.googleapis.com/auth/drive.file');
googleAuthProvider.addScope('https://www.googleapis.com/auth/drive');

// In-memory token cache (never stored in localStorage)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

// Initialize auth state listener
export const initAuth = (
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (onAuthSuccess) {
        onAuthSuccess(user, cachedAccessToken);
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) {
        onAuthFailure();
      }
    }
  });
};

// Sign in with Google Popup
export const signInWithGoogle = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleAuthProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      // If credential token is not present in result, user is still signed in with Firebase
      cachedAccessToken = null;
    } else {
      cachedAccessToken = credential.accessToken;
    }

    // Persist or update user profile document in Firestore
    if (result.user) {
      try {
        const userRef = doc(db, 'users', result.user.uid);
        await setDoc(
          userRef,
          {
            uid: result.user.uid,
            email: result.user.email || '',
            displayName: result.user.displayName || '',
            photoUrl: result.user.photoURL || '',
            driveConnected: Boolean(cachedAccessToken),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (err) {
        console.warn('Profile sync notice:', err);
      }
    }

    return {
      user: result.user,
      accessToken: cachedAccessToken || '',
    };
  } catch (error) {
    console.error('Google Sign-in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getCachedAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

export const signOutFromGoogle = async (): Promise<void> => {
  await signOut(auth);
  cachedAccessToken = null;
};

// Firestore standardized error reporting
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || false,
    },
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Sync Khatian records from local IndexedDB to user's Firestore cloud collection
export async function syncKhatianRecordsToCloud(
  userId: string,
  records: KhatianRecord[]
): Promise<{ syncedCount: number; errors: number }> {
  let syncedCount = 0;
  let errors = 0;

  for (const record of records) {
    try {
      const docRef = doc(db, 'users', userId, 'records', record.recordId);
      await setDoc(docRef, {
        recordId: record.recordId,
        userId,
        districtName: record.districtName,
        upazilaName: record.upazilaName,
        unionName: record.unionName || '',
        mouzaNameEn: record.mouzaNameEn || '',
        mouzaNameBn: record.mouzaNameBn || '',
        mouzaJlNo: record.mouzaJlNo,
        surveyType: record.surveyType,
        khatianNo: record.khatianNo,
        ownerName: record.ownerName || '',
        dagNo: record.dagNo || '',
        totalLandAcres: record.totalLandAcres || '',
        sourceUrl: record.sourceUrl || '',
        syncedAt: new Date().toISOString(),
      });
      syncedCount++;
    } catch (err) {
      errors++;
      console.warn(`Failed to sync record ${record.recordId} to cloud:`, err);
    }
  }

  return { syncedCount, errors };
}

// Fetch Khatian records synced to user's Firestore cloud collection
export async function fetchCloudKhatianRecords(
  userId: string
): Promise<KhatianRecord[]> {
  try {
    const colRef = collection(db, 'users', userId, 'records');
    const q = query(colRef, limit(200));
    const snap = await getDocs(q);
    const results: KhatianRecord[] = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      results.push({
        recordId: d.recordId || docSnap.id,
        districtName: d.districtName || '',
        upazilaName: d.upazilaName || '',
        unionName: d.unionName || '',
        mouzaNameEn: d.mouzaNameEn || '',
        mouzaNameBn: d.mouzaNameBn || '',
        mouzaJlNo: d.mouzaJlNo || '',
        surveyType: d.surveyType || 'RS',
        khatianNo: d.khatianNo || '',
        ownerName: d.ownerName || '',
        dagNo: d.dagNo || '',
        totalLandAcres: d.totalLandAcres || '',
        sourceUrl: d.sourceUrl || '',
        extractedAt: d.syncedAt || new Date().toISOString(),
      });
    });
    return results;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `users/${userId}/records`);
  }
}

// Record an uploaded Google Drive archive in Firestore
export async function recordDriveArchiveToFirestore(
  userId: string,
  archive: {
    archiveId: string;
    driveFileId: string;
    driveFileName: string;
    driveViewLink: string;
    verifiedPdfCount: number;
    sizeBytes: number;
  }
) {
  try {
    const docRef = doc(db, 'users', userId, 'archives', archive.archiveId);
    await setDoc(docRef, {
      ...archive,
      userId,
      uploadedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Failed to record drive archive in Firestore:', err);
  }
}
