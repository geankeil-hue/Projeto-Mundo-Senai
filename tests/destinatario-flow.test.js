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
    globalThis: null,
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
  sandbox.globalThis = sandbox;
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

test('modo de demonstração cria conta separada e timeline com notificações', () => {
  const sandbox = createAuthSandbox();
  const auth = sandbox.window.FreteConectaAuth;

  const demo = auth.createDemoScenario();
  assert.ok(demo.users.embarcador);
  assert.ok(demo.users.caminhoneiro);
  assert.ok(demo.users.destinatario);

  const carga = auth.publishCarga({
    origem: 'São Paulo / SP',
    destino: 'Campinas / SP',
    tipo: 'Eletrônicos',
    regiaoOrigem: 'Sudeste',
    regiaoPublicacao: 'Sudeste',
    peso: '2 t',
    data: '2026-12-01',
    valor: 'R$ 1.800,00',
    observacoes: 'Entrega de demonstração'
  }, demo.users.embarcador.id);

  const aceita = auth.acceptCarga(carga.id, demo.users.caminhoneiro.id);
  assert.equal(aceita.status, 'aceita');

  const timeline = auth.getTimeline(carga.id);
  assert.ok(Array.isArray(timeline) && timeline.length >= 2);

  const notificacoes = auth.getNotificacoes(demo.users.embarcador.id);
  assert.ok(notificacoes.some((item) => item.tipo === 'carga_aceita'));
});

test('entrega só pode ser confirmada após finalização e não aceita etapas fora de ordem', () => {
  const sandbox = createAuthSandbox();
  const auth = sandbox.window.FreteConectaAuth;

  const demo = auth.createDemoScenario();
  const carga = auth.publishCarga({
    origem: 'Rio de Janeiro / RJ',
    destino: 'Niterói / RJ',
    tipo: 'Móveis',
    regiaoOrigem: 'Sudeste',
    regiaoPublicacao: 'Sudeste',
    peso: '4 t',
    data: '2026-12-05',
    valor: 'R$ 2.500,00',
    observacoes: 'Entrega com revisão'
  }, demo.users.embarcador.id);

  auth.acceptCarga(carga.id, demo.users.caminhoneiro.id);

  assert.throws(() => auth.atualizarStatusEntrega(carga.id, 'recebimento_confirmado', demo.users.destinatario.id), /ordem|etapa|status/i);

  const atualizada = auth.atualizarStatusEntrega(carga.id, 'entrega_finalizada', demo.users.caminhoneiro.id);
  assert.equal(atualizada.status, 'entrega_finalizada');

  const confirmada = auth.confirmarRecebimento(carga.id, demo.users.destinatario.id);
  assert.equal(confirmada.status, 'recebimento_confirmado');
});

test('painel administrativo calcula indicadores reais a partir do banco local', () => {
  const sandbox = createAuthSandbox();
  const auth = sandbox.window.FreteConectaAuth;

  const embarcador = auth.register({
    nome: 'Empresa Alpha',
    email: 'empresa@alpha.com',
    cnpj: '11.222.333/0001-44',
    senha: 'Alpha123',
    role: 'embarcador'
  });

  const caminhoneiro = auth.register({
    nome: 'Motorista 1',
    email: 'motorista1@teste.com',
    cpf: '12345678909',
    senha: 'Moto123',
    role: 'caminhoneiro'
  });

  auth.publishCarga({
    origem: 'São Paulo / SP',
    destino: 'Campinas / SP',
    tipo: 'Eletrônicos',
    regiaoOrigem: 'Sudeste',
    regiaoPublicacao: 'Sudeste',
    peso: '2 t',
    data: '2026-11-10',
    valor: 'R$ 1.800,00',
    observacoes: 'Carga de teste'
  }, embarcador.id);

  const painel = auth.getAdminDashboardData();
  assert.ok(painel.totalCargas >= 1);
  assert.ok(painel.totalCaminhoneiros >= 1);
  assert.ok(painel.totalEmpresas >= 1);
  assert.ok(Array.isArray(painel.entregasPorMes));
  assert.ok(Array.isArray(painel.rotasMaisUtilizadas));
});

test('rastreamento de carga expõe rota, motorista e simulação com posição atual', () => {
  const sandbox = createAuthSandbox();
  const auth = sandbox.window.FreteConectaAuth;

  sandbox.localStorage.setItem('freteConectaUsers', JSON.stringify([
    {
      id: 'emb-01',
      nome: 'Empresa Beta',
      email: 'beta@empresa.com',
      senha: 'sha256:teste',
      cnpj: '56.789.123/0001-88',
      role: 'embarcador',
      createdAt: new Date().toISOString()
    },
    {
      id: 'cam-01',
      nome: 'Motorista Rastreado',
      email: 'rastreado@teste.com',
      senha: 'sha256:teste',
      cpf: '99988877766',
      role: 'caminhoneiro',
      createdAt: new Date().toISOString()
    }
  ]));

  sandbox.localStorage.setItem('freteConectaCurrentUser', JSON.stringify({
    id: 'cam-01',
    nome: 'Motorista Rastreado',
    email: 'rastreado@teste.com',
    role: 'caminhoneiro'
  }));

  sandbox.localStorage.setItem('freteConectaCargas', JSON.stringify([
    {
      id: 'carga-track-1',
      userId: 'emb-01',
      userEmail: 'beta@empresa.com',
      origem: 'São Paulo / SP',
      destino: 'Campinas / SP',
      tipo: 'Alimentos',
      regiaoOrigem: 'Sudeste',
      regiaoPublicacao: 'Sudeste',
      peso: '3 t',
      data: '2026-11-12',
      valor: 'R$ 2.600,00',
      observacoes: 'Entrega com rastreio',
      status: 'aceita',
      caminhoneiroId: 'cam-01',
      caminhoneiroNome: 'Motorista Rastreado',
      createdAt: new Date().toISOString(),
      historico: [{ evento: 'aceita', data: new Date().toISOString(), usuarioId: 'cam-01', usuarioNome: 'Motorista Rastreado' }]
    }
  ]));

  const tracking = auth.getTrackingSnapshot('carga-track-1');

  assert.equal(tracking.cargaId, 'carga-track-1');
  assert.equal(tracking.motorista.nome, 'Motorista Rastreado');
  assert.ok(Array.isArray(tracking.rota));
  assert.ok(tracking.rota.length >= 2);

  const simulation = auth.startTrackingSimulation('carga-track-1');
  assert.equal(simulation.mode, 'simulado');
  assert.ok(simulation.position && simulation.position.latitude !== undefined);
  assert.ok(typeof simulation.isRunning === 'boolean');
});
