// servidor-backend/src/firebase-proxy.js
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, update, set } from 'firebase/database';
import { firebaseConfig } from '../shared/firebase/firebase.js'; // 


// Inicializa Firebase no backend
const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

// Reexporta funções do database que você usa
export { ref, get, update, set };
