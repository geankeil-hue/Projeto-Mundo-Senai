(function () {
  const STORAGE_KEY = 'freteConectaUsers';
  const SESSION_KEY = 'freteConectaCurrentUser';
  const RECOVERY_KEY = 'freteConectaRecoveryCode';
  const ROLE_NAMES = ['caminhoneiro', 'embarcador', 'destinatario'];

  function getStorage() {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage;
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
    publishCarga(carga) {
      const usuario = this.currentUser();
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
        status: 'disponivel',
        caminhoneiroId: '',
        caminhoneiroNome: '',
        createdAt: new Date().toISOString(),
        historico: [{ evento: 'publicada', data: new Date().toISOString(), usuarioId: usuario.id, usuarioNome: usuario.nome || usuario.email }]
      };

      if (!payload.origem || !payload.destino || !payload.tipo || !payload.regiaoOrigem || !payload.regiaoPublicacao || !payload.peso || !payload.data || !payload.valor) {
        throw new Error('Preencha todos os campos obrigatórios para publicar a carga.');
      }

      const cargas = readCargas();
      cargas.unshift(payload);
      writeCargas(cargas);
      return payload;
    },
    getCargas() {
      return readCargas().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    },
    getCargasDisponiveis() {
      return this.getCargas().filter((carga) => !carga.status || (carga.status !== 'aceita' && carga.status !== 'em_corrida' && carga.status !== 'cancelada'));
    },
    getCargasDoCaminhoneiro(usuarioId) {
      const usuario = usuarioId || this.currentUser()?.id;
      if (!usuario) {
        return [];
      }
      return readCargas().filter((carga) => String(carga.caminhoneiroId) === String(usuario));
    },
    acceptCarga(cargaId) {
      const usuario = this.currentUser();
      if (!usuario) {
        throw new Error('Faça login para aceitar uma carga.');
      }
      if (usuario.role !== 'caminhoneiro') {
        throw new Error('Apenas caminhoneiros podem aceitar uma carga.');
      }

      const cargas = readCargas();
      const index = cargas.findIndex((carga) => String(carga.id) === String(cargaId));
      if (index === -1) {
        throw new Error('Carga não encontrada.');
      }

      const carga = cargas[index];
      if (carga.status === 'cancelada') {
        throw new Error('Esta carga foi cancelada e não pode ser aceita.');
      }
      if (carga.status === 'aceita' && carga.caminhoneiroId && carga.caminhoneiroId !== usuario.id) {
        throw new Error('Esta carga já foi aceita por outro caminhoneiro.');
      }
      if (carga.status === 'aceita' && carga.caminhoneiroId === usuario.id) {
        return carga;
      }
      if (carga.status === 'em_corrida' && carga.caminhoneiroId === usuario.id) {
        return carga;
      }

      const atualizada = {
        ...carga,
        status: 'aceita',
        caminhoneiroId: usuario.id,
        caminhoneiroNome: usuario.nome || usuario.email,
        transportador: usuario.nome || usuario.email,
        aceitaEm: new Date().toISOString(),
        historico: Array.isArray(carga.historico) ? [
          ...carga.historico,
          { evento: 'aceita', data: new Date().toISOString(), usuarioId: usuario.id, usuarioNome: usuario.nome || usuario.email }
        ] : [{ evento: 'aceita', data: new Date().toISOString(), usuarioId: usuario.id, usuarioNome: usuario.nome || usuario.email }]
      };

      cargas[index] = atualizada;
      writeCargas(cargas);
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
