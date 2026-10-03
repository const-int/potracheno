import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './style.css';
import { installMobileZoomLock } from './lib/mobile-zoom';

const removeZoomLock = installMobileZoomLock();
if (import.meta.hot) import.meta.hot.dispose(removeZoomLock);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
