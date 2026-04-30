
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Try to find .env.local or .env
let envPath = path.join(process.cwd(), '.env.local');
if (!fs.existsSync(envPath)) envPath = path.join(process.cwd(), '.env');

if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    console.log('Fetching Registros...');
    const { data: registros, error: regError } = await supabase.from('Registros').select('*');
    if (regError) {
        console.error('Error fetching Registros:', regError);
    } else {
        console.log(`Total rows in Registros: ${registros.length}`);
        
        let entries = 0;
        let exits = 0;
        const skus = new Set();
        
        registros.forEach(r => {
            const ent = Number(r.Entrada) || 0;
            const sai = Number(r.Saída) || 0;
            const sku = r.Produto;
            if (sku) skus.add(sku);
            entries += ent;
            exits += sai;
        });
        
        console.log(`Sum of Entries: ${entries}`);
        console.log(`Sum of Exits: ${exits}`);
        console.log(`Net Quantity (Ent - Sai): ${entries - exits}`);
        console.log(`Unique SKUs in Registros: ${skus.size}`);
    }

    console.log('\nFetching Mapeamento...');
    const { data: mapeamento, error: mapError } = await supabase.from('mapeamento').select('*');
    if (mapError) {
        console.error('Error fetching Mapeamento:', mapError);
    } else {
        console.log(`Total rows in Mapeamento: ${mapeamento.length}`);
        const totalQty = mapeamento.reduce((acc, curr) => acc + (Number(curr.Quantidade) || 0), 0);
        const totalPallets = mapeamento.length; // Assuming each row is a pallet
        console.log(`Total Quantity in Mapeamento: ${totalQty}`);
        console.log(`Total Pallets in Mapeamento: ${totalPallets}`);
    }
}

checkData();
