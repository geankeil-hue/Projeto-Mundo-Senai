# Frete Conecta

Plataforma logística desenvolvida para conectar embarcadores, caminhoneiros e destinatários, com foco em gestão de fretes, rastreio, comunicação e operação profissional.

## Visão geral
O projeto preserva o funcionamento base de marketplace de fretes e evolui para uma solução empresarial com módulos de:
- chat interno por entrega
- gestão de ocorrências
- agenda de coleta
- inteligência logística
- operações empresariais
- segurança e conformidade
- apresentação institucional

## Fases implementadas
- Fase 11: chat interno e controle de acesso por entrega
- Fase 12: gestão de ocorrências e notificações
- Fase 13: agendamento de coletas com controle de conflitos
- Fase 14: inteligência logística com indicadores reais
- Fase 16: apresentação institucional
- Fase 17: revisão de segurança e conformidade
- Fase 21: organização e documentação do projeto

## Estrutura principal
- `auth.js`: lógica central do sistema, autenticação, cargos, cargas, chat, ocorrências, agendamento e indicadores
- `index.html`: página inicial da plataforma
- `institucional.html`: apresentação comercial e institucional
- `operacoes-empresariais.html`: visão operacional para empresas
- `privacidade.html` e `termos-uso.html`: documentos de conformidade
- `tests/destinatario-flow.test.js`: testes automatizados de regressão

## Tecnologias
- HTML
- CSS
- JavaScript
- Node.js para verificação automatizada

## Execução
1. Abra a pasta do projeto em um servidor local.
2. Acesse `index.html` ou qualquer página de login/cadastro.
3. Para validar o projeto via terminal:

```bash
node --test tests/*.test.js
```

## Segurança
- senhas armazenadas com hash
- validação de dados e papéis
- controle de acesso ao chat e ocorrências por entrega
- registros de operação e notificações baseadas em eventos

## Observação
A solução atual segue o modelo local/cliente para apresentação e validação em ambiente acadêmico e demonstrativo, sem simular integrações reais com ERP, TMS ou gateways externos.
