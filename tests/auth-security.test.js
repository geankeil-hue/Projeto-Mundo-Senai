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
    querySelector() { return null; },
    addEventListener() {},
    createElement() {
      return { style: {}, setAttribute() {}, removeAttribute() {}, appendChild() {}, addEventListener() {}, className: '' };
    }
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
    crypto: { getRandomValues(array) { for (let i = 0; i < array.length; i += 1) array[i] = (Math.random() * 255) | 0; return array; } },
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
  sandbox.location = { pathname: '/', href: 'http://localhost/' };
  vm.runInNewContext(source, sandbox, { filename: 'auth.js' });
  return sandbox;
}

test('senhas são armazenadas em hash e não em texto puro', () => {
  const sandbox = createAuthSandbox();
  const auth = sandbox.window.FreteConectaAuth;

  auth.register({
    nome: 'Ana Souza',
    email: 'ana@teste.com',
    senha: 'Senha123',
    cpf: '12345678909',
    role: 'destinatario'
  });

  const user = auth.getUsers()[0];
  assert.match(user.senha, /^sha256:/);
  assert.notEqual(user.senha, 'Senha123');
});

test('recuperação de senha exige código válido e redefine a senha', () => {
  const sandbox = createAuthSandbox();
  const auth = sandbox.window.FreteConectaAuth;

  auth.register({
    nome: 'Bruno',
    email: 'bruno@empresa.com',
    senha: 'Senha123',
    cpf: '98765432100',
    role: 'destinatario'
  });

  const recovery = auth.sendPasswordRecoveryEmail('bruno@empresa.com', 'destinatario');
  assert.equal(recovery.success, true);
  const stored = JSON.parse(sandbox.localStorage.getItem('freteConectaRecoveryCode'));
  assert.ok(stored.codigo);

  const updated = auth.resetPassword('bruno@empresa.com', stored.codigo, 'NovaSenha456', 'destinatario');
  assert.equal(updated.success, true);
  assert.equal(auth.login('bruno@empresa.com', 'NovaSenha456', 'destinatario') !== null, true);
  assert.equal(auth.login('bruno@empresa.com', 'Senha123', 'destinatario'), null);
});

test('uma carga aceita por um caminhoneiro não pode ser aceita por outro', () => {
  const sandbox = createAuthSandbox();
  const auth = sandbox.window.FreteConectaAuth;

  sandbox.localStorage.setItem('freteConectaCurrentUser', JSON.stringify({
    id: 'emb-1',
    nome: 'Embarcador',
    email: 'embarcador@teste.com',
    role: 'embarcador'
  }));

  const carga = auth.publishCarga({
    origem: 'São Paulo / SP',
    destino: 'Campinas / SP',
    tipo: 'Grãos',
    regiaoOrigem: 'Sudeste',
    regiaoPublicacao: 'Sudeste',
    peso: '10 t',
    data: '2026-11-20',
    valor: 'R$ 2.500,00',
    observacoes: 'Carga urgente'
  });

  sandbox.localStorage.setItem('freteConectaCurrentUser', JSON.stringify({
    id: 'cam-1',
    nome: 'Motorista 1',
    email: 'motor1@teste.com',
    role: 'caminhoneiro'
  }));
  auth.acceptCarga(carga.id);

  sandbox.localStorage.setItem('freteConectaCurrentUser', JSON.stringify({
    id: 'cam-2',
    nome: 'Motorista 2',
    email: 'motor2@teste.com',
    role: 'caminhoneiro'
  }));

  assert.throws(() => auth.acceptCarga(carga.id), /aceita por outro caminhoneiro|não encontrada|Faça login/i);
});

test('cancelamento exige permissão do embarcador ou do motorista responsável', () => {
  const sandbox = createAuthSandbox();
  const auth = sandbox.window.FreteConectaAuth;

  sandbox.localStorage.setItem('freteConectaCurrentUser', JSON.stringify({
    id: 'emb-1',
    nome: 'Embarcador',
    email: 'embarcador@teste.com',
    role: 'embarcador'
  }));

  const carga = auth.publishCarga({
    origem: 'Belo Horizonte / MG',
    destino: 'Uberlândia / MG',
    tipo: 'Industrial',
    regiaoOrigem: 'Sudeste',
    regiaoPublicacao: 'Sudeste',
    peso: '8 t',
    data: '2026-11-25',
    valor: 'R$ 3.200,00',
    observacoes: 'Entrega em 2 dias'
  });

  sandbox.localStorage.setItem('freteConectaCurrentUser', JSON.stringify({
    id: 'cam-9',
    nome: 'Motorista',
    email: 'motorista@teste.com',
    role: 'caminhoneiro'
  }));
  auth.acceptCarga(carga.id);

  const cancelled = auth.cancelCarga(carga.id, 'Falha operacional');
  assert.equal(cancelled.status, 'cancelada');
  assert.equal(cancelled.motivoCancelamento, 'Falha operacional');
});
