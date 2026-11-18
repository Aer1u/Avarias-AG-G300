"use client"

import React, { useState, useEffect } from 'react';
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
  UserCheck, 
  Search, 
  Lock,
  Building,
  AlertOctagon,
  ArrowLeft,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  ExternalLink
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthz } from '@/components/IAM/useAuthz';
import { IAMService } from '@/components/IAM/iamService';
import { PERMISSIONS_CATALOG } from '@/components/IAM/permissionsCatalog';
import { PermissionCode, AUTHORITY_LEVEL_LABELS, AuthorityLevel } from '@/components/IAM/types';
import { supabase } from '@/lib/supabase';
import { GlobalAdminBar } from '@/components/IAM/GlobalAdminBar';

export default function IAMConsolePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'governance' | 'workspaces' | 'users' | 'roles' | 'permissions' | 'simulator' | 'audit'>('governance');
  const [searchTerm, setSearchTerm] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminTitle, setNewAdminTitle] = useState('');
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);

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
  } = useAuthz('MAP-LAB-01', 'ws_g300');

  const iam = IAMService.getInstance();
  const roles = iam.getRoles();
  const assignments = iam.getAssignments();
  const auditLogs = iam.getAuditLogs();

  // Estados do Simulador
  const [simUser, setSimUser] = useState(activeUser.id);
  const [simPerm, setSimPerm] = useState<PermissionCode>('map.edit');
  const [simScope, setSimScope] = useState('*');

  // Detecta sessão real do Supabase Auth e conecta automaticamente
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        const email = session.user.email.toLowerCase();
        // Se for o e-mail de administrador cadastrado
        if (email === 'profissionaltrgm@gmail.com') {
          const trgmUser = allUsers.find(u => u.email.toLowerCase() === email);
          if (trgmUser) {
            switchActiveUser(trgmUser.id);
          }
        }
      }
    });
  }, [allUsers, switchActiveUser]);

  const isGlobalAuth = authorityLevel <= 2; // Nível 1 (Proprietário) ou Nível 2 (Administrador Global)

  // Se o usuário não for do nível global, restringe a visão exclusivamente aos Workspaces
  useEffect(() => {
    if (!isGlobalAuth && activeTab !== 'workspaces') {
      setActiveTab('workspaces');
    }
  }, [isGlobalAuth, activeTab]);

  const allTabs = [
    { id: 'governance', label: '👑 Governança Global', icon: Crown, count: `${platformAdmins.length + 1} admins`, requireGlobal: true },
    { id: 'workspaces', label: '🏢 Meus Workspaces', icon: Building, count: `${workspaceAdmins.length} ativos`, requireGlobal: false },
    { id: 'users', label: '👥 Usuários & Atribuições', icon: Users, count: `${allUsers.length}`, requireGlobal: true },
    { id: 'roles', label: '🏷️ Papéis (Roles)', icon: Key, count: `${roles.length}`, requireGlobal: true },
    { id: 'permissions', label: '📋 Catálogo de Permissões', icon: FileText, count: '24', requireGlobal: true },
    { id: 'simulator', label: '🧪 Simulador de Acesso', icon: Sliders, count: 'Live', requireGlobal: true },
    { id: 'audit', label: '📜 Auditoria Global', icon: History, count: `${auditLogs.length}`, requireGlobal: true }
  ];

  const availableTabs = allTabs.filter(t => !t.requireGlobal || isGlobalAuth);

  const levelInfo = AUTHORITY_LEVEL_LABELS[authorityLevel];

  const simResult = iam.evaluate({
    userId: simUser,
    permissionCode: simPerm,
    scopeType: 'workspace',
    scopeId: simScope,
    targetMapId: 'MAP-LAB-01',
    targetWorkspaceId: 'ws_g300'
  });

  // Adicionar novo Administrador Global
  const handleAddPlatformAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail.trim()) return;

    iam.appointPlatformAdmin({
      user_id: `usr_${Date.now()}`,
      user_name: newAdminTitle || newAdminEmail.split('@')[0],
      user_email: newAdminEmail.trim(),
      title: newAdminTitle || 'Administrador Global Delegado',
      status: 'active',
      can_manage_workspaces: true,
      can_create_workspaces: true,
      can_manage_local_admins: true,
      can_view_all_audit_logs: true,
      can_manage_global_policies: true,
      delegation_ceiling_level: 3,
      appointed_by: activeUser.id
    });

    setNewAdminEmail('');
    setNewAdminTitle('');
    setShowAddAdminModal(false);
    refreshAuthz();
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col">

      {/* IAM – oculto por padrão; ativar com Ctrl+Shift+D */}
      <GlobalAdminBar currentWorkspaceId="ws_global" />

      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md px-6 py-3.5 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all text-xs font-semibold"
          >
            <ArrowLeft size={14} />
            Início
          </button>
          
          <div className="h-5 w-px bg-slate-800" />

          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-500/20 to-indigo-600/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Crown size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-white tracking-tight">NEXUS IAM — Console Central de Governança</h1>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
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
              <p className="text-[11px] text-slate-400">Hierarquia de Autoridade, Tetos Administrativos e Matriz RBAC</p>
            </div>
          </div>
        </div>

        {/* Identidade Ativa & Alternador */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-slate-800/80 border border-slate-700/70 shadow-sm">
            <UserCheck size={14} className="text-amber-400" />
            <span className="text-[10px] uppercase font-bold text-slate-400">Identidade na Sessão:</span>
            <select
              value={activeUser.id}
              onChange={(e) => switchActiveUser(e.target.value)}
              className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer max-w-[220px] truncate"
            >
              {allUsers.map(u => (
                <option key={u.id} value={u.id} className="bg-slate-900 text-white">
                  {u.name} (Nível {u.authorityLevel})
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex flex-col md:flex-row max-w-7xl w-full mx-auto p-4 md:p-6 gap-6">
        
        {/* Navigation Sidebar */}
        <aside className="w-full md:w-64 flex flex-col gap-1.5 shrink-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-3 py-1">
            Módulos de Governança
          </div>

          {availableTabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive 
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-sm' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon size={16} />
                  <span>{tab.label}</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                  {tab.count}
                </span>
              </button>
            );
          })}

          <div className="mt-auto p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 text-xs space-y-2">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Autoridade Vigente:</span>
            <p className="font-bold text-white text-xs leading-tight">{levelInfo.name}</p>
            <p className="text-[11px] text-slate-400 leading-snug">{levelInfo.description}</p>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 overflow-y-auto custom-scrollbar">
          
          {/* TAB 1: GOVERNANÇA GLOBAL */}
          {activeTab === 'governance' && (
            <div className="space-y-6">
              
              {/* NÍVEL 1: PLATFORM OWNER */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border border-amber-500/40 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      <Crown size={24} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="font-bold text-white text-sm">Nível 1 — Proprietário Global (Platform Owner)</h2>
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold font-mono border border-amber-500/30">
                          SOBERANO
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">Poder de comando e supervisão irrestrito sobre todos os workspaces e administradores.</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-800 text-[10px] text-slate-300 font-mono border border-slate-700">
                    <Lock size={12} className="text-amber-400" />
                    <span>Imutável por terceiros</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-950/60 p-4 rounded-xl border border-amber-500/20">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-500 block">Titular da Plataforma</span>
                    <p className="font-bold text-white text-sm">{platformOwner?.user_name}</p>
                    <p className="text-xs font-mono text-amber-400/90">{platformOwner?.user_email}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-500 block">Supabase Auth UUID</span>
                    <p className="font-mono text-[11px] text-slate-300 truncate">{platformOwner?.user_id}</p>
                    <span className="text-[10px] text-emerald-400 font-semibold">● Vinculado & Ativo</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-500 block">Controle Institucional</span>
                    <p className="text-xs text-slate-400">Cria workspaces, nomeia e suspende administradores, audita operações em tempo real.</p>
                  </div>
                </div>
              </div>

              {/* NÍVEL 2: ADMINISTRADORES GLOBAIS */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield size={16} className="text-indigo-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                      Nível 2 — Administradores Globais Nomeados ({platformAdmins.length})
                    </h3>
                  </div>

                  {isPlatformOwner && (
                    <button
                      onClick={() => setShowAddAdminModal(true)}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
                    >
                      <Plus size={14} /> Nomear Administrador Global
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {platformAdmins.map(admin => (
                    <div key={admin.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 hover:border-indigo-500/40 transition-all">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-white text-xs">{admin.user_name}</h4>
                          <span className="text-[10px] text-slate-400 font-mono">{admin.user_email}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 text-[10px] font-bold border border-indigo-500/30">
                          {admin.title}
                        </span>
                      </div>

                      <div className="space-y-1.5 pt-2 border-t border-slate-800/80 text-[11px]">
                        <span className="text-[10px] uppercase font-bold text-slate-500">Competências Delegadas pelo Proprietário:</span>
                        <div className="grid grid-cols-2 gap-1.5 font-medium text-slate-300">
                          <span className={admin.can_manage_workspaces ? 'text-emerald-400' : 'text-slate-600 line-through'}>
                            • Administrar Workspaces
                          </span>
                          <span className={admin.can_create_workspaces ? 'text-emerald-400' : 'text-slate-600 line-through'}>
                            • Criar Workspaces
                          </span>
                          <span className={admin.can_manage_local_admins ? 'text-emerald-400' : 'text-slate-600 line-through'}>
                            • Gerir Admins Locais
                          </span>
                          <span className={admin.can_view_all_audit_logs ? 'text-emerald-400' : 'text-slate-600 line-through'}>
                            • Auditoria Global
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* NÍVEL 3: ADMINISTRADORES DE WORKSPACE & LIMITES */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building size={16} className="text-blue-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400">
                      Nível 3 — Administradores de Workspace & Tetos Delegatórios ({workspaceAdmins.length})
                    </h3>
                  </div>
                  <span className="text-xs text-slate-500">Limites rígidos impostos centralmente</span>
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

                        {/* Controles do Proprietário sobre o Administrador Local */}
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
                              className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
                                wsAdmin.constraints?.cannot_delete_maps 
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30' 
                                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                              }`}
                            >
                              <AlertOctagon size={12} />
                              {wsAdmin.constraints?.cannot_delete_maps ? 'Bloqueio de Exclusão de Mapas: ATIVO' : 'Permitido Excluir Mapas'}
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-[11px]">
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-500 block">Teto de Delegação</span>
                          <span className="font-semibold text-slate-200">
                            Nível Máximo Concedível: {wsAdmin.constraints?.max_assignable_role_level || 4} (Apenas Operacional)
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-500 block">Veto Institucional</span>
                          <span className="font-mono text-rose-400 text-[10px]">
                            {wsAdmin.constraints?.cannot_manage_security ? 'workspace.manage_security (VETADO)' : 'Nenhum veto'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-500 block">Anti-Escalação</span>
                          <span className="text-slate-400">Impossibilitado de ampliar seus próprios poderes.</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: WORKSPACES */}
          {activeTab === 'workspaces' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white">Workspaces da Organização</h3>
                  <p className="text-xs text-slate-400">Espaços operacionais multi-tenant isolados</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { id: 'ws_g300', code: 'WS-G300', name: 'Módulo G300 / Avarias', path: '/g300/avarias', maps: 12 },
                  { id: 'ws_mkbr', code: 'WS-MKBR', name: 'Operação Linha BR', path: '/mkbr', maps: 4 },
                  { id: 'ws_maps', code: 'WS-MAPS', name: 'Mapeamentos Gerais', path: '/mapeamentos', maps: 3 },
                  { id: 'ws_lab', code: 'WS-LAB', name: 'Laboratório de Inovação', path: '/laboratorio/mapeamento', maps: 1 }
                ].map(ws => {
                  const wsAdmin = workspaceAdmins.find(w => w.workspace_id === ws.id);
                  const adminDisplay = wsAdmin ? (wsAdmin.user_name || wsAdmin.user_email) : (platformOwner?.user_name || 'Administração Central');
                  return (
                  <div key={ws.id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Building size={16} className="text-amber-400" />
                        <h4 className="font-bold text-white text-sm">{ws.name}</h4>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] border border-slate-700">
                        {ws.code}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs text-slate-400">
                      <div><span className="text-slate-500">Administrador Local:</span> <strong className="text-slate-200">{adminDisplay}</strong></div>
                      <div><span className="text-slate-500">Mapas Cadastrados:</span> <strong className="text-slate-200">{ws.maps} layouts</strong></div>
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                      <span className="text-emerald-400 text-[10px] font-semibold flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Ativo
                      </span>
                      <button 
                        onClick={() => router.push(ws.path)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1"
                      >
                        Acessar Módulo <ExternalLink size={11} />
                      </button>
                    </div>
                  </div>
                );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: USUÁRIOS & ATRIBUIÇÕES */}
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
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500"
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
                      <th className="py-3 px-4 text-right">Atuar Como</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {allUsers
                      .filter(u => u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase()))
                      .map(user => {
                        const userAsg = assignments.find(a => a.user_id === user.id && a.status === 'active');
                        const role = userAsg ? roles.find(r => r.id === userAsg.role_id) : null;
                        const isCurrent = user.id === activeUser.id;
                        const uLevel = iam.getUserAuthorityLevel(user.id, 'ws_g300');

                        return (
                          <tr key={user.id} className={`hover:bg-slate-800/40 transition-colors ${isCurrent ? 'bg-amber-950/20' : ''}`}>
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
                                className="px-2.5 py-1 rounded-lg bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white text-[10px] font-semibold uppercase tracking-wider transition-all cursor-pointer"
                              >
                                Testar Sessão
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

          {/* TAB 4: PAPÉIS */}
          {activeTab === 'roles' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {roles.map(role => (
                <div key={role.id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between">
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

          {/* TAB 5: CATÁLOGO */}
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

          {/* TAB 6: SIMULADOR DE ACESSO */}
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

          {/* TAB 7: AUDITORIA */}
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

        </main>
      </div>

      {/* Modal de Nomear Administrador Global */}
      {showAddAdminModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Nomear Administrador Global (Nível 2)</h3>
              <button onClick={() => setShowAddAdminModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleAddPlatformAdmin} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">E-mail do Administrador</label>
                <input
                  type="email"
                  required
                  placeholder="ex: admin@empresa.com"
                  value={newAdminEmail}
                  onChange={e => setNewAdminEmail(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-xs text-white rounded-xl p-2.5 outline-none font-medium focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Título Institucional</label>
                <input
                  type="text"
                  placeholder="ex: Diretor de Operações"
                  value={newAdminTitle}
                  onChange={e => setNewAdminTitle(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-xs text-white rounded-xl p-2.5 outline-none font-medium focus:border-indigo-500"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddAdminModal(false)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors"
                >
                  Confirmar Nomeação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
