const fs = require('fs');
const path = require('path');

const root = __dirname;
const files = fs.readdirSync(root).filter((f) => f.endsWith('.html'));
const broken = [];

for (const file of files) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  const matches = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);

  for (const link of matches) {
    let isExternal = false;
    if (link.startsWith('http')) isExternal = true;
    if (link.startsWith('#')) isExternal = true;
    if (link.startsWith('mailto:')) isExternal = true;
    if (link.startsWith('javascript:')) isExternal = true;

    if (!isExternal) {
      const cleanLink = link.split('#')[0] || '.';
      const target = path.resolve(root, cleanLink);
      if (!fs.existsSync(target)) {
        broken.push(file + ' -> ' + link);
      }
    }
  }
}

if (broken.length) {
  console.log('BROKEN_LINKS', broken.length);
  console.log(broken.join('\n'));
  process.exit(1);
}

console.log('HTML_LINKS_OK', files.length);

const store = {};
const ls = {
  getItem: (key) => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null),
  setItem: (key, value) => { store[key] = String(value); },
  removeItem: (key) => { delete store[key]; }
};

global.window = global;
global.localStorage = ls;

const vm = require('vm');
const authCode = fs.readFileSync(path.join(root, 'auth.js'), 'utf8');
vm.runInNewContext(authCode, global);

const cam = global.FreteConectaAuth.register({
  nome: 'Cam',
  email: 'cam@teste.com',
  cpf: '11122233344',
  senha: '123456',
  role: 'caminhoneiro'
});
const camLogin = global.FreteConectaAuth.login('cam@teste.com', '123456', 'caminhoneiro');

const emb = global.FreteConectaAuth.register({
  nome: 'Emb',
  email: 'emb@teste.com',
  cnpj: '11.222.333/0001-44',
  senha: '654321',
  role: 'embarcador'
});
const embLogin = global.FreteConectaAuth.login('emb@teste.com', '654321', 'embarcador');

const authOk = !!cam && !!camLogin && !!emb && !!embLogin;
console.log('AUTH_OK', authOk);
