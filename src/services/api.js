import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'https://gelocrim-backend-production.up.railway.app/api/v1';

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('fleet_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res.data,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('fleet_token');
      window.location.href = '/login';
    }
    return Promise.reject(err.response?.data || err);
  }
);

export default api;

// Auth
export const login = (email, password) => api.post('/auth/login', { email, password });
export const getMe = () => api.get('/auth/me');

// Dashboard
export const getDashboard = () => api.get('/reports/dashboard');

// Pedidos
export const getPedidos = (params) => api.get('/orders', { params });
export const deletePedidos = () => api.delete('/orders');

// Clientes
export const getClientes = () => api.get('/clientes');

// Veículos
export const getVeiculos = () => api.get('/vehicles');
export const createVeiculo = (data) => api.post('/vehicles', data);
export const updateVeiculo = (id, data) => api.patch(`/vehicles/${id}`, data);
export const deleteVeiculo = (id) => api.delete(`/vehicles/${id}`);

// Drivers
export const getDrivers = (params) => api.get('/drivers', { params });
export const createDriver = (data) => api.post('/drivers', data);
export const updateDriver = (id, data) => api.patch(`/drivers/${id}`, data);
export const deleteDriver = (id) => api.delete(`/drivers/${id}`);

// Rotas
export const getRotas = (params) => api.get('/routes', { params });
export const createRota = (data) => api.post('/routes', data);
export const liberarRota = (id) => api.post(`/routes/${id}/liberar`);
export const deleteRota = (id) => api.delete(`/routes/${id}`);
export const getStops = (id) => api.get(`/routes/${id}/stops`);
export const otimizarRota = (data) => api.post('/routes/otimizar', data);

// Produção
export const getPallets = () => api.get('/producao/pallets');
export const getItens = () => api.get('/producao/itens');

// Ocorrências
export const getOcorrencias = () => api.get('/ocorrencias');
