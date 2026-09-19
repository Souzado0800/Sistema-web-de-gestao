# Sistema Completo de Gestão e Controle de Estoque Empresarial (Netlify Edition)

Sistema profissional, auditável, seguro e de alto desempenho para gestão e controle de estoque interno corporativo, projetado especificamente para hospedar em produção na **Netlify** (Frontend SPA em CDN Global + API Serverless via Netlify Functions) integrado a banco de dados relacional externo **PostgreSQL** gerenciado (Neon, Supabase, Railway ou AWS RDS).

---

## 1. Visão Geral da Solução

O sistema permite o controle rigoroso de qualquer tipo de material e produto consumível da empresa, sem limitações pré-definidas de categorias ou unidades de medida:

* **Papelaria e Escritório**: Papel Sulfite A4 75g (Resma), Cartolina, Canetas, Lápis, Grampos, Pastas, Envelopes.
* **Impressão**: Toners, Refis de Tinta Epson/HP (Frasco/Cartucho), Cilindros.
* **Tecnologia & TI**: Cabos HDMI, Fontes, Adaptadores, Teclados, Mouses, Conectores.
* **Limpeza e Higiene**: Detergentes Concentrados (Galão 5L), Desinfetantes, Sabonetes, Papel Toalha.
* **Manutenção & Ferramentas**: Fitas, Lâmpadas, Parafusos, Componentes Elétricos.
* **Produtos Personalizados e Uniformes**: Crachás, Brindes, Camisas, etc.

---

## 2. Arquitetura de Produção (Netlify + PostgreSQL)

```text
                           NAVEGADOR (Desktop / Tablet / Mobile)
                                             │
                                             ▼
                             NETLIFY EDGE & GLOBAL CDN
                                             │
                      ┌──────────────────────┴──────────────────────┐
                      ▼                                             ▼
              FRONTEND ESTÁTICO                             NETLIFY FUNCTIONS
             (HTML5 / CSS3 / SPA)                       (Serverless REST API Engine)
             • Dashboard & KPIs                         • /api/auth
             • Produtos & Categorias                    • /api/products
             • Entradas, Saídas, Ajustes                • /api/movements
             • Inventário Físico                        • /api/inventory
             • Ordens de Compra                         • /api/purchases
             • Departamentos & Centros de Custo         • /api/departments
             • Fornecedores Homologados                 • /api/suppliers
             • Relatórios Analíticos (CSV/PDF)          • /api/reports
             • Trilha de Auditoria                      • /api/audit
             • Gestão de Usuários (RBAC)                • /api/users
                      │                                 • /api/settings
                      │                                             │
                      │                                             ▼
                      │                                  POSTGRESQL GERENCIADO
                      │                             (Neon / Supabase / Managed DB)
                      │                             • ACID Transactions
                      │                             • SELECT ... FOR UPDATE Lock
                      │                             • Atomic CAS (Compare-And-Swap)
                      │                             • Conexão SSL & Pool Serverless
                      └─────────────────────────────────────────────┘
```

### Garantias Fundamentais de Arquitetura:
1. **Zero Servidores Persistentes Locais**: A aplicação é 100% serverless / stateless. O usuário não precisa manter nenhum processo Python ou Node executando em seu computador para o sistema funcionar online.
2. **PostgreSQL Transacional (ACID)**: Toda alteração de estoque ocorre dentro de uma transação PostgreSQL. Se qualquer etapa falhar, ocorre `ROLLBACK` automático. Saldo nunca é alterado sem movimentação, e movimentação nunca é criada sem atualização do saldo.
3. **Proteção Rigorosa Contra Concorrência e Race Conditions**: 
   - Utiliza bloqueio pessimista de linha (`SELECT ... FOR UPDATE`).
   - Implementa **Compare-And-Swap (CAS)** condicional no SQL: `UPDATE products SET current_stock = current_stock - $1 WHERE id = $2 AND current_stock >= $1 RETURNING ...`.
   - Se duas requisições simultâneas tentarem retirar estoque insuficiente (ex: Saldo 10; Requisições simultâneas de 7 e 5), exatamente uma é processada e a outra é rejeitada com erro 400 (`Saldo insuficiente`), garantindo saldo final de 3 (nunca negativo).
4. **Histórico Imutável**: Produtos nunca são apagados fisicamente caso possuam histórico (`status = 'archived'`).

---

## 3. Estrutura de Diretórios do Projeto

