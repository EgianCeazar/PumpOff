import React from 'react';
import { createRoot } from 'react-dom/client';
import RepCounterScreen from './RepCounterScreen.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RepCounterScreen />
  </React.StrictMode>,
);
