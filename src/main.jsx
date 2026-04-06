import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './context/AuthContext';
import { RoadsProvider } from './context/RoadsContext';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <RoadsProvider>
        <App />
      </RoadsProvider>
    </AuthProvider>
  </StrictMode>
);
