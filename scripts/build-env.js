const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_ANON_KEY || '';

const content =
  '// Gegenereerd door Netlify build\n' +
  'window.ENV = { SUPABASE_URL: "' + url.replace(/"/g, '\\"') + '", SUPABASE_ANON_KEY: "' + key.replace(/"/g, '\\"') + '" };\n';

fs.writeFileSync(path.join(publicDir, 'env.js'), content, 'utf8');
console.log('env.js written (SUPABASE_URL set:', !!url, ')');
