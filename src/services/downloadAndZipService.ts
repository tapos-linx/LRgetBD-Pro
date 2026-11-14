import JSZip from 'jszip';
import { QueueTask, VerifiedBlobRecord } from '../types/land';
import { isStructurallyValidPdf } from './binaryValidator';
import {
  getAllVerifiedPdfBlobs,
  getVerifiedPdfBlob,
} from './storageService';
import {
  generateManifestAuditCsv,
  generateManifestAuditMarkdown,
} from './queueEngine';

export interface BundleProgressCallback {
  (percent: number, statusText: string): void;
}

export interface StructuredZipResult {
  zipBlob: Blob;
  verifiedPdfCount: number;
  urlRecordCount: number;
  zipFileName: string;
  totalBytes: number;
}

/**
 * Triggers an immediate browser download for an individual task's PDF/document.
 * Uses stored authentic filename/mimeType so HTML/JSON payloads are never saved with a .pdf extension.
 */
export async function triggerIndividualPdfDownload(
  task: QueueTask,
  blobBuffer?: ArrayBuffer
): Promise<boolean> {
  try {
    let buffer = blobBuffer;
    let mimeType = task.mimeType || 'application/pdf';
    let storedFileName = task.fileName;

    if (!buffer) {
      const stored = await getVerifiedPdfBlob(task.id);
      if (stored && stored.buffer) {
        buffer = stored.buffer;
        mimeType = stored.mimeType || mimeType;
        storedFileName = stored.fileName || storedFileName;
      }
    }

    if (!buffer || buffer.byteLength === 0) {
      console.warn(`[Download] No cached binary found for task: ${task.id}`);
      return false;
    }

    const bytes = new Uint8Array(buffer);
    const validPdf = isStructurallyValidPdf(bytes);
    if (!validPdf && /\.pdf$/i.test(storedFileName)) {
      const fallbackExt = mimeType.includes('json') ? '.json' : '.html';
      storedFileName = storedFileName.replace(/\.pdf$/i, fallbackExt);
    }

    const blob = new Blob([buffer], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = storedFileName || `LandRecord_${task.id}${validPdf ? '.pdf' : '.html'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1500);

    return true;
  } catch (error) {
    console.error(`[Download] Failed to download individual task ${task.id}:`, error);
    return false;
  }
}

/**
 * Clean path component for ZIP directory structure
 */
function sanitizePathComponent(name: string): string {
  return (name || 'Unknown')
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, '_')
    .trim();
}

/**
 * Bundles verified blobs from IndexedDB into a structured ZIP archive:
 * Directory layout: [District]/[Upazila]/[Survey]/[Standardized_Filename].pdf
 * Includes MANIFEST_AUDIT.csv and MANIFEST_AUDIT.md with SHA-256 and provenance metadata.
 */
export async function bundleTasksToStructuredZip(params: {
  tasks: QueueTask[];
  onProgress?: BundleProgressCallback;
}): Promise<StructuredZipResult> {
  const { tasks, onProgress } = params;
  const zip = new JSZip();

  if (onProgress) {
    onProgress(5, 'Querying verified records from IndexedDB...');
  }

  const verifiedBlobs = await getAllVerifiedPdfBlobs();
  const blobMap = new Map<string, VerifiedBlobRecord>();
  for (const b of verifiedBlobs) {
    blobMap.set(b.taskId, b);
  }

  let verifiedPdfCount = 0;
  let urlRecordCount = 0;
  let totalBytes = 0;

  const totalTasks = tasks.length;
  for (let i = 0; i < totalTasks; i++) {
    const task = tasks[i];
    const stored = blobMap.get(task.id);

    if (onProgress && i % 10 === 0) {
      const percent = Math.min(85, Math.round(5 + (i / totalTasks) * 75));
      onProgress(percent, `Packaging ${i + 1}/${totalTasks}: ${task.mouzaNameEn} (${task.surveyType})...`);
    }

    if (!stored || !stored.buffer) continue;

    const buffer = stored.buffer;
    const bytes = new Uint8Array(buffer);
    const isValidPdf = isStructurallyValidPdf(bytes);

    // Build directory path: [District]/[Upazila]/[Survey]/[Filename]
    const districtDir = sanitizePathComponent(task.districtNameEn || 'District');
    const upazilaDir = sanitizePathComponent(task.upazilaNameEn || 'Upazila');
    const surveyDir = sanitizePathComponent(task.surveyType || 'SURVEY');

    if (isValidPdf) {
      const filePath = `${districtDir}/${upazilaDir}/${surveyDir}/${task.fileName}`;
      zip.file(filePath, buffer, { binary: true });
      verifiedPdfCount++;
      totalBytes += buffer.byteLength;
    } else if (buffer.byteLength > 0) {
      const rawExt =
        stored.fileName.endsWith('.json') || stored.mimeType?.includes('json')
          ? '.json'
          : '.html';
      const rawFileName = task.fileName.replace(/\.pdf$/i, rawExt);
      const filePath = `${districtDir}/${upazilaDir}/${surveyDir}/metadata_records/${rawFileName}`;
      zip.file(filePath, buffer, { binary: true });
      urlRecordCount++;
      totalBytes += buffer.byteLength;
    }
  }

  if (onProgress) {
    onProgress(88, 'Generating forensic audit manifests (CSV & Markdown)...');
  }

  // Audit Manifests
  const csvContent = generateManifestAuditCsv(tasks);
  const mdContent = generateManifestAuditMarkdown(tasks, verifiedPdfCount);

  zip.file('MANIFEST_AUDIT.csv', csvContent);
  zip.file('MANIFEST_AUDIT.md', mdContent);

  if (onProgress) {
    onProgress(92, 'Compressing ZIP archive (DEFLATE)...');
  }

  const zipBlob = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    },
    (metadata) => {
      if (onProgress && metadata.percent) {
        const finalPercent = Math.min(99, Math.round(92 + (metadata.percent / 100) * 7));
        onProgress(finalPercent, `Compressing: ${Math.round(metadata.percent)}%`);
      }
    }
  );

  const primaryDistrict = tasks[0]?.districtNameEn || 'Bangladesh';
  const primaryUpazila = tasks[0]?.upazilaNameEn || 'Records';
  const dateTag = new Date().toISOString().slice(0, 10);
  const zipFileName = `LRgetBD_Pro_${sanitizePathComponent(primaryDistrict)}_${sanitizePathComponent(primaryUpazila)}_${dateTag}.zip`;

  if (onProgress) {
    onProgress(100, `Done! Packaged ${verifiedPdfCount} verified PDFs.`);
  }

  return {
    zipBlob,
    verifiedPdfCount,
    urlRecordCount,
    zipFileName,
    totalBytes: totalBytes || zipBlob.size,
  };
}

/**
 * Triggers a download of the compiled JSZip blob in the browser.
 */
export function triggerZipDownload(zipBlob: Blob, filename: string): void {
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 3000);
}
