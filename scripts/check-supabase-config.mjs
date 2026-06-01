import fs from 'node:fs';

for (const file of ['index.html', 'app.js', 'supabase-init.js', 'supabase-config.js', 'supabase.sql']) {
  if (!fs.existsSync(file)) throw new Error(`Arquivo obrigatorio ausente: ${file}`);
}

const init = fs.readFileSync('supabase-init.js', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
const sql = fs.readFileSync('supabase.sql', 'utf8');

if (!init.includes('createClient') || !init.includes('semed_sistema') || !init.includes('SEMED_DB_REQUEST')) {
  throw new Error('supabase-init.js deve conectar ao Supabase e expor SEMED_DB_REQUEST');
}
if (!init.includes('admin@semed.local') || !init.includes('adm123')) {
  throw new Error('Administrador padrao ausente');
}
if (!app.includes('SEMED_DB_REQUEST')) {
  throw new Error('app.js deve consumir SEMED_DB_REQUEST');
}
if (!sql.includes('create table if not exists public.semed_sistema')) {
  throw new Error('supabase.sql deve criar public.semed_sistema');
}

console.log('GitHub Pages + Supabase config OK');
