import { ref, get, set, update, onValue } from 'firebase/database';
import { db } from './firebase';

const SALA_REF = ref(db, 'salaAtual');

// Tempo de delay real (ex: 10s) entre rodadas
export const DELAY_ENTRE_RODADAS = 20000; // 20 segundos

// Função utilitária para embaralhar array
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// --- PATCH: Nunca permita nextRoundStart no passado ---
function getNextRoundStartFuturo(sugestaoTimestamp = null) {
  const now = Date.now();
  if (!sugestaoTimestamp || sugestaoTimestamp < now + 5000) {
    // Sempre agende para pelo menos 20s à frente
    return now + DELAY_ENTRE_RODADAS;
  }
  return sugestaoTimestamp;
}

// Ajuste: ao INICIAR uma nova rodada, já define nextRoundStart para o tempo total da rodada + delay
export async function iniciarSalaSeNaoExistir(playlist) {
  const snapshot = await get(SALA_REF);
  if (!snapshot.exists()) {
    console.log('Iniciando nova sala...');
    
    // Recupera o histórico de músicas das últimas rodadas
    let historicoMúsicas = new Set();
    try {
      const salaSnap = await get(SALA_REF);
      if (salaSnap.exists()) {
        // Coleta músicas das últimas 3 rodadas
        for (let i = 0; i < 3; i++) {
          const refHistorico = ref(db, `historicoMúsicas/${i}`);
          const snap = await get(refHistorico);
          if (snap.exists()) {
            const ids = snap.val();
            if (Array.isArray(ids)) {
              ids.forEach(id => historicoMúsicas.add(id));
              console.log(`Historico ${i}: ${ids.length} músicas`);
            }
          }
        }
      }
    } catch (error) {
      console.error('Erro ao recuperar histórico de músicas:', error);
    }

    // Filtra músicas para evitar repetições
    const shuffled = shuffleArray([...playlist]);
    const validTracks = shuffled.filter(track => 
      track.preview && !historicoMúsicas.has(track.id)
    );
    console.log(`Músicas disponíveis: ${validTracks.length} de ${shuffled.length} total`);

    // Se não tivermos músicas suficientes, embaralhamos novamente
    let finalTracks = [];
    while (finalTracks.length < 15 && shuffled.length > 0) {
      const track = shuffled.pop();
      if (track.preview && !historicoMúsicas.has(track.id)) {
        finalTracks.push(track);
        historicoMúsicas.add(track.id);
      }
    }
    console.log(`Músicas selecionadas (únicas): ${finalTracks.length}`);

    // Completa com músicas aleatórias se necessário
    while (finalTracks.length < 15 && shuffled.length > 0) {
      const track = shuffled.pop();
      if (track.preview) {
        finalTracks.push(track);
      }
    }
    console.log(`Músicas selecionadas (total): ${finalTracks.length}`);

    // Se ainda não tivermos 15 músicas, usa as primeiras disponíveis
    if (finalTracks.length < 15) {
      finalTracks = finalTracks.concat(shuffled.slice(0, 15 - finalTracks.length));
      console.log(`Completando com músicas restantes: ${finalTracks.length} total`);
    }

    const now = Date.now();
    const ROUND_DURATION_MS = finalTracks.length * 20 * 1000; // 20s por música
    const nextRoundStart = getNextRoundStartFuturo(now + ROUND_DURATION_MS + DELAY_ENTRE_RODADAS);
    console.log(`Próxima rodada: ${new Date(nextRoundStart).toLocaleString()}`);

    // Atualiza o histórico de músicas
    const novaPlaylistIds = finalTracks.map(m => m.id);
    await set(ref(db, 'historicoMúsicas/0'), novaPlaylistIds);
    console.log(`Atualizando histórico com ${novaPlaylistIds.length} músicas`);
    
    await set(SALA_REF, {
      playlist: finalTracks,
      musicaAtual: 0,
      nextRoundStart,
      musicStartTimestamp: null,
      ultimaPlaylist: novaPlaylistIds
    });
    console.log('Sala iniciada com sucesso');
  }
}

export async function getSalaAtual() {
  const snapshot = await get(SALA_REF);
  return snapshot.val();
}

export function ouvirSala(callback) {
  return onValue(SALA_REF, (snapshot) => {
    const sala = snapshot.val();
    if (sala) {
      callback(sala);
    }
  });
}

