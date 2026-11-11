# Arquitetura do projeto Frete Conecta

## Visão geral

Este projeto foi reorganizado para manter uma base estável em HTML, CSS e JavaScript, com regras de autenticação, validação e gestão de cargas centralizadas em `auth.js`.

## Camadas

### 1. Front-end
- páginas HTML com layout e UX responsiva;
- scripts para navegação e interação do usuário;
- uso de `auth.js` como camada de domínio.

### 2. Segurança
- password hash via SHA-256;
- validação de e-mail, CPF e CNPJ;
- sessão persistida em `localStorage` para ambiente estático;
- recuperação com código expirável e antiduplicação.

### 3. Persistência
- armazenamento em `localStorage` como fallback do navegador;
- `server.js` fornece um backend mínimo em Node e persiste dados em `data/store.json` quando executado em servidor real.

### 4. Testes
- `node --test tests/*.test.js` executa a suíte automatizada;
- `node temp-verify.js` valida links e integração do módulo de autenticação.

## Execução

```bash
npm install
npm start
```

## Observação

A aplicação foi preservada como um projeto web estático com comportamento funcional em navegador, mas também recebe um backend mínimo para reforçar autenticação, permissões e controle de cargas em ambiente servidor.
