import { useNavigate } from 'react-router-dom';
import { useGame } from '../../hooks/useGame'; // Corrigido para importar roundId
import { useFirebaseRanking } from '../../hooks/useFirebaseRanking';
import { getSalaAtualFinalRanking, ouvirSalaFinalRanking } from '../../../../shared/firebase/firebaseSalaFinalRanking.js';
import { useEffect, useState, useCallback, useRef } from 'react';
import '../FinalRankingPage.css';

// Enum para controlar o estado do jogo
const GameState = {
  LOADING: 'loading',
  COUNTDOWN: 'countdown',
  WAITING: 'waiting',
  ROUND_ACTIVE: 'round_active',
};

export default function FinalRankingPage() {
  const { nickname, points, resetGame, registerPlayerInRanking, resetPointsEverywhere, roundId } = useGame(); // roundId trazido do contexto
  const navigate = useNavigate();
  const { ranking, removePlayerFromRanking, persistPlayerScore } = useFirebaseRanking();

  const roundStartTimeRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const hasRedirectedRef = useRef(false);

  const [gameState, setGameState] = useState(() => {
    const saved = localStorage.getItem('gameState');
    return saved && saved !== 'undefined' ? JSON.parse(saved) : GameState.LOADING;
  });
  const [nextRoundStart, setNextRoundStart] = useState(() => {
    const saved = localStorage.getItem('nextRoundStart');
    return saved && saved !== 'undefined' ? JSON.parse(saved) : null;
  });
  const [lastRoundStart, setLastRoundStart] = useState(() => {
    const saved = localStorage.getItem('lastRoundStart');
    return saved && saved !== 'undefined' ? JSON.parse(saved) : null;
  });
  const [aguardandoNovaRodada, setAguardandoNovaRodada] = useState(() => {
    const saved = localStorage.getItem('aguardandoNovaRodada');
    return saved && saved !== 'undefined' ? JSON.parse(saved) : false;
  });
  const [roundTimeLeft, setRoundTimeLeft] = useState(null);
  const [timerLabel, setTimerLabel] = useState('');
  const [sala, setSala] = useState(null);
  const [showLobby, setShowLobby] = useState(false);

  // Atualização de estado só se diferente para evitar re-render desnecessário
  const safeSetGameState = useCallback(newState => {
    setGameState(prev => (prev !== newState ? newState : prev));
    localStorage.setItem('gameState', JSON.stringify(newState));
  }, []);

  const safeSetNextRoundStart = useCallback(timestamp => {
    setNextRoundStart(prev => (prev !== timestamp ? timestamp : prev));
    localStorage.setItem('nextRoundStart', JSON.stringify(timestamp));
  }, []);

  const safeSetLastRoundStart = useCallback(timestamp => {
    setLastRoundStart(prev => (prev !== timestamp ? timestamp : prev));
    localStorage.setItem('lastRoundStart', JSON.stringify(timestamp));
  }, []);

  const safeSetAguardandoNovaRodada = useCallback(value => {
    setAguardandoNovaRodada(prev => (prev !== value ? value : prev));
    localStorage.setItem('aguardandoNovaRodada', JSON.stringify(value));
  }, []);

  // Listener do Firebase sala atual
  useEffect(() => {
    const fetchSala = async () => {
      const salaAtual = await getSalaAtualFinalRanking();
      if (salaAtual) {
        setSala(salaAtual);
        const lastStart = salaAtual.lastRoundStart || salaAtual.musicStartTimestamp;
        safeSetNextRoundStart(salaAtual.nextRoundStart || null);
        safeSetLastRoundStart(lastStart || null);
      }
    };
    fetchSala();

    const unsub = ouvirSalaFinalRanking(salaAtual => {
      if (!salaAtual) {
        navigate('/');
        return;
      }

      // Atualiza sala só se mudou
      setSala(prevSala => {
        if (JSON.stringify(prevSala) === JSON.stringify(salaAtual)) return prevSala;
        return salaAtual;
      });

      const now = Date.now();
      const lastStart = salaAtual.lastRoundStart || salaAtual.musicStartTimestamp;
      const roundEnd = lastStart ? lastStart + (salaAtual.playlist?.length * 20 * 1000) : null;

      if (aguardandoNovaRodada && roundEnd && now >= roundEnd) {
        if (!hasRedirectedRef.current) {
          hasRedirectedRef.current = true;
          localStorage.removeItem('gameState');
          localStorage.removeItem('nextRoundStart');
          localStorage.removeItem('lastRoundStart');
          localStorage.removeItem('aguardandoNovaRodada');
          navigate('/game', { state: { fromRanking: true } });
        }
        return;
      }

      const segundosAteProxima = salaAtual.nextRoundStart
        ? Math.max(0, Math.floor((salaAtual.nextRoundStart - now) / 1000))
        : null;

      // Atualiza estados apenas se diferente para evitar rerenders
      safeSetNextRoundStart(salaAtual.nextRoundStart);
      safeSetLastRoundStart(lastStart);

      if (lastStart && now < roundEnd) {
        safeSetGameState(GameState.ROUND_ACTIVE);
      } else if (segundosAteProxima !== null && segundosAteProxima < 20) {
        safeSetGameState(GameState.COUNTDOWN);
        setRoundTimeLeft(prev => (prev !== segundosAteProxima ? segundosAteProxima : prev));
      } else {
        if (gameState !== GameState.ROUND_ACTIVE) {
          safeSetGameState(GameState.WAITING);
          setRoundTimeLeft(prev => (prev !== (segundosAteProxima || 20) ? (segundosAteProxima || 20) : prev));
        }
      }
    });

    return () => {
      hasRedirectedRef.current = false;
      unsub && unsub();
    };
  }, [navigate, aguardandoNovaRodada, safeSetGameState, safeSetLastRoundStart, safeSetNextRoundStart, gameState]);

  // Timer único controlando o roundTimeLeft, atualizado 1 vez por segundo
  useEffect(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    if ((gameState === GameState.COUNTDOWN || gameState === GameState.ROUND_ACTIVE) && (lastRoundStart || nextRoundStart)) {
      timerIntervalRef.current = setInterval(() => {
        const now = Date.now();
        let newTimeLeft;

        if (gameState === GameState.ROUND_ACTIVE && lastRoundStart && sala?.playlist?.length) {
          if (!roundStartTimeRef.current) {
            roundStartTimeRef.current = lastRoundStart;
          }
          const totalDuration = (sala.playlist.length * 20 * 1000) + 20000;
          const elapsedTime = now - roundStartTimeRef.current;
          const remainingTime = Math.max(0, totalDuration - elapsedTime);
          newTimeLeft = Math.floor(remainingTime / 1000);
        } else if (gameState === GameState.COUNTDOWN && nextRoundStart) {
          newTimeLeft = Math.max(0, Math.floor((nextRoundStart - now) / 1000));
        }

        setRoundTimeLeft(prev => (prev !== newTimeLeft ? newTimeLeft : prev));

      }, 1000);
    } else {
      setRoundTimeLeft(null);
      roundStartTimeRef.current = null;
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [gameState, lastRoundStart, nextRoundStart, sala?.playlist?.length]);

  // Navegar para game automaticamente ao acabar countdown e flag aguardandoNovaRodada estiver true
  useEffect(() => {
    if (roundTimeLeft === 0 && aguardandoNovaRodada) {
      // Mostra o lobby por 3 segundos antes de redirecionar
      setShowLobby(true);
      const timer = setTimeout(() => {
        navigate('/game', { state: { fromRanking: true } });
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [roundTimeLeft, aguardandoNovaRodada, navigate]);

  // Nova lógica: aguardar roundId mudar para resetar pontos e registrar jogador
  useEffect(() => {
    if (aguardandoNovaRodada && typeof resetPointsEverywhere === 'function' && typeof registerPlayerInRanking === 'function') {
      // Nova rodada detectada
      resetPointsEverywhere();
      registerPlayerInRanking(0);
      // safeSetAguardandoNovaRodada(false); // Descomente se quiser resetar flag após registrar
    }
  }, [roundId, aguardandoNovaRodada, resetPointsEverywhere, registerPlayerInRanking]);

  // Garante reset ao montar, mesmo se roundId já for o da nova rodada
  useEffect(() => {
    if (aguardandoNovaRodada && typeof resetPointsEverywhere === 'function' && typeof registerPlayerInRanking === 'function') {
      // Nova rodada detectada (mount)
      resetPointsEverywhere();
      registerPlayerInRanking(0);
      // safeSetAguardandoNovaRodada(false);
    }
    
    // Reseta o estado do lobby ao desmontar
    return () => {
      setShowLobby(false);
    };
    // eslint-disable-next-line
  }, []);
  const handlePlayAgain = useCallback(async () => {
    if (aguardandoNovaRodada) return;
    // Aguardando nova rodada
    safeSetAguardandoNovaRodada(true);
    // Agora o reset e registro ocorrerão no useEffect acima, assim que roundId mudar!
  }, [aguardandoNovaRodada, safeSetAguardandoNovaRodada, roundId]);

  const handleExit = async () => {
    try {
      if (nickname) removePlayerFromRanking(nickname);
      localStorage.clear();
      resetGame();
      navigate('/');
    } catch {
      alert('Erro ao sair!');
    }
  };

  const GameTimer = () => {
    if (gameState === GameState.COUNTDOWN && roundTimeLeft > 0) {
      return (
        <div className="game-timer countdown">
          <div className="timer-label">Tempo para jogar novamente:</div>
          <div className="timer-value">{roundTimeLeft}s</div>
        </div>
      );
    } else if (gameState === GameState.ROUND_ACTIVE && roundTimeLeft !== null) {
      const minutos = Math.floor(roundTimeLeft / 60);
      const segundos = roundTimeLeft % 60;
      return (
        <div className="game-timer smart-timer">
          <div className="timer-label">Rodada em andamento!</div>
          <div className="timer-value">{minutos}m {segundos.toString().padStart(2, '0')}s</div>
        </div>
      );
    } else if (gameState === GameState.WAITING && roundTimeLeft !== null) {
      return (
        <div className="game-timer smart-timer">
          <div className="timer-label">{timerLabel}</div>
          <div className="timer-value">{roundTimeLeft}s</div>
        </div>
      );
    }
    return null;
  };

  const ActionButtons = () => {
    if (gameState === GameState.COUNTDOWN) {
      return (
        <button
          className="final-ranking-btn primary-btn"
          onClick={handlePlayAgain}
          disabled={aguardandoNovaRodada}
        >
          {aguardandoNovaRodada ? '⏳ Aguardando...' : '🔄 Jogar Novamente'}
        </button>
      );
    }

    if (gameState === GameState.ROUND_ACTIVE) {
      return (
        <>
          <button
            className="final-ranking-btn success-btn"
            onClick={() => navigate('/game', { state: { fromRanking: true } })}
          >
            🎮 Entrar na rodada em andamento
          </button>
          <button
            className="final-ranking-btn secondary-btn"
            onClick={() => safeSetAguardandoNovaRodada(true)}
            disabled={aguardandoNovaRodada}
          >
            {aguardandoNovaRodada ? '⏳ Aguardando próxima rodada' : '⏳ Esperar próxima rodada'}
          </button>
        </>
      );
    }

    if (gameState === GameState.WAITING) {
      return (
        <button
          className="final-ranking-btn primary-btn"
          onClick={handlePlayAgain}
          disabled={aguardandoNovaRodada}
        >
          {aguardandoNovaRodada ? '⏳ Aguardando...' : '🔄 Jogar Novamente'}
        </button>
      );
    }

    return null;
  };

  const PlayerInfo = () => {
    const playerName = typeof nickname === 'object' && nickname !== null
      ? `${nickname.avatar?.emoji || ''} ${nickname.name}`
      : nickname;

    return (
      <>
        <h1 className="final-ranking-title">🏆 Resultado Final</h1>
        <div className="player-name">{playerName ? `Jogador: ${playerName}` : ''}</div>
        <div className="player-position">
          Você ficou em <span className="highlight position">{ranking.findIndex(p => {
            if (typeof p.nickname === 'object' && p.nickname !== null) {
              return p.nickname.name === (typeof nickname === 'object' ? nickname.name : nickname);
            }
            return p.nickname === nickname;
          }) + 1}º</span> lugar com <span className="highlight points">{points} pts</span>!
        </div>
      </>
    );
  };

  const RankingList = () => (
    <div className="final-ranking-list">
      {ranking.map((player, idx) => {
        let colorClass = '';
        let medal = '';
        if (idx === 0) { colorClass = 'gold-winner'; medal = '🥇'; }
        else if (idx === 1) { colorClass = 'silver-winner'; medal = '🥈'; }
        else if (idx === 2) { colorClass = 'bronze-winner'; medal = '🥉'; }

        const isSelf = typeof player.nickname === 'object' && player.nickname !== null
          ? player.nickname.name === nickname
          : player.nickname === nickname;

        const playerName = typeof player.nickname === 'object' && player.nickname !== null
          ? `${player.nickname.avatar?.emoji || ''} ${player.nickname.name}`
          : player.nickname;

        return (
          <div
            key={player.id}
            className={`final-ranking-item ${colorClass} ${isSelf ? 'self-player' : ''}`}
          >
            <span className="final-ranking-pos">{medal || `${idx + 1}º`}</span>
            <span className="final-ranking-nick">{playerName}</span>
            <span className="final-ranking-points">{player.points} pts</span>
          </div>
        );
      })}
    </div>
  );

  // Componente de Lobby
  const Lobby = () => (
    <div className="lobby-overlay">
      <div className="lobby-content">
        <div className="lobby-spinner">
          <div className="spinner"></div>
        </div>
        <h2>Rodada Iniciando</h2>
        <p>Prepare-se!</p>
      </div>
    </div>
  );

  if (showLobby) {
    return <Lobby />;
  }

  return (
    <div className="final-ranking-container">
      <div className="final-ranking-content">
        <div className="final-ranking-card final-ranking-actions-card">
          <PlayerInfo />
          <GameTimer />
          <div className="final-ranking-actions">
            <ActionButtons />
            <div className="secondary-actions">
              <button className="final-ranking-btn tertiary-btn" onClick={handleExit}>
                🏠 Voltar ao Início
              </button>
            </div>
          </div>
        </div>
        <div className="final-ranking-card final-ranking-list-card">
          <h2 className="final-ranking-title">Ranking dos Jogadores</h2>
          <RankingList />
        </div>
      </div>
    </div>
  );
}
