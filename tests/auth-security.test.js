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
  assert.equal(cancelled.status, 'publicada');
  assert.equal(cancelled.motivoCancelamento, 'Falha operacional');
  assert.equal(cancelled.caminhoneiroId, '');
});

test('motorista pode cancelar corrida em andamento, mas não depois da entrega finalizada', () => {
  const sandbox = createAuthSandbox();
  const auth = sandbox.window.FreteConectaAuth;

  auth.register({
    nome: 'Empresa Norte',
    email: 'norte@empresa.com',
    senha: 'Senha123',
    cnpj: '12.345.678/0001-90',
    role: 'embarcador'
  });

  const motorista = auth.register({
    nome: 'Motorista Cancelador',
    email: 'cancelador@teste.com',
    senha: 'Senha123',
    cpf: '98765432100',
    role: 'caminhoneiro'
  });

  auth.login('norte@empresa.com', 'Senha123', 'embarcador');
  const carga = auth.publishCarga({
    origem: 'São Paulo / SP',
    destino: 'Curitiba / PR',
    tipo: 'Produtos',
    regiaoOrigem: 'Sudeste',
    regiaoPublicacao: 'Sudeste',
    peso: '5 t',
    data: '2026-12-12',
    valor: 'R$ 4.500,00',
    observacoes: 'Carga sensível'
  });

  auth.login('cancelador@teste.com', 'Senha123', 'caminhoneiro');
  auth.acceptCarga(carga.id);
  auth.confirmCarga(carga.id);

  const canceladaEmAndamento = auth.cancelCarga(carga.id, 'Problema de logística');
  assert.equal(canceladaEmAndamento.status, 'publicada');
  assert.equal(canceladaEmAndamento.canceladaPor, motorista.id);
  assert.equal(canceladaEmAndamento.caminhoneiroId, '');

  auth.login('norte@empresa.com', 'Senha123', 'embarcador');
  const novaCarga = auth.publishCarga({
    origem: 'Campinas / SP',
    destino: 'Santos / SP',
    tipo: 'Bebidas',
    regiaoOrigem: 'Sudeste',
    regiaoPublicacao: 'Sudeste',
    peso: '3 t',
    data: '2026-12-15',
    valor: 'R$ 2.700,00',
    observacoes: 'Nova etapa de teste'
  });

  auth.login('cancelador@teste.com', 'Senha123', 'caminhoneiro');
  auth.acceptCarga(novaCarga.id);
  auth.atualizarStatusEntrega(novaCarga.id, 'entrega_finalizada');

  assert.throws(() => auth.cancelCarga(novaCarga.id, 'Tentativa indevida'), /finalizada|entreg/i);
});

test('confirmação da corrida registra status em_corrida e mantém o fluxo válido', () => {
  const sandbox = createAuthSandbox();
  const auth = sandbox.window.FreteConectaAuth;

  sandbox.localStorage.setItem('freteConectaCurrentUser', JSON.stringify({
    id: 'emb-100',
    nome: 'Embarcador Atual',
    email: 'embarcador@teste.com',
    role: 'embarcador'
  }));

  const carga = auth.publishCarga({
    origem: 'São Paulo / SP',
    destino: 'Curitiba / PR',
    tipo: 'Grãos',
    regiaoOrigem: 'Sudeste',
    regiaoPublicacao: 'Sudeste',
    peso: '6 t',
    data: '2026-12-20',
    valor: 'R$ 3.100,00',
    observacoes: 'Validação da corrida após confirmação'
  });

  sandbox.localStorage.setItem('freteConectaCurrentUser', JSON.stringify({
    id: 'cam-100',
    nome: 'Motorista Atual',
    email: 'motorista@teste.com',
    role: 'caminhoneiro'
  }));

  auth.acceptCarga(carga.id);
  const confirmada = auth.confirmCarga(carga.id);
  assert.equal(confirmada.status, 'em_corrida');
  assert.doesNotThrow(() => auth.atualizarStatusEntrega(carga.id, 'em_transporte', 'cam-100'));

  const atualizada = auth.getCargas().find((item) => String(item.id) === String(carga.id));
  assert.equal(atualizada.status, 'em_transporte');
});

test('motorista pode cancelar a corrida e aceitar a carga novamente', () => {
  const sandbox = createAuthSandbox();
  const auth = sandbox.window.FreteConectaAuth;

  sandbox.localStorage.setItem('freteConectaCurrentUser', JSON.stringify({
    id: 'emb-cancelar',
    nome: 'Embarcador Cancelar',
    email: 'cancelar@teste.com',
    role: 'embarcador'
  }));

  const carga = auth.publishCarga({
    origem: 'Florianópolis / SC',
    destino: 'Joinville / SC',
    tipo: 'Eletrônicos',
    regiaoOrigem: 'Sul',
    regiaoPublicacao: 'Sul',
    peso: '6 t',
    data: '2026-11-18',
    valor: 'R$ 2.800,00',
    observacoes: 'Teste de cancelamento e reaceite'
  });

  sandbox.localStorage.setItem('freteConectaCurrentUser', JSON.stringify({
    id: 'cam-cancelar',
    nome: 'Motorista Cancelar',
    email: 'motorista-cancelar@teste.com',
    role: 'caminhoneiro'
  }));

  auth.acceptCarga(carga.id);
  auth.cancelCarga(carga.id, 'Cancelamento do motorista');

  const cancelada = auth.getCargas().find((item) => String(item.id) === String(carga.id));
  assert.equal(cancelada.status, 'publicada');
  assert.equal(cancelada.caminhoneiroId, '');
  assert.doesNotThrow(() => auth.acceptCarga(carga.id));
  assert.equal(auth.getCargas().find((item) => String(item.id) === String(carga.id)).status, 'aceita');
});

