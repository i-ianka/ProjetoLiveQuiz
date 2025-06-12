import { useNavigate } from 'react-router-dom';
import { useGame } from '../hooks/useGame';
import { useFirebaseRanking } from '../hooks/useFirebaseRanking';
import { getSalaAtualFinalRanking, ouvirSalaFinalRanking } from '../services/firebaseSalaFinalRanking';
import { useEffect, useState, useCallback, useRef } from 'react';
import './FinalRankingPage.css';

// Enum para controlar o estado do jogo
const GameState = {
  LOADING: 'loading',
  COUNTDOWN: 'countdown',
  WAITING: 'waiting',
  ROUND_ACTIVE: 'round_active',
};

export default function FinalRankingPage() {
  const { nickname, points, resetGame, registerPlayerInRanking } = useGame();
  const navigate = useNavigate();
  const { ranking, removePlayerFromRanking, persistPlayerScore } = useFirebaseRanking();

  const intervalsRef = useRef([]);
  const timerRef = useRef(null);
  const roundStartTimeRef = useRef(null);
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
  const [smartTimeLeft, setSmartTimeLeft] = useState(null);
  const [timerLabel, setTimerLabel] = useState('');
  const [sala, setSala] = useState(null);

  const updateGameState = useCallback((newState) => {
    setGameState(newState);
    localStorage.setItem('gameState', JSON.stringify(newState));
  }, []);

  const updateNextRoundStart = useCallback((timestamp) => {
    setNextRoundStart(timestamp);
    localStorage.setItem('nextRoundStart', JSON.stringify(timestamp));
  }, []);

  const updateLastRoundStart = useCallback((timestamp) => {
    setLastRoundStart(timestamp);
    localStorage.setItem('lastRoundStart', JSON.stringify(timestamp));
  }, []);

  const updateAguardandoNovaRodada = useCallback((value) => {
    setAguardandoNovaRodada(value);
    localStorage.setItem('aguardandoNovaRodada', JSON.stringify(value));
  }, []);

  const clearAllIntervals = useCallback(() => {
    intervalsRef.current.forEach(interval => clearInterval(interval));
    intervalsRef.current = [];
  }, []);

  const setTrackedInterval = useCallback((callback, delay) => {
    const id = setInterval(callback, delay);
    intervalsRef.current.push(id);
    return id;
  }, []);

  useEffect(() => {
    if (roundTimeLeft === 0 && gameState === GameState.COUNTDOWN) {
      updateGameState(GameState.ROUND_ACTIVE);
    }
  }, [roundTimeLeft, gameState, updateGameState]);

  useEffect(() => {
    if (roundTimeLeft === 0 && aguardandoNovaRodada) {
      navigate('/game', { state: { fromRanking: true } });
    }
  }, [roundTimeLeft, aguardandoNovaRodada, navigate]);

  useEffect(() => {
    if (!lastRoundStart || !nextRoundStart) return;

    const updateSmartTime = () => {
      const now = Date.now();
      const roundEnd = lastRoundStart + 60000; // Active round duration: 60 seconds
      const nextRoundStartTime = roundEnd + 20000; // Delay between rounds: 20 seconds

      if (now < roundEnd) {
        const segundosRestantes = Math.max(0, Math.floor((roundEnd - now) / 1000));
        setSmartTimeLeft(segundosRestantes);
        setTimerLabel('Fim da rodada em');
        setGameState(GameState.ROUND_ACTIVE);
      } else if (now < nextRoundStartTime) {
        const segundosAteProxima = Math.max(0, Math.floor((nextRoundStartTime - now) / 1000));
        setSmartTimeLeft(segundosAteProxima);
        setTimerLabel('Próxima rodada em');
        setGameState(GameState.WAITING);
      } else {
        setSmartTimeLeft(0);
        setTimerLabel('Próxima rodada em');
      }
    };

    updateSmartTime();
    const interval = setInterval(updateSmartTime, 1000);
    return () => clearInterval(interval);
  }, [lastRoundStart, nextRoundStart]);

  useEffect(() => {
    console.log('Timer effect:', {
      roundTimeLeft,
      gameState,
      aguardandoNovaRodada,
      lastRoundStart: lastRoundStart ? new Date(lastRoundStart).toISOString() : null,
      nextRoundStart: nextRoundStart ? new Date(nextRoundStart).toISOString() : null,
      now: new Date().toISOString()
    });

    if (roundTimeLeft === 0 && gameState === GameState.COUNTDOWN) {
      console.log('Mudando para ROUND_ACTIVE');
      updateGameState(GameState.ROUND_ACTIVE);
      updateAguardandoNovaRodada(false);
    }
  }, [roundTimeLeft, updateGameState, updateAguardandoNovaRodada]);

  useEffect(() => {
    const fetchSala = async () => {
      const salaAtual = await getSalaAtualFinalRanking();
      if (salaAtual) {
        setSala(salaAtual);
        const lastStart = salaAtual.lastRoundStart || salaAtual.musicStartTimestamp;
        console.log('Sala atual:', { 
          sala: {
            ...salaAtual,
            lastRoundStart: salaAtual.lastRoundStart ? new Date(salaAtual.lastRoundStart).toISOString() : null,
            musicStartTimestamp: salaAtual.musicStartTimestamp ? new Date(salaAtual.musicStartTimestamp).toISOString() : null,
            nextRoundStart: salaAtual.nextRoundStart ? new Date(salaAtual.nextRoundStart).toISOString() : null
          },
          lastStart: lastStart ? new Date(lastStart).toISOString() : null
        });
        updateNextRoundStart(salaAtual.nextRoundStart || null);
        updateLastRoundStart(lastStart || null);
      }
    };
    fetchSala();
    const unsub = ouvirSalaFinalRanking(salaAtual => {
      if (!salaAtual) {
        navigate('/');
        return;
      }

      setSala(salaAtual);
      const now = Date.now();
      const lastStart = salaAtual.lastRoundStart || salaAtual.musicStartTimestamp;
      const roundEnd = lastStart ? lastStart + (salaAtual.playlist?.length * 20 * 1000) : null;
      const segundosAteProxima = salaAtual.nextRoundStart
        ? Math.max(0, Math.floor((salaAtual.nextRoundStart - now) / 1000))
        : null;

      console.log('Firebase update:', {
        segundosAteProxima,
        gameState,
        roundTimeLeft,
        aguardandoNovaRodada,
        roundEnd: roundEnd ? new Date(roundEnd).toISOString() : null,
        now: new Date(now).toISOString(),
        lastStart: lastStart ? new Date(lastStart).toISOString() : null,
        sala: {
          lastRoundStart: salaAtual.lastRoundStart ? new Date(salaAtual.lastRoundStart).toISOString() : null,
          musicStartTimestamp: salaAtual.musicStartTimestamp ? new Date(salaAtual.musicStartTimestamp).toISOString() : null,
          nextRoundStart: salaAtual.nextRoundStart ? new Date(salaAtual.nextRoundStart).toISOString() : null
        }
      });

      if (aguardandoNovaRodada && roundEnd && now >= roundEnd) {
        console.log('Redirecionando para game page - rodada acabou', {
          now: new Date(now).toISOString(),
          roundEnd: new Date(roundEnd).toISOString(),
          diff: now - roundEnd
        });
        localStorage.removeItem('gameState');
        localStorage.removeItem('nextRoundStart');
        localStorage.removeItem('lastRoundStart');
        localStorage.removeItem('aguardandoNovaRodada');
        navigate('/game', { state: { fromRanking: true } });
        return;
      }

      if (lastStart && now < roundEnd) {
        updateGameState(GameState.ROUND_ACTIVE);
      } else if (segundosAteProxima !== null && segundosAteProxima < 20) {
        updateGameState(GameState.COUNTDOWN);
        setRoundTimeLeft(segundosAteProxima);
      } else if (gameState !== GameState.ROUND_ACTIVE) {
        updateGameState(GameState.WAITING);
        setRoundTimeLeft(segundosAteProxima || 20);
      }

      updateNextRoundStart(salaAtual.nextRoundStart);
      updateLastRoundStart(lastStart);
    });
    return () => unsub && unsub();
  }, [navigate, aguardandoNovaRodada, updateGameState, updateNextRoundStart, updateLastRoundStart, gameState]);

  useEffect(() => {
    if (gameState === GameState.ROUND_ACTIVE && lastRoundStart && sala?.playlist?.length) {
      if (!roundStartTimeRef.current) {
        roundStartTimeRef.current = lastRoundStart;
      }

      const totalDuration = (sala.playlist.length * 20 * 1000) + 20000; // Duração da playlist + 20s de intervalo
      const elapsedTime = Date.now() - roundStartTimeRef.current;
      const remainingTime = Math.max(0, totalDuration - elapsedTime);
      const remainingSeconds = Math.floor(remainingTime / 1000);

      setRoundTimeLeft(remainingSeconds);

      const interval = setInterval(() => {
        const elapsedTime = Date.now() - roundStartTimeRef.current;
        const remainingTime = Math.max(0, totalDuration - elapsedTime);
        const remainingSeconds = Math.floor(remainingTime / 1000);
        setRoundTimeLeft(remainingSeconds);
      }, 1000);

      return () => {
        clearInterval(interval);
      };
    } else if (gameState === GameState.COUNTDOWN) {
      const now = Date.now();
      const segundosAteProxima = nextRoundStart
        ? Math.max(0, Math.floor((nextRoundStart - now) / 1000))
        : 20;

      setRoundTimeLeft(segundosAteProxima);

      const interval = setInterval(() => {
        const now = Date.now();
        const segundosAteProxima = nextRoundStart
          ? Math.max(0, Math.floor((nextRoundStart - now) / 1000))
          : 20;
        setRoundTimeLeft(segundosAteProxima);
      }, 1000);

      return () => {
        clearInterval(interval);
      };
    } else {
      setRoundTimeLeft(null);
      roundStartTimeRef.current = null;
    }
  }, [gameState, lastRoundStart, sala?.playlist?.length, nextRoundStart]);

  const handlePlayAgain = useCallback(() => {
    console.log('Play again clicked:', {
      gameState,
      roundTimeLeft,
      aguardandoNovaRodada
    });
    if (aguardandoNovaRodada) return;
    updateAguardandoNovaRodada(true);
  }, [aguardandoNovaRodada, gameState, roundTimeLeft, updateAguardandoNovaRodada]);

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

      console.log('GameTimer - Rodada ativa:', {
        roundTimeLeft,
        minutos,
        segundos,
        roundStartTime: roundStartTimeRef.current ? new Date(roundStartTimeRef.current).toISOString() : 'null',
        lastRoundStart: lastRoundStart ? new Date(lastRoundStart).toISOString() : 'null'
      });

      return (
        <div className="game-timer smart-timer">
          <div className="timer-label">Rodada em andamento!</div>
          <div className="timer-value">{minutos}m {segundos.toString().padStart(2, '0')}s</div>
        </div>
      );
    } else if ((gameState === GameState.WAITING) && roundTimeLeft !== null) {
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
            onClick={() => updateAguardandoNovaRodada(true)}
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
