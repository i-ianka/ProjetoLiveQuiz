import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';


export const firebaseConfig = {
  apiKey: "AIzaSyDFVniK-vRCBySvCBkYKCqC1A7K6NkCy_w",
  authDomain: "finsfly-2d7ab.firebaseapp.com",
  databaseURL: "https://finsfly-2d7ab-default-rtdb.firebaseio.com",
  projectId: "finsfly-2d7ab",
  storageBucket: "finsfly-2d7ab.firebasestorage.app",
  messagingSenderId: "487011494014",
  appId: "1:487011494014:web:e2837c98b621c27ace502f"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
