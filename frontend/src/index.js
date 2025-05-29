import { Buffer } from 'buffer';
import './polyfills';
import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';

// Polyfill
window.Buffer = Buffer;

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);