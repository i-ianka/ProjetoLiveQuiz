import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';

const phrases = [
  {
    min: 15,
    text: 'Uhuuu! Ativou o modo Fingers Fly!! Deu a resposta antes do vocalista respirar!',
    animation: 'fire',
  },
  {
    min: 10,
    text: 'Boa! Deu aquele estalo na mente! Descobriu a tempo!!',
    animation: 'confetti',
  },
  {
    min: 5,
    text: 'Na bacia das almas! Por um triz! Foi no modo adrenalina!',
    animation: 'zzz',
  },
];

function getEffectByTime(timeLeft) {
  return (
    phrases.find(p => timeLeft >= p.min) || phrases[phrases.length - 1]
  );
}

export default function GamificationEffect({ show, timeLeft, onClose }) {
  const effect = getEffectByTime(timeLeft);
  const [visible, setVisible] = React.useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      const timeout = setTimeout(() => {
        setVisible(false);
        setTimeout(onClose, 350); // Aguarda fade-out antes de onClose
      }, 2700); // 2.7s visível + 0.3s fade
      return () => clearTimeout(timeout);
    } else {
      setVisible(false);
    }
  }, [show, onClose]);

  if (!visible) return null;

  return (
    <div className={`gami-overlay ${effect.animation} gami-fade-anim`}>
      <div className="gami-bg-pulse" />
      <div className="gami-content">
        <div className="gami-phrase">{effect.text}</div>
        <div className="gami-animation">
          {effect.animation === 'fire' && <FireEffect />}
          {effect.animation === 'confetti' && <ConfettiEffect />}
          {effect.animation === 'zzz' && <ZzzEffect />}
        </div>
      </div>
    </div>
  );
}

GamificationEffect.propTypes = {
  show: PropTypes.bool.isRequired,
  timeLeft: PropTypes.number.isRequired,
  onClose: PropTypes.func.isRequired,
};

function FireEffect() {
  // Foguinho animado (SVG + emoji)
  return (
    <div className="gami-fire">
      <span style={{ fontSize: 52, filter: 'drop-shadow(0 0 10px #fbbf24)' }}>🔥🔥🔥</span>
    </div>
  );
}

function ConfettiEffect() {
  // Confetti animado (canvas-confetti já pode ser disparado no onShow, aqui só emoji)
  return (
    <div className="gami-confetti-emoji">
      <span style={{ fontSize: 46 }}>🎉🎊✨</span>
    </div>
  );
}

function ZzzEffect() {
  // Emoji de sono
  return (
    <div className="gami-zzz">
      <span style={{ fontSize: 46 }}>😴💤 Zzz...</span>
    </div>
  );
}
