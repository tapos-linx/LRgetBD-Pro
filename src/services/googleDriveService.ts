export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  webViewLink?: string;
  createdTime?: string;
}

const DRIVE_FOLDER_NAME = 'LRgetBD Land Archives (eporcha.tech)';

/**
 * Searches for or creates a dedicated root folder in Google Drive for LRgetBD archives.
 */
export async function getOrCreateLRDriveFolder(accessToken: string): Promise<string> {
  const query = encodeURIComponent(
    `name = '${DRIVE_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  );
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`;

  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!searchRes.ok) {
    const errorText = await searchRes.text();
    throw new Error(`Google Drive folder search failed (${searchRes.status}): ${errorText}`);
  }

  const data = await searchRes.json();
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }

  // Create the folder
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: DRIVE_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
      description: 'Automated bulk land record archives synced from LRgetBD Pro',
    }),
  });

  if (!createRes.ok) {
    const errorText = await createRes.text();
    throw new Error(`Failed to create Google Drive folder: ${errorText}`);
  }

  const created = await createRes.json();
  return created.id;
}

/**
 * Uploads a file (ZIP blob or PDF blob) directly to the user's Google Drive folder using multipart upload.
 */
export async function uploadBlobToGoogleDrive(params: {
  blob: Blob;
  fileName: string;
  accessToken: string;
  folderId?: string;
  description?: string;
}): Promise<DriveFileItem> {
  const { blob, fileName, accessToken } = params;
  let targetFolderId = params.folderId;

  if (!targetFolderId) {
    targetFolderId = await getOrCreateLRDriveFolder(accessToken);
  }

  const metadata = {
    name: fileName,
    parents: [targetFolderId],
    description: params.description || 'Verified Land Record Archive from LRgetBD Pro',
  };

  const boundary = '-------LRgetBD_DRIVE_BOUNDARY_' + Date.now();
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadataContentType = 'application/json; charset=UTF-8';
  const fileContentType = blob.type || 'application/octet-stream';

  // Read blob as ArrayBuffer to build multipart payload safely
  const fileBuffer = await blob.arrayBuffer();

  const metadataPart =
    `Content-Type: ${metadataContentType}\r\n\r\n` + JSON.stringify(metadata);

  const multipartHeader =
    `--${boundary}\r\n` +
    metadataPart +
    delimiter +
    `Content-Type: ${fileContentType}\r\n\r\n`;

  const encoder = new TextEncoder();
  const headerBytes = encoder.encode(multipartHeader);
  const footerBytes = encoder.encode(closeDelimiter);

  const totalLength = headerBytes.length + fileBuffer.byteLength + footerBytes.length;
  const combinedBuffer = new Uint8Array(totalLength);

  combinedBuffer.set(headerBytes, 0);
  combinedBuffer.set(new Uint8Array(fileBuffer), headerBytes.length);
  combinedBuffer.set(footerBytes, headerBytes.length + fileBuffer.byteLength);

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,createdTime',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: combinedBuffer,
    }
  );

  if (!uploadRes.ok) {
    const errorText = await uploadRes.text();
    throw new Error(`Google Drive upload failed (${uploadRes.status}): ${errorText}`);
  }

  const result = await uploadRes.json();
  return result as DriveFileItem;
}

/**
 * Lists files stored in the LRgetBD folder in Google Drive.
 */
export async function listLRDriveFiles(accessToken: string): Promise<DriveFileItem[]> {
  try {
    const folderId = await getOrCreateLRDriveFolder(accessToken);
    const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    const url = `https://www.googleapis.com/drive/v3/files?q=${query}&orderBy=createdTime desc&pageSize=50&fields=files(id,name,mimeType,size,webViewLink,createdTime)`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      throw new Error(`Failed to list files: ${res.statusText}`);
    }

    const data = await res.json();
    return data.files || [];
  } catch (err) {
    console.error('Error listing Drive files:', err);
    return [];
  }
}

/**
 * Deletes a file from Google Drive with explicit confirmation requirement.
 */
export async function deleteDriveFile(
  fileId: string,
  fileName: string,
  accessToken: string,
  confirmed: boolean
): Promise<void> {
  if (!confirmed) {
    throw new Error('User confirmation is strictly required to delete files from Google Drive.');
  }

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok && res.status !== 204) {
    const errText = await res.text();
    throw new Error(`Failed to delete Google Drive file (${res.status}): ${errText}`);
  }
}
