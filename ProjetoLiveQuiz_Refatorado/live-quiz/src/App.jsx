import { Routes, Route } from 'react-router-dom'; // <-- Só Routes e Route
import { GameProvider } from './context/GameContext'; // <-- Certo
import StartPage from "./components/Start/StartPage";
import GamePage from "./components/Game/GamePage";
import FinalRankingPage from "./components/Ranking/FinalRankingPage";


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
