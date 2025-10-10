import { useEffect, useState, useRef } from 'react';
import { ref, onValue, update, get, remove } from 'firebase/database';
import { db } from '../../../shared/firebase/firebase.js';
import { useGame } from '../hooks/useGame.js';

export function useFirebaseRanking(roundId) {
  const { nickname, points } = useGame();
  const [ranking, setRanking] = useState([]);
  const playerKeyRef = useRef(null);

  // Removido reset automático de pontos ao detectar nova rodada.
  useEffect(() => {
    if (nickname && playerKeyRef.current && typeof roundId !== 'undefined') {
      const nickKey = typeof nickname === 'object' && nickname !== null ? nickname.name : nickname;
      const playerId = playerKeyRef.current;
      const playerRef = ref(db, `salaAtual/jogadores/${playerId}`);
      get(playerRef).then(snapshot => {
        const player = snapshot.val();
      });
    }
  }, [roundId]);

  // Calcula e armazena o playerKey de forma síncrona
  useEffect(() => {
    if (!nickname) return;
    let nickKey = typeof nickname === 'object' && nickname !== null ? nickname.name : nickname;
    let storedId = localStorage.getItem('playerId_' + nickKey);
    if (!storedId) {
      storedId = nickKey + '_' + Math.random().toString(36).substring(2, 6);
      localStorage.setItem('playerId_' + nickKey, storedId);
    }
    playerKeyRef.current = storedId;
  }, [nickname]);

  // Sempre que montar, NÃO remova duplicados do mesmo nickname no Firebase
  // Apenas registra o player normalmente, não exclua outros jogadores
  // useEffect(() => {
  //   if (!nickname || !playerKeyRef.current) return;
  //   let nickKey = typeof nickname === 'object' && nickname !== null ? nickname.name : nickname;
  //   const jogadoresRef = ref(db, 'salaAtual/jogadores');
  //   get(jogadoresRef).then(snapshot => {
  //     const data = snapshot.val() || {};
  //     // Se houver MAIS de um registro do mesmo nickname, mantenha SOMENTE o de maior pontuação (ou o mais recente)
  //     const sameNick = Object.entries(data).filter(([_, value]) => {
  //       if (typeof value.nickname === 'object' && value.nickname !== null) {
  //         return value.nickname.name === nickKey;
  //       }
  //       return value.nickname === nickKey;
  //     });
  //     if (sameNick.length > 1) {
  //       // Ordena por pontos decrescente, depois criado mais recentemente
  //       sameNick.sort((a, b) => b[1].points - a[1].points || b[1].createdAt - a[1].createdAt);
  //       // Mantém só o primeiro (melhor)
  //       const [keepId] = sameNick[0];
  //       sameNick.slice(1).forEach(([id]) => {
  //         remove(ref(db, `salaAtual/jogadores/${id}`));
  //       });
  //       // Atualiza o playerKeyRef se necessário
  //       if (playerKeyRef.current !== keepId) {
  //         localStorage.setItem('playerId_' + nickKey, keepId);
  //         playerKeyRef.current = keepId;
  //       }
  //     }
  //   });
  // }, [nickname, playerKeyRef.current]);

  // Persistência explícita dos pontos no ranking (chamar manualmente na FinalRankingPage)
  const persistPlayerScore = async () => {
    if (!nickname || !playerKeyRef.current) return;
    let nickKey = typeof nickname === 'object' && nickname !== null ? nickname.name : nickname;
    const storedId = playerKeyRef.current;
    const playerRef = ref(db, `salaAtual/jogadores/${storedId}`);
    let safeNickname = nickname;
    if (!safeNickname || (typeof safeNickname === 'string' && safeNickname.trim() === '')) {
      safeNickname = 'Jogador';
    }
    
    // Busca os pontos mais recentes (localStorage ou contexto)
    let currentPoints = 0;
    if (typeof points === 'number' && !isNaN(points)) {
      currentPoints = points;
    } else {
      const storedPts = localStorage.getItem('points_' + nickKey);
      if (storedPts && !isNaN(Number(storedPts))) {
        currentPoints = Number(storedPts);
      }
    }
    
    // Busca os pontos atuais no Firebase
    const snap = await get(playerRef);
    const currentData = snap.val();
    const firebasePoints = currentData?.points || 0;
    
    // Usa o maior valor entre local e Firebase
    const finalPoints = Math.max(currentPoints, firebasePoints);
    
    // Atualiza tanto o Firebase quanto o localStorage
    await update(playerRef, {
      nickname: safeNickname,
      points: finalPoints,
      createdAt: Date.now(),
      lastActive: Date.now()
    });
    
    // Atualiza o localStorage
    localStorage.setItem('points_' + nickKey, finalPoints);
    
    // Atualiza o contexto se necessário
    if (typeof window !== 'undefined' && window.setPoints) {
      window.setPoints(finalPoints);
    }
  };

  // Registra jogador no ranking ao entrar na sala (nickname e pontos locais), mas só se ainda não existir
  const registerPlayerInRanking = async (customPoints) => {
    if (!nickname) return;
    let nickKey = typeof nickname === 'object' && nickname !== null ? nickname.name : nickname;
    let playerId = localStorage.getItem('playerId_' + nickKey);
    if (!playerId) {
      playerId = nickKey + '_' + Math.random().toString(36).substring(2, 6);
      localStorage.setItem('playerId_' + nickKey, playerId);
    }
    playerKeyRef.current = playerId;
    const playerRef = ref(db, `salaAtual/jogadores/${playerId}`);
    let safeNickname = nickname;
    if (!safeNickname || (typeof safeNickname === 'string' && safeNickname.trim() === '')) {
      safeNickname = 'Jogador';
    }
    // Sempre registra/atualiza o jogador no ranking (nickname, pontos, timestamps)
    await update(playerRef, {
      nickname: safeNickname,
      points: typeof customPoints === 'number' ? customPoints : 0,
      createdAt: Date.now(),
      lastActive: Date.now(),
      roundId: roundId || 0
    });
    // Marca que o jogador entrou na rodada
    localStorage.setItem('entrouNaRodada', 'true');
  };


  // --- PATCH: Ranking só da rodada atual ---
  useEffect(() => {
    const jogadoresRef = ref(db, 'salaAtual/jogadores');
    const unsubscribe = onValue(jogadoresRef, (snapshot) => {
      const data = snapshot.val() || {};
      const now = Date.now();
      const INACTIVITY_THRESHOLD = 180000; // 3 minutos
      // Filtra jogadores ativos (última atividade nos últimos 30 segundos)
      const ativos = Object.entries(data).filter(([_, player]) => {
        if (!player) return false;
        return (now - (player.lastActive || 0)) < INACTIVITY_THRESHOLD;
      });
      // NÃO filtra por roundId, mostra todos os ativos
      let rankingFiltrado = ativos;
      // Agrupa por nickname (string ou .name)
      const byNick = {};
      rankingFiltrado.forEach(([id, value]) => {
        let nick = value.nickname;
        if (typeof nick === 'object' && nick !== null) nick = nick.name;
        if (!byNick[nick]) byNick[nick] = [];
        byNick[nick].push({ ...value, id });
      });
      // Para cada nickname, mantém só o de maior pontuação (ou mais recente)
      const uniqueList = Object.values(byNick).map(arr => {
        arr.sort((a, b) => b.points - a.points || b.createdAt - a.createdAt);
        return arr[0];
      });
      uniqueList.sort((a, b) => b.points - a.points || a.createdAt - b.createdAt);
      setRanking(prev => (uniqueList.length === 0 || JSON.stringify(prev) === JSON.stringify(uniqueList)) ? prev : uniqueList);
    });
    return () => unsubscribe();
  }, []);

  // Função para remover explicitamente o player do ranking
  const removePlayerFromRanking = async () => {
    try {
      if (playerKeyRef.current) {
        await remove(ref(db, `salaAtual/jogadores/${playerKeyRef.current}`));
      }
    } catch (err) {

    }
  };

  // Remove jogador do ranking ao fechar aba ou sair da página
  useEffect(() => {
    const handleUnload = async () => {
      if (playerKeyRef.current) {
        try {
          await remove(ref(db, `salaAtual/jogadores/${playerKeyRef.current}`));
        } catch (err) {
          // Silencie erros de remoção
        }
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('unload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('unload', handleUnload);
    };
  }, []);

  return {
    ranking,
    playerKey: playerKeyRef.current,
    removePlayerFromRanking,
    persistPlayerScore,
    registerPlayerInRanking,
  };
}
