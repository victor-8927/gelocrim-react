import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || 'https://wziprddrflgpzankofad.supabase.co';
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── CLIENTS ─────────────────────────────────────────────────────────────────
export const getClients = async ({ limit = 1000, geo_zone, route, district, search } = {}) => {
  let q = supabase.from('clients').select('*').order('name');
  if (geo_zone) q = q.eq('geo_zone', geo_zone);
  if (route) q = q.eq('route', route);
  if (district) q = q.ilike('district', `%${district}%`);
  if (search) q = q.or(`name.ilike.%${search}%,codparc.eq.${isNaN(search) ? 0 : search}`);
  q = q.limit(limit);
  const { data, error } = await q;
  if (error) throw error;
  return data;
};

export const getClientByCodeparc = async (codparc) => {
  const { data, error } = await supabase.from('clients').select('*').eq('codparc', codparc).single();
  if (error) throw error;
  return data;
};

export const updateClient = async (id, updates) => {
  const { data, error } = await supabase.from('clients').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) throw error;
  return data;
};

// ─── ORDERS ──────────────────────────────────────────────────────────────────
export const getOrders = async ({ limit = 500, status, region, order_type, search, date } = {}) => {
  let q = supabase.from('orders').select(`*, order_items(*)`).order('external_id', { ascending: false });
  if (status) q = q.eq('status', status);
  if (region) q = q.eq('region', region);
  if (order_type) q = q.eq('order_type', order_type);
  if (date) q = q.eq('delivery_date', date);
  if (search) {
    const isNum = !isNaN(search);
    q = q.or(`recipient_name.ilike.%${search}%,address.ilike.%${search}%${isNum ? `,codparc.eq.${search},external_id.eq.${search}` : ''}`);
  }
  q = q.limit(limit);
  const { data, error } = await q;
  if (error) throw error;
  return data;
};

export const updateOrderStatus = async (id, status) => {
  const { data, error } = await supabase.from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) throw error;
  return data;
};

// ─── DRIVERS ─────────────────────────────────────────────────────────────────
export const getDrivers = async ({ type } = {}) => {
  let q = supabase.from('drivers').select('*').order('name');
  if (type) q = q.eq('type', type);
  const { data, error } = await q;
  if (error) throw error;
  return data;
};

export const upsertDriver = async (driver) => {
  const payload = { ...driver, updated_at: new Date().toISOString() };
  const { data, error } = await supabase.from('drivers').upsert(payload).select().single();
  if (error) throw error;
  return data;
};

export const deleteDriver = async (id) => {
  const { error } = await supabase.from('drivers').delete().eq('id', id);
  if (error) throw error;
};

// ─── VEHICLES ────────────────────────────────────────────────────────────────
export const getVehicles = async () => {
  const { data, error } = await supabase.from('vehicles').select('*').order('vda');
  if (error) throw error;
  return data;
};

export const upsertVehicle = async (vehicle) => {
  const payload = { ...vehicle, updated_at: new Date().toISOString() };
  const { data, error } = await supabase.from('vehicles').upsert(payload).select().single();
  if (error) throw error;
  return data;
};

export const deleteVehicle = async (id) => {
  const { error } = await supabase.from('vehicles').delete().eq('id', id);
  if (error) throw error;
};

// ─── ROUTES ──────────────────────────────────────────────────────────────────
export const getRoutes = async ({ date, status } = {}) => {
  let q = supabase.from('routes').select(`*, stops(*)`).order('created_at', { ascending: false });
  if (date) q = q.eq('route_date', date);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw error;
  // Enriquecer com nome do veículo e motorista
  const vIds = [...new Set(data.map(r => r.vehicle_id).filter(Boolean))];
  const dIds = [...new Set(data.map(r => r.driver_id).filter(Boolean))];
  const [veics, drivs] = await Promise.all([
    vIds.length ? supabase.from('vehicles').select('id,vda,plate').in('id', vIds) : { data: [] },
    dIds.length ? supabase.from('drivers').select('id,name').in('id', dIds) : { data: [] },
  ]);
  const veicMap = Object.fromEntries((veics.data || []).map(v => [v.id, v]));
  const drivMap = Object.fromEntries((drivs.data || []).map(d => [d.id, d]));
  return data.map(r => ({
    ...r,
    vehicle_name: veicMap[r.vehicle_id] ? `${veicMap[r.vehicle_id].vda} — ${veicMap[r.vehicle_id].plate}` : '—',
    driver_name: drivMap[r.driver_id]?.name || '—',
    total_stops: r.stops?.length || r.total_stops || 0,
    completed_stops: r.stops?.filter(s => s.status === 'delivered').length || r.delivered_stops || 0,
  }));
};

export const createRoute = async (route) => {
  const payload = { ...route, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  const { data, error } = await supabase.from('routes').insert(payload).select().single();
  if (error) throw error;
  return data;
};

// ─── INCIDENTS (Ocorrências) ──────────────────────────────────────────────────
export const getIncidents = async () => {
  const { data, error } = await supabase.from('incidents').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};

export const createIncident = async (incident) => {
  const payload = { ...incident, id: `inc-${Date.now()}`, created_at: new Date().toISOString() };
  const { data, error } = await supabase.from('incidents').insert(payload).select().single();
  if (error) throw error;
  return data;
};

export const updateIncident = async (id, updates) => {
  const { data, error } = await supabase.from('incidents').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) throw error;
  return data;
};

// ─── PALLETS E PRODUCTION ITEMS ──────────────────────────────────────────────
export const getPallets = async () => {
  const { data, error } = await supabase.from('pallets').select('*');
  if (error) throw error;
  return data;
};

export const upsertPallet = async (pallet) => {
  const payload = { ...pallet, updated_at: new Date().toISOString() };
  if (!payload.id) payload.id = `plt-${Date.now()}`;
  const { data, error } = await supabase.from('pallets').upsert(payload).select().single();
  if (error) throw error;
  return data;
};

export const getProductionItems = async () => {
  const { data, error } = await supabase.from('production_items').select('*');
  if (error) throw error;
  return data;
};

export const upsertProductionItem = async (item) => {
  const payload = { ...item, updated_at: new Date().toISOString() };
  if (!payload.id) payload.id = `pit-${Date.now()}`;
  const { data, error } = await supabase.from('production_items').upsert(payload).select().single();
  if (error) throw error;
  return data;
};

// ─── COMODATOS ────────────────────────────────────────────────────────────────
export const getComodatosByClient = async (codparc) => {
  const { data, error } = await supabase.rpc('get_comodatos_by_codparc', { p_codparc: String(codparc) });
  if (error) { console.error('comodato rpc error:', error); return []; }
  return data || [];
};

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
export const getDashboardData = async (date) => {
  const today = date || new Date().toISOString().slice(0, 10);
  const [orders, routes, vehicles, drivers] = await Promise.all([
    supabase.from('orders').select('status, weight_kg').limit(1000),
    supabase.from('routes').select('status, total_stops, delivered_stops, total_distance_km').eq('route_date', today),
    supabase.from('vehicles').select('id, status'),
    supabase.from('drivers').select('id, type, status'),
  ]);
  return {
    orders: orders.data || [],
    routes: routes.data || [],
    vehicles: vehicles.data || [],
    drivers: drivers.data || [],
  };
};
