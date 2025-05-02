import { useEffect, useState, useRef } from 'react';
import { ref, onValue, update, get, remove } from 'firebase/database';
import { db } from '../services/firebase.js';
import { useGame } from '../hooks/useGame.js';

export function useFirebaseRanking(_roundId) {
  const { nickname, points } = useGame();
  const [ranking, setRanking] = useState([]);
  const playerKeyRef = useRef(null);

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

  // Registra jogador no ranking ao entrar na sala (nickname e pontos zerados)
  const registerPlayerInRanking = async (customPoints) => {
    if (!nickname || !playerKeyRef.current) return;
    let nickKey = typeof nickname === 'object' && nickname !== null ? nickname.name : nickname;
    const storedId = playerKeyRef.current;
    const playerRef = ref(db, `salaAtual/jogadores/${storedId}`);
    let safeNickname = nickname;
    if (!safeNickname || (typeof safeNickname === 'string' && safeNickname.trim() === '')) {
      safeNickname = 'Jogador';
    }
    
    // Sempre registra com pontos zerados ao entrar na sala
    const currentPoints = 0;
    
    // Sempre registra/atualiza o jogador no ranking com pontos zerados
    await update(playerRef, {
      nickname: safeNickname,
      points: currentPoints,
      createdAt: Date.now(),
      lastActive: Date.now()
    });
    
    // Atualiza o contexto para garantir que os pontos estejam zerados
    if (typeof window !== 'undefined' && window.setPoints) {
      window.setPoints(0);
    }
    
    // Atualiza o localStorage também
    localStorage.setItem('points_' + nickKey, 0);
    
    // Marca que o jogador entrou na rodada
    localStorage.setItem('entrouNaRodada', 'true');
  };

  // --- PATCH: Remover duplicatas de nickname no ranking ---
  useEffect(() => {
    const jogadoresRef = ref(db, 'salaAtual/jogadores');
    const unsubscribe = onValue(jogadoresRef, (snapshot) => {
      const data = snapshot.val() || {};
      // Agrupa por nickname (string ou .name)
      const byNick = {};
      Object.entries(data).forEach(([id, value]) => {
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
      setRanking(uniqueList);
    });
    return () => unsubscribe();
  }, []);

  // Função para remover explicitamente o player do ranking
  const removePlayerFromRanking = async (playerToRemove = null) => {
    try {
      const playerIdToRemove = playerToRemove || playerKeyRef.current;
      
      // Verificação de segurança - retorna se não tiver jogador para remover
      if (!playerIdToRemove) {
        return false;
      }
      
      // Se for um objeto com propriedade name, usa essa propriedade
      const playerKey = typeof playerIdToRemove === 'object' && playerIdToRemove !== null ? 
        (playerIdToRemove.name || '') : playerIdToRemove;
      
      // Só continua se tivermos uma chave válida
      if (!playerKey || typeof playerKey !== 'string') {
        return false;
      }
      
      // Remove o jogador do Firebase
      const jogadorRef = ref(db, `salaAtual/jogadores/${playerKey}`);
      await remove(jogadorRef);
      return true;
    } catch (err) {
      return false;
    }
  };

  // Remove jogador do ranking ao fechar aba ou sair da página, MAS APENAS se estiver na tela LiveRanking (não na FinalRanking)
  useEffect(() => {
    const handleUnload = async () => {
      // Só remove se não está na tela de FinalRanking (partida não foi finalizada)
      const emFinalRanking = localStorage.getItem('finalRankingTimeout') === '1';
      const concluiuPartida = localStorage.getItem('partidaConcluida') === 'true';
      
      if (playerKeyRef.current && !emFinalRanking && !concluiuPartida) {
        try {
          await remove(ref(db, `salaAtual/jogadores/${playerKeyRef.current}`));
        } catch (err) {
          // Silencie erros de remoção
        }
      }
    };
    
    // Também adiciona um evento de visibilidade para detectar quando a aba é ocultada (não apenas fechada)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Armazena timestamp quando a aba foi ocultada, para remover após timeout
        localStorage.setItem('liveRankingTabHidden', Date.now().toString());
      } else if (document.visibilityState === 'visible') {
        // Limpa o timestamp quando a aba é reaberta
        localStorage.removeItem('liveRankingTabHidden');
      }
    };
    
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('unload', handleUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Timer para verificar se a aba está oculta por tempo suficiente para considerar abandono
    const intervalId = setInterval(() => {
      const hiddenTime = localStorage.getItem('liveRankingTabHidden');
      if (hiddenTime && playerKeyRef.current) {
        const elapsed = Date.now() - parseInt(hiddenTime, 10);
        // Se a aba estiver oculta por mais de 30 segundos, remove o jogador (30s = 30000ms)
        if (elapsed > 30000) {
          const emFinalRanking = localStorage.getItem('finalRankingTimeout') === '1';
          const concluiuPartida = localStorage.getItem('partidaConcluida') === 'true';
          
          if (!emFinalRanking && !concluiuPartida) {
            remove(ref(db, `salaAtual/jogadores/${playerKeyRef.current}`));
            localStorage.removeItem('liveRankingTabHidden'); // Evita remoções repetidas
          }
        }
      }
    }, 5000); // Verifica a cada 5 segundos
    
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('unload', handleUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(intervalId);
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
