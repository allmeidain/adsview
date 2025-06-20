// VERSÃO FINAL COM AUTENTICAÇÃO - 16/06/2025
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const fetch = require('node-fetch');
const basicAuth = require('express-basic-auth');
const app = express();
const PORTA = 3000;

// --- LÓGICA DE AUTENTICAÇÃO ---
// Lê o usuário e a senha das "Variáveis de Ambiente" para segurança.
// Se não encontrar, usa 'admin' e 'password' como padrão para testes locais.
const users = {};
const adminUser = process.env.ADMIN_USERNAME || 'admin';
const adminPass = process.env.ADMIN_PASSWORD || 'password';
users[adminUser] = adminPass;

const authMiddleware = basicAuth({
    users: users,
    challenge: true, // Isso faz o navegador mostrar a janela de login
    unauthorizedResponse: 'Acesso não autorizado. Verifique suas credenciais.'
});

// --- CONFIGURAÇÃO DO SERVIDOR E ROTAS ---
const CAMINHO_BD = process.env.RENDER_DISK_MOUNT_PATH ? `${process.env.RENDER_DISK_MOUNT_PATH}/database.db` : './database.db';

app.use(express.json());

// NOVO: Middleware para desativar o cache em todas as rotas da API
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// --- ROTAS PÚBLICAS (NÃO EXIGEM SENHA) ---
// A rota do webhook deve ser pública para que o Google Ads possa acessá-la.
app.post('/api/webhook', (req, res) => {
    const { campanhas } = req.body;
    if (!campanhas) return res.status(400).send("Formato inválido.");

    db.serialize(() => {
        campanhas.forEach(campanha => {
            const upsertCampanhaSql = `INSERT INTO campanhas (id, nome, conta, codigo_moeda) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET nome=excluded.nome, conta=excluded.conta, codigo_moeda=excluded.codigo_moeda;`;
            db.run(upsertCampanhaSql, [campanha.id, campanha.nomeCampanha, campanha.conta, campanha.codigoMoeda]);

            if (campanha.dadosRecentes) {
                campanha.dadosRecentes.forEach(dia => {
                    const selectSql = `SELECT * FROM desempenho_diario WHERE id_campanha = ? AND data = ?`;
                    db.get(selectSql, [campanha.id, dia.data], (err, row) => {
                        const custo = (dia.cliques || 0) * (dia.cpcMedio || 0);
                        if (row) { // UPDATE
                            const updateSql = `
                                UPDATE desempenho_diario SET
                                    impressoes = ?, cliques = ?, custo = ?, cpc_medio = ?, ctr = ?,
                                    parcela_impressao = ?, parcela_superior = ?, parcela_abs_superior = ?,
                                    orcamento_diario = ?, estrategia_lance = ?, nome_estrategia_lance = ?,
                                    cpa_desejado = ?, cpc_maximo = ?,
                                    conversoes = CASE WHEN conversoes_editado = 0 THEN ? ELSE conversoes END,
                                    checkouts = CASE WHEN checkouts_editado = 0 THEN ? ELSE checkouts END,
                                    valor_conversoes = CASE WHEN valor_conversoes_editado = 0 THEN ? ELSE valor_conversoes END,
                                    visitors = CASE WHEN visitors_editado = 0 THEN ? ELSE visitors END
                                WHERE id = ?`;
                            const params = [
                                dia.impressoes, dia.cliques, custo, dia.cpcMedio, dia.ctr,
                                dia.searchImpressionShare, dia.topImpressionPercentage, dia.absoluteTopImpressionPercentage,
                                dia.orcamentoDiario, dia.estrategia, dia.nomeEstrategia,
                                dia.cpaDesejado, dia.cpcMaximo,
                                dia.conversoes, dia.checkouts, dia.valorConversoes,
                                dia.visitors,
                                row.id
                            ];
                            db.run(updateSql, params);
                        } else { // INSERT
                            const insertSql = `
                                INSERT INTO desempenho_diario (
                                    id_campanha, data, impressoes, cliques, custo, cpc_medio, ctr,
                                    parcela_impressao, parcela_superior, parcela_abs_superior,
                                    orcamento_diario, estrategia_lance, nome_estrategia_lance, pagina,
                                    cpa_desejado, cpc_maximo,
                                    conversoes, checkouts, valor_conversoes, visitors, alteracoes
                                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                            const params = [
                                campanha.id, dia.data, dia.impressoes, dia.cliques, custo, dia.cpcMedio, dia.ctr,
                                dia.searchImpressionShare, dia.topImpressionPercentage, dia.absoluteTopImpressionPercentage,
                                dia.orcamentoDiario, dia.estrategia, dia.nomeEstrategia, dia.pagina,
                                dia.cpaDesejado, dia.cpcMaximo,
                                dia.conversoes, dia.checkouts, dia.valorConversoes, dia.visitors, dia.alteracoes
                            ];
                            db.run(insertSql, params);
                        }
                    });
                });
            }
        });
    });
    // NOVO: Insere um registro na nova tabela de histórico
const timestamp = new Date().toISOString();
const detalhes = `Dados de ${campanhas.length} campanhas foram processados.`;
const sqlHistorico = `INSERT INTO historico_atualizacoes (timestamp, status, detalhes) VALUES (?, 'Sucesso', ?)`;
db.run(sqlHistorico, [timestamp, detalhes]);    db.run(sqlTimestamp, [timestamp]);
    res.status(200).send('OK');
});

app.get('/api/cotacao', async (req, res) => {
    try {
        const apiResponse = await fetch('https://api.frankfurter.app/latest?from=USD&to=BRL');
        if (!apiResponse.ok) {
            // Lança um erro se a resposta não for bem-sucedida (ex: 404, 500)
            throw new Error(`Erro na API de cotação: ${apiResponse.statusText}`);
        }
        const data = await apiResponse.json();
        res.json(data);
    } catch (error) {
        // Se ocorrer qualquer erro (incluindo o ECONNRESET do seu firewall),
        // ele cairá aqui.
        console.error("Falha ao buscar cotação (ECONNRESET esperado):", error.message);
        
        // Em vez de retornar um erro 500, retornamos um sucesso (200)
        // com um objeto que indica a falha.
        res.json({ error: true, message: "Não foi possível buscar a cotação da moeda." });
    }
});

// --- APLICAÇÃO DA SENHA ---
// Todas as rotas definidas ABAIXO desta linha exigirão login e senha.
app.use(authMiddleware);

// --- ROTAS PROTEGIDAS ---
app.use(express.static('public'));

app.post('/api/salvar', (req, res) => {
    const { id, campo, valor } = req.body;
    const camposNumericos = ['checkouts', 'conversoes', 'valor_conversoes', 'visitors'];
    const camposTexto = ['alteracoes', 'pagina', 'nome_estrategia_lance'];
    if (![...camposNumericos, ...camposTexto].includes(campo) || !id) {
        return res.status(400).send('Campo ou ID inválido.');
    }
    let sql, params;
    if (camposNumericos.includes(campo)) {
        const campoEditadoFlag = `${campo}_editado`;
        sql = `UPDATE desempenho_diario SET ${campo} = ?, ${campoEditadoFlag} = 1 WHERE id = ?`;
        params = [valor, id];
    } else { 
        sql = `UPDATE desempenho_diario SET ${campo} = ? WHERE id = ?`;
        params = [valor, id];
    }
    db.run(sql, params, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(200).json({ success: true });
    });
});

app.get('/api/resumo', (req, res) => {
    const { inicio, fim } = req.query;
    let sql, params;
    if (inicio && fim) {
        sql = `
            SELECT
                c.id, c.nome, c.conta, c.codigo_moeda,
                SUM(d.impressoes) as impressoes, SUM(d.cliques) as cliques, SUM(d.custo) as custo,
                SUM(d.checkouts) as checkouts, SUM(d.conversoes) as conversoes, SUM(d.valor_conversoes) as valor_conversoes,
                (SUM(d.valor_conversoes) - SUM(d.custo)) as resultado,
                CASE WHEN SUM(d.cliques) > 0 THEN SUM(d.custo) / SUM(d.cliques) ELSE 0 END as cpc_medio,
                CASE WHEN SUM(d.custo) > 0 THEN (SUM(d.valor_conversoes) - SUM(d.custo)) / SUM(d.custo) ELSE 0 END as roi
            FROM campanhas c
            LEFT JOIN desempenho_diario d ON c.id = d.id_campanha WHERE d.data BETWEEN ? AND ?
            GROUP BY c.id, c.nome, c.conta, c.codigo_moeda ORDER BY c.nome ASC;`;
        params = [inicio, fim];
    } else {
        const hoje = new Date().toISOString().slice(0, 10);
        sql = `
            SELECT
                c.id, c.nome, c.conta, c.codigo_moeda, d.impressoes, d.cliques, d.custo,
                d.checkouts, d.conversoes, d.valor_conversoes, d.cpc_medio,
                (d.valor_conversoes - d.custo) as resultado,
                CASE WHEN d.custo > 0 THEN (d.valor_conversoes - d.custo) / d.custo ELSE 0 END as roi
            FROM campanhas c
            LEFT JOIN desempenho_diario d ON c.id = d.id_campanha AND d.data = ?
            ORDER BY c.nome ASC;`;
        params = [hoje];
    }
    db.all(sql, params, (err, linhas) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json(linhas);
    });
});

app.get('/api/dados/:id_campanha', (req, res) => {
    const idCampanha = req.params.id_campanha;
    const respostaFinal = {};
    const sqlCampanha = `SELECT * FROM campanhas WHERE id = ?`;
    db.get(sqlCampanha, [idCampanha], (err, campanhaInfo) => {
        if (err) return res.status(500).json({ error: err.message });
        respostaFinal.info = campanhaInfo;
        const sqlDesempenho = `SELECT * FROM desempenho_diario WHERE id_campanha = ? ORDER BY data DESC`;
        db.all(sqlDesempenho, [idCampanha], (err, desempenho) => {
            if (err) return res.status(500).json({ error: err.message });
            respostaFinal.historico = desempenho;
            res.json(respostaFinal);
        });
    });
});

app.get('/api/ultima-atualizacao', (req, res) => {
    // Busca o registro mais recente da nova tabela de histórico
    const sql = `SELECT timestamp AS valor FROM historico_atualizacoes ORDER BY timestamp DESC LIMIT 1`;
    db.get(sql, [], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(row || {}); // Retorna o objeto { valor: "..." } ou um objeto vazio
    });
});
app.get('/api/configuracoes/:chave', (req, res) => {
    const { chave } = req.params;
    const sql = `SELECT valor FROM configuracoes WHERE chave = ?`;
    db.get(sql, [chave], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row || {});
    });
});

app.post('/api/configuracoes', (req, res) => {
    const { chave, valor } = req.body;
    const sql = `INSERT INTO configuracoes (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor;`;
    db.run(sql, [chave, valor], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(200).json({ success: true });
    });
});

// ROTA TEMPORÁRIA E SECRETA PARA DOWNLOAD DO BANCO DE DADOS
app.get('/admin/baixardb', (req, res) => {
  // Garante que estamos pegando o caminho correto do banco de dados (nuvem ou local)
  const caminhoDoBanco = process.env.RENDER_DISK_MOUNT_PATH 
    ? `${process.env.RENDER_DISK_MOUNT_PATH}/database.db` 
    : './database.db';

  console.log(`[ADMIN] Tentativa de download do banco de dados de: ${caminhoDoBanco}`);

  // O método res.download() prepara o arquivo para ser baixado pelo navegador
  res.download(caminhoDoBanco, 'backup_banco.db', (err) => {
    if (err) {
      console.error("Erro ao baixar o banco de dados:", err);
      // Se o arquivo não for encontrado ou houver outro erro, informa o usuário.
      res.status(404).send("Arquivo não encontrado ou erro ao processar o download.");
    }
  });
});

// --- INICIALIZAÇÃO DO BANCO DE DADOS E DO SERVIDOR ---
const db = new sqlite3.Database(CAMINHO_BD, (err) => {
    if (err) return console.error("Erro ao abrir o banco de dados:", err.message);
    
    console.log("Conectado com sucesso ao banco de dados SQLite.");
    db.exec('PRAGMA foreign_keys = ON;');

    const sqlCriarTabelaCampanhas = `CREATE TABLE IF NOT EXISTS campanhas (id TEXT PRIMARY KEY, nome TEXT, conta TEXT, codigo_moeda TEXT);`;
    const sqlCriarTabelaDesempenho = `
        CREATE TABLE IF NOT EXISTS desempenho_diario (
            id INTEGER PRIMARY KEY AUTOINCREMENT, id_campanha TEXT NOT NULL, data TEXT NOT NULL,
            impressoes INTEGER, cliques INTEGER, custo REAL, cpc_medio REAL, ctr REAL,
            parcela_impressao REAL, parcela_superior REAL, parcela_abs_superior REAL,
            orcamento_diario REAL, estrategia_lance TEXT, nome_estrategia_lance TEXT, pagina TEXT,
            checkouts INTEGER DEFAULT 0, conversoes INTEGER, valor_conversoes REAL DEFAULT 0,
            visitors INTEGER DEFAULT 0,
            checkouts_editado INTEGER DEFAULT 0, conversoes_editado INTEGER DEFAULT 0, valor_conversoes_editado INTEGER DEFAULT 0,
            visitors_editado INTEGER DEFAULT 0,
            alteracoes TEXT, cpa_desejado REAL, cpc_maximo REAL,
            UNIQUE(id_campanha, data), FOREIGN KEY(id_campanha) REFERENCES campanhas(id) ON DELETE CASCADE
        );`;
    const sqlCriarTabelaConfig = `CREATE TABLE IF NOT EXISTS configuracoes (chave TEXT PRIMARY KEY, valor TEXT);`;

    // NOVO: SQL para criar a tabela de histórico
    const sqlCriarTabelaHistorico = `
        CREATE TABLE IF NOT EXISTS historico_atualizacoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            status TEXT,
            detalhes TEXT
        );`;


    db.serialize(() => {
        db.run(sqlCriarTabelaCampanhas);
        db.run(sqlCriarTabelaDesempenho);
        db.run(sqlCriarTabelaConfig);
        db.run(sqlCriarTabelaHistorico); // NOVO: Executa a criação da tabela
    });
});

app.listen(process.env.PORT || PORTA, () => {
    console.log(`🚀 Servidor (vFinal com Auth) rodando em http://localhost:${PORTA}`);
});
