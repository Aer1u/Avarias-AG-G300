from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import os
import traceback
import json
import numpy as np
import io
import time
import requests

app = FastAPI()

# Habilitar CORS para o frontend (Vercel ou local)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# EXPLICAÇÃO: Para Google Sheets, o link precisa terminar em /export?format=xlsx
EXCEL_URL = os.environ.get(
    "EXCEL_URL",
    "https://docs.google.com/spreadsheets/d/1q-gttvSLzCVD4x6xtVqivDeYMVvY3PIEOMEYaWnxyeM/export?format=xlsx" 
)
UNALLOCATED_GSHEET_URL = "https://docs.google.com/spreadsheets/d/1Ni-HNW28V8V2vHt__YPPiiBeTX333vDQf_9Qw96wdmc/export?format=xlsx"
MOVEMENT_GSHEET_URL = "https://docs.google.com/spreadsheets/d/1_GxpusG5YZYkmqZ-DMyoRZqO4ak_6XWofqUQx2RY89s/export?format=csv"

def get_allocated_data(xl=None):
    try:
        if xl is None:
            response = requests.get(EXCEL_URL, timeout=10)
            response.raise_for_status()
            xl = pd.ExcelFile(io.BytesIO(response.content))
        # EXPLICAÇÃO: Especificando a aba 'Base de dados' para garantir que pegamos os dados corretos
        df = pd.read_excel(xl, sheet_name='Base de dados')
    except Exception as e:
        print(f"Erro ao carregar alocados: {e}")
        local_path = os.path.join(os.path.dirname(__file__), "data", "Drive atualizado.xlsx")
        if os.path.exists(local_path):
            df = pd.read_excel(local_path)
        else:
            return pd.DataFrame()
    
    new_cols = {}
    for col in df.columns:
        c = str(col).lower()
        if 'posi' in c: new_cols[col] = 'posicao'
        elif 'produto' in c or 'sku' in c: new_cols[col] = 'produto'
        elif 'capacidade' in c: new_cols[col] = 'capacidade'
        elif 'quantidade total' in c or ('total' in c and ('qtd' in c or 'qua' in c or 'quant' in c)): new_cols[col] = 'quantidade_total'
        elif 'palete' in c and ('qtd' in c or 'qua' in c) and '/' not in c: new_cols[col] = 'paletes'
        elif 'nivel' in c or 'nível' in c: new_cols[col] = 'nivel'
        elif 'prof' in c: new_cols[col] = 'profundidade'
        elif '/' in c and 'palete' in c: new_cols[col] = 'qtd_por_palete'
        elif 'id' in c and 'palete' in c: new_cols[col] = 'id_palete'
        elif 'tombada' in c or 'tombado' in c: new_cols[col] = 'qtd_tombada'
        elif 'molhado' in c or 'molhada' in c: new_cols[col] = 'qtd_molhado'
        elif 'status' in c or 'observa' in c or 'obse' in c or 'avaria' in c: new_cols[col] = 'observacao'

    df = df.rename(columns=new_cols)
    return df

def get_registered_positions(xl=None):
    try:
        if xl is None:
            response = requests.get(EXCEL_URL, timeout=10)
            response.raise_for_status()
            xl = pd.ExcelFile(io.BytesIO(response.content))
        df = pd.read_excel(xl, sheet_name='Posições Cadastradas')
    except Exception as e:
        print(f"Erro ao carregar posições cadastradas: {e}")
        return pd.DataFrame()

    new_cols = {}
    for col in df.columns:
        c = str(col).lower()
        if 'posi' in c: new_cols[col] = 'posicao'
        elif 'capacidade' in c: new_cols[col] = 'capacidade'
    
    df = df.rename(columns=new_cols)
    return df

def get_product_descriptions(xl=None):
    try:
        if xl is None:
            response = requests.get(EXCEL_URL, timeout=10)
            response.raise_for_status()
            xl = pd.ExcelFile(io.BytesIO(response.content))
        df = pd.read_excel(xl, sheet_name='Inf dos produtos')
    except Exception as e:
        print(f"Erro ao carregar descrições de produtos: {e}")
        return pd.DataFrame()

    new_cols = {}
    for col in df.columns:
        c = str(col).lower()
        if 'código' in c or 'codigo' in c: new_cols[col] = 'produto'
        elif 'descrição' in c or 'descricao' in c: new_cols[col] = 'descricao'
    
    df = df.rename(columns=new_cols)
    return df[['produto', 'descricao']] if 'produto' in df.columns and 'descricao' in df.columns else df

def get_unallocated_data(xl=None):
    try:
        if xl is None:
            response = requests.get(UNALLOCATED_GSHEET_URL, timeout=10)
            response.raise_for_status()
            xl = pd.ExcelFile(io.BytesIO(response.content))
        df = pd.read_excel(xl)
    except Exception as e:
        print(f"Erro ao carregar não alocados: {e}")
        return pd.DataFrame()

    col_mapping = {
        'Produto': 'produto',
        'Quantidade no palete': 'qtd_por_palete',
        'Qtd. de palete': 'paletes',
        'Quantidade total': 'quantidade_total',
        'ID palete': 'id_palete',
        'Parte Tombada': 'qtd_tombada',
        'Parte Molhada': 'qtd_molhado',
        'Observação': 'observacao'
    }
    
    actual_cols = df.columns
    final_mapping = {}
    for target_name, final_name in col_mapping.items():
        found = next((c for c in actual_cols if target_name.lower() in str(c).lower()), None)
        if found:
            final_mapping[found] = final_name

    df = df.rename(columns=final_mapping)
    df['posicao'] = 'S/P'
    df['is_unallocated_source'] = True
    return df

