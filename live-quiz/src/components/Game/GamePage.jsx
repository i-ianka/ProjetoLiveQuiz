import React, { useState, useEffect, useRef, useCallback } from 'react';
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
    setNickname,
    setPoints
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
    // Removido reset automático de pontos aqui. O controle de reset está apenas no hook de ranking.
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
        });
  
        ouvirSala((novaSala) => {
          setShuffledMusics(prev => {
            if (JSON.stringify(prev) !== JSON.stringify(novaSala.playlist)) {
              if (Array.isArray(novaSala.playlist)) {
                console.log('[FRONTEND] Playlist sorteada:', novaSala.playlist.map(m => `${m.artist?.name || m.artist} - ${m.title || m.name}`));
                console.log('[FRONTEND][DEBUG] IDs sorteados:', novaSala.playlist.map(m => m.id));
              }
              return novaSala.playlist;
            }
            return prev;
          });
  
          setCurrentSongIndex(prevIdx => {
            if (prevIdx !== novaSala.musicaAtual) {
              // Reset automático ao início da rodada para todos os jogadores
              // Removido reset automático de pontos aqui. O controle de reset está apenas no hook de ranking.
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
      // Remove o playerId do localStorage para garantir novo registro
      if (nickname) {
        localStorage.removeItem('playerId_' + nickname);
      }
    }
  }, [fromRanking, nickname]);

  useEffect(() => {

  }, []);

  const normalize = (text) => {
    return text
      .normalize('NFD') // separa acentos
      .replace(/&/g, ' e ') // substitui & por ' e '
      .replace(/\s{2,}/g, ' ') // remove espaços duplos gerados
      .replace(/[-]/g, '') // remove traços
      .replace(/[\u0300-\u036F]/g, '') // remove marcas de acento
      .replace(/[^a-zA-Z0-9\se]/g, '') // remove pontuação e caracteres especiais, mas mantém 'e'
      .toLowerCase()
      .trim();
  };

  // Proteção extra para currentMusic
  const currentMusic = (Array.isArray(shuffledMusics) && shuffledMusics.length > currentSongIndex && currentSongIndex >= 0)
    ? shuffledMusics[currentSongIndex]
    : null;

  const musicStartTimestamp = salaInfo?.musicStartTimestamp || null;

  const [gamificationMsg, setGamificationMsg] = useState('');
  const [showGamification, setShowGamification] = useState(false);
  const [gamificationTime, setGamificationTime] = useState(0);

  const triggerGamification = useCallback((timeLeft, isAnswerCorrect = false) => {
    console.log('=== INÍCIO triggerGamification ===');
    console.log('Parâmetros recebidos:', { timeLeft, isAnswerCorrect });
    
    // Só mostra a mensagem se a resposta estiver correta
    if (!isAnswerCorrect) {
      console.log('Resposta incorreta, não mostrando mensagem de gamificação');
      console.log('=== FIM triggerGamification (resposta incorreta) ===');
      return;
    }
    
    console.log('Tempo exato recebido:', timeLeft);
    
    // Verifica se o tempo atual está dentro de alguma das faixas de gamificação
    const isInGamificationRange = (time) => {
      return (
        (time >= 15) || // 15 ou mais
        (time >= 10 && time <= 14.99) || // 10 a 14.99
        (time >= 6 && time <= 9.99) ||   // 6 a 9.99
        (time >= 0 && time <= 5.99)      // 0 a 5.99
      );
    };
    
    const shouldShowGamification = isInGamificationRange(timeLeft);
    
    console.log('Deve mostrar gamificação?', shouldShowGamification);
    
    if (!shouldShowGamification) {
      console.log(`Tempo ${timeLeft} não está em uma faixa de gamificação válida`);
      console.log('=== FIM triggerGamification (fora da faixa) ===');
      return;
    }
    
    console.log(`Mostrando mensagem de gamificação para tempo: ${timeLeft}s`);
    
    // Primeiro, garante que o estado está limpo
    console.log('Limpando estado anterior...');
    setShowGamification(false);
    
    // Aguarda um ciclo de renderização para garantir que o estado foi atualizado
    const timer = setTimeout(() => {
      console.log('Atualizando estado com novo tempo:', timeLeft);
      setGamificationTime(timeLeft);
      
      // Pequeno atraso para garantir que o estado foi atualizado
      const showTimer = setTimeout(() => {
        console.log('Mostrando mensagem de gamificação...');
        setShowGamification(true);
        console.log('Estado atualizado - showGamification: true, gamificationTime:', timeLeft);
        
        // Esconde a mensagem após 3 segundos
        console.log('Iniciando timer para esconder a mensagem...');
        const hideTimer = setTimeout(() => {
          console.log('Escondendo mensagem de gamificação após timeout');
          setShowGamification(false);
          console.log('=== FIM triggerGamification (mensagem escondida) ===');
        }, 3000);
        
        return () => {
          console.log('Limpando hideTimer');
          clearTimeout(hideTimer);
        };
      }, 50);
      
      return () => {
        console.log('Limpando showTimer');
        clearTimeout(showTimer);
      };
    }, 50);
    
    return () => {
      console.log('Limpando timer principal');
      clearTimeout(timer);
    };
  }, []);

  // Handler de resposta do usuário
  const handleAnswer = () => {
    if (!answered && currentMusic) {
      const answer = normalize(input);
      const title = normalize(currentMusic.title.replace(/-/g, ' '));
      const artist = normalize(currentMusic.artist.name.replace(/-/g, ' '));
      
      console.log('Resposta recebida:', { answer, title, artist });
      
      setAttempts(prev => [...prev, input]); // Salva tentativa original
      
      // Verifica se a resposta está correta
      const hasTitle = answer.includes(title);
      const hasArtist = answer.includes(artist);
      const hasBoth = hasTitle && hasArtist;
      // Ordem invertida: artista antes do título também é aceita
      const hasBothInverted = (answer.indexOf(artist) > -1 && answer.indexOf(title) > -1);
      
      const isAnswerCorrect = (hasTitle && hasArtist) || hasBothInverted;
      
      if (isAnswerCorrect) {
        console.log('Resposta correta! Tempo restante:', currentTimeLeft);
        setFeedback('✅ Correto!');
        addPoints(currentTimeLeft);
        setAnswered(true);
        
        // Mostra a mensagem de gamificação apenas se a resposta estiver correta
        // e no tempo certo
        console.log('Chamando triggerGamification com tempo:', currentTimeLeft);
        triggerGamification(currentTimeLeft, true);
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
    if (hasHandledTimeUp.current) {
      return;
    }
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
      setAnswered(false); // Garante input destravado
      setCurrentTimeLeft(20);
      setMusicEnded(false);
      hasHandledTimeUp.current = false;
    } else {
      // Atualiza musicaAtual para playlist.length para disparar o efeito de reinício
      await avancarMusica(shuffledMusics.length);
      setTimeout(() => {
        navigate('/result', { replace: true });
      }, 4000);
    }
  };

  const handleExit = async () => {
    if (window.confirm('Tem certeza que deseja sair da sala?')) {
      try {
        await removePlayerFromRanking();
      } catch (err) {
        console.warn('Erro ao remover jogador do ranking:', err);
      }
      resetGame && resetGame();
      localStorage.clear();
      navigate('/');
    }
  };

  const previousSongs = shuffledMusics.slice(0, currentSongIndex);

  // Botão de admin para terminar partida instantaneamente
  async function handleTerminarPartida() {
    if (!salaInfo || !salaInfo.playlist) return;
    // Em vez de finalizar a partida, pula para a música 15 (índice 14)
    await avancarMusica(14); // 14 = 15ª música (índice começa em 0)
  }

  const roundId = salaInfo?.musicStartTimestamp || null;
  const { ranking, playerKey, registerPlayerInRanking } = useFirebaseRanking(roundId);

  // Registra jogador no ranking ao entrar na sala (nickname e pontos zerados)
  useEffect(() => {
    // Só registra se nickname.name existir e playerKey estiver definido
    const nickNameStr = typeof nickname === 'object' && nickname !== null ? nickname.name : nickname;
    if (nickNameStr && playerKey && registerPlayerInRanking) {
      console.log('[DEBUG] Registrando jogador:', nickNameStr, playerKey, points);
      registerPlayerInRanking(points ?? 0);
      localStorage.setItem('entrouNaRodada', 'true');
    } else {
      console.log('[DEBUG] Nickname/playerKey ausente ou inválido:', nickname, playerKey, points);
    }
    // eslint-disable-next-line
  }, [nickname, playerKey, points]);

  // Monitora currentTimeLeft para mostrar mensagens quando o usuário acertar
  // A gamificação agora só é acionada quando o usuário acerta a resposta
  // através do handleAnswer abaixo

  // Garante sumiço automático após X segundos
  const handleGamificationClose = React.useCallback(() => {
    console.log('=== INÍCIO handleGamificationClose ===');
    console.log('Escondendo gamificação...');
    setShowGamification(false);
    
    // Força um novo render limpando o tempo
    const timer = setTimeout(() => {
      console.log('Limpando gamificationTime...');
      setGamificationTime(0);
      console.log('=== FIM handleGamificationClose ===');
    }, 100);
    
    return () => {
      console.log('Limpando timer do handleGamificationClose');
      clearTimeout(timer);
    };
  }, []);

  // Renderização do componente de gamificação
  const renderGamification = () => {
    console.log('=== RENDERIZANDO GAMIFICATION ===');
    console.log('showGamification:', showGamification);
    console.log('gamificationTime:', gamificationTime);
    
    if (!showGamification || gamificationTime === null) {
      console.log('Não renderizando GamificationEffect (showGamification é falso ou gamificationTime é nulo)');
      return null;
    }
    
    console.log('Renderizando GamificationEffect com tempo:', gamificationTime);
    
    return (
      <div style={{ 
        position: 'fixed', 
        top: '20px', 
        left: '0',
        right: '0',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        zIndex: 10000,
        pointerEvents: 'none',
        width: '100%',
        height: '0', // Altura zero para não interferir no layout
        overflow: 'visible' // Permite que o conteúdo seja exibido fora do container
      }}>
        <GamificationEffect
          show={showGamification}
          timeLeft={gamificationTime}
          onClose={handleGamificationClose}
        />
      </div>
    );
  };

  // Novo: input só fica desabilitado se não houver música OU preview OU se já respondeu/tempo acabou (exceto se tempo restante >= 1)
  const isInputDisabled = !currentMusic || !currentMusic.preview || answered || (musicEnded === true && currentTimeLeft < 1);

  const prevRoundRef = useRef(null);

  // Reset de pontos APENAS quando detectar novo roundId (musicStartTimestamp) e primeira música
  useEffect(() => {
    if (!salaInfo) return;
    if (salaInfo.musicaAtual !== 0) return;
    const newRoundId = salaInfo.musicStartTimestamp;
    if (!newRoundId) return;
    if (prevRoundRef.current === newRoundId) return; // mesmo round, ignora
    // Novo round detectado: zera pontos locais
    const nickKey = typeof nickname === 'object' && nickname !== null ? nickname.name : nickname;
    setPoints && setPoints(0);
    localStorage.setItem('points_' + nickKey, 0);
    prevRoundRef.current = newRoundId;
  }, [salaInfo?.musicStartTimestamp, salaInfo?.musicaAtual, nickname, setPoints]);

  return (
    <div className="game-page dark-mode">
      {/* Gamification Overlay */}
      {renderGamification()}
      
      {/* Grid principal */}
      <div className="game-grid dark-mode">
        {/* Coluna da esquerda - Ranking */}
        <div className="ranking-column dark-mode">
          {nickname && <LiveRanking playerKey={playerKey} refreshTrigger={refreshRankingTrigger} />}
        </div>

        {/* Coluna central - Área principal do jogo */}
        <div className="game-column dark-mode">
          <div className="game-card dark-mode">
            <button
              className="exit-button"
              onClick={handleExit}
            >
              Sair da sala
            </button>

            {/* Botão ADMIN: Terminar Partida Instantaneamente */}
            <button
              className="login-btn"
              style={{ marginTop: 16, background: '#f87171', color: '#fff' }}
              onClick={handleTerminarPartida}
            >
              ⚡ Terminar Partida (admin)
            </button>

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
              {/* Sempre renderize o MusicPlayer, controlando apenas as props */}
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
                  onPaste={e => e.preventDefault()} // Impede colar
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

            {/* --- Gamificação visual --- */}
            {renderGamification()}

            {currentSongIndex === shuffledMusics.length - 1 && musicEnded && (
              <button
                onClick={async () => {
                  // Dispara nova rodada para todos antes de ir para o resultado
                  await avancarMusica(0);
                  setTimeout(() => {
                    navigate('/result', { replace: true });
                  }, 400);
                }}
                className="exit-button dark-mode"
              >
                Ver Resultado Final
              </button>
            )}
          </div>
        </div>

        {/* Coluna da direita - Histórico */}
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
