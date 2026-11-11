const http = require('http');
const fs = require('fs');
const path = require('path');
const { createHash, randomBytes } = require('node:crypto');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');
const SESSION_TTL = 60 * 60 * 1000;

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(STORE_PATH)) {
  fs.writeFileSync(STORE_PATH, JSON.stringify({ users: [], cargas: [] }, null, 2), 'utf8');
}

const sessionStore = new Map();
const recoveryStore = new Map();

function hashPassword(value) {
  return 'sha256:' + createHash('sha256').update(String(value ?? '')).digest('hex');
}

function normalize(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeRole(role) {
  const value = String(role || '').trim().toLowerCase();
  return ['caminhoneiro', 'embarcador', 'destinatario'].includes(value) ? value : 'caminhoneiro';
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function validatePassword(password) {
  const value = String(password || '');
  return value.length >= 6 && ((/[A-Za-z]/.test(value) && /\d/.test(value)) || /^\d{6,}$/.test(value));
}

function validateCpf(cpf) {
  const value = String(cpf || '').replace(/\D/g, '');
  return value.length === 11 && /^\d{11}$/.test(value) && !/^([0-9])\1{10}$/.test(value);
}

function validateCnpj(cnpj) {
  const value = String(cnpj || '').replace(/\D/g, '');
  return value.length === 14 && /^\d{14}$/.test(value) && !/^([0-9])\1{13}$/.test(value);
}

function readStore() {
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      cargas: Array.isArray(parsed.cargas) ? parsed.cargas : []
    };
  } catch (error) {
    return { users: [], cargas: [] };
  }
}

function writeStore(data) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function safeUser(user) {
  if (!user || typeof user !== 'object') {
    return null;
  }

  return {
    id: String(user.id || Date.now().toString()),
    nome: String(user.nome || ''),
    email: String(user.email || ''),
    cpf: String(user.cpf || ''),
    cnpj: String(user.cnpj || ''),
    role: normalizeRole(user.role),
    cidade: String(user.cidade || ''),
    estado: String(user.estado || ''),
    homeRegion: String(user.homeRegion || ''),
    createdAt: String(user.createdAt || new Date().toISOString())
  };
}

function createSession(user) {
  const token = randomBytes(24).toString('hex');
  sessionStore.set(token, {
    userId: user.id,
    role: user.role,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL
  });
  return token;
}

function getSession(req) {
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.match(/(?:^|;\s*)sessionToken=([^;]+)/);
  const token = match ? decodeURIComponent(match[1]) : null;
  if (!token) {
    return null;
  }

  const session = sessionStore.get(token);
  if (!session || session.expiresAt < Date.now()) {
    sessionStore.delete(token);
    return null;
  }

  return session;
}