def get_movement_data(period: str = "hoje", xl=None):
    try:
        if xl is None:
            # Usar XLSX para poder selecionar a aba correta se necessário
            url_xlsx = MOVEMENT_GSHEET_URL.replace("format=csv", "format=xlsx")
            print(f"DEBUG MOVEMENT: Baixando XLSX de {url_xlsx}")
            response = requests.get(url_xlsx, timeout=15)
            response.raise_for_status()
            xl = pd.ExcelFile(io.BytesIO(response.content))
        # Tenta achar a aba com mais linhas que tenha as colunas necessárias (ENTRADA/SAIDA)
        best_sheet = None
        max_rows = -1
        
        # Prioridade absoluta para abas com nomes específicos
        priority_sheets = ['registro', 'movimentação', 'movimentacao', 'movimentos']
        
        for s in xl.sheet_names:
            tmp_df = xl.parse(s, nrows=10) # Lê só um pedaço pra checar colunas
            cols = [str(c).lower().strip() for c in tmp_df.columns]
            
            # Critério: precisa ter produto E (entrada ou saida)
            has_prod = any(k in cols for k in ['produto', 'sku'])
            has_mov = any(k in cols for k in ['entrada', 'saida', 'saída', 'movimentação', 'movimentacao'])
            
            if has_prod and has_mov:
                score = len(xl.parse(s))
                # Dar um bônus enorme se o nome da aba for um dos favoritos
                if s.lower().strip() in priority_sheets:
                    score += 1000000
                
                if score > max_rows:
                    max_rows = score
                    best_sheet = s
        
        if not best_sheet:
            # Fallback total: tenta qualquer uma que tenha produto
            for s in xl.sheet_names:
                tmp_df = xl.parse(s, nrows=2)
                cols = [str(c).lower().strip() for c in tmp_df.columns]
                if any(k in cols for k in ['produto', 'sku']):
                    best_sheet = s
                    break
        
        if not best_sheet:
            best_sheet = xl.sheet_names[0]
            print(f"DEBUG MOVEMENT: Nenhuma aba ideal. Usando a primeira: {best_sheet}")
            
        df = xl.parse(best_sheet)
        print(f"DEBUG MOVEMENT: Selecionada aba '{best_sheet}' com {len(df)} linhas.")
        
        # Remover linhas totalmente vazias
        df = df.dropna(how='all')
        
        # Padronizar colunas e mapear de forma robusta
        actual_cols = [str(c).lower().strip() for c in df.columns]
        df.columns = actual_cols
        
        new_cols = {}
        for col in actual_cols:
            if 'produto' in col or 'sku' in col: new_cols[col] = 'produto'
            elif 'entrada' in col: new_cols[col] = 'entrada'
            elif any(x in col for x in ['saída', 'saida', 'saíd', 'said']): new_cols[col] = 'saida'
            elif 'origem' in col or 'local' in col or 'ponto' in col: new_cols[col] = 'origem'
            elif 'molhado' in col: new_cols[col] = 'qtd_molhado'
        
        df = df.rename(columns=new_cols)

        # Filtro de Data
        today = pd.Timestamp.now().normalize()
        print(f"DEBUG MOVEMENT: Hoje é {today}")
        
        if 'data' in df.columns:
            def safe_parse_date(d):
                try:
                    if pd.isnull(d): return pd.NaT
                    # Se já for data/timestamp, retorna direto
                    if isinstance(d, (pd.Timestamp, datetime.datetime, datetime.date)):
                        return pd.to_datetime(d)
                    
                    s = str(d).strip()
                    if not s or s.lower() == 'nan': return pd.NaT
                    
                    # Tratar 28/02 -> 28/02/YEAR
                    if '/' in s and len(s.split('/')) == 2:
                        s += f"/{today.year}"
                        
                    return pd.to_datetime(s, dayfirst=True, errors='coerce')
                except:
                    return pd.NaT
            
            # Precisamos de datetime para o isinstance funcionar no apply
            import datetime
            df['dt'] = df['data'].apply(safe_parse_date)
            
            # Se a data falhou mas o registro é recente (fim da planilha), dar um fallback
            # para não perder registros importantes
            df['dt'] = df['dt'].fillna(today)
            
            valid_dates = df['dt'].notna().sum()
            print(f"DEBUG MOVEMENT: {valid_dates} datas processadas (incluindo fallbacks) de {len(df)} linhas.")
        else:
            print("DEBUG MOVEMENT: Coluna 'data' não encontrada. Usando data atual.")
            df['dt'] = today

        # Garantir colunas essenciais
        for essential in ['produto', 'entrada', 'saida', 'origem']:
            if essential not in df.columns:
                df[essential] = '-' if essential in ['produto', 'origem'] else 0
        
        if 'origem' in df.columns:
            df = df[~df['origem'].astype(str).str.contains('Mapeamento|Ajuste', case=False, na=False)]

        # Filtros de período
        if period == "hoje":
            df_filtered = df[df['dt'].dt.date == today.date()]
        elif period == "semana":
            df_filtered = df[df['dt'] >= (today - pd.Timedelta(days=7))]
        elif period == "mensal":
            df_filtered = df[df['dt'] >= (today - pd.Timedelta(days=30))]
        else: # recente
            df_filtered = df
            
        print(f"DEBUG MOVEMENT ({period}): {len(df_filtered)} registros após filtro de período.")
        
        # Pegar todos os registros ordenados por data DESC e por ordem de inserção DESC (últimas linhas primeiro)
        # Primeiro invertemos o DF para ter as últimas linhas no topo
        df_latest = df_filtered.iloc[::-1].sort_values('dt', ascending=False, kind='stable')
        
        # Buscar descrições
        df_desc = get_product_descriptions()
        desc_map = df_desc.set_index('produto')['descricao'].to_dict() if not df_desc.empty else {}

        result = []
        for _, row in df_latest.iterrows():
            prod = str(row.get('produto', '-'))
            try:
                entrada = int(float(str(row.get('entrada', 0) or 0).replace(',', '.')))
            except:
                entrada = 0
            try:
                saida = int(float(str(row.get('saida', 0) or 0).replace(',', '.')))
            except:
                saida = 0
            try:
                molhado = int(float(str(row.get('qtd_molhado', 0) or 0).replace(',', '.')))
            except:
                molhado = 0
            origem_val = str(row.get('origem', '-')).strip()
            
            if not origem_val or origem_val.lower() == 'nan':
                origem_val = '-'
            
            dt_obj = pd.to_datetime(row['dt'])
            dias = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"]
            meses = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"]
            
            result.append({
                "data": dt_obj.strftime('%d/%m') if pd.notna(row.get('dt')) else "-",
                "dia_semana": dias[dt_obj.weekday()] if pd.notna(row.get('dt')) else "-",
                "mes": meses[dt_obj.month - 1] if pd.notna(row.get('dt')) else "-",
                "produto": prod, 
                "movimentacao": entrada + saida,
                "entrada": entrada,
                "saida": saida,
                "molhado": molhado,
                "descricao": str(desc_map.get(prod, "-")),
                "origem": origem_val,
                "trend": None
            })
        
        print(f"DEBUG MOVEMENT: Sucesso! {len(result)} últimas movimentações carregadas.")
        return result
    except Exception as e:
        print(f"DEBUG MOVEMENT: EXCEÇÃO - {e}")
        import traceback
        traceback.print_exc()
        return []

