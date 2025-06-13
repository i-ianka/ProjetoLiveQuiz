import { useEffect, useRef, useState } from 'react';
import '../MusicPlayer.css';

export default function MusicPlayer({
  musicUrl,
  onTimeUp,
  onTimeUpdate,
  isMuted,
  setIsMuted,
  showMuteButtonOnTop,
  musicStartTimestamp,
  musicaAtual = 0,
  refreshTrigger // Adicionado para detectar nova partida
}) {
  const audioRef = useRef(null);
  const [timeLeft, setTimeLeft] = useState(20);
  const hasTimeUpFired = useRef(false);
  const [waitingForUser, setWaitingForUser] = useState(false);
  const [playError, setPlayError] = useState(null);

  function getInicioMusicaAtual() {
    if (!musicStartTimestamp) return null;
    return musicStartTimestamp;
  }

  useEffect(() => {
    // Reseta o estado do timer ao detectar um novo refreshTrigger
    if (refreshTrigger) {
      // Resetando timer devido ao refreshTrigger
      setTimeLeft(20);
      hasTimeUpFired.current = false;
    }
  }, [refreshTrigger]);

  const prevTimestamp = useRef();

  useEffect(() => {
    const lastTimestamp = prevTimestamp.current;
    // Só recalibra se musicStartTimestamp mudou E não é null
    if (!musicStartTimestamp || musicStartTimestamp === lastTimestamp) return;
    prevTimestamp.current = musicStartTimestamp;
    hasTimeUpFired.current = false;
    const inicioMusica = getInicioMusicaAtual();
    const now = Date.now();
    const elapsed = Math.floor((now - inicioMusica) / 1000);
    let initialTimeLeft = Math.min(20, Math.max(0, 20 - elapsed));
    // Nunca permita que o timer aumente
    setTimeLeft(prev => initialTimeLeft < prev ? initialTimeLeft : prev);
    
    const audio = audioRef.current;
    if (audio && audio.readyState >= 2) {
      audio.currentTime = Math.max(0, elapsed);
    } else if (audio) {
      audio.addEventListener('canplay', () => {
        audio.currentTime = Math.max(0, elapsed);
      }, { once: true });
    }
  }, [musicStartTimestamp, musicUrl, musicaAtual]);

  useEffect(() => {
    const inicioMusica = getInicioMusicaAtual();
    if (!inicioMusica) return;
    
    const audio = audioRef.current;
    let isMounted = true;
    let animationFrameId = null;
    let lastUpdateTime = 0;
    const UPDATE_INTERVAL = 16; // ~60 FPS para maior precisão
    
    // Função para sincronizar o áudio com o timer
    const syncAudioWithTimer = () => {
      if (!isMounted || !inicioMusica || !audio) return null;
      
      const now = Date.now();
      const elapsed = Math.max(0, (now - inicioMusica) / 1000); // Tempo em segundos com decimais, nunca negativo
      const targetTime = Math.min(elapsed, 19.99);
      
      // Ajusta a posição do áudio para sincronizar com o timer
      if (audio.readyState >= 2) { // HAVE_CURRENT_DATA ou superior
        const currentTime = audio.currentTime;
        // Só ajusta se a diferença for significativa para evitar estouros
        if (Math.abs(currentTime - targetTime) > 0.1) {
          audio.currentTime = targetTime;
        }
      }
      
      return { now, elapsed, timeLeft: Math.max(0, 20 - elapsed) };
    };
    
    // Função para atualizar o timer
    const updateTimer = (timestamp) => {
      if (!isMounted || !inicioMusica) return;
      
      const now = timestamp || Date.now();
      
      // Limita a taxa de atualização para melhor desempenho
      if (now - lastUpdateTime < UPDATE_INTERVAL) {
        animationFrameId = requestAnimationFrame(updateTimer);
        return;
      }
      lastUpdateTime = now;
      
      // Sincroniza o áudio e obtém o tempo atualizado
      const syncResult = syncAudioWithTimer();
      if (!syncResult) return;
      
      const { timeLeft: newTimeLeft } = syncResult;
      
      // Atualiza o estado com o tempo exato (sem arredondar)
      setTimeLeft(prev => {
        // Só atualiza se a diferença for maior que 0.05s para evitar renderizações desnecessárias
        return Math.abs(prev - newTimeLeft) > 0.05 ? newTimeLeft : prev;
      });
      
      // Atualiza o callback de tempo se fornecido
      if (onTimeUpdate) {
        onTimeUpdate(newTimeLeft);
      }
      
      // Se o tempo acabou e ainda não foi disparado o evento
      if (newTimeLeft <= 0 && !hasTimeUpFired.current) {
        hasTimeUpFired.current = true;
        cancelAnimationFrame(animationFrameId);
        if (audio && !audio.paused) audio.pause();
        if (onTimeUp) onTimeUp(0);
        return;
      }
      
      // Agenda o próximo frame
      animationFrameId = requestAnimationFrame(updateTimer);
    };
    
    // Atualiza imediatamente para evitar atraso inicial
    updateTimer();
    
    // Configura o intervalo para atualizações suaves
    const timer = setInterval(updateTimer, 100);
    
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [musicStartTimestamp, musicUrl, musicaAtual, onTimeUpdate, onTimeUp]);

  const lastMusicUrl = useRef();
  const lastMusicaAtual = useRef();
  const lastMusicStartTimestamp = useRef();

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !musicUrl) return;
    
    // Só reinicie se algum dos parâmetros realmente mudou
    const shouldReload =
      lastMusicUrl.current !== musicUrl ||
      lastMusicaAtual.current !== musicaAtual ||
      lastMusicStartTimestamp.current !== musicStartTimestamp;
      
    if (!shouldReload) return;
    
    // Atualiza as referências
    lastMusicUrl.current = musicUrl;
    lastMusicaAtual.current = musicaAtual;
    lastMusicStartTimestamp.current = musicStartTimestamp;
    
    // Reseta o estado do timer
    setTimeLeft(20);
    hasTimeUpFired.current = false;
    
    // Configura o áudio
    audio.src = musicUrl;
    audio.preload = 'auto';
    
    // Configura o volume inicial
    audio.volume = isMuted ? 0 : 1;
    
    // Função para sincronizar o áudio com o timer
    const syncAudioWithTimer = () => {
      const inicioMusica = getInicioMusicaAtual();
      if (inicioMusica) {
        const now = Date.now();
        const elapsed = (now - inicioMusica) / 1000;
        const targetTime = Math.max(0, Math.min(elapsed, 19.99));
        
        // Ajusta a posição do áudio para sincronizar com o timer
        if (Math.abs(audio.currentTime - targetTime) > 0.1) {
          audio.currentTime = targetTime;
        }
      }
    };
    
    // Função para iniciar a reprodução
    const startPlayback = () => {
      // Primeiro sincroniza a posição do áudio
      syncAudioWithTimer();
      
      // Depois inicia a reprodução
      const playPromise = audio.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            // Sincroniza novamente após o play para garantir
            setTimeout(syncAudioWithTimer, 50);
            setWaitingForUser(false);
            setPlayError(null);
          })
          .catch((error) => {
            if (error.name === 'NotAllowedError' || error.name === 'NotSupportedError') {
              setWaitingForUser(true);
            }
            setPlayError(error);
          });
      }
    };
    
    // Configura os event listeners para sincronização
    const onCanPlay = () => {
      // Quando o áudio estiver pronto para tocar, sincroniza e inicia
      syncAudioWithTimer();
      startPlayback();
    };
    
    const onPlaying = () => {
      // Sincroniza periodicamente enquanto está tocando
      syncAudioWithTimer();
    };
    
    // Adiciona os listeners
    audio.addEventListener('canplay', onCanPlay, { once: true });
    audio.addEventListener('playing', onPlaying);
    
    // Tenta carregar o áudio
    audio.load();
    
    // Timeout de segurança para garantir que a reprodução comece
    const timeoutId = setTimeout(() => {
      if (audio.readyState >= 2) { // HAVE_CURRENT_DATA
        startPlayback();
      }
    }, 100);
    
    return () => {
      clearTimeout(timeoutId);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('playing', onPlaying);
      if (!audio.paused) {
        audio.pause();
      }
    };
    return () => {
      if (!audio.paused) {
        audio.pause();
      }
    };
  }, [musicUrl, musicaAtual, musicStartTimestamp]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.muted = isMuted;
    }
  }, [isMuted]);

  const handleUserPlay = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.play().then(() => {
        setWaitingForUser(false);
        setPlayError(null);
      }).catch((error) => {
        setPlayError(error);
      });
    }
  };

  return (
    <div className={`music-player${timeLeft <= 5 ? ' pulse' : ''}`}>
      {waitingForUser && (
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <button onClick={handleUserPlay} className="mute-button" style={{ marginBottom: 8 }}>
            ▶️ Clique para ativar o som
          </button>
          <div style={{ color: '#fbbf24', fontSize: 13, marginTop: 4 }}>
            O navegador bloqueou o áudio após o refresh. Clique para liberar!
          </div>
        </div>
      )}
      {showMuteButtonOnTop && (
        <button
          onClick={() => setIsMuted(!isMuted)}
          className={`mute-button ${isMuted ? 'muted' : ''}`}
          style={{ marginBottom: '0.7rem' }}
        >
          {isMuted ? '🔇 Desmutar' : '🔊 Mutar'}
        </button>
      )}
      {musicUrl ? (
        <audio ref={audioRef} />
      ) : (
        <div className="no-music">Nenhuma música disponível</div>
      )}
      <div className="progress-container">
        <div className="progress-bar">
          <div 
            className="progress-fill"
            style={{ width: `${(timeLeft / 20) * 100}%` }}
          />
        </div>
        <div className="time-display">
          ⏳ {timeLeft}s
        </div>
      </div>
      {!showMuteButtonOnTop && (
        <button
          onClick={() => setIsMuted(!isMuted)}
          className={`mute-button ${isMuted ? 'muted' : ''}`}
        >
          {isMuted ? '🔇 Desmutar' : '🔊 Mutar'}
        </button>
      )}
    </div>
  );
}