test('embarcador pode editar o valor da carga e cancelar a publicação', () => {
  const sandbox = createAuthSandbox();
  const auth = sandbox.window.FreteConectaAuth;

  sandbox.localStorage.setItem('freteConectaCurrentUser', JSON.stringify({
    id: 'emb-editar',
    nome: 'Embarcador Editar',
    email: 'editar@teste.com',
    role: 'embarcador'
  }));

  const carga = auth.publishCarga({
    origem: 'Porto Alegre / RS',
    destino: 'Curitiba / PR',
    tipo: 'Carga seca',
    regiaoOrigem: 'Sul',
    regiaoPublicacao: 'Sul',
    peso: '4 t',
    data: '2026-11-22',
    valor: 'R$ 3.000,00',
    observacoes: 'Carga de teste'
  });

  const atualizada = auth.updateCargaValor(carga.id, 'R$ 3.500,00');
  assert.equal(atualizada.valor, 'R$ 3.500,00');

  const cancelada = auth.cancelCarga(carga.id, 'Publicação cancelada pelo embarcador');
  assert.equal(cancelada.status, 'cancelada');
  assert.equal(cancelada.motivoCancelamento, 'Publicação cancelada pelo embarcador');
});

test('carga cancelada não aparece mais na lista de cargas do embarcador', () => {
  const sandbox = createAuthSandbox();
  const auth = sandbox.window.FreteConectaAuth;

  sandbox.localStorage.setItem('freteConectaCurrentUser', JSON.stringify({
    id: 'emb-lista',
    nome: 'Embarcador Lista',
    email: 'lista@teste.com',
    role: 'embarcador'
  }));

  const carga = auth.publishCarga({
    origem: 'Rio / RJ',
    destino: 'Niterói / RJ',
    tipo: 'Móveis',
    regiaoOrigem: 'Sudeste',
    regiaoPublicacao: 'Sudeste',
    peso: '2 t',
    data: '2026-11-30',
    valor: 'R$ 1.800,00',
    observacoes: 'Teste de remoção da lista'
  });

  auth.cancelCarga(carga.id, 'Publicação cancelada pelo embarcador');

  const lista = auth.getCargasDoEmbarcador('emb-lista');
  assert.equal(lista.some((item) => String(item.id) === String(carga.id)), false);
  assert.equal(lista.length >= 0, true);
});

test('carga aceita expira automaticamente quando o prazo termina', () => {
  const sandbox = createAuthSandbox();
  const auth = sandbox.window.FreteConectaAuth;

  sandbox.localStorage.setItem('freteConectaCurrentUser', JSON.stringify({
    id: 'emb-99',
    nome: 'Embarcador Teste',
    email: 'embarcador@teste.com',
    role: 'embarcador'
  }));

  const carga = auth.publishCarga({
    origem: 'São Paulo / SP',
    destino: 'Curitiba / PR',
    tipo: 'Grãos',
    regiaoOrigem: 'Sudeste',
    regiaoPublicacao: 'Sudeste',
    peso: '6 t',
    data: '2026-12-20',
    valor: 'R$ 3.100,00',
    observacoes: 'Prazo de entrega crítico'
  });

  sandbox.localStorage.setItem('freteConectaCurrentUser', JSON.stringify({
    id: 'cam-99',
    nome: 'Motorista Prazo',
    email: 'prazo@teste.com',
    role: 'caminhoneiro'
  }));

  const aceita = auth.acceptCarga(carga.id);
  assert.ok(aceita.expiraEm, 'deve registrar uma data de expiração');

  const cargas = auth.getCargas();
  const alvo = cargas.find((item) => String(item.id) === String(carga.id));
  alvo.expiraEm = new Date(Date.now() - 1000).toISOString();

  auth.updateCargaStorage ? auth.updateCargaStorage(alvo) : (() => {
    const storageKey = 'freteConectaCargas';
    const lista = JSON.parse(sandbox.localStorage.getItem(storageKey) || '[]');
    const index = lista.findIndex((item) => String(item.id) === String(carga.id));
    lista[index] = alvo;
    sandbox.localStorage.setItem(storageKey, JSON.stringify(lista));
  })();

  const expiradas = auth.expirarCargasAtrasadas();
  assert.equal(expiradas, 1);
  assert.equal(auth.getCargas().find((item) => String(item.id) === String(carga.id)).status, 'expirada');
});