def get_clean_data(xl=None, unalloc_xl=None):
    df_reg = get_registered_positions(xl=xl)
    df_alloc = get_allocated_data(xl=xl)
    df_unalloc = get_unallocated_data(xl=unalloc_xl)
    
    # Se tivermos posições cadastradas, elas são a fonte da verdade para capacidade
    if not df_reg.empty:
        # Marcar posições que estão no cadastro para identificar erros depois
        df_reg['is_reg'] = True
        
        # 1. Outer join para NÃO PERDER NADA. 
        # Se estiver na Base de Dados mas não no Cadastro, mantemos (terá capacidade 0).
        # Se estiver no Cadastro mas não na Base, mantemos (seria uma posição vazia).
        df = pd.merge(df_reg, df_alloc, on='posicao', how='outer', suffixes=('', '_alloc'))
        
        # Identificar posições que estão na Base de Dados mas NÃO no Cadastro (exceto S/P)
        # Isso indica erro de digitação do usuário na planilha original.
        df['unregistered_error'] = (df['is_reg'].isna()) & (df['posicao'].str.upper() != 'S/P')
        
        # 2. Priorizar a capacidade do cadastro. Se não estiver no cadastro, capacidade é 0.
        # Não usamos capacidade_alloc se a posição não estiver no cadastro oficial.
        df['capacidade'] = df['capacidade'].fillna(0)
            
        if 'capacidade_alloc' in df.columns:
            df = df.drop(columns=['capacidade_alloc'])
            
        # 3. Adicionar os não alocados (S/P) ao final
        df = pd.concat([df, df_unalloc], ignore_index=True)
    else:
        # Fallback para o comportamento anterior se a aba de cadastro falhar
        df = pd.concat([df_alloc, df_unalloc], ignore_index=True)

    required_cols = ['produto', 'quantidade_total', 'paletes', 'capacidade', 'posicao', 'nivel', 'observacao', 'id_palete', 'qtd_tombada', 'qtd_molhado', 'qtd_por_palete']
    for rc in required_cols:
        if rc not in df.columns:
            df[rc] = 0 if rc in ['quantidade_total', 'paletes', 'capacidade', 'qtd_tombada', 'qtd_molhado', 'qtd_por_palete'] else ('S/P' if rc == 'posicao' else ('-' if rc == 'nivel' else 'N/A'))
    
    df['produto'] = df['produto'].fillna('').astype(str)
    df['quantidade_total'] = pd.to_numeric(df['quantidade_total'], errors='coerce').fillna(0)
    df['paletes'] = pd.to_numeric(df['paletes'], errors='coerce').fillna(0)
    df['capacidade'] = pd.to_numeric(df['capacidade'], errors='coerce').fillna(0)
    df['posicao'] = df['posicao'].fillna('S/P').astype(str)
    df['unregistered_error'] = df.get('unregistered_error', False).fillna(False).astype(bool)
    df['nivel'] = df['nivel'].fillna('-').astype(str)
    df['qtd_por_palete'] = pd.to_numeric(df['qtd_por_palete'], errors='coerce').fillna(0)
    df['qtd_tombada'] = pd.to_numeric(df['qtd_tombada'], errors='coerce').fillna(0)
    df['qtd_molhado'] = pd.to_numeric(df['qtd_molhado'], errors='coerce').fillna(0)
    
    def clean_depth(val):
        if pd.isna(val) or str(val).lower() == 'nan' or str(val).strip() == '':
            return '-'
        v_str = str(val).strip()
        if v_str.endswith('.0'): v_str = v_str[:-2]
        return v_str

    if 'profundidade' in df.columns:
        df['profundidade'] = df['profundidade'].apply(clean_depth)
    else:
        df['profundidade'] = '-'
        
    # 4. Adicionar descrições dos produtos
    df_desc = get_product_descriptions()
    if not df_desc.empty and 'produto' in df_desc.columns:
        # Garantir que os tipos batem para o merge
        df['produto'] = df['produto'].astype(str)
        df_desc['produto'] = df_desc['produto'].astype(str)
        # Remover duplicatas se houver no cadastro de descrições
        df_desc = df_desc.drop_duplicates(subset=['produto'])
        df = pd.merge(df, df_desc, on='produto', how='left')
    
    if 'descricao' not in df.columns:
        df['descricao'] = '-'
    else:
        df['descricao'] = df['descricao'].fillna('-').astype(str)
    
    df['id_palete'] = df['id_palete'].fillna('').astype(str).str.strip().replace('nan', '')
    shared_mask = (df['id_palete'] != '') & (df['id_palete'] != '0') & (df['id_palete'] != 'None')
    if shared_mask.any():
        id_counts = df[shared_mask]['id_palete'].value_counts()
        def balance_pallet(row):
            if row['id_palete'] != '' and row['id_palete'] != '0' and row['id_palete'] != 'None':
                count = id_counts.get(row['id_palete'], 1)
                return 1.0 / count
            return row['paletes']
        df['paletes'] = df.apply(balance_pallet, axis=1)

    # Normalize damage columns
    for col in ['qtd_tombada', 'qtd_molhado']:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
        else:
            df[col] = 0.0

    # Ensure is_unallocated_source exists and is boolean
    if 'is_unallocated_source' not in df.columns:
        df['is_unallocated_source'] = False
    df['is_unallocated_source'] = df['is_unallocated_source'].fillna(False).astype(bool)

    # Damage Logic (Subsets of Total) - Ensure metrics pick them up
    def check_damage_flag(row):
        # Check both product name and observation for damage keywords
        text = (str(row.get('produto', '')) + " " + str(row.get('observacao', ''))).lower()
        # Robust check for "molhad" (covers molhado, molhada, molhados, etc.)
        # and "tombad" (covers tombado, tombada, etc.)
        is_molhado = 1 if 'molhad' in text or row.get('qtd_molhado', 0) > 0 else 0
        is_tombado = 1 if 'tombad' in text or row.get('qtd_tombada', 0) > 0 else 0
        return pd.Series([is_molhado, is_tombado], index=['is_molhado', 'is_tombado'])

    df[['is_molhado', 'is_tombado']] = df.apply(check_damage_flag, axis=1)

    # FIX: Occupancy and Capacity should only apply to ALLOCATED items
    # Unallocated items (is_unallocated_source == True) should have 0 capacity and 0 contribution to occupied positions
    def calculate_occupancy(row):
        if row.get('is_unallocated_source', False):
            return 0.0
        cap = row.get('capacidade', 0)
        pal = row.get('paletes', 0)
        if cap > 0:
            return (pal / cap) * 100
        return 0.0

    df['ocupacao'] = df.apply(calculate_occupancy, axis=1)
    
    # Ensure capacity is 0 for unallocated items to avoid skewing stats
    df.loc[df['is_unallocated_source'] == True, 'capacidade'] = 0.0

    # Mixed pallets detection (Only for allocated items with a real position)
    df['is_mixed'] = False
    mask_allocated = (~df['is_unallocated_source']) & (df['posicao'] != 'S/P')
    pos_counts = df[mask_allocated].groupby('posicao')['produto'].transform('nunique')
    df.loc[mask_allocated, 'is_mixed'] = pos_counts > 1
    
    # Debug print with more detail
    allocated_count = len(df[~df['is_unallocated_source']])
    unallocated_count = len(df[df['is_unallocated_source']])
    total_tombada = df['qtd_tombada'].sum()
    total_molhada = df['qtd_molhado'].sum()
    print(f"DEBUG: {len(df)} total, {allocated_count} alocados, {unallocated_count} não alocados.")
    print(f"DEBUG: Total Tombada: {total_tombada}, Total Molhada: {total_molhada}")
    
    df = df.replace([np.inf, -np.inf], np.nan).fillna(0)
    print(f"DEBUG: {len(df)} registros processados.")
    return df

@app.get("/")
async def health_check():
    return {"status": "ok"}

@app.get("/api/data")
async def read_data():
    try:
        df = get_clean_data()
        return df.to_dict(orient="records")
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

def get_movement_totals(xl=None):
    try:
        if xl is None:
            # Usar XLSX para consistência
            url_xlsx = MOVEMENT_GSHEET_URL.replace("format=csv", "format=xlsx")
            print(f"DEBUG MOVEMENT TOTALS: Baixando XLSX de {url_xlsx}")
            response = requests.get(url_xlsx, timeout=15)
            response.raise_for_status()
            xl = pd.ExcelFile(io.BytesIO(response.content))
        best_sheet = None
        max_rows = -1
        
        # Prioridade absoluta para abas com nomes específicos
        priority_sheets = ['registro', 'movimentação', 'movimentacao', 'movimentos']
        
        for s in xl.sheet_names:
            tmp_df = xl.parse(s, nrows=10)
            cols = [str(c).lower().strip() for c in tmp_df.columns]
            
            # Critério: precisa ter produto E (entrada ou saida)
            has_prod = any(k in cols for k in ['produto', 'sku'])
            has_mov = any(k in cols for k in ['entrada', 'saida', 'saída', 'movimentação', 'movimentacao'])
            
            if has_prod and has_mov:
                score = len(xl.parse(s))
                if s.lower().strip() in priority_sheets:
                    score += 1000000
                
                if score > max_rows:
                    max_rows = score
                    best_sheet = s
        
        if not best_sheet:
            for s in xl.sheet_names:
                tmp_df = xl.parse(s, nrows=2)
                cols = [str(c).lower().strip() for c in tmp_df.columns]
                if any(k in cols for k in ['produto', 'sku']):
                    best_sheet = s
                    break
        
        if not best_sheet:
            best_sheet = xl.sheet_names[0]
            
        df = xl.parse(best_sheet)
        print(f"DEBUG MOVEMENT TOTALS: Selecionada aba '{best_sheet}' com {len(df)} linhas.")
        
        # Remover linhas totalmente vazias
        df = df.dropna(how='all')
        
        # Normalizar colunas: lowercase, sem espaços e removendo caracteres estranhos se necessário
        actual_cols = df.columns.tolist()
        new_cols = {}
        for col in actual_cols:
            c = str(col).lower().strip()
            if 'produto' in c or 'sku' in c: new_cols[col] = 'produto'
            elif 'entrada' in c: new_cols[col] = 'entrada'
            elif any(x in c for x in ['saída', 'saida', 'saíd', 'said']): new_cols[col] = 'saida' 
            elif 'molhado' in c: new_cols[col] = 'qtd_molhado'
            elif 'tombado' in c: new_cols[col] = 'qtd_tombada'
            elif 'obser' in c: new_cols[col] = 'observacao'
            elif 'origem' in c or 'local' in c or 'ponto' in c: new_cols[col] = 'origem'
            elif 'data' in c: new_cols[col] = 'data'

        df = df.rename(columns=new_cols)
        print(f"DEBUG MOVEMENT: Colunas mapeadas: {df.columns.tolist()}")

        def parse_num(v):
            try:
                if pd.isna(v) or str(v).strip() == '': return 0.0
                return float(str(v).replace(',', '.'))
            except:
                return 0.0

        if 'entrada' in df.columns:
            df['entrada_num'] = df['entrada'].apply(parse_num)
        else:
            df['entrada_num'] = 0.0
            
        if 'saida' in df.columns:
            df['saida_num'] = df['saida'].apply(parse_num)
        else:
            df['saida_num'] = 0.0

        # Calcular total de hoje (ENTRADA - SAÍDA) para o indicador do Dashboard
        today = pd.Timestamp.now().normalize()
        today_net = 0
        
        if 'data' in df.columns:
            def safe_parse_date(d):
                try:
                    if pd.isnull(d): return pd.NaT
                    if isinstance(d, (pd.Timestamp, datetime.datetime, datetime.date)):
                        return pd.to_datetime(d)
                    s = str(d).strip()
                    if not s or s.lower() == 'nan': return pd.NaT
                    if '/' in s and len(s.split('/')) == 2:
                        s += f"/{today.year}"
                    return pd.to_datetime(s, dayfirst=True, errors='coerce')
                except:
                    return pd.NaT
            
            import datetime
            df['dt'] = df['data'].apply(safe_parse_date).fillna(today)
            df_today = df[df['dt'].dt.date == today.date()]
            today_ent = df_today['entrada_num'].sum()
            today_sai = df_today['saida_num'].sum()
            today_net = int(today_ent - today_sai)

        ent = df['entrada_num'].sum()
        sai = df['saida_num'].sum()
        molh = df['qtd_molhado'].apply(parse_num).sum() if 'qtd_molhado' in df.columns else 0
        tomb = df['qtd_tombada'].apply(parse_num).sum() if 'qtd_tombada' in df.columns else 0
        
        # Calculate totals per product
        if 'produto' in df.columns:
            df['balanco'] = df['entrada_num'] - df['saida_num']
            # Group by string to avoid NaN issues
            df['produto_str'] = df['produto'].astype(str).str.strip()
            # Drop empty products
            valid_prods = df[df['produto_str'] != 'nan']
            
            prod_groups = valid_prods.groupby('produto_str')['balanco'].sum().to_dict()
            
            # EXPLICAÇÃO: Frequência de registros (quantas vezes o SKU aparece no log de movimentação)
            freq_groups = valid_prods.groupby('produto_str').size().to_dict()
            
            # EXPLICAÇÃO: Frequência de registros COM avaria molhada
            molh_freq_groups = {}
            if 'qtd_molhado' in valid_prods.columns:
                # Considera registro de avaria se a quantidade for > 0 ou se o campo não estiver vazio
                wet_prods = valid_prods[valid_prods['qtd_molhado'].apply(parse_num) > 0]
                molh_freq_groups = wet_prods.groupby('produto_str').size().to_dict()
        else:
            prod_groups = {}
            freq_groups = {}
            molh_freq_groups = {}

        return {
            "movement_pieces": int(ent - sai),
            "today_net": today_net,
            "total_entries": int(ent),
            "total_exits": int(sai),
            "qtd_molhado": int(molh),
            "qtd_tombada": int(tomb),
            "movement_by_product": prod_groups,
            "frequency_by_product": freq_groups,
            "molh_frequency_by_product": molh_freq_groups
        }
    except Exception as e:
        print(f"DEBUG MOVEMENT TOTALS: Erro - {e}")
        return {"movement_pieces": 0, "qtd_molhado": 0, "qtd_tombada": 0, "movement_by_product": {}}

