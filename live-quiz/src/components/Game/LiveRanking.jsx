// LiveRanking.jsx atualizado para considerar apenas a rodada atual com contexto
import React, { useContext, useEffect, useRef, useState } from 'react';
import '../LiveRanking.css';
import { useFirebaseRanking } from '../../hooks/useFirebaseRanking';
import { GameContext } from '../../context/GameContext';

export default function LiveRanking({ playerKey, refreshTrigger }) {
  const { roundId } = useContext(GameContext);
  const { ranking } = useFirebaseRanking(roundId);


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

  // Mantém todos os jogadores, mesmo com nickname vazio ou 0 pontos
  const validRanking = ranking.map(p => ({
    ...p,
    // Garante um nickname padrão se estiver vazio
    nickname: (() => {
      let nick = p.nickname;
      if (typeof nick === 'object' && nick !== null) {
        nick = nick.name;
      }
      return (typeof nick === 'string' && nick.trim() !== '') ? nick : 'Jogador';
    })()
  }));

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
      <h2 className="game-title">🏆 Ranking</h2>
      {playersLeft.length > 0 && (
        <div className="players-left-message">
          {playersLeft.length === 1
            ? <>Jogador <b>{playersLeft[0]}</b> saiu da sala</>
            : <>Jogadores <b>{playersLeft.join(', ')}</b> saíram da sala</>
          }
        </div>
      )}
      <div className="ranking-meta">
        <span className="players-count">
          {totalPlayers} jogador{totalPlayers !== 1 ? 'es' : ''} na rodada
        </span>
        {playerData && (
          <span className="user-position">
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
            >
              <span className="ranking-position">{index + 1}º</span>
              <span className="ranking-name">{safeDisplayName(player.nickname)}</span>
              <span className="ranking-points">{player.points}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="no-players">
          Nenhum jogador na rodada atual.
        </div>
      )}
    </div>
  );
}