// Ajuste: ao avançar para a primeira música de uma nova rodada, calcula nextRoundStart corretamente
export async function avancarMusica(indice) {
  const salaSnap = await get(SALA_REF);
  if (!salaSnap) return;
  const sala = salaSnap.val();
  if (indice > sala.playlist.length) {
    return;
  }
  const updates = { musicaAtual: indice };
  if (indice === 0) {
    // Nova rodada: calcula nextRoundStart para o tempo total da rodada + delay
    const ROUND_DURATION_MS = sala.playlist.length * 20 * 1000;
    // Só o backend automático deve iniciar a música. Aqui deixamos como null.
    updates.musicStartTimestamp = null;
    updates.nextRoundStart = getNextRoundStartFuturo(Date.now() + ROUND_DURATION_MS + DELAY_ENTRE_RODADAS);
  } else if (indice < sala.playlist.length) {
    // Só atualiza musicStartTimestamp se musicaAtual realmente mudou ou se o timestamp está nulo
    if (sala.musicaAtual !== indice || !sala.musicStartTimestamp) {
      updates.musicStartTimestamp = Date.now() + 500; // Adiciona 0.5s para compensar atraso de propagação
    } else {
      // Não atualiza para evitar múltiplos resets
      updates.musicStartTimestamp = sala.musicStartTimestamp;
    }
    // NÃO atualize nextRoundStart durante a execução das músicas!
    // updates.nextRoundStart = getNextRoundStartFuturo(sala.nextRoundStart);
  } else {
    // Fim da rodada: agenda próximo round para daqui a DELAY_ENTRE_RODADAS
    updates.musicStartTimestamp = null;
    updates.nextRoundStart = getNextRoundStartFuturo(Date.now() + DELAY_ENTRE_RODADAS);
  }
  await update(SALA_REF, updates);
}

// --- PATCH: Nunca remova nextRoundStart ao reiniciar sala, sempre set válido ---
export async function reiniciarSala(playlist) {
  console.log('Reiniciando sala...');
  
  // Recupera o histórico de músicas das últimas rodadas
  let historicoMúsicas = new Set();
  try {
    // Coleta músicas das últimas 3 rodadas
    for (let i = 0; i < 3; i++) {
      const refHistorico = ref(db, `historicoMúsicas/${i}`);
      const snap = await get(refHistorico);
      if (snap.exists()) {
        const ids = snap.val();
        if (Array.isArray(ids)) {
          ids.forEach(id => historicoMúsicas.add(id));
          console.log(`Historico ${i}: ${ids.length} músicas`);
        }
      }
    }
  } catch (error) {
    console.error('Erro ao recuperar histórico de músicas:', error);
  }

  // Filtra músicas para evitar repetições
  const shuffled = shuffleArray([...playlist]);
  const validTracks = shuffled.filter(track => 
    track.preview && !historicoMúsicas.has(track.id)
  );
  console.log(`Músicas disponíveis: ${validTracks.length} de ${shuffled.length} total`);

  // Se não tivermos músicas suficientes, embaralhamos novamente
  let finalTracks = [];
  while (finalTracks.length < 15 && shuffled.length > 0) {
    const track = shuffled.pop();
    if (track.preview && !historicoMúsicas.has(track.id)) {
      finalTracks.push(track);
      historicoMúsicas.add(track.id);
    }
  }
  console.log(`Músicas selecionadas (únicas): ${finalTracks.length}`);

  // Completa com músicas aleatórias se necessário
  while (finalTracks.length < 15 && shuffled.length > 0) {
    const track = shuffled.pop();
    if (track.preview) {
      finalTracks.push(track);
    }
  }
  console.log(`Músicas selecionadas (total): ${finalTracks.length}`);

  // Se ainda não tivermos 15 músicas, usa as primeiras disponíveis
  if (finalTracks.length < 15) {
    finalTracks = finalTracks.concat(shuffled.slice(0, 15 - finalTracks.length));
    console.log(`Completando com músicas restantes: ${finalTracks.length} total`);
  }

  const now = Date.now();
  // O próximo round começa após a duração da rodada + delay
  const ROUND_DURATION_MS = finalTracks.length * 20 * 1000; // 20s por música
  const nextRoundStart = getNextRoundStartFuturo(now + ROUND_DURATION_MS + DELAY_ENTRE_RODADAS);
  console.log(`Próxima rodada: ${new Date(nextRoundStart).toLocaleString()}`);

  // Atualiza o histórico de músicas
  const novaPlaylistIds = finalTracks.map(m => m.id);
  await set(ref(db, 'historicoMúsicas/0'), novaPlaylistIds);
  console.log(`Atualizando histórico com ${novaPlaylistIds.length} músicas`);
  
  await update(SALA_REF, {
    playlist: finalTracks,
    musicaAtual: 0,
    nextRoundStart,
    musicStartTimestamp: null,
    ultimaPlaylist: novaPlaylistIds
  });
  console.log('Sala reiniciada com sucesso');
}

