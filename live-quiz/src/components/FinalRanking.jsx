import React from 'react';
import './FinalRanking.css';

export default function FinalRanking({ finalRanking, highlightedPlayer }) {
  const safeDisplayName = (nickname) => {
    if (!nickname || (typeof nickname === 'string' && nickname.trim() === '')) return 'Jogador';
    if (typeof nickname === 'object' && nickname !== null) {
      if (!nickname.name || nickname.name.trim() === '') return 'Jogador';
      return `${nickname.avatar?.emoji ? nickname.avatar.emoji + ' ' : ''}${nickname.name}`;
    }
    return nickname;
  };

  return (
    <div className="final-ranking-card">
      <h2 className="final-ranking-title">🏆 Ranking Final</h2>
      {highlightedPlayer && (
        <div className="highlighted-player">
          <h3>Destaque:</h3>
          <p>
            {safeDisplayName(highlightedPlayer.nickname)} - {highlightedPlayer.points} pontos
          </p>
        </div>
      )}
      {finalRanking.length > 0 ? (
        <div className="final-ranking-list">
          {finalRanking.map((player, index) => (
            <div 
              key={player.id} 
              className="final-ranking-item"
              style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '6px 0', borderBottom: '1px solid #312e8122' }}
            >
              <span className="final-ranking-position" style={{ minWidth: 48, textAlign: 'right', fontWeight: 700, color: '#a78bfa', fontSize: 15, flexShrink: 0 }}>{index + 1}º</span>
              <span className="final-ranking-name" style={{ flex: 1, fontWeight: 600, color: '#c7d2fe', fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: '0 8px' }}>{safeDisplayName(player.nickname)}</span>
              <span className="final-ranking-points" style={{ color: '#a78bfa', fontWeight: 600, fontSize: 15, minWidth: 60, textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{player.points} pts</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="no-players">Nenhum jogador conectado</p>
      )}
    </div>
  );
}