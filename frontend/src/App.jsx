import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Launchpad from './components/Launchpad';
import ResultsDashboard from './components/ResultsDashboard';

function App() {
  return (
    <Router>
      <div className="bg-slate-950 min-h-screen text-white">
        <Routes>
          <Route path="/" element={<Launchpad />} />
          <Route path="/dashboard" element={<ResultsDashboard />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
