import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/home";
import Login from "./pages/login";
import PatientsDashboard from "./pages/patients_dashboard";
import DocDashboard from "./pages/doctor_dashboard";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/patients_dashboard" element={<PatientsDashboard />} />
        <Route path="/doctor_dashboard" element={<DocDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
