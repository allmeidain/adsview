// VERSÃO 2.1 FINAL  OK

const express = require('express');
const { Pool } = require('pg');
const fetch = require('node-fetch');
const basicAuth = require('express-basic-auth');
const app = express();
const PORTA = 3000;

require('dotenv').config();

// --- CONFIGURAÇÃO DO BANCO DE DADOS (POSTGRES) ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

const criarTabelasSeNaoExistir = async () => {
    const createCampaignsTable = `CREATE TABLE IF NOT EXISTS campanhas (id TEXT PRIMARY KEY, nome TEXT, conta TEXT, codigo_moeda TEXT);`;
    const createPerformanceTable = `
        CREATE TABLE IF NOT EXISTS desempenho_diario (
            id SERIAL PRIMARY KEY, id_campanha TEXT NOT NULL, "data" DATE NOT NULL,
            impressoes INTEGER, cliques INTEGER, custo REAL, cpc_medio REAL, ctr REAL,
            parcela_impressao REAL, parcela_superior REAL, parcela_abs_superior REAL,
            orcamento_diario REAL, estrategia_lance TEXT, nome_estrategia_lance TEXT, pagina TEXT,
            checkouts REAL DEFAULT 0, conversoes REAL DEFAULT 0, valor_conversoes REAL DEFAULT 0, visitors REAL DEFAULT 0,
            checkouts_editado INTEGER DEFAULT 0, conversoes_editado INTEGER DEFAULT 0, valor_conversoes_editado INTEGER DEFAULT 0, visitors_editado INTEGER DEFAULT 0,
            alteracoes TEXT, cpa_desejado REAL, cpc_maximo REAL,
            UNIQUE(id_campanha, "data"), CONSTRAINT fk_campanha FOREIGN KEY(id_campanha) REFERENCES campanhas(id) ON DELETE CASCADE
        );`;
    const createConfigTable = `CREATE TABLE IF NOT EXISTS configuracoes (chave TEXT PRIMARY KEY, valor TEXT);`;
    const createHistoryTable = `
        CREATE TABLE IF NOT EXISTS historico_atualizacoes (
            id SERIAL PRIMARY KEY, timestamp TIMESTAMPTZ NOT NULL, status TEXT, detalhes TEXT
        );`;
    try {
        await pool.query(createCampaignsTable);
        await pool.query(createPerformanceTable);
        await pool.query(createConfigTable);
        await pool.query(createHistoryTable);
        console.log("Tabelas verificadas/criadas com sucesso no PostgreSQL.");
    } catch (err) {
        console.error("Erro ao criar as tabelas:", err);
        // Se houver erro na criação das tabelas, o processo para aqui.
        process.exit(1);
    }
};

// --- LÓGICA DE AUTENTICAÇÃO ---
const users = {};
const adminUser = process.env.ADMIN_USERNAME || 'admin';
const adminPass = process.env.ADMIN_PASSWORD || 'password';
users[adminUser] = adminPass;
const authMiddleware = basicAuth({ users, challenge: true, unauthorizedResponse: 'Acesso não autorizado.' });

// VERSÃO CORRIGIDA
app.use(express.json({ limit: '50mb' }));


// --- ROTAS PÚBLICAS ---
app.get('/api/cotacao', async (req, res) => {
    try {
        const apiResponse = await fetch('https://api.frankfurter.app/latest?from=USD&to=BRL');
        if (!apiResponse.ok) throw new Error(`API de cotação falhou: ${apiResponse.statusText}`);
        const data = await apiResponse.json();
        res.json(data);
    } catch (error) {
        console.error("Falha ao buscar cotação:", error.message);
        res.json({ error: true, message: "Não foi possível buscar a cotação da moeda." });
    }
});

app.post('/api/webhook', async (req, res) => {
    const { campanhas } = req.body;
    if (!campanhas || !Array.isArray(campanhas)) return res.status(400).send("Formato inválido.");
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const campanha of campanhas) {
            const upsertCampanhaSql = `INSERT INTO campanhas (id, nome, conta, codigo_moeda) VALUES ($1, $2, $3, $4) ON CONFLICT(id) DO UPDATE SET nome=EXCLUDED.nome, conta=EXCLUDED.conta, codigo_moeda=EXCLUDED.codigo_moeda;`;
            await client.query(upsertCampanhaSql, [campanha.id, campanha.nomeCampanha, campanha.conta, campanha.codigoMoeda]);
            if (campanha.dadosRecentes) {
                for (const dia of campanha.dadosRecentes) {
                    const selectSql = `SELECT id, conversoes_editado, checkouts_editado, valor_conversoes_editado, visitors_editado FROM desempenho_diario WHERE id_campanha = $1 AND "data" = $2`;
                    const { rows } = await client.query(selectSql, [campanha.id, dia.data]);
                    const custo = (dia.cliques || 0) * (dia.cpcMedio || 0);
                    if (rows.length > 0) {
                        const row = rows[0];
                        const updateSql = `UPDATE desempenho_diario SET impressoes=$1, cliques=$2, custo=$3, cpc_medio=$4, ctr=$5, parcela_impressao=$6, parcela_superior=$7, parcela_abs_superior=$8, orcamento_diario=$9, estrategia_lance=$10, nome_estrategia_lance=$11, cpa_desejado=$12, cpc_maximo=$13, conversoes=CASE WHEN $14=0 THEN $15 ELSE conversoes END, checkouts=CASE WHEN $16=0 THEN $17 ELSE checkouts END, valor_conversoes=CASE WHEN $18=0 THEN $19 ELSE valor_conversoes END, visitors=CASE WHEN $20=0 THEN $21 ELSE visitors END WHERE id=$22`;
                        await client.query(updateSql, [dia.impressoes, dia.cliques, custo, dia.cpcMedio, dia.ctr, dia.searchImpressionShare, dia.topImpressionPercentage, dia.absoluteTopImpressionPercentage, dia.orcamentoDiario, dia.estrategia, dia.nomeEstrategia, dia.cpaDesejado, dia.cpcMaximo, row.conversoes_editado, dia.conversoes, row.checkouts_editado, dia.checkouts, row.valor_conversoes_editado, dia.valorConversoes, row.visitors_editado, dia.visitors, row.id]);
                    } else {
                        const insertSql = `
INSERT INTO desempenho_diario (
    id_campanha, "data", impressoes, cliques, conversoes, valor_conversoes, checkouts, visitors,
    ctr, cpc_medio, parcela_impressao, parcela_superior, parcela_abs_superior,
    orcamento_diario, estrategia_lance, nome_estrategia_lance, cpa_desejado, cpc_maximo
) VALUES (
    $1,$2,$3,$4,$5,$6,$7,$8,
    $9,$10,$11,$12,$13,
    $14,$15,$16,$17,$18
)`;
                        await client.query(insertSql, [
                            campanha.id, dia.data, dia.impressoes, dia.cliques, dia.conversoes, dia.valorConversoes, dia.checkouts, dia.visitors,
                            dia.ctr, dia.cpcMedio, dia.searchImpressionShare, dia.topImpressionPercentage, dia.absoluteTopImpressionPercentage,
                            dia.orcamentoDiario, dia.estrategia, dia.nomeEstrategia, dia.cpaDesejado, dia.cpcMaximo
                        ]);
                    }
                }
            }
        }
        const timestamp = new Date();
        const detalhes = `Dados de ${campanhas.length} campanhas foram processados.`;
        await client.query(`INSERT INTO historico_atualizacoes (timestamp, status, detalhes) VALUES ($1, 'Sucesso', $2)`, [timestamp, detalhes]);
        await client.query('COMMIT');
        res.status(200).send('OK');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Erro no processamento do webhook:', err);
        res.status(500).send('Erro interno do servidor');
    } finally {
        client.release();
    }
});

app.use(authMiddleware);
app.use(express.static('public'));

app.post('/api/salvar', async (req, res) => {
    const { id, campo, valor } = req.body;
    const camposNumericos = ['checkouts', 'conversoes', 'valor_conversoes', 'visitors'];
    const camposTexto = ['alteracoes', 'pagina', 'nome_estrategia_lance'];
    if (![...camposNumericos, ...camposTexto].includes(campo)) return res.status(400).send('Campo ou ID inválido.');
    try {
        if (camposNumericos.includes(campo)) {
            const campoEditadoFlag = `${campo}_editado`;
            await pool.query(`UPDATE desempenho_diario SET ${campo}=$1, ${campoEditadoFlag}=1 WHERE id=$2`, [valor, id]);
        } else {
            await pool.query(`UPDATE desempenho_diario SET ${campo}=$1 WHERE id=$2`, [valor, id]);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/resumo', async (req, res) => {
    const { inicio, fim } = req.query;
    let sql, params;
    if (inicio && fim) {
        sql = `SELECT c.id, c.nome, c.conta, c.codigo_moeda, SUM(d.impressoes) as impressoes, SUM(d.cliques) as cliques, SUM(d.custo) as custo, SUM(d.checkouts) as checkouts, SUM(d.conversoes) as conversoes, SUM(d.valor_conversoes) as valor_conversoes, (SUM(d.valor_conversoes) - SUM(d.custo)) as resultado, CASE WHEN SUM(d.cliques) > 0 THEN SUM(d.custo) / SUM(d.cliques) ELSE 0 END as cpc_medio, CASE WHEN SUM(d.custo) > 0 THEN (SUM(d.valor_conversoes) - SUM(d.custo)) / SUM(d.custo) ELSE 0 END as roi FROM campanhas c LEFT JOIN desempenho_diario d ON c.id = d.id_campanha WHERE d."data" BETWEEN $1 AND $2 GROUP BY c.id ORDER BY c.nome ASC;`;
        params = [inicio, fim];
    } else {
        const hoje = new Date().toISOString().slice(0, 10);
        sql = `SELECT c.id, c.nome, c.conta, c.codigo_moeda, d.impressoes, d.cliques, d.custo, d.checkouts, d.conversoes, d.valor_conversoes, d.cpc_medio, (d.valor_conversoes - d.custo) as resultado, CASE WHEN d.custo > 0 THEN (d.valor_conversoes - d.custo) / d.custo ELSE 0 END as roi FROM campanhas c LEFT JOIN desempenho_diario d ON c.id = d.id_campanha AND d."data" = $1 ORDER BY c.nome ASC;`;
        params = [hoje];
    }
    try {
        const { rows } = await pool.query(sql, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/dados/:id_campanha', async (req, res) => {
    const { id_campanha } = req.params;
    try {
        const resCampanha = await pool.query(`SELECT * FROM campanhas WHERE id = $1`, [id_campanha]);
        const resDesempenho = await pool.query(`SELECT * FROM desempenho_diario WHERE id_campanha = $1 ORDER BY "data" DESC`, [id_campanha]);
        res.json({ info: resCampanha.rows[0], historico: resDesempenho.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/ultima-atualizacao', async (req, res) => {
    try {
        const { rows } = await pool.query(`SELECT timestamp AS valor FROM historico_atualizacoes ORDER BY timestamp DESC LIMIT 1`);
        res.json(rows[0] || {});
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/configuracoes/:chave', async (req, res) => {
    const { chave } = req.params;
    try {
        const { rows } = await pool.query(`SELECT valor FROM configuracoes WHERE chave = $1`, [chave]);
        res.json(rows[0] || {});
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/configuracoes', async (req, res) => {
    const { chave, valor } = req.body;
    const sql = `INSERT INTO configuracoes (chave, valor) VALUES ($1, $2) ON CONFLICT(chave) DO UPDATE SET valor=EXCLUDED.valor;`;
    try {
        await pool.query(sql, [chave, valor]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- INICIALIZAÇÃO DO SERVIDOR ---
// Função que garante que o BD está pronto antes de iniciar o servidor
const startServer = async () => {
  await criarTabelasSeNaoExistir();
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
  });
};

startServer();

const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/detalhes.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'detalhes.html'));
});