```
gestao-estoque/
├── netlify.toml                      # Configuração Netlify (build, functions, SPA redirects e security headers)
├── package.json                      # Dependências (pg, bcryptjs, jsonwebtoken) e scripts
├── .env.example                      # Modelo de variáveis de ambiente
├── README.md                         # Documentação oficial
│
├── public/                           # Frontend Estático SPA (distribuído no Netlify CDN)
│   ├── index.html                    # Layout da SPA (Login, Navbar, Sidebar responsiva, Containers)
│   ├── css/
│   │   └── app.css                   # Design system empresarial responsivo, tokens CSS, impressão PDF
│   └── js/
│       ├── api.js                    # Cliente HTTP Fetch com interceptor de JWT e download CSV
│       ├── state.js                  # Gerenciador de estado global e reatividade
│       ├── charts.js                 # Gráficos SVG nativos leves (Entradas x Saídas e Ranking)
│       ├── components.js             # Modais, Toasts, Diálogos de confirmação, Badges e Paginação
│       ├── router.js                 # Roteador SPA client-side (sem recarregar página)
│       ├── app.js                    # Inicializador da aplicação, eventos e sessão
│       └── views/                    # Telas modulares do sistema
│           ├── dashboard.js          # KPIs, Alertas em tempo real, Gráficos e Ações Rápidas
│           ├── products.js           # Listagem, Filtros de estoque, CRUD e Modal com Timeline
│           ├── movements.js          # Modais de Entrada, Saída, Ajuste e Tabela de Histórico
│           ├── inventory.js          # Sessões de Inventário Físico e Ajuste de Divergências
│           ├── purchases.js          # Reposição Automática e Gestão de Ordens de Compra
│           ├── departments.js        # Centros de Custo e Departamentos
│           ├── suppliers.js          # Cadastro e Gestão de Fornecedores
│           ├── reports.js            # 4 Relatórios Analíticos com Exportação (CSV e Impressão)
│           ├── users.js              # Gestão de Usuários e Perfis (Admin vs Operador)
│           ├── audit.js              # Trilha de Auditoria imutável com modal JSON
│           └── settings.js           # Parâmetros da empresa, regras de estoque e backup
│
├── netlify/
│   └── functions/
│       └── api.js                    # Função Serverless unificada atendendo /api/*
│
├── backend/                          # Núcleo de lógica desacoplada da infraestrutura
│   ├── config.js                     # Leitura e validação de variáveis de ambiente
│   ├── db.js                         # Pool PostgreSQL com SSL e fallback in-memory (pg-mem)
│   ├── middleware/
│   │   ├── auth.js                   # Verificação de tokens JWT e Bcrypt hashing
│   │   └── rbac.js                   # Controle de acesso por perfis (Admin vs Operador)
│   ├── services/
│   │   ├── stock_service.js          # Regras atômicas de Entrada, Saída (lock CAS) e Ajuste
│   │   ├── inventory_service.js      # Sessão de inventário e aplicação em lote de divergências
│   │   ├── purchase_service.js       # Cálculo de reposição e recebimento de ordens de compra
│   │   └── report_service.js         # Agregações analíticas e exportação CSV
│   └── repositories/                 # Camada de persistência SQL parametrizada
│       ├── product_repo.js           # Catálogo de produtos, filtros e paginação
│       ├── movement_repo.js          # Histórico de movimentações e rankings
│       ├── user_repo.js              # Repositório de usuários
│       ├── category_repo.js          # Repositório de categorias
│       ├── department_repo.js        # Repositório de departamentos
│       ├── supplier_repo.js          # Repositório de fornecedores
│       ├── inventory_repo.js         # Repositório de inventário
│       ├── purchase_repo.js          # Repositório de compras
│       ├── audit_repo.js             # Repositório de logs de auditoria
│       └── settings_repo.js          # Repositório de configurações
│
├── database/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql    # Tabelas base, constraints e índices
│   │   ├── 002_inventory.sql         # Módulo de inventário físico
│   │   └── 003_purchases.sql         # Ordens de compra e reposição
│   ├── seeds/
│   │   └── initial_seed.sql          # Usuários admin/operador, categorias, produtos dos casos do prompt
│   ├── migrate.js                    # Executor de migrations
│   └── seed.js                       # Executor de seed
│
├── tests/
│   ├── test_stock_transactions.js    # Teste de transações, rollback e saldo insuficiente
│   ├── test_concurrency.js           # Teste de requisições simultâneas em paralelo
│   ├── test_inventory.js             # Teste de divergência física de contagem
│   ├── test_auth_rbac.js             # Teste de JWT, Bcrypt e bloqueio de operador
│   ├── test_purchases.js             # Teste de alertas de reposição e recebimento de compra
│   ├── test_api_endpoints.js         # Teste E2E de todos os endpoints HTTP serverless
│   └── run_tests.js                  # Executor mestre da suíte de testes
│
└── dev-server.js                     # Emulador local de desenvolvimento da Netlify
```

---

## 4. Guia de Deploy em Produção na Netlify

