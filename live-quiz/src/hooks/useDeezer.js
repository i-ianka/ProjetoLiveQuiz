import { useState, useEffect } from 'react';

export function useDeezer(query) {
  const [musics, setMusics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMusics = async () => {
    try {
      const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
      const deezerApiUrl = `https://api.deezer.com/search?q=${encodeURIComponent(query)}`;

      const response = await fetch(proxyUrl + deezerApiUrl, {
        headers: {
          'Origin': 'localhost', // às vezes precisa de um header de origem fake
        }
      });

      const data = await response.json();
      
      setMusics(data.data);
      setLoading(false);
    } catch (err) {

      setError(err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMusics();
  }, [query]);

  return { musics, loading, error };
}
