import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useGame } from '../../hooks/useGame';
import { useFirebaseRanking } from '../../hooks/useFirebaseRanking';
import MusicPlayer from './MusicPlayer';
import PreviousSongsList from './PreviousSongsList';
import LiveRanking from './LiveRanking';
import GamificationEffect from './GamificationEffect';
import '../GamePage.css';
import '../GamificationEffect.css';
import confetti from 'canvas-confetti';

import {
  iniciarSalaSeNaoExistir,
  getSalaAtual,
  ouvirSala,
  avancarMusica,
  reiniciarSalaComLoop,
  tentarLockReinicioRodada,
  liberarLockReinicioRodada
} from '../../services/firebaseSalaService';

import { usePlayerPresence } from '../../hooks/usePlayerPresence';
import { v4 as uuidv4 } from 'uuid';

// Permite chamar reiniciarSalaComLoop do backend via window para sincronização global
if (typeof window !== 'undefined') {
  window.reiniciarSalaComLoop = reiniciarSalaComLoop;
}

export default function GamePage() {
  const {
    nickname,
    points,
    addPoints,
    resetGame,
    setNickname
  } = useGame();

  let displayName = '';
  let displayAvatar = '';
  if (typeof nickname === 'object' && nickname !== null) {
    displayName = nickname.name;
    displayAvatar = nickname.avatar.emoji;
  } else if (typeof nickname === 'string') {
    // Tenta restaurar do localStorage
    const storedName = localStorage.getItem('nickname');
    const storedAvatar = localStorage.getItem('avatar');
    if (storedName && storedAvatar) {
      try {
        const avatarObj = JSON.parse(storedAvatar);
        displayName = storedName;
        displayAvatar = avatarObj.emoji;
        // Atualiza contexto se necessário
        setNickname && setNickname({ name: storedName, avatar: avatarObj });
      } catch {
        displayName = nickname;
        displayAvatar = '';
      }
    } else {
      displayName = nickname;
      displayAvatar = '';
    }
  }

  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState('');
  const [answered, setAnswered] = useState(false);
  const [currentTimeLeft, setCurrentTimeLeft] = useState(20);
  const [shuffledMusics, setShuffledMusics] = useState([]);
  const [musicEnded, setMusicEnded] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const [salaInfo, setSalaInfo] = useState(null);
  const [justEntered, setJustEntered] = useState(false);
  const [refreshRankingTrigger, setRefreshRankingTrigger] = useState(0);
  const [attempts, setAttempts] = useState([]); // Histórico de tentativas

  const navigate = useNavigate();
  const inputRef = useRef(null);
  const hasHandledTimeUp = useRef(false);
  const location = useLocation();
  const fromRanking = location.state?.fromRanking;

  useEffect(() => {
    setInput(''); // Limpa o input ao trocar de música
    setAttempts([]); // Limpa histórico ao trocar de música
    setAnswered(false); // Garante input habilitado IMEDIATAMENTE
    // --- RESET DE PONTUAÇÃO AUTOMÁTICO SOMENTE NO INÍCIO REAL DA NOVA RODADA ---
    if (
      salaInfo &&
      salaInfo.musicaAtual === 0 &&
      salaInfo.musicStartTimestamp &&
      currentSongIndex === 0 &&
      !window._jaZerouPontosRodada // flag para evitar reset duplo
    ) {
      const nickKey = typeof nickname === 'object' && nickname !== null ? nickname.name : nickname;
      // SEMPRE zera os pontos no início de uma nova rodada
      localStorage.setItem('points_' + nickKey, 0);
      if (typeof window !== 'undefined' && window.setPoints) {
        window.setPoints(0);
      }
      window._jaZerouPontosRodada = true;
      
      // Armazena o roundId atual no localStorage para uso em outros componentes
      localStorage.setItem('currentRoundId', salaInfo.musicStartTimestamp);
    }
    // Limpa a flag quando a rodada avança
    if (salaInfo && salaInfo.musicaAtual > 0) {
      window._jaZerouPontosRodada = false;
    }
  }, [currentSongIndex, salaInfo]);

  useEffect(() => {
    if (currentSongIndex === 0) {
      setRefreshRankingTrigger(prev => prev + 1);
    }
  }, [currentSongIndex]);

  useEffect(() => {
    const escutarSala = async () => {
      try {
        const sala = await getSalaAtual();
  
        setShuffledMusics(sala.playlist);
        setCurrentSongIndex(sala.musicaAtual);
  
        setSalaInfo({
          playlist: sala.playlist,
          musicaAtual: sala.musicaAtual,
          tempoAtual: sala.tempoAtual,
          musicStartTimestamp: sala.musicStartTimestamp,
          roomId: sala.id || 'defaultRoomId',
        });
  
        ouvirSala((novaSala) => {
          setShuffledMusics(prev => {
            if (JSON.stringify(prev) !== JSON.stringify(novaSala.playlist)) {
              if (Array.isArray(novaSala.playlist)) {
                
              }
              return novaSala.playlist;
            }
            return prev;
          });
  
          setCurrentSongIndex(prevIdx => {
            if (prevIdx !== novaSala.musicaAtual) {
              return novaSala.musicaAtual;
            }
            return prevIdx;
          });
  
          setSalaInfo({
            playlist: novaSala.playlist,
            musicaAtual: novaSala.musicaAtual,
            tempoAtual: novaSala.tempoAtual,
            nextRoundStart: novaSala.nextRoundStart,
            musicStartTimestamp: novaSala.musicStartTimestamp,
            roomId: novaSala.id || 'defaultRoomId',
          });
  
          const isPrimeiraMusica = novaSala.musicaAtual === 0 && novaSala.musicStartTimestamp;
          const now = Date.now();
          if (
            novaSala.musicaAtual >= novaSala.playlist.length &&
            (!novaSala.musicStartTimestamp || novaSala.musicStartTimestamp === null) &&
            (!novaSala.nextRoundStart || novaSala.nextRoundStart > now + 2000) &&
            !isPrimeiraMusica
          ) {
            navigate('/result', { replace: true });
          }
        });
      } catch (err) {
        console.error('Erro ao escutar sala:', err);
      }
    };
  
    escutarSala();
  }, []);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [currentSongIndex, musicEnded]);

  useEffect(() => {
    if (fromRanking) {
      if (nickname) {
        localStorage.removeItem('playerId_' + nickname);
      }
    }
  }, [fromRanking, nickname]);

  const normalize = (text) => {
    return text
      .normalize('NFD')
      .replace(/&/g, ' e ')
      .replace(/\s{2,}/g, ' ')
      .replace(/[-]/g, '')
      .replace(/[\u0300-\u036F]/g, '')
      .replace(/[^a-zA-Z0-9\se]/g, '')
      .toLowerCase()
      .trim();
  };

  const currentMusic = (Array.isArray(shuffledMusics) && shuffledMusics.length > currentSongIndex && currentSongIndex >= 0)
    ? shuffledMusics[currentSongIndex]
    : null;

  const [gamificationMsg, setGamificationMsg] = useState('');
  const [showGamification, setShowGamification] = useState(false);
  const [gamificationTime, setGamificationTime] = useState(0);

  function triggerGamification(timeLeft) {
    setGamificationTime(timeLeft);
    setShowGamification(true);
    if (timeLeft >= 10) {
      import('canvas-confetti').then(({ default: confetti }) => {
        confetti({
          particleCount: 120,
          spread: 90,
          origin: { y: 0.6 }
        });
      });
    }
  }

  const handleAnswer = () => {
    if (!answered && currentMusic) {
      const answer = normalize(input);
      const title = normalize(currentMusic.title.replace(/-/g, ' '));
      const artist = normalize(currentMusic.artist.name.replace(/-/g, ' '));
      setAttempts(prev => [...prev, input]);
      const hasTitle = answer.includes(title);
      const hasArtist = answer.includes(artist);
      const hasBoth = hasTitle && hasArtist;
      const hasBothInverted = (answer.indexOf(artist) > -1 && answer.indexOf(title) > -1);
      if ((hasTitle && hasArtist) || hasBothInverted) {
        setFeedback('✅ Correto!');
        addPoints(currentTimeLeft);
        setAnswered(true);
        triggerGamification(currentTimeLeft);
      } else if (
        hasTitle || hasArtist ||
        title.split(' ').some(word => answer.includes(word)) ||
        artist.split(' ').some(word => answer.includes(word))
      ) {
        setFeedback('✨ Quase lá! Você acertou parte!');
        setInput('');
      } else {
        setFeedback('❌ Errou!');
      }
    }
  };

  const handleTimeUp = (time) => {
    if (hasHandledTimeUp.current) return;
    hasHandledTimeUp.current = true;

    setCurrentTimeLeft(time);
    setMusicEnded(true);

    if (currentMusic) {
      const artistName = currentMusic.artist?.name || 'Artista desconhecido';
      setFeedback(`⏰ Tempo esgotado! A música era "${currentMusic.title.replace(/-/g, ' ')}" por ${currentMusic.artist?.name.replace(/-/g, ' ')}`);
      setTimeout(() => {
        setFeedback('');
        moveToNext();
      }, 2000);
    } else {
      moveToNext();
    }
  };

  const moveToNext = async () => {
    if (currentSongIndex + 1 < shuffledMusics.length) {
      await avancarMusica(currentSongIndex + 1);
      setInput('');
      setFeedback('');
      setAnswered(false);
      setCurrentTimeLeft(20);
      setMusicEnded(false);
      hasHandledTimeUp.current = false;
    } else {
      await avancarMusica(shuffledMusics.length);
      setTimeout(() => {
        navigate('/result', { replace: true });
      }, 4000);
    }
  };

  const handleExit = () => {
    if (window.confirm('Tem certeza que deseja sair da sala?')) {
      resetGame && resetGame();
      navigate('/');
    }
  };

  const previousSongs = shuffledMusics.slice(0, currentSongIndex);

  async function handleTerminarPartida() {
    if (!salaInfo || !salaInfo.playlist) return;
    await avancarMusica(14);
  }

  // --- INÍCIO DA INTEGRAÇÃO DO HOOK DE PRESENÇA ---

  const [playerId] = useState(() => {
    let storedId = localStorage.getItem('playerId');
    if (!storedId) {
      storedId = uuidv4();
      localStorage.setItem('playerId', storedId);
    }
    return storedId;
  });

  const roundId = salaInfo?.musicStartTimestamp || null;

  const nickNameStr = typeof nickname === 'object' && nickname !== null ? nickname.name : nickname;

  usePlayerPresence(
    salaInfo?.roomId || 'defaultRoomId',
    playerId,
    nickNameStr,
    roundId,
    points
  );

  // --- FIM DA INTEGRAÇÃO DO HOOK DE PRESENÇA ---

  // Novo: input só fica desabilitado se não houver música OU preview OU se já respondeu/tempo acabou (exceto se tempo restante >= 1)
  const isInputDisabled = !currentMusic || !currentMusic.preview || answered || (musicEnded === true && currentTimeLeft < 1);

  return (
    <div className="game-page dark-mode">
      <div className="game-grid dark-mode">
        <div className="ranking-column dark-mode">
          {nickname && (
            <LiveRanking
              playerKey={playerId}
              roomId={salaInfo?.roomId || 'defaultRoomId'}
               currentRoundId={salaInfo?.musicStartTimestamp || null}
            />
          )}
        </div>
        <div className="game-column dark-mode">
          <div className="game-card dark-mode">
            <button
              className="exit-button"
              onClick={handleExit}
            >
              Sair da sala
            </button>

  {/*      <button
              className="login-btn"
              style={{ marginTop: 16, background: '#f87171', color: '#fff' }}
              onClick={handleTerminarPartida}
            >
              ⚡ Terminar Partida (admin)
            </button> */}

            <div className="game-header dark-mode">
              <h2>
                {salaInfo && salaInfo.musicaAtual >= salaInfo.playlist.length
                  ? 'Rodada finalizada!'
                  : `🎶 Música ${currentSongIndex + 1} de ${shuffledMusics.length}`}
              </h2>
            </div>

            <div className="player-info dark-mode">
              Jogador: <span>{displayAvatar} {displayName}</span>
            </div>
            <div className="points small-points dark-mode">
              Pontos: {points === null ? <span style={{color:'#fbbf24'}}>Carregando...</span> : points}
            </div>

            <div className="game-controls dark-mode">
              <MusicPlayer
                musicUrl={currentMusic?.preview || null}
                onTimeUp={handleTimeUp}
                onTimeUpdate={setCurrentTimeLeft}
                isMuted={isMuted}
                setIsMuted={setIsMuted}
                showMuteButtonOnTop
                musicaAtual={salaInfo?.musicaAtual || currentSongIndex || 0}
                musicStartTimestamp={salaInfo?.musicStartTimestamp || null}
              />

              <div className="input-with-enter">
                <input
                  ref={inputRef}
                  className={`answer-input dark-mode ${feedback.includes('Correto') ? 'input-correct' : feedback.includes('Quase') ? 'input-almost' : feedback.includes('Errou') ? 'input-wrong' : ''}`}
                  type="text"
                  placeholder="Digite sua resposta"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleAnswer();
                  }}
                  onPaste={e => e.preventDefault()}
                  disabled={isInputDisabled}
                  autoFocus
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-label="Resposta da música"
                  style={{ fontFamily: 'inherit', fontWeight: 600, letterSpacing: 0.01, outline: 0, borderWidth: 2, borderColor: feedback.includes('Correto') ? '#16a34a' : feedback.includes('Quase') ? '#facc15' : feedback.includes('Errou') ? '#ef4444' : '#64748B', background: isInputDisabled ? 'rgba(15,23,42,0.1)' : 'rgba(15,23,42,0.3)', color: '#E2E8F0', minHeight: 44 }}
                />
                <button
                  className="enter-icon"
                  title="Enviar resposta"
                  tabIndex={-1}
                  aria-hidden="true"
                  type="button"
                  style={{ background: 'none', border: 'none', outline: 'none', cursor: isInputDisabled ? 'not-allowed' : 'pointer', position: 'absolute', right: '0.7em', top: '50%', transform: 'translateY(-50%)', height: '2.1em', display: 'flex', alignItems: 'center', zIndex: 2, pointerEvents: isInputDisabled ? 'none' : 'auto' }}
                  onMouseDown={e => { e.preventDefault(); if (!isInputDisabled) handleAnswer(); }}
                  disabled={isInputDisabled}
                >
                  <span className="enter-underline">Enter</span>
                </button>
              </div>
              {attempts.length > 0 && (
                <div className="attempt-history" style={{marginTop: 8, fontSize: '0.97em', color: '#a78bfa', minHeight: 18}}>
                  <span style={{fontWeight: 600}}>Tentativas:</span> {attempts.map((a, i) => <span key={i} style={{marginLeft: 4, marginRight: 4, color: '#fff', background: '#334155', borderRadius: 4, padding: '1px 7px', fontWeight: 500}}>{a}</span>)}
                </div>
              )}
            </div>

            {feedback && (
              <div className={`feedback dark-mode ${
                feedback.includes('Correto') ? 'correct' :
                feedback.includes('Quase') ? 'almost' : 'wrong'
              }`}>
                {feedback}
              </div>
            )}

            {showGamification && (
              <GamificationEffect
                show={showGamification}
                timeLeft={gamificationTime}
                onClose={() => setShowGamification(false)}
              />
            )}

            {currentSongIndex === shuffledMusics.length - 1 && musicEnded && (
              <button
                onClick={() => navigate('/result', { replace: true })}
                className="exit-button dark-mode"
              >
                Ver Resultado Final
              </button>
            )}
          </div>
        </div>

        <div className="history-column dark-mode">
          <div className="history-card dark-mode">
            <h3>🎵 Músicas Anteriores</h3>
            <PreviousSongsList songs={previousSongs} />
          </div>
        </div>
      </div>
    </div>
  );
}
