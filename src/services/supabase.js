import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || 'https://wziprddrflgpzankofad.supabase.co';
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Data local de Manaus (UTC-4)
export const hojeManaus = () => {
  return new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
};

// ─── CLIENTS ─────────────────────────────────────────────────────────────────
export const getClients = async ({ geo_zone, route, search } = {}) => {
  // Se houver busca — query direta no banco (busca nos 1290 todos)
  if (search) {
    const isNum = !isNaN(search) && search.trim() !== '';
    let q = supabase.from('clients').select('*').order('name');
    if (geo_zone) q = q.eq('geo_zone', geo_zone);
    q = q.or(`name.ilike.%${search}%${isNum ? `,codparc.eq.${search}` : ''}`);
    q = q.limit(100);
    const { data, error } = await q;
    if (error) throw error;
    return data;
  }

  // Sem busca — carrega todos em lotes de 1000
  let todos = [];
  let from = 0;
  const lote = 1000;
  while (true) {
    let q = supabase.from('clients').select('*').order('name').range(from, from + lote - 1);
    if (geo_zone) q = q.eq('geo_zone', geo_zone);
    if (route)    q = q.eq('route', route);
    const { data, error } = await q;
    if (error) throw error;
    todos = todos.concat(data || []);
    if (!data || data.length < lote) break;
    from += lote;
  }
  return todos;
};

export const getComodatosByClient = async (codparc) => {
  const { data, error } = await supabase.rpc('get_comodatos_by_codparc', { p_codparc: String(codparc) });
  if (error) { console.error('comodato rpc error:', error); return []; }
  return data || [];
};

