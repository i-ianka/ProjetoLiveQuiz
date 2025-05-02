import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom'; // <-- Aqui o Router principal
import App from './App.jsx';
import './index.css';

// Removido StrictMode para teste de loop
ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter> {/* ✅ Apenas UM Router AQUI */}
    <App />
  </BrowserRouter>
);
