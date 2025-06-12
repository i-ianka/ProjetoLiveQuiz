import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSalaAtualStartOptions, ouvirSalaStartOptions } from '../../services/firebaseSalaStartOptions';

export default function StartOptions({ onStart, onBackToLogin }) {
  const [waiting, setWaiting] = useState(false);
  const [sala, setSala] = useState(null);
  const navigate = useNavigate();
  const salaRef = useRef(sala);

  useEffect(() => {
    salaRef.current = sala;
  }, [sala]);

  useEffect(() => {
    if (!sala) return;
  }, [sala]);

  useEffect(() => {
    getSalaAtualStartOptions().then((s) => {
      setSala(s);
      if (!s || !s.nextRoundStart || s.nextRoundStart < Date.now()) {
        import('../../services/firebaseSalaService').then(mod => {
          if (mod.garantirNextRoundStartValido) {
            mod.garantirNextRoundStartValido();
          }
        });
      }
    });

    let unsub = ouvirSalaStartOptions((s) => {
      setSala(s);
    });

    return () => {
      unsub && unsub();
    };
  }, []);

  // Redireciona apenas se a rodada REALMENTE começou
  useEffect(() => {
    if (!waiting || !sala) return;

    const agora = Date.now();
    const rodadaComecou =
      sala.musicaAtual === 0 &&
      sala.musicStartTimestamp &&
      agora >= sala.musicStartTimestamp;

    if (rodadaComecou) {
      setWaiting(false);
      onStart && onStart();
      navigate('/game');
    }
  }, [waiting, sala, onStart, navigate]);

  // Nunca redirecionar para ranking aqui
  useEffect(() => {
    if (!sala || sala.encerrada || sala.finalizada) {
      setWaiting(true);
      return;
    }
  }, [sala]);

  const [roundTimeLeft, setRoundTimeLeft] = useState(null);
  const roundTimerRef = useRef(null);

  // Timer para próxima rodada, com +20s de intervalo
  useEffect(() => {
    if (roundTimerRef.current) {
      clearInterval(roundTimerRef.current);
      roundTimerRef.current = null;
    }

    if (!sala || !sala.nextRoundStart) {
      setRoundTimeLeft(null);
      return;
    }

    const PROXIMA_RODADA = sala.nextRoundStart + 20000;

    function update() {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((PROXIMA_RODADA - now) / 1000));
      setRoundTimeLeft(diff);
      if (diff <= 0 && roundTimerRef.current) {
        clearInterval(roundTimerRef.current);
        roundTimerRef.current = null;
      }
    }

    update();
    roundTimerRef.current = setInterval(update, 1000);

    return () => {
      if (roundTimerRef.current) clearInterval(roundTimerRef.current);
    };
  }, [sala]);

  function formatFriendlyTime(seconds) {
    if (seconds == null || isNaN(seconds)) return '';
    if (seconds <= 0) return '0s';
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    if (min > 0) return `${min}m ${sec.toString().padStart(2, '0')}s`;
    return `${sec}s`;
  }

  function handleEnterCurrent() {
    setWaiting(false);
    localStorage.setItem('entrouNaRodada', 'true');
    onStart && onStart();
    navigate('/game');
  }

  function handleEsperarProximaRodada() {
    // Verifica se a música ainda não começou
    if (sala && sala.musicaAtual === 0 && sala.musicStartTimestamp && Date.now() >= sala.musicStartTimestamp) {
      // Permite entrar na rodada caso a música atual tenha começado e a rodada já tenha iniciado
      setWaiting(false);
      onStart && onStart();
      navigate('/game');
    } else {
      // Caso contrário, o usuário ficará esperando pela próxima rodada
      setWaiting(true);
    }
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <button
        className="login-btn"
        style={{ marginBottom: 16 }}
        onClick={() => onBackToLogin && onBackToLogin()}
      >
        🏠 Voltar para o início
      </button>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button
          className="login-btn"
          onClick={handleEnterCurrent}
        >
          🎮 Entrar na rodada atual
        </button>
        <button
          className="login-btn"
          onClick={handleEsperarProximaRodada}
          disabled={waiting}
        >
          {waiting ? '✅ Aguardando próxima rodada...' : '⏳ Esperar próxima rodada'}
        </button>
      </div>

      {roundTimeLeft !== null && roundTimeLeft > 0 && (
        <div style={{
          marginTop: 16,
          marginBottom: 8,
          textAlign: 'center',
          fontWeight: 600,
          fontSize: 22,
          color: '#fff',
          background: '#3730a3',
          borderRadius: 10,
          padding: '8px 0',
          boxShadow: '0 2px 10px #3730a344',
          letterSpacing: 1,
          fontFamily: 'inherit',
          maxWidth: 320,
          marginLeft: 'auto',
          marginRight: 'auto',
          border: '2px solid #a78bfa',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8
        }}>
          <span style={{
            fontWeight: 700,
            fontSize: 18,
            color: '#a78bfa',
            letterSpacing: 1
          }}>
            Próxima rodada em
          </span>
          <span style={{
            color: '#fff',
            fontWeight: 800,
            fontSize: 27,
            fontFamily: 'monospace',
            background: '#a78bfa',
            borderRadius: 7,
            padding: '2px 10px',
            marginLeft: 6,
            boxShadow: '0 1px 4px #a78bfa66'
          }}>
            {formatFriendlyTime(roundTimeLeft)}
          </span>
        </div>
      )}
    </div>
  );
}
