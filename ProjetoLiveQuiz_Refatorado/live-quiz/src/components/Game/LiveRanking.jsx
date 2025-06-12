import React from 'react';
import '../LiveRanking.css';
import { useFirebaseRanking } from '../../hooks/useFirebaseRanking';

export default function LiveRanking({ playerKey, refreshTrigger }) {
  const { ranking } = useFirebaseRanking();



  // Filtra apenas jogadores com nickname válido
  const validRanking = ranking.filter(p => {
    const nick = typeof p.nickname === 'object' && p.nickname !== null ? p.nickname.name : p.nickname;
    return nick && nick.trim() !== '';
  });
  const top15 = validRanking.slice(0, 15);
  const playerIndex = validRanking.findIndex(p => p.id === playerKey);
  const isOutsideTop15 = playerIndex >= 15;
  const playerData = validRanking[playerIndex];
  const totalPlayers = validRanking.length;

  const safeDisplayName = (nickname) => {
    if (!nickname || (typeof nickname === 'string' && nickname.trim() === '')) return 'Jogador';
    if (typeof nickname === 'object' && nickname !== null) {
      if (!nickname.name || nickname.name.trim() === '') return 'Jogador';
      return `${nickname.avatar?.emoji ? nickname.avatar.emoji + ' ' : ''}${nickname.name}`;
    }
    return nickname;
  };

  return (
    <div className="ranking-card">
      <h2 className="ranking-title">🏆 Ranking</h2>
      <div className="ranking-meta" style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
        <span style={{ fontWeight: 600, color: '#a78bfa', fontSize: 16 }}>
          {totalPlayers} jogador{totalPlayers !== 1 ? 'es' : ''} na sala
        </span>
        {playerData && (
          <span className="user-position" style={{ color: '#7c3aed', fontWeight: 500, fontSize: 15, marginTop: 2 }}>
            Sua posição: <b>{playerIndex + 1}º</b> - <b>{safeDisplayName(playerData.nickname)}</b> - <b>{playerData.points}</b> pontos
          </span>
        )}
      </div>
      {top15.length > 0 ? (
        <div className="ranking-list">
          {top15.map((player, index) => (
            <div 
              key={player.id} 
              className={`ranking-item ${player.id === playerKey ? 'current-player' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '6px 0', borderBottom: '1px solid #312e8122' }}
            >
              <span className="ranking-position" style={{ minWidth: 48, textAlign: 'right', fontWeight: 700, color: '#a78bfa', fontSize: 15, flexShrink: 0 }}>{index + 1}º</span>
              <span className="ranking-name" style={{ flex: 1, fontWeight: 600, color: '#c7d2fe', fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: '0 8px' }}>{safeDisplayName(player.nickname)}</span>
              <span className="ranking-points" style={{ color: '#a78bfa', fontWeight: 600, fontSize: 15, minWidth: 60, textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{player.points} pts</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="no-players">Nenhum jogador conectado</p>
      )}
      {isOutsideTop15 && playerData && (
        <div className="outside-top15" style={{ marginTop: 12, color: '#fbbf24', fontWeight: 600, fontSize: 15, textAlign: 'center' }}>
          <p>Sua posição: {playerIndex + 1}º - {safeDisplayName(playerData.nickname)}: {playerData.points} pontos</p>
        </div>
      )}
    </div>
  );
}
