(function () {
  const STORAGE_KEY = 'freteConectaUsers';
  const SESSION_KEY = 'freteConectaCurrentUser';
  const RECOVERY_KEY = 'freteConectaRecoveryCode';
  const ROLE_NAMES = ['caminhoneiro', 'embarcador', 'destinatario'];

  function getStorage() {
    if (typeof window !== 'undefined' && window.localStorage && typeof window.localStorage.getItem === 'function') {
      return window.localStorage;
    }
    return null;
  }

  function normalize(value) {
    return String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
  }

  function safeText(value, fallback = '') {
    const text = String(value ?? '');
    if (!text.trim()) {
      return fallback;
    }
    return text.replace(/[<>]/g, '').trim();
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function normalizeRole(role) {
    const value = String(role || '').trim().toLowerCase();
    return ROLE_NAMES.includes(value) ? value : 'caminhoneiro';
  }

  function readJSON(key, fallback) {
    const storage = getStorage();
    if (!storage) {
      return fallback;
    }
    try {
      const saved = storage.getItem(key);
      const parsed = saved ? JSON.parse(saved) : fallback;
      return parsed;
    } catch (error) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    const storage = getStorage();
    if (!storage) {
      return value;
    }
    storage.setItem(key, JSON.stringify(value));
    return value;
  }

  function rightRotate(value, shift) {
    return (value >>> shift) | (value << (32 - shift));
  }

  function utf8Bytes(value) {
    const string = String(value ?? '');
    const bytes = [];
    for (let index = 0; index < string.length; index += 1) {
      let codePoint = string.charCodeAt(index);
      if (codePoint < 0x80) {
        bytes.push(codePoint);
      } else if (codePoint < 0x800) {
        bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
      } else if (codePoint >= 0xd800 && codePoint <= 0xdbff && index + 1 < string.length) {
        const next = string.charCodeAt(index + 1);
        const surrogate = (((codePoint - 0xd800) << 10) | (next - 0xdc00)) + 0x10000;
        bytes.push(
          0xf0 | (surrogate >> 18),
          0x80 | ((surrogate >> 12) & 0x3f),
          0x80 | ((surrogate >> 6) & 0x3f),
          0x80 | (surrogate & 0x3f)
        );
        index += 1;
      } else {
        bytes.push(
          0xe0 | (codePoint >> 12),
          0x80 | ((codePoint >> 6) & 0x3f),
          0x80 | (codePoint & 0x3f)
        );
      }
    }
    return bytes;
  }

  function sha256Hex(value) {
    const nodeCrypto = (() => {
      if (typeof require === 'function') {
        try {
          const cryptoModule = require('node:crypto');
          if (cryptoModule && cryptoModule.createHash) {
            return cryptoModule;
          }
        } catch (error) {
          return null;
        }
      }
      return null;
    })();

    if (nodeCrypto) {
      return nodeCrypto.createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');
    }

    const message = utf8Bytes(value);
    const K = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];

    const values = message.slice();
    const bitLength = values.length * 8;
    values.push(0x80);
    while ((values.length % 64) !== 56) {
      values.push(0x00);
    }

    const lengthBytes = new Uint8Array(8);
    for (let index = 0; index < 8; index += 1) {
      lengthBytes[index] = (bitLength >>> ((7 - index) * 8)) & 0xff;
    }

    values.push(...lengthBytes);

    let h0 = 0x6a09e667;
    let h1 = 0xbb67ae85;
    let h2 = 0x3c6ef372;
    let h3 = 0xa54ff53a;
    let h4 = 0x510e527f;
    let h5 = 0x9b05688c;
    let h6 = 0x1f83d9ab;
    let h7 = 0x5be0cd19;

    for (let block = 0; block < values.length; block += 64) {
      const w = new Array(64).fill(0);
      for (let index = 0; index < 16; index += 1) {
        const offset = block + index * 4;
        w[index] = ((values[offset] << 24) | (values[offset + 1] << 16) | (values[offset + 2] << 8) | values[offset + 3]) >>> 0;
      }

      for (let index = 16; index < 64; index += 1) {
        const s0 = rightRotate(w[index - 15], 7) ^ rightRotate(w[index - 15], 18) ^ (w[index - 15] >>> 3);
        const s1 = rightRotate(w[index - 2], 17) ^ rightRotate(w[index - 2], 19) ^ (w[index - 2] >>> 10);
        w[index] = (w[index - 16] + s0 + w[index - 7] + s1) >>> 0;
      }

      let a = h0;
      let b = h1;
      let c = h2;
      let d = h3;
      let e = h4;
      let f = h5;
      let g = h6;
      let h = h7;

      for (let index = 0; index < 64; index += 1) {
        const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
        const ch = (e & f) ^ (~e & g);
        const temp1 = (h + S1 + ch + K[index] + w[index]) >>> 0;
        const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (S0 + maj) >>> 0;

        h = g;
        g = f;
        f = e;
        e = (d + temp1) >>> 0;
        d = c;
        c = b;
        b = a;
        a = (temp1 + temp2) >>> 0;
      }

      h0 = (h0 + a) >>> 0;
      h1 = (h1 + b) >>> 0;
      h2 = (h2 + c) >>> 0;
      h3 = (h3 + d) >>> 0;
      h4 = (h4 + e) >>> 0;
      h5 = (h5 + f) >>> 0;
      h6 = (h6 + g) >>> 0;
      h7 = (h7 + h) >>> 0;
    }

    return [h0, h1, h2, h3, h4, h5, h6, h7].map((value) => value.toString(16).padStart(8, '0')).join('');
  }

  function hashPassword(password) {
    return 'sha256:' + sha256Hex(password);
  }

  function ensureHashedPassword(value) {
    const senha = String(value ?? '');
    if (!senha) {
      return '';
    }
    if (senha.startsWith('sha256:')) {
      return senha;
    }
    return hashPassword(senha);
  }

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
  }

  function validateCpf(cpf) {
    const value = String(cpf || '').replace(/\D/g, '');
    return value.length === 11 && /^\d{11}$/.test(value) && !/^([0-9])\1{10}$/.test(value);
  }

  function validateCpfStrict(cpf) {
    const value = String(cpf || '').replace(/\D/g, '');
    if (value.length !== 11 || /^([0-9])\1{10}$/.test(value)) {
      return false;
    }

    let sum = 0;
    for (let index = 0; index < 9; index += 1) {
      sum += Number(value.charAt(index)) * (10 - index);
    }
    let digit = 11 - (sum % 11);
    if (digit >= 10) {
      digit = 0;
    }
    if (Number(value.charAt(9)) !== digit) {
      return false;
    }

    sum = 0;
    for (let index = 0; index < 10; index += 1) {
      sum += Number(value.charAt(index)) * (11 - index);
    }
    digit = 11 - (sum % 11);
    if (digit >= 10) {
      digit = 0;
    }
    return Number(value.charAt(10)) === digit;
  }

  function validateCnpj(cnpj) {
    const value = String(cnpj || '').replace(/\D/g, '');
    return value.length === 14 && /^\d{14}$/.test(value) && !/^([0-9])\1{13}$/.test(value);
  }

  function validateCnpjStrict(cnpj) {
    const value = String(cnpj || '').replace(/\D/g, '');
    if (value.length !== 14 || /^([0-9])\1{13}$/.test(value)) {
      return false;
    }

    const sequence = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let index = 0; index < 12; index += 1) {
      sum += Number(value.charAt(index)) * sequence[index];
    }
    let doub = sum % 11;
    let digit = doub < 2 ? 0 : 11 - doub;
    if (Number(value.charAt(12)) !== digit) {
      return false;
    }

    const sequence2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    sum = 0;
    for (let index = 0; index < 13; index += 1) {
      sum += Number(value.charAt(index)) * sequence2[index];
    }
    doub = sum % 11;
    digit = doub < 2 ? 0 : 11 - doub;
    return Number(value.charAt(13)) === digit;
  }

  function validatePassword(password) {
    const value = String(password ?? '');
    if (!value) {
      return false;
    }
    if (value.length < 6) {
      return false;
    }
    if (/[A-Za-z]/.test(value) && /\d/.test(value)) {
      return value.length >= 6;
    }
    return /^\d{6,}$/.test(value);
  }

  function parseUser(user) {
    if (!user || typeof user !== 'object') {
      return null;
    }

    const role = normalizeRole(user.role);
    const cidade = safeText(user.cidade || user.localidade || '');
    const estado = safeText(user.estado || user.uf || '');
    const homeRegion = safeText(user.homeRegion || user.regiao || [cidade, estado].filter(Boolean).join(' / ') || 'São Paulo');
    const senha = typeof user.senha === 'string' ? user.senha : '';

    return {
      id: safeText(user.id || Date.now().toString(), Date.now().toString()),
      nome: safeText(user.nome || ''),
      cpf: safeText(user.cpf || ''),
      cnpj: safeText(user.cnpj || ''),
      email: safeText(user.email || ''),
      senha: ensureHashedPassword(senha),
      cidade,
      estado,
      homeRegion,
      role,
      createdAt: safeText(user.createdAt || new Date().toISOString())
    };
  }

  function readUsers() {
    const users = readJSON(STORAGE_KEY, []);
    const mapped = Array.isArray(users) ? users.filter(Boolean) : [];
    const migrated = mapped.map((user) => {
      const parsed = parseUser(user);
      return parsed || user;
    });

    writeJSON(STORAGE_KEY, migrated);
    return migrated;
  }

  function writeUsers(users) {
    const normalized = Array.isArray(users) ? users.map((user) => parseUser(user) || user) : [];
    writeJSON(STORAGE_KEY, normalized);
    return normalized;
  }

  function readCargas() {
    const lista = readJSON('freteConectaCargas', []);
    return Array.isArray(lista) ? lista.filter(Boolean) : [];
  }

  function writeCargas(cargas) {
    writeJSON('freteConectaCargas', Array.isArray(cargas) ? cargas : []);
    return Array.isArray(cargas) ? cargas : [];
  }

  function findUserByCredentials(identificador, senha, role) {
    const users = readUsers();
    const valor = normalize(identificador);
    const senhaDigitada = String(senha || '').trim();
    const targetRole = normalizeRole(role);

    const candidates = users.filter((user) => {
      const userParsed = parseUser(user);
      if (!userParsed || userParsed.role !== targetRole) {
        return false;
      }

      const emailMatch = normalize(userParsed.email) === valor;
      const cpfMatch = normalize(userParsed.cpf) === valor;
      const cnpjMatch = normalize(userParsed.cnpj) === valor;
      const senhaMatch = userParsed.senha === hashPassword(senhaDigitada);
      return (emailMatch || cpfMatch || cnpjMatch) && senhaMatch;
    });

    return candidates[0] || null;
  }

  function generateRecoveryCode() {
    const nodeCrypto = (() => {
      if (typeof require === 'function') {
        try {
          return require('node:crypto');
        } catch (error) {
          return null;
        }
      }
      return null;
    })();

    if (nodeCrypto && nodeCrypto.randomBytes) {
      const bytes = nodeCrypto.randomBytes(5).toString('hex').toUpperCase();
      return `FRC-${bytes.slice(0, 4)}-${bytes.slice(4, 10)}`;
    }

    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const buffer = new Uint8Array(5);
      crypto.getRandomValues(buffer);
      const hex = Array.from(buffer).map((value) => value.toString(16).padStart(2, '0')).join('').toUpperCase();
      return `FRC-${hex.slice(0, 4)}-${hex.slice(4, 10)}`;
    }

    return `FRC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  }

  function getSessionStorage() {
    return getStorage();
  }

  function getCurrentSessionUser() {
    const storage = getSessionStorage();
    if (!storage) {
      return null;
    }
    try {
      const raw = storage.getItem(SESSION_KEY);
      if (!raw) {
        return null;
      }
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }

  function setCurrentSessionUser(user) {
    const storage = getSessionStorage();
    if (!storage) {
      return null;
    }
    storage.setItem(SESSION_KEY, JSON.stringify({ ...user, senha: undefined }));
    return user;
  }

  function runSeedDemoCargas() {
    const existentes = readCargas();
    const existentesIds = new Set((existentes || []).map((carga) => String(carga.id)));
    const hoje = new Date();
    const catalogo = [
      { id: 'demo-carga-1', origem: 'São Paulo / SP', destino: 'Campinas / SP', tipo: 'Grãos', peso: '12 t', data: hoje, valor: 'R$ 3.400,00', observacoes: 'Carga urgente para entrega em até 24h.' },
      { id: 'demo-carga-2', origem: 'Curitiba / PR', destino: 'São José dos Pinhais / PR', tipo: 'Carga geral', peso: '8 t', data: hoje, valor: 'R$ 2.950,00', observacoes: 'Produto em pallets com acesso restrito.' },
      { id: 'demo-carga-3', origem: 'Salvador / BA', destino: 'Feira de Santana / BA', tipo: 'Bebidas', peso: '5 t', data: hoje, valor: 'R$ 2.100,00', observacoes: 'Carga refrigerada com entrega prioritária.' },
      { id: 'demo-carga-4', origem: 'Rio de Janeiro / RJ', destino: 'Volta Redonda / RJ', tipo: 'Construção', peso: '15 t', data: hoje, valor: 'R$ 4.500,00', observacoes: 'Material pesado para obra em andamento.' },
      { id: 'demo-carga-5', origem: 'Belo Horizonte / MG', destino: 'Uberlândia / MG', tipo: 'Industrial', peso: '18 t', data: hoje, valor: 'R$ 5.600,00', observacoes: 'Carga industrial com entrega em etapa específica.' },
      { id: 'demo-carga-6', origem: 'Florianópolis / SC', destino: 'Joinville / SC', tipo: 'Eletrônicos', peso: '6 t', data: hoje, valor: 'R$ 2.800,00', observacoes: 'Carga sensível com entrega no mesmo estado.' },
      { id: 'demo-carga-7', origem: 'Porto Alegre / RS', destino: 'Caxias do Sul / RS', tipo: 'Móveis', peso: '9 t', data: hoje, valor: 'R$ 3.150,00', observacoes: 'Entrega em galpão logístico com horário compacto.' },
      { id: 'demo-carga-8', origem: 'Goiânia / GO', destino: 'Anápolis / GO', tipo: 'Agro', peso: '11 t', data: hoje, valor: 'R$ 3.700,00', observacoes: 'Carga agrícola e perecível para coleta rápida.' },
      { id: 'demo-carga-9', origem: 'Brasília / DF', destino: 'Goiânia / GO', tipo: 'Açougue', peso: '4 t', data: hoje, valor: 'R$ 2.300,00', observacoes: 'Entrega com controle de temperatura e janela curta.' },
      { id: 'demo-carga-10', origem: 'Recife / PE', destino: 'Caruaru / PE', tipo: 'Vestuário', peso: '7 t', data: hoje, valor: 'R$ 2.650,00', observacoes: 'Carga de varejo com prazo de entrega apertado.' },
      { id: 'demo-carga-11', origem: 'Fortaleza / CE', destino: 'Juazeiro do Norte / CE', tipo: 'Mercadorias', peso: '10 t', data: hoje, valor: 'R$ 3.500,00', observacoes: 'Frete de médio porte com coleta em 8h.' },
      { id: 'demo-carga-12', origem: 'Belém / PA', destino: 'Santarém / PA', tipo: 'Alimentos', peso: '13 t', data: hoje, valor: 'R$ 4.150,00', observacoes: 'Carga alimentícia com logística sensível.' }
    ];

    const demoCargas = catalogo
      .filter((carga) => !existentesIds.has(carga.id))
      .map((carga) => ({
        id: carga.id,
        userId: `demo-embarcador-${carga.id.split('-').pop()}`,
        userEmail: `embarcador${carga.id.split('-').pop()}@demo.com`,
        origem: carga.origem,
        destino: carga.destino,
        tipo: carga.tipo,
        peso: carga.peso,
        data: new Date(hoje.getTime() + (Math.random() * 6 + 1) * 86400000).toISOString().slice(0, 10),
        valor: carga.valor,
        observacoes: carga.observacoes,
        status: 'disponivel',
        caminhoneiroId: '',
        caminhoneiroNome: '',
        createdAt: new Date().toISOString(),
        historico: [{
          evento: 'publicada',
          data: new Date().toISOString(),
          usuarioId: `demo-embarcador-${carga.id.split('-').pop()}`,
          usuarioNome: 'Embarcador demo'
        }]
      }));

    const finalLista = [...existentes, ...demoCargas];
    if (!existentes.length || demoCargas.length) {
      writeCargas(finalLista);
    }

    return finalLista;
  }

  function apiRequest(path, options = {}) {
    if (typeof fetch !== 'function') {
      return Promise.reject(new Error('fetch indisponível'));
    }

    const requestOptions = {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      ...options
    };

    return fetch(path, requestOptions).then(async (response) => {
      const body = response.status === 204 ? null : await response.json().catch(() => null);
      if (!response.ok) {
        const message = body && body.message ? body.message : 'Erro na operação.';
        throw new Error(message);
      }
      return body;
    });
  }

  function normalizeStatusKey(value) {
    const mapping = {
      'carga publicada': 'publicada',
      'publicada': 'publicada',
      'disponivel': 'publicada',
      'motorista aceitou a entrega': 'aceita',
      'motorista aceitou': 'aceita',
      'aceita': 'aceita',
      'motorista a caminho da retirada': 'retirada',
      'a caminho da retirada': 'retirada',
      'retirada': 'retirada',
      'motorista chegou ao local de retirada': 'retirada_confirmada',
      'chegou ao local de retirada': 'retirada_confirmada',
      'carga coletada': 'coletada',
      'coletada': 'coletada',
      'em transporte': 'em_transporte',
      'transporte': 'em_transporte',
      'motorista chegou ao destino': 'destino_alcancado',
      'destino alcancado': 'destino_alcancado',
      'entrega finalizada pelo motorista': 'entrega_finalizada',
      'entrega finalizada': 'entrega_finalizada',
      'finalizada': 'entrega_finalizada',
      'recebimento confirmado pelo destinatario': 'recebimento_confirmado',
      'recebimento confirmado': 'recebimento_confirmado',
      'confirmado': 'recebimento_confirmado'
    };
    const text = String(value ?? '').trim().toLowerCase();
    return mapping[text] || text.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'publicada';
  }

  function getDeliveryStatusFlow() {
    return [
      { key: 'publicada', label: 'CARGA PUBLICADA', order: 1 },
      { key: 'aceita', label: 'MOTORISTA ACEITOU A ENTREGA', order: 2 },
      { key: 'retirada', label: 'MOTORISTA A CAMINHO DA RETIRADA', order: 3 },
      { key: 'retirada_confirmada', label: 'MOTORISTA CHEGOU AO LOCAL DE RETIRADA', order: 4 },
      { key: 'coletada', label: 'CARGA COLETADA', order: 5 },
      { key: 'em_transporte', label: 'EM TRANSPORTE', order: 6 },
      { key: 'destino_alcancado', label: 'MOTORISTA CHEGOU AO DESTINO', order: 7 },
      { key: 'entrega_finalizada', label: 'ENTREGA FINALIZADA PELO MOTORISTA', order: 8 },
      { key: 'recebimento_confirmado', label: 'RECEBIMENTO CONFIRMADO PELO DESTINATÁRIO', order: 9 }
    ];
  }

  function getStatusLabel(status) {
    const flow = getDeliveryStatusFlow();
    const normalized = normalizeStatusKey(status);
    const item = flow.find((entry) => entry.key === normalized);
    return item ? item.label : String(status || 'publicada').toUpperCase();
  }

  function listNotifications() {
    const storage = getStorage();
    if (!storage) {
      return [];
    }
    try {
      return JSON.parse(storage.getItem('freteConectaNotificacoes') || '[]');
    } catch (error) {
      return [];
    }
  }

  function saveNotifications(notifications) {
    const storage = getStorage();
    if (!storage) {
      return notifications;
    }
    storage.setItem('freteConectaNotificacoes', JSON.stringify(Array.isArray(notifications) ? notifications : []));
    return notifications;
  }

  function addNotification(userId, payload) {
    if (!userId) {
      return null;
    }
    const notification = {
      id: `notif-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      userId: String(userId),
      tipo: String(payload && payload.tipo ? payload.tipo : 'sistema'),
      mensagem: String(payload && payload.mensagem ? payload.mensagem : 'Atualização do sistema'),
      cargaId: payload && payload.cargaId ? String(payload.cargaId) : '',
      lida: false,
      createdAt: new Date().toISOString()
    };
    const notifications = listNotifications();
    notifications.unshift(notification);
    saveNotifications(notifications);
    return notification;
  }

  function getDemoUsersMap() {
    const users = readJSON('freteConectaDemoUsers', []);
    return {
      embarcador: users.find((user) => user && user.role === 'embarcador') || null,
      caminhoneiro: users.find((user) => user && user.role === 'caminhoneiro') || null,
      destinatario: users.find((user) => user && user.role === 'destinatario') || null
    };
  }

  function writeDemoUsers(users) {
    writeJSON('freteConectaDemoUsers', Array.isArray(users) ? users : []);
    return Array.isArray(users) ? users : [];
  }

  function ensureDemoScenario() {
    const demoUsers = getDemoUsersMap();
    if (demoUsers.embarcador && demoUsers.caminhoneiro && demoUsers.destinatario) {
      return demoUsers;
    }

    const freshUsers = [
      { id: 'demo-embarcador', nome: 'Embarcador Demo', email: 'embarcador@demo.com', senha: 'Demo123', cnpj: '11.222.333/0001-44', role: 'embarcador', isDemo: true, createdAt: new Date().toISOString() },
      { id: 'demo-caminhoneiro', nome: 'Caminhoneiro Demo', email: 'caminhoneiro@demo.com', senha: 'Demo123', cpf: '12345678909', role: 'caminhoneiro', isDemo: true, createdAt: new Date().toISOString() },
      { id: 'demo-destinatario', nome: 'Destinatário Demo', email: 'destinatario@demo.com', senha: 'Demo123', cpf: '98765432100', role: 'destinatario', isDemo: true, createdAt: new Date().toISOString() }
    ];
    writeDemoUsers(freshUsers);
    return getDemoUsersMap();
  }

  function resolveUserById(userId) {
    const users = [...readUsers(), ...readJSON('freteConectaDemoUsers', [])];
    const match = users.find((user) => {
      const parsed = parseUser(user);
      return parsed && String(parsed.id) === String(userId);
    });
    return match ? parseUser(match) : null;
  }

  function pushHistorico(carga, evento, usuarioId, usuarioNome, extras = {}) {
    const historico = Array.isArray(carga.historico) ? carga.historico.slice() : [];
    historico.push({
      evento: String(evento || 'atualizacao'),
      data: new Date().toISOString(),
      usuarioId: usuarioId ? String(usuarioId) : '',
      usuarioNome: String(usuarioNome || 'Sistema'),
      ...extras
    });
    return historico;
  }

  function getAppCargas() {
    const real = readCargas();
    const demo = readJSON('freteConectaDemoCargas', []);
    return [...real, ...demo].filter(Boolean).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }

  function getAppUsers() {
    const real = readUsers();
    const demo = readJSON('freteConectaDemoUsers', []);
    return [...real, ...demo].filter(Boolean);
  }

  function parseCurrency(value) {
    const text = String(value ?? '').replace(/[R$\s.]/g, '').replace(',', '.');
    const clean = text.replace(/[^\d.-]/g, '');
    const number = Number(clean || 0);
    return Number.isFinite(number) ? number : 0;
  }

  function buildMonthlySeries(cargas, months = 6) {
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const now = new Date();
    const series = [];

    for (let index = months - 1; index >= 0; index -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = monthNames[date.getMonth()];
      const value = cargas.filter((carga) => {
        const sourceDate = new Date(carga.createdAt || carga.data || Date.now());
        if (Number.isNaN(sourceDate.getTime())) {
          return false;
        }
        return sourceDate.toISOString().slice(0, 7) === key;
      }).length;
      series.push({ label, key, value });
    }

    return series;
  }

  function buildRotasMaisUtilizadas(cargas) {
    const map = new Map();
    cargas.forEach((carga) => {
      const origem = String(carga.origem || '').trim();
      const destino = String(carga.destino || '').trim();
      if (!origem || !destino) {
        return;
      }
      const key = `${origem} → ${destino}`;
      map.set(key, (map.get(key) || 0) + 1);
    });

    return Array.from(map.entries())
      .map(([route, count]) => ({ route, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  function getDashboardInfo(cargas, users) {
    const totalCargas = cargas.length;
    const totalCaminhoneiros = users.filter((user) => normalizeRole(user?.role) === 'caminhoneiro').length;
    const totalEmpresas = users.filter((user) => normalizeRole(user?.role) === 'embarcador').length;
    const faturamento = cargas.reduce((sum, carga) => sum + parseCurrency(carga.valor), 0);

    return {
      totalCargas,
      totalCaminhoneiros,
      totalEmpresas,
      faturamentoEstimado: faturamento,
      entregasPorMes: buildMonthlySeries(cargas, 6),
      rotasMaisUtilizadas: buildRotasMaisUtilizadas(cargas),
      entregasAtivas: cargas.filter((carga) => ['aceita', 'retirada', 'retirada_confirmada', 'coletada', 'em_transporte', 'destino_alcancado', 'entrega_finalizada'].includes(normalizeStatusKey(carga.status || 'publicada'))).length
    };
  }

  function getCityCoordinates(cityName) {
    const clean = String(cityName || '').trim().toLowerCase();
    const list = {
      'sao paulo': { latitude: -23.5505, longitude: -46.6333 },
      'campinas': { latitude: -22.9068, longitude: -47.0616 },
      'curitiba': { latitude: -25.4284, longitude: -49.2733 },
      'rio de janeiro': { latitude: -22.9068, longitude: -43.1729 },
      'niteroi': { latitude: -22.8833, longitude: -43.1036 },
      'salvador': { latitude: -12.9777, longitude: -38.5016 },
      'feira de santana': { latitude: -12.2628, longitude: -38.9666 },
      'belo horizonte': { latitude: -19.9167, longitude: -43.9345 },
      'uberlandia': { latitude: -18.9186, longitude: -48.2772 },
      'florianopolis': { latitude: -27.5949, longitude: -48.5482 },
      'joinville': { latitude: -26.3045, longitude: -48.8455 },
      'porto alegre': { latitude: -30.0346, longitude: -51.2177 },
      'caxias do sul': { latitude: -29.1678, longitude: -51.1794 },
      'goiania': { latitude: -16.6869, longitude: -49.2648 },
      'anapolis': { latitude: -16.3261, longitude: -48.9524 },
      'brasilia': { latitude: -15.7939, longitude: -47.8828 },
      'goias': { latitude: -15.7942, longitude: -47.8828 },
      'recife': { latitude: -8.0476, longitude: -34.877 },
      'caruaru': { latitude: -8.2831, longitude: -35.9769 },
      'fortaleza': { latitude: -3.7319, longitude: -38.5267 },
      'juazeiro do norte': { latitude: -7.2131, longitude: -39.3153 },
      'belem': { latitude: -1.4558, longitude: -48.4902 },
      'santarem': { latitude: -2.444, longitude: -54.7087 },
      'sao jose dos pinhais': { latitude: -25.539, longitude: -49.2112 }
    };

    if (!clean) {
      return { latitude: -23.5505, longitude: -46.6333 };
    }

    const match = Object.keys(list).find((key) => clean.includes(key));
    return match ? list[match] : { latitude: -23.5505, longitude: -46.6333 };
  }

  function buildRoutePoints(origem, destino) {
    const start = getCityCoordinates(origem);
    const end = getCityCoordinates(destino);
    const route = [];
    const steps = 6;

    for (let index = 0; index <= steps; index += 1) {
      const factor = steps === 0 ? 0 : index / steps;
      const latitude = start.latitude + ((end.latitude - start.latitude) * factor);
      const longitude = start.longitude + ((end.longitude - start.longitude) * factor);
      route.push({
        latitude: Number(latitude.toFixed(6)),
        longitude: Number(longitude.toFixed(6)),
        label: index === 0 ? 'Origem' : index === steps ? 'Destino' : `Ponto ${index}`
      });
    }

    return route;
  }

  function getTrackingStorageKey(cargaId) {
    return `freteConectaTracking_${String(cargaId || 'global')}`;
  }

  function readTrackingState(cargaId) {
    const storage = getStorage();
    if (!storage) {
      return null;
    }
    try {
      const item = storage.getItem(getTrackingStorageKey(cargaId));
      return item ? JSON.parse(item) : null;
    } catch (error) {
      return null;
    }
  }

  function writeTrackingState(cargaId, state) {
    const storage = getStorage();
    if (!storage) {
      return state;
    }
    storage.setItem(getTrackingStorageKey(cargaId), JSON.stringify(state));
    return state;
  }

  function formatEtaFromRoute(route, currentIndex) {
    const total = Math.max(route.length - 1, 1);
    const remaining = Math.max(total - currentIndex, 0);
    const minutes = remaining * 18;
    const eta = new Date(Date.now() + minutes * 60000);
    return eta.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function createIntegrityHash(payload) {
    return sha256Hex(JSON.stringify(payload));
  }

  function ensureArray(list) {
    return Array.isArray(list) ? list : [];
  }

  function getPublicUserProfile(userId) {
    const user = resolveUserById(userId);
    if (!user) {
      return null;
    }
    return {
      id: user.id,
      nome: user.nome,
      role: user.role,
      cidade: user.cidade || user.estado || 'Brasil',
      perfilPublico: true
    };
  }

  function getCompanyPermissions(role) {
    const permissionsByRole = {
      administrador: ['empresa:read', 'empresa:write', 'funcionarios:manage', 'financeiro:read', 'financeiro:write', 'frota:manage', 'documentos:manage', 'suporte:manage'],
      gerente: ['empresa:read', 'empresa:write', 'funcionarios:manage', 'financeiro:read', 'frota:manage', 'documentos:read', 'suporte:manage'],
      operador: ['empresa:read', 'operacoes:write', 'documentos:read', 'suporte:create'],
      financeiro: ['empresa:read', 'financeiro:read', 'financeiro:write', 'documentos:read'],
      consulta: ['empresa:read', 'financeiro:read', 'documentos:read', 'suporte:read']
    };
    return permissionsByRole[String(role || '').toLowerCase()] || [];
  }

  function getCompanyAccessEntry(companyId, userId) {
    const entries = ensureArray(readJSON('freteConectaEmpresaAssociacoes', []));
    return entries.find((entry) => String(entry.companyId) === String(companyId) && String(entry.userId) === String(userId)) || null;
  }

  function writeCompanyAccess(entries) {
    writeJSON('freteConectaEmpresaAssociacoes', ensureArray(entries));
  }

  function readCompanyData() {
    return ensureArray(readJSON('freteConectaEmpresas', []));
  }

  function getAllRatings() {
    return ensureArray(readJSON('freteConectaAvaliacoes', []));
  }

  function getAllProofs() {
    return ensureArray(readJSON('freteConectaComprovantes', []));
  }

  function getFinancialHistory() {
    return ensureArray(readJSON('freteConectaFinanceiro', []));
  }

  function getCargoParticipants(carga) {
    if (!carga || typeof carga !== 'object') {
      return [];
    }
    return Array.from(new Set([
      String(carga.userId || '').trim(),
      String(carga.caminhoneiroId || '').trim(),
      String(carga.destinatarioId || '').trim()
    ].filter(Boolean)));
  }

  function getChatStore() {
    return ensureArray(readJSON('freteConectaChat', []));
  }

  function getOccurrencesStore() {
    return ensureArray(readJSON('freteConectaOcorrencias', []));
  }

  function getSchedulingStore() {
    return ensureArray(readJSON('freteConectaAgenda', []));
  }

  function createId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  }

  const FreteConectaAuth = {
    getUsers: readUsers,
    getCargas: readCargas,
    hashPassword,
    validateEmail,
    validateCpf,
    validateCnpj,
    validatePassword,
    seedDemoCargas() {
      return runSeedDemoCargas();
    },
    hideLoginOptions() {
      if (typeof document === 'undefined') {
        return false;
      }
      const current = this.currentUser();
      if (!current) {
        return false;
      }

      if (current.role === 'destinatario') {
        document.querySelectorAll('a, button').forEach((element) => {
          const text = (element.textContent || '').trim().toLowerCase();
          const isCaminhoneiroLink = text.includes('para caminhoneiros');
          const isEmbarcadorLink = text.includes('para embarcadores');
          const isDestinatarioLink = text.includes('para destinatários');

          if (isCaminhoneiroLink || isEmbarcadorLink) {
            element.style.display = 'none';
            element.setAttribute('aria-hidden', 'true');
          }

          if (isDestinatarioLink) {
            element.style.display = '';
            element.removeAttribute('aria-hidden');
          }
        });
        return true;
      }

      const selectors = [
        'a[href="login.html"]',
        'a[href="login-embarcadores.html"]',
        'a[href="login-destinatario.html"]',
        'a[href*="cadastro-"]',
        'a[href="cadastro-caminhoneiros.html"]',
        'a[href="cadastro-embarcadores.html"]',
        'a[href="cadastro-destinatario.html"]',
        '.Encontrar-cargas',
        '.Publicar-uma-carga',
        '.btn-login',
        '.btn-entrar',
        'button[onclick*="entrar"]',
        'button[onclick*="criar"]',
        'a[onclick*="entrar"]',
        'a[onclick*="criar"]'
      ];

      document.querySelectorAll(selectors.join(',')).forEach((element) => {
        if (element.hasAttribute('data-role-route') || element.closest('[data-role-route]')) {
          return;
        }
        element.style.display = 'none';
        element.setAttribute('aria-hidden', 'true');
      });
      return true;
    },
    logout() {
      const storage = getStorage();
      if (storage) {
        storage.removeItem(SESSION_KEY);
      }
      return true;
    },
    currentUser() {
      return getCurrentSessionUser();
    },
    findUserByIdentifier(identificador, role) {
      const users = readUsers();
      const valor = normalize(String(identificador ?? ''));
      if (!valor) {
        return null;
      }

      return users.find((user) => {
        const perfil = parseUser(user);
        if (!perfil) {
          return false;
        }
        const matchesIdentifier = normalize(perfil.email) === valor || normalize(perfil.cpf) === valor || normalize(perfil.cnpj) === valor;
        const matchesRole = !role || perfil.role === normalizeRole(role);
        return matchesIdentifier && matchesRole;
      }) || null;
    },
    getRecoveryOriginPage() {
      const storage = getStorage();
      const saved = storage ? storage.getItem('freteConectaRecoveryOrigin') : null;
      const candidates = ['login-embarcadores.html', 'login-destinatario.html', 'login.html'];
      const currentPage = (() => {
        try {
          if (typeof window !== 'undefined' && window.location && window.location.pathname) {
            return (window.location.pathname || '').split('/').pop() || 'login.html';
          }
          return 'login.html';
        } catch (error) {
          return 'login.html';
        }
      })();
      const fallback = candidates.includes(currentPage) ? currentPage : 'login.html';
      const origin = saved && candidates.includes(saved) ? saved : fallback;
      if (storage) {
        storage.setItem('freteConectaRecoveryOrigin', origin);
      }
      return origin;
    },
    sendPasswordRecoveryEmail(identificador, role) {
      const usuario = this.findUserByIdentifier(identificador, role) || this.findUserByIdentifier(identificador);
      if (!usuario) {
        return { success: false, message: 'Não encontramos uma conta com esse e-mail, CPF ou CNPJ.' };
      }

      const perfil = parseUser(usuario);
      const email = String(perfil.email || '').trim();
      if (!email) {
        return { success: false, message: 'Essa conta não possui um e-mail cadastrado para receber recuperação.' };
      }

      const originPage = this.getRecoveryOriginPage();
      const codigo = generateRecoveryCode();
      const payload = {
        email,
        codigo,
        userId: perfil.id,
        createdAt: new Date().toISOString(),
        redirect: originPage,
        role: role || perfil.role,
        generatedLocally: true
      };

      const storage = getStorage();
      if (storage) {
        storage.setItem(RECOVERY_KEY, JSON.stringify(payload));
      }

      const recoveryPage = 'recuperar-senha.html?email=' + encodeURIComponent(email) + '&redirect=' + encodeURIComponent(originPage);
      if (typeof window !== 'undefined' && window.location && window.location.href) {
        setTimeout(() => {
          if (typeof window !== 'undefined') {
            window.location.href = recoveryPage;
          }
        }, 150);
      }

      return { success: true, email, codigo, recoveryPage, message: 'Código de recuperação gerado com segurança e enviado para o e-mail cadastrado.' };
    },
    verifyRecoveryCode(email, codigo, userId) {
      const storage = getStorage();
      const raw = storage ? storage.getItem(RECOVERY_KEY) : null;
      const stored = raw ? JSON.parse(raw) : null;
      if (!stored) {
        return false;
      }

      const createdAt = new Date(stored.createdAt || 0).getTime();
      const isExpired = Number.isFinite(createdAt) && (Date.now() - createdAt) > 15 * 60 * 1000;
      if (isExpired) {
        if (storage) {
          storage.removeItem(RECOVERY_KEY);
        }
        return false;
      }

      const sameEmail = normalize(stored.email) === normalize(email);
      const sameUser = userId && String(stored.userId || '') === String(userId);
      const validCode = String(stored.codigo || '').trim().toUpperCase() === String(codigo || '').trim().toUpperCase();
      return validCode && (sameEmail || sameUser);
    },
    resetPassword(email, codigo, novaSenha, role) {
      const usuario = this.findUserByIdentifier(email, role) || this.findUserByIdentifier(email);
      if (!usuario) {
        return { success: false, message: 'Conta não encontrada para esse e-mail, CPF ou CNPJ.' };
      }

      const perfil = parseUser(usuario);
      const senhaNova = String(novaSenha || '').trim();
      if (!validatePassword(senhaNova)) {
        return { success: false, message: 'A nova senha deve ter no mínimo 8 caracteres, letras e números.' };
      }

      const storage = getStorage();
      const raw = storage ? storage.getItem(RECOVERY_KEY) : null;
      const stored = raw ? JSON.parse(raw) : null;

      if (!stored && (!codigo || String(codigo).trim().length < 6)) {
        return { success: false, message: 'Solicite um novo código de recuperação antes de redefinir a senha.' };
      }

      if (stored && !this.verifyRecoveryCode(perfil.email, codigo, perfil.id)) {
        return { success: false, message: 'Código de recuperação inválido ou expirado.' };
      }

      const users = readUsers();
      const index = users.findIndex((user) => {
        const item = parseUser(user);
        return item && (item.id === perfil.id || normalize(item.email) === normalize(perfil.email));
      });
      if (index === -1) {
        return { success: false, message: 'Usuário não encontrado para atualizar a senha.' };
      }

      users[index].senha = ensureHashedPassword(senhaNova);
      writeUsers(users);
      if (storage) {
        storage.removeItem(RECOVERY_KEY);
      }
      return { success: true, message: 'Senha redefinida com sucesso. Agora você pode fazer login com a nova senha.', role: perfil.role };
    },
    getDisplayName(user) {
      const profile = parseUser(user || this.currentUser());
      if (!profile) {
        return 'Visitante';
      }
      return profile.nome || profile.email || profile.cnpj || 'Usuário';
    },
    getHomeRegion(user) {
      const profile = parseUser(user || this.currentUser());
      if (!profile) {
        return 'São Paulo';
      }
      return profile.homeRegion || profile.cidade || profile.estado || 'São Paulo';
    },
    getRoleHome(role) {
      const roleName = normalizeRole(role);
      const routes = { caminhoneiro: 'para-caminhoneiros.html', embarcador: 'embarcadores-publicar.html', destinatario: 'destinatario-entregas.html' };
      return routes[roleName] || routes.caminhoneiro;
    },
    redirectToRole(role, fallbackLogin) {
      const current = this.currentUser();
      const loginPage = fallbackLogin || (role === 'embarcador' ? 'login-embarcadores.html' : role === 'destinatario' ? 'login-destinatario.html' : 'login.html');

      if (current) {
        if (current.role === role) {
          if (typeof window !== 'undefined') {
            window.location.href = this.getRoleHome(role);
          }
          return true;
        }

        const explicitHome = this.getRoleHome(current.role);
        if (['embarcador', 'destinatario', 'caminhoneiro'].includes(current.role)) {
          if (typeof window !== 'undefined') {
            window.location.href = explicitHome;
          }
          return false;
        }
      }

      if (typeof window !== 'undefined') {
        window.location.href = loginPage;
      }
      return false;
    },
    bindRoleNavigation(selector, role, fallbackLogin, areaPage) {
      if (typeof document === 'undefined') {
        return;
      }
      const links = document.querySelectorAll(selector);
      links.forEach((link) => {
        link.addEventListener('click', (event) => {
          const current = this.currentUser();
          if (current && current.role === role) {
            event.preventDefault();
            if (typeof window !== 'undefined') {
              window.location.href = areaPage || this.getRoleHome(role);
            }
            return;
          }

          if (current && ['embarcador', 'destinatario', 'caminhoneiro'].includes(current.role)) {
            event.preventDefault();
            if (typeof window !== 'undefined') {
              window.location.href = this.getRoleHome(current.role);
            }
            return;
          }

          event.preventDefault();
          if (typeof window !== 'undefined') {
            window.location.href = fallbackLogin || 'login.html';
          }
        });
      });
    },
    requireAuth(role, redirectTo) {
      const current = this.currentUser();
      if (!current) {
        if (typeof window !== 'undefined') {
          window.location.href = redirectTo || (role === 'embarcador' ? 'login-embarcadores.html' : role === 'destinatario' ? 'login-destinatario.html' : 'login.html');
        }
        return null;
      }

      if (role && current.role !== role) {
        const roleHome = { caminhoneiro: 'para-caminhoneiros.html', embarcador: 'embarcadores-publicar.html', destinatario: 'destinatario-entregas.html' };
        if (['embarcador', 'destinatario', 'caminhoneiro'].includes(current.role)) {
          if (typeof window !== 'undefined') {
            window.location.href = roleHome[current.role] || redirectTo || 'index.html';
          }
          return null;
        }
        if (typeof window !== 'undefined') {
          window.location.href = redirectTo || (role === 'embarcador' ? 'login-embarcadores.html' : role === 'destinatario' ? 'login-destinatario.html' : 'login.html');
        }
        return null;
      }

      return current;
    },
    setupUserMenu(options = {}) {
      if (typeof document === 'undefined') {
        return null;
      }
      const container = document.querySelector(options.containerSelector || '.user-panel');
      const current = this.currentUser();

      if (!container) {
        return current;
      }

      container.innerHTML = '';
      if (!current) {
        const loginLink = options.loginLink || 'login-embarcadores.html';
        const link = document.createElement('a');
        link.href = loginLink;
        link.className = 'user-login-link';
        link.textContent = 'Entrar';
        container.appendChild(link);
        return current;
      }

      const nome = this.getDisplayName(current);
      const areaPath = current.role === 'embarcador' ? 'embarcadores-publicar.html' : current.role === 'destinatario' ? 'destinatario-entregas.html' : 'para-caminhoneiros.html';
      const badge = document.createElement('div');
      badge.className = 'user-badge';
      badge.innerHTML = '<span class="user-badge-icon">👋</span><span class="user-badge-name">' + escapeHtml(nome) + '</span>';
      container.appendChild(badge);

      const areaLink = document.createElement('a');
      areaLink.href = areaPath;
      areaLink.className = 'user-area-link';
      areaLink.textContent = 'Área';
      container.appendChild(areaLink);

      const logoutButton = document.createElement('button');
      logoutButton.type = 'button';
      logoutButton.className = 'user-logout-btn';
      logoutButton.textContent = 'Sair';
      logoutButton.addEventListener('click', () => {
        this.logout();
        if (typeof window !== 'undefined') {
          window.location.href = options.redirectAfterLogout || 'index.html';
        }
      });
      container.appendChild(logoutButton);

      this.hideLoginOptions();
      return current;
    },
    register(userData) {
      const users = readUsers();
      const role = normalizeRole(userData && userData.role ? userData.role : 'embarcador');
      const payload = parseUser({ ...userData, role });
      const email = normalize(payload.email);
      const cpf = normalize(payload.cpf);
      const cnpj = normalize(payload.cnpj);

      if (!payload.nome || !payload.email || !payload.senha) {
        throw new Error('Nome, e-mail e senha são obrigatórios.');
      }
      if (!validateEmail(payload.email)) {
        throw new Error('Informe um e-mail válido.');
      }
      if (!validatePassword(payload.senha)) {
        throw new Error('A senha precisa ter no mínimo 8 caracteres, incluindo letras e números.');
      }

      if (payload.role === 'caminhoneiro' && !validateCpf(payload.cpf)) {
        throw new Error('CPF inválido.');
      }
      if (payload.role === 'embarcador' && !validateCnpj(payload.cnpj)) {
        throw new Error('CNPJ inválido.');
      }
      if (payload.role === 'destinatario' && !validateCpf(payload.cpf)) {
        throw new Error('CPF inválido.');
      }

      const jaExiste = users.some((user) => {
        const item = parseUser(user);
        if (!item || item.role !== payload.role) {
          return false;
        }

        const valoresDoUsuario = [normalize(item.email), normalize(item.cpf), normalize(item.cnpj)].filter(Boolean);
        const valoresIdentificadores = [email, cpf, cnpj].filter(Boolean);
        return valoresIdentificadores.some((valor) => valoresDoUsuario.includes(valor));
      });

      if (jaExiste) {
        throw new Error('Este usuário já está cadastrado.');
      }

      const novoUsuario = {
        ...payload,
        senha: ensureHashedPassword(payload.senha),
        id: payload.id || Date.now().toString(),
        role: payload.role,
        createdAt: payload.createdAt || new Date().toISOString()
      };

      users.push(novoUsuario);
      writeUsers(users);
      setCurrentSessionUser({ ...novoUsuario, senha: undefined });
      return { ...novoUsuario, senha: undefined };
    },
    login(identificador, senha, role) {
      const requestedRole = normalizeRole(role || 'embarcador');
      const user = findUserByCredentials(identificador, senha, requestedRole);
      if (!user) {
        return null;
      }

      const parsedUser = parseUser(user);
      const sessionUser = { ...parsedUser, role: requestedRole, senha: undefined };
      setCurrentSessionUser(sessionUser);
      return sessionUser;
    },
    publishCarga(carga, userIdOverride) {
      const usuario = (userIdOverride ? resolveUserById(userIdOverride) : this.currentUser()) || this.currentUser();
      if (!usuario) {
        throw new Error('Faça login para publicar uma carga.');
      }
      if (usuario.role !== 'embarcador') {
        throw new Error('Apenas embarcadores podem publicar cargas.');
      }

      const payload = {
        id: carga && carga.id ? String(carga.id) : `carga-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        userId: usuario.id,
        userEmail: usuario.email,
        origem: String(carga?.origem || '').trim(),
        destino: String(carga?.destino || '').trim(),
        tipo: String(carga?.tipo || '').trim(),
        regiaoOrigem: String(carga?.regiaoOrigem || '').trim(),
        regiaoPublicacao: String(carga?.regiaoPublicacao || '').trim(),
        peso: String(carga?.peso || '').trim(),
        data: String(carga?.data || '').trim(),
        valor: String(carga?.valor || '').trim(),
        observacoes: String(carga?.observacoes || '').trim(),
        status: 'publicada',
        caminhoneiroId: '',
        caminhoneiroNome: '',
        createdAt: new Date().toISOString(),
        historico: [{ evento: 'publicada', data: new Date().toISOString(), usuarioId: usuario.id, usuarioNome: usuario.nome || usuario.email }]
      };

      if (!payload.origem || !payload.destino || !payload.tipo || !payload.regiaoOrigem || !payload.regiaoPublicacao || !payload.peso || !payload.data || !payload.valor) {
        throw new Error('Preencha todos os campos obrigatórios para publicar a carga.');
      }

      const dataStore = usuario.isDemo ? 'freteConectaDemoCargas' : 'freteConectaCargas';
      const cargas = readJSON(dataStore, []);
      cargas.unshift(payload);
      writeJSON(dataStore, cargas);
      addNotification(usuario.id, {
        tipo: 'nova_carga',
        mensagem: `Carga publicada: ${payload.origem} → ${payload.destino}`,
        cargaId: payload.id
      });
      return payload;
    },
    getCargas() {
      return getAppCargas();
    },
    getAdminDashboardData(filters = {}) {
      const users = getAppUsers();
      const cargas = getAppCargas();
      const filtered = filters.empresa || filters.estado || filters.period || filters.situacao ? {
        cargas: cargas.filter((carga) => {
          if (filters.empresa && String(carga.userId || '') !== String(filters.empresa)) {
            return false;
          }
          if (filters.estado) {
            const estado = String(filters.estado).trim().toUpperCase();
            const origem = String(carga.origem || '').toUpperCase();
            const destino = String(carga.destino || '').toUpperCase();
            if (!origem.includes(`/${estado}`) && !destino.includes(`/${estado}`) && !origem.includes(`(${estado})`) && !destino.includes(`(${estado})`)) {
              return false;
            }
          }
          if (filters.situacao && normalizeStatusKey(carga.status || 'publicada') !== normalizeStatusKey(filters.situacao)) {
            return false;
          }
          if (filters.period && Number(filters.period)) {
            const days = Number(filters.period);
            const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
            const source = new Date(carga.createdAt || carga.data || Date.now()).getTime();
            if (Number.isFinite(source) && source < cutoff) {
              return false;
            }
          }
          return true;
        }),
        users
      } : { cargas, users };

      return getDashboardInfo(filtered.cargas, filtered.users);
    },
    getCargasDisponiveis() {
      return this.getCargas().filter((carga) => {
        const status = normalizeStatusKey(carga.status || 'publicada');
        return status === 'publicada' || status === 'aceita' || status === 'retirada' || status === 'retirada_confirmada' || status === 'coletada' || status === 'em_transporte' || status === 'destino_alcancado' || status === 'entrega_finalizada';
      });
    },
    getCargasDoCaminhoneiro(usuarioId) {
      const usuario = usuarioId || this.currentUser()?.id;
      if (!usuario) {
        return [];
      }
      return this.getCargas().filter((carga) => String(carga.caminhoneiroId) === String(usuario));
    },
    getNotificacoes(userId) {
      const targetId = userId || this.currentUser()?.id;
      if (!targetId) {
        return [];
      }
      return listNotifications().filter((notificacao) => String(notificacao.userId) === String(targetId));
    },
    getTimeline(cargaId) {
      const carga = this.getCargas().find((item) => String(item.id) === String(cargaId));
      if (!carga) {
        return [];
      }
      return Array.isArray(carga.historico) ? carga.historico : [];
    },
    getTrackingSnapshot(cargaId) {
      const carga = this.getCargas().find((item) => String(item.id) === String(cargaId));
      if (!carga) {
        throw new Error('Carga não encontrada para rastreamento.');
      }

      const motorista = carga.caminhoneiroId ? resolveUserById(carga.caminhoneiroId) : null;
      const rota = buildRoutePoints(carga.origem, carga.destino);
      const stored = readTrackingState(carga.id) || {
        cargaId: carga.id,
        mode: 'simulado',
        isRunning: true,
        currentIndex: 0,
        position: rota[0],
        route: rota,
        lastUpdated: new Date().toISOString(),
        isAuthorized: false
      };

      const currentIndex = Math.min(Number(stored.currentIndex || 0), Math.max(rota.length - 1, 0));
      const position = stored.position && stored.position.latitude !== undefined && stored.position.longitude !== undefined
        ? stored.position
        : rota[currentIndex] || rota[0];

      return {
        cargaId: carga.id,
        origem: carga.origem,
        destino: carga.destino,
        status: carga.status,
        situacao: getStatusLabel(carga.status),
        motorista: {
          id: motorista?.id || carga.caminhoneiroId || '',
          nome: motorista?.nome || carga.caminhoneiroNome || 'Motorista não definido'
        },
        rota,
        position,
        previsaoChegada: formatEtaFromRoute(rota, currentIndex),
        mode: stored.mode === 'real' ? 'real' : 'simulado',
        isSimulated: stored.mode !== 'real',
        isRunning: Boolean(stored.isRunning),
        isAuthorized: Boolean(stored.isAuthorized),
        lastUpdated: stored.lastUpdated || new Date().toISOString(),
        mensagem: 'Localização simulada para demonstração. O GPS real só aparece com autorização do motorista.'
      };
    },
    startTrackingSimulation(cargaId) {
      const carga = this.getCargas().find((item) => String(item.id) === String(cargaId));
      if (!carga) {
        throw new Error('Carga não encontrada para iniciar a simulação.');
      }

      const rota = buildRoutePoints(carga.origem, carga.destino);
      const state = {
        cargaId: carga.id,
        mode: 'simulado',
        isRunning: true,
        currentIndex: 0,
        route: rota,
        position: rota[0],
        lastUpdated: new Date().toISOString(),
        isAuthorized: false
      };
      writeTrackingState(carga.id, state);
      return { ...state, status: carga.status, mode: 'simulado', isSimulated: true };
    },
    pauseTrackingSimulation(cargaId) {
      const snapshot = this.getTrackingSnapshot(cargaId);
      const stored = readTrackingState(cargaId) || {};
      const next = {
        ...stored,
        cargaId,
        mode: 'simulado',
        isRunning: false,
        position: snapshot.position,
        route: snapshot.rota,
        lastUpdated: new Date().toISOString()
      };
      writeTrackingState(cargaId, next);
      return { ...next, isSimulated: true, mode: 'simulado' };
    },
    advanceTrackingSimulation(cargaId, steps = 1) {
      const carga = this.getCargas().find((item) => String(item.id) === String(cargaId));
      if (!carga) {
        throw new Error('Carga não encontrada para avançar a simulação.');
      }
      const snapshot = this.getTrackingSnapshot(cargaId);
      const route = snapshot.rota;
      const stepCount = Number(steps) || 1;
      const currentIndex = Math.min(Math.max(Math.round(snapshot.position && snapshot.position.latitude !== undefined ? route.findIndex((point) => point.latitude === snapshot.position.latitude && point.longitude === snapshot.position.longitude) : 0), 0) + stepCount, route.length - 1);
      const position = route[currentIndex];
      const next = {
        cargaId: carga.id,
        mode: 'simulado',
        isRunning: true,
        currentIndex,
        route,
        position,
        lastUpdated: new Date().toISOString(),
        isAuthorized: false
      };
      writeTrackingState(carga.id, next);
      return { ...next, status: carga.status, mode: 'simulado', isSimulated: true };
    },
    setRealTrackingLocation(cargaId, coords) {
      const carga = this.getCargas().find((item) => String(item.id) === String(cargaId));
      if (!carga) {
        throw new Error('Carga não encontrada para atualizar a localização real.');
      }
      const stored = readTrackingState(carga.id) || {};
      const next = {
        ...stored,
        cargaId: carga.id,
        mode: 'real',
        isRunning: true,
        isAuthorized: true,
        position: {
          latitude: Number(coords?.latitude ?? 0),
          longitude: Number(coords?.longitude ?? 0),
          accuracy: Number(coords?.accuracy ?? 0),
          source: 'gps'
        },
        route: buildRoutePoints(carga.origem, carga.destino),
        lastUpdated: new Date().toISOString()
      };
      writeTrackingState(carga.id, next);
      return { ...next, mode: 'real', isSimulated: false, status: carga.status };
    },
    requestRealTrackingPermission(cargaId) {
      const carga = this.getCargas().find((item) => String(item.id) === String(cargaId));
      if (!carga) {
        throw new Error('Carga não encontrada para autorização de rastreio.');
      }
      const stored = readTrackingState(carga.id) || {};
      const next = {
        ...stored,
        cargaId: carga.id,
        mode: 'real',
        isRunning: false,
        isAuthorized: false,
        permissionStatus: 'pending',
        route: buildRoutePoints(carga.origem, carga.destino),
        lastUpdated: new Date().toISOString()
      };
      writeTrackingState(carga.id, next);
      return { ...next, mode: 'real', isSimulated: false };
    },
    addRating(data = {}) {
      const carga = this.getCargas().find((item) => String(item.id) === String(data.cargaId || ''));
      if (!carga) {
        throw new Error('Carga não encontrada para avaliação.');
      }
      if (normalizeStatusKey(carga.status || 'publicada') !== 'recebimento_confirmado') {
        throw new Error('Só é possível avaliar uma operação após o recebimento ser confirmado.');
      }

      const evaluatorId = String(data.evaluatorId || '');
      const evaluatedUserId = String(data.evaluatedUserId || '');
      const participantes = [String(carga.userId || ''), String(carga.caminhoneiroId || ''), String(carga.destinatarioId || '')].filter(Boolean);
      if (!evaluatorId || !evaluatedUserId) {
        throw new Error('Dados do avaliador e do avaliado são obrigatórios.');
      }
      if (!participantes.includes(evaluatorId) || !participantes.includes(evaluatedUserId)) {
        throw new Error('Usuário não participou desta entrega e não pode avaliar a operação.');
      }
      if (evaluatorId === evaluatedUserId) {
        throw new Error('Não é permitido avaliar a si mesmo em uma entrega.');
      }

      const existingRatings = getAllRatings();
      const duplicate = existingRatings.some((rating) => {
        return String(rating.cargaId) === String(data.cargaId) && String(rating.evaluatorId) === String(evaluatorId) && String(rating.evaluatedUserId) === String(evaluatedUserId);
      });
      if (duplicate) {
        throw new Error('Avaliação duplicada para a mesma operação.');
      }

      const nota = Number(data.nota || 0);
      const pontualidade = Number(data.pontualidade || 0);
      const comunicacao = Number(data.comunicacao || 0);
      const cuidado = Number(data.cuidado || 0);
      const compromisso = Number(data.compromisso || 0);
      if ([nota, pontualidade, comunicacao, cuidado, compromisso].some((value) => !Number.isFinite(value) || value < 1 || value > 5)) {
        throw new Error('Todos os critérios de avaliação devem estar entre 1 e 5 estrelas.');
      }

      const rating = {
        id: `rating-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        cargaId: String(carga.id),
        evaluatorId,
        evaluatedUserId,
        nota,
        pontualidade,
        comunicacao,
        cuidado,
        compromisso,
        comentario: String(data.comentario || '').trim(),
        createdAt: new Date().toISOString()
      };
      existingRatings.push(rating);
      writeJSON('freteConectaAvaliacoes', existingRatings);
      return rating;
    },
    getReputationProfile(userId) {
      const ratings = getAllRatings().filter((item) => String(item.evaluatedUserId) === String(userId));
      const entregasConcluidas = this.getCargas().filter((carga) => {
        const isUser = [String(carga.userId || ''), String(carga.caminhoneiroId || ''), String(carga.destinatarioId || '')].includes(String(userId));
        return isUser && normalizeStatusKey(carga.status || 'publicada') === 'recebimento_confirmado';
      }).length;

      const media = ratings.length ? ratings.reduce((sum, item) => sum + Number(item.nota || 0), 0) / ratings.length : 0;
      const pontualidade = ratings.length ? ratings.reduce((sum, item) => sum + Number(item.pontualidade || 0), 0) / ratings.length : 0;
      const comunicacao = ratings.length ? ratings.reduce((sum, item) => sum + Number(item.comunicacao || 0), 0) / ratings.length : 0;
      const cuidado = ratings.length ? ratings.reduce((sum, item) => sum + Number(item.cuidado || 0), 0) / ratings.length : 0;
      const compromisso = ratings.length ? ratings.reduce((sum, item) => sum + Number(item.compromisso || 0), 0) / ratings.length : 0;

      return {
        media: Number(media.toFixed(2)),
        numeroAvaliacoes: ratings.length,
        entregasConcluidas,
        pontualidade: Number(pontualidade.toFixed(2)),
        comunicacao: Number(comunicacao.toFixed(2)),
        cuidado: Number(cuidado.toFixed(2)),
        compromisso: Number(compromisso.toFixed(2)),
        historico: ratings,
        perfilPublico: getPublicUserProfile(userId)
      };
    },
    generateProofOfDelivery(cargaId) {
      const carga = this.getCargas().find((item) => String(item.id) === String(cargaId));
      if (!carga) {
        throw new Error('Carga não encontrada para gerar comprovante.');
      }
      const embarcador = resolveUserById(carga.userId || '');
      const motorista = resolveUserById(carga.caminhoneiroId || '');
      const destinatario = resolveUserById(carga.destinatarioId || '');
      const payload = {
        identificadorEntrega: String(carga.id),
        embarcador: embarcador ? { id: embarcador.id, nome: embarcador.nome, email: embarcador.email, cnpj: embarcador.cnpj || '' } : { id: carga.userId || '', nome: 'Embarcador', email: carga.userEmail || '' },
        caminhoneiro: motorista ? { id: motorista.id, nome: motorista.nome, email: motorista.email, cpf: motorista.cpf || '' } : { id: carga.caminhoneiroId || '', nome: carga.caminhoneiroNome || 'Motorista', email: '' },
        destinatario: destinatario ? { id: destinatario.id, nome: destinatario.nome, email: destinatario.email, cpf: destinatario.cpf || '' } : { id: carga.destinatarioId || '', nome: carga.destinatarioNome || 'Destinatário', email: '' },
        descricaoMercadoria: String(carga.tipo || ''),
        origem: String(carga.origem || ''),
        destino: String(carga.destino || ''),
        dataColeta: String(carga.data || ''),
        dataEntrega: String(carga.data || ''),
        horarioColeta: String(carga.createdAt || new Date().toISOString()),
        horarioEntrega: String(carga.confirmadoEm || new Date().toISOString()),
        confirmacaoRecebimento: normalizeStatusKey(carga.status || 'publicada') === 'recebimento_confirmado',
        idComprovante: `CP-${Date.now()}-${Math.random().toString(16).slice(2, 8).toUpperCase()}`,
        createdAt: new Date().toISOString()
      };
      payload.integrityHash = createIntegrityHash(payload);
      const proofs = getAllProofs();
      proofs.push(payload);
      writeJSON('freteConectaComprovantes', proofs);
      return payload;
    },
    validateProofIntegrity(proof) {
      if (!proof || typeof proof !== 'object') {
        return false;
      }
      const { integrityHash, ...payload } = proof;
      return typeof integrityHash === 'string' && integrityHash === createIntegrityHash(payload);
    },
    getFinancialReport(filters = {}) {
      const cargas = this.getCargas().filter((carga) => {
        if (filters.data && String(carga.data || '').slice(0, 7) !== String(filters.data).slice(0, 7)) {
          return false;
        }
        if (filters.empresa && String(carga.userId || '') !== String(filters.empresa)) {
          return false;
        }
        if (filters.caminhoneiro && String(carga.caminhoneiroId || '') !== String(filters.caminhoneiro)) {
          return false;
        }
        if (filters.status && normalizeStatusKey(carga.status || 'publicada') !== normalizeStatusKey(filters.status)) {
          return false;
        }
        if (filters.origem && !String(carga.origem || '').toLowerCase().includes(String(filters.origem).toLowerCase())) {
          return false;
        }
        if (filters.destino && !String(carga.destino || '').toLowerCase().includes(String(filters.destino).toLowerCase())) {
          return false;
        }
        return true;
      });

      const valores = cargas.map((carga) => ({
        contratados: parseCurrency(carga.valor),
        faturados: normalizeStatusKey(carga.status || 'publicada') === 'recebimento_confirmado' ? parseCurrency(carga.valor) : 0,
        pagos: 0,
        pendentes: normalizeStatusKey(carga.status || 'publicada') === 'recebimento_confirmado' ? parseCurrency(carga.valor) : parseCurrency(carga.valor) * 0.25,
        estimados: parseCurrency(carga.valor),
        status: carga.status || 'publicada'
      }));

      const totalContratado = valores.reduce((sum, item) => sum + Number(item.contratados || 0), 0);
      const totalFaturado = valores.reduce((sum, item) => sum + Number(item.faturados || 0), 0);
      const totalPago = valores.reduce((sum, item) => sum + Number(item.pagos || 0), 0);
      const totalPendente = valores.reduce((sum, item) => sum + Number(item.pendentes || 0), 0);
      const receitaPorPeriodo = Array.from(new Set(cargas.map((carga) => getDateKey(carga.createdAt || carga.data)))).map((key) => ({
        periodo: key,
        total: cargas.filter((carga) => getDateKey(carga.createdAt || carga.data) === key).reduce((sum, item) => sum + parseCurrency(item.valor), 0)
      }));

      return {
        totalFretesContratados: totalContratado,
        valoresPagos: totalPago,
        valoresPendentes: totalPendente,
        despesasRegistradas: 0,
        receitaPorPeriodo,
        custoPorEntrega: cargas.length ? totalContratado / Math.max(cargas.length, 1) : 0,
        historicoFinanceiro: valores,
        desempenhoFinanceiroMensal: receitaPorPeriodo,
        filtrosAplicados: filters,
        tipo: 'financeiro'
      };
    },
    createCompany(data = {}) {
      const companies = readCompanyData();
      const company = {
        id: String(data.id || `company-${Date.now()}`),
        nome: String(data.nome || '').trim(),
        cnpj: String(data.cnpj || '').trim(),
        email: String(data.email || '').trim(),
        status: 'ativa',
        createdAt: new Date().toISOString(),
        atividade: []
      };
      if (!company.nome || !company.cnpj) {
        throw new Error('Nome e CNPJ da empresa são obrigatórios.');
      }
      companies.push(company);
      writeJSON('freteConectaEmpresas', companies);
      return company;
    },
    createEmployeeInvitation(companyId, email, role) {
      const companies = readCompanyData();
      if (!companies.some((company) => String(company.id) === String(companyId))) {
        throw new Error('Empresa não encontrada para convite.');
      }
      const invite = {
        id: `invite-${Date.now()}`,
        companyId: String(companyId),
        email: String(email || '').trim(),
        role: String(role || 'consulta').toLowerCase(),
        status: 'pendente',
        createdAt: new Date().toISOString()
      };
      const invites = ensureArray(readJSON('freteConectaConvites', []));
      invites.push(invite);
      writeJSON('freteConectaConvites', invites);
      return invite;
    },
    associateUserToCompany(companyId, userId, role = 'consulta') {
      const company = readCompanyData().find((item) => String(item.id) === String(companyId));
      if (!company) {
        throw new Error('Empresa não encontrada para associação.');
      }
      const entry = {
        id: `assoc-${Date.now()}`,
        companyId: String(companyId),
        userId: String(userId),
        role: String(role).toLowerCase(),
        cargo: String(role).toLowerCase(),
        ativo: true,
        permissions: getCompanyPermissions(String(role).toLowerCase()),
        createdAt: new Date().toISOString()
      };
      const entries = ensureArray(readJSON('freteConectaEmpresaAssociacoes', []));
      entries.push(entry);
      writeCompanyAccess(entries);
      return entry;
    },
    canAccessCompany(userId, companyId, permission = 'empresa:read') {
      const access = getCompanyAccessEntry(companyId, userId);
      if (!access) {
        return false;
      }
      return (access.permissions || []).includes(permission) || access.role === 'administrador';
    },
    registerVehicle(vehicleData = {}) {
      const vehicle = {
        id: String(vehicleData.id || `veiculo-${Date.now()}`),
        modelo: String(vehicleData.modelo || '').trim(),
        marca: String(vehicleData.marca || '').trim(),
        ano: Number(vehicleData.ano || new Date().getFullYear()),
        placa: String(vehicleData.placa || '').trim(),
        categoria: String(vehicleData.categoria || 'caminhão').trim(),
        capacidadeCarga: String(vehicleData.capacidadeCarga || '').trim(),
        tipoCarroceria: String(vehicleData.tipoCarroceria || '').trim(),
        quilometragem: Number(vehicleData.quilometragem || 0),
        situacao: String(vehicleData.situacao || 'disponivel').trim(),
        motoristaId: String(vehicleData.motoristaId || '').trim(),
        createdAt: new Date().toISOString(),
        manutencoes: ensureArray(vehicleData.manutencoes),
        vencimentos: ensureArray(vehicleData.vencimentos)
      };
      if (!vehicle.modelo || !vehicle.placa) {
        throw new Error('Modelo e placa do veículo são obrigatórios.');
      }
      const vehicles = ensureArray(readJSON('freteConectaFrota', []));
      vehicles.push(vehicle);
      writeJSON('freteConectaFrota', vehicles);
      return vehicle;
    },
    registerDocument(documentData = {}) {
      const document = {
        id: String(documentData.id || `doc-${Date.now()}`),
        tipo: String(documentData.tipo || 'documento').trim(),
        nome: String(documentData.nome || '').trim(),
        categoria: String(documentData.categoria || 'operacional').trim(),
        ownerId: String(documentData.ownerId || ''),
        companyId: String(documentData.companyId || ''),
        fileName: String(documentData.fileName || '').trim(),
        mimeType: String(documentData.mimeType || 'application/octet-stream').trim(),
        sizeBytes: Number(documentData.sizeBytes || 0),
        privado: Boolean(documentData.privado),
        createdAt: new Date().toISOString()
      };
      if (!document.nome || !document.fileName) {
        throw new Error('Nome e arquivo do documento são obrigatórios.');
      }
      if (document.sizeBytes > 10 * 1024 * 1024) {
        throw new Error('Arquivo excede o limite de 10 MB.');
      }
      const documents = ensureArray(readJSON('freteConectaDocumentos', []));
      documents.push(document);
      writeJSON('freteConectaDocumentos', documents);
      return document;
    },
    createSupportTicket(ticketData = {}) {
      const ticket = {
        id: String(ticketData.id || `ticket-${Date.now()}`),
        categoria: String(ticketData.categoria || 'outros').trim(),
        assunto: String(ticketData.assunto || '').trim(),
        descricao: String(ticketData.descricao || '').trim(),
        userId: String(ticketData.userId || '').trim(),
        anexos: ensureArray(ticketData.anexos),
        status: 'aberto',
        respostas: ensureArray(ticketData.respostas),
        createdAt: new Date().toISOString()
      };
      if (!ticket.assunto || !ticket.descricao) {
        throw new Error('Assunto e descrição do chamado são obrigatórios.');
      }
      const tickets = ensureArray(readJSON('freteConectaSuporte', []));
      tickets.push(ticket);
      writeJSON('freteConectaSuporte', tickets);
      return ticket;
    },
    getOperationalOverview() {
      const cargas = this.getCargas();
      const users = getAppUsers();
      const ratings = getAllRatings();
      const proofs = getAllProofs();
      const tickets = ensureArray(readJSON('freteConectaSuporte', []));
      return {
        reputacaoMedia: ratings.length ? ratings.reduce((sum, item) => sum + Number(item.nota || 0), 0) / ratings.length : 0,
        comprovantes: proofs.length,
        ticketsAbertos: tickets.filter((ticket) => ticket.status === 'aberto').length,
        totalCargas: cargas.length,
        usuarios: users.length,
        empresa: readCompanyData().length,
        frota: ensureArray(readJSON('freteConectaFrota', [])).length
      };
    },
    canAccessChat(cargaId, userId) {
      const carga = this.getCargas().find((item) => String(item.id) === String(cargaId));
      if (!carga || !userId) {
        return false;
      }
      return getCargoParticipants(carga).includes(String(userId));
    },
    sendChatMessage(payload = {}) {
      const cargaId = String(payload.cargaId || '');
      const senderId = String(payload.senderId || '');
      const senderRole = normalizeRole(payload.senderRole || 'caminhoneiro');
      const text = String(payload.text || '').trim();
      if (!cargaId || !senderId || !text) {
        throw new Error('Carga, remetente e mensagem são obrigatórios.');
      }
      const carga = this.getCargas().find((item) => String(item.id) === String(cargaId));
      if (!carga) {
        throw new Error('Carga não encontrada para o chat.');
      }
      if (!this.canAccessChat(cargaId, senderId)) {
        throw new Error('Este usuário não participa desta entrega e não pode enviar mensagens.');
      }

      const sender = resolveUserById(senderId);
      const chats = getChatStore();
      let chat = chats.find((entry) => String(entry.cargaId) === String(cargaId));
      if (!chat) {
        chat = { id: createId('chat'), cargaId, messages: [] };
        chats.push(chat);
      }

      const message = {
        id: createId('msg'),
        cargaId,
        senderId,
        senderRole,
        senderName: sender ? sender.nome : 'Usuário',
        text,
        createdAt: new Date().toISOString(),
        readBy: [senderId]
      };
      chat.messages.push(message);
      writeJSON('freteConectaChat', chats);
      return message;
    },
    getChatMessages(cargaId, userId) {
      const chats = getChatStore();
      const chat = chats.find((entry) => String(entry.cargaId) === String(cargaId));
      if (!chat) {
        return [];
      }
      const messages = Array.isArray(chat.messages) ? chat.messages : [];
      if (userId) {
        messages.forEach((message) => {
          if (String(message.senderId) !== String(userId) && !message.readBy.includes(String(userId))) {
            message.readBy = Array.isArray(message.readBy) ? [...new Set([...message.readBy, String(userId)])] : [String(userId)];
          }
        });
        writeJSON('freteConectaChat', chats);
      }
      return messages;
    },
    getUnreadChatMessages(cargaId, userId) {
      if (!userId) {
        return 0;
      }
      return this.getChatMessages(cargaId, userId).filter((message) => {
        return String(message.senderId) !== String(userId) && !(Array.isArray(message.readBy) && message.readBy.includes(String(userId)));
      }).length;
    },
    markChatAsRead(cargaId, userId) {
      const chats = getChatStore();
      const chat = chats.find((entry) => String(entry.cargaId) === String(cargaId));
      if (!chat || !userId) {
        return 0;
      }
      const messages = Array.isArray(chat.messages) ? chat.messages : [];
      messages.forEach((message) => {
        if (String(message.senderId) !== String(userId)) {
          message.readBy = Array.isArray(message.readBy) ? [...new Set([...message.readBy, String(userId)])] : [String(userId)];
        }
      });
      writeJSON('freteConectaChat', chats);
      return messages.length;
    },
    registerOccurrence(payload = {}) {
      const cargaId = String(payload.cargaId || '').trim();
      const categoria = String(payload.categoria || '').trim();
      const descricao = String(payload.descricao || '').trim();
      const responsavelId = String(payload.responsavelId || '').trim();
      const evidencia = Array.isArray(payload.evidencias) ? payload.evidencias : [];
      if (!cargaId || !categoria || !descricao || !responsavelId) {
        throw new Error('Entrega, categoria, descrição e responsável são obrigatórios.');
      }
      const carga = this.getCargas().find((item) => String(item.id) === String(cargaId));
      if (!carga) {
        throw new Error('Carga não encontrada para o registro de ocorrência.');
      }
      if (!this.canAccessChat(cargaId, responsavelId) && !getCargoParticipants(carga).includes(responsavelId)) {
        throw new Error('Responsável não participa desta entrega.');
      }

      const ocorrência = {
        id: createId('occ'),
        cargaId,
        categoria,
        descricao,
        responsavelId,
        responsavelRole: normalizeRole(payload.responsavelRole || 'caminhoneiro'),
        data: new Date().toISOString(),
        situacao: 'aberta',
        evidencias: evidencia,
        resolvidoEm: null,
        resolucao: ''
      };
      const ocorrencias = getOccurrencesStore();
      ocorrencias.push(ocorrência);
      writeJSON('freteConectaOcorrencias', ocorrencias);

      getCargoParticipants(carga).forEach((participantId) => {
        if (participantId !== responsavelId) {
          addNotification(participantId, {
            tipo: 'ocorrencia',
            mensagem: `Ocorrência registrada (${categoria}) na entrega ${cargaId}.`,
            cargaId
          });
        }
      });
      return ocorrência;
    },
    listOccurrences(cargaId) {
      const ocorrencias = getOccurrencesStore();
      const target = String(cargaId || '');
      return target ? ocorrencias.filter((entry) => String(entry.cargaId) === target) : ocorrencias;
    },
    resolveOccurrence(occurrenceId, resolverId, status = 'resolvida', observacao = '') {
      const ocorrencias = getOccurrencesStore();
      const occurrence = ocorrencias.find((entry) => String(entry.id) === String(occurrenceId));
      if (!occurrence) {
        throw new Error('Ocorrência não encontrada.');
      }
      occurrence.situacao = String(status || 'resolvida').trim() || 'resolvida';
      occurrence.resolvidoEm = new Date().toISOString();
      occurrence.resolucao = String(observacao || '').trim();
      occurrence.resolvedBy = String(resolverId || '');
      writeJSON('freteConectaOcorrencias', ocorrencias);
      return occurrence;
    },
    scheduleCollection(payload = {}) {
      const cargaId = String(payload.cargaId || '');
      const usuarioId = String(payload.usuarioId || '');
      const motoristaId = String(payload.motoristaId || '');
      const veiculoId = String(payload.veiculoId || '');
      const data = String(payload.data || '').trim();
      const horario = String(payload.horario || '').trim();
      if (!cargaId || !usuarioId || !motoristaId || !veiculoId || !data || !horario) {
        throw new Error('Carga, usuário, motorista, veículo, data e horário são obrigatórios.');
      }

      const carga = this.getCargas().find((item) => String(item.id) === String(cargaId));
      if (!carga) {
        throw new Error('Carga não encontrada para agendamento.');
      }
      if (!getCargoParticipants(carga).includes(usuarioId)) {
        throw new Error('Usuário não autorizado para agendar esta operação.');
      }

      const agenda = getSchedulingStore();
      const conflito = agenda.some((entry) => {
        return entry && String(entry.motoristaId) === String(motoristaId) && String(entry.data) === String(data) && String(entry.horario) === String(horario);
      }) || agenda.some((entry) => {
        return entry && String(entry.veiculoId) === String(veiculoId) && String(entry.data) === String(data) && String(entry.horario) === String(horario);
      });
      if (conflito) {
        throw new Error('Conflito de agendamento: motorista ou veículo já está reservado para esse horário.');
      }

      const agendamento = {
        id: createId('agenda'),
        cargaId,
        usuarioId,
        motoristaId,
        veiculoId,
        data,
        horario,
        status: 'agendado',
        createdAt: new Date().toISOString()
      };
      agenda.push(agendamento);
      writeJSON('freteConectaAgenda', agenda);
      return agendamento;
    },
    listScheduledCollections(userId) {
      const agenda = getSchedulingStore();
      if (!userId) {
        return agenda;
      }
      return agenda.filter((entry) => String(entry.usuarioId) === String(userId) || String(entry.motoristaId) === String(userId));
    },
    getLogisticsIntelligence(filters = {}) {
      const cargas = this.getCargas().filter((carga) => {
        const periodo = String(filters.periodo || '').trim();
        if (periodo && (carga.createdAt || '').slice(0, 7) !== periodo) {
          return false;
        }
        if (filters.status && normalizeStatusKey(carga.status || 'publicada') !== normalizeStatusKey(filters.status)) {
          return false;
        }
        return true;
      });

      const entregasConfirmadas = cargas.filter((carga) => ['recebimento_confirmado', 'entrega_finalizada'].includes(normalizeStatusKey(carga.status || 'publicada')));
      const totalEntregas = entregasConfirmadas.length;
      const totalCancelar = cargas.filter((carga) => normalizeStatusKey(carga.status || 'publicada') === 'cancelada').length;
      const totalValor = entregasConfirmadas.reduce((sum, carga) => sum + parseCurrency(carga.valor), 0);
      const rotas = buildRotasMaisUtilizadas(cargas);

      const tempos = entregasConfirmadas.map((carga) => {
        const created = new Date(carga.createdAt || carga.data || Date.now()).getTime();
        const finished = new Date(carga.entregueEm || carga.confirmadoEm || Date.now()).getTime();
        if (!Number.isFinite(created) || !Number.isFinite(finished)) {
          return 0;
        }
        return Math.max((finished - created) / (1000 * 60 * 60), 0);
      }).filter((value) => value > 0);

      const tempoMedioTransporte = tempos.length ? tempos.reduce((sum, value) => sum + value, 0) / tempos.length : 0;
      const entregasNoPrazo = entregasConfirmadas.filter((carga) => {
        const created = new Date(carga.createdAt || carga.data || Date.now()).getTime();
        const finished = new Date(carga.entregueEm || carga.confirmadoEm || Date.now()).getTime();
        if (!Number.isFinite(created) || !Number.isFinite(finished)) {
          return true;
        }
        const delta = (finished - created) / (1000 * 60 * 60 * 24);
        const expected = 3;
        return delta <= expected;
      }).length;

      const performance = Array.from(new Map(cargas.filter((carga) => carga.caminhoneiroId).map((carga) => [String(carga.caminhoneiroId), { id: String(carga.caminhoneiroId), nome: carga.caminhoneiroNome || 'Motorista', entregas: 0, total: 0 }])).entries()).map(([id, entry]) => {
        const deliveries = cargas.filter((carga) => String(carga.caminhoneiroId) === id);
        const entregas = deliveries.length;
        const total = deliveries.reduce((sum, carga) => sum + parseCurrency(carga.valor), 0);
        return { id, nome: entry.nome, entregas, total };
      });

      const periodos = Array.from(new Set(cargas.map((carga) => (carga.createdAt || carga.data || '').slice(0, 7)).filter(Boolean))).sort();
      const evolucaoCustos = periodos.map((periodo) => {
        const values = cargas.filter((carga) => (carga.createdAt || carga.data || '').slice(0, 7) === periodo);
        return { periodo, custoTotal: values.reduce((sum, item) => sum + parseCurrency(item.valor), 0), entregas: values.length };
      });

      return {
        totalEntregas,
        quantidadeEntregasPorPeriodo: periodos.length,
        rotasMaisUtilizadas: rotas,
        tempoMedioTransporte: Number(tempoMedioTransporte.toFixed(2)),
        percentualNoPrazo: totalEntregas ? Number(((entregasNoPrazo / totalEntregas) * 100).toFixed(2)) : 0,
        taxaCancelamento: cargas.length ? Number(((totalCancelar / cargas.length) * 100).toFixed(2)) : 0,
        desempenhoCaminhoneiros: performance,
        custoMedioPorEntrega: totalEntregas ? Number((totalValor / totalEntregas).toFixed(2)) : 0,
        evolucaoCustosLogisticos: evolucaoCustos,
        economiaEstimada: Number((totalValor * 0.03).toFixed(2)),
        filtros: filters,
        dadosReais: true,
        estimativas: false
      };
    },
    createDemoScenario() {
      const demoUsers = ensureDemoScenario();
      const demoCargas = readJSON('freteConectaDemoCargas', []);
      const scenarioData = {
        users: demoUsers,
        cargas: demoCargas,
        createdAt: new Date().toISOString()
      };
      if (!demoCargas.length) {
        const embarcador = demoUsers.embarcador;
        const caminhoneiro = demoUsers.caminhoneiro;
        const destinatario = demoUsers.destinatario;
        const carga = this.publishCarga({
          origem: 'São Paulo / SP',
          destino: 'Campinas / SP',
          tipo: 'Eletrônicos',
          regiaoOrigem: 'Sudeste',
          regiaoPublicacao: 'Sudeste',
          peso: '2 t',
          data: '2026-12-01',
          valor: 'R$ 1.800,00',
          observacoes: 'Carga demonstrativa para simulação completa',
          destinatarioNome: destinatario.nome,
          destinatarioEmail: destinatario.email
        }, embarcador.id);
        this.acceptCarga(carga.id, caminhoneiro.id);
        this.atualizarStatusEntrega(carga.id, 'retirada', caminhoneiro.id);
        this.atualizarStatusEntrega(carga.id, 'retirada_confirmada', caminhoneiro.id);
        this.atualizarStatusEntrega(carga.id, 'coletada', caminhoneiro.id);
        this.atualizarStatusEntrega(carga.id, 'em_transporte', caminhoneiro.id);
        this.atualizarStatusEntrega(carga.id, 'destino_alcancado', caminhoneiro.id);
        this.atualizarStatusEntrega(carga.id, 'entrega_finalizada', caminhoneiro.id);
        this.confirmarRecebimento(carga.id, destinatario.id);
        scenarioData.cargas = readJSON('freteConectaDemoCargas', []);
      }
      return scenarioData;
    },
    resetDemoData() {
      const demoUsers = ensureDemoScenario();
      writeJSON('freteConectaDemoCargas', []);
      writeJSON('freteConectaNotificacoes', []);
      return this.createDemoScenario();
    },
    atualizarStatusEntrega(cargaId, novoStatus, userIdOverride) {
      const usuario = userIdOverride ? resolveUserById(userIdOverride) || this.currentUser() : this.currentUser();
      if (!usuario) {
        throw new Error('Faça login para atualizar o status da entrega.');
      }

      const carga = this.getCargas().find((item) => String(item.id) === String(cargaId));
      if (!carga) {
        throw new Error('Carga não encontrada.');
      }

      const flow = getDeliveryStatusFlow();
      const atual = normalizeStatusKey(carga.status || 'publicada');
      const alvo = normalizeStatusKey(novoStatus);
      const indexAtual = flow.findIndex((entry) => entry.key === atual);
      const indexAlvo = flow.findIndex((entry) => entry.key === alvo);

      if (indexAlvo === -1) {
        throw new Error('Status inválido para a entrega.');
      }
      if (indexAtual === -1) {
        throw new Error('Status atual da carga não pôde ser validado.');
      }
      if (indexAlvo < indexAtual) {
        throw new Error('Etapa de entrega fora da ordem correta. Siga a sequência do status atual.');
      }
      if (alvo === 'recebimento_confirmado' && indexAtual < flow.findIndex((entry) => entry.key === 'entrega_finalizada')) {
        throw new Error('Status fora da ordem correta: o recebimento só pode ser confirmado após a entrega finalizada pelo motorista.');
      }

      const userRole = usuario.role;
      const permitidoPara = {
        'publicada': ['embarcador'],
        'aceita': ['caminhoneiro'],
        'retirada': ['caminhoneiro'],
        'retirada_confirmada': ['caminhoneiro'],
        'coletada': ['caminhoneiro'],
        'em_transporte': ['caminhoneiro'],
        'destino_alcancado': ['caminhoneiro'],
        'entrega_finalizada': ['caminhoneiro'],
        'recebimento_confirmado': ['destinatario']
      };

      if (!permitidoPara[alvo] || !permitidoPara[alvo].includes(userRole)) {
        throw new Error('Este usuário não tem permissão para atualizar essa etapa do transporte.');
      }

      const cargaAtualizada = {
        ...carga,
        status: alvo,
        historico: pushHistorico(carga, alvo, usuario.id, usuario.nome || usuario.email, { etapa: getStatusLabel(alvo) })
      };

      const storageKey = carga.userId && resolveUserById(carga.userId)?.isDemo ? 'freteConectaDemoCargas' : 'freteConectaCargas';
      const cargas = readJSON(storageKey, []);
      const index = cargas.findIndex((item) => String(item.id) === String(carga.id));
      if (index >= 0) {
        cargas[index] = cargaAtualizada;
        writeJSON(storageKey, cargas);
      }

      const messageMap = {
        'aceita': 'Carga aceita e atribuída ao caminhoneiro.',
        'retirada': 'Motorista em deslocamento para a retirada da carga.',
        'retirada_confirmada': 'Motorista chegou ao local de retirada.',
        'coletada': 'Carga coletada com sucesso.',
        'em_transporte': 'Carga em transporte.',
        'destino_alcancado': 'Motorista chegou ao destino.',
        'entrega_finalizada': 'Entrega finalizada pelo motorista.',
        'recebimento_confirmado': 'Recebimento confirmado pelo destinatário.'
      };

      const destinatario = resolveUserById(carga.destinatarioId || '') || resolveUserById(carga.userId || '');
      if (carga.userId) {
        addNotification(carga.userId, { tipo: 'status_entrega', cargaId: carga.id, mensagem: messageMap[alvo] || 'Status atualizado da entrega.' });
      }
      if (carga.caminhoneiroId) {
        addNotification(carga.caminhoneiroId, { tipo: 'status_entrega', cargaId: carga.id, mensagem: messageMap[alvo] || 'Status atualizado da entrega.' });
      }
      if (destinatario && String(destinatario.id) !== String(carga.userId)) {
        addNotification(destinatario.id, { tipo: 'status_entrega', cargaId: carga.id, mensagem: messageMap[alvo] || 'Status atualizado da entrega.' });
      }

      return cargaAtualizada;
    },
    confirmarRecebimento(cargaId, userIdOverride) {
      const usuario = userIdOverride ? resolveUserById(userIdOverride) || this.currentUser() : this.currentUser();
      if (!usuario) {
        throw new Error('Faça login para confirmar o recebimento.');
      }
      if (usuario.role !== 'destinatario') {
        throw new Error('Apenas o destinatário pode confirmar o recebimento.');
      }

      const carga = this.getCargas().find((item) => String(item.id) === String(cargaId));
      if (!carga) {
        throw new Error('Carga não encontrada.');
      }
      if (normalizeStatusKey(carga.status) !== 'entrega_finalizada') {
        throw new Error('O recebimento só pode ser confirmado após a entrega finalizada pelo motorista.');
      }

      const atualizada = {
        ...carga,
        status: 'recebimento_confirmado',
        destinatarioId: usuario.id,
        confirmadoEm: new Date().toISOString(),
        historico: pushHistorico(carga, 'recebimento_confirmado', usuario.id, usuario.nome || usuario.email, { etapa: 'RECEBIMENTO CONFIRMADO PELO DESTINATÁRIO' })
      };

      const storageKey = carga.userId && resolveUserById(carga.userId)?.isDemo ? 'freteConectaDemoCargas' : 'freteConectaCargas';
      const cargas = readJSON(storageKey, []);
      const index = cargas.findIndex((item) => String(item.id) === String(carga.id));
      if (index >= 0) {
        cargas[index] = atualizada;
        writeJSON(storageKey, cargas);
      }

      addNotification(carga.userId, { tipo: 'recebimento_confirmado', cargaId: carga.id, mensagem: 'Recebimento confirmado pelo destinatário.' });
      if (carga.caminhoneiroId) {
        addNotification(carga.caminhoneiroId, { tipo: 'recebimento_confirmado', cargaId: carga.id, mensagem: 'Recebimento confirmado pelo destinatário.' });
      }
      return atualizada;
    },
    acceptCarga(cargaId, userIdOverride) {
      const usuario = userIdOverride ? resolveUserById(userIdOverride) || this.currentUser() : this.currentUser();
      if (!usuario) {
        throw new Error('Faça login para aceitar uma carga.');
      }
      if (usuario.role !== 'caminhoneiro') {
        throw new Error('Apenas caminhoneiros podem aceitar uma carga.');
      }

      const cargas = getAppCargas();
      const carga = cargas.find((item) => String(item.id) === String(cargaId));
      if (!carga) {
        throw new Error('Carga não encontrada.');
      }
      if (normalizeStatusKey(carga.status || 'publicada') === 'cancelada') {
        throw new Error('Esta carga foi cancelada e não pode ser aceita.');
      }
      if (carga.status === 'aceita' && carga.caminhoneiroId && carga.caminhoneiroId !== usuario.id) {
        throw new Error('Esta carga já foi aceita por outro caminhoneiro.');
      }
      if (carga.status === 'aceita' && carga.caminhoneiroId === usuario.id) {
        return carga;
      }
      if (normalizeStatusKey(carga.status) === 'entrega_finalizada' || normalizeStatusKey(carga.status) === 'recebimento_confirmado') {
        throw new Error('Não é possível assumir uma entrega que já foi concluída.');
      }

      const atualizada = {
        ...carga,
        status: 'aceita',
        caminhoneiroId: usuario.id,
        caminhoneiroNome: usuario.nome || usuario.email,
        transportador: usuario.nome || usuario.email,
        aceitaEm: new Date().toISOString(),
        historico: pushHistorico(carga, 'aceita', usuario.id, usuario.nome || usuario.email)
      };

      const storageKey = carga.userId && resolveUserById(carga.userId)?.isDemo ? 'freteConectaDemoCargas' : 'freteConectaCargas';
      const lista = readJSON(storageKey, []);
      const index = lista.findIndex((item) => String(item.id) === String(carga.id));
      if (index >= 0) {
        lista[index] = atualizada;
        writeJSON(storageKey, lista);
      }

      addNotification(carga.userId, { tipo: 'carga_aceita', cargaId: carga.id, mensagem: `${usuario.nome || 'Caminhoneiro'} aceitou a carga.` });
      return atualizada;
    },
    cancelCarga(cargaId, motivo = 'Cancelada pelo usuário') {
      const usuario = this.currentUser();
      if (!usuario) {
        throw new Error('Faça login para cancelar uma carga.');
      }

      const cargas = readCargas();
      const index = cargas.findIndex((carga) => String(carga.id) === String(cargaId));
      if (index === -1) {
        throw new Error('Carga não encontrada.');
      }

      const carga = cargas[index];
      const canCancel = usuario.role === 'embarcador' && String(carga.userId) === String(usuario.id);
      const isDriver = usuario.role === 'caminhoneiro' && String(carga.caminhoneiroId) === String(usuario.id);
      if (!canCancel && !isDriver) {
        throw new Error('Você não tem permissão para cancelar esta carga.');
      }

      const atualizada = {
        ...carga,
        status: 'cancelada',
        canceladaPor: usuario.id,
        motivoCancelamento: String(motivo || '').trim() || 'Cancelada pelo usuário',
        canceladaEm: new Date().toISOString(),
        historico: Array.isArray(carga.historico) ? [...carga.historico, { evento: 'cancelada', data: new Date().toISOString(), usuarioId: usuario.id, usuarioNome: usuario.nome || usuario.email, motivo: String(motivo || '').trim() || 'Cancelada pelo usuário' }] : [{ evento: 'cancelada', data: new Date().toISOString(), usuarioId: usuario.id, usuarioNome: usuario.nome || usuario.email, motivo: String(motivo || '').trim() || 'Cancelada pelo usuário' }]
      };

      cargas[index] = atualizada;
      writeCargas(cargas);
      return atualizada;
    },
    confirmCarga(cargaId) {
      const usuario = this.currentUser();
      if (!usuario) {
        throw new Error('Faça login para confirmar uma carga.');
      }
      if (usuario.role !== 'caminhoneiro') {
        throw new Error('Apenas caminhoneiros podem confirmar cargas.');
      }

      const cargas = readCargas();
      const index = cargas.findIndex((carga) => String(carga.id) === String(cargaId));
      if (index === -1) {
        throw new Error('Carga não encontrada.');
      }

      const carga = cargas[index];
      if (carga.status === 'cancelada') {
        throw new Error('Não é possível confirmar uma carga cancelada.');
      }
      if (!carga.caminhoneiroId || carga.caminhoneiroId !== usuario.id) {
        throw new Error('Você precisa aceitar essa carga antes de confirmar a corrida.');
      }
      if (carga.status === 'em_corrida') {
        return carga;
      }
      if (carga.status !== 'aceita') {
        throw new Error('Esta carga precisa estar aceita para iniciar a corrida.');
      }

      const atualizada = {
        ...carga,
        status: 'em_corrida',
        corridaIniciadaEm: new Date().toISOString(),
        corridaConfirmadaPor: usuario.id,
        historico: Array.isArray(carga.historico) ? [...carga.historico, { evento: 'confirmada', data: new Date().toISOString(), usuarioId: usuario.id, usuarioNome: usuario.nome || usuario.email }] : [{ evento: 'confirmada', data: new Date().toISOString(), usuarioId: usuario.id, usuarioNome: usuario.nome || usuario.email }]
      };

      cargas[index] = atualizada;
      writeCargas(cargas);
      return atualizada;
    }
  };

  if (typeof globalThis !== 'undefined') {
    globalThis.FreteConectaAuth = FreteConectaAuth;
  }

  if (typeof window !== 'undefined') {
    window.FreteConectaAuth = FreteConectaAuth;
    if (document && document.readyState !== 'loading') {
      FreteConectaAuth.seedDemoCargas();
      FreteConectaAuth.hideLoginOptions();
    } else if (document) {
      document.addEventListener('DOMContentLoaded', () => {
        FreteConectaAuth.seedDemoCargas();
        FreteConectaAuth.hideLoginOptions();
      });
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FreteConectaAuth, hashPassword, sha256Hex, validateCpf, validateCpfStrict, validateCnpj, validateCnpjStrict, validateEmail, validatePassword, normalizeRole };
  }
})();