def get_quantity_totals(xl=None):
    """Lê a aba 'Quantidade Total' da planilha de movimentação para pegar molhado/tombada."""
    try:
        if xl is None:
            url_xlsx = MOVEMENT_GSHEET_URL.replace("format=csv", "format=xlsx")
            response = requests.get(url_xlsx, timeout=15)
            response.raise_for_status()
            xl = pd.ExcelFile(io.BytesIO(response.content))

        # Procurar a aba correta
        aba = None
        for s in xl.sheet_names:
            if 'quantidade' in s.lower() or 'total' in s.lower():
                aba = s
                break
        
        if not aba:
            print("DEBUG QUANTITY TOTALS: Aba 'Quantidade Total' não encontrada.")
            return {"qtd_molhado": 0, "qtd_tombada": 0}

        df = xl.parse(aba)
        df = df.dropna(how='all')
        print(f"DEBUG QUANTITY TOTALS: Lida aba '{aba}' com {len(df)} linhas. Colunas: {df.columns.tolist()}")

        # Mapear colunas
        col_map = {}
        for col in df.columns:
            c = str(col).lower().strip()
            if 'molhad' in c: col_map[col] = 'molhado'
            elif 'tombad' in c: col_map[col] = 'tombado'

        df = df.rename(columns=col_map)

        def parse_num(v):
            try:
                if pd.isna(v) or str(v).strip() == '': return 0.0
                return float(str(v).replace(',', '.'))
            except:
                return 0.0

        qtd_molhado = int(df['molhado'].apply(parse_num).sum()) if 'molhado' in df.columns else 0
        qtd_tombada = int(df['tombado'].apply(parse_num).sum()) if 'tombado' in df.columns else 0

        print(f"DEBUG QUANTITY TOTALS: molhado={qtd_molhado}, tombada={qtd_tombada}")
        return {"qtd_molhado": qtd_molhado, "qtd_tombada": qtd_tombada}

    except Exception as e:
        print(f"DEBUG QUANTITY TOTALS: Erro - {e}")
        traceback.print_exc()
        return {"qtd_molhado": 0, "qtd_tombada": 0}

# Cache global para evitar downloads excessivos (expira em 30s)
_xlsx_cache = {"data": None, "time": 0.0}        # Planilha de movimentação
_main_xlsx_cache = {"data": None, "time": 0.0}   # Planilha principal (EXCEL_URL)

def get_xlsx_file():
    """Retorna a planilha de movimentação (registro de entradas/saídas)"""
    global _xlsx_cache
    now = time.time()
    if _xlsx_cache["data"] and (now - (_xlsx_cache["time"] or 0) < 30):
        return pd.ExcelFile(io.BytesIO(_xlsx_cache["data"]))
    
    url = "https://docs.google.com/spreadsheets/d/1_GxpusG5YZYkmqZ-DMyoRZqO4ak_6XWofqUQx2RY89s/export?format=xlsx"
    print(f"DEBUG: Baixando XLSX de movimentação de {url}")
    response = requests.get(url, timeout=15)
    _xlsx_cache["data"] = response.content
    _xlsx_cache["time"] = now
    return pd.ExcelFile(io.BytesIO(response.content))

def get_main_xlsx_file():
    """Retorna a planilha principal com Base de dados, Posições, etc."""
    global _main_xlsx_cache
    now = time.time()
    if _main_xlsx_cache["data"] and (now - (_main_xlsx_cache["time"] or 0) < 30):
        return pd.ExcelFile(io.BytesIO(_main_xlsx_cache["data"]))
    
    url = EXCEL_URL
    print(f"DEBUG: Baixando XLSX principal de {url}")
    response = requests.get(url, timeout=15)
    _main_xlsx_cache["data"] = response.content
    _main_xlsx_cache["time"] = now
    return pd.ExcelFile(io.BytesIO(response.content))

@app.get("/api/stats")
async def get_stats(period: str = "hoje"):
    try:
        # Forçar hoje se vier recente (que removemos)
        if period == "recente": period = "hoje"
        
        # Optimization: Fetch via existing helpers which might have some internal logic/try-except
        # and ensure we have separate XL objects for each source
        main_xl_content = requests.get(EXCEL_URL, timeout=30).content
        main_xl = pd.ExcelFile(io.BytesIO(main_xl_content))
        
        url_mov_xlsx = MOVEMENT_GSHEET_URL.replace("format=csv", "format=xlsx")
        mov_xl_content = requests.get(url_mov_xlsx, timeout=30).content
        mov_xl = pd.ExcelFile(io.BytesIO(mov_xl_content))
        
        unalloc_xl_content = requests.get(UNALLOCATED_GSHEET_URL, timeout=30).content
        unalloc_xl = pd.ExcelFile(io.BytesIO(unalloc_xl_content))

        # Pass specific XLs to get_clean_data
        df = get_clean_data(xl=main_xl, unalloc_xl=unalloc_xl)
        mov_totals = get_movement_totals(xl=mov_xl)
        qty_totals = get_quantity_totals(xl=mov_xl)
        
        # CHART DATA: filtered by period
        top_moved = get_movement_data(period, xl=mov_xl)
        
        # PERSISTENT MOVEMENTS: always 5 most recent
        latest_movements = get_movement_data("recente", xl=mov_xl)[:5]

        # CALCULATE PERIOD TOTALS (Strictly for the requested period)
        period_entries = sum(m.get('entrada', 0) for m in top_moved)
        period_exits = sum(m.get('saida', 0) for m in top_moved)
        period_wet = sum(m.get('molhado', 0) for m in top_moved)
        
        # Calculate divergences
        db_by_product = {}
        if not df.empty and 'produto' in df.columns:
            valid_db = df[df['produto'].astype(str).str.strip() != '']
            db_groups = valid_db.groupby('produto')['quantidade_total'].sum()
            db_by_product = db_groups.to_dict()
            
        mov_by_product = mov_totals.get("movement_by_product", {})
        
        all_products = set(db_by_product.keys()).union(set(mov_by_product.keys()))
        divergences = []
        for p in all_products:
            if not p or str(p).lower() in ['nan', 'none', '-', '']: continue
            db_qty = int(db_by_product.get(p, 0))
            mov_qty = int(mov_by_product.get(p, 0))
            if db_qty != mov_qty:
                divergences.append({
                    "produto": p,
                    "db_qty": db_qty,
                    "mov_qty": mov_qty,
                    "diff": db_qty - mov_qty
                })
        
        return {
            "total_pallets": int(df['paletes'].sum()),
            "total_quantity": int(df['quantidade_total'].sum()),
            "total_positions": int(df[df['posicao'] != 'S/P']['posicao'].nunique()),
            "total_skus": int(df['produto'].nunique()),
            "avg_occupancy": float(df[df['capacidade'] > 0]['ocupacao'].mean()) if not df[df['capacidade'] > 0].empty else 0,
            "qtd_molhado": qty_totals["qtd_molhado"],
            "qtd_tombada": qty_totals["qtd_tombada"],
            "movement_pieces": mov_totals["movement_pieces"],
            "total_entries": mov_totals.get("total_entries", 0),
            "total_exits": mov_totals.get("total_exits", 0),
            "period_entries": int(period_entries),
            "period_exits": int(period_exits),
            "period_wet": int(period_wet),
            "today_net": mov_totals.get("today_net", 0),
            "divergences": sorted(divergences, key=lambda x: abs(x['diff']), reverse=True),
            "total_capacity": int(df[df['posicao'] != 'S/P'].groupby('posicao')['capacidade'].first().sum()),
            "unregistered_count": int(df[df['unregistered_error'] == True]['posicao'].nunique()),
            "unregistered_positions": list(df[df['unregistered_error'] == True]['posicao'].unique()),
            "top_moved": top_moved,
            "latest_movements": latest_movements,
            "frequency_by_product": mov_totals.get("frequency_by_product", {}),
            "molh_frequency_by_product": mov_totals.get("molh_frequency_by_product", {})
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/confrontos")
async def get_confrontos(type: str = "fisico_x_a501"):
    try:
        # Pega a planilha de movimentação, mas exportando em xlsx para ler as abas
        url = "https://docs.google.com/spreadsheets/d/1_GxpusG5YZYkmqZ-DMyoRZqO4ak_6XWofqUQx2RY89s/export?format=xlsx"
        response = requests.get(url, timeout=15)
        response.raise_for_status()
        
        xl = pd.ExcelFile(io.BytesIO(response.content))
        
        # Lê a aba A501 (sempre necessária)
        if "A501" in xl.sheet_names:
            df_a501 = xl.parse("A501")
        else:
            df_a501 = pd.DataFrame(columns=['Produto', 'Descrição', 'Quantidade'])

        # Padroniza nomes de colunas do A501
        df_a501.columns = [str(c).strip() for c in df_a501.columns]
        df_a501['Produto'] = df_a501['Produto'].astype(str).str.strip()
        df_a501 = df_a501[~df_a501['Produto'].isin(['', 'nan', 'None', '-'])]

        # Agrupa A501
        a501_col = 'Quantidade' if 'Quantidade' in df_a501.columns else df_a501.columns[2]
        df_a501[a501_col] = pd.to_numeric(df_a501[a501_col], errors='coerce').fillna(0)
        a501_grouped = df_a501.groupby('Produto')[a501_col].sum().to_dict()

        # Mapa de descrições
        desc_map = {}
        if 'Descrição' in df_a501.columns:
            desc_df = df_a501.groupby('Produto')['Descrição'].first().dropna().to_dict()
            desc_map.update(desc_df)

        if type == "a501_x_g501":
            # Lê a aba G501
            if "G501" in xl.sheet_names:
                df_g501 = xl.parse("G501")
            else:
                df_g501 = pd.DataFrame(columns=['Produto', 'Quantidade'])
            
            df_g501.columns = [str(c).strip() for c in df_g501.columns]
            df_g501['Produto'] = df_g501['Produto'].astype(str).str.strip()
            df_g501 = df_g501[~df_g501['Produto'].isin(['', 'nan', 'None', '-'])]
            
            g501_col = 'Quantidade' if 'Quantidade' in df_g501.columns else df_g501.columns[1]
            df_g501[g501_col] = pd.to_numeric(df_g501[g501_col], errors='coerce').fillna(0)
            g501_grouped = df_g501.groupby('Produto')[g501_col].sum().to_dict()

            all_products = set(a501_grouped.keys()) | set(g501_grouped.keys())
            
            resultado = []
            for p in all_products:
                qtd_base = int(a501_grouped.get(p, 0)) # "Física" (Esquerda) -> A501 neste modo
                qtd_target = int(g501_grouped.get(p, 0)) # "Sistema" (Direita) -> G501 neste modo
                diff = qtd_base - qtd_target
                
                desc = str(desc_map.get(p, '-'))
                if desc.lower() == 'nan': desc = '-'
                
                resultado.append({
                    "produto": p,
                    "descricao": desc,
                    "qtd_fisica": qtd_base,   # No frontend reuso labels
                    "qtd_sistema": qtd_target, # No frontend reuso labels
                    "diferenca": diff
                })
        else:
            # Padrão: físico_x_a501
            if "Quantidade Total" in xl.sheet_names:
                df_fisica = xl.parse("Quantidade Total")
            else:
                df_fisica = pd.DataFrame(columns=['Produto', 'Quantidade Total'])

            df_fisica.columns = [str(c).strip() for c in df_fisica.columns]
            df_fisica['Produto'] = df_fisica['Produto'].astype(str).str.strip()
            df_fisica = df_fisica[~df_fisica['Produto'].isin(['', 'nan', 'None', '-'])]

            qt_col = 'Quantidade Total' if 'Quantidade Total' in df_fisica.columns else df_fisica.columns[1]
            df_fisica[qt_col] = pd.to_numeric(df_fisica[qt_col], errors='coerce').fillna(0)
            fisica_grouped = df_fisica.groupby('Produto')[qt_col].sum().to_dict()

            all_products = set(fisica_grouped.keys()) | set(a501_grouped.keys())
            
            resultado = []
            for p in all_products:
                qtd_fisica = int(fisica_grouped.get(p, 0))
                qtd_sistema = int(a501_grouped.get(p, 0))
                diff = qtd_fisica - qtd_sistema
                
                desc = str(desc_map.get(p, '-'))
                if desc.lower() == 'nan': desc = '-'
                
                resultado.append({
                    "produto": p,
                    "descricao": desc,
                    "qtd_fisica": qtd_fisica,
                    "qtd_sistema": qtd_sistema,
                    "diferenca": diff
                })

        # Complementa descrições
        df_desc = get_product_descriptions()
        if not df_desc.empty and 'produto' in df_desc.columns and 'descricao' in df_desc.columns:
            db_desc_map = df_desc.set_index('produto')['descricao'].to_dict()
            for r in resultado:
                if r['descricao'] == '-' and r['produto'] in db_desc_map:
                    r['descricao'] = db_desc_map[r['produto']]

        # Ordenação
        resultado.sort(key=lambda x: (not (x["diferenca"] != 0), -abs(x["diferenca"]), x["produto"]))
        
        return {
            "total_produtos": len(resultado),
            "itens_com_divergencia": len([x for x in resultado if x["diferenca"] != 0]),
            "dados": resultado
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    # Mantendo a porta 8000 que é o padrão do frontend geralmente
    uvicorn.run(app, host="0.0.0.0", port=8000)
