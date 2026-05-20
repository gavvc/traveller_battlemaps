/**
 * GeomorphForge — Firebase Integration Utility
 * Handles authentication and Firestore document synchronization.
 */
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';

import { getAnalytics, logEvent } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyAPlPo6bMwAsy8CrBNVVtINIMOhQyjHf1I",
  authDomain: "geomorphs-ed6a8.firebaseapp.com",
  projectId: "geomorphs-ed6a8",
  storageBucket: "geomorphs-ed6a8.firebasestorage.app",
  messagingSenderId: "72301678184",
  appId: "1:72301678184:web:a5ae52ec26505e88d6b5dd",
  measurementId: "G-79TMZZC48J"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Safe Analytics Initialization for SPA environments
let analytics = null;
if (typeof window !== 'undefined') {
  try {
    analytics = getAnalytics(app);
  } catch (err) {
    console.warn('Google Analytics failed to initialize:', err);
  }
}

/**
 * Custom telemetry helper to log user actions to GA4 dashboard.
 */
export function logAnalyticsEvent(eventName, params = {}) {
  if (analytics) {
    try {
      logEvent(analytics, eventName, params);
    } catch (err) {
      console.error('Telemetry logging failed:', err);
    }
  }
}

// ── Authentication API ────────────────────────────────────────────────────────
export function registerUser(email, password) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export function loginUser(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function logoutUser() {
  return signOut(auth);
}

export function subscribeToAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

// ── Firestore Sync API ────────────────────────────────────────────────────────

/**
 * Saves a map document to Firestore.
 */
export async function syncMapToCloud(mapData, ownerId) {
  if (!ownerId) return null;
  const docRef = doc(db, 'maps', mapData.id);
  const cloudData = {
    ...mapData,
    ownerId,
    updatedAt: new Date().toISOString(),
  };
  
  // Make sure objects is serialized as a string or a clean array
  if (cloudData.objects && typeof cloudData.objects !== 'string') {
    cloudData.objects = JSON.stringify(cloudData.objects);
  }
  
  await setDoc(docRef, cloudData, { merge: true });
  return cloudData;
}

/**
 * Loads all maps belonging to the specified ownerId.
 */
export async function fetchCloudMaps(ownerId) {
  if (!ownerId) return [];
  const q = query(collection(db, 'maps'), where('ownerId', '==', ownerId));
  const querySnapshot = await getDocs(q);
  const maps = [];
  querySnapshot.forEach((doc) => {
    const data = doc.data();
    // Parse objects string back into array if serialized
    if (data.objects && typeof data.objects === 'string') {
      try {
        data.objects = JSON.parse(data.objects);
      } catch (e) {
        console.error('Failed to parse map objects:', e);
      }
    }
    maps.push(data);
  });
  return maps.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

/**
 * Deletes a map document from Firestore.
 */
export async function deleteCloudMap(mapId) {
  const docRef = doc(db, 'maps', mapId);
  await deleteDoc(docRef);
}
