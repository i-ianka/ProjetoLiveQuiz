// GameContext.jsx atualizado com roundId sincronizado com currentSongIndex e resetGame limpando localStorage
import { createContext, useContext, useState, useEffect } from 'react';
import { ref, onValue, update, set, get } from 'firebase/database';
import { db } from '../../../shared/firebase/firebase';

const GameContext = createContext();

export function GameProvider({ children }) {
  const [nickname, setNickname] = useState(() => {
    const storedName = localStorage.getItem('nickname');
    const storedAvatar = localStorage.getItem('avatar');
    if (storedName && storedAvatar) {
      try {
        return { name: storedName, avatar: JSON.parse(storedAvatar) };
      } catch {
        return storedName;
      }
    }
    return storedName || '';
  });

  const [points, setPoints] = useState(() => {
    const storedNickname = localStorage.getItem('nickname');
    if (storedNickname) {
      const storedPoints = localStorage.getItem('points_' + storedNickname);
      return storedPoints !== null ? Number(storedPoints) : 0;
    }
    return 0;
  });

  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const [previousSongs, setPreviousSongs] = useState([]);
  const [hasSavedHistory, setHasSavedHistory] = useState(false);
  const [roundId, setRoundId] = useState(0);
  useEffect(() => {
    // roundId mudou
  }, [roundId]);

  useEffect(() => {
    // setRoundId será controlado externamente (por GamePage) usando musicStartTimestamp.
    // Removido reset automático de pontos aqui. O reset será controlado pelo backend ou por lógica dedicada.
  }, [currentSongIndex, nickname]);

  useEffect(() => {
    if (nickname && points !== null) {
      const nickKey = typeof nickname === 'object' && nickname !== null ? nickname.name : nickname;
      localStorage.setItem('points_' + nickKey, points);
    }
  }, [points, nickname]);

  // Função central para resetar pontos em todos os lugares
  const resetPointsEverywhere = () => {
    setPoints(0);
    const nickKey = typeof nickname === 'object' && nickname !== null ? nickname.name : nickname;
    localStorage.setItem('points_' + nickKey, 0);
    const playerId = localStorage.getItem('playerId_' + nickKey);
    if (playerId) {
      const playerRef = ref(db, `salaAtual/jogadores/${playerId}`);
      update(playerRef, { points: 0, roundId }); // Atualiza também o roundId!
    }
  };
  // Removido reset automático ao mudar roundId. Use resetPointsEverywhere() manualmente no fluxo de nova rodada.

  const addPoints = (value) => {
    setPoints((prev) => {
      if (prev === null) return prev;
      const newPoints = prev + value;
      const nickKey = typeof nickname === 'object' && nickname !== null ? nickname.name : nickname;
      localStorage.setItem('points_' + nickKey, newPoints);

      if (nickname) {
        let playerId = localStorage.getItem('playerId_' + nickKey);
        if (!playerId) {
          playerId = nickKey + '_' + Math.random().toString(36).substring(2, 6);
          localStorage.setItem('playerId_' + nickKey, playerId);
        }
        const playerRef = ref(db, `salaAtual/jogadores/${playerId}`);
        update(playerRef, {
          points: newPoints,
          lastActive: Date.now(),
          roundId, // roundId atualizado do contexto
          nickname,
          createdAt: Date.now()
        }).then(() => {
          // Pontuação e dados do jogador atualizados no Firebase
        }).catch(error => {
          console.error('[GameContext] Erro ao atualizar pontuação no Firebase:', error);
        });
      } else {
        // Aviso: nickname não definido ao tentar adicionar pontos
      }
      return newPoints;
    });
  };

  const resetGame = () => {
    setPoints(0);
    setCurrentSongIndex(0);
    setPreviousSongs([]);
    setHasSavedHistory(false);
    setRoundId(0);
    localStorage.clear();
  };

  useEffect(() => {
    if (nickname) {
      const nickKey = typeof nickname === 'object' && nickname !== null ? nickname.name : nickname;
      const storedPoints = localStorage.getItem('points_' + nickKey);
      if (storedPoints !== null) {
        setPoints(Number(storedPoints));
      }
    }
  }, [nickname]);

  return (
    <GameContext.Provider value={{
      nickname,
      setNickname,
      points,
      setPoints,
      addPoints,
      resetGame,
      currentSongIndex,
      setCurrentSongIndex,
      previousSongs,
      setPreviousSongs,
      hasSavedHistory,
      setHasSavedHistory,
      roundId,
      setRoundId
    }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  return useContext(GameContext);
}
export { GameContext };