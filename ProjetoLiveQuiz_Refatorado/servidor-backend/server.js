import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = 3000;

// Configura o CORS
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'] })); // Permite requisições das origens do frontend

// Função para normalizar textos
const normalizeText = (text) => {
  return text
    .normalize('NFD') // Separa acentos das letras
    .replace(/[\u0300-\u036f]/g, '') // Remove os acentos
    .replace(/\(.*?\)/g, '')  // Remove tudo entre parênteses
    .replace(/[^\w\s]/gi, '') // Remove símbolos, mantendo letras e números
    .toLowerCase()            // Coloca em caixa baixa
    .trim();                  // Remove espaços extras
};

// Função para embaralhar as músicas
const shuffleArray = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]]; // Troca os elementos
  }
  return array;
};

// Endpoint para buscar playlists no Deezer
app.get('/playlist/:playlistId', async (req, res) => {
  const playlistId = req.params.playlistId;
  try {
    const response = await fetch(`https://api.deezer.com/playlist/${playlistId}`);
    const data = await response.json();

    if (data.error) {
      return res.status(400).json({ error: data.error });
    }

    if (data.tracks && data.tracks.data) {
      const tracks = data.tracks.data
        .map(track => ({
          ...track,
          title: normalizeText(track.title), // Normaliza o título da música
          artist: { ...track.artist, name: normalizeText(track.artist.name) } // Normaliza o nome do artista
        }));

      // Embaralha as músicas
      const shuffledTracks = shuffleArray(tracks);

      // Retorna TODAS as músicas embaralhadas com preview (NÃO limita a 15)
      const validTracks = shuffledTracks.filter(track => track.preview);

      console.log('Músicas embaralhadas retornadas pelo backend (todas com preview):', validTracks.map(track => track.title));

      res.json({ ...data, tracks: { data: validTracks } }); // Retorna todas as músicas válidas
    } else {
      console.error('A playlist não contém músicas ou a estrutura da resposta está diferente:', data);
      res.status(400).json({ error: 'A playlist não contém músicas válidas.' });
    }
  } catch (error) {
    console.error('Erro ao buscar playlist:', error);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

// Inicializa o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
