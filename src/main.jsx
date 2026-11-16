import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './lib/auth.jsx';
import { DataProvider } from './lib/data.jsx';
import { InventoryProvider } from './lib/inventory.jsx';
import { LanguageProvider } from './lib/i18n.jsx';
import { lockZoomInInstalledApp } from './lib/install.js';
import App from './App.jsx';
import './index.css';

lockZoomInInstalledApp();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider>
        <DataProvider>
          <InventoryProvider>
            <LanguageProvider>
              <App />
            </LanguageProvider>
          </InventoryProvider>
        </DataProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
