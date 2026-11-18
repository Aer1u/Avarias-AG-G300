import { Role, RoleCode } from './types';

export const DEFAULT_ROLES: Role[] = [
  {
    id: 'role_owner',
    code: 'owner',
    name: 'Proprietário',
    description: 'Acesso absoluto e irrestrito a todas as funções, configurações e workspaces da plataforma.',
    is_system_role: true,
    is_active: true,
    authority_level: 1,
    permissions: [
      'map.view', 'map.create', 'map.edit', 'map.delete', 'map.duplicate', 'map.export', 'map.share', 'map.manage_access', 'map.publish', 'map.archive',
      'object.view', 'object.create', 'object.edit', 'object.delete', 'object.move', 'object.configure',
      'structure.view', 'structure.manage',
      'history.view', 'history.restore',
      'workspace.manage_members', 'workspace.manage_roles', 'workspace.manage_settings', 'workspace.manage_security',
      'module.manage_access', 'environment.manage_access',
      'pk.dashboard.view', 'pk.table.view', 'pk.record.manage',
      'g300.drivein.view', 'g300.estoque_ba.view', 'g300.confrontos.view', 'g300.produtos.view', 'g300.registros.view', 'g300.retrabalhos.view', 'g300.embalagens.view', 'g300.relatorios.view', 'g300.inventory.manage',
      'br.formacao_paletes.view', 'br.paletes_formados.view', 'br.dashboard.view', 'br.paletes.manage'
    ]
  },
  {
    id: 'role_admin',
    code: 'admin',
    name: 'Administrador de Workspace',
    description: 'Gestão completa do workspace local, membros, papéis, layouts e publicações conforme limites delegados.',
    is_system_role: true,
    is_active: true,
    authority_level: 3,
    permissions: [
      'map.view', 'map.create', 'map.edit', 'map.delete', 'map.duplicate', 'map.export', 'map.share', 'map.manage_access', 'map.publish', 'map.archive',
      'object.view', 'object.create', 'object.edit', 'object.delete', 'object.move', 'object.configure',
      'structure.view', 'structure.manage',
      'history.view', 'history.restore',
      'workspace.manage_members', 'workspace.manage_roles', 'workspace.manage_settings',
      'module.manage_access', 'environment.manage_access',
      'pk.dashboard.view', 'pk.table.view', 'pk.record.manage',
      'g300.drivein.view', 'g300.estoque_ba.view', 'g300.confrontos.view', 'g300.produtos.view', 'g300.registros.view', 'g300.retrabalhos.view', 'g300.embalagens.view', 'g300.relatorios.view', 'g300.inventory.manage',
      'br.formacao_paletes.view', 'br.paletes_formados.view', 'br.dashboard.view', 'br.paletes.manage'
    ]
  },
  {
    id: 'role_gestor',
    code: 'gestor',
    name: 'Gestor Operacional',
    description: 'Supervisão tática de módulos, ambientes e aprovação de mapas industriais.',
    is_system_role: true,
    is_active: true,
    authority_level: 4,
    permissions: [
      'map.view', 'map.create', 'map.edit', 'map.duplicate', 'map.export', 'map.share', 'map.manage_access', 'map.publish',
      'object.view', 'object.create', 'object.edit', 'object.move', 'object.configure',
      'structure.view', 'structure.manage',
      'history.view'
    ]
  },
  {
    id: 'role_map_admin',
    code: 'map_admin',
    name: 'Administrador de Mapa',
    description: 'Controle total sobre o mapa específico, seus participantes e publicações.',
    is_system_role: true,
    is_active: true,
    authority_level: 4,
    permissions: [
      'map.view', 'map.edit', 'map.duplicate', 'map.export', 'map.share', 'map.manage_access', 'map.publish',
      'object.view', 'object.create', 'object.edit', 'object.delete', 'object.move', 'object.configure',
      'structure.view', 'structure.manage',
      'history.view', 'history.restore'
    ]
  },
  {
    id: 'role_editor',
    code: 'editor',
    name: 'Editor de Layout',
    description: 'Desenho e edição de posições, objetos, configurações e exportação.',
    is_system_role: true,
    is_active: true,
    authority_level: 4,
    permissions: [
      'map.view', 'map.edit', 'map.duplicate', 'map.export',
      'object.view', 'object.create', 'object.edit', 'object.move', 'object.configure',
      'structure.view',
      'history.view'
    ]
  },
  {
    id: 'role_collaborator',
    code: 'collaborator',
    name: 'Colaborador',
    description: 'Criação e movimentação de posições sem permissão de exclusão ou alteração estrutural.',
    is_system_role: true,
    is_active: true,
    authority_level: 4,
    permissions: [
      'map.view', 'map.export',
      'object.view', 'object.create', 'object.move',
      'structure.view',
      'history.view'
    ]
  },
  {
    id: 'role_viewer',
    code: 'viewer',
    name: 'Visualizador (Somente Leitura)',
    description: 'Apenas visualização do mapa e inspeção de detalhes de posições.',
    is_system_role: true,
    is_active: true,
    authority_level: 4,
    permissions: [
      'map.view',
      'object.view',
      'structure.view',
      'history.view',
      'pk.dashboard.view',
      'pk.table.view',
      'g300.drivein.view',
      'g300.estoque_ba.view',
      'g300.confrontos.view',
      'g300.produtos.view',
      'g300.registros.view',
      'g300.retrabalhos.view',
      'g300.embalagens.view',
      'g300.relatorios.view',
      'br.formacao_paletes.view',
      'br.paletes_formados.view',
      'br.dashboard.view'
    ]
  }
];

export function getDefaultRole(code: RoleCode): Role | undefined {
  return DEFAULT_ROLES.find(r => r.code === code);
}
