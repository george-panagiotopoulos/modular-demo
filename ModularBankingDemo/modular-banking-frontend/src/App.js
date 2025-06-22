import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import './App.css';
import Dashboard from './Dashboard';
import SupportingServices from './SupportingServices';
import ModularArchitecture from './ModularArchitecture';
import DemoFlow from './DemoFlow';
import EventStream from './components/EventStream';

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const isNotDashboard = location.pathname !== '/';

  const handleBackClick = () => {
    navigate('/');
  };

  return (
    <div className="App">
      <header className="app-header">
        {isNotDashboard && (
          <button 
            className="app-back-button"
            onClick={handleBackClick}
            aria-label="Back to Dashboard"
          >
            <span className="back-arrow" aria-hidden="true">←</span>
            Back to Dashboard
          </button>
        )}
        <h1>Modular Banking Demo</h1>
      </header>
      <main role="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/supporting-services" element={<SupportingServices />} />
          <Route path="/modular-architecture" element={<ModularArchitecture />} />
          <Route path="/demo-flow" element={<DemoFlow />} />
          <Route path="/event-stream" element={<EventStream />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
