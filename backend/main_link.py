from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import os
import traceback
import json
import numpy as np
import io
import requests

app = FastAPI()

# Habilitar CORS para o frontend (Vercel ou local)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# EXPLICAÇÃO: Para Google Sheets, o link precisa terminar em /export?format=xlsx
# Se for OneDrive ou Dropbox, o link precisa ser o de "Download Direto".
EXCEL_URL = os.environ.get(
    "EXCEL_URL",
    "https://docs.google.com/spreadsheets/d/1q-gttvSLzCVD4x6xtVqivDeYMVvY3PIEOMEYaWnxyeM/export?format=xlsx" 
)

def get_clean_data():
    try:
        # Tenta carregar do link
        if EXCEL_URL.startswith("http"):
            response = requests.get(EXCEL_URL)
            response.raise_for_status()
            df = pd.read_excel(io.BytesIO(response.content))
        else:
            # Fallback local se o link não estiver configurado
            local_path = os.path.join(os.path.dirname(__file__), "data", "Drive atualizado.xlsx")
            df = pd.read_excel(local_path)
            
        # --- A mesma lógica de limpeza que já temos ---
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
        
        df = df.rename(columns=new_cols)

        required_cols = ['produto', 'quantidade_total', 'paletes', 'capacidade', 'posicao', 'nivel']
        for rc in required_cols:
            if rc not in df.columns:
                df[rc] = 0 if rc in ['quantidade_total', 'paletes', 'capacidade'] else ('-' if rc == 'nivel' else 'N/A')
        
        df['produto'] = df['produto'].fillna('Não Identificado')
        df['quantidade_total'] = pd.to_numeric(df['quantidade_total'], errors='coerce').fillna(0)
        df['paletes'] = pd.to_numeric(df['paletes'], errors='coerce').fillna(0)
        df['capacidade'] = pd.to_numeric(df['capacidade'], errors='coerce').fillna(0)
        df['posicao'] = df['posicao'].fillna('S/P')
        df['nivel'] = df['nivel'].fillna('-')
        df['qtd_por_palete'] = pd.to_numeric(df['qtd_por_palete'], errors='coerce').fillna(0)
        
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
        
        if 'id_palete' in df.columns:
            df['id_palete'] = df['id_palete'].fillna('').astype(str).str.strip().replace('nan', '')
            shared_mask = df['id_palete'] != ''
            if shared_mask.any():
                id_counts = df[shared_mask]['id_palete'].value_counts()
                def balance_pallet(row):
                    if row['id_palete'] != '':
                        count = id_counts.get(row['id_palete'], 1)
                        return 1.0 / count
                    return row['paletes']
                df['paletes'] = df.apply(balance_pallet, axis=1)

        df['ocupacao'] = (df['paletes'] / df['capacidade'] * 100).clip(0, 500).fillna(0)
        df = df.replace([np.inf, -np.inf], np.nan)
        df = df.fillna(0)
        return df

    except Exception as e:
        print(f"Erro ao carregar dados: {e}")
        raise e

@app.get("/api/data")
async def read_data():
    try:
        df = get_clean_data()
        return df.to_dict(orient="records")
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stats")
async def get_stats():
    try:
        df = get_clean_data()
        return {
            "total_pallets": int(df['paletes'].sum()),
            "total_quantity": int(df['quantidade_total'].sum()),
            "total_positions": int(df['posicao'].nunique()),
            "total_skus": int(df['produto'].nunique()),
            "avg_occupancy": float(df['ocupacao'].mean())
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    # Rodando na porta 8001 para não conflitar com o outro se testar local
    uvicorn.run(app, host="0.0.0.0", port=8001)
