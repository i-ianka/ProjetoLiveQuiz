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
  console.log('=== getEffectByTime ===');
  console.log('Procurando efeito para timeLeft:', timeLeft);
  
  // Não arredondamos mais, usamos o tempo exato para melhor precisão
  const exactTime = timeLeft;
  console.log('Tempo exato:', exactTime);
  
  // Encontra a primeira frase onde timeLeft está entre min e max
  const effect = phrases.find(p => {
    // Verifica se está dentro do intervalo (inclusive)
    const isInRange = exactTime >= p.min && exactTime <= p.max;
    console.log(`Verificando faixa ${p.min}-${p.max}: ${isInRange} (${p.text || 'sem texto'})`);
    return isInRange;
  }) || phrases[phrases.length - 1]; // Fallback para o último efeito
  
  console.log('Efeito encontrado para tempo', exactTime, ':', {
    min: effect.min,
    max: effect.max,
    text: effect.text || 'sem texto',
    animation: effect.animation,
    showText: effect.showText
  });
  
  return effect;
}

export default function GamificationEffect({ show, timeLeft, onClose }) {
  const [currentEffect, setCurrentEffect] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  
  // Dispara o efeito de confetti
  const triggerConfetti = useCallback(() => {
    console.log('Disparando confetti...');
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
      console.log('Confetti disparado com sucesso!');
    } catch (error) {
      console.error('Erro ao disparar confetti:', error);
    }
  }, []);

  // Atualiza o efeito sempre que o timeLeft mudar
  useEffect(() => {
    console.log('=== EFEITO PRINCIPAL ATUALIZADO ===');
    console.log('show:', show, 'timeLeft:', timeLeft);
    
    if (show && timeLeft !== null) {
      console.log('GamificationEffect - Mostrando mensagem para tempo:', timeLeft);
      
      // Garante que o efeito atual seja limpo antes de mostrar um novo
      setIsVisible(false);
      
      // Pequeno atraso para permitir a animação de saída
      const showTimer = setTimeout(() => {
        const effect = getEffectByTime(timeLeft);
        console.log('Efeito selecionado:', effect);
        setCurrentEffect(effect);
        
        // Pequeno atraso para garantir que o estado foi atualizado
        const visibilityTimer = setTimeout(() => {
          // Força o estado para visível
          console.log('Tornando o componente visível...');
          setIsVisible(true);
          
          // Dispara confetti se for o efeito de confetti
          if (effect.animation === 'confetti') {
            console.log('Disparando efeito de confetti');
            triggerConfetti();
          }
          
          // Esconde o efeito após 3 segundos
          const hideTimer = setTimeout(() => {
            console.log('Iniciando animação de saída...');
            setIsVisible(false);
            
            // Chama onClose após a animação de fade
            const closeTimer = setTimeout(() => {
              console.log('Chamando onClose...');
              onClose();
            }, 300);
            
            return () => clearTimeout(closeTimer);
          }, 3000);
          
          return () => {
            console.log('Limpando hideTimer');
            clearTimeout(hideTimer);
          };
        }, 50);
        
        return () => {
          console.log('Limpando visibilityTimer');
          clearTimeout(visibilityTimer);
        };
      }, 50);
      
      return () => {
        console.log('Limpando showTimer');
        clearTimeout(showTimer);
      };
    } else {
      console.log('GamificationEffect - Escondendo (show ou timeLeft inválido)');
      setIsVisible(false);
    }
  }, [show, timeLeft, onClose, triggerConfetti]);
  
  if (!show || !isVisible || !currentEffect) {
    console.log('=== NÃO RENDERIZANDO GAMIFICATION EFFECT ===');
    console.log('Motivo:');
    console.log('- show:', show);
    console.log('- isVisible:', isVisible);
    console.log('- currentEffect:', currentEffect);
    console.log('========================================');
    return null;
  }

  console.log('=== RENDERIZANDO GAMIFICATION EFFECT ===');
  console.log('Efeito atual:', currentEffect);
  console.log('isVisible:', isVisible);
  
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
    transition: 'opacity 0.3s ease-out, transform 0.3s ease-out',
    transformOrigin: 'top center',
    pointerEvents: 'none',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    visibility: isVisible ? 'visible' : 'hidden',
    animation: isVisible ? 'fadeIn 0.5s ease-out' : 'none',
    // Garante que o elemento esteja visível
    willChange: 'opacity, transform',
    // Força aceleração de hardware
    backfaceVisibility: 'hidden',
    // Melhora a renderização no Safari
    WebkitFontSmoothing: 'antialiased',
    // Garante que o texto seja nítido
    WebkitTextSizeAdjust: '100%',
    // Evita que o texto seja selecionado
    userSelect: 'none',
    // Melhora a renderização no Firefox
    MozOsxFontSmoothing: 'grayscale',
    // Garante que o elemento esteja acima de outros elementos
    isolation: 'isolate'
  };

  console.log('Renderizando GamificationEffect com currentEffect:', currentEffect);
  
  return (
    <>
      <style>{fadeInKeyframes}</style>
      <div style={containerStyle} className="gamification-effect">
        {currentEffect.showText !== false && (
          <div style={{ marginBottom: '12px' }}>{currentEffect.text}</div>
        )}
        <div style={{
          fontSize: '2rem',
          transition: 'all 0.3s ease-out',
          transform: isVisible ? 'scale(1.1)' : 'scale(0.9)',
          opacity: isVisible ? 1 : 0,
          marginTop: '8px'
        }}>
          {currentEffect.animation === 'confetti' && <ConfettiEffect />}
          {currentEffect.animation === 'fire' && <FireEffect />}
          {currentEffect.animation === 'zzz' && <ZzzEffect />}
        </div>
      </div>
    </>
  );
}

GamificationEffect.propTypes = {
  show: PropTypes.bool.isRequired,
  timeLeft: PropTypes.number.isRequired,
  onClose: PropTypes.func.isRequired,
};