export async function reiniciarSalaComLoop(playlist) {
  console.log('Reiniciando sala com loop...');
  
  // Recupera o histórico de músicas das últimas rodadas
  let historicoMúsicas = new Set();
  try {
    // Coleta músicas das últimas 3 rodadas
    for (let i = 0; i < 3; i++) {
      const refHistorico = ref(db, `historicoMúsicas/${i}`);
      const snap = await get(refHistorico);
      if (snap.exists()) {
        const ids = snap.val();
        if (Array.isArray(ids)) {
          ids.forEach(id => historicoMúsicas.add(id));
          console.log(`Historico ${i}: ${ids.length} músicas`);
        }
      }
    }
  } catch (error) {
    console.error('Erro ao recuperar histórico de músicas:', error);
  }

  // Filtra músicas para evitar repetições
  const shuffled = shuffleArray([...playlist]);
  const validTracks = shuffled.filter(track => 
    track.preview && !historicoMúsicas.has(track.id)
  );
  console.log(`Músicas disponíveis: ${validTracks.length} de ${shuffled.length} total`);

  // Se não tivermos músicas suficientes, embaralhamos novamente
  let finalTracks = [];
  while (finalTracks.length < 15 && shuffled.length > 0) {
    const track = shuffled.pop();
    if (track.preview && !historicoMúsicas.has(track.id)) {
      finalTracks.push(track);
      historicoMúsicas.add(track.id);
    }
  }
  console.log(`Músicas selecionadas (únicas): ${finalTracks.length}`);

  // Completa com músicas aleatórias se necessário
  while (finalTracks.length < 15 && shuffled.length > 0) {
    const track = shuffled.pop();
    if (track.preview) {
      finalTracks.push(track);
    }
  }
  console.log(`Músicas selecionadas (total): ${finalTracks.length}`);

  // Se ainda não tivermos 15 músicas, usa as primeiras disponíveis
  if (finalTracks.length < 15) {
    finalTracks = finalTracks.concat(shuffled.slice(0, 15 - finalTracks.length));
    console.log(`Completando com músicas restantes: ${finalTracks.length} total`);
  }

  const now = Date.now();
  // Corrigido: calcula tempo total da rodada + delay
  const ROUND_DURATION_MS = finalTracks.length * 20 * 1000; // 20s por música
  const nextRoundStart = getNextRoundStartFuturo(now + ROUND_DURATION_MS + DELAY_ENTRE_RODADAS);
  console.log(`Próxima rodada: ${new Date(nextRoundStart).toLocaleString()}`);

  // Atualiza o histórico de músicas
  const novaPlaylistIds = finalTracks.map(m => m.id);
  await set(ref(db, 'historicoMúsicas/0'), novaPlaylistIds);
  console.log(`Atualizando histórico com ${novaPlaylistIds.length} músicas`);
  
  await update(SALA_REF, {
    playlist: finalTracks,
    musicaAtual: 0,
    nextRoundStart,
    musicStartTimestamp: null,
    ultimaPlaylist: finalTracks.map(m => m.id)
  });
}

export async function setNextRoundStart(timestamp) {
  await update(SALA_REF, { nextRoundStart: getNextRoundStartFuturo(timestamp) });
}

export async function liberarLockReinicioRodada() {
  const lockRef = ref(db, 'rodadaReiniciando');
  await set(lockRef, null);
}

// Tenta adquirir o lock para reiniciar a rodada
export async function tentarLockReinicioRodada(timeoutMs = 3000) {
  const lockRef = ref(db, 'rodadaReiniciando');
  const now = Date.now();
  try {
    const snapshot = await get(lockRef);
    if (snapshot.exists()) {
      const data = snapshot.val();
      if (now - data.timestamp > timeoutMs) {
        await set(lockRef, { timestamp: now });
        return true;
      }
      return false;
    } else {
      await set(lockRef, { timestamp: now });
      return true;
    }
  } catch  {
    return false;
  }
}

export async function atualizarTempoRestante() {
  const sala = await getSalaAtual();
  if (!sala || !sala.nextRoundStart) return;
  const now = Date.now();
  const timeLeft = Math.max(0, Math.ceil((sala.nextRoundStart - now) / 1000));
  await update(SALA_REF, { timeLeftToNextRound: timeLeft });
}

// --- PATCH: Garante nextRoundStart válido sempre que a sala for criada ou reiniciada ---
export async function garantirNextRoundStartValido() {
  const salaSnap = await get(SALA_REF);
  const sala = salaSnap.val();
  const now = Date.now();
  // Se nextRoundStart está ausente ou no passado, agenda para daqui a 3 minutos
  if (!sala || !sala.nextRoundStart || sala.nextRoundStart < now) {
    const valor = now + 3 * 60 * 1000; // 3 minutos no futuro

    await update(SALA_REF, {
      nextRoundStart: valor
    });
  }
}
