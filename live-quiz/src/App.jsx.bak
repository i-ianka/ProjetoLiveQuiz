import { Routes, Route } from 'react-router-dom'; // <-- Só Routes e Route
import { GameProvider } from './context/GameContext'; // <-- Certo
import StartPage from './components/LoginPage';
import GamePage from './components/GamePage';
import FinalRankingPage from './components/FinalRankingPage';

function App() {
  return (
    <GameProvider>
      {/* NÃO tem mais Router aqui! */}
      <Routes>
        <Route path="/" element={<StartPage />} />
        <Route path="/game" element={<GamePage />} />
        <Route path="/result" element={<FinalRankingPage />} />
      </Routes>
    </GameProvider>
  );
}

export default App;
