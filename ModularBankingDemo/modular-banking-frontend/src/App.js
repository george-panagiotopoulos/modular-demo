import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import Dashboard from './Dashboard';
import SupportingServices from './SupportingServices';
import ModularArchitecture from './ModularArchitecture';
import DemoFlow from './DemoFlow';

function App() {
  return (
    <div className="App">
      <Router>
        <header className="app-header">
          <h1>Modular Banking Demo</h1>
        </header>
        <main role="main">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/supporting-services" element={<SupportingServices />} />
            <Route path="/modular-architecture" element={<ModularArchitecture />} />
            <Route path="/demo-flow" element={<DemoFlow />} />
          </Routes>
        </main>
      </Router>
    </div>
  );
}

export default App;
