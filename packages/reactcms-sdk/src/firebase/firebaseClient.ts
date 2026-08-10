import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { forceWebSockets, getDatabase, Database } from 'firebase/database';

let firebaseApp: FirebaseApp | null = null;
let firebaseDatabase: Database | null = null;
let firebaseTransportConfigured = false;

// Default config matching the dashboard's project structure
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDX2mOPJqAUguPJNPGj9sxEVVr1dA1_8CQ",
  authDomain: "react-cms-pro.firebaseapp.com",
  projectId: "react-cms-pro",
  databaseURL: "https://react-cms-pro-default-rtdb.firebaseio.com"
};

export function getFirebaseApp(apiKey?: string): FirebaseApp {
  if (firebaseApp) return firebaseApp;

  const apps = getApps();
  if (apps.length > 0) {
    firebaseApp = apps[0];
    return firebaseApp;
  }

  const config = {
    ...DEFAULT_FIREBASE_CONFIG,
    ...(apiKey ? { apiKey } : {})
  };

  firebaseApp = initializeApp(config, 'reactcms-sdk-app');
  return firebaseApp;
}

export function getFirebaseDatabase(apiKey?: string): Database {
  if (firebaseDatabase) return firebaseDatabase;

  if (!firebaseTransportConfigured) {
    // Firebase's long-poll fallback creates and reads a nested iframe. That is
    // forbidden in ReactCMS's intentionally opaque live-preview sandbox.
    // WebSockets avoid cross-frame DOM access and are the primary RTDB transport.
    forceWebSockets();
    firebaseTransportConfigured = true;
  }
  const app = getFirebaseApp(apiKey);
  firebaseDatabase = getDatabase(app);
  return firebaseDatabase;
}
