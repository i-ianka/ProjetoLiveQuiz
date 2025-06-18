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
  const [attempts, setAttempts] = useState([]); // Histórico de tentativas do usuário
  const [isMuted, setIsMuted] = useState(false); // Estado para controle de mudo
  const [feedback, setFeedback] = useState(''); // Feedback para o jogador (Correto, Quase, Errou)
  const [pontosParciais, setPontosParciais] = useState({ artista: false, musica: false }); // Controla o que já foi pontuado
  const [correctParts, setCorrectParts] = useState({ title: '', artist: '' }); // Partes corretas já identificadas
  const [inputText, setInputText] = useState(''); // Texto atual do input
  const [lockedText, setLockedText] = useState(''); // Texto bloqueado (em verde)
  const [isInputLocked, setIsInputLocked] = useState(false); // Se o input está bloqueado para edição

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
  
  // Reset input e estado de pontuação quando a música muda
  useEffect(() => {
    if (currentMusic && prevSongIndexRef.current !== currentSongIndex) {
      inputValueRef.current = '';
      setInputValue('');
      setInputText('');
      setLockedText('');
      setCorrectParts({ title: '', artist: '' });
      setPontosParciais({ artista: false, musica: false }); // Reseta os pontos parciais
      setAttempts([]); // Limpa o histórico de tentativas
      setFeedback(''); // Limpa a mensagem de feedback
      setIsInputLocked(false);
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
  const [bonusMessage, setBonusMessage] = useState('');
  
  // Garante sumiço automático após X segundos
  const handleGamificationClose = useCallback(() => {
    console.log('handleGamificationClose chamado');
    setShowGamification(false);
    setGamificationTime(0);
    setBonusMessage('');
    
    // Limpa o gamificationTime após a animação de saída
    const timer = setTimeout(() => {
      setGamificationTime(0);
    }, 300);
    
    return () => clearTimeout(timer);
  }, []);
  

  const triggerGamification = useCallback((timeLeft, isAnswerCorrect = true, bonusMsg = '') => {
    // Se a resposta estiver incorreta, não mostramos a mensagem de gamificação
    if (!isAnswerCorrect) {
      return;
    }

    // Usa o tempo exato, sem arredondar, para melhor precisão
    const exactTime = timeLeft;
    
    // Se houver mensagem de bônus, armazena
    if (bonusMsg) {
      setBonusMessage(bonusMsg);
    }
    
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

  // Função para verificar se a resposta está correta
  const checkAnswer = (answer, title, artist) => {
    if (!answer || !title) return false;
    
    const cleanAnswer = normalizeText(answer);
    const cleanTitle = normalizeText(title);
    const cleanArtist = artist ? normalizeText(artist) : '';
    
    // Verifica se a resposta contém tanto o título quanto o artista (em qualquer ordem)
    const containsTitle = cleanTitle && cleanAnswer.includes(cleanTitle);
    const containsArtist = cleanArtist && cleanAnswer.includes(cleanArtist);
    
    // Se a resposta contém tanto o título quanto o artista, está correto
    if (containsTitle && containsArtist) {
      return true;
    }
    
    // Se a resposta é exatamente o título ou o artista, também está correto
    if (cleanAnswer === cleanTitle || cleanAnswer === cleanArtist) {
      return true;
    }
    
    return false;
  };

  // Função para normalizar e limpar o texto
  const normalizeText = (str) => {
    if (!str) return '';
    return str
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .toLowerCase()
      .replace(/&/g, 'e') // Substitui '&' por 'e'
      .replace(/[^\w\s]/g, '') // Remove outros caracteres especiais
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

  // Função para verificar e bloquear partes corretas da resposta
  const updateLockedText = (answer, title, artist) => {
    const cleanAnswer = normalizeText(answer);
    const cleanTitle = normalizeText(title);
    const cleanArtist = artist ? normalizeText(artist) : '';
    
    let newLockedText = '';
    let newInputText = answer;
    let newCorrectParts = { ...correctParts };
    let hasTitle = false;
    let hasArtist = false;
    
    // Verifica se a resposta contém o título
    if (cleanTitle && cleanAnswer.includes(cleanTitle)) {
      newLockedText = title;
      newInputText = '';
      newCorrectParts.title = title;
      hasTitle = true;
    }
    
    // Verifica se a resposta contém o artista
    if (cleanArtist && cleanAnswer.includes(cleanArtist)) {
      if (newLockedText) newLockedText += ' ' + artist;
      else newLockedText = artist;
      newInputText = '';
      newCorrectParts.artist = artist;
      hasArtist = true;
    }
    
    setLockedText(newLockedText);
    setInputText(newInputText);
    setCorrectParts(newCorrectParts);
    
    // Se ambos foram acertados, bloqueia o input
    if (newCorrectParts.title && newCorrectParts.artist) {
      setIsInputLocked(true);
    }
    
    return { hasTitle, hasArtist };
  };

  // Handler de resposta do usuário
  const handleAnswer = () => {
    if (!answered && currentMusic) {
      const answer = inputValueRef.current.trim();
      // Don't clear the input here - let the song change handle it
      const title = currentMusic.title.replace(/-/g, ' ');
      const artist = currentMusic.artist?.name?.replace(/-/g, ' ') || '';
      
      // Atualiza as partes corretas e verifica acertos
      const { hasTitle, hasArtist } = updateLockedText(answer, title, artist);
      const currentAnswer = lockedText ? `${lockedText} ${inputText}`.trim() : inputText;
      
      // Já temos hasTitle e hasArtist do retorno de updateLockedText
      const isCorrect = hasTitle && hasArtist;
      
      // Verifica acertos parciais (quando o usuário digita apenas parte do título/artista)
      const hasPartialTitle = !hasTitle && answer.length > 2 && containsText(title, answer);
      const hasPartialArtist = artist && !hasArtist && answer.length > 2 && containsText(artist, answer);
      
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
      
      // Calcula pontos baseado no que foi acertado e no que já foi pontuado
      let pontosASomar = 0;
      let feedbackMsg = '';
      let acertouAlgo = false;

      // Verifica se acertou o artista e ainda não pontuou
      if (hasArtist && !pontosParciais.artista) {
        const pontosArtista = Math.ceil(currentTimeLeft * 0.5);
        pontosASomar += pontosArtista;
        setPontosParciais(prev => ({ ...prev, artista: true }));
        // Não adiciona mensagem ainda, vamos verificar se acertou tudo
        acertouAlgo = true;
      }

      // Verifica se acertou a música e ainda não pontuou
      if (hasTitle && !pontosParciais.musica) {
        const pontosMusica = Math.ceil(currentTimeLeft * 0.5);
        pontosASomar += pontosMusica;
        setPontosParciais(prev => ({ ...prev, musica: true }));
        // Não adiciona mensagem ainda, vamos verificar se acertou tudo
        acertouAlgo = true;
      }
      
      // Verifica se acertou ambos na mesma tentativa sem ter pontuado antes
      const acertouTudoAgora = hasArtist && hasTitle && 
                              !pontosParciais.artista && !pontosParciais.musica;
      
      // Se acertou tudo de uma vez (bônus)
      if (acertouTudoAgora) {
        const pontosBONUS = 2; // Bônus por acertar tudo de uma vez
        const pontosTempo = Math.ceil(currentTimeLeft);
        
        // Adiciona os pontos do tempo primeiro
        addPoints(pontosTempo);
        
        // Cria a mensagem de feedback
        feedbackMsg = `Acertou tudo! +${pontosTempo} pontos!`;
        setFeedback(feedbackMsg);
        
        // Mostra o efeito de gamificação
        triggerGamification(currentTimeLeft, true);
        
        // Adiciona o bônus após um pequeno delay para garantir que a primeira mensagem apareça
        setTimeout(() => {
          // Adiciona os pontos do bônus
          addPoints(pontosBONUS);
          
          // Atualiza a mensagem para incluir o bônus
          const mensagemBonus = `🎉 BÔNUS: +${pontosBONUS} por acertar tudo de uma vez!`;
          setFeedback(`${feedbackMsg}\n${mensagemBonus}`);
          
          // Atualiza o feedbackMsg para garantir consistência
          feedbackMsg = `${feedbackMsg}\n${mensagemBonus}`;
        }, 500);
      } 
      // Se já tinha acertado um e acertou o outro agora (sem bônus)
      else if (pontosParciais.artista !== hasArtist || pontosParciais.musica !== hasTitle) {
        if (hasArtist && hasTitle) {
          feedbackMsg = `Acertou tudo! +${Math.ceil(currentTimeLeft)} pontos!`;
        } else if (hasArtist) {
          feedbackMsg = `Acertou o artista! +${Math.ceil(currentTimeLeft * 0.5)} pontos!`;
        } else if (hasTitle) {
          feedbackMsg = `Acertou a música! +${Math.ceil(currentTimeLeft * 0.5)} pontos!`;
        }
      }

      // Adiciona a tentativa ao histórico
      setAttempts(prev => [...prev, answer]);

      // Verifica se acertou tudo de uma vez
      const acertouTudo = isCorrect && !pontosParciais.artista && !pontosParciais.musica;
      
      if (acertouTudo) {
        const pontosTotais = Math.ceil(currentTimeLeft);
        feedbackMsg = `Acertou tudo! +${pontosTotais} pontos!`;
        addPoints(pontosTotais);
        setPontosParciais({ artista: true, musica: true });
        setFeedback(feedbackMsg);
        triggerGamification(currentTimeLeft, true);
      } 
      // Se acertou alguma parte
      else if (pontosASomar > 0) {
        addPoints(pontosASomar);
        setFeedback(feedbackMsg);
      } 
      // Se está no caminho certo (resposta parcial)
      else if (hasPartialTitle || hasPartialArtist) {
        // Se a resposta está contida no título ou artista, mas não acertou completo ainda
        const partialMatch = hasPartialTitle ? 'o título' : 'o artista';
        setFeedback(`Você está no caminho certo! Continue tentando acertar ${partialMatch} completo.`);
      } else if (answer && !acertouAlgo) {
        setFeedback('Errou! Tente novamente!');
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
      }, 3000); // Aumentado para 3 segundos
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

  // Input fica desabilitado apenas se:
  // 1. Não houver música atual
  // 2. A música não tiver preview
  // 3. O jogador já tiver respondido corretamente
  // 4. A música já tiver terminado E o tempo tiver esgotado
  const isInputDisabled = !currentMusic || !currentMusic.preview || answered || (musicEnded && currentTimeLeft <= 0);

  // Monitora mudanças na música e no tempo para garantir que o input seja habilitado corretamente
  useEffect(() => {
    // Se o tempo for maior que 0 e a música não tiver terminado, garante que o input esteja habilitado
    if (currentTimeLeft > 0 && !musicEnded && currentMusic?.preview) {
      setAnswered(false);
    }
  }, [currentTimeLeft, musicEnded, currentMusic]);

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
        bonusMessage={bonusMessage}
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
              <h2 className="game-title">
                {salaInfo && salaInfo.musicaAtual >= salaInfo.playlist.length
                  ? 'Rodada finalizada!'
                  : `🎶 Música ${currentSongIndex + 1} de ${shuffledMusics.length}`}
              </h2>
            </div>

            <div className="player-info dark-mode">
              Jogador: <span>{displayAvatar} {displayName}</span>
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

              <div className="answer-input-container" style={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                alignItems: 'center',
                minHeight: 44,
                width: '100%',
                padding: '2px',
                borderRadius: '8px',
                border: '2px solid',
                borderColor: feedback.includes('Correto') ? '#16a34a' : 
                            feedback.includes('Quase') ? '#facc15' : 
                            feedback.includes('Errou') ? '#ef4444' : '#64748B',
                background: isInputDisabled ? 'rgba(15,23,42,0.1)' : 'rgba(15,23,42,0.3)'
              }}>
                {lockedText && (
                  <span style={{ 
                    color: '#10b981', 
                    fontWeight: 600, 
                    padding: '8px',
                    whiteSpace: 'pre'
                  }}>
                    {lockedText}
                  </span>
                )}
                <input
                  ref={inputElementRef}
                  className="answer-input"
                  type="text"
                  placeholder={lockedText ? '' : 'Digite sua resposta'}
                  value={inputText}
                  onChange={(e) => {
                    if (!isInputLocked) {
                      const value = e.target.value;
                      inputValueRef.current = lockedText ? `${lockedText} ${value}`.trim() : value;
                      setInputText(value);
                    }
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleAnswer();
                    // Impede apagar texto travado com backspace/delete
                    if ((e.key === 'Backspace' || e.key === 'Delete') && lockedText && !inputText) {
                      e.preventDefault();
                    }
                  }}
                  onPaste={e => {
                    e.preventDefault();
                    if (!isInputLocked) {
                      const paste = (e.clipboardData || window.clipboardData).getData('text');
                      const newValue = inputText + paste;
                      inputValueRef.current = lockedText ? `${lockedText} ${newValue}`.trim() : newValue;
                      setInputText(newValue);
                    }
                  }}
                  disabled={isInputDisabled || isInputLocked}
                  autoFocus
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-label="Resposta da música"
                  style={{ 
                    flex: 1, 
                    minWidth: '100px',
                    fontFamily: 'inherit', 
                    fontWeight: 600, 
                    letterSpacing: 0.01, 
                    outline: 'none', 
                    border: 'none',
                    background: 'transparent', 
                    color: '#E2E8F0',
                    padding: '8px',
                    margin: 0
                  }}
                />
              </div>
              <div style={{marginTop: 12, width: '100%'}}>
                {feedback && (
                  <div style={{
                    color: '#fff',
                    fontWeight: 500,
                    marginBottom: attempts.length > 0 ? 8 : 0,
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '0.85em',
                    backgroundColor: feedback.includes('Errou') ? 'rgba(239, 68, 68, 0.2)' : 
                                 feedback.includes('caminho certo') ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                    border: `1px solid ${
                      feedback.includes('Errou') ? '#ef4444' : 
                      feedback.includes('caminho certo') ? '#f59e0b' : '#10b981'
                    }`,
                    whiteSpace: 'pre-line' // Permite quebras de linha no texto
                  }}>
                    {feedback}
                  </div>
                )}
                {attempts.length > 0 && (
                  <div className="attempt-history" style={{ 
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px',
                    alignItems: 'center',
                    fontSize: '0.9em',
                    color: '#a78bfa'
                  }}>
                    <span style={{fontWeight: 600, color: '#c4b5fd'}}>Tentativas:</span>
                    {attempts.map((a, i) => (
                      <span 
                        key={i} 
                        style={{
                          background: '#1e293b',
                          color: '#e2e8f0',
                          borderRadius: '12px',
                          padding: '2px 10px',
                          fontWeight: 500,
                          border: '1px solid #334155',
                          fontSize: '0.88em'
                        }}
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

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
            <h3 className="game-title">🎵 Músicas Anteriores</h3>
            <PreviousSongsList songs={previousSongs} />
          </div>
        </div>
      </div>
    </div>
  );
}