### Passo 1: Criar o Banco PostgreSQL Gerenciado
Crie uma instância gratuita do PostgreSQL em um dos provedores recomendados:
* **Neon** ([neon.tech](https://neon.tech)) — Recomendado para serverless, com connection pooling nativo e latência ultra-baixa.
* **Supabase** ([supabase.com](https://supabase.com)) — Conexão PostgreSQL direta ou via Transaction Pooler (porta 6543 / 5432).

Copie a string de conexão (URL) do banco. Exemplo:
```text
postgresql://neondb_owner:SENHA@ep-cluster.us-east-2.aws.neon.tech/neondb?sslmode=require
```

### Passo 2: Executar as Migrations e Seeds Iniciais
Você pode executar as migrations de duas formas:
1. **Via SQL Editor do Neon/Supabase**:
   Copie e execute o conteúdo de `database/migrations/001_initial_schema.sql`, `002_inventory.sql`, `003_purchases.sql` e `database/seeds/initial_seed.sql`.
2. **Via Linha de Comando**:
   ```bash
   DATABASE_URL="sua_string_de_conexao" npm run migrate
   DATABASE_URL="sua_string_de_conexao" npm run seed
   ```

### Passo 3: Conectar o Repositório à Netlify
1. Faça push do projeto para o seu repositório no **GitHub**, **GitLab** ou **Bitbucket**.
2. Acesse o painel da Netlify ([app.netlify.com](https://app.netlify.com)) e clique em **Add new site** > **Import an existing project**.
3. Selecione o repositório. O arquivo `netlify.toml` detectará automaticamente as configurações:
   * **Publish directory**: `public`
   * **Functions directory**: `netlify/functions`
   * **Build command**: `npm run build`

### Passo 4: Configurar as Variáveis de Ambiente na Netlify
No painel da Netlify, acesse **Site configuration** > **Environment variables** e adicione:
* `DATABASE_URL`: URL completa do PostgreSQL obtida no Passo 1.
* `JWT_SECRET`: Chave secreta aleatória segura (ex: gerada com `openssl rand -base64 48`).
* `APP_ENV`: `production`
* `COMPANY_NAME`: Nome oficial da sua empresa.
* `ALLOW_NEGATIVE_STOCK`: `false` (bloqueia saídas maiores que o saldo físico).

### Passo 5: Publicar o Site
Clique em **Deploy site**. A Netlify compilará a SPA estática no CDN global e publicará a API serverless nas Netlify Functions.

---

## 5. Credenciais Padrão de Acesso

O seed inicial cria automaticamente duas contas prontas para uso:

| Perfil | Usuário | Senha Padrão | Permissões |
| :--- | :--- | :--- | :--- |
| **Administrador** | `admin` | `admin123` | Acesso irrestrito a todas as funções, relatórios, auditoria, configurações, cadastro de produtos e gestão de usuários. |
| **Operador** | `operador` | `operador123` | Consulta de estoque, registro de entradas, registro de saídas, consulta de histórico e relatórios operacionais. Bloqueado em rotas críticas administrativas. |

> [!IMPORTANT]
> Em ambiente de produção real, altere imediatamente as senhas padrão na tela de **Usuários**.

---

## 6. Desenvolvimento e Testes Locais

Para executar localmente sem depender da Netlify ativa:

### Instalação de Dependências
```bash
npm install
```

### Execução da Suíte Completa de Testes Automatizados
O projeto possui testes unitários, transacionais de concorrência e testes de integração de API E2E:
```bash
npm test
```

A suíte valida:
1. Transações atômicas de Entrada, Saída e Rollback em caso de erro.
2. Concorrência com múltiplas requisições paralelas disparadas ao mesmo tempo, impedindo saldo negativo.
3. Ciclo completo de inventário físico com aplicação de divergências.
4. Hashing Bcrypt, geração/validação de tokens JWT e bloqueio de operadores em rotas restritas via RBAC.
5. Casos do Prompt Mestre:
   * **Caso 1 (Papel A4)**: Cadastro de 10 resmas, mín 3, ideal 20.
   * **Caso 2 (Tinta Epson)**: Cadastro de 2 frascos, mín 2, ideal 8 $\rightarrow$ Alerta automático com sugestão de compra de 6 frascos.
   * **Caso 3 (Caneta Azul)**: Cadastro de 150 unidades, mín 30, ideal 100 $\rightarrow$ Sem alertas falsos.
   * **Caso 4 (Saída de 20 canetas)**: Retirada vinculada a responsável e setor Administrativo $\rightarrow$ Saldo atualizado de 150 para 130 e histórico gravado.
6. Teste E2E de todos os endpoints HTTP serverless da Netlify Function.

### Execução do Servidor Local de Desenvolvimento (Emulador da Netlify)
```bash
npm run dev
```
O servidor estará acessível em: `http://localhost:8080` (emula exatamente os redirects e a API Serverless da Netlify).

---

## 7. Módulos e Funcionalidades do Sistema

### 1. Dashboard Executivo & Alertas
* KPIs em tempo real: Total de produtos cadastrados, Valor monetário total em estoque, Produtos em nível baixo/crítico e Produtos zerados.
* Banners dinâmicos de níveis de estoque: **Normal**, **Baixo**, **Crítico** e **Sem Estoque**.
* Gráficos SVG nativos: Entradas vs Saídas diárias nos últimos 30 dias e Ranking dos materiais mais consumidos.
* Tabela de movimentações recentes com atalhos rápidos.

### 2. Gestão Completa de Produtos
* Cadastro livre de qualquer material ou insumo.
* Unidades de medida totalmente configuráveis (Unidade, Resma, Caixa, Frasco, Galão, Litro, Kg, Metro, Rolo, Cartucho, etc.).
* Definição de Estoque Mínimo (ponto de reabastecimento) e Estoque Ideal.
* Localização no almoxarifado, preço de referência e vinculação a fornecedor.
* Modal de Detalhes Individuais com **Linha do Tempo (Timeline) cronológica** de todas as movimentações do produto.
* Arquivamento seguro de produtos: itens arquivados não permitem novas saídas, mas seu histórico de movimentação permanece intacto para auditoria.

### 3. Entradas de Estoque
* Registro de compras, reposições mensais ou devoluções.
* Dados fiscais: Fornecedor, Número da Nota Fiscal e Valor Unitário.
* Cálculo em tempo real do saldo resultante prévio à confirmação.
* Atualização atômica do saldo e gravação no histórico imutável.

### 4. Saídas de Estoque
* Destinação obrigatória para **Departamento / Centro de Custo** consumidor (Administrativo, Produção, TI, Limpeza, etc.).
* Identificação obrigatória do funcionário responsável pela retirada.
* Validação automática de saldo disponível: saídas que excedam o estoque atual são bloqueadas no frontend e no backend, impedindo saldo negativo.

### 5. Ajustes Manuais de Estoque
* Para situações de divergência, produto quebrado, danificado, extraviado ou correção de cadastro.
* Justificativa e motivo estritamente obrigatórios. Não permite alterações silenciosas.

### 6. Assistente de Inventário Físico
* Criação de sessões de contagem periódicas (para todo o estoque ou por categoria específica).
* Exibição do estoque esperado pelo sistema com campos para digitação da contagem física real.
* Apuração automática em tempo real das divergências (faltas e sobras).
* Confirmação e aplicação em lote dos ajustes, gerando movimentações de inventário e auditoria.

### 7. Reposição Automática & Ordens de Compra
* Painel automático listando todos os produtos com `estoque_atual <= estoque_minimo`.
* Cálculo automático da sugestão de compra: $\text{Sugestão} = \text{Estoque Ideal} - \text{Estoque Atual}$.
* Gestão de Ordens de Compra com múltiplos itens e ciclo de status: `Planejado` $\rightarrow$ `Em compra` $\rightarrow$ `Pedido realizado` $\rightarrow$ `Recebido`.
* Ação de **Recebimento de Compra**: confere as quantidades entregues com a nota fiscal e gera automaticamente as **Entradas no estoque**.

### 8. Departamentos e Centros de Custo
* Cadastro dos setores da empresa para controle orçamentário e rateio de consumo de suprimentos.

### 9. Fornecedores Homologados
* Cadastro comercial com CNPJ, telefone, e-mail e pessoa de contato.
* Contagem automática de produtos fornecidos e histórico de entregas.

### 10. Relatórios Gerenciais & Exportação
* 4 Relatórios Analíticos com filtros por período e categoria:
  1. Posição Geral do Estoque Atual (com valorização patrimonial).
  2. Produtos em Alerta / Necessidade de Compras.
  3. Consumo por Departamento / Centro de Custo.
  4. Histórico Geral de Movimentações.
* Exportação em **CSV** estruturado respeitando os filtros aplicados.
* Versão limpa para **Impressão / PDF** via folha de estilo otimizada (`@media print`).

### 11. Trilha de Auditoria Imutável
* Registro permanente de eventos sensíveis (login, criação, alteração, arquivamento, entradas, saídas, ajustes, inventários e ordens de compra).
* Visualizador de payload JSON formatado em modal para inspeção técnica e compliance.

### 12. Backup e Segurança
* Exportação de snapshot completo de dados em formato JSON com 1 clique.
* Políticas de segurança: Senhas criptografadas com Bcrypt, autenticação via tokens JWT com assinatura segura, headers de proteção contra clickjacking e XSS no `netlify.toml`, e bloqueio de endpoints por papel (RBAC).

---

## 8. Licença
Sistema desenvolvido sob licença proprietária corporativa para uso interno empresarial.
