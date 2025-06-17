import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../../hooks/useGame';
import StartOptions from './StartOptions';
import '../LoginPage.css';
import { nicknameBlacklist } from '../nicknameBlacklist';
import { nicknameAvatars } from '../nicknameAvatars';

export default function StartPage() {
  const { setNickname } = useGame();
  const [name, setName] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [avatarIdx, setAvatarIdx] = useState(0);
  const [error, setError] = useState('');
  const [suggestions] = useState([
    'RockStar', 'PopQueen', 'DJMix', 'MCBeats', 'GuitarHero', 'Batera', 'SaxLover', 'PianoKing', 'FunkMaster', 'JazzCat', 'IndieVibes', 'DiscoDuck', 'ReggaeMan', 'MetalHead', 'ChillWave'
  ]);

  // Função para fechar o modal ao clicar fora
  const handleOverlayClick = (e, setter) => {
    if (e.target === e.currentTarget) {
      setter(false);
    }
  };

  const navigate = useNavigate();

  function normalizeForModeration(nick) {
    // Remove acentos, substitui caracteres comuns de leet e símbolos por letras equivalentes
    return nick
      .normalize('NFD').replace(/[\u0300-\u036F]/g, '')
      .replace(/[@4]/gi, 'a')
      .replace(/[1!|íìîï]/gi, 'i')
      .replace(/[3€êéèë]/gi, 'e')
      .replace(/[0ºóòôõö]/gi, 'o')
      .replace(/[5$]/gi, 's')
      .replace(/[7+]/gi, 't')
      .replace(/[8]/gi, 'b')
      .replace(/[9]/gi, 'g')
      .replace(/[2]/gi, 'z')
      .replace(/[#]/g, 'c')
      .replace(/[^a-z0-9_]/gi, '') // remove outros símbolos
      .toLowerCase();
  }

  function validateNickname(nick) {
    const trimmed = nick.trim();
    if (trimmed.length < 3) return 'Nickname deve ter pelo menos 3 letras.';
    if (trimmed.length > 15) return 'Nickname deve ter no máximo 15 letras.';
    if (!/^[\w_]+$/i.test(trimmed)) return 'Use apenas letras, números e _';
    const normalized = normalizeForModeration(trimmed);
    for (const bad of nicknameBlacklist) {
      if (normalized.includes(bad)) return 'Este nickname foi bloqueado por moderação de conteúdo. Não utilize termos ofensivos, preconceituosos ou discriminatórios.';
    }
    return '';
  }

  const handleStart = () => {
    const err = validateNickname(name);
    setError(err);
    if (!err) {
      // Salva nickname como string simples para o backend/ranking
      setNickname({ name: name.trim(), avatar: nicknameAvatars[avatarIdx] });
      // Também salva no localStorage como string (para persistência)
      localStorage.setItem('nickname', name.trim());
      localStorage.setItem('avatar', JSON.stringify(nicknameAvatars[avatarIdx]));
      setShowOptions(true);
    }
  };

  // Sugestão automática ao clicar
  function handleSuggestion(sug) {
    setName(sug);
    setError('');
  }

  // Avatar cycling
  function nextAvatar() {
    setAvatarIdx((idx) => (idx + 1) % nicknameAvatars.length);
  }
  function prevAvatar() {
    setAvatarIdx((idx) => (idx - 1 + nicknameAvatars.length) % nicknameAvatars.length);
  }

  // Callback para StartOptions
  const handleStartOptions = (resetToLogin = false) => {
    setShowOptions(false); // sempre fecha as opções
    if (resetToLogin) {
      setName('');
      setError('');
      setAvatarIdx(0);
    } else {
      navigate('/game');
    }
  };

  return (
    <div className="login-bg-animated">
      {/* Muitas notas musicais animadas */}
      {[...Array(16)].map((_, i) => {
        // Espalha as notas horizontalmente e alterna emojis
        const notes = ['\u{1F3B5}', '\u{1F3B6}', '\u{1D11E}', '\u{1F3BC}'];
        const left = 5 + i * 6; // de 5% a 95%
        const emoji = notes[i % notes.length];
        const delay = (i % 8) * 0.9 + (i % 3) * 0.3;
        const size = 1.5 + (i % 4) * 0.4;
        return (
          <span
            key={i}
            className="note"
            style={{
              left: `${left}%`,
              animationDelay: `${delay}s`,
              fontSize: `${size}rem`,
              top: '90vh',
              filter: `blur(${i%5===0?1.5:i%4===0?1:0}px)`
            }}
            dangerouslySetInnerHTML={{ __html: emoji }}
          />
        );
      })}
      <div className="login-container">
        <div className="login-card">
          {/* Botão para abrir instruções de como jogar */}
          <button
            className="login-btn"
            style={{ marginBottom: 10, background: '#ede9fe', color: '#7c3aed', fontWeight: 700 }}
            onClick={() => setShowHowToPlay(true)}
          >
            ❓ Como jogar?
          </button>
          {/* Modal de instruções */}
          {showHowToPlay && (
            <div 
              onClick={(e) => handleOverlayClick(e, setShowHowToPlay)}
              style={{
                position: 'fixed',
                top: 0, left: 0, width: '100vw', height: '100vh',
                background: 'rgba(60, 30, 120, 0.22)',
                zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
              <div 
                style={{
                  background: '#1e1b4b',
                  borderRadius: 16,
                  padding: '32px 28px',
                  maxWidth: '95%',
                  width: '90vw',
                  maxHeight: '90vh',
                  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.5)',
                  position: 'relative',
                  textAlign: 'center',
                  fontSize: '1.3rem',
                  lineHeight: '1.8',
                  color: '#e9d5ff',
                  border: '1px solid #7c3aed'
                }}
                onClick={e => e.stopPropagation()}
              >
                <button
                  onClick={() => setShowHowToPlay(false)}
                  style={{ 
                    position: 'absolute', 
                    top: 12, 
                    right: 18, 
                    background: 'none', 
                    border: 'none', 
                    fontSize: 22, 
                    color: '#a78bfa', 
                    cursor: 'pointer',
                    transition: 'color 0.2s'
                  }}
                  onMouseOver={(e) => e.target.style.color = '#fff'}
                  onMouseOut={(e) => e.target.style.color = '#a78bfa'}
                  aria-label="Fechar"
                >✖</button>
                <div style={{ overflowY: 'auto', padding: '10px', maxHeight: 'calc(90vh - 100px)' }}>
                  <h2 style={{ color: '#c4b5fd', marginBottom: '20px', fontSize: '2rem', fontWeight: 'bold' }}>Como jogar?</h2>
                  <ol style={{ margin: '0 auto 20px', color: '#e9d5ff', padding: 0, maxWidth: '700px' }}>
                    <li style={{ marginBottom: '12px', listStyle: 'none', fontSize: '1.2rem' }}>1. Digite seu nickname e clique em "Começar Jogo".</li>
                    <li style={{ marginBottom: '12px', listStyle: 'none', fontSize: '1.2rem' }}>2. Escolha entre entrar na rodada atual ou aguardar a próxima.</li>
                    <li style={{ marginBottom: '12px', listStyle: 'none', fontSize: '1.2rem' }}>3. Ouça a prévia da música e tente adivinhar o artista e o nome da faixa.</li>
                    <li style={{ marginBottom: '12px', listStyle: 'none', fontSize: '1.2rem' }}>4. Digite sua resposta antes do tempo acabar!</li>
                    <li style={{ marginBottom: '12px', listStyle: 'none', fontSize: '1.2rem' }}>5. Ao final da rodada, veja seu ranking e prepare-se para a próxima!</li>
                  </ol>
                  
                  <h3 style={{ color: '#c4b5fd', margin: '30px 0 12px 0', fontSize: '1.6rem', fontWeight: 'bold' }}>Pontuação</h3>
                  <ul style={{ margin: '0 auto 20px', color: '#e9d5ff', padding: 0, maxWidth: '700px' }}>
                    <li style={{ marginBottom: '10px', listStyle: 'none', fontSize: '1.1rem' }}><strong>🎯 Acertar o artista:</strong> +50% dos pontos do tempo restante</li>
                    <li style={{ marginBottom: '10px', listStyle: 'none', fontSize: '1.1rem' }}><strong>🎵 Acertar a música:</strong> +50% dos pontos do tempo restante</li>
                    <li style={{ marginBottom: '10px', listStyle: 'none', fontSize: '1.1rem' }}><strong>🏆 Bônus:</strong> +2 pontos extras por acertar tudo de uma vez!</li>
                    <li style={{ marginBottom: '10px', listStyle: 'none', fontSize: '1.1rem' }}>⏱️ Quanto mais rápido responder, mais pontos você ganha!</li>
                  </ul>
                  
                  <div style={{ color: '#e9d5ff', fontWeight: 500, margin: '30px auto 10px', maxWidth: '700px' }}>
                    <div style={{ marginBottom: '12px', fontSize: '1.3rem', fontWeight: 'bold', color: '#c4b5fd' }}>💡 <strong>Dica:</strong> Tente acertar artista e música juntos para ganhar o bônus!</div>
                    <div style={{ marginBottom: '12px', fontSize: '1.1rem' }}>As músicas são prévias oficiais da API do Deezer.</div>
                    <div style={{ fontSize: '1.1rem' }}>Para reprodução completa das músicas acesse <a href="https://www.deezer.com" target="_blank" rel="noopener noreferrer" style={{ color: '#a78bfa', textDecoration: 'underline', fontWeight: 500 }}>a Deezer</a>.</div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* Botão para abrir o modal Sobre o Projeto */}
          <div style={{ marginBottom: 16, position: 'relative', width: '100%' }}>
            <button
              className="login-btn"
              style={{ background: '#ede9fe', color: '#7c3aed', fontWeight: 700, width: '100%' }}
              onClick={() => setShowAbout(true)}
            >
              ℹ️ Sobre o projeto
            </button>
            
            {/* Modal Sobre o Projeto */}
            {showAbout && (
              <div 
                onClick={(e) => handleOverlayClick(e, setShowAbout)}
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0,0,0,0.7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1000,
                  padding: '16px',
                  cursor: 'pointer'
                }}>
                <div 
                  style={{
                    background: '#1e1b4b',
                    borderRadius: '16px',
                    padding: '24px',
                    width: '100%',
                    maxWidth: '600px',
                    maxHeight: '90vh',
                    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.5)',
                    position: 'relative',
                    textAlign: 'center',
                    fontSize: '1.3rem',
                    lineHeight: '1.6',
                    cursor: 'default',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    color: '#e9d5ff',
                    border: '1px solid #7c3aed'
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    onClick={() => setShowAbout(false)}
                    style={{
                      position: 'absolute',
                      top: '12px',
                      right: '18px',
                      background: 'none',
                      border: 'none',
                      fontSize: '24px',
                      color: '#a78bfa',
                      cursor: 'pointer',
                      zIndex: 10,
                      transition: 'color 0.2s'
                    }}
                    onMouseOver={(e) => e.target.style.color = '#fff'}
                    onMouseOut={(e) => e.target.style.color = '#a78bfa'}
                    aria-label="Fechar"
                  >✖</button>
                  
                  <div style={{ overflowY: 'auto', padding: '10px', maxHeight: 'calc(90vh - 100px)' }}>
                    <h3 style={{ color: '#c4b5fd', marginBottom: '24px', fontSize: '2rem', fontWeight: 'bold' }}>Sobre o projeto</h3>
                    <div style={{ color: '#e9d5ff', maxWidth: '600px', margin: '0 auto' }}>
                      <p style={{ margin: '0 0 20px 0', fontSize: '1.2rem' }}>Este quiz musical foi desenvolvido como um projeto educacional e de entretenimento.</p>
                      <p style={{ margin: '0 0 20px 0', fontSize: '1.2rem' }}><strong style={{ color: '#c4b5fd' }}>Stack:</strong> ReactJS, Firebase Realtime Database, API do Deezer, JavaScript.</p>
                      <p style={{ margin: '0 0 20px 0', fontSize: '1.2rem' }}><strong style={{ color: '#c4b5fd' }}>Desenvolvido por:</strong> I Ianka</p>
                      <p style={{ margin: 0, fontSize: '1.2rem' }}>Para dúvidas ou sugestões, entre em contato!</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          {!showOptions && (
            <>
              <h1 className="login-title">🎵 Bem-vindo ao QuizParty!</h1>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#6366f1', fontWeight: 600, fontSize: 17, marginBottom: 2 }}>
                  Escolha um ícone musical para acompanhar seu nickname:
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <button aria-label="Avatar anterior" onClick={prevAvatar} style={{ fontSize: 26, background: 'none', border: 'none', cursor: 'pointer' }}>◀️</button>
                  <span style={{ fontSize: 36 }} role="img" aria-label={nicknameAvatars[avatarIdx].label}>{nicknameAvatars[avatarIdx].emoji}</span>
                  <button aria-label="Avatar próximo" onClick={nextAvatar} style={{ fontSize: 26, background: 'none', border: 'none', cursor: 'pointer' }}>▶️</button>
                </div>
                <span style={{ color: '#7c3aed', fontWeight: 500, fontSize: 15 }}>{nicknameAvatars[avatarIdx].label}</span>
                <input
                  type="text"
                  placeholder="Seu Nickname (ex: RockStar123)"
                  value={name}
                  onChange={e => {
                    setName(e.target.value.replace(/\s{2,}/g, ' '));
                    setError(validateNickname(e.target.value));
                  }}
                  className={`login-input${error ? ' login-input-error' : ''}`}
                  autoFocus
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  inputMode="text"
                  maxLength={15}
                  onKeyDown={e => { if (e.key === 'Enter') handleStart(); }}
                  aria-label="Digite seu nickname"
                  style={{ marginBottom: 4, borderColor: error ? '#ef4444' : '#a78bfa', borderWidth: 2, fontWeight: 600, letterSpacing: 0.01 }}
                />
                {error && <div style={{ color: '#ef4444', fontWeight: 500, fontSize: 15, maxWidth: 330, textAlign: 'center' }}>{error}</div>}
                <button
                  onClick={handleStart}
                  className="login-btn"
                  style={{ marginTop: 6, background: '#a78bfa', color: '#fff', fontWeight: 700, opacity: validateNickname(name) ? 0.6 : 1, cursor: validateNickname(name) ? 'not-allowed' : 'pointer' }}
                  disabled={!!validateNickname(name)}
                >
                  🎮 Começar Jogo
                </button>
              </div>
            </>
          )}
          {showOptions && (
            <StartOptions onStart={() => handleStartOptions(false)} onBackToLogin={() => handleStartOptions(true)} />
          )}
        </div>
      </div>
    </div>
  );
}
