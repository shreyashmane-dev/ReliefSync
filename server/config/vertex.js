import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_VERTEX_CREDENTIAL_CANDIDATES = [
  process.env.VERTEX_CREDENTIALS_PATH,
  process.env.GOOGLE_APPLICATION_CREDENTIALS,
  path.resolve(__dirname, '../../src/google-credentials.json'),
  path.resolve(__dirname, '../serviceAccount.json'),
].filter(Boolean);

const loadServiceAccount = (filePath) => {
  try {
    const absolutePath = path.resolve(filePath);
    if (!fs.existsSync(absolutePath)) return null;

    const raw = fs.readFileSync(absolutePath, 'utf8');
    const credentials = JSON.parse(raw);

    return {
      path: absolutePath,
      credentials,
    };
  } catch (error) {
    console.warn(`Unable to read Vertex credentials from ${filePath}:`, error.message);
    return null;
  }
};

export const resolveVertexCredentials = () => {
  for (const candidate of DEFAULT_VERTEX_CREDENTIAL_CANDIDATES) {
    const loaded = loadServiceAccount(candidate);
    if (!loaded) continue;

    if (loaded.credentials.project_id === process.env.GOOGLE_CLOUD_PROJECT_ID) {
      return loaded;
    }
  }

  return loadServiceAccount(DEFAULT_VERTEX_CREDENTIAL_CANDIDATES[0] || '');
};

export const getVertexConfigStatus = () => {
  const resolved = resolveVertexCredentials();
  const configuredProjectId = process.env.GOOGLE_CLOUD_PROJECT_ID || null;
  const credentialProjectId = resolved?.credentials?.project_id || null;

  return {
    configuredProjectId,
    credentialProjectId,
    credentialsPath: resolved?.path || null,
    projectMatch: Boolean(
      configuredProjectId &&
      credentialProjectId &&
      configuredProjectId === credentialProjectId
    ),
  };
};
