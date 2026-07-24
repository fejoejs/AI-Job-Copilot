import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDD95TebkbqTn1IhrPRqwUCQgYTOy5nHCg",
  authDomain: "ai-job-copilot-c21bd.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "ai-job-copilot-c21bd",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "ai-job-copilot-c21bd.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "437942984861",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:437942984861:web:b6e47bf2abca2a169bb474"
};

// Initialize Firebase (Singleton pattern for Next.js SSR)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

export default app;
