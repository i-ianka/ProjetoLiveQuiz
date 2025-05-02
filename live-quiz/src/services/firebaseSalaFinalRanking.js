// Serviço Firebase dedicado para lógica do FinalRankingPage
import { ref, get, onValue, update } from 'firebase/database';
import { db } from './firebase';

const SALA_REF = ref(db, 'salaAtual');

export async function getSalaAtualFinalRanking() {
  const snapshot = await get(SALA_REF);
  return snapshot.val();
}

export function ouvirSalaFinalRanking(callback) {
  return onValue(SALA_REF, (snapshot) => {
    const sala = snapshot.val();
    if (sala) {
      callback(sala);
    }
  });
}

export async function setNextRoundStartFinalRanking(timestamp) {
  await update(SALA_REF, { nextRoundStart: timestamp });
}

// (Se precisar de lógica exclusiva para o FinalRankingPage, adicione aqui)
