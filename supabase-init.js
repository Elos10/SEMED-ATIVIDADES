import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL.includes('PREENCHA')) {
  throw new Error('Configuracao do Supabase ausente. Cadastre os secrets no GitHub.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const DB_ID = 'db';
const ADMIN = { id: 1, name: 'ADMINISTRADOR SEMED', email: 'admin@semed.local', password: 'adm123', role: 'Administrador', unit_id: 1, teacher_id: null, status: 'Ativo', permissions: ['INSCRICOES:Visualizar','INSCRICOES:Cadastrar','INSCRICOES:Editar','INSCRICOES:Excluir','INSCRICOES:Imprimir','GESTAO:Visualizar','GESTAO:Cadastrar','GESTAO:Editar','GESTAO:Excluir','FREQUENCIA:Visualizar','FREQUENCIA:Salvar','FREQUENCIA:Editar','FREQUENCIA:Imprimir','RELATORIOS:Visualizar','RELATORIOS:Exportar','ACESSO:Visualizar','ACESSO:Cadastrar','ACESSO:Editar','ACESSO:Excluir'] };

function seed() {
  const activities = ['FUTEBOL', 'RECREACAO/PSICOMOTRICIDADE', 'GINASTICA ORIENTADA/FUNCIONAL', 'REFORCO ESCOLAR', 'JUDO', 'BALLET', 'ARTES', 'FUTSAL', 'FUTSAL FEMININO', 'JIU-JITSU', 'VOLEI'];
  return {
    units: [
      { id: 1, name: 'SEMED - UNIDADE CENTRAL', cep: '', address: 'UBERABA - MG', phone: '', manager_name: 'GESTAO SEMED', manager_position: 'GESTOR', status: 'Ativo' }
    ],
    teachers: [
      { id: 1, name: 'PROFESSOR EXEMPLO', activity_id: 1, status: 'Ativo' }
    ],
    locations: [
      { id: 1, unit_id: 1, name: 'QUADRA', status: 'Ativo' }
    ],
    activities: activities.map((name, index) => ({ id: index + 1, name, modality: index === 3 ? 'PEDAGOGICO' : 'ESPORTES', local: '', age_range: '6 A 17 ANOS', status: 'Ativo' })),
    classes: [
      { id: 1, activity_id: 1, modality: 'INICIACAO', unit_id: 1, local: 'QUADRA', teacher_id: 1, weekday: 'Segunda', start_time: '08:00', end_time: '09:30', shift: 'Matutino', vacancies: 25, status: 'Ativo' }
    ],
    users: [{ ...ADMIN }],
    registrations: [],
    attendance: [],
    documents: [],
    logs: []
  };
}

function nextId(rows) {
  return (rows || []).reduce((max, row) => Math.max(max, Number(row.id || 0)), 0) + 1;
}

function ensureDb(value) {
  const base = seed();
  const db = value && typeof value === 'object' ? value : {};
  let changed = !value || typeof value !== 'object';
  for (const key of Object.keys(base)) {
    if (!Array.isArray(db[key])) {
      db[key] = base[key];
      changed = true;
    }
  }
  const admins = db.users.map((u, i) => [u, i]).filter(([u]) => String(u.email || '').toLowerCase() === ADMIN.email);
  if (!admins.length) {
    db.users.push({ ...ADMIN, id: nextId(db.users) });
    changed = true;
  } else {
    const admin = admins[0][0];
    const expected = { ...ADMIN, id: Number(admin.id) || 1, name: admin.name || ADMIN.name, unit_id: Number(admin.unit_id || 1) };
    for (const [key, val] of Object.entries(expected)) {
      if (admin[key] !== val) {
        admin[key] = val;
        changed = true;
      }
    }
    for (const [, idx] of admins.slice(1).reverse()) {
      db.users.splice(idx, 1);
      changed = true;
    }
  }
  return { db, changed };
}

function supabaseConnectionError(error) {
  const message = error?.message || String(error || '');
  if (message.includes('Failed to fetch') || error instanceof TypeError) {
    return {
      status: 503,
      error: 'Nao foi possivel acessar o Supabase.',
      detail: `Falha de conexao com ${SUPABASE_URL}. Confira se o projeto esta ativo, se os secrets do GitHub foram publicados e se o arquivo supabase.sql foi executado no SQL Editor.`
    };
  }
  return { status: 500, error: 'Falha ao acessar Supabase.', detail: message };
}

async function readDb() {
  let response;
  try {
    response = await supabase.from('semed_sistema').select('value').eq('id', DB_ID).maybeSingle();
  } catch (error) {
    throw supabaseConnectionError(error);
  }
  const { data, error } = response;
  if (error) throw { status: 500, error: 'Falha ao ler Supabase.', detail: error.message };
  const normalized = ensureDb(data?.value || seed());
  if (!data || normalized.changed) await writeDb(normalized.db);
  return normalized.db;
}

async function writeDb(db) {
  const normalized = ensureDb(db);
  let response;
  try {
    response = await supabase.from('semed_sistema').upsert({ id: DB_ID, value: normalized.db, updated_at: new Date().toISOString() });
  } catch (error) {
    throw supabaseConnectionError(error);
  }
  const { error } = response;
  if (error) throw { status: 500, error: 'Falha ao gravar Supabase.', detail: error.message };
  return normalized.db;
}

function currentUser(db) {
  try {
    const saved = JSON.parse(localStorage.user || 'null');
    return db.users.find((u) => Number(u.id) === Number(saved?.id) && String(u.status).toUpperCase() === 'ATIVO') || null;
  } catch {
    return null;
  }
}

function publicUser(user) {
  const { password, ...safe } = user;
  return safe;
}

function isUnitScoped(user) {
  const role = String(user?.role || '').toUpperCase();
  return role === 'GESTOR UNIDADE' || role === 'PROFESSOR';
}

function userUnitId(user) {
  return Number(user?.unit_id || 0);
}

function scopedClasses(db, user) {
  if (!isUnitScoped(user)) return db.classes;
  const unitId = userUnitId(user);
  return db.classes.filter((c) => Number(c.unit_id) === unitId);
}

function scopedClassIds(db, user) {
  return scopedClasses(db, user).map((c) => Number(c.id));
}

function registrationClassIds(row) {
  return (Array.isArray(row?.class_ids) && row.class_ids.length ? row.class_ids : [row?.class_id].filter(Boolean)).map(Number);
}

function registrationInScope(row, db, user) {
  if (!row) return false;
  if (!isUnitScoped(user)) return true;
  const unitId = userUnitId(user);
  if (Number(row.unit_id || 0) === unitId) return true;
  const allowed = scopedClassIds(db, user);
  return registrationClassIds(row).some((id) => allowed.includes(id));
}

function ensureUnitScope(db, user, unitId) {
  if (isUnitScoped(user) && Number(unitId || 0) !== userUnitId(user)) throw { status: 403, error: 'Acesso permitido apenas para a unidade do usuario.' };
}

function scopedCatalogRows(db, user, resource) {
  if (!isUnitScoped(user)) return resource === 'users' ? db.users.map(publicUser) : db[resource];
  const unitId = userUnitId(user);
  if (resource === 'units') return db.units.filter((u) => Number(u.id) === unitId);
  if (resource === 'locations') return db.locations.filter((x) => Number(x.unit_id) === unitId);
  if (resource === 'classes') return db.classes.filter((x) => Number(x.unit_id) === unitId);
  if (resource === 'users') return db.users.filter((x) => Number(x.unit_id) === unitId).map(publicUser);
  if (resource === 'teachers') return db.teachers;
  if (resource === 'activities') {
    const activityIds = new Set(scopedClasses(db, user).map((c) => Number(c.activity_id)));
    return db.activities.filter((a) => activityIds.has(Number(a.id)) || activityIds.size === 0);
  }
  return db[resource];
}

function log(db, user, action, table, record_id, details = {}) {
  db.logs.unshift({ id: nextId(db.logs), user_id: user?.id || 0, user_name: user?.name || 'SISTEMA', action, table, record_id, details, created_at: new Date().toISOString() });
}

function classAvailability(db, classId) {
  const klass = db.classes.find((c) => Number(c.id) === Number(classId));
  if (!klass) return { vacancies: 0, active: 0, waiting: 0, available: 0 };
  const includes = (r) => Number(r.class_id) === Number(classId) || (Array.isArray(r.class_ids) && r.class_ids.map(Number).includes(Number(classId)));
  const active = db.registrations.filter((r) => includes(r) && String(r.status).toUpperCase() === 'ATIVO').length;
  const waiting = db.registrations.filter((r) => includes(r) && String(r.status).toUpperCase() === 'LISTA DE ESPERA').length;
  return { vacancies: Number(klass.vacancies || 0), active, waiting, available: Math.max(Number(klass.vacancies || 0) - active, 0) };
}

function enrichClass(db, classId) {
  const klass = db.classes.find((c) => Number(c.id) === Number(classId));
  if (!klass) return null;
  const activity = db.activities.find((a) => Number(a.id) === Number(klass.activity_id));
  const teacher = db.teachers.find((t) => Number(t.id) === Number(klass.teacher_id));
  const unit = db.units.find((u) => Number(u.id) === Number(klass.unit_id));
  return { ...klass, activity_name: activity?.name || '', activity_modality: activity?.modality || '', activity_local: activity?.local || '', teacher_name: teacher?.name || '', unit_name: unit?.name || '' };
}

function enrichedRegistrations(db, rows) {
  return rows.map((row) => {
    const ids = Array.isArray(row.class_ids) && row.class_ids.length ? row.class_ids : [row.class_id].filter(Boolean);
    const selected_classes = ids.map((id) => enrichClass(db, id)).filter(Boolean);
    const first = selected_classes[0] || {};
    return { ...row, selected_classes, unit_name: first.unit_name || '', activity_name: first.activity_name || '', teacher_name: first.teacher_name || '', class_weekday: first.weekday || '', class_start_time: first.start_time || '', class_end_time: first.end_time || '', class_shift: first.shift || '', class_modality: first.modality || first.activity_modality || '', class_local: first.local || first.activity_local || '' };
  });
}

function classesConflict(a, b) {
  if (!a || !b) return false;
  if (String(a.weekday).toUpperCase() !== String(b.weekday).toUpperCase()) return false;
  return String(a.start_time) < String(b.end_time) && String(b.start_time) < String(a.end_time);
}

function parts(path) {
  return path.split('?')[0].replace(/^\//, '').split('/').filter(Boolean);
}

async function request(method, path, data = undefined) {
  const db = await readDb();
  const p = parts(path);
  const route = p.join('/');
  if (method === 'GET' && (route === 'health' || route === '')) return { ok: true, database: 'Supabase' };
  if (method === 'POST' && route === 'auth/login') {
    const email = String(data?.email || '').trim().toLowerCase();
    const password = String(data?.password || '').trim();
    const user = db.users.find((u) => String(u.email || '').toLowerCase() === email && String(u.password || '') === password && String(u.status).toUpperCase() === 'ATIVO');
    if (!user) throw { status: 401, error: 'Credenciais invalidas.' };
    log(db, user, 'LOGIN', 'users', user.id);
    await writeDb(db);
    return { token: `supabase-${user.id}-${Date.now()}`, user: publicUser(user) };
  }
  const user = currentUser(db);
  if (!user) throw { status: 401, error: 'Nao autenticado.' };
  if (method === 'GET' && route === 'auth/me') return publicUser(user);
  if (method === 'GET' && route === 'relatorios/dashboard') {
    const visibleClasses = scopedClasses(db, user);
    const visibleClassIds = visibleClasses.map((c) => Number(c.id));
    const regs = db.registrations.filter((r) => registrationInScope(r, db, user));
    const activities = db.activities.map((a) => {
      const classIds = visibleClasses.filter((c) => Number(c.activity_id) === Number(a.id)).map((c) => Number(c.id));
      const activityRegs = regs.filter((r) => registrationClassIds(r).some((id) => classIds.includes(id)));
      return { activity_id: a.id, atividade: a.name, matriculas_ativas: activityRegs.filter((r) => r.status === 'Ativo').length, vagas_abertas: visibleClasses.filter((c) => classIds.includes(Number(c.id))).reduce((s, c) => s + classAvailability(db, c.id).available, 0) };
    }).filter((a) => a.matriculas_ativas || a.vagas_abertas).slice(0, 8);
    const scopedAttendance = db.attendance.filter((a) => visibleClassIds.includes(Number(a.class_id)));
    const avg = scopedAttendance.length ? Math.round((scopedAttendance.filter((a) => a.present).length / scopedAttendance.length) * 1000) / 10 : 0;
    return { totals: { total_inscritos: regs.length, ativos: regs.filter((r) => r.status === 'Ativo').length, espera: regs.filter((r) => r.status === 'Lista de espera').length }, activities, attendance: { frequencia_media: avg } };
  }
  if (p[0] === 'catalogos') {
    const resource = p[1];
    if (!['units', 'locations', 'teachers', 'activities', 'classes', 'users'].includes(resource)) throw { status: 404, error: 'Recurso nao encontrado.' };
    if (method === 'GET') { const rows = scopedCatalogRows(db, user, resource); return { rows, total: rows.length }; }
    if (method === 'POST') {
      if (['locations','classes','users'].includes(resource)) ensureUnitScope(db, user, data?.unit_id);
      const row = { id: nextId(db[resource]), ...(data || {}), status: data?.status || 'Ativo' };
      db[resource].push(row);
      log(db, user, 'CREATE', resource, row.id, row);
      await writeDb(db);
      return row;
    }
    if (method === 'PUT' && p[2]) {
      const idx = db[resource].findIndex((r) => Number(r.id) === Number(p[2]));
      if (idx < 0) throw { status: 404, error: 'Recurso nao encontrado.' };
      if (['locations','classes','users'].includes(resource)) ensureUnitScope(db, user, data?.unit_id ?? db[resource][idx].unit_id);
      db[resource][idx] = { ...db[resource][idx], ...(data || {}) };
      log(db, user, 'UPDATE', resource, Number(p[2]), data || {});
      await writeDb(db);
      return db[resource][idx];
    }
    if (method === 'DELETE' && p[2]) {
      const target = db[resource].find((r) => Number(r.id) === Number(p[2]));
      if (target && ['locations','classes','users'].includes(resource)) ensureUnitScope(db, user, target.unit_id);
      db[resource] = db[resource].filter((r) => Number(r.id) !== Number(p[2]));
      log(db, user, 'DELETE', resource, Number(p[2]));
      await writeDb(db);
      return { deleted: true };
    }
  }
  if (p[0] === 'inscricoes') {
    if (method === 'GET') {
      const search = new URLSearchParams(path.split('?')[1] || '').get('search')?.toLowerCase() || '';
      let rows = db.registrations.filter((r) => registrationInScope(r, db, user));
      if (search) rows = rows.filter((r) => `${r.full_name} ${r.cpf}`.toLowerCase().includes(search));
      return { rows: enrichedRegistrations(db, rows), total: rows.length };
    }
    if (method === 'POST') {
      const classIds = Array.isArray(data.class_ids) && data.class_ids.length ? data.class_ids.map(Number).filter(Boolean).slice(0, 3) : [Number(data.class_id)].filter(Boolean);
      const selected = classIds.map((id) => db.classes.find((c) => Number(c.id) === id)).filter(Boolean);
      if (!selected.length) throw { status: 422, error: 'Turma/oficina obrigatoria.' };
      selected.forEach((c) => ensureUnitScope(db, user, c.unit_id));
      for (let i = 0; i < selected.length; i++) for (let j = i + 1; j < selected.length; j++) if (classesConflict(selected[i], selected[j])) throw { status: 422, error: 'As atividades escolhidas possuem conflito.' };
      const full = selected.some((c) => classAvailability(db, c.id).available <= 0);
      const id = nextId(db.registrations);
      const row = { id, ...data, class_id: classIds[0], class_ids: classIds, registration_number: `SEMED-${new Date().getFullYear()}-${String(id).padStart(5, '0')}`, status: data.status || (full ? 'Lista de espera' : 'Ativo'), created_at: new Date().toISOString() };
      db.registrations.push(row);
      log(db, user, 'CREATE', 'registrations', row.id, row);
      await writeDb(db);
      return row;
    }
    if (method === 'PUT' && p[1]) {
      const idx = db.registrations.findIndex((r) => Number(r.id) === Number(p[1]));
      if (idx < 0) throw { status: 404, error: 'Inscricao nao encontrada.' };
      const classIds = Array.isArray(data.class_ids) && data.class_ids.length ? data.class_ids.map(Number).filter(Boolean).slice(0, 3) : [Number(data.class_id)].filter(Boolean);
      const selected = classIds.map((id) => db.classes.find((c) => Number(c.id) === id)).filter(Boolean);
      if (!selected.length) throw { status: 422, error: 'Turma/oficina obrigatoria.' };
      for (let i = 0; i < selected.length; i++) for (let j = i + 1; j < selected.length; j++) if (classesConflict(selected[i], selected[j])) throw { status: 422, error: 'As atividades escolhidas possuem conflito.' };
      const old = db.registrations[idx];
      if (!registrationInScope(old, db, user)) throw { status: 403, error: 'Acesso permitido apenas para a unidade do usuario.' };
      selected.forEach((c) => ensureUnitScope(db, user, c.unit_id));
      db.registrations[idx] = { ...old, ...(data || {}), id: old.id, class_id: classIds[0], class_ids: classIds, registration_number: old.registration_number, created_at: old.created_at };
      log(db, user, 'UPDATE', 'registrations', old.id, db.registrations[idx]);
      await writeDb(db);
      return db.registrations[idx];
    }
    if (method === 'DELETE' && p[1]) {
      if (String(user.role || '').toUpperCase() !== 'ADMINISTRADOR') throw { status: 403, error: 'Apenas o perfil Administrador pode excluir inscricoes.' };
      const id = Number(p[1]);
      const exists = db.registrations.some((r) => Number(r.id) === id);
      if (!exists) throw { status: 404, error: 'Inscricao nao encontrada.' };
      const targetRegistration = db.registrations.find((r) => Number(r.id) === id);
      if (!registrationInScope(targetRegistration, db, user)) throw { status: 403, error: 'Acesso permitido apenas para a unidade do usuario.' };
      db.registrations = db.registrations.filter((r) => Number(r.id) !== id);
      db.attendance = db.attendance.filter((a) => Number(a.registration_id) !== id);
      log(db, user, 'DELETE', 'registrations', id);
      await writeDb(db);
      return { deleted: true };
    }

  }
  if (p[0] === 'frequencias') {
    if (method === 'GET' && p[1] === 'classes' && p[3] === 'students') {
      const classId = Number(p[2]);
      return db.registrations.filter((r) => (Number(r.class_id) === classId || (r.class_ids || []).map(Number).includes(classId)) && r.status === 'Ativo');
    }
    if (method === 'POST') {
      const klass = db.classes.find((c) => Number(c.id) === Number(data.class_id));
      ensureUnitScope(db, user, klass?.unit_id);
      for (const item of data.items || []) {
        const existing = db.attendance.find((a) => Number(a.class_id) === Number(data.class_id) && Number(a.registration_id) === Number(item.registration_id) && a.date === data.date);
        if (existing) existing.present = Boolean(item.present);
        else db.attendance.push({ id: nextId(db.attendance), class_id: Number(data.class_id), registration_id: Number(item.registration_id), date: data.date, present: Boolean(item.present), recorded_by: user.id });
      }
      log(db, user, 'UPSERT', 'attendance', Number(data.class_id), { date: data.date });
      await writeDb(db);
      return { saved: true };
    }
  }
  if (p[0] === 'relatorios') {
    if (p[1] === 'logs' && method === 'GET') return isUnitScoped(user) ? db.logs.filter((l) => Number(l.user_id || 0) === Number(user.id)).slice(0, 200) : db.logs.slice(0, 200);
    if (p[1] === 'logs' && method === 'DELETE') {
      const start = data?.start ? new Date(data.start + 'T00:00:00') : null;
      const end = data?.end ? new Date(data.end + 'T23:59:59') : null;
      if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw { status: 422, error: 'Periodo de datas obrigatorio.' };
      const before = db.logs.length;
      db.logs = db.logs.filter((item) => { const dt = new Date(item.created_at || 0); return dt < start || dt > end; });
      const removed = before - db.logs.length;
      log(db, user, 'DELETE', 'logs', 0, { start: data.start, end: data.end, removed });
      await writeDb(db);
      return { deleted: removed };
    }
    if (p[1] === 'gerencial') return scopedClasses(db, user).map((c) => {
      const regs = db.registrations.filter((r) => Number(r.class_id) === Number(c.id) || (r.class_ids || []).map(Number).includes(Number(c.id)));
      return { unidade: db.units.find((u) => Number(u.id) === Number(c.unit_id))?.name || '', atividade: db.activities.find((a) => Number(a.id) === Number(c.activity_id))?.name || '', turno: c.shift, ativos: regs.filter((r) => r.status === 'Ativo').length, espera: regs.filter((r) => r.status === 'Lista de espera').length, vagas_ofertadas: c.vacancies, vagas_preenchidas: regs.length };
    });
    if (p[1] === 'agenda') return scopedClasses(db, user).flatMap((c) => db.registrations.filter((r) => Number(r.class_id) === Number(c.id) || (r.class_ids || []).map(Number).includes(Number(c.id))).map((r) => ({ unidade: db.units.find((u) => Number(u.id) === Number(c.unit_id))?.name || '', atividade: db.activities.find((a) => Number(a.id) === Number(c.activity_id))?.name || '', professor: db.teachers.find((t) => Number(t.id) === Number(c.teacher_id))?.name || '', dia: c.weekday, horario: `${c.start_time} - ${c.end_time}`, aluno: r.full_name, inscricao: r.registration_number, status: r.status })));
  }
  throw { status: 404, error: 'Recurso nao encontrado.' };
}

window.SEMED_DB_REQUEST = request;
window.SEMED_SUPABASE_CLIENT = supabase;
