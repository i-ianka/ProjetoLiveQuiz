import { createContext, useContext, useState, useEffect } from 'react';
import { ref, onValue, update, set, get } from 'firebase/database';
import { db } from '../services/firebase';

const GameContext = createContext();

export function GameProvider({ children }) {
  // Exponha setPoints no window para permitir reset dinâmico da pontuação
  if (typeof window !== 'undefined') {
    window.setPoints = (value) => setPoints(value);
  }

  const [nickname, setNickname] = useState(() => {
    // Tenta restaurar nickname e avatar do localStorage para persistência entre rodadas
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
  // Inicializa pontos: tenta restaurar do localStorage, se não existir, começa com 0
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
  

  // Sempre que pontos ou nickname mudarem, salva pontos no localStorage
  useEffect(() => {
    if (nickname && points !== null) {
      // Salva pontos usando apenas o nome para chave
      const nickKey = typeof nickname === 'object' && nickname !== null ? nickname.name : nickname;
      localStorage.setItem('points_' + nickKey, points);
    }
  }, [points, nickname]);

  // Função correta: atualiza pontos no local e no Firebase
  const addPoints = (value) => {
    setPoints((prev) => {
      if (prev === null) return prev; // Não faz nada se ainda não sincronizou
      const newPoints = prev + value;
      
      // Salva imediatamente no localStorage
      const nickKey = typeof nickname === 'object' && nickname !== null ? nickname.name : nickname;
      localStorage.setItem('points_' + nickKey, newPoints);
      
      // Atualiza no Firebase
      if (nickname) {
        const playerId = localStorage.getItem('playerId_' + nickKey);
        if (playerId) {
          const playerRef = ref(db, `salaAtual/jogadores/${playerId}`);

          update(playerRef, { 
            points: newPoints,
            lastActive: Date.now()
          });
        }
      }
      
      return newPoints;
    });
  };

  // Efeito para sincronizar pontos do localStorage ao montar
  useEffect(() => {
    if (nickname) {
      const nickKey = typeof nickname === 'object' && nickname !== null ? nickname.name : nickname;
      const storedPoints = localStorage.getItem('points_' + nickKey);
      if (storedPoints && !isNaN(Number(storedPoints))) {
        setPoints(Number(storedPoints));
      }
    }
  }, [nickname]);

  // Efeito para salvar pontos no localStorage sempre que mudarem
  useEffect(() => {
    if (nickname && points !== null) {
      const nickKey = typeof nickname === 'object' && nickname !== null ? nickname.name : nickname;
      localStorage.setItem('points_' + nickKey, points);
    }
  }, [points, nickname]);

  const nextSong = () => setCurrentSongIndex((prev) => prev + 1);

  useEffect(() => {
    if (nickname) {
      // Salva nickname e avatar no localStorage
      if (typeof nickname === 'object' && nickname !== null) {
        localStorage.setItem('nickname', nickname.name);
        localStorage.setItem('avatar', JSON.stringify(nickname.avatar));
      } else {
        localStorage.setItem('nickname', nickname);
        localStorage.removeItem('avatar');
      }
    }
    // Corrige bug de CSS sumindo: força reload de CSS ao mudar nickname
    const cssIds = ['login-css', 'final-ranking-css'];
    cssIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.href = el.href;
      }
    });
  }, [nickname]);

  // Cadastro do jogador (garante playerId no localStorage SEM remover outros jogadores)
  useEffect(() => {
    if (!nickname) return;
    // Só registra no ranking se o usuário já entrou na rodada (ex: flag no localStorage)
    const entrouNaRodada = localStorage.getItem('entrouNaRodada') === 'true';
    if (!entrouNaRodada) return;
    let nickKey = typeof nickname === 'object' && nickname !== null ? nickname.name : nickname;
    let playerId = localStorage.getItem('playerId_' + nickKey);
    // Se não existe um playerId para esse nick, cria um novo
    if (!playerId) {
      playerId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      localStorage.setItem('playerId_' + nickKey, playerId);
    }
    // Sempre registra/atualiza o jogador no Firebase, sem remover outros
    const playerRef = ref(db, `salaAtual/jogadores/${playerId}`);
    set(playerRef, { nickname, points: points ?? 0, createdAt: Date.now() });
  }, [nickname]);

  // Sincroniza pontos do Firebase ao entrar na sala (apenas uma vez)
  useEffect(() => {
    if (!nickname) return;
    const nickKey = typeof nickname === 'object' && nickname !== null ? nickname.name : nickname;
    const playerId = localStorage.getItem('playerId_' + nickKey);
    if (!playerId) return;

    // Carrega pontos do localStorage
    const localPoints = localStorage.getItem('points_' + nickKey);
    let maxPoints = 0;
    if (localPoints && !isNaN(Number(localPoints))) {
      maxPoints = Number(localPoints);
    }

    // Depois sincroniza com o Firebase e usa o maior valor
    const playerRef = ref(db, `salaAtual/jogadores/${playerId}`);
    get(playerRef).then(snapshot => {
      const data = snapshot.val();
      if (data && typeof data.points === 'number') {
        if (data.points > maxPoints) {
          maxPoints = data.points;
        }
      }
      setPoints(maxPoints);
      localStorage.setItem('points_' + nickKey, maxPoints);
    });
  }, [nickname]);

  useEffect(() => {

  }, []);

  const resetGame = (preserveNickname = false) => {
    if (!preserveNickname) {
      setNickname('');
      localStorage.removeItem('nickname');
      localStorage.removeItem('avatar');
      // Remover também o playerId do localStorage para forçar novo id ao sair
      const keys = Object.keys(localStorage).filter(k => k.startsWith('playerId_'));
      keys.forEach(k => localStorage.removeItem(k));
      // Só zere pontos se for logout
      setPoints(0);
      const nickKey = typeof nickname === 'object' && nickname !== null ? nickname.name : nickname;
      if (nickKey) localStorage.setItem('points_' + nickKey, 0);
    }
    // Se for jogar novamente, NÃO zere pontos!
    setCurrentSongIndex(0);
    setPreviousSongs([]);
    setHasSavedHistory(false);
  };

  return (
    <GameContext.Provider
      value={{
        nickname,
        setNickname,
        points,
        addPoints,
        currentSongIndex,
        nextSong,
        previousSongs,
        setPreviousSongs,
        resetGame,
        hasSavedHistory,
        setHasSavedHistory,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  return useContext(GameContext);
}