// ─── ORDERS ──────────────────────────────────────────────────────────────────
export const getOrders = async ({ limit = 500, status, region, order_type, search } = {}) => {
  let q = supabase.from('orders').select(`*, order_items(*)`).order('external_id', { ascending: false });
  if (status)     q = q.eq('status', status);
  if (region)     q = q.eq('region', region);
  if (order_type) q = q.eq('order_type', order_type);
  if (search) {
    const isNum = !isNaN(search);
    q = q.or(`recipient_name.ilike.%${search}%,address.ilike.%${search}%${isNum ? `,codparc.eq.${search}` : ''}`);
  }
  q = q.limit(limit);
  const { data, error } = await q;
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
  const payload = {
    id: driver.id,
    name: driver.name,
    cpf: driver.cpf || null,
    phone: driver.phone || null,
    type: driver.type || 'driver',
    license_number: driver.license_number || null,
    license_category: driver.license_category || null,
    status: driver.status || 'active',
    vda: driver.fixed_vehicle || null,
    fixed_vehicle: driver.fixed_vehicle || null,
    daily_cost: parseFloat(driver.daily_cost) || 0,
    hire_date: driver.admission_date || driver.hire_date || null,
    notes: driver.notes || null,
    photo: driver.foto_funcionario || driver.photo || null,
    license_photo: driver.foto_cnh || driver.license_photo || null,
    day_off: driver.day_off || null,
    work_hours: driver.work_hours || null,
    lunch_time: driver.lunch_break || driver.lunch_time || null,
    updated_at: new Date().toISOString(),
  };
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
  const payload = {
    id: vehicle.id,
    plate: vehicle.plate,
    model: vehicle.model || null,
    brand: vehicle.brand || null,
    year: vehicle.year ? parseInt(vehicle.year) : null,
    vda: vehicle.name || vehicle.vda || null,
    type: vehicle.type || null,
    status: vehicle.status || 'active',
    capacity_kg: parseFloat(vehicle.capacity_kg) || 0,
    capacity_m3: parseFloat(vehicle.capacity_m3) || 0,
    volume_m3: parseFloat(vehicle.capacity_m3) || 0,
    pallets: parseInt(vehicle.cap_pallets || vehicle.pallets) || 0,
    box_length: parseFloat(vehicle.box_length) || 0,
    box_width: parseFloat(vehicle.box_width) || 0,
    box_height: parseFloat(vehicle.box_height) || 0,
    fuel_type: vehicle.fuel_type || 'diesel',
    km_per_liter: parseFloat(vehicle.fuel_consumption || vehicle.km_per_liter) || 0,
    fuel_price: parseFloat(vehicle.fuel_price) || 0,
    annual_tax: parseFloat(vehicle.ipva_anual || vehicle.annual_tax) || 0,
    monthly_maintenance: parseFloat(vehicle.manut_mes || vehicle.monthly_maintenance) || 0,
    daily_cost: parseFloat(vehicle.daily_cost) || 0,
    last_oil_date: vehicle.oil_last || vehicle.last_oil_date || null,
    next_oil_date: vehicle.oil_next || vehicle.next_oil_date || null,
    oil_cost: parseFloat(vehicle.oil_cost) || 0,
    notes: vehicle.notes || null,
    updated_at: new Date().toISOString(),
  };
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
  if (date)   q = q.eq('route_date', date);
  else        q = q.eq('route_date', hojeManaus()); // padrão: hoje em Manaus
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw error;
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
  const payload = {
    id: `rte-${Date.now()}`,
    trip_number: route.trip_number || `VGM-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(Math.random()*1000).toString().padStart(3,'0')}`,
    vehicle_id: route.vehicle_id,
    driver_id: route.driver_id,
    assistant1_id: route.assistant1_id || null,
    assistant2_id: route.assistant2_id || null,
    route_date: route.date || new Date().toISOString().slice(0,10),
    planned_start: route.planned_start || '07:30',
    trip_type: route.trip_type || '1viagem',
    tempo_evento: route.tempo_evento ? parseInt(route.tempo_evento) : null,
    status: 'pending',
    total_stops: route.total_stops || 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from('routes').insert(payload).select().single();
  if (error) throw error;
  return data;
};

// ─── INCIDENTS ───────────────────────────────────────────────────────────────
export const getIncidents = async () => {
  const { data, error } = await supabase.from('incidents').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};

export const createIncident = async (incident) => {
  const payload = {
    id: `inc-${Date.now()}`,
    type: incident.type || null,
    severity: incident.severity || 'media',
    description: incident.description || null,
    status: incident.status || 'pending',
    vehicle: incident.vehicle || null,
    client: incident.client || null,
    invoice: incident.invoice || null,
    photo: incident.photo || null,
    created_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from('incidents').insert(payload).select().single();
  if (error) throw error;
  return data;
};

export const updateIncident = async (id, updates) => {
  const { data, error } = await supabase.from('incidents')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id).select().single();
  if (error) throw error;
  return data;
};

// ─── PALLETS ─────────────────────────────────────────────────────────────────
export const getPallets = async () => {
  const { data, error } = await supabase.from('pallets').select('*');
  if (error) throw error;
  return data;
};

export const upsertPallet = async (pallet) => {
  const payload = {
    id: pallet.id || `plt-${Date.now()}`,
    name: pallet.name,
    length: parseFloat(pallet.length) || 0,
    width: parseFloat(pallet.width) || 0,
    height: parseFloat(pallet.height) || 0,
    volume: pallet.volume || (parseFloat(pallet.length||0) * parseFloat(pallet.width||0) * parseFloat(pallet.height||0)),
    max_weight: parseFloat(pallet.max_weight) || 0,
    notes: pallet.notes || null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from('pallets').upsert(payload).select().single();
  if (error) throw error;
  return data;
};

// ─── PRODUCTION ITEMS ────────────────────────────────────────────────────────
export const getProductionItems = async () => {
  const { data, error } = await supabase.from('production_items').select('*');
  if (error) throw error;
  return data;
};

export const upsertProductionItem = async (item) => {
  const l = parseFloat(item.length) || 0;
  const w = parseFloat(item.width) || 0;
  const h = parseFloat(item.height) || 0;
  const volItem = l * w * h;
  const volPallet = 1.1 * 1.1 * h;
  const payload = {
    id: item.id || `pit-${Date.now()}`,
    name: item.name,
    weight: parseFloat(item.weight || item.weight_kg) || 0,
    length: l, width: w, height: h,
    units_per_pallet: item.units_per_pallet || (volItem > 0 ? Math.floor(volPallet / volItem) : 0),
    top: item.top || '1000',
    notes: item.notes || null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from('production_items').upsert(payload).select().single();
  if (error) throw error;
  return data;
};

export const deleteProductionItem = async (id) => {
  const { error } = await supabase.from('production_items').delete().eq('id', id);
  if (error) throw error;
};

export const deletePallet = async (id) => {
  const { error } = await supabase.from('pallets').delete().eq('id', id);
  if (error) throw error;
};

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
export const getDashboardData = async (date) => {
  const today = date || hojeManaus();
  const [orders, routes, vehicles, drivers] = await Promise.all([
    supabase.from('orders').select('status, weight_kg').limit(1000),
    supabase.from('routes').select('status, total_stops, delivered_stops, total_distance_km').eq('route_date', today),
    supabase.from('vehicles').select('id, status'),
    supabase.from('drivers').select('id, type, status'),
  ]);
  return {
    orders:  orders.data  || [],
    routes:  routes.data  || [],
    vehicles: vehicles.data || [],
    drivers: drivers.data || [],
  };
};

// ─── VIEWS DASHBOARD ─────────────────────────────────────────────────────────
export const getOrdersSummary = async () => {
  const { data, error } = await supabase.from('v_orders_summary').select('*').single();
  if (error) throw error;
  return data;
};

export const getRoutesToday = async () => {
  const { data, error } = await supabase.from('v_routes_today').select('*');
  if (error) throw error;
  return data || [];
};

export const getFleetSummary = async () => {
  const { data, error } = await supabase.from('v_fleet_summary').select('*').single();
  if (error) throw error;
  return data;
};

export const getDriversSummary = async () => {
  const { data, error } = await supabase.from('v_drivers_summary').select('*').single();
  if (error) throw error;
  return data;
};

// ─── VIEWS RELATÓRIOS ────────────────────────────────────────────────────────
export const getReportPeriod = async () => {
  const { data, error } = await supabase.from('v_report_period').select('*');
  if (error) throw error;
  return data || [];
};

export const getReportByRegion = async () => {
  const { data, error } = await supabase.from('v_report_by_region').select('*');
  if (error) throw error;
  return data || [];
};
