    // frontend/src/main.jsx (หรือ main.js)
    import React from 'react';
    import ReactDOM from 'react-dom/client';
    import App from './App.jsx'; // ตรวจสอบให้แน่ใจว่า Path นี้ถูกต้อง
    import './index.css'; // นำเข้า Tailwind CSS

    ReactDOM.createRoot(document.getElementById('root')).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
    