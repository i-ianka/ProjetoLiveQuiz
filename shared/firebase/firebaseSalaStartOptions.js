// Serviço Firebase dedicado para lógica do StartOptions
import { ref, get, onValue, update } from 'firebase/database';
import { db } from './firebase';

const SALA_REF = ref(db, 'salaAtual');

export async function getSalaAtualStartOptions() {
  const snapshot = await get(SALA_REF);
  return snapshot.val();
}

export function ouvirSalaStartOptions(callback) {
  return onValue(SALA_REF, (snapshot) => {
    const sala = snapshot.val();
    if (sala) {
      callback(sala);
    }
  });
}

export async function updateSalaAtualStartOptions(idx, now, ROUND_DURATION_MS, DELAY_ENTRE_RODADAS, getNextRoundStartFuturo) {
  await update(SALA_REF, {
    musicaAtual: idx + 1,
    musicStartTimestamp: Date.now(),
    nextRoundStart: getNextRoundStartFuturo(now + ROUND_DURATION_MS + DELAY_ENTRE_RODADAS)
  });
}

// (Se precisar de lógica exclusiva para o StartOptions, adicione aqui)
