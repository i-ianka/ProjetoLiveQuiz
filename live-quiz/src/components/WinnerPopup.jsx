import React, { useEffect, useState } from 'react';
import './GamificationEffect.css';

export default function WinnerPopup({ show, onClose, winnerName, winnerPoints }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      const timeout = setTimeout(() => {
        setVisible(false);
        setTimeout(() => onClose && onClose(), 350);
      }, 6000); // 6 segundos
      return () => clearTimeout(timeout);
    } else {
      setVisible(false);
    }
  }, [show, onClose]);

  if (!visible) return null;

  return (
    <div className="gami-overlay confetti gami-fade-anim">
      <div className="gami-bg-pulse" />
      <div className="gami-content">
        <div className="gami-phrase">
          🏆 Parabéns {winnerName}, você foi o grande campeão com {winnerPoints} pontos!
        </div>
        <div className="gami-animation">
          {/* ConfettiEffect visual opcional pode ser adicionado aqui */}
        </div>
      </div>
    </div>
  );
}
