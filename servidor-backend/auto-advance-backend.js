// Backend ES Module para avanço automático das rodadas/músicas no Firebase
// Rode com: node auto-advance-backend.js

//import { firebaseConfig } from './firebase-proxy.js';
//import { initializeApp } from 'firebase/app';
//import { getDatabase, ref, get, update, set } from 'firebase/database';
import { db, ref, get, update, set } from './firebase-proxy.js';


const SALA_REF = ref(db, 'salaAtual');

// --- Parâmetros ---
const TEMPO_MUSICA = 20; // segundos
const TEMPO_ENTRE_RODADAS = 20; // segundos para próxima rodada

// Função para embaralhar um array
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

async function avancarMusicaBackend() {
  const snap = await get(SALA_REF);
  const sala = snap.val();
  if (!sala || !sala.playlist) return;

  const now = Date.now();
  const idx = sala.musicaAtual || 0;
  let playlist = sala.playlist;
  const musicStart = sala.musicStartTimestamp || null;

  // --- NOVO: Reiniciar sala se passou o nextRoundStart ---13739118261 5207214368
  if (idx >= playlist.length && sala.nextRoundStart && now >= sala.nextRoundStart) {
    const PLAYLIST_ID = sala.playlistId || '13739118261';
  
    try {
      const API_URL = process.env.API_URL || 'https://projetolivequiz.onrender.com'; // http://localhost:3000
const response = await fetch(`${API_URL}/playlist/${PLAYLIST_ID}`);
      const data = await response.json();
  
      if (data && data.tracks && Array.isArray(data.tracks.data)) {
        const novaPlaylist = shuffleArray(data.tracks.data.filter(track => track.preview)).slice(0, 15);
        console.log("[DEBUG] Nova playlist gerada:", novaPlaylist.map(m => m.title + ' - ' + m.artist.name));
  
        await update(SALA_REF, {
          playlist: novaPlaylist,
          musicaAtual: 0,
          round: (typeof sala.round === 'number' ? sala.round : 0) + 1,
          nextRoundStart: null,
          musicStartTimestamp: now
        });
  
        console.log(`[${new Date().toISOString()}] Sala reiniciada com nova playlist.`);
        return; // ← ESSENCIAL: interrompe o loop atual
      } else {
        console.warn("Resposta da API inválida. Mantendo playlist antiga.");
      }
    } catch (err) {
      console.error("Erro ao buscar nova playlist:", err);
    }
  }
  

  // --- Lógica antiga ---
  if (idx >= playlist.length) return;

  // Se não há timestamp, inicializa agora apenas se for a primeira música da rodada
  if (!musicStart && idx === 0) {
    console.log(`[${new Date().toISOString()}] [LOG] musicStartTimestamp será inicializado! idx:`, idx, 'musicStart:', musicStart, 'playlist.length:', playlist.length);
    await update(SALA_REF, {
      musicStartTimestamp: now
    });
    console.log(`[${new Date().toISOString()}] Iniciando música ${idx + 1}`);
    return;
  }

  const elapsed = Math.floor((now - musicStart) / 1000);
  if (elapsed >= TEMPO_MUSICA) {
    if (idx + 1 < playlist.length) {
     
      await update(SALA_REF, {
        musicaAtual: idx + 1,
        musicStartTimestamp: Date.now()
      });
      console.log(`[${new Date().toISOString()}] Avançou para música ${idx + 2}`);
    } else {
      await update(SALA_REF, {
        musicaAtual: playlist.length,
        musicStartTimestamp: null,
        nextRoundStart: now + TEMPO_ENTRE_RODADAS * 1000
      });
      console.log(`[${new Date().toISOString()}] Rodada finalizada. Próxima em ${TEMPO_ENTRE_RODADAS}s.`);
    }
  }
}

// Loop principal
setInterval(() => {
  avancarMusicaBackend().catch(console.error);
}, 1000);

console.log('Backend de avanço automático iniciado!');
