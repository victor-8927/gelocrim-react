import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Pedidos from './pages/Pedidos';
import Equipe from './pages/Equipe';
import Rotas from './pages/Rotas';
import Monitoramento from './pages/Monitoramento';
import Ocorrencias from './pages/Ocorrencias';

const Placeholder = ({ title }) => (
  <div>
    <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>{title}</h1>
    <div className="card" style={{ textAlign: 'center', padding: 60, color: '#90afd4' }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>🚧</div>
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Em desenvolvimento</div>
      <div style={{ fontSize: 13 }}>Esta tela esta sendo implementada</div>
    </div>
  </div>
);

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ color: '#90afd4', textAlign: 'center', paddingTop: 100 }}>Carregando...</div>;
  if (!user) return <Navigate to="/login" />;
  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/pedidos" element={<PrivateRoute><Pedidos /></PrivateRoute>} />
      <Route path="/roteirizacao" element={<PrivateRoute><Placeholder title="Roteirizacao Visual" /></PrivateRoute>} />
      <Route path="/rotas" element={<PrivateRoute><Rotas /></PrivateRoute>} />
      <Route path="/monitoramento" element={<PrivateRoute><Monitoramento /></PrivateRoute>} />
      <Route path="/ocorrencias" element={<PrivateRoute><Ocorrencias /></PrivateRoute>} />
      <Route path="/veiculos" element={<PrivateRoute><Placeholder title="Veiculos" /></PrivateRoute>} />
      <Route path="/equipe" element={<PrivateRoute><Equipe /></PrivateRoute>} />
      <Route path="/producao" element={<PrivateRoute><Placeholder title="Producao" /></PrivateRoute>} />
      <Route path="/parceiros" element={<PrivateRoute><Placeholder title="Parceiros" /></PrivateRoute>} />
      <Route path="/integracao" element={<PrivateRoute><Placeholder title="Integracao Sankhya" /></PrivateRoute>} />
      <Route path="/relatorios" element={<PrivateRoute><Placeholder title="Relatorios" /></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
