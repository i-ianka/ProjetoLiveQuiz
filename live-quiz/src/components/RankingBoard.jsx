// src/components/RankingBoard.jsx
export default function RankingBoard({ players }) {
    return (
      <div className="w-full max-w-md mx-auto">
        <h3 className="text-xl font-semibold mb-2">Ranking</h3>
        <ul className="bg-white rounded-lg shadow p-4">
          {players.map((player, index) => (
            <li key={index} className="flex justify-between py-2 border-b last:border-0">
              <span>{index + 1}. {player.nickname}</span>
              <span>{player.points} pts</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  