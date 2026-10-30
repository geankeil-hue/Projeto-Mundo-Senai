const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const authPath = path.join(__dirname, '..', 'auth.js');
const source = fs.readFileSync(authPath, 'utf8');

function createAuthSandbox() {
  const storage = new Map();
  const document = {
    readyState: 'complete',
    querySelectorAll() { return []; },
    addEventListener() {}
  };

  const sandbox = {
    console,
    localStorage: {
      getItem(key) { return storage.has(key) ? storage.get(key) : null; },
      setItem(key, value) { storage.set(key, String(value)); },
      removeItem(key) { storage.delete(key); },
      clear() { storage.clear(); }
    },
    document,
    window: null,
    setTimeout,
    clearTimeout,
    Date,
    Math,
    JSON,
    String,
    Array,
    Object,
    Number,
    Boolean
  };

  sandbox.window = sandbox;
  vm.runInNewContext(source, sandbox, { filename: 'auth.js' });
  return sandbox;
}

test('destinatario usa a página exclusiva após login', () => {
  const sandbox = createAuthSandbox();
  const users = [{
    id: 'dest-1',
    nome: 'Maria Destinatária',
    email: 'maria@demo.com',
    senha: '123456',
    cpf: '11122233344',
    cnpj: '',
    role: 'destinatario',
    createdAt: new Date().toISOString()
  }];

  sandbox.localStorage.setItem('freteConectaUsers', JSON.stringify(users));
  sandbox.localStorage.removeItem('freteConectaCurrentUser');

  const auth = sandbox.window.FreteConectaAuth;
  const generatedUser = auth.login('maria@demo.com', '123456', 'destinatario');

  assert.ok(generatedUser, 'deve autenticar o destinatário');
  assert.equal(auth.getRoleHome('destinatario'), 'destinatario-entregas.html');
});

test('destinatario mantém apenas o link de destinatários visível no menu', () => {
  const elements = [
    { textContent: 'Para caminhoneiros', style: {}, hasAttribute() { return false; }, getAttribute() { return null; }, closest() { return null; }, setAttribute() {}, removeAttribute() {} },
    { textContent: 'Para embarcadores', style: {}, hasAttribute() { return false; }, getAttribute() { return null; }, closest() { return null; }, setAttribute() {}, removeAttribute() {} },
    { textContent: 'Para destinatários', style: {}, hasAttribute() { return false; }, getAttribute() { return null; }, closest() { return null; }, setAttribute() {}, removeAttribute() {} }
  ];

  const sandbox = createAuthSandbox();
  sandbox.document.querySelectorAll = () => elements;
  sandbox.localStorage.setItem('freteConectaCurrentUser', JSON.stringify({
    id: 'dest-1',
    nome: 'Maria',
    email: 'maria@demo.com',
    role: 'destinatario'
  }));

  const auth = sandbox.window.FreteConectaAuth;
  auth.hideLoginOptions();

  assert.equal(elements[0].style.display, 'none');
  assert.equal(elements[1].style.display, 'none');
  assert.equal(elements[2].style.display, '');
});

test('embarcador novo não é bloqueado por campo vazio de cadastro anterior', () => {
  const sandbox = createAuthSandbox();
  const auth = sandbox.window.FreteConectaAuth;

  sandbox.localStorage.setItem('freteConectaUsers', JSON.stringify([
    {
      id: 'old-user',
      nome: 'Antigo Usuário',
      email: 'antigo@empresa.com',
      senha: '123456',
      cpf: '',
      cnpj: '11.222.333/0001-55',
      role: 'embarcador',
      createdAt: new Date().toISOString()
    }
  ]));

  assert.doesNotThrow(() => {
    auth.register({
      nome: 'Novo Embarcador',
      email: 'novo@empresa.com',
      senha: '654321',
      cnpj: '99.888.777/0001-66',
      role: 'embarcador'
    });
  });
});

test('login de caminhoneiro não deve aceitar credenciais de embarcador com o mesmo e-mail e senha', () => {
  const sandbox = createAuthSandbox();
  const auth = sandbox.window.FreteConectaAuth;

  sandbox.localStorage.setItem('freteConectaUsers', JSON.stringify([
    {
      id: 'emb-1',
      nome: 'Embarcador',
      email: 'mesmo@email.com',
      senha: '123456',
      cpf: '',
      cnpj: '88.999.777/0001-20',
      role: 'embarcador',
      createdAt: new Date().toISOString()
    }
  ]));

  assert.equal(auth.login('mesmo@email.com', '123456', 'caminhoneiro'), null);
});

test('cadastro em outro papel deve permitir o mesmo e-mail quando o perfil for diferente', () => {
  const sandbox = createAuthSandbox();
  const auth = sandbox.window.FreteConectaAuth;

  sandbox.localStorage.setItem('freteConectaUsers', JSON.stringify([
    {
      id: 'cam-1',
      nome: 'Caminhoneiro',
      email: 'mesmo@email.com',
      senha: '123456',
      cpf: '12345678909',
      cnpj: '',
      role: 'caminhoneiro',
      createdAt: new Date().toISOString()
    }
  ]));

  assert.doesNotThrow(() => {
    auth.register({
      nome: 'Destinatário',
      email: 'mesmo@email.com',
      senha: '654321',
      cpf: '98765432100',
      role: 'destinatario'
    });
  });
});

test('publicar carga deve persistir e listar corretamente com dados do embarcador', () => {
  const sandbox = createAuthSandbox();
  const auth = sandbox.window.FreteConectaAuth;

  sandbox.localStorage.setItem('freteConectaCurrentUser', JSON.stringify({
    id: 'emb-1',
    nome: 'Embarcador Demo',
    email: 'embarcador@demo.com',
    role: 'embarcador'
  }));

  const carga = auth.publishCarga({
    origem: 'São Paulo / SP',
    destino: 'Campinas / SP',
    tipo: 'Grãos',
    regiaoOrigem: 'Sudeste',
    regiaoPublicacao: 'Sudeste',
    peso: '12 t',
    data: '2026-10-30',
    valor: 'R$ 3.400,00',
    observacoes: 'Carga com entrega urgente'
  });

  assert.ok(carga.id);
  const cargasDoEmbarcador = auth.getCargas().filter((item) => item.userId === 'emb-1');
  assert.equal(cargasDoEmbarcador.length, 1);
  assert.equal(cargasDoEmbarcador[0].origem, 'São Paulo / SP');
  assert.equal(cargasDoEmbarcador[0].destino, 'Campinas / SP');
});
