import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let serviceAccount = null;

try {
  // Option 1: Path from env variable
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    serviceAccount = JSON.parse(readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8'));
  } 
  // Option 2: Default location in server folder
  else {
    const defaultPath = path.resolve(__dirname, '../serviceAccount.json');
    serviceAccount = JSON.parse(readFileSync(defaultPath, 'utf8'));
  }
} catch (error) {
  console.warn('Firebase Admin Service Account not found. Push notifications will be disabled.');
}

if (serviceAccount) {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
}

export const db = admin.apps.length ? admin.firestore() : null;
export const messagingAdmin = serviceAccount ? admin.messaging() : null;
export default admin;
