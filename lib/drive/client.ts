import { createSign } from 'node:crypto';

/**
 * Google Drive adapter.
 *
 * Rule 5: files live in Drive and the application stores references. That means
 * Vistrial is never the only copy, the admin keeps working in the tool they
 * already use, and there is no storage quota to manage.
 *
 * Authentication is a service account signing its own JWT, which needs no
 * interactive consent and no extra dependency. When the credentials are absent
 * the adapter reports `configured: false` and the callers degrade to
 * metadata-only rather than throwing.
 */

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/drive';

export const DRIVE_SUBFOLDERS = ['Evidence', 'Deliverables', 'Reports', 'Client Provided'] as const;

export type DriveSubfolder = (typeof DRIVE_SUBFOLDERS)[number];

/** Maps the Drive subfolder names onto the evidence_category enum. */
export const SUBFOLDER_TO_CATEGORY: Record<DriveSubfolder, string> = {
  Evidence: 'evidence',
  Deliverables: 'deliverables',
  Reports: 'reports',
  'Client Provided': 'client_provided',
};

export type DriveConfig = {
  clientEmail: string;
  privateKey: string;
  parentFolderId: string;
  subjectEmail?: string;
};

export function readDriveConfig(): DriveConfig | null {
  const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const parentFolderId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;

  if (!clientEmail || !privateKey || !parentFolderId) return null;

  return {
    clientEmail,
    privateKey,
    parentFolderId,
    subjectEmail: process.env.GOOGLE_DRIVE_SUBJECT_EMAIL || undefined,
  };
}

export const driveConfigured = () => readDriveConfig() !== null;

const base64url = (input: string | Buffer) =>
  Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(config: DriveConfig): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({
      iss: config.clientEmail,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
      ...(config.subjectEmail ? { sub: config.subjectEmail } : {}),
    }),
  );

  const signature = base64url(createSign('RSA-SHA256').update(`${header}.${claims}`).sign(config.privateKey));

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claims}.${signature}`,
    }),
  });

  if (!response.ok) {
    throw new Error(`drive_auth_failed: ${response.status} ${await response.text()}`);
  }

  const body = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return cachedToken.token;
}

async function driveFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const config = readDriveConfig();
  if (!config) throw new Error('drive_not_configured');

  const token = await getAccessToken(config);
  const response = await fetch(`${DRIVE_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`drive_request_failed: ${init.method ?? 'GET'} ${path} -> ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as T;
}

export type DriveFolder = { id: string; name: string; webViewLink: string };

async function createFolder(name: string, parentId: string): Promise<DriveFolder> {
  return driveFetch<DriveFolder>('/files?fields=id,name,webViewLink&supportsAllDrives=true', {
    method: 'POST',
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }),
  });
}

export type CaseFileFolders = {
  root: DriveFolder;
  subfolders: Record<string, { folder_id: string; folder_url: string }>;
};

/**
 * Creates the client folder and its fixed subfolder set. Named consistently so
 * it is findable in Drive without going through the app.
 */
export async function createCaseFileFolders(clientName: string, slug: string): Promise<CaseFileFolders> {
  const config = readDriveConfig();
  if (!config) throw new Error('drive_not_configured');

  const root = await createFolder(`${clientName} (${slug})`, config.parentFolderId);
  const subfolders: CaseFileFolders['subfolders'] = {};

  for (const name of DRIVE_SUBFOLDERS) {
    const folder = await createFolder(name, root.id);
    subfolders[SUBFOLDER_TO_CATEGORY[name]] = {
      folder_id: folder.id,
      folder_url: folder.webViewLink,
    };
  }

  return { root, subfolders };
}

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  webViewLink: string;
  thumbnailLink?: string;
  createdTime: string;
};

const FILE_FIELDS = 'id,name,mimeType,size,webViewLink,thumbnailLink,createdTime';

/** Uploads into the subfolder matching the chosen category. */
export async function uploadFile(
  folderId: string,
  filename: string,
  mimeType: string,
  bytes: ArrayBuffer,
): Promise<DriveFile> {
  const config = readDriveConfig();
  if (!config) throw new Error('drive_not_configured');

  const token = await getAccessToken(config);
  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify({ name: filename, parents: [folderId] })], { type: 'application/json' }),
  );
  form.append('file', new Blob([bytes], { type: mimeType }));

  const response = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=${FILE_FIELDS}`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form },
  );

  if (!response.ok) {
    throw new Error(`drive_upload_failed: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as DriveFile;
}

/** Lists a folder's files, so the sync can find anything added outside the app. */
export async function listFolder(folderId: string): Promise<DriveFile[]> {
  const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const body = await driveFetch<{ files: DriveFile[] }>(
    `/files?q=${query}&fields=files(${FILE_FIELDS})&pageSize=200&supportsAllDrives=true`,
  );
  return body.files ?? [];
}

/**
 * Rule 6: sharing hands out a time-limited permission rather than making the
 * file public. Drive expiring permissions require a named account and a date, so
 * the link is scoped to the recipient and expires on its own.
 */
export async function grantTimeLimitedAccess(
  fileId: string,
  recipientEmail: string,
  expiresAt: Date,
): Promise<{ permissionId: string }> {
  const body = await driveFetch<{ id: string }>(
    `/files/${fileId}/permissions?fields=id&supportsAllDrives=true&sendNotificationEmail=false`,
    {
      method: 'POST',
      body: JSON.stringify({
        role: 'reader',
        type: 'user',
        emailAddress: recipientEmail,
        // Drive rejects expirations beyond a year and requires a date, not a time.
        expirationTime: expiresAt.toISOString(),
      }),
    },
  );

  return { permissionId: body.id };
}

export async function revokeAccess(fileId: string, permissionId: string): Promise<void> {
  const config = readDriveConfig();
  if (!config) throw new Error('drive_not_configured');
  const token = await getAccessToken(config);

  const response = await fetch(
    `${DRIVE_API}/files/${fileId}/permissions/${permissionId}?supportsAllDrives=true`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
  );

  if (!response.ok && response.status !== 404) {
    throw new Error(`drive_revoke_failed: ${response.status}`);
  }
}
