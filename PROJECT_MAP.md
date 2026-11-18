# 🗺️ MAPA DE ARQUITETURA, SISTEMAS E ARQUIVOS — NEXUS ERP

> **Versão:** 2.5.0-Enterprise  
> **Status:** Produção / Governança Global Ativa  
> **Autoridade:** Proprietário Global (Platform Owner) & Comitê de Governança  
> **Última Atualização:** 2026-11-18  

---

## 🏛️ 1. HIERARQUIA GLOBAL DE AUTORIDADE (4 NÍVEIS)

O NEXUS ERP possui uma camada central de administração e soberania independente de workspaces operacionais. O sistema de autoridade governa **todo o dashboard**, controlando desde o acesso a rotas até ações atômicas de criação, edição e exclusão de recursos.

```
┌────────────────────────────────────────────────────────────────────────┐
│  NÍVEL 1 — PROPRIETÁRIO GLOBAL (Platform Owner)                        │
│  • Soberano, único e irrevogável por outros administradores            │
│  • Controle institucional total: workspaces, admins globais, auditoria  │
│  • Teto de delegação irrestrito                                        │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ nomeia e delega
┌──────────────────────────────────▼─────────────────────────────────────┐
│  NÍVEL 2 — ADMINISTRADOR GLOBAL (Platform Admin)                       │
│  • Competências globais específicas delegadas pelo Proprietário        │
│  • Gerencia múltiplos workspaces, admins locais e políticas globais    │
│  • Não pode remover nem modificar o Proprietário Global                │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ atribui escopo
┌──────────────────────────────────▼─────────────────────────────────────┐
│  NÍVEL 3 — ADMINISTRADOR DE WORKSPACE (Workspace Admin)                │
│  • Gestão operacional local do workspace (G300, MKBR, Mapeamento, etc) │
│  • Gerencia membros e papéis locais dentro dos tetos estabelecidos     │
│  • Sujeito a restrições e limites administrativos (Constraints)        │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ atribui permissões
┌──────────────────────────────────▼─────────────────────────────────────┐
│  NÍVEL 4 — USUÁRIOS OPERACIONAIS (Colaboradores / Especialistas)       │
│  • Gestores de Módulo, Admins de Mapa, Editores, Visualizadores        │
│  • Acesso estritamente restrito aos recursos autorizados               │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 📦 2. DIVISÃO EM SISTEMAS E SUBSISTEMAS

| Sistema / Domínio | Diretórios Principais | Responsável Primário | Nível Mínimo |
| :--- | :--- | :--- | :---: |
| **IAM & Governança Global** | `src/components/IAM/`, `src/providers/IAMProvider.tsx`, `src/app/iam/` | Platform Owner | **1 ou 2** |
| **Módulo G300 (Estoque & Avarias)** | `src/app/g300/`, `src/components/DriveInGrid.tsx`, `src/modules/` | Admin G300 | **3** |
| **Módulo MKBR (Linha BR & Paletes)**| `src/app/mkbr/`, `src/app/br/`, `src/components/br/` | Admin MKBR | **3** |
| **Mapeamento Geral do Armazém** | `src/app/mapeamentos/`, `src/components/mapeamentos/` | Admin Mapas | **3** |
| **Laboratório Gráfico (2D/3D)** | `src/app/laboratorio/`, `src/components/laboratorio/` | Engenheiro Layout | **3 ou 4** |
| **Universal Resources & Systems** | `src/components/Resources/`, `src/components/Systems/` | Admin Global | **2 ou 3** |
| **Core, Sincronização & Offline** | `src/lib/`, `src/hooks/`, `src/providers/` | Infraestrutura | **1 ou 2** |

---

## 📂 3. INVENTÁRIO DETALHADO DE ARQUIVOS

### 3.1. Governança Global, Segurança e IAM (Identity & Access Management)

| Arquivo | Sistema | Nível | Responsabilidade / Funções |
| :--- | :--- | :---: | :--- |
| `src/providers/IAMProvider.tsx` | IAM Core | Global | Provedor de contexto global que escuta o Supabase Auth, carrega a autoridade real do usuário (Níveis 1 a 4) e disponibiliza o hook `useIAM()`. |
| `src/components/IAM/iamService.ts` | IAM Core | Global | Singleton do motor de autorização determinístico (RBAC/ABAC). Avalia permissões, gerencia admins globais e de workspace, e grava auditoria no Supabase. |
| `src/components/IAM/useAuthz.ts` | IAM Core | Global | Hook React para checagem rápida de permissões (`can`, `cannot`, `explain`, `authorityLevel`) conectado ao usuário real autenticado. |
| `src/components/IAM/types.ts` | IAM Core | Global | Definições completas de tipos TypeScript (AuthorityLevel, PlatformOwner, PlatformAdmin, WorkspaceAdminAssignment, PermissionCode). |
| `src/components/IAM/permissionsCatalog.ts` | IAM Core | Global | Catálogo com as 24 permissões do sistema categorizadas em Mapas, Objetos, Estrutura, Histórico e Administração. |
| `src/components/IAM/defaultRoles.ts` | IAM Core | Global | 7 papéis canônicos do sistema (Owner, Admin, Gestor, Map Admin, Editor, Collaborator, Viewer) com níveis e permissões. |
| `src/components/IAM/GlobalAdminBar.tsx` | IAM UI | Global | Barra de controle superior exibida em todo o dashboard quando um usuário de Nível 1 ou 2 está logado. |
| `src/components/IAM/AdminCenter/AdminCenterModal.tsx` | IAM UI | Global | Modal completo da Central de Governança para nomear administradores, gerenciar tetos delegatórios e consultar auditoria. |
| `src/app/iam/page.tsx` | IAM Page | 1 e 2 | Console central de governança em tela cheia com 7 abas: Governança, Workspaces, Usuários, Papéis, Catálogo, Simulador e Auditoria. |
| `supabase/nexus_iam_rbac_identity_permissions.sql` | Banco SQL | 1 | Script DDL/DML idempotente com todas as tabelas `nexus_iam_*`, funções PL/pgSQL e políticas RLS. |

---

### 3.2. Portal Principal e Layouts da Aplicação

| Arquivo | Sistema | Nível | Responsabilidade / Funções |
| :--- | :--- | :---: | :--- |
| `src/app/layout.tsx` | Shell App | Global | Layout raiz com fontes Geist, PWA Register e envolto pelo `<IAMProvider>`. |
| `src/app/page.tsx` | Portal Central | Global | Página inicial do dashboard que identifica a autoridade do usuário, exibe a barra global para Níveis 1 e 2, e filtra cards de módulos operacionais. |
| `src/app/globals.css` | Shell App | Global | Estilos globais Tailwind CSS, scrollbars customizadas e variáveis de tema. |

---

### 3.3. Módulo G300 (Estoque, Avarias, Drive-in e Ruas)

| Arquivo | Sistema | Nível | Responsabilidade / Funções |
| :--- | :--- | :---: | :--- |
| `src/app/g300/page.tsx` | G300 Hub | 3 ou 4 | Roteador e portal de entrada para os submódulos do G300. |
| `src/app/g300/avarias/page.tsx` | G300 Core | 3 ou 4 | Dashboard operacional mestre do G300: orquestrador das abas de saldo físico, confronto A501/G501, inventário das ruas e relatórios. |
| `src/app/g300/processos/page.tsx` | G300 Proc | 3 ou 4 | Página de processos internos e movimentações operacionais do G300. |
| `src/components/g300/index.ts` | G300 Core | 3 ou 4 | Ponto de exportação unificado (barrel) de todos os componentes, abas e modais do G300. |
| `src/components/g300/DriveInGrid.tsx` | G300 UI | 3 ou 4 | Visualizador e editor interativo em grade da estrutura Drive-in com túneis, níveis, profundidades e unificação de paletes MIX. |
| `src/components/g300/WarehouseTable.tsx` | G300 UI | 3 ou 4 | Tabela analítica de posições, SKUs, saldos, status de avarias e paginação rápida. |
| `src/components/g300/AddPalletModal.tsx` | G300 UI | 3 ou 4 | Modal de inserção e alocação de novos paletes em posições do armazém. |
| `src/components/g300/MetricCard.tsx` | G300 UI | 3 ou 4 | Cartão de métrica com indicadores numéricos, tendências e badges de status. |
| `src/components/g300/OriginDonutChart.tsx` | G300 UI | 3 ou 4 | Gráfico tipo rosca para distribuição de origens de avarias (Logística, Fábrica, Transporte). |
| `src/components/g300/RegistrosTab.tsx` | G300 Aba | 3 ou 4 | Histórico e auditoria de registros de avarias, ajustes manuais e movimentações. |
| `src/components/g300/RetrabalhosTab.tsx`| G300 Aba | 3 ou 4 | Gestão de itens em retrabalho técnico, baixas e devoluções para linha. |
| `src/components/g300/RelatorioRecebimentoTab.tsx` | G300 Aba | 3 ou 4 | Relatório de recebimento de cargas, conferência cega e divergências. |
| `src/components/g300/EmbalagensTab.tsx`| G300 Aba | 3 ou 4 | Controle de saldos de embalagens vazias, requisições e reposição de caixas. |
| `src/components/g300/EstoqueBATab.tsx` | G300 Aba | 3 ou 4 | Aba independente de controle e conciliação do estoque BA30001V9601 com busca e KPIs. |
| `src/components/g300/ProdutosTab.tsx` | G300 Aba | 3 ou 4 | Aba independente de visão analítica de produtos e filtro específico de molhados. |
| `src/components/g300/ConfrontosTab.tsx` | G300 Aba | 3 ou 4 | Aba modular de conciliação analítica entre Físico x A501 e A501 x G501, ajustes e importações. |

---

### 3.4. Módulo MKBR (Operação Linha BR, Paletes e Controle PK)

| Arquivo | Sistema | Nível | Responsabilidade / Funções |
| :--- | :--- | :---: | :--- |
| `src/app/mkbr/page.tsx` | MKBR Hub | 3 ou 4 | Hub central de operações da Linha BR com links para Avarias, Controle PK e Processos. |
| `src/app/br/page.tsx` | MKBR Core | 3 ou 4 | Aplicação completa da Linha BR com gestão de formação de paletes, paletes formados e tipos de avaria. |
| `src/app/mkbr/controle-pk/page.tsx` | MKBR PK | 3 ou 4 | Portal do módulo de Controle de Picking (PK) da operação BR. |
| `src/components/br/FormacaoPaletesTab.tsx` | MKBR Aba | 3 ou 4 | Interface de montagem e formação de paletes por operadores na linha. |
| `src/components/br/PaletesFormadosTab.tsx` | MKBR Aba | 3 ou 4 | Consulta e conferência de paletes já finalizados prontos para expedição ou armazenagem. |
| `src/components/br/DashboardTab.tsx` | MKBR Aba | 3 ou 4 | Visão estatística de produtividade da linha BR (paletes/hora, avarias registradas). |
| `src/components/br/AvariaTiposManager.tsx` | MKBR Config | 3 | Modal de cadastro e parametrização dos tipos de avaria específicos da Linha BR. |
| `src/components/controle-pk/ControlePKDashboard.tsx` | MKBR PK | 3 ou 4 | Dashboard analítico de controle de picking com métricas de separação. |
| `src/components/controle-pk/ControlePKView.tsx` | MKBR PK | 3 ou 4 | Visualizador principal de registros de conferência de PK com governança IAM (controle de acesso às abas Dashboard/Tabela e proteção de edição/leitura). |
| `src/components/controle-pk/pkSpreadsheetParser.ts` | MKBR PK | 3 ou 4 | Utilitário para importação e leitura de planilhas Excel do sistema de picking. |
| `src/hooks/useAvariaTipos.ts` | MKBR Hook | 3 ou 4 | Hook para carregar e sincronizar tipos de avarias do Supabase com cache local. |

---

### 3.5. Módulo Mapeamentos (Grades, Áreas e Layouts de Armazém)

| Arquivo | Sistema | Nível | Responsabilidade / Funções |
| :--- | :--- | :---: | :--- |
| `src/app/mapeamentos/page.tsx` | Mapeamento | 3 ou 4 | Aplicação completa de mapeamento customizável do armazém: visualização gráfica de ruas, áreas de chão, filtros por setor e exportação Excel. |
| `src/components/mapeamentos/MapeamentoWarehouseMap.tsx` | Mapeamento UI | 3 ou 4 | Mapa visual 2D das ruas com baías, profundidades, paletes e status térmico de ocupação. |
| `src/components/mapeamentos/MapeamentoTable.tsx` | Mapeamento UI | 3 ou 4 | Tabela consolidada com todas as posições mapeadas, itens e capacidades. |
| `src/components/mapeamentos/MapeamentoPositionPanel.tsx` | Mapeamento UI | 3 ou 4 | Painel lateral com detalhes da posição selecionada e lista de paletes alocados. |
| `src/components/mapeamentos/MapeamentoConfigModal.tsx` | Mapeamento UI | 3 | Modal de configuração estrutural do mapeamento (tema, cores, limites). |
| `src/components/mapeamentos/MapeamentoPosicaoModal.tsx` | Mapeamento UI | 3 | Modal de criação ou edição atômica de posições e capacidades. |
| `src/components/mapeamentos/MapeamentoItemModal.tsx` | Mapeamento UI | 3 | Modal para adicionar ou movimentar itens dentro das posições. |
| `src/lib/mapeamentosStorage.ts` | Mapeamento Core | 3 | Camada de persistência (Supabase + localStorage fallback) para configurações de mapa. |
| `src/lib/mapeamentoUtils.ts` | Mapeamento Core | 3 | Funções utilitárias de normalização de código de rua, baia e nível. |

---

### 3.6. Laboratório de Inovação & Motor Gráfico Universal 2D/3D

| Arquivo | Sistema | Nível | Responsabilidade / Funções |
| :--- | :--- | :---: | :--- |
| `src/app/laboratorio/page.tsx` | Lab Hub | 3 ou 4 | Ponto de entrada de experimentos do laboratório com verificação de autenticação. |
| `src/app/laboratorio/mapeamento/page.tsx` | Lab Editor | 3 ou 4 | Página em tela cheia do Editor Universal de Mapas 2D (vetorial). |
| `src/app/laboratorio/recursos/page.tsx` | Lab Recursos | 3 | Página do motor de recursos universais do laboratório. |
| `src/components/laboratorio/UniversalMapEditor.tsx` | Lab Core | 3 ou 4 | Motor gráfico principal baseado em Konva: viewport infinito, drag & drop, snap magnético, seleção múltipla e integração IAM nativa. |
| `src/components/laboratorio/SpatialHierarchyViewer.tsx`| Lab UI | 3 ou 4 | Árvore de hierarquia espacial (Prédio → Galpão → Setor → Rua → Baia → Posição). |
| `src/components/laboratorio/HierarchyConfigModal.tsx` | Lab UI | 3 | Modal de parametrização dos níveis hierárquicos do armazém. |
| `src/components/laboratorio/DimensionConfigModal.tsx` | Lab UI | 3 | Configuração de escala física (metros, milímetros, pixels). |
| `src/components/laboratorio/UniversalPropertiesPanel.tsx` | Lab UI | 3 ou 4 | Painel lateral de propriedades do objeto selecionado no editor vetorial. |
| `src/components/MapToolbar/MapToolbar.tsx` | Lab UI | 3 ou 4 | Barra de ferramentas com botões de zoom, seleção, desenho, snap e gatilho IAM. |
| `src/components/MapToolbar/UniversalSearchSpotlight.tsx` | Lab UI | 3 ou 4 | Spotlight de busca global estilo Cmd+K para localizar rapidamente qualquer posição no mapa. |

---

### 3.7. Biblioteca de Objetos e Geometria Vetorial (`src/components/MapLibrary/`)

| Arquivo | Sistema | Nível | Responsabilidade / Funções |
| :--- | :--- | :---: | :--- |
| `registry.ts` | MapLibrary | Global | Registro central de todos os tipos de elementos gráficos aceitos pelo motor. |
| `types.ts` | MapLibrary | Global | Tipos fundamentais dos elementos do mapa (dimensões, rotação, ancoragem). |
| `palletModels.ts` | MapLibrary | Global | Modelos paramétricos de paletes (PBR 1.0x1.2m, Euro 0.8x1.2m, Gaiolas, Bag). |
| `unitConverter.ts` | MapLibrary | Global | Conversão matemática entre unidades físicas (m, cm, mm) e coordenadas de tela (px). |
| `spatialContainment.ts` | MapLibrary | Global | Algoritmos de contenção espacial e colisão entre objetos do armazém. |
| `modulesTypes.ts` | MapLibrary | Global | Tipagem de módulos e blocos construtivos. |
| `elements/storage.ts` | MapLibrary | Global | Definições gráficas de Porta-Paletes, Drive-in, Cantilever e Mezaninos. |
| `elements/architectural.ts` | MapLibrary | Global | Paredes, colunas, portões seccionais, docas e demarcações de piso. |
| `elements/equipment.ts` | MapLibrary | Global | Empilhadeiras, transpaleteiras, AGVs e esteiras transportadoras. |
| `elements/orientation.ts` | MapLibrary | Global | Rosa dos ventos, réguas de escala, setas de fluxo de tráfego e sinalizações. |

---

### 3.8. Universal Resources & Systems Engine (`src/components/Resources/` & `src/components/Systems/`)

| Arquivo | Sistema | Nível | Responsabilidade / Funções |
| :--- | :--- | :---: | :--- |
| `src/components/Resources/types.ts` | Resources | 2 ou 3 | Tipos de recursos materiais, equipamentos e ativos vinculados a posições. |
| `src/components/Resources/useResourceStore.ts` | Resources | 2 ou 3 | Store Zustand/React para gestão de instâncias de recursos materiais. |
| `src/components/Resources/resourceRegistry.ts` | Resources | 2 ou 3 | Registro e categorização de recursos físicos do armazém. |
| `src/components/Resources/ResourceLocationLinker.tsx`| Resources | 3 | Modal de vinculação física de recursos a posições de mapa. |
| `src/components/Resources/ResourceEngineModal.tsx` | Resources | 3 | Painel de controle do motor de recursos. |
| `src/components/Resources/baseCodigosService.ts` | Resources | 3 | Serviço de importação e sincronização com a tabela `base_codigos`. |
| `src/components/Systems/types.ts` | Systems | 2 ou 3 | Tipos de sistemas universais, nós de estoque e balanços de entrada/saída. |
| `src/components/Systems/systemRegistry.ts` | Systems | 2 ou 3 | Registro central de sistemas de armazém conectados. |
| `src/components/Systems/useSystemStore.ts` | Systems | 2 ou 3 | Store de balanços de saldo em tempo real entre sistemas físicos e contábeis. |
| `src/components/Systems/SystemManagerModal.tsx` | Systems | 3 | Modal de gestão e configuração de conexões com sistemas legados (WMS/ERP). |

---

### 3.9. Camada de Infraestrutura, Sincronização e Offline (`src/lib/`)

| Arquivo | Sistema | Nível | Responsabilidade / Funções |
| :--- | :--- | :---: | :--- |
| `src/lib/supabase.ts` | Infra | Global | Cliente singleton do Supabase com credenciais e conexão ativa. |
| `src/lib/syncManager.ts` | Sync | Global | Gerenciador de conexão online/offline, fila de sincronização em segundo plano e reconexão automática. |
| `src/lib/offlineDb.ts` | Offline | Global | Camada IndexedDB (Dexie) para armazenamento local e funcionamento sem internet. |
| `src/lib/utils.ts` | Utilitários | Global | Funções auxiliares (Tailwind merge `cn`, formatadores de texto e moeda). |
| `src/components/PwaRegister.tsx` | PWA | Global | Registrador do Service Worker para suporte a Progressive Web App em tablets e coletores. |
| `src/app/api/cron/snapshot/route.ts` | API Cron | 1 ou 2 | Rota de API backend para realização de snapshots periódicos de saldo e segurança. |

---

## 🔒 4. CATÁLOGO DE PERMISSÕES E MATRIZ DE DELEGAÇÃO

| Código da Permissão | Categoria | Escopos Permitidos | Nível Mínimo Recomendado |
| :--- | :---: | :---: | :---: |
| `map.view` | Mapas | org, ws, env, mod, map | Nível 4 (Visualizador) |
| `map.create` | Mapas | org, ws | Nível 3 (Admin Workspace) |
| `map.edit` | Mapas | ws, map | Nível 4 (Editor) |
| `map.delete` | Mapas | ws, map | Nível 3 (Sujeito a teto) |
| `map.duplicate` | Mapas | ws, map | Nível 4 (Editor) |
| `map.export` | Mapas | ws, map | Nível 4 (Colaborador) |
| `map.share` | Mapas | ws, map | Nível 3 (Admin Workspace) |
| `map.manage_access` | Mapas | ws, map | Nível 3 (Admin Workspace) |
| `map.publish` | Mapas | ws, map | Nível 3 (Admin Workspace) |
| `map.archive` | Mapas | ws, map | Nível 3 (Admin Workspace) |
| `object.view` | Objetos | ws, map, object | Nível 4 (Visualizador) |
| `object.create` | Objetos | ws, map | Nível 4 (Editor) |
| `object.edit` | Objetos | ws, map, object | Nível 4 (Editor) |
| `object.delete` | Objetos | ws, map, object | Nível 4 (Editor) |
| `object.move` | Objetos | ws, map, object | Nível 4 (Editor) |
| `object.configure` | Objetos | ws, map, object | Nível 4 (Editor) |
| `structure.view` | Estrutura | ws, map | Nível 4 (Visualizador) |
| `structure.manage` | Estrutura | ws, map | Nível 3 (Admin Workspace) |
| `history.view` | Histórico | ws, map | Nível 4 (Colaborador) |
| `history.restore` | Histórico | ws, map | Nível 3 (Admin Workspace) |
| `workspace.manage_members` | Administração | ws | Nível 3 (Admin Workspace) |
| `workspace.manage_roles` | Administração | ws | Nível 3 (Admin Workspace) |
| `workspace.manage_settings` | Administração | ws | Nível 3 (Admin Workspace) |
| `workspace.manage_security` | Administração | org, ws | **Nível 1 ou 2 (Exclusivo Global)** |

---

## 🛡️ 5. REGRAS INVIOLÁVEIS DE SEGURANÇA E ARQUITETURA

1. **Soberania do Proprietário Global:** Nenhum administrador global, local ou função programática pode revogar, substituir ou limitar os poderes do Proprietário Global (`nexus_iam_platform_owners`).
2. **Teto de Delegação (Authority Ceiling):** Nenhum administrador pode atribuir um papel ou permissão cujo nível hierárquico seja superior ao seu próprio nível de autoridade efetiva.
3. **Não-escalonamento de Privilégios:** Um administrador de workspace não pode remover suas próprias restrições (`workspace_admin_constraints`) nem conceder permissões globais.
4. **Governança Unificada do Dashboard:** A barra superior de administração global (`GlobalAdminBar`) acompanha o usuário em todos os módulos e submódulos, permitindo auditoria centralizada e controle imediato.
5. **Auditoria Contínua:** Toda nomeação, alteração de permissão, concessão ou exclusão de administradores gera imediatamente um evento na tabela `nexus_iam_audit_logs`.
