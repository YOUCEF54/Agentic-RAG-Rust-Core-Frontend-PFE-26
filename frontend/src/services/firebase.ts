import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCTL-MOp8q7y51Qkm35u6qV97EFUqj4rYY',
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'ai-rag-assistant-8ad1b.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'ai-rag-assistant-8ad1b',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'ai-rag-assistant-8ad1b.firebasestorage.app',
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '295070404599',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:295070404599:web:360b47e8332e734d9e28f2',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-T81X7J6ECH'
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
