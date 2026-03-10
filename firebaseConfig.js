import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyCbi7epi0u6ak51apfje4rbYsP3cE5TuKw",
  authDomain: "tsedeyapp.firebaseapp.com",
  projectId: "tsedeyapp",
  storageBucket: "tsedeyapp.appspot.com",
  messagingSenderId: "261891373669",
  appId: "1:261891373669:web:e15ce0b9255f7605f8648c",
  measurementId: "G-1D4L89CLKK",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// ✅ initialize auth with RN persistence (and fallback if already initialized)
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage),
  });
} catch (e) {
  auth = getAuth(app);
}

export { app, auth };
export const db = getFirestore(app);
export const storage = getStorage(app); // ✅ use default bucket (tsedeyapp.appspot.com)
