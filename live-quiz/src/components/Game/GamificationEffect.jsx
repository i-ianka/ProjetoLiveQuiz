import React, { useEffect, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import confetti from 'canvas-confetti';

// Componente de efeito de fogo
const FireEffect = () => (
  <div className="gami-fire">
    <span style={{ fontSize: 52, filter: 'drop-shadow(0 0 10px #fbbf24)' }}>🔥🔥🔥</span>
  </div>
);

// Componente de efeito de confete
const ConfettiEffect = () => (
  <div className="gami-confetti-emoji">
    <span style={{ fontSize: 46 }}>🎉🎊✨</span>
  </div>
);

// Componente de efeito de sono
const ZzzEffect = () => (
  <div className="gami-zzz">
    <span style={{ fontSize: 46 }}>😰🫨🫣</span>
  </div>
);

const phrases = [
  {
    min: 15,
    max: 1000,
    text: 'Uhuuu! Ativou o modo Fingers Fly!! Deu a resposta antes do vocalista respirar!',
    animation: 'confetti',
    showText: true
  },
  {
    min: 10,
    max: 14.99,
    text: 'Boa! Deu aquele estalo na mente! Descobriu a tempo!!',
    animation: 'fire',
    showText: true
  },
 
  {
    min: 0,
    max:5.99,
    text: 'Na bacia das almas! Por um triz! Foi no modo adrenalina!',
    animation: 'zzz',
    showText: true
  }
];

function getEffectByTime(timeLeft) {
  // Não arredondamos mais, usamos o tempo exato para melhor precisão
  const exactTime = timeLeft;
  
  // Encontra a primeira frase onde timeLeft está entre min e max
  const effect = phrases.find(p => 
    // Verifica se está dentro do intervalo (inclusive)
    exactTime >= p.min && exactTime <= p.max
  ) || phrases[phrases.length - 1]; // Fallback para o último efeito
  
  return effect;
}

export default function GamificationEffect({ show, timeLeft, onClose, bonusMessage }) {
  const [currentEffect, setCurrentEffect] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  
  // Dispara o efeito de confetti
  const triggerConfetti = useCallback(() => {
    // Disparando confetti
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
      // Confetti disparado com sucesso
    } catch (error) {
      console.error('Erro ao disparar confetti:', error);
    }
  }, []);

  // Atualiza o efeito sempre que o timeLeft mudar
  useEffect(() => {
    console.log('GamificationEffect - show:', show, 'timeLeft:', timeLeft);
    
    if (show && timeLeft !== null && timeLeft > 0) {
      console.log('Preparando para mostrar efeito...');
      
      const effect = getEffectByTime(timeLeft);
      console.log('Efeito selecionado:', effect);
      
      // Força a atualização do efeito
      setCurrentEffect(effect);
      
      // Pequeno atraso para garantir que o estado foi atualizado
      const timer = setTimeout(() => {
        console.log('Mostrando efeito...');
        setIsVisible(true);
        
        // Dispara confetti se for o efeito de confetti
        if (effect.animation === 'confetti') {
          console.log('Disparando confetti...');
          triggerConfetti();
        }
        
        // Esconde o efeito após 3 segundos
        const hideTimer = setTimeout(() => {
          console.log('Escondendo efeito...');
          setIsVisible(false);
          
          // Chama onClose após a animação de fade
          const closeTimer = setTimeout(() => {
            console.log('Chamando onClose...');
            onClose();
          }, 300);
          
          return () => clearTimeout(closeTimer);
        }, 3000);
        
        return () => clearTimeout(hideTimer);
      }, 50);
      
      return () => clearTimeout(timer);
    } else {
      console.log('Escondendo efeito (else)...');
      setIsVisible(false);
    }
  }, [show, timeLeft, onClose, triggerConfetti]);
  
  // Se não tiver efeito para mostrar, não renderiza nada
  if (!show || !currentEffect) {
    return null;
  }
  
  // Definição da animação fadeIn
  const fadeInKeyframes = `
    @keyframes fadeIn {
      0% { opacity: 0; transform: translateY(-20px) scale(0.95); }
      70% { transform: translateY(5px) scale(1.05); }
      100% { opacity: 1; transform: translateY(0) scale(1); }
    }
  `;

  // Estilo inline para o componente
  const containerStyle = {
    position: 'fixed',
    top: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 10000,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    borderRadius: '12px',
    backgroundColor: 'rgba(30, 41, 59, 0.98)',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
    border: '2px solid rgba(167, 139, 250, 0.5)',
    color: 'white',
    fontSize: '1.2rem',
    fontWeight: 'bold',
    textAlign: 'center',
    minWidth: '300px',
    maxWidth: '90%',
    boxSizing: 'border-box',
    opacity: isVisible ? 1 : 0,
    transition: 'all 0.3s ease-out',
    transform: isVisible ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(-20px)',
    pointerEvents: 'none',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    visibility: isVisible ? 'visible' : 'hidden',
    animation: isVisible ? 'fadeIn 0.3s ease-out' : 'none',
    willChange: 'opacity, transform',
    backfaceVisibility: 'hidden',
    WebkitFontSmoothing: 'antialiased',
    WebkitTextSizeAdjust: '100%',
    userSelect: 'none',
    MozOsxFontSmoothing: 'grayscale',
    isolation: 'isolate'
  };

  console.log('Renderizando GamificationEffect com currentEffect:', currentEffect);
  
  return (
    <div className="gami-overlay">
      <div className="gami-content">
        {currentEffect.showText !== false && (
          <div className="gami-message">
            <p>{currentEffect.text}</p>
            {bonusMessage && (
              <p style={{
                color: '#fef08a',
                fontWeight: 'bold',
                marginTop: '10px',
                textShadow: '0 0 5px rgba(0,0,0,0.8)'
              }}>
                {bonusMessage}
              </p>
            )}
          </div>
        )}
        <div className="gami-animation">
          {currentEffect.animation === 'confetti' && <ConfettiEffect />}
          {currentEffect.animation === 'fire' && <FireEffect />}
          {currentEffect.animation === 'zzz' && <ZzzEffect />}
        </div>
      </div>
    </div>
  );
}

GamificationEffect.propTypes = {
  show: PropTypes.bool.isRequired,
  timeLeft: PropTypes.number.isRequired,
  onClose: PropTypes.func.isRequired,
  bonusMessage: PropTypes.string
};
