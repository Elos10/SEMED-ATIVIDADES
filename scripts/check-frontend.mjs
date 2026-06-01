import fs from 'node:fs';

for (const file of ['index.html']) {
  const html = fs.readFileSync(file, 'utf8');
  if (!html.includes('/supabase-init.js') && !html.includes('./supabase-init.js')) {
    throw new Error('index.html deve carregar supabase-init.js');
  }
  if (!html.includes('./app.js')) {
    throw new Error('index.html deve carregar app.js');
  }
}

console.log('index.html OK');
