document.addEventListener('DOMContentLoaded', () => {
  const navbar = document.querySelector('.navbar');

  if (navbar && window.addEventListener) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 40) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    });
  }

  const liveMatches = [
    {
      route: 'São Paulo ➔ Curitiba',
      details: 'Granel sólido · 28,5 toneladas · Hoje, 18h',
      driver: 'João dos Santos',
      truck: 'Volvo FH 540 · 4.8 ★'
    },
    {
      route: 'Campinas ➔ Rio de Janeiro',
      details: 'Carga seca · 14,0 toneladas · Hoje, 19h30',
      driver: 'Carlos Eduardo',
      truck: 'Scania R450 · 4.9 ★'
    },
    {
      route: 'Belo Horizonte ➔ Brasília',
      details: 'Refrigerado · 22,0 toneladas · Hoje, 21h',
      driver: 'Mariana Silva',
      truck: 'DAF XF 530 · 5.0 ★'
    },
    {
      route: 'Porto Alegre ➔ Florianópolis',
      details: 'Sider · 18,5 toneladas · Amanhã, 07h',
      driver: 'Roberto Lima',
      truck: 'Mercedes-Actros · 4.7 ★'
    }
  ];

  let currentIndex = 0;
  const matchCard = document.querySelector('.match-card');

  function updateLiveMatch() {
    if (!matchCard) return;

    matchCard.style.opacity = '0.3';
    matchCard.style.transform = 'translateY(5px)';
    matchCard.style.transition = 'all 0.4s ease';

    setTimeout(() => {
      currentIndex = (currentIndex + 1) % liveMatches.length;
      const data = liveMatches[currentIndex];

      const routeElem = matchCard.querySelector('h2');
      const detailsElem = matchCard.querySelector('.subtext');
      const driverNameElem = matchCard.querySelector('.driver-details strong');
      const driverTruckElem = matchCard.querySelector('.driver-details span');

      if (routeElem) routeElem.textContent = data.route;
      if (detailsElem) detailsElem.textContent = data.details;
      if (driverNameElem) driverNameElem.textContent = data.driver;
      if (driverTruckElem) driverTruckElem.textContent = data.truck;

      matchCard.style.opacity = '1';
      matchCard.style.transform = 'translateY(0)';
    }, 400);
  }

  setInterval(updateLiveMatch, 5000);

  const btnFindCargo = document.querySelector('.Encontrar-cargas');
  if (btnFindCargo) {
    btnFindCargo.addEventListener('click', (event) => {
      event.preventDefault();
      window.location.href = 'login-embarcadores.html';
    });
  }

  const btnPublishCargo = document.querySelector('.Publicar-uma-carga');
  if (btnPublishCargo) {
    btnPublishCargo.addEventListener('click', (event) => {
      event.preventDefault();
      window.location.href = 'cadastro-embarcadores.html';
    });
  }

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

  const sectionLinks = document.querySelectorAll('a[href^="#"]');
  sectionLinks.forEach((link) => {
    const target = document.querySelector(link.getAttribute('href'));

    if (target) {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  });
});
