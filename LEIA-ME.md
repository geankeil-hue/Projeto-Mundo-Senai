# Frete Conecta - Projeto corrigido

Este projeto é uma aplicação web estática para cadastro e login de usuários por perfil, publicação de cargas e visualização de oportunidades. Ele foi ajustado para manter a estrutura original do projeto, corrigir erros de fluxo e evitar que funcionalidades demonstrativas sejam apresentadas como integrações reais.

## O que foi corrigido

- fluxo de cadastro/login por perfil (caminhoneiro, embarcador e destinatário)
- bloqueio de acesso cruzado entre tipos de usuário
- validação de CPF/CNPJ duplicados por perfil
- recuperação e redefinição de senha localmente, com expiração do código
- publicação de cargas com persistência em LocalStorage
- exibição dos cartões de carga com escape de conteúdo para evitar injeção 
- cálculo de distância com fórmula de Haversine
- marcação clara de que as distâncias e tempos são estimativas ilustrativas e não GPS em tempo real
- revisão de links, redirecionamentos e páginas do projeto

## Limitações do projeto

Este projeto não possui backend, banco de dados real, autenticação servidor-side, envio de e-mail real, GPS em tempo real, integração com mapas ou armazenamento seguro de documentos.

O armazenamento atual é feito no navegador via LocalStorage, por isso:

- os dados são apenas locais e não são seguros para uso em produção
- o sistema não substitui autenticação real em servidor
- a recuperação de senha é simulada localmente e não envia e-mail real
- os cálculos de distância são apenas estimativas cartográficas/ilustrativas
- qualquer dado sensível deve ser tratado com cuidado em uma implementação profissional

Essas limitações foram mantidas explícitas para não apresentar recursos demonstrativos como se fossem integrações reais.

## Estrutura do projeto

- index.html: página inicial
- login.html, login-embarcadores.html, login-destinatario.html: telas de login
- cadastro-caminhoneiros.html, cadastro-embarcadores.html, cadastro-destinatario.html: cadastros
- para-caminhoneiros.html, para-embarcadores.html, para-destinatarios.html: áreas específicas por perfil
- embarcadores-publicar.html: publicação de cargas
- destinatario-entregas.html: área do destinatário
- auth.js: lógica central de autenticação e armazenamento local
- script.js: scripts auxiliares gerais
- style.css: estilos globais
- tests/: testes de regressão para fluxo principal

## Como executar

### Opção 1: abrir diretamente no navegador

1. Abra a pasta do projeto em um editor de código.
2. Localize o arquivo index.html.
3. Abra com um navegador.

### Opção 2: servidor local simples

A partir da pasta do projeto, execute:

```bash
python -m http.server 8000
```

Em seguida, acesse:

```text
http://localhost:8000/
```

## Como testar

1. Cadastre um caminhoneiro, um embarcador e um destinatário.
2. Faça login em cada perfil.
3. Verifique que usuários não consigam acessar contas de outros tipos.
4. Teste a recuperação de senha e redefinição.
5. Publique uma carga como embarcador.
6. Verifique a listagem da carga na área correspondente.
7. Confirme que as distâncias aparecem com aviso de estimativa ilustrativa.

## Validação executada

Os arquivos foram validados com:

```bash
node --check auth.js ; node --check script.js ; node --test tests/destinatario-flow.test.js
```

Resultado verificado: 6 testes passaram e 0 falharam.

## Observação final

Este projeto foi ajustado para funcionar corretamente em ambiente estático, mantendo a estrutura original sempre que possível, sem inventar integrações externas que não existem no código atual.
