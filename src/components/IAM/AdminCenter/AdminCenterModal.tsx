import React, { useState } from 'react';
import { 
  Shield, 
  Crown,
  Users, 
  Key, 
  FileText, 
  Sliders, 
  History, 
  CheckCircle2, 
  XCircle, 
  X, 
  UserCheck, 
  Search, 
  Lock,
  Building,
  AlertOctagon
} from 'lucide-react';
import { useAuthz } from '../useAuthz';
import { IAMService } from '../iamService';
import { PERMISSIONS_CATALOG } from '../permissionsCatalog';
import { PermissionCode, AUTHORITY_LEVEL_LABELS, AuthorityLevel } from '../types';

interface AdminCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMapId?: string;
  currentWorkspaceId?: string;
}

export function AdminCenterModal({ 
  isOpen, 
  onClose, 
  currentMapId = 'MAP-LAB-01',
  currentWorkspaceId = 'ws_g300' 
}: AdminCenterModalProps) {
  const [activeTab, setActiveTab] = useState<'governance' | 'users' | 'roles' | 'permissions' | 'simulator' | 'audit'>('governance');
  const [searchTerm, setSearchTerm] = useState('');

  const {
    activeUser,
    allUsers,
    switchActiveUser,
    authorityLevel,
    isPlatformOwner,
    primaryRole,
    platformOwner,
    platformAdmins,
    workspaceAdmins,
    refreshAuthz
  } = useAuthz(currentMapId, currentWorkspaceId);

  const iam = IAMService.getInstance();
  const roles = iam.getRoles();
  const assignments = iam.getAssignments();
  const auditLogs = iam.getAuditLogs();

  // Estados do Simulador
  const [simUser, setSimUser] = useState(activeUser.id);
  const [simPerm, setSimPerm] = useState<PermissionCode>('map.edit');
  const [simScope, setSimScope] = useState('*');

  const isGlobalAuth = authorityLevel <= 2; // Nível 1 ou Nível 2

  // Se não for admin global ou proprietário, não pode acessar aba de governança global
  React.useEffect(() => {
    if (isOpen && !isGlobalAuth && activeTab === 'governance') {
      setActiveTab('users');
    }
  }, [isOpen, isGlobalAuth, activeTab]);

  if (!isOpen) return null;

  const allModalTabs = [
    { id: 'governance', label: '👑 Governança Global (Proprietário)', icon: Crown, requireGlobal: true },
    { id: 'users', label: '👥 Usuários & Atribuições', icon: Users, requireGlobal: false },
    { id: 'roles', label: '🏷️ Papéis (Roles)', icon: Key, requireGlobal: false },
    { id: 'permissions', label: '📋 Catálogo de Permissões', icon: FileText, requireGlobal: false },
    { id: 'simulator', label: '🧪 Simulador de Acesso', icon: Sliders, requireGlobal: false },
    { id: 'audit', label: '📜 Auditoria Global', icon: History, requireGlobal: true }
  ];

  const visibleModalTabs = allModalTabs.filter(t => !t.requireGlobal || isGlobalAuth);

  const levelInfo = AUTHORITY_LEVEL_LABELS[authorityLevel];

  const simResult = iam.evaluate({
    userId: simUser,
    permissionCode: simPerm,
    scopeType: 'workspace',
    scopeId: simScope,
    targetMapId: currentMapId,
    targetWorkspaceId: currentWorkspaceId
  });

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-3 md:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-6xl max-h-[94vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-amber-500/20 to-indigo-600/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
              <Crown size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-white tracking-tight">NEXUS IAM — Central de Governança & Autoridade</h2>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                  authorityLevel === 1 
                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' 
                    : authorityLevel === 2
                    ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                    : authorityLevel === 3
                    ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                    : 'bg-slate-700/50 text-slate-300 border-slate-600'
                }`}>
                  {levelInfo.tag}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Hierarquia Global de 4 Níveis com Controle Centralizado pelo Proprietário</p>
            </div>
          </div>

          {/* Seletor de Identidade Ativa para Teste/Simulação */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-slate-800/90 border border-slate-700/80 shadow-sm">
              <UserCheck size={14} className="text-amber-400" />
              <span className="text-[10px] uppercase font-bold text-slate-400">Atuando como:</span>
              <select
                value={activeUser.id}
                onChange={(e) => switchActiveUser(e.target.value)}
                className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer max-w-[200px] truncate"
              >
                {allUsers.map(u => (
                  <option key={u.id} value={u.id} className="bg-slate-900 text-white">
                    {u.name} (Nível {u.authorityLevel})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={onClose}
              className="h-9 w-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 px-6 gap-2 bg-slate-900/60 overflow-x-auto custom-scrollbar">
          {visibleModalTabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-3 px-3.5 border-b-2 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  isActive 
                    ? 'border-amber-500 text-amber-400 bg-amber-500/5' 
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-950/40">
          
          {/* TAB: GOVERNANÇA GLOBAL (NÍVEIS 1, 2 E 3) */}
          {activeTab === 'governance' && (
            <div className="space-y-6">
              
              {/* NÍVEL 1: PROPRIETÁRIO GLOBAL (PLATFORM OWNER) */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-950/30 via-slate-900 to-slate-900 border border-amber-500/40 shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      <Crown size={22} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-white text-sm">Nível 1 — Proprietário Global (Platform Owner)</h3>
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold font-mono border border-amber-500/30">
                          IMUTÁVEL
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">Titularidade máxima da plataforma; superior hierarquicamente a todos os administradores.</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-800 text-[10px] text-slate-300 font-mono border border-slate-700">
                    <Lock size={12} className="text-amber-400" />
                    <span>Protegido contra substituição</span>
                  </div>
                </div>

                <div className="bg-slate-950/60 p-3.5 rounded-xl border border-amber-500/20 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-500">Titular Atual</span>
                    <p className="text-sm font-bold text-white">{platformOwner?.user_name}</p>
                    <p className="text-xs font-mono text-amber-400/90">{platformOwner?.user_email}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-500">Status Institucional</span>
                    <p className="text-xs font-semibold text-emerald-400">Ativo e Vinculado ao Supabase Auth</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-500">Procedimento de Transferência</span>
                    <p className="text-xs text-slate-400">Exige protocolo formal de 2 etapas com confirmação reforçada.</p>
                  </div>
                </div>
              </div>

              {/* NÍVEL 2: ADMINISTRADORES GLOBAIS (PLATFORM ADMINS) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield size={16} className="text-indigo-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                      Nível 2 — Administradores Globais Nomeados ({platformAdmins.length})
                    </h3>
                  </div>
                  <span className="text-xs text-slate-500">Operam estritamente dentro da delegação conferida pelo proprietário</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {platformAdmins.map(admin => (
                    <div key={admin.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-white text-xs">{admin.user_name}</h4>
                          <span className="text-[10px] text-slate-400 font-mono">{admin.user_email}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 text-[10px] font-bold border border-indigo-500/30">
                          {admin.title}
                        </span>
                      </div>

                      <div className="space-y-1.5 pt-1 border-t border-slate-800/80 text-[11px]">
                        <span className="text-[10px] uppercase font-bold text-slate-500">Competências Delegadas:</span>
                        <div className="grid grid-cols-2 gap-1 font-medium text-slate-300">
                          <span className={admin.can_manage_workspaces ? 'text-emerald-400' : 'text-slate-600 line-through'}>
                            • Administrar Workspaces
                          </span>
                          <span className={admin.can_create_workspaces ? 'text-emerald-400' : 'text-slate-600 line-through'}>
                            • Criar Novos Workspaces
                          </span>
                          <span className={admin.can_manage_local_admins ? 'text-emerald-400' : 'text-slate-600 line-through'}>
                            • Gerenciar Admins Locais
                          </span>
                          <span className={admin.can_view_all_audit_logs ? 'text-emerald-400' : 'text-slate-600 line-through'}>
                            • Auditoria Geral Completa
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* NÍVEL 3: ADMINISTRADORES DE WORKSPACE & LIMITES ADMINISTRATIVOS (CONSTRAINTS) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building size={16} className="text-blue-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400">
                      Nível 3 — Administradores de Workspace & Tetos Delegatórios ({workspaceAdmins.length})
                    </h3>
                  </div>
                  <span className="text-xs text-slate-500">Administração local limitada; não pode remover suas próprias restrições</span>
                </div>

                <div className="space-y-3">
                  {workspaceAdmins.map(wsAdmin => (
                    <div key={wsAdmin.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-xs">{wsAdmin.user_name}</span>
                            <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] font-mono border border-blue-500/20">
                              Workspace: {wsAdmin.workspace_name}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">{wsAdmin.user_email}</span>
                        </div>

                        {/* Modificação de limites direta pelo Proprietário */}
                        {isPlatformOwner && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                const current = wsAdmin.constraints?.cannot_delete_maps || false;
                                iam.updateWorkspaceAdminConstraints(wsAdmin.id, {
                                  max_assignable_role_level: 4,
                                  blocked_permission_codes: current ? [] : ['workspace.manage_security'],
                                  cannot_delete_maps: !current,
                                  cannot_manage_security: true
                                });
                                refreshAuthz();
                              }}
                              className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all flex items-center gap-1.5 ${
                                wsAdmin.constraints?.cannot_delete_maps 
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30' 
                                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                              }`}
                            >
                              <AlertOctagon size={12} />
                              {wsAdmin.constraints?.cannot_delete_maps ? 'Bloqueio de Exclusão: ATIVO' : 'Permitido Excluir Mapas'}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Caixa de Restrições e Teto */}
                      <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-[11px]">
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-500 block">Teto de Autoridade de Delegação</span>
                          <span className="font-semibold text-slate-200">
                            Nível Máximo Concedível: {wsAdmin.constraints?.max_assignable_role_level || 4} (Apenas Operacional)
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-500 block">Permissões Vetadas pelo Proprietário</span>
                          <span className="font-mono text-rose-400 text-[10px]">
                            {wsAdmin.constraints?.cannot_manage_security ? 'workspace.manage_security (VETADO)' : 'Nenhum veto'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-500 block">Regra de Escalamento</span>
                          <span className="text-slate-400">Impossibilitado de ampliar poderes próprios.</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: USUÁRIOS & ATRIBUIÇÕES */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-sm">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Filtrar membros..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
                  />
                </div>
                <span className="text-xs text-slate-400 font-medium">
                  {allUsers.length} membros registrados
                </span>
              </div>

              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-900/60">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 text-[10px] uppercase font-bold tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Usuário</th>
                      <th className="py-3 px-4">Nível de Autoridade</th>
                      <th className="py-3 px-4">Papel Atribuído</th>
                      <th className="py-3 px-4">Escopo</th>
                      <th className="py-3 px-4 text-right">Simular</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {allUsers
                      .filter(u => u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase()))
                      .map(user => {
                        const userAsg = assignments.find(a => a.user_id === user.id && a.status === 'active');
                        const role = userAsg ? roles.find(r => r.id === userAsg.role_id) : null;
                        const isCurrent = user.id === activeUser.id;
                        const uLevel = iam.getUserAuthorityLevel(user.id, currentWorkspaceId);

                        return (
                          <tr key={user.id} className={`hover:bg-slate-800/40 transition-colors ${isCurrent ? 'bg-amber-950/15' : ''}`}>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                <div className="h-7 w-7 rounded-full bg-slate-800 flex items-center justify-center font-bold text-[10px] text-amber-400 border border-slate-700">
                                  {user.name.substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-semibold text-white flex items-center gap-1.5">
                                    {user.name}
                                    {isCurrent && (
                                      <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[9px] rounded font-mono">
                                        VOCÊ
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-400">{user.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                uLevel === 1 
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                                  : uLevel === 2
                                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                  : uLevel === 3
                                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                  : 'bg-slate-800 text-slate-400'
                              }`}>
                                Nível {uLevel}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <select
                                value={role?.id || ''}
                                disabled={uLevel === 1 && !isPlatformOwner}
                                onChange={(e) => {
                                  try {
                                    iam.assignRole(user.id, e.target.value, 'workspace', '*', user.email, user.name, activeUser.id);
                                    refreshAuthz();
                                  } catch (err: any) {
                                    alert(err.message);
                                  }
                                }}
                                className="bg-slate-800 border border-slate-700 text-xs text-white rounded-lg px-2.5 py-1.5 outline-none font-medium cursor-pointer disabled:opacity-50"
                              >
                                {roles.map(r => (
                                  <option key={r.id} value={r.id}>{r.name} (Nível {r.authority_level})</option>
                                ))}
                              </select>
                            </td>
                            <td className="py-3 px-4 font-mono text-[10px] text-slate-300">
                              {userAsg?.scope_type || 'workspace'} ({userAsg?.scope_id || '*'})
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => switchActiveUser(user.id)}
                                className="px-2.5 py-1 rounded-lg bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white text-[10px] font-semibold uppercase tracking-wider transition-all"
                              >
                                Atuar Como
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: PAPÉIS (ROLES) */}
          {activeTab === 'roles' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {roles.map(role => (
                <div key={role.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Key size={14} className="text-amber-400" />
                        <h4 className="font-bold text-white text-sm">{role.name}</h4>
                      </div>
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700">
                        Nível {role.authority_level}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mb-3 leading-relaxed">{role.description}</p>
                  </div>

                  <div>
                    <div className="text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-1.5">
                      Permissões Atribuídas ({role.permissions.length}):
                    </div>
                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto custom-scrollbar">
                      {role.permissions.map(perm => (
                        <span key={perm} className="px-2 py-0.5 rounded-md bg-slate-800 text-indigo-300 font-mono text-[10px] border border-slate-700/60">
                          {perm}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 4: CATÁLOGO DE PERMISSÕES */}
          {activeTab === 'permissions' && (
            <div className="space-y-6">
              {['Mapas', 'Objetos', 'Estrutura', 'Histórico', 'Administração'].map(category => {
                const perms = PERMISSIONS_CATALOG.filter(p => p.category === category);
                return (
                  <div key={category} className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      {category} ({perms.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {perms.map(p => (
                        <div key={p.code} className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start gap-3">
                          <div className="p-1.5 rounded-lg bg-slate-800 text-slate-400 mt-0.5">
                            <FileText size={13} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-white text-xs">{p.name}</span>
                              <span className="font-mono text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                                {p.code}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{p.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 5: SIMULADOR DE ACESSO */}
          {activeTab === 'simulator' && (
            <div className="max-w-2xl mx-auto space-y-5">
              <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/30">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-1 flex items-center gap-2">
                  <Sliders size={14} /> Simulador Determinístico de Decisão & Tetos de Autoridade
                </h4>
                <p className="text-xs text-slate-300">
                  Avalia a decisão do motor considerando a autoridade soberana do proprietário, delegações globais, tetos de administrador local e permissões granulares.
                </p>
              </div>

              <div className="space-y-3 bg-slate-900 p-5 rounded-2xl border border-slate-800">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Usuário Testado</label>
                  <select
                    value={simUser}
                    onChange={e => setSimUser(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-xs text-white rounded-xl p-2.5 outline-none font-medium"
                  >
                    {allUsers.map(u => (
                      <option key={u.id} value={u.id}>{u.name} (Nível {u.authorityLevel})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Permissão Solicitada</label>
                  <select
                    value={simPerm}
                    onChange={e => setSimPerm(e.target.value as PermissionCode)}
                    className="w-full bg-slate-800 border border-slate-700 text-xs text-white rounded-xl p-2.5 outline-none font-medium"
                  >
                    {PERMISSIONS_CATALOG.map(p => (
                      <option key={p.code} value={p.code}>{p.code} — {p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">ID do Recurso / Escopo</label>
                  <input
                    type="text"
                    value={simScope}
                    onChange={e => setSimScope(e.target.value)}
                    placeholder="* ou MAP-001"
                    className="w-full bg-slate-800 border border-slate-700 text-xs text-white rounded-xl p-2.5 outline-none font-mono"
                  />
                </div>
              </div>

              {/* Resultado da Avaliação */}
              <div className={`p-4 rounded-2xl border flex items-start gap-3.5 ${
                simResult.allowed 
                  ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300' 
                  : 'bg-rose-950/20 border-rose-500/30 text-rose-300'
              }`}>
                {simResult.allowed ? (
                  <CheckCircle2 size={24} className="text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <XCircle size={24} className="text-rose-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold text-sm uppercase tracking-wide">
                    {simResult.allowed ? 'Acesso Concedido (ALLOW)' : 'Acesso Negado (DENY)'}
                  </div>
                  <div className="text-xs mt-1 leading-relaxed opacity-90">{simResult.reason}</div>
                  <div className="mt-2 flex gap-2 text-[10px] font-mono">
                    <span className="px-2 py-0.5 rounded bg-slate-900/60 border border-white/10">
                      Regra: {simResult.evaluatedRule}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-900/60 border border-white/10 text-amber-300">
                      Nível Efetivo: {simResult.effectiveAuthorityLevel}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: AUDITORIA */}
          {activeTab === 'audit' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Trilha de auditoria das ações administrativas</span>
                <span className="text-[10px] font-mono text-slate-500">{auditLogs.length} eventos gravados</span>
              </div>

              {auditLogs.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  Nenhum evento registrado ainda.
                </div>
              ) : (
                <div className="space-y-2">
                  {auditLogs.map(log => (
                    <div key={log.id} className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <span className="h-2 w-2 rounded-full bg-amber-500" />
                        <div>
                          <div className="font-bold text-white font-mono">{log.action}</div>
                          <div className="text-[10px] text-slate-400">
                            Recurso: {log.resource_type} ({log.resource_id})
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-medium text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                          {log.result}
                        </span>
                        <div className="text-[9px] text-slate-500 mt-1 font-mono">
                          {new Date(log.created_at).toLocaleTimeString('pt-BR')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <span className="text-[10px] uppercase font-bold text-slate-500">Autoridade Efetiva na Sessão:</span>
            <span className="font-bold text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
              {levelInfo.name}
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold transition-colors"
          >
            Concluir
          </button>
        </div>

      </div>
    </div>
  );
}
