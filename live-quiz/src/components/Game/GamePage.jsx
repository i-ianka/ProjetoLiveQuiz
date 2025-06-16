import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useGame } from '../../hooks/useGame';
import { useFirebaseRanking } from '../../hooks/useFirebaseRanking';
import MusicPlayer from './MusicPlayer';
import GamificationEffect from './GamificationEffect';
import PreviousSongsList from './PreviousSongsList';
import LiveRanking from './LiveRanking';
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

  // Use refs to manage input state without causing re-renders
  const inputElementRef = useRef(null);
  const inputValueRef = useRef('');
  const [inputValue, setInputValue] = useState(''); // For UI updates only
  const [answered, setAnswered] = useState(false);
  const [currentTimeLeft, setCurrentTimeLeft] = useState(20);
  const [shuffledMusics, setShuffledMusics] = useState([]);
  const [musicEnded, setMusicEnded] = useState(false);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const [salaInfo, setSalaInfo] = useState(null);
  const [justEntered, setJustEntered] = useState(false);
  const [refreshRankingTrigger, setRefreshRankingTrigger] = useState(0);
  const [attempts, setAttempts] = useState([]); // Histórico de tentativas
  const [isMuted, setIsMuted] = useState(false); // Estado para controle de mudo
  const [feedback, setFeedback] = useState(''); // Feedback para o jogador (Correto, Quase, Errou)

  const navigate = useNavigate();
  const hasHandledTimeUp = useRef(false);
  const location = useLocation();
  const fromRanking = location.state?.fromRanking;

  // Track previous song index to detect changes
  const prevSongIndexRef = useRef(-1);
  
  // Move currentMusic definition to after the state is initialized
  const currentMusic = (Array.isArray(shuffledMusics) && shuffledMusics.length > currentSongIndex && currentSongIndex >= 0)
    ? shuffledMusics[currentSongIndex]
    : null;
  
  // Reset input only when the song actually changes
  useEffect(() => {
    if (currentMusic && prevSongIndexRef.current !== currentSongIndex) {
      inputValueRef.current = '';
      setInputValue('');
      if (inputElementRef.current) {
        inputElementRef.current.value = '';
      }
      prevSongIndexRef.current = currentSongIndex;
    }
    setAttempts([]); // Limpa histórico ao trocar de música
    setAnswered(false); // Garante input habilitado IMEDIATAMENTE
    // --- RESET DE PONTUAÇÃO AUTOMÁTICO SOMENTE NO INÍCIO REAL DA NOVA RODADA ---
    // Removido reset automático de pontos aqui. O controle de reset está apenas no hook de ranking.
    // Limpa a flag quando a rodada avança
    if (salaInfo && salaInfo.musicaAtual > 0) {
      window._jaZerouPontosRodada = false;
    }
  }, [currentSongIndex, salaInfo, currentMusic, shuffledMusics]);

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
                // Playlist carregada
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
        // Error handling for room listening
      }
    };
  
    escutarSala();
  }, []);

  useEffect(() => {
    if (inputElementRef.current) {
      inputElementRef.current.focus();
      // Make sure the cursor is at the end of the input
      const length = inputElementRef.current.value.length;
      inputElementRef.current.setSelectionRange(length, length);
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

  // currentMusic is now defined at the top of the component

  const musicStartTimestamp = salaInfo?.musicStartTimestamp || null;

  const [gamificationMsg, setGamificationMsg] = useState('');
  const [showGamification, setShowGamification] = useState(false);
  const [gamificationTime, setGamificationTime] = useState(0);
  
  // Garante sumiço automático após X segundos
  const handleGamificationClose = useCallback(() => {
    console.log('handleGamificationClose chamado');
    setShowGamification(false);
    
    // Limpa o gamificationTime após a animação de saída
    const timer = setTimeout(() => {
      setGamificationTime(0);
    }, 300);
    
    return () => clearTimeout(timer);
  }, []);
  

  const triggerGamification = useCallback((timeLeft, isAnswerCorrect = true) => {
    // Se a resposta estiver incorreta, não mostramos a mensagem de gamificação
    if (!isAnswerCorrect) {
      return;
    }

    // Usa o tempo exato, sem arredondar, para melhor precisão
    const exactTime = timeLeft;
    
    // Verifica em qual faixa de tempo o tempo se encaixa
    let shouldShowGamification = false;
    
    if (exactTime >= 15) {
      shouldShowGamification = true;
    } else if (exactTime >= 10) {
      shouldShowGamification = true;
    } else if (exactTime >= 5) {
      shouldShowGamification = true;
    } else if (exactTime > 0) {
      shouldShowGamification = true;
    }
    
    console.log('Triggering gamification:', { 
      timeLeft, 
      exactTime,
      shouldShowGamification
    });

    if (!shouldShowGamification) {
      return;
    }

    console.log('Mostrando gamification para tempo:', exactTime);
    
    // Define o tempo e mostra o componente
    setGamificationTime(exactTime);
    setShowGamification(true);
    
    console.log('Gamification visível para tempo:', exactTime);
    
    // Esconde o efeito após 3 segundos
    const hideTimer = setTimeout(() => {
      console.log('Escondendo gamification após timeout');
      setShowGamification(false);
      
      // Limpa o tempo após esconder
      const clearTimer = setTimeout(() => {
        setGamificationTime(0);
      }, 300);
      
      return () => clearTimeout(clearTimer);
    }, 3000);
    
    return () => {
      console.log('Limpando timer do gamification');
      clearTimeout(hideTimer);
    };
  }, []);

  // Função para verificar se a resposta contém exatamente o título e o artista, em qualquer ordem
  const checkAnswer = (answer, title, artist) => {
    if (!answer || !title || !artist) return false;
    
    const cleanAnswer = normalizeText(answer);
    const cleanTitle = normalizeText(title);
    const cleanArtist = normalizeText(artist);
    
    // Cria os padrões de busca exatos
    const pattern1 = `${cleanTitle} ${cleanArtist}`; // Título + Artista
    const pattern2 = `${cleanArtist} ${cleanTitle}`; // Artista + Título
    
    // Verifica se a resposta corresponde exatamente a algum dos padrões
    return cleanAnswer === pattern1 || cleanAnswer === pattern2;
  };

  // Função para normalizar e limpar o texto
  const normalizeText = (str) => {
    if (!str) return '';
    return str
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove caracteres especiais
      .replace(/\s+/g, ' ') // Substitui múltiplos espaços por um único
      .trim();
  };
  
  // Função auxiliar para verificar se a resposta contém exatamente o título ou artista
  const checkExactMatch = (answer, text) => {
    if (!answer || !text) return false;
    return normalizeText(answer) === normalizeText(text);
  };

  // Função para verificar se o texto está contido no outro, ignorando acentos e case
  const containsText = (text, searchText) => {
    if (!text || !searchText) return false;
    return normalizeText(text).includes(normalizeText(searchText));
  };

  // Handler de resposta do usuário
  const handleAnswer = () => {
    if (!answered && currentMusic) {
      const answer = inputValueRef.current.trim();
      // Don't clear the input here - let the song change handle it
      const title = currentMusic.title.replace(/-/g, ' ');
      const artist = currentMusic.artist?.name?.replace(/-/g, ' ') || '';
      
      const isCorrect = checkAnswer(answer, title, artist);
      const hasTitle = checkExactMatch(answer, title);
      const hasArtist = checkExactMatch(answer, artist);
      const hasPartialTitle = !hasTitle && answer.length > 2 && containsText(title, answer);
      const hasPartialArtist = !hasArtist && answer.length > 2 && containsText(artist, answer);
      
      console.log('Resposta:', { 
        answer, 
        title, 
        artist, 
        isCorrect, 
        hasTitle, 
        hasArtist, 
        hasPartialTitle, 
        hasPartialArtist 
      });
      
      if (isCorrect) {
        // Pontuação é exatamente igual aos segundos restantes (máximo 20s)
        const timeLeft = Math.max(0, Math.min(20, Math.floor(currentTimeLeft)));
        const points = timeLeft; // 1 ponto por segundo restante
        
        addPoints(points);
        setFeedback(`Correto! +${points} pontos! (${timeLeft}s)`);
        
        // Dispara a gamificação apenas se a resposta estiver correta
        triggerGamification(currentTimeLeft, true);
      } else if (hasTitle || hasArtist) {
        // Se acertou apenas um (título ou artista), mas não os dois
        const correctPart = hasTitle ? 'o título' : 'o artista';
        const missingPart = hasTitle ? 'o artista' : 'o título';
        setFeedback(`Quase lá! Você acertou ${correctPart}, mas falta ${missingPart}!`);
        // Don't clear input here - let the user see their answer
      } else if (hasPartialTitle || hasPartialArtist) {
        // Se a resposta está contida no título ou artista
        const partialMatch = hasPartialTitle ? 'o título' : 'o artista';
        setFeedback(`Você está no caminho certo! Continue tentando acertar ${partialMatch} completo.`);
        // Don't clear input here - let the user see their answer
      } else {
        setFeedback('Errou! Tente novamente!');
        // Don't clear input here - let the user see their answer
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
      setFeedback(`Tempo esgotado! A música era "${currentMusic.title.replace(/-/g, ' ')}" por ${currentMusic.artist?.name.replace(/-/g, ' ')}`);
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
      // Don't reset input here - it will be handled by the useEffect that watches currentSongIndex
      setFeedback('');
      setAnswered(false); // Garante input destravado
      setCurrentTimeLeft(20);
      setMusicEnded(false);
      hasHandledTimeUp.current = false;
      
      // Focus the input for the next question
      if (inputElementRef.current) {
        inputElementRef.current.focus();
      }
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
        // Error handling for player removal from ranking
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
      registerPlayerInRanking(points ?? 0);
      localStorage.setItem('entrouNaRodada', 'true');
    } else {
      // Debug information for missing nickname/playerKey
    }
    // eslint-disable-next-line
  }, [nickname, playerKey, points]);

  // Monitora currentTimeLeft para mostrar mensagens quando o usuário acertar
  // A gamificação agora só é acionada quando o usuário acerta a resposta
  // através do handleAnswer abaixo



  // Função vazia para manter compatibilidade
  const renderGamification = () => null;

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
      {/* Gamification Effect */}
      <GamificationEffect 
        show={showGamification} 
        timeLeft={gamificationTime} 
        onClose={handleGamificationClose} 
      />
      
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

              <input
                ref={inputElementRef}
                className={`answer-input dark-mode ${feedback.includes('Correto') ? 'input-correct' : feedback.includes('Quase') ? 'input-almost' : feedback.includes('Errou') ? 'input-wrong' : ''}`}
                type="text"
                placeholder="Digite sua resposta"
                value={inputValue}
                onChange={(e) => {
                  const value = e.target.value;
                  inputValueRef.current = value;
                  setInputValue(value);
                }}
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
                style={{ 
                  fontFamily: 'inherit', 
                  fontWeight: 600, 
                  letterSpacing: 0.01, 
                  outline: 0, 
                  borderWidth: 2, 
                  borderColor: feedback.includes('Correto') ? '#16a34a' : 
                              feedback.includes('Quase') ? '#facc15' : 
                              feedback.includes('Errou') ? '#ef4444' : '#64748B', 
                  background: isInputDisabled ? 'rgba(15,23,42,0.1)' : 'rgba(15,23,42,0.3)', 
                  color: '#E2E8F0', 
                  minHeight: 44,
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  marginTop: '10px'
                }}
              />
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
