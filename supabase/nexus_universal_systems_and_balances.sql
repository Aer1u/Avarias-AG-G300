-- ==============================================================================
-- NEXUS ERP — Arquitetura Universal de Sistemas, Registros, Saldos e Movimentações
-- Versão: 1.0 (Não destrutivo - Preserva integralmente tabelas e dados existentes)
-- ==============================================================================

-- 1. EXTENSÃO UUID (se não existir)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- TABELA 1: business_systems (Catálogo Central de Sistemas de Negócio)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.business_systems (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
    code TEXT NOT NULL,                          -- ex: 'AVARIAS_G300', 'RETRABALHO', 'QUARENTENA'
    name TEXT NOT NULL,                          -- ex: 'Sistema de Avarias G300'
    description TEXT,
    color TEXT DEFAULT '#3b82f6',                -- cor identificadora (#hex)
    icon TEXT DEFAULT '📦',                      -- emoji ou identificador visual
    default_control_mode TEXT NOT NULL DEFAULT 'vinculado_saldo' CHECK (default_control_mode IN ('livre', 'vinculado_saldo')),
    origin_storage_id TEXT,                      -- ID do MapObject do CHÃO ou local de origem
    origin_storage_label TEXT,                   -- Nome legível da origem (ex: 'CHÃO G300')
    status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'configuracao')),
    responsible TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_business_systems_code_workspace UNIQUE (workspace_id, code)
);

-- ==============================================================================
-- TABELA 2: system_storage_participants (Participação dos Objetos no Sistema)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.system_storage_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
    system_id UUID NOT NULL REFERENCES public.business_systems(id) ON DELETE CASCADE,
    storage_object_id TEXT NOT NULL,             -- ID do MapObject (ex: Drive-In 01, CHÃO)
    storage_object_label TEXT NOT NULL,          -- Nome legível do objeto
    storage_type TEXT NOT NULL,                  -- 'drive_in', 'custom_area', 'floor', etc.
    role TEXT NOT NULL DEFAULT 'armazenamento' CHECK (role IN ('origem', 'armazenamento', 'quarentena', 'retrabalho', 'expedicao', 'transito')),
    stock_control_mode TEXT NOT NULL DEFAULT 'vinculado_saldo' CHECK (stock_control_mode IN ('livre', 'vinculado_saldo')),
    allow_inbound BOOLEAN NOT NULL DEFAULT true,
    allow_outbound BOOLEAN NOT NULL DEFAULT true,
    allow_return_to_origin BOOLEAN NOT NULL DEFAULT true,
    max_capacity_units NUMERIC,
    notes TEXT,
    configured_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_system_storage_participant UNIQUE (system_id, storage_object_id)
);

-- ==============================================================================
-- TABELA 3: universal_records (Registro Universal de Entradas, Saídas e Ajustes)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.universal_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
    system_id UUID NOT NULL REFERENCES public.business_systems(id) ON DELETE RESTRICT,
    record_type TEXT NOT NULL CHECK (record_type IN ('entrada', 'saida', 'transferencia', 'ajuste', 'baixa', 'devolucao')),
    resource_id TEXT NOT NULL,                   -- SKU (ex: da base_codigos) ou código do recurso
    storage_object_id TEXT NOT NULL,             -- Onde o evento ocorreu (ex: CHÃO ou Drive)
    quantity NUMERIC NOT NULL CHECK (quantity > 0),
    unit TEXT NOT NULL DEFAULT 'un',
    document_ref TEXT,                           -- Número de Nota Fiscal, Lacre, OS, Container
    responsible TEXT,                            -- Usuário ou operador que gerou o registro
    justification TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,          -- Campos complementares livres de cada sistema
    status TEXT NOT NULL DEFAULT 'concluido' CHECK (status IN ('pendente', 'concluido', 'estornado', 'cancelado')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- TABELA 4: universal_balances (Motor Central de Saldos por Local e Sistema)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.universal_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
    system_id UUID NOT NULL REFERENCES public.business_systems(id) ON DELETE RESTRICT,
    resource_id TEXT NOT NULL,                   -- SKU do recurso
    storage_object_id TEXT NOT NULL,             -- Local atual (ex: 'chao_g300' ou ID do Drive)
    quantity NUMERIC NOT NULL DEFAULT 0 CHECK (quantity >= 0), -- Saldo NUNCA pode ser negativo
    unit TEXT NOT NULL DEFAULT 'un',
    origin_record_id UUID REFERENCES public.universal_records(id) ON DELETE SET NULL, -- Rastreabilidade da entrada inicial
    pallet_id TEXT,                              -- ID físico do palete se aplicável (ex: 'P.001')
    last_movement_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_universal_balance_slot UNIQUE (workspace_id, system_id, storage_object_id, resource_id)
);

-- ==============================================================================
-- TABELA 5: universal_movements (Histórico Central e Imutável de Movimentações)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.universal_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
    system_id UUID NOT NULL REFERENCES public.business_systems(id) ON DELETE RESTRICT,
    resource_id TEXT NOT NULL,
    from_storage_id TEXT NOT NULL,               -- Origem física (ex: CHÃO)
    to_storage_id TEXT NOT NULL,                 -- Destino físico (ex: Drive 01)
    quantity NUMERIC NOT NULL CHECK (quantity > 0),
    unit TEXT NOT NULL DEFAULT 'un',
    origin_record_id UUID REFERENCES public.universal_records(id) ON DELETE SET NULL,
    pallet_id TEXT,
    responsible TEXT,
    justification TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- ÍNDICES DE PERFORMANCE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_universal_balances_query 
    ON public.universal_balances(workspace_id, system_id, storage_object_id, resource_id);

CREATE INDEX IF NOT EXISTS idx_universal_movements_system 
    ON public.universal_movements(workspace_id, system_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_universal_records_system 
    ON public.universal_records(workspace_id, system_id, created_at DESC);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) MULTI-TENANT
-- ==============================================================================
ALTER TABLE public.business_systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_storage_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.universal_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.universal_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.universal_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read/write on business_systems" 
    ON public.business_systems FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated read/write on system_storage_participants" 
    ON public.system_storage_participants FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated read/write on universal_records" 
    ON public.universal_records FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated read/write on universal_balances" 
    ON public.universal_balances FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated read/write on universal_movements" 
    ON public.universal_movements FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Permissões também para anon (Laboratório / Dev)
CREATE POLICY "Allow anon read/write on business_systems" 
    ON public.business_systems FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon read/write on system_storage_participants" 
    ON public.system_storage_participants FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon read/write on universal_records" 
    ON public.universal_records FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon read/write on universal_balances" 
    ON public.universal_balances FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon read/write on universal_movements" 
    ON public.universal_movements FOR ALL TO anon USING (true) WITH CHECK (true);

