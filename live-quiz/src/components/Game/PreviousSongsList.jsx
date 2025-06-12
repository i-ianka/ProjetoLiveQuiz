import '../PreviousSongsList.css';

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
          <p className="song-title">{reversedSongs.length - index}º - {song.title} - {song.artist.name}</p>
        </div>
      ))}
    </div>
  );
}