import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './context/AuthContext';
import { DatasetProvider } from './context/DatasetContext';
import { RoadsProvider } from './context/RoadsContext';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <DatasetProvider>
        <RoadsProvider>
          <App />
        </RoadsProvider>
      </DatasetProvider>
    </AuthProvider>
  </StrictMode>
);
