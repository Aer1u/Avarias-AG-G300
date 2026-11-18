import { Permission, PermissionCode } from './types';

export const PERMISSIONS_CATALOG: Permission[] = [
  // --- MAPAS ---
  {
    id: 'perm_map_view',
    code: 'map.view',
    category: 'Mapas',
    name: 'Visualizar Mapa',
    description: 'Permite visualizar layout, posições e status dos mapas.',
    allowed_scopes: ['workspace', 'module', 'map']
  },
  {
    id: 'perm_map_create',
    code: 'map.create',
    category: 'Mapas',
    name: 'Criar Mapa',
    description: 'Permite criar novos mapas e layouts industriais.',
    allowed_scopes: ['workspace', 'module']
  },
  {
    id: 'perm_map_edit',
    code: 'map.edit',
    category: 'Mapas',
    name: 'Editar Mapa',
    description: 'Permite modificar objetos, dimensões e configurações do mapa.',
    allowed_scopes: ['workspace', 'module', 'map']
  },
  {
    id: 'perm_map_delete',
    code: 'map.delete',
    category: 'Mapas',
    name: 'Excluir Mapa',
    description: 'Permite remover mapas definitivamente.',
    allowed_scopes: ['workspace', 'module', 'map']
  },
  {
    id: 'perm_map_duplicate',
    code: 'map.duplicate',
    category: 'Mapas',
    name: 'Duplicar Mapa',
    description: 'Permite clonar mapas e seus objetos para novos layouts.',
    allowed_scopes: ['workspace', 'module', 'map']
  },
  {
    id: 'perm_map_export',
    code: 'map.export',
    category: 'Mapas',
    name: 'Exportar Mapa',
    description: 'Permite exportar mapas em formatos PDF, Imagem ou JSON.',
    allowed_scopes: ['workspace', 'module', 'map']
  },
  {
    id: 'perm_map_share',
    code: 'map.share',
    category: 'Mapas',
    name: 'Compartilhar Mapa',
    description: 'Permite compartilhar o mapa com outros usuários e grupos.',
    allowed_scopes: ['workspace', 'module', 'map']
  },
  {
    id: 'perm_map_manage_access',
    code: 'map.manage_access',
    category: 'Mapas',
    name: 'Gerenciar Acesso do Mapa',
    description: 'Permite configurar permissões de participantes no mapa.',
    allowed_scopes: ['workspace', 'module', 'map']
  },
  {
    id: 'perm_map_publish',
    code: 'map.publish',
    category: 'Mapas',
    name: 'Publicar Mapa',
    description: 'Permite publicar alterações para o ambiente operacional.',
    allowed_scopes: ['workspace', 'module', 'map']
  },
  {
    id: 'perm_map_archive',
    code: 'map.archive',
    category: 'Mapas',
    name: 'Arquivar Mapa',
    description: 'Permite arquivar mapas inativos preservando histórico.',
    allowed_scopes: ['workspace', 'module', 'map']
  },

  // --- OBJETOS ---
  {
    id: 'perm_object_view',
    code: 'object.view',
    category: 'Objetos',
    name: 'Visualizar Objeto',
    description: 'Permite ver detalhes de posições, drives e racks.',
    allowed_scopes: ['workspace', 'map', 'object']
  },
  {
    id: 'perm_object_create',
    code: 'object.create',
    category: 'Objetos',
    name: 'Criar Objeto',
    description: 'Permite desenhar novas posições e estruturas no mapa.',
    allowed_scopes: ['workspace', 'map']
  },
  {
    id: 'perm_object_edit',
    code: 'object.edit',
    category: 'Objetos',
    name: 'Editar Objeto',
    description: 'Permite alterar propriedades, rótulos e dimensões.',
    allowed_scopes: ['workspace', 'map', 'object']
  },
  {
    id: 'perm_object_delete',
    code: 'object.delete',
    category: 'Objetos',
    name: 'Excluir Objeto',
    description: 'Permite remover posições e objetos do mapa.',
    allowed_scopes: ['workspace', 'map', 'object']
  },
  {
    id: 'perm_object_move',
    code: 'object.move',
    category: 'Objetos',
    name: 'Mover Objeto',
    description: 'Permite reposicionar objetos no grid.',
    allowed_scopes: ['workspace', 'map', 'object']
  },
  {
    id: 'perm_object_configure',
    code: 'object.configure',
    category: 'Objetos',
    name: 'Configurar Objeto',
    description: 'Permite configurar níveis, capacidade e vínculo com sistemas de saldo.',
    allowed_scopes: ['workspace', 'map', 'object']
  },

  // --- ESTRUTURA ---
  {
    id: 'perm_structure_view',
    code: 'structure.view',
    category: 'Estrutura',
    name: 'Visualizar Estrutura',
    description: 'Permite visualizar paredes, pilares, zonas e acessos.',
    allowed_scopes: ['workspace', 'map']
  },
  {
    id: 'perm_structure_manage',
    code: 'structure.manage',
    category: 'Estrutura',
    name: 'Gerenciar Estrutura',
    description: 'Permite desenhar e alterar paredes, pilares e zonas físicas.',
    allowed_scopes: ['workspace', 'map']
  },

  // --- HISTÓRICO ---
  {
    id: 'perm_history_view',
    code: 'history.view',
    category: 'Histórico',
    name: 'Visualizar Histórico',
    description: 'Permite consultar logs e versões anteriores do mapa.',
    allowed_scopes: ['workspace', 'map']
  },
  {
    id: 'perm_history_restore',
    code: 'history.restore',
    category: 'Histórico',
    name: 'Restaurar Versão',
    description: 'Permite reverter o mapa para um estado anterior.',
    allowed_scopes: ['workspace', 'map']
  },

  // --- ADMINISTRAÇÃO ---
  {
    id: 'perm_ws_members',
    code: 'workspace.manage_members',
    category: 'Administração',
    name: 'Gerenciar Membros',
    description: 'Convida, suspende e gerencia usuários da organização.',
    allowed_scopes: ['workspace']
  },
  {
    id: 'perm_ws_roles',
    code: 'workspace.manage_roles',
    category: 'Administração',
    name: 'Gerenciar Papéis',
    description: 'Cria e customiza papéis e matrizes de permissão.',
    allowed_scopes: ['workspace']
  },
  {
    id: 'perm_ws_settings',
    code: 'workspace.manage_settings',
    category: 'Administração',
    name: 'Configurações do Workspace',
    description: 'Altera parâmetros globais da organização.',
    allowed_scopes: ['workspace']
  },
  {
    id: 'perm_ws_security',
    code: 'workspace.manage_security',
    category: 'Administração',
    name: 'Segurança & Auditoria',
    description: 'Acessa logs de auditoria e auditoria de segurança.',
    allowed_scopes: ['workspace']
  },
  {
    id: 'perm_mod_access',
    code: 'module.manage_access',
    category: 'Administração',
    name: 'Gerenciar Módulos',
    description: 'Habilita e restringe acesso a módulos do NEXUS.',
    allowed_scopes: ['workspace', 'module']
  },
  {
    id: 'perm_env_access',
    code: 'environment.manage_access',
    category: 'Administração',
    name: 'Gerenciar Ambientes',
    description: 'Controla acesso a ambientes como Produção e Laboratório.',
    allowed_scopes: ['workspace', 'environment']
  },

  // --- CONTROLE PK (MKBR) ---
  {
    id: 'perm_pk_dashboard_view',
    code: 'pk.dashboard.view',
    category: 'Controle PK',
    name: 'Visualizar Dashboard PK',
    description: 'Acesso à aba de indicadores consolidados, tempos e métricas do picking.',
    allowed_scopes: ['workspace', 'module']
  },
  {
    id: 'perm_pk_table_view',
    code: 'pk.table.view',
    category: 'Controle PK',
    name: 'Visualizar Tabela PK',
    description: 'Acesso à aba de listagem analítica e histórico de avisos PK.',
    allowed_scopes: ['workspace', 'module']
  },
  {
    id: 'perm_pk_record_manage',
    code: 'pk.record.manage',
    category: 'Controle PK',
    name: 'Gerenciar e Editar PKs',
    description: 'Permissão para criar avisos, importar planilhas, editar horários e excluir.',
    allowed_scopes: ['workspace', 'module']
  },

  // --- G300 ESTOQUE & AVARIAS ---
  {
    id: 'perm_g300_drivein_view',
    code: 'g300.drivein.view',
    category: 'G300 Estoque & Avarias',
    name: 'Visualizar Grade Drive-In & Ruas',
    description: 'Visualização da grade de túneis, posições e paletes no armazém.',
    allowed_scopes: ['workspace', 'module']
  },
  {
    id: 'perm_g300_estoque_ba_view',
    code: 'g300.estoque_ba.view',
    category: 'G300 Estoque & Avarias',
    name: 'Visualizar Estoque BA30001V9601',
    description: 'Acesso à aba de estoque e conciliação BA.',
    allowed_scopes: ['workspace', 'module']
  },
  {
    id: 'perm_g300_confrontos_view',
    code: 'g300.confrontos.view',
    category: 'G300 Estoque & Avarias',
    name: 'Visualizar Confrontos',
    description: 'Acesso à conciliação entre saldo físico, A501 e G501.',
    allowed_scopes: ['workspace', 'module']
  },
  {
    id: 'perm_g300_produtos_view',
    code: 'g300.produtos.view',
    category: 'G300 Estoque & Avarias',
    name: 'Visualizar Aba Produtos & Molhados',
    description: 'Consulta de saldos de produtos e itens molhados no armazém.',
    allowed_scopes: ['workspace', 'module']
  },
  {
    id: 'perm_g300_registros_view',
    code: 'g300.registros.view',
    category: 'G300 Estoque & Avarias',
    name: 'Visualizar Auditoria & Registros',
    description: 'Consulta do log de alterações, histórico e movimentações G300.',
    allowed_scopes: ['workspace', 'module']
  },
  {
    id: 'perm_g300_retrabalhos_view',
    code: 'g300.retrabalhos.view',
    category: 'G300 Estoque & Avarias',
    name: 'Visualizar Aba Retrabalhos',
    description: 'Gestão de peças em análise técnica e retrabalho.',
    allowed_scopes: ['workspace', 'module']
  },
  {
    id: 'perm_g300_embalagens_view',
    code: 'g300.embalagens.view',
    category: 'G300 Estoque & Avarias',
    name: 'Visualizar Aba Embalagens',
    description: 'Controle de caixas, reposição e embalagens vazias.',
    allowed_scopes: ['workspace', 'module']
  },
  {
    id: 'perm_g300_relatorios_view',
    code: 'g300.relatorios.view',
    category: 'G300 Estoque & Avarias',
    name: 'Visualizar Relatórios de Recebimento',
    description: 'Conferência de cargas e relatórios analíticos de recebimento.',
    allowed_scopes: ['workspace', 'module']
  },
  {
    id: 'perm_g300_inventory_manage',
    code: 'g300.inventory.manage',
    category: 'G300 Estoque & Avarias',
    name: 'Editar Saldos & Alocar Paletes',
    description: 'Inserir novos paletes, transferir posições e realizar ajustes manuais.',
    allowed_scopes: ['workspace', 'module']
  },

  // --- LINHA BR ---
  {
    id: 'perm_br_formacao_paletes_view',
    code: 'br.formacao_paletes.view',
    category: 'Linha BR',
    name: 'Visualizar Formação de Paletes',
    description: 'Acesso à interface operacional de formação de paletes na Linha BR.',
    allowed_scopes: ['workspace', 'module']
  },
  {
    id: 'perm_br_paletes_formados_view',
    code: 'br.paletes_formados.view',
    category: 'Linha BR',
    name: 'Visualizar Paletes Formados',
    description: 'Consulta de paletes finalizados aguardando movimentação.',
    allowed_scopes: ['workspace', 'module']
  },
  {
    id: 'perm_br_dashboard_view',
    code: 'br.dashboard.view',
    category: 'Linha BR',
    name: 'Visualizar Dashboard Linha BR',
    description: 'Painel com métricas de paletes/hora e avarias na Linha BR.',
    allowed_scopes: ['workspace', 'module']
  },
  {
    id: 'perm_br_paletes_manage',
    code: 'br.paletes.manage',
    category: 'Linha BR',
    name: 'Gerenciar Paletes e Avarias BR',
    description: 'Criação e finalização de paletes e parametrização de avarias.',
    allowed_scopes: ['workspace', 'module']
  }
];

export function getPermissionByCode(code: PermissionCode): Permission | undefined {
  return PERMISSIONS_CATALOG.find(p => p.code === code);
}
