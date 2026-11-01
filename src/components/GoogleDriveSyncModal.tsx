import React, { useState, useEffect } from 'react';
import {
  X,
  Cloud,
  CheckCircle2,
  FolderArchive,
  ExternalLink,
  Trash2,
  Upload,
  RefreshCw,
  LogOut,
  AlertCircle,
  Database,
  HardDrive,
} from 'lucide-react';
import {
  signInWithGoogle,
  signOutFromGoogle,
  getCachedAccessToken,
  syncKhatianRecordsToCloud,
  fetchCloudKhatianRecords,
  recordDriveArchiveToFirestore,
} from '../services/firebaseClient';
import {
  uploadBlobToGoogleDrive,
  listLRDriveFiles,
  deleteDriveFile,
  DriveFileItem,
} from '../services/googleDriveService';
import { bundleTasksToStructuredZip } from '../services/downloadAndZipService';
import { KhatianRecord, QueueTask } from '../types/land';
import { User } from 'firebase/auth';

interface GoogleDriveSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onUserChange: (user: User | null) => void;
  tasks: QueueTask[];
  localRecords: KhatianRecord[];
  onImportCloudRecords: (records: KhatianRecord[]) => void;
}

export const GoogleDriveSyncModal: React.FC<GoogleDriveSyncModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserChange,
  tasks,
  localRecords,
  onImportCloudRecords,
}) => {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [isSyncingFirestore, setIsSyncingFirestore] = useState(false);
  const [firestoreSyncStatus, setFirestoreSyncStatus] = useState<string | null>(null);
  const [fileToDelete, setFileToDelete] = useState<DriveFileItem | null>(null);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);

  const accessToken = getCachedAccessToken();

  useEffect(() => {
    if (isOpen && currentUser && accessToken) {
      loadDriveFiles();
    }
  }, [isOpen, currentUser, accessToken]);

  const loadDriveFiles = async () => {
    const token = getCachedAccessToken();
    if (!token) return;
    setIsLoadingFiles(true);
    try {
      const files = await listLRDriveFiles(token);
      setDriveFiles(files);
    } catch (err) {
      console.error('Failed to load drive files:', err);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleSignIn = async () => {
    setIsSigningIn(true);
    try {
      const result = await signInWithGoogle();
      if (result) {
        onUserChange(result.user);
        if (result.accessToken) {
          await loadDriveFiles();
        }
      }
    } catch (err) {
      console.error('Sign in failed:', err);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutFromGoogle();
      onUserChange(null);
      setDriveFiles([]);
    } catch (err) {
      console.error('Sign out failed:', err);
    }
  };

  const handleUploadZipToDrive = async () => {
    const token = getCachedAccessToken();
    if (!token || !currentUser) {
      alert('Please sign in with Google first.');
      return;
    }

    const verifiedCount = tasks.filter((t) => t.pdfVerified).length;
    if (verifiedCount === 0 && tasks.length === 0) {
      setUploadStatus('No tasks or verified PDFs in queue to bundle and upload.');
      return;
    }

    setIsUploading(true);
    setUploadStatus('Building structured ZIP bundle with forensic manifest...');
    try {
      const { zipBlob, verifiedPdfCount, zipFileName } =
        await bundleTasksToStructuredZip({
          tasks,
          onProgress: (percent, text) => {
            setUploadStatus(`${percent}%: ${text}`);
          },
        });

      setUploadStatus(`Uploading ${zipFileName} (${(zipBlob.size / 1024).toFixed(1)} KB) to Google Drive...`);
      const uploadedFile = await uploadBlobToGoogleDrive({
        blob: zipBlob,
        fileName: zipFileName,
        accessToken: token,
        description: `LRgetBD verified land records archive with ${verifiedPdfCount} PDFs`,
      });

      // Record archive in user's Firestore collection
      await recordDriveArchiveToFirestore(currentUser.uid, {
        archiveId: `arc_${Date.now()}`,
        driveFileId: uploadedFile.id,
        driveFileName: uploadedFile.name,
        driveViewLink: uploadedFile.webViewLink || '',
        verifiedPdfCount,
        sizeBytes: zipBlob.size,
      });

      setUploadStatus(`✓ Successfully uploaded "${uploadedFile.name}" to Google Drive!`);
      await loadDriveFiles();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setUploadStatus(`Upload failed: ${msg}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSyncFirestore = async () => {
    if (!currentUser) return;
    if (localRecords.length === 0) {
      setFirestoreSyncStatus('No local extracted records in Tabular Index to sync.');
      return;
    }

    setIsSyncingFirestore(true);
    setFirestoreSyncStatus(`Syncing ${localRecords.length} records to Cloud Firestore...`);
    try {
      const res = await syncKhatianRecordsToCloud(currentUser.uid, localRecords);
      setFirestoreSyncStatus(
        `✓ Synced ${res.syncedCount} records to Cloud Firestore (${res.errors} errors).`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setFirestoreSyncStatus(`Cloud sync error: ${msg}`);
    } finally {
      setIsSyncingFirestore(false);
    }
  };

  const handleFetchFromFirestore = async () => {
    if (!currentUser) return;
    setIsSyncingFirestore(true);
    setFirestoreSyncStatus('Fetching synced records from Cloud Firestore...');
    try {
      const cloudRecords = await fetchCloudKhatianRecords(currentUser.uid);
      if (cloudRecords.length > 0) {
        onImportCloudRecords(cloudRecords);
        setFirestoreSyncStatus(`✓ Imported ${cloudRecords.length} records from Cloud Firestore.`);
      } else {
        setFirestoreSyncStatus('No records found in your Cloud Firestore database.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setFirestoreSyncStatus(`Fetch error: ${msg}`);
    } finally {
      setIsSyncingFirestore(false);
    }
  };

  const handleInitiateDelete = (file: DriveFileItem) => {
    setFileToDelete(file);
    setDeleteConfirmationOpen(true);
  };

  const handleConfirmDelete = async () => {
    const token = getCachedAccessToken();
    if (!token || !fileToDelete) return;
    try {
      await deleteDriveFile(fileToDelete.id, fileToDelete.name, token, true);
      setDriveFiles((prev) => prev.filter((f) => f.id !== fileToDelete.id));
      setDeleteConfirmationOpen(false);
      setFileToDelete(null);
    } catch (err) {
      alert(`Could not delete file: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="drive-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto"
    >
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 id="drive-modal-title" className="text-base font-semibold text-white">
                Google Drive & Cloud Storage Sync
              </h2>
              <p className="text-xs text-slate-400">
                Directly upload verified ZIP bundles to Google Drive and sync records with Firestore
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {/* Section 1: Google Authentication */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
            {currentUser ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {currentUser.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt={currentUser.displayName || 'User'}
                      className="w-10 h-10 rounded-full border border-slate-700"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold">
                      {currentUser.email ? currentUser.email.charAt(0).toUpperCase() : 'U'}
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-semibold text-white flex items-center gap-1.5">
                      <span>{currentUser.displayName || 'Google Account'}</span>
                      <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
                    </div>
                    <div className="text-xs text-slate-400 font-mono">{currentUser.email}</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Disconnect</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-white">
                    Connect with your Google Account
                  </div>
                  <p className="text-xs text-slate-400">
                    Sign in to grant permission to backup land records directly to your Google Drive.
                  </p>
                </div>

                {/* Google Sign In Button */}
                <button
                  type="button"
                  onClick={handleSignIn}
                  disabled={isSigningIn}
                  className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-900 rounded-xl font-medium text-xs shadow-md transition-all flex items-center gap-2 shrink-0 disabled:opacity-50"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>{isSigningIn ? 'Connecting...' : 'Sign in with Google'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Section 2: Google Drive Action Area */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
              <span>Google Drive Automated Archiving</span>
            </h3>

            <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-medium text-white">Upload Verified Land Record ZIP</div>
                  <div className="text-[11px] text-slate-400">
                    Saves current queue tasks as a structured archive inside &quot;LRgetBD Land Archives&quot; on Google Drive
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleUploadZipToDrive}
                  disabled={!currentUser || isUploading}
                  className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isUploading ? 'Uploading...' : 'Upload to Drive'}</span>
                </button>
              </div>

              {uploadStatus && (
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-emerald-400 font-mono">
                  {uploadStatus}
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Cloud Firestore Tabular Sync */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-teal-400" />
              <span>Cloud Firestore Database Sync</span>
            </h3>

            <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-medium text-white">
                    Tabular Records ({localRecords.length} in local storage)
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Synchronize extracted Khatian records to your provisioned Cloud Firestore database
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSyncFirestore}
                    disabled={!currentUser || isSyncingFirestore}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Upload className="w-3.5 h-3.5 text-teal-400" />
                    <span>Sync to Cloud</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleFetchFromFirestore}
                    disabled={!currentUser || isSyncingFirestore}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Download Cloud</span>
                  </button>
                </div>
              </div>

              {firestoreSyncStatus && (
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-teal-300 font-mono">
                  {firestoreSyncStatus}
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Google Drive Folder File Explorer */}
          {currentUser && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Files in Google Drive ({driveFiles.length})
                </h3>
                <button
                  type="button"
                  onClick={loadDriveFiles}
                  disabled={isLoadingFiles}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingFiles ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/60 divide-y divide-slate-800/80">
                {isLoadingFiles ? (
                  <div className="p-4 text-center text-xs text-slate-500">Loading files from Drive...</div>
                ) : driveFiles.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">
                    No files found in &quot;LRgetBD Land Archives (eporcha.tech)&quot;. Upload a ZIP archive above.
                  </div>
                ) : (
                  driveFiles.map((file) => (
                    <div key={file.id} className="p-3 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <FolderArchive className="w-4 h-4 text-amber-400 shrink-0" />
                        <div className="overflow-hidden">
                          <div className="font-mono text-slate-200 truncate">{file.name}</div>
                          {file.size && (
                            <div className="text-[10px] text-slate-500">
                              {(Number(file.size) / (1024 * 1024)).toFixed(2)} MB
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {file.webViewLink && (
                          <a
                            href={file.webViewLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-colors"
                            title="Open in Google Drive"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={() => handleInitiateDelete(file)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                          title="Delete from Google Drive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-950/80 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors"
          >
            Close
          </button>
        </div>

        {/* Explicit Confirmation Dialog for Delete */}
        {deleteConfirmationOpen && fileToDelete && (
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-delete-title"
            aria-describedby="confirm-delete-desc"
            className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md"
          >
            <div className="w-full max-w-md p-5 bg-slate-900 border border-rose-500/30 rounded-2xl shadow-2xl space-y-4">
              <div className="flex items-center gap-3 text-rose-400">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <h4 id="confirm-delete-title" className="text-sm font-bold text-white">
                  Confirm Deletion from Google Drive
                </h4>
              </div>

              <p id="confirm-delete-desc" className="text-xs text-slate-300">
                Are you sure you want to delete <span className="font-mono font-bold text-white">&quot;{fileToDelete.name}&quot;</span> from your Google Drive? This action cannot be undone.
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteConfirmationOpen(false);
                    setFileToDelete(null);
                  }}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors"
                >
                  Delete from Drive
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
