// LiveRanking.jsx atualizado para considerar apenas a rodada atual com contexto
import React, { useContext, useEffect, useRef, useState } from 'react';
import '../LiveRanking.css';
import { useFirebaseRanking } from '../../hooks/useFirebaseRanking';
import { GameContext } from '../../context/GameContext';

export default function LiveRanking({ playerKey, refreshTrigger }) {
  const { roundId } = useContext(GameContext);
  const { ranking } = useFirebaseRanking(roundId);

  console.log('[DEBUG] Ranking recebido:', ranking);

  // Estado para detectar jogadores que saíram
  const lastRankingRef = useRef([]);
  const [playersLeft, setPlayersLeft] = useState([]);

  useEffect(() => {
    const prevNicks = lastRankingRef.current.map(p => {
      let nick = p.nickname;
      if (typeof nick === 'object' && nick !== null) nick = nick.name;
      return nick;
    });
    const currNicks = ranking.map(p => {
      let nick = p.nickname;
      if (typeof nick === 'object' && nick !== null) nick = nick.name;
      return nick;
    });
    const sairam = prevNicks.filter(nick => !currNicks.includes(nick));
    if (sairam.length > 0) {
      setPlayersLeft(sairam);
      setTimeout(() => setPlayersLeft([]), 4000);
    }
    lastRankingRef.current = ranking;
  }, [ranking]);

  const validRanking = ranking.filter(p => {
    let nick = p.nickname;
    if (typeof nick === 'object' && nick !== null) {
      nick = nick.name;
    }
    if (typeof nick === 'string') {
      return nick.trim() !== '';
    }
    return false;
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
      {playersLeft.length > 0 && (
        <div style={{
          background: '#f87171',
          color: 'white',
          padding: 8,
          borderRadius: 6,
          marginBottom: 12,
          textAlign: 'center',
          fontWeight: 500
        }}>
          {playersLeft.length === 1
            ? <>Jogador <b>{playersLeft[0]}</b> saiu da sala</>
            : <>Jogadores <b>{playersLeft.join(', ')}</b> saíram da sala</>
          }
        </div>
      )}
      <div className="ranking-meta" style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
        <span style={{ fontWeight: 600, color: '#a78bfa', fontSize: 16 }}>
          {totalPlayers} jogador{totalPlayers !== 1 ? 'es' : ''} na rodada
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
              <span className="ranking-points" style={{ color: '#a78bfa', fontWeight: 600, fontSize: 15, minWidth: 60, textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{player.points}</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: 16, color: '#ccc', fontStyle: 'italic' }}>
          Nenhum jogador na rodada atual.
        </div>
      )}
    </div>
  );
}
