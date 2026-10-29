(function () {
  const STORAGE_KEY = 'freteConectaUsers';
  const SESSION_KEY = 'freteConectaCurrentUser';

  function normalize(value) {
    return String(value ?? '').trim().toLowerCase();
  }

  function readUsers() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      return [];
    }
  }

  function writeUsers(users) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  }

  function readCargas() {
    try {
      const saved = localStorage.getItem('freteConectaCargas');
      const lista = saved ? JSON.parse(saved) : [];
      return Array.isArray(lista) ? lista : [];
    } catch (error) {
      return [];
    }
  }

  function writeCargas(cargas) {
    localStorage.setItem('freteConectaCargas', JSON.stringify(cargas));
  }

  function parseUser(user) {
    if (!user) return null;
    const role = user.role || 'caminhoneiro';
    const cidade = user.cidade || user.localidade || '';
    const estado = user.estado || user.uf || '';
    const homeRegion = user.homeRegion || user.regiao || [cidade, estado].filter(Boolean).join(' / ') || 'São Paulo';
    return {
      id: user.id || Date.now().toString(),
      nome: user.nome || '',
      cpf: user.cpf || '',
      cnpj: user.cnpj || '',
      email: user.email || '',
      senha: user.senha || '',
      cidade,
      estado,
      homeRegion,
      role: ['caminhoneiro', 'embarcador', 'destinatario'].includes(role) ? role : 'caminhoneiro',
      createdAt: user.createdAt || new Date().toISOString()
    };
  }

  function findUserByCredentials(identificador, senha, role) {
    const users = readUsers();
    const valor = normalize(identificador);
    const senhaDigitada = String(senha || '').trim();
    const targetRole = role || 'embarcador';

    const candidates = users.filter((user) => {
      const userParsed = parseUser(user);
      const sameRole = userParsed.role === targetRole;
      const emailMatch = normalize(userParsed.email) === valor;
      const cpfMatch = normalize(userParsed.cpf) === valor;
      const cnpjMatch = normalize(userParsed.cnpj) === valor;
      const senhaMatch = userParsed.senha === senhaDigitada;
      return sameRole && (emailMatch || cpfMatch || cnpjMatch) && senhaMatch;
    });

    return candidates[0] || null;
  }

  window.FreteConectaAuth = {
    getUsers: readUsers,
    getCargas: readCargas,
    seedDemoCargas() {
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
          createdAt: new Date().toISOString()
        }));

      const finalLista = [...existentes, ...demoCargas];
      if (!existentes.length || demoCargas.length) {
        writeCargas(finalLista);
      }

      return finalLista;
    },
    hideLoginOptions() {
      const current = this.currentUser();
      if (!current) {
        return false;
      }

      if (current.role === 'destinatario') {
        document.querySelectorAll('a, button').forEach((element) => {
          if (!element) {
            return;
          }

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
        if (!element) {
          return;
        }

        if (element.hasAttribute('data-role-route') || element.closest('[data-role-route]')) {
          return;
        }

        element.style.display = 'none';
        element.setAttribute('aria-hidden', 'true');
      });

      return true;
    },
    logout() {
      localStorage.removeItem(SESSION_KEY);
      return true;
    },
    currentUser() {
      try {
        const stored = localStorage.getItem(SESSION_KEY);
        if (!stored) {
          return null;
        }

        const parsed = JSON.parse(stored);
        if (!parsed || typeof parsed !== 'object') {
          return null;
        }

        const normalizedRole = ['caminhoneiro', 'embarcador', 'destinatario'].includes(parsed.role) ? parsed.role : 'caminhoneiro';
        return {
          ...parsed,
          role: normalizedRole
        };
      } catch (error) {
        return null;
      }
    },
    findUserByIdentifier(identificador, role) {
      const users = readUsers();
      const valor = normalize(String(identificador ?? ''));

      if (!valor) {
        return null;
      }

      return users.find((user) => {
        const perfil = parseUser(user);
        const matchesIdentifier = normalize(perfil.email) === valor ||
          normalize(perfil.cpf) === valor ||
          normalize(perfil.cnpj) === valor;
        const matchesRole = !role || perfil.role === role;
        return matchesIdentifier && matchesRole;
      }) || null;
    },
    getRecoveryOriginPage() {
      const saved = (() => {
        try {
          return localStorage.getItem('freteConectaRecoveryOrigin');
        } catch (error) {
          return null;
        }
      })();

      const candidates = ['login-embarcadores.html', 'login-destinatario.html', 'login.html'];
      const currentPage = (() => {
        try {
          const path = (window.location.pathname || '').split('/').pop();
          return path || 'login.html';
        } catch (error) {
          return 'login.html';
        }
      })();

      const fallback = candidates.includes(currentPage) ? currentPage : 'login.html';
      const origin = saved && candidates.includes(saved) ? saved : fallback;

      localStorage.setItem('freteConectaRecoveryOrigin', origin);
      return origin;
    },
    sendPasswordRecoveryEmail(identificador, role) {
      const usuario = this.findUserByIdentifier(identificador, role) || this.findUserByIdentifier(identificador);

      if (!usuario) {
        return {
          success: false,
          message: 'Não encontramos uma conta com esse e-mail, CPF ou CNPJ.'
        };
      }

      const perfil = parseUser(usuario);
      const email = String(perfil.email || '').trim();

      if (!email) {
        return {
          success: false,
          message: 'Essa conta não possui um e-mail cadastrado para receber a recuperação.'
        };
      }

      try {
        localStorage.removeItem('freteConectaRecoveryCode');
      } catch (error) {
        // ignora falhas de armazenamento local durante a geração do novo código
      }

      const originPage = this.getRecoveryOriginPage();
      const codigo = 'FRC-' + Math.random().toString(36).slice(2, 8).toUpperCase() + '-' + String(Date.now()).slice(-6);
      localStorage.setItem('freteConectaRecoveryCode', JSON.stringify({
        email,
        codigo,
        userId: perfil.id,
        createdAt: new Date().toISOString(),
        redirect: originPage,
        role: role || perfil.role
      }));

      const assunto = 'Recuperação de senha - Frete Conecta';
      const corpo = [
        'Olá ' + (perfil.nome || 'usuário') + ',',
        '',
        'Recebemos sua solicitação de recuperação de senha.',
        'Seu código de segurança é: ' + codigo,
        '',
        'Use este código para redefinir sua senha no site.',
        'Se você não solicitou essa recuperação, ignore este e-mail.',
        '',
        'Atenciosamente,',
        'Frete Conecta'
      ].join('\n');

      const gmailUrl = 'https://mail.google.com/mail/?view=cm&fs=1&to=' + encodeURIComponent(email) + '&su=' + encodeURIComponent(assunto) + '&body=' + encodeURIComponent(corpo);
      const recoveryPage = 'recuperar-senha.html?email=' + encodeURIComponent(email) + '&redirect=' + encodeURIComponent(originPage);

      try {
        if (email.toLowerCase().endsWith('@gmail.com')) {
          window.open(gmailUrl, '_blank', 'noopener');
          setTimeout(() => {
            window.location.href = recoveryPage;
          }, 600);
        } else {
          const mailtoUrl = 'mailto:' + email + '?subject=' + encodeURIComponent(assunto) + '&body=' + encodeURIComponent(corpo);
          window.location.href = mailtoUrl;
          setTimeout(() => {
            window.location.href = recoveryPage;
          }, 700);
        }
      } catch (error) {
        const fallbackUrl = 'mailto:' + email + '?subject=' + encodeURIComponent(assunto) + '&body=' + encodeURIComponent(corpo);
        window.location.href = fallbackUrl;
        setTimeout(() => {
          window.location.href = recoveryPage;
        }, 700);
      }

      return {
        success: true,
        email,
        codigo,
        recoveryPage,
        message: 'O Gmail de recuperação foi aberto com o código da conta.'
      };
    },
    verifyRecoveryCode(email, codigo, userId) {
      const stored = (() => {
        try {
          const value = localStorage.getItem('freteConectaRecoveryCode');
          return value ? JSON.parse(value) : null;
        } catch (error) {
          return null;
        }
      })();

      if (!stored) {
        return false;
      }

      const mesmaEmail = normalize(stored.email) === normalize(email);
      const mesmoUsuario = userId && String(stored.userId || '') === String(userId);
      const codigoValido = String(stored.codigo || '').trim().toUpperCase() === String(codigo || '').trim().toUpperCase();

      return codigoValido && (mesmaEmail || mesmoUsuario);
    },
    resetPassword(email, codigo, novaSenha, role) {
      const usuario = this.findUserByIdentifier(email, role) || this.findUserByIdentifier(email);

      if (!usuario) {
        return {
          success: false,
          message: 'Conta não encontrada para esse e-mail, CPF ou CNPJ.'
        };
      }

      const perfil = parseUser(usuario);
      const senhaNova = String(novaSenha || '').trim();

      const stored = (() => {
        try {
          const value = localStorage.getItem('freteConectaRecoveryCode');
          return value ? JSON.parse(value) : null;
        } catch (error) {
          return null;
        }
      })();

      const matchesStoredAccount = stored && (
        normalize(stored.email) === normalize(perfil.email) ||
        String(stored.userId || '') === String(perfil.id || '')
      );

      if (stored && !matchesStoredAccount) {
        try {
          localStorage.removeItem('freteConectaRecoveryCode');
        } catch (error) {
          // ignora falhas de limpeza de estado antigo
        }

        return {
          success: false,
          message: 'Código de recuperação não foi gerado para esta conta. Solicite novamente.'
        };
      }

      if (stored && !this.verifyRecoveryCode(perfil.email, codigo, perfil.id)) {
        return {
          success: false,
          message: 'Código de recuperação inválido ou expirado.'
        };
      }

      if (!stored && (!codigo || String(codigo).trim().length < 6)) {
        return {
          success: false,
          message: 'Solicite um novo código de recuperação antes de redefinir a senha.'
        };
      }

      if (!senhaNova || senhaNova.length < 6) {
        return {
          success: false,
          message: 'A nova senha deve ter pelo menos 6 caracteres.'
        };
      }

      const users = readUsers();
      const index = users.findIndex((user) => {
        const item = parseUser(user);
        return item.id === perfil.id || normalize(item.email) === normalize(perfil.email);
      });

      if (index === -1) {
        return {
          success: false,
          message: 'Usuário não encontrado para atualizar a senha.'
        };
      }

      users[index].senha = senhaNova;
      writeUsers(users);
      localStorage.removeItem('freteConectaRecoveryCode');

      return {
        success: true,
        message: 'Senha redefinida com sucesso.',
        role: perfil.role
      };
    },
    getDisplayName(user) {
      const profile = parseUser(user || this.currentUser());
      if (!profile) return 'Visitante';
      return profile.nome || profile.email || profile.cnpj || 'Usuário';
    },
    getHomeRegion(user) {
      const profile = parseUser(user || this.currentUser());
      if (!profile) return 'São Paulo';
      return profile.homeRegion || profile.cidade || profile.estado || 'São Paulo';
    },
    getRoleHome(role) {
      const roleName = ['caminhoneiro', 'embarcador', 'destinatario'].includes(role) ? role : 'caminhoneiro';
      const routes = {
        caminhoneiro: 'para-caminhoneiros.html',
        embarcador: 'embarcadores-publicar.html',
        destinatario: 'destinatario-entregas.html'
      };

      return routes[roleName] || routes.caminhoneiro;
    },
    redirectToRole(role, fallbackLogin) {
      const current = this.currentUser();
      const loginPage = fallbackLogin || (
        role === 'embarcador' ? 'login-embarcadores.html' :
        role === 'destinatario' ? 'login-destinatario.html' :
        'login.html'
      );

      if (current) {
        if (current.role === role) {
          window.location.href = this.getRoleHome(role);
          return true;
        }

        const explicitHome = this.getRoleHome(current.role);
        if (current.role === 'embarcador' || current.role === 'destinatario' || current.role === 'caminhoneiro') {
          window.location.href = explicitHome;
          return false;
        }

        window.location.href = loginPage;
        return false;
      }

      window.location.href = loginPage;
      return false;
    },
    bindRoleNavigation(selector, role, fallbackLogin, areaPage) {
      const links = document.querySelectorAll(selector);

      links.forEach((link) => {
        link.addEventListener('click', (event) => {
          const current = this.currentUser();

          if (current && current.role === role) {
            event.preventDefault();
            window.location.href = areaPage || this.getRoleHome(role);
            return;
          }

          if (current && (current.role === 'embarcador' || current.role === 'destinatario' || current.role === 'caminhoneiro')) {
            event.preventDefault();
            window.location.href = this.getRoleHome(current.role);
            return;
          }

          event.preventDefault();
          window.location.href = fallbackLogin || 'login.html';
        });
      });
    },
    requireAuth(role, redirectTo) {
      const current = this.currentUser();

      if (!current) {
        window.location.href = redirectTo || (
          role === 'embarcador' ? 'login-embarcadores.html' :
          role === 'destinatario' ? 'login-destinatario.html' :
          'login.html'
        );
        return null;
      }

      if (role && current.role !== role) {
        const roleHome = {
          caminhoneiro: 'para-caminhoneiros.html',
          embarcador: 'embarcadores-publicar.html',
          destinatario: 'destinatario-entregas.html'
        };

        if (current.role === 'embarcador' || current.role === 'destinatario' || current.role === 'caminhoneiro') {
          window.location.href = roleHome[current.role] || redirectTo || 'index.html';
          return null;
        }

        window.location.href = redirectTo || (
          role === 'embarcador' ? 'login-embarcadores.html' :
          role === 'destinatario' ? 'login-destinatario.html' :
          'login.html'
        );
        return null;
      }

      return current;
    },
    setupUserMenu(options = {}) {
      const container = document.querySelector(options.containerSelector || '.user-panel');
      const current = this.currentUser();

      if (!container) {
        return current;
      }

      if (!current) {
        const loginLink = options.loginLink || 'login-embarcadores.html';
        container.innerHTML = '<a href="' + loginLink + '" class="user-login-link">Entrar</a>';
        return current;
      }

      const nome = this.getDisplayName(current);
      const areaPath = current.role === 'embarcador'
        ? 'embarcadores-publicar.html'
        : current.role === 'destinatario'
          ? 'destinatario-entregas.html'
          : 'para-caminhoneiros.html';

      container.innerHTML = `
        <div class="user-badge">
          <span class="user-badge-icon">👋</span>
          <span class="user-badge-name">${nome}</span>
        </div>
        <a href="${areaPath}" class="user-area-link">Área</a>
        <button type="button" class="user-logout-btn">Sair</button>
      `;

      const logoutButton = container.querySelector('.user-logout-btn');
      if (logoutButton) {
        logoutButton.addEventListener('click', () => {
          this.logout();
          window.location.href = options.redirectAfterLogout || 'index.html';
        });
      }

      this.hideLoginOptions();
      return current;
    },
    register(userData) {
      const users = readUsers();
      const role = (userData && userData.role) || 'embarcador';
      const payload = parseUser({ ...userData, role: ['caminhoneiro', 'embarcador', 'destinatario'].includes(role) ? role : 'caminhoneiro' });
      const email = normalize(payload.email);
      const cpf = normalize(payload.cpf);
      const cnpj = normalize(payload.cnpj);

      if (!payload.nome || !payload.email || !payload.senha) {
        throw new Error('Nome, e-mail e senha são obrigatórios.');
      }

      const jaExiste = users.some((user) => {
        const item = parseUser(user);
        if (item.role !== payload.role) {
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
        id: payload.id || Date.now().toString(),
        role: payload.role,
        createdAt: payload.createdAt || new Date().toISOString()
      };

      users.push(novoUsuario);
      writeUsers(users);
      localStorage.setItem(SESSION_KEY, JSON.stringify({ ...novoUsuario, senha: undefined }));
      return { ...novoUsuario, senha: undefined };
    },
    login(identificador, senha, role) {
      const requestedRole = role || 'embarcador';
      const user = findUserByCredentials(identificador, senha, requestedRole);

      if (!user) {
        return null;
      }

      const parsedUser = parseUser(user);
      const sessionUser = {
        ...parsedUser,
        role: requestedRole,
        senha: undefined
      };

      localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
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
        createdAt: new Date().toISOString()
      };

      if (!payload.origem || !payload.destino || !payload.tipo || !payload.regiaoOrigem || !payload.regiaoPublicacao || !payload.peso || !payload.data || !payload.valor) {
        throw new Error('Preencha todos os campos obrigatórios para publicar a carga.');
      }

      const cargas = readCargas();
      cargas.unshift(payload);
      writeCargas(cargas);
      return payload;
    },
    getCargasDisponiveis() {
      return readCargas()
        .filter((carga) => !carga.status || (carga.status !== 'aceita' && carga.status !== 'em_corrida'))
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
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
        aceitaEm: new Date().toISOString()
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
        corridaConfirmadaPor: usuario.id
      };

      cargas[index] = atualizada;
      writeCargas(cargas);
      return atualizada;
    }
  };

  if (document.readyState !== 'loading') {
    window.FreteConectaAuth.seedDemoCargas();
    window.FreteConectaAuth.hideLoginOptions();
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      window.FreteConectaAuth.seedDemoCargas();
      window.FreteConectaAuth.hideLoginOptions();
    });
  }
})();
