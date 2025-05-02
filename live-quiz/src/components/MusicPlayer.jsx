import { useEffect, useRef, useState } from 'react';
import './MusicPlayer.css';

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
      console.log('[DEBUG] Resetando timer devido ao refreshTrigger');
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
    const timer = setInterval(() => {
      if (!isMounted) return;
      const elapsed = Math.floor((Date.now() - inicioMusica) / 1000);
      const newTimeLeft = Math.min(20, Math.max(0, 20 - elapsed)); // clamp para nunca passar de 20
      setTimeLeft(newTimeLeft);
      if (onTimeUpdate) {
        onTimeUpdate(newTimeLeft);
      }
      if (elapsed < 0 || newTimeLeft > 20) {
        console.warn('[MusicPlayer] Timer inconsistente detectado!', {
          musicaAtual,
          musicStartTimestamp,
          now: Date.now(),
          inicioMusica,
          elapsed,
          newTimeLeft
        });
      }
      if (newTimeLeft <= 0 && !hasTimeUpFired.current) {
        hasTimeUpFired.current = true;
        clearInterval(timer);
        if (audio && !audio.paused) audio.pause();
        if (onTimeUp) onTimeUp(0);
      }
    }, 1000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [musicStartTimestamp, musicUrl, musicaAtual]);

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
    lastMusicUrl.current = musicUrl;
    lastMusicaAtual.current = musicaAtual;
    lastMusicStartTimestamp.current = musicStartTimestamp;
    audio.src = musicUrl;
    audio.load();
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((error) => {
        if (error.name === 'NotAllowedError') {
          setWaitingForUser(true);
          setPlayError(error);
        } else {
          setPlayError(error);
        }
      });
    }
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
