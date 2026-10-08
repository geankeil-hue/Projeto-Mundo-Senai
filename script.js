document.addEventListener('DOMContentLoaded', () => {

  // ==========================================
  // 1. ANIMAÇÃO DE ROLAGEM NA NAVBAR (HEADER)
  // ==========================================
  const navbar = document.querySelector('.navbar');

  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });

  // ==========================================
  // 2. SIMULAÇÃO DE MATCHES EM TEMPO REAL ("AO VIVO")
  // ==========================================
  // Lista de novos fretes simulados
  const liveMatches = [
    {
      route: 'São Paulo ➔ Curitiba',
      details: 'Granel sólido · 28,5 toneladas · Hoje, 18h',
      driver: 'João dos Santos',
      truck: 'Volvo FH 540 · 4.8 ★',
      confirmed: true
    },
    {
      route: 'Campinas ➔ Rio de Janeiro',
      details: 'Carga Seca · 14,0 toneladas · Hoje, 19h30',
      driver: 'Carlos Eduardo',
      truck: 'Scania R450 · 4.9 ★',
      confirmed: true
    },
    {
      route: 'Belo Horizonte ➔ Brasília',
      details: 'Refrigerado · 22,0 toneladas · Hoje, 21h',
      driver: 'Mariana Silva',
      truck: 'DAF XF 530 · 5.0 ★',
      confirmed: true
    },
    {
      route: 'Porto Alegre ➔ Florianópolis',
      details: 'Sider · 18,5 toneladas · Amanhã, 07h',
      driver: 'Roberto Lima',
      truck: 'Mercedes-Actros · 4.7 ★',
      confirmed: true
    }
  ];

  let currentIndex = 0;
  const matchCard = document.querySelector('.match-card');

  function updateLiveMatch() {
    if (!matchCard) return;

    // Efeito de transição suavizada (Fade Out)
    matchCard.style.opacity = '0.3';
    matchCard.style.transform = 'translateY(5px)';
    matchCard.style.transition = 'all 0.4s ease';

    setTimeout(() => {
      currentIndex = (currentIndex + 1) % liveMatches.length;
      const data = liveMatches[currentIndex];

      // Atualiza os elementos dentro do cartão
      const routeElem = matchCard.querySelector('h2');
      const detailsElem = matchCard.querySelector('.subtext');
      const driverNameElem = matchCard.querySelector('.driver-details strong');
      const driverTruckElem = matchCard.querySelector('.driver-details span');

      if (routeElem) routeElem.textContent = data.route;
      if (detailsElem) detailsElem.textContent = data.details;
      if (driverNameElem) driverNameElem.textContent = data.driver;
      if (driverTruckElem) driverTruckElem.textContent = data.truck;

      // Efeito de entrada (Fade In)
      matchCard.style.opacity = '1';
      matchCard.style.transform = 'translateY(0)';
    }, 400);
  }

  // Alterna automaticamente a oferta de frete a cada 5 segundos
  setInterval(updateLiveMatch, 5000);


  // ==========================================
  // 3. INTERAÇÃO E FEEDBACK DOS BOTÕES
  // ==========================================

  // Botão "Encontrar cargas"
  const btnFindCargo = document.querySelector('.hero-buttons .btn-orange');
  if (btnFindCargo) {
    btnFindCargo.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('A redirecionar para o painel de procura de cargas...');
      alert('🔍 A procurar fretes disponíveis na sua região...');
    });
  }

  // Botão "Publicar uma carga"
  const btnPublishCargo = document.querySelector('.hero-buttons .btn-outline');
  if (btnPublishCargo) {
    btnPublishCargo.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('A abrir o formulário de publicação...');
      alert('📦 Formulário de publicação de nova carga iniciado!');
    });
  }

  // Botão de Estado no Cartão ("Frete confirmado")
  const btnCardStatus = document.querySelector('.btn-card-status');
  if (btnCardStatus) {
    btnCardStatus.addEventListener('click', () => {
      btnCardStatus.style.transform = 'scale(0.96)';
      setTimeout(() => {
        btnCardStatus.style.transform = 'scale(1)';
      }, 150);

      alert('✅ Este frete já foi associado ao motorista com sucesso!');
    });
  }

 // Links da Barra de Navegação Superior
const navLinks = document.querySelectorAll('.nav-links a');

navLinks.forEach(link => {
    link.addEventListener('click', e => {

        // Permite que links que possuem href real funcionem normalmente
        const destino = link.getAttribute('href');

        if (destino && destino !== '#') {
            return;
        }

        // Impede apenas os links que ainda não possuem uma página definida
        e.preventDefault();

        const sectionName = link.textContent.trim();
        console.log(`Navegar para: ${sectionName}`);
    });
});

});