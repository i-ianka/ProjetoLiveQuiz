import '../PreviousSongsList.css';

// Função para capitalizar a primeira letra de cada palavra
const capitalizeWords = (str) => {
  if (!str) return '';
  return str.toLowerCase().split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export default function PreviousSongsList({ songs }) {
  if (!songs || songs.length === 0) {
    return <p className="no-songs">Nenhuma música anterior</p>;
  }

  // Mostra as músicas mais recentes no topo
  const reversedSongs = [...songs].reverse();

  return (
    <div className="previous-songs-list">
      {reversedSongs.map((song, index) => (
        <div key={index} className="previous-song-item">
          <p className="song-title">
            {reversedSongs.length - index}º - {capitalizeWords(song.title)} - {capitalizeWords(song.artist?.name || '')}
          </p>
        </div>
      ))}
    </div>
  );
}