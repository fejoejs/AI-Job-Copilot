import { getApps, initializeApp, cert } from 'firebase-admin/app';

export const initializeFirebaseAdmin = () => {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  // Use the service account credentials from the environment variable if available
  // For Vercel/Render, we usually base64 encode the JSON or provide the individual keys
  const projectId = process.env.FIREBASE_PROJECT_ID || 'ai-job-copilot-c21bd';
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (clientEmail && privateKey) {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }

  // Fallback to application default credentials
  return initializeApp({
    projectId,
  });
};