function requireSession(req, res, role) {
  const session = getSession(req);
  if (!session) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Sessão expirada ou inválida.' }));
    return null;
  }

  if (role && session.role !== role) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Permissão insuficiente para esta operação.' }));
    return null;
  }

  return session;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error('Corpo JSON inválido.'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function findUserByCredentials(users, identifier, password, role) {
  const value = normalize(identifier);
  const targetRole = normalizeRole(role);
  return users.find((user) => {
    const matchesRole = user.role === targetRole;
    const matchesIdentifier = normalize(user.email) === value || normalize(user.cpf) === value || normalize(user.cnpj) === value;
    const matchesPassword = hashPassword(password) === user.senha;
    return matchesRole && matchesIdentifier && matchesPassword;
  }) || null;
}

function serveStaticFile(req, res, filePath) {
  const safePath = path.normalize(filePath).replace(/^\.+[\\/]+/, '');
  const resolvedPath = path.join(ROOT, safePath);
  if (!resolvedPath.startsWith(ROOT)) {
    sendJson(res, 403, { message: 'Acesso inválido.' });
    return;
  }

  fs.readFile(resolvedPath, (error, content) => {
    if (error) {
      sendJson(res, 404, { message: 'Arquivo não encontrado.' });
      return;
    }

    const extension = path.extname(resolvedPath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon'
    };

    res.writeHead(200, { 'Content-Type': mimeTypes[extension] || 'application/octet-stream' });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, 'http://localhost');

  if (urlObj.pathname === '/api/health') {
    sendJson(res, 200, { ok: true, name: 'Frete Conecta API' });
    return;
  }

  if (urlObj.pathname === '/api/auth/register' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const store = readStore();
      const role = normalizeRole(body.role || 'embarcador');
      const normalizedUser = {
        id: String(body.id || Date.now().toString()),
        nome: String(body.nome || '').trim(),
        email: String(body.email || '').trim(),
        cpf: String(body.cpf || '').trim(),
        cnpj: String(body.cnpj || '').trim(),
        senha: String(body.senha || '').trim(),
        role,
        createdAt: new Date().toISOString()
      };

      if (!normalizedUser.nome || !normalizedUser.email || !normalizedUser.senha) {
        sendJson(res, 400, { message: 'Nome, e-mail e senha são obrigatórios.' });
        return;
      }
      if (!validateEmail(normalizedUser.email)) {
        sendJson(res, 400, { message: 'Informe um e-mail válido.' });
        return;
      }
      if (!validatePassword(normalizedUser.senha)) {
        sendJson(res, 400, { message: 'A senha deve ter no mínimo 6 caracteres e conter letras e números.' });
        return;
      }
      if (role === 'caminhoneiro' && !validateCpf(normalizedUser.cpf)) {
        sendJson(res, 400, { message: 'CPF inválido.' });
        return;
      }
      if (role === 'destinatario' && !validateCpf(normalizedUser.cpf)) {
        sendJson(res, 400, { message: 'CPF inválido.' });
        return;
      }
      if (role === 'embarcador' && !validateCnpj(normalizedUser.cnpj)) {
        sendJson(res, 400, { message: 'CNPJ inválido.' });
        return;
      }

      const duplicate = store.users.some((user) => user.role === role && (
        normalize(user.email) === normalize(normalizedUser.email) ||
        normalize(user.cpf) === normalize(normalizedUser.cpf) ||
        normalize(user.cnpj) === normalize(normalizedUser.cnpj)
      ));
      if (duplicate) {
        sendJson(res, 409, { message: 'Este usuário já está cadastrado.' });
        return;
      }

      const userToStore = {
        ...normalizedUser,
        senha: hashPassword(normalizedUser.senha)
      };
      store.users.push(userToStore);
      writeStore(store);

      const token = createSession(userToStore);
      res.setHeader('Set-Cookie', `sessionToken=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax`);
      sendJson(res, 201, { user: safeUser(userToStore), token });
      return;
    } catch (error) {
      sendJson(res, 500, { message: error.message || 'Erro ao registrar usuário.' });
      return;
    }
  }

  if (urlObj.pathname === '/api/auth/login' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const store = readStore();
      const user = findUserByCredentials(store.users, body.identificador, body.senha, body.role);
      if (!user) {
        sendJson(res, 401, { message: 'Credenciais inválidas.' });
        return;
      }

      const token = createSession(user);
      res.setHeader('Set-Cookie', `sessionToken=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax`);
      sendJson(res, 200, { user: safeUser(user), token });
      return;
    } catch (error) {
      sendJson(res, 500, { message: error.message || 'Erro no login.' });
      return;
    }
  }

  if (urlObj.pathname === '/api/auth/session' && req.method === 'GET') {
    const session = getSession(req);
    if (!session) {
      sendJson(res, 401, { message: 'Sem sessão ativa.' });
      return;
    }
    const store = readStore();
    const user = store.users.find((entry) => entry.id === session.userId);
    sendJson(res, 200, { user: user ? safeUser(user) : null });
    return;
  }

  if (urlObj.pathname === '/api/auth/recovery/request' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const store = readStore();
      const user = store.users.find((entry) => normalize(entry.email) === normalize(body.identificador) || normalize(entry.cpf) === normalize(body.identificador) || normalize(entry.cnpj) === normalize(body.identificador));
      if (!user) {
        sendJson(res, 404, { message: 'Conta não encontrada.' });
        return;
      }

      const code = `FRC-${randomBytes(4).toString('hex').toUpperCase()}-${randomBytes(4).toString('hex').toUpperCase()}`;
      recoveryStore.set(user.email, { code, userId: user.id, createdAt: Date.now(), expiresAt: Date.now() + 15 * 60 * 1000 });
      sendJson(res, 200, { success: true, email: user.email, code, message: 'Código de recuperação gerado com segurança.' });
      return;
    } catch (error) {
      sendJson(res, 500, { message: error.message || 'Erro ao solicitar recuperação.' });
      return;
    }
  }

  if (urlObj.pathname === '/api/auth/recovery/reset' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const store = readStore();
      const user = store.users.find((entry) => normalize(entry.email) === normalize(body.email));
      if (!user) {
        sendJson(res, 404, { message: 'Conta não encontrada.' });
        return;
      }

      const recovery = recoveryStore.get(user.email);
      if (!recovery || recovery.expiresAt < Date.now() || recovery.code !== String(body.codigo).trim().toUpperCase()) {
        sendJson(res, 400, { message: 'Código inválido ou expirado.' });
        return;
      }

      if (!validatePassword(String(body.novaSenha || ''))) {
        sendJson(res, 400, { message: 'A nova senha deve ter no mínimo 6 caracteres, letras e números.' });
        return;
      }

      const index = store.users.findIndex((entry) => entry.id === user.id);
      store.users[index].senha = hashPassword(body.novaSenha);
      writeStore(store);
      recoveryStore.delete(user.email);
      sendJson(res, 200, { success: true, message: 'Senha redefinida com sucesso.' });
      return;
    } catch (error) {
      sendJson(res, 500, { message: error.message || 'Erro ao redefinir a senha.' });
      return;
    }
  }

  if (urlObj.pathname === '/api/cargas' && req.method === 'GET') {
    const session = getSession(req);
    if (!session) {
      sendJson(res, 401, { message: 'Sessão necessária.' });
      return;
    }

    const store = readStore();
    sendJson(res, 200, { cargas: store.cargas });
    return;
  }

  if (urlObj.pathname === '/api/cargas' && req.method === 'POST') {
    const session = requireSession(req, res, 'embarcador');
    if (!session) {
      return;
    }

    try {
      const body = await parseBody(req);
      const store = readStore();
      const carga = {
        id: String(body.id || `carga-${Date.now()}-${Math.random().toString(16).slice(2)}`),
        userId: session.userId,
        userEmail: body.userEmail || '',
        origem: String(body.origem || '').trim(),
        destino: String(body.destino || '').trim(),
        tipo: String(body.tipo || '').trim(),
        regiaoOrigem: String(body.regiaoOrigem || '').trim(),
        regiaoPublicacao: String(body.regiaoPublicacao || '').trim(),
        peso: String(body.peso || '').trim(),
        data: String(body.data || '').trim(),
        valor: String(body.valor || '').trim(),
        observacoes: String(body.observacoes || '').trim(),
        status: 'disponivel',
        caminhoneiroId: '',
        caminhoneiroNome: '',
        createdAt: new Date().toISOString(),
        historico: [{ evento: 'publicada', data: new Date().toISOString(), usuarioId: session.userId }]
      };

      store.cargas.unshift(carga);
      writeStore(store);
      sendJson(res, 201, { carga });
      return;
    } catch (error) {
      sendJson(res, 500, { message: error.message || 'Erro ao publicar carga.' });
      return;
    }
  }

  if (urlObj.pathname.startsWith('/api/cargas/') && req.method === 'POST') {
    const session = getSession(req);
    if (!session) {
      sendJson(res, 401, { message: 'Sessão necessária.' });
      return;
    }

    const match = urlObj.pathname.match(/\/api\/cargas\/([^/]+)\/(accept|cancel|confirm)$/);
    if (!match) {
      sendJson(res, 404, { message: 'Rota de carga não encontrada.' });
      return;
    }

    const [, cargaId, action] = match;
    const store = readStore();
    const index = store.cargas.findIndex((carga) => String(carga.id) === String(cargaId));
    if (index === -1) {
      sendJson(res, 404, { message: 'Carga não encontrada.' });
      return;
    }

    const carga = store.cargas[index];

    if (action === 'accept') {
      if (session.role !== 'caminhoneiro') {
        sendJson(res, 403, { message: 'Apenas caminhoneiros podem aceitar cargas.' });
        return;
      }

      if (carga.status === 'cancelada') {
        sendJson(res, 409, { message: 'Esta carga foi cancelada.' });
        return;
      }

      if (carga.status === 'aceita' && carga.caminhoneiroId && carga.caminhoneiroId !== session.userId) {
        sendJson(res, 409, { message: 'Esta carga já foi aceita por outro caminhoneiro.' });
        return;
      }

      carga.status = 'aceita';
      carga.caminhoneiroId = session.userId;
      carga.caminhoneiroNome = session.userId;
      carga.aceitaEm = new Date().toISOString();
      carga.historico = [...(carga.historico || []), { evento: 'aceita', data: new Date().toISOString(), usuarioId: session.userId }];
      store.cargas[index] = carga;
      writeStore(store);
      sendJson(res, 200, { carga });
      return;
    }

    if (action === 'cancel') {
      const canCancelByOwner = session.role === 'embarcador' && String(carga.userId) === String(session.userId);
      const canCancelByDriver = session.role === 'caminhoneiro' && String(carga.caminhoneiroId) === String(session.userId);
      if (!canCancelByOwner && !canCancelByDriver) {
        sendJson(res, 403, { message: 'Você não tem permissão para cancelar esta carga.' });
        return;
      }

      carga.status = 'cancelada';
      carga.canceladaPor = session.userId;
      carga.canceladaEm = new Date().toISOString();
      carga.historico = [...(carga.historico || []), { evento: 'cancelada', data: new Date().toISOString(), usuarioId: session.userId }];
      store.cargas[index] = carga;
      writeStore(store);
      sendJson(res, 200, { carga });
      return;
    }

    if (action === 'confirm') {
      if (session.role !== 'caminhoneiro') {
        sendJson(res, 403, { message: 'Apenas caminhoneiros podem confirmar cargas.' });
        return;
      }
      if (String(carga.caminhoneiroId) !== String(session.userId)) {
        sendJson(res, 403, { message: 'Você precisa aceitar essa carga antes de confirmar.' });
        return;
      }
      carga.status = 'em_corrida';
      carga.corridaIniciadaEm = new Date().toISOString();
      carga.historico = [...(carga.historico || []), { evento: 'confirmada', data: new Date().toISOString(), usuarioId: session.userId }];
      store.cargas[index] = carga;
      writeStore(store);
      sendJson(res, 200, { carga });
      return;
    }
  }

  if (req.method === 'GET' && (urlObj.pathname === '/' || urlObj.pathname === '/index.html')) {
    serveStaticFile(req, res, 'index.html');
    return;
  }

  const requestedFile = urlObj.pathname === '/' ? 'index.html' : urlObj.pathname.replace(/^\//, '');
  serveStaticFile(req, res, requestedFile);
});

server.listen(PORT, () => {
  console.log(`Servidor Frete Conecta em http://localhost:${PORT}`);
});
