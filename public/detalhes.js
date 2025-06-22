// --- VARIÁVEIS GLOBAIS --- 
let alteracoes = {};
let historicoCompleto = [];
let dadosAtuaisDaTabela = [];
let infoCampanha = {};
let ordemColunasAtual = [];

// --- MAPA DE COLUNAS ---
const MAPA_COLUNAS = {
    data: { 
        nome: 'Data', 
        formatador: (item, moeda) => {
            if (!item.data) return '';
            const d = new Date(item.data);
            const dia = String(d.getUTCDate()).padStart(2, '0');
            const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
            const ano = d.getUTCFullYear();
            return `${dia}/${mes}/${ano}`;
        }
    },
    impressoes: { nome: 'Impressões', formatador: (item, moeda) => (item.impressoes || 0).toLocaleString('pt-BR') },
    cliques: { nome: 'Cliques', formatador: (item, moeda) => (item.cliques || 0).toLocaleString('pt-BR') },
    custo: { nome: 'Custo', formatador: (item, moeda) => (item.custo || 0).toLocaleString('pt-BR', { style: 'currency', currency: moeda }) },
    cpc_medio: { nome: 'CPC<br>Médio', formatador: (item, moeda) => (item.cpc_medio || 0).toLocaleString('pt-BR', { style: 'currency', currency: moeda }) },
    cpa_desejado: { 
        nome: 'CPA<br>Desejado', 
        formatador: (item, moeda) => (item.cpa_desejado || 0).toLocaleString('pt-BR', { style: 'currency', currency: moeda }),
        editavel: true
    },
    cpc_maximo: { 
        nome: 'CPC<br>Máximo', 
        formatador: (item, moeda) => (item.cpc_maximo || 0).toLocaleString('pt-BR', { style: 'currency', currency: moeda }),
        editavel: true
    },
    ctr: { nome: 'CTR<br>(%)', formatador: (item, moeda) => ((item.ctr || 0) * 100).toFixed(2) + '%' },
    parcela_impressao: { 
        nome: 'Parc.<br>Impressão', 
        formatador: (item, moeda) => {
            const valor = (item.parcela_impressao || 0) * 100;
            if (valor < 10 && valor > 0) return '<10%';
            return valor.toFixed(2) + '%';
        }
    },
    parcela_superior: { 
        nome: 'Parc.<br>Superior', 
        formatador: (item, moeda) => {
            const valor = (item.parcela_superior || 0) * 100;
            if (valor < 10 && valor > 0) return '<10%';
            return valor.toFixed(2) + '%';
        }
    },
    parcela_abs_superior: { 
        nome: '1ª<br>Posição', 
        formatador: (item, moeda) => {
            const valor = (item.parcela_abs_superior || 0) * 100;
            if (valor < 10 && valor > 0) return '<10%';
            return valor.toFixed(2) + '%';
        }
    },
    visitors: { nome: 'Visitors', editavel: true },
    checkouts: { nome: 'Checkouts', editavel: true },
    conversoes: { nome: 'Conversões', editavel: true },
    valor_conversoes: { nome: 'Valor das<br>Conversões', editavel: true },
    orcamento_diario: { 
        nome: 'Orçamento<br>Diário', 
        formatador: (item, moeda) => (item.orcamento_diario || 0).toLocaleString('pt-BR', { style: 'currency', currency: moeda }),
        editavel: true
    },
    estrategia_lance: { 
        nome: 'Estratégia<br>de Lance', 
        formatador: (item, moeda) => item.estrategia_lance,
        editavel: true,
        tipo: 'texto'
    },
    nome_estrategia_lance: { nome: 'Nome da<br>Estratégia', editavel: true, tipo: 'texto' },
    pagina: { nome: 'Página', editavel: true, tipo: 'texto' },
    alteracoes: { nome: 'Alterações', editavel: true, tipo: 'texto' },
};
const ORDEM_PADRAO = Object.keys(MAPA_COLUNAS);

// --- FUNÇÕES DE LÓGICA E RENDERIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const idCampanha = params.get('id');
    if (idCampanha) {
        buscarDadosDaCampanha(idCampanha);
        adicionarListenersDeFiltro();
    }
    document.getElementById('btn-salvar').addEventListener('click', salvarAlteracoes);

    // NOVO: Evento para o botão de exportar detalhes
    document.getElementById('btn-exportar-csv-detalhes').addEventListener('click', () => {
        if (!dadosAtuaisDaTabela || dadosAtuaisDaTabela.length === 0) {
            alert("Não há dados para exportar com os filtros atuais.");
            return;
        }

        // Gera os cabeçalhos a partir da ordem atual das colunas, removendo as tags <br>
        const headers = ordemColunasAtual.map(chave => 
            MAPA_COLUNAS[chave] ? MAPA_COLUNAS[chave].nome.replace(/<br>/g, ' ') : ''
        );
        
        // Prepara as linhas com os dados brutos
        const dataRows = dadosAtuaisDaTabela.map(item => {
            return ordemColunasAtual.map(chave => item[chave] || '');
        });

        const dataHoje = new Date().toISOString().slice(0, 10);
        exportarParaCSV(headers, dataRows, `detalhes_${infoCampanha.id}_${dataHoje}.csv`);
    });
});

async function buscarDadosDaCampanha(id) {
    try {
        const [dadosResp, configResp] = await Promise.all([
            fetch(`/api/dados/${id}`),
            fetch(`/api/configuracoes/ordem_colunas_detalhes`)
        ]);
        if (!dadosResp.ok) throw new Error(`Erro ao buscar dados: ${dadosResp.statusText}`);
        
        const dados = await dadosResp.json();
        const config = await configResp.json();
        
        infoCampanha = dados.info;
        historicoCompleto = dados.historico;
        ordemColunasAtual = config.valor ? JSON.parse(config.valor) : ORDEM_PADRAO;

        document.getElementById('nome-campanha').innerText = infoCampanha.nome;
        document.getElementById('id-conta').innerText = `Conta: ${infoCampanha.conta || 'N/A'}`;

        // Troque o filtro padrão para "últimos 7 dias"
        document.querySelector('.filtro-data-botoes button[data-periodo="7d"]').click();
    } catch (erro) { 
        console.error("Falha ao buscar dados da campanha:", erro);
        document.getElementById('metricas-recentes').innerHTML = "<p>Ocorreu um erro ao carregar os dados.</p>";
    }
}

function renderizarPagina(dadosFiltrados) {
    dadosAtuaisDaTabela = dadosFiltrados;
    renderizarTotais(dadosAtuaisDaTabela);
    renderizarTabelaPrincipal(dadosAtuaisDaTabela);
}

function renderizarTotais(dados) {
    const container = document.getElementById('header-totais');
    const moeda = infoCampanha.codigo_moeda || 'BRL';
    
    const totais = dados.reduce((acc, item) => {
        acc.impressoes += item.impressoes || 0;
        acc.cliques += item.cliques || 0;
        acc.custo += item.custo || 0;
        acc.visitors += item.visitors || 0;
        acc.checkouts += item.checkouts || 0;
        acc.conversoes += item.conversoes || 0;
        acc.valor_conversoes += item.valor_conversoes || 0;
        return acc;
    }, { impressoes: 0, cliques: 0, custo: 0, visitors: 0, checkouts: 0, conversoes: 0, valor_conversoes: 0 });

    totais.resultado = totais.valor_conversoes - totais.custo;
    totais.roi = totais.custo > 0 ? totais.resultado / totais.custo : 0;

    const formatadorMoeda = (valor) => valor.toLocaleString('pt-BR', { style: 'currency', currency: moeda });
    const corResultado = totais.resultado >= 0 ? '#28a745' : '#dc3545';

    const totaisHTML = `
        <table class="totals-table">
            <thead>
                <tr>
                    <th>Impressões</th> <th>Cliques</th> <th>Custo</th> <th>Visitors</th>
                    <th>Checkouts</th> <th>Conversões</th> <th>Valor da Conv.</th>
                    <th>Resultado</th> <th>ROI</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>${totais.impressoes.toLocaleString('pt-BR')}</td>
                    <td>${totais.cliques.toLocaleString('pt-BR')}</td>
                    <td>${formatadorMoeda(totais.custo)}</td>
                    <td>${totais.visitors.toLocaleString('pt-BR')}</td>
                    <td>${totais.checkouts.toLocaleString('pt-BR')}</td>
                    <td>${totais.conversoes.toLocaleString('pt-BR')}</td>
                    <td>${formatadorMoeda(totais.valor_conversoes)}</td>
                    <td style="color: ${corResultado}; font-weight: 500;">${formatadorMoeda(totais.resultado)}</td>
                    <td style="color: ${corResultado}; font-weight: 500;">${totais.roi.toLocaleString('pt-BR', { style: 'percent', minimumFractionDigits: 2 })}</td>
                </tr>
            </tbody>
        </table>`;
    container.innerHTML = totaisHTML;
}

function renderizarTabelaPrincipal(dados) {
    const container = document.getElementById('metricas-recentes');
    container.innerHTML = construirTabelaDinamica(dados, ordemColunasAtual, infoCampanha.codigo_moeda);
    adicionarListenersDeInput();
    inicializarDragAndDrop();
}

function adicionarListenersDeFiltro() {
    const botoes = document.querySelectorAll('.filtro-data-botoes button');
    botoes.forEach(botao => {
        botao.addEventListener('click', (e) => {
            botoes.forEach(b => b.classList.remove('ativo'));
            e.target.classList.add('ativo');
            const periodo = e.target.dataset.periodo;
            let dadosFiltrados = [];
            const hoje = new Date();
            const ano = hoje.getFullYear();
            const mes = String(hoje.getMonth() + 1).padStart(2, '0');
            const dia = String(hoje.getDate()).padStart(2, '0');
            const hojeStr = `${ano}-${mes}-${dia}`;

            // Função para normalizar data para yyyy-mm-dd
            const normalizarData = (data) => {
                if (!data) return '';
                const d = new Date(data);
                const ano = d.getUTCFullYear();
                const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
                const dia = String(d.getUTCDate()).padStart(2, '0');
                return `${ano}-${mes}-${dia}`;
            };

            if (periodo === 'total') {
                dadosFiltrados = historicoCompleto;
            } else if (periodo === 'hoje') {
                dadosFiltrados = historicoCompleto.filter(item => normalizarData(item.data) === hojeStr);
            } else {
                let diasAtras = 0;
                if (periodo === '7d') diasAtras = 7;
                if (periodo === '30d') diasAtras = 30;

                const dataInicial = new Date();
                dataInicial.setDate(hoje.getDate() - (diasAtras - 1));
                const anoInicial = dataInicial.getFullYear();
                const mesInicial = String(dataInicial.getMonth() + 1).padStart(2, '0');
                const diaInicial = String(dataInicial.getDate()).padStart(2, '0');
                const dataInicialStr = `${anoInicial}-${mesInicial}-${diaInicial}`;

                dadosFiltrados = historicoCompleto.filter(item => {
                    const dataItem = normalizarData(item.data);
                    return dataItem >= dataInicialStr && dataItem <= hojeStr;
                });
            }
            renderizarPagina(dadosFiltrados);
        });
    });
}

// NOVO: Função genérica para exportar para CSV
function exportarParaCSV(headers, dataRows, filename) {
    let csvContent = headers.join(',') + '\r\n';

    dataRows.forEach(rowArray => {
        const row = rowArray.map(field => {
            let f = String(field === null || field === undefined ? '' : field).replace(/"/g, '""');
            return `"${f}"`;
        });
        csvContent += row.join(',') + '\r\n';
    });

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

function construirTabelaDinamica(historico, ordem, moeda) {
    let cabecalhoHTML = '<tr>';
    ordem.forEach(chave => {
        const coluna = MAPA_COLUNAS[chave];
        if (coluna) cabecalhoHTML += `<th data-key="${chave}" class="${coluna.editavel ? 'coluna-editavel' : ''}">${coluna.nome}</th>`;
    });
    cabecalhoHTML += '</tr>';
    const corpoHTML = construirCorpoTabela(historico, ordem, moeda);
    return `<table><thead id="cabecalho-tabela">${cabecalhoHTML}</thead><tbody id="corpo-tabela">${corpoHTML}</tbody></table>`;
}

function construirCorpoTabela(historico, ordemColunas, moeda) {
    if (!historico || historico.length === 0) return `<tr><td colspan="${ordemColunas.length}">Nenhum histórico encontrado para este período.</td></tr>`;
    let corpoHTML = '';
    historico.forEach(item => {
        corpoHTML += `<tr>`;
        ordemColunas.forEach(chave => {
            const coluna = MAPA_COLUNAS[chave];
            if (coluna) {
                // Destaque para checkouts e conversões > 0
                let destaque = '';
                if ((chave === 'checkouts' || chave === 'conversoes') && (item[chave] > 0)) {
                    destaque = ' destaque-celula';
                }
                if (coluna.editavel) {
                    if (coluna.tipo === 'texto') {
                        corpoHTML += `<td class="${destaque}"><input type="text" value="${item[chave] || ''}" data-id="${item.id}" data-campo="${chave}" class="input-editavel input-texto"></td>`;
                    } else {
                        const classEditado = item[`${chave}_editado`] ? 'editado' : '';
                        const valorFormatado = 
    (chave === 'valor_conversoes' || chave === 'orcamento_diario' || chave === 'cpa_desejado' || chave === 'cpc_maximo')
        ? (item[chave] || 0).toFixed(2)
        : (item[chave] || 0);
                        corpoHTML += `<td class="${destaque}"><input type="number" value="${valorFormatado}" data-id="${item.id}" data-campo="${chave}" class="input-editavel ${classEditado}" step="${(chave === 'valor_conversoes' || chave === 'orcamento_diario' || chave === 'cpa_desejado' || chave === 'cpc_maximo') ? '0.01' : '1'}"></td>`;
                    }
                } else {
                    corpoHTML += `<td class="${destaque}">${coluna.formatador(item, moeda)}</td>`;
                }
            }
        });
        corpoHTML += `</tr>`;
    });
    return corpoHTML;
}

function inicializarDragAndDrop() {
    const el = document.getElementById('cabecalho-tabela');
    if (!el) return;
    const tr = el.querySelector('tr');
    if (!tr) return;
    Sortable.create(tr, {
        animation: 150,
        onEnd: function (evt) {
            ordemColunasAtual = [...evt.target.children].map(th => th.dataset.key);
            salvarOrdemColunas(ordemColunasAtual);
            renderizarTabelaPrincipal(dadosAtuaisDaTabela);
        },
    });
}

async function salvarOrdemColunas(ordem) {
    try {
        await fetch('/api/configuracoes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chave: 'ordem_colunas_detalhes', valor: JSON.stringify(ordem) })
        });
    } catch (erro) {
        console.error("Erro ao salvar a ordem das colunas:", erro);
    }
}

function adicionarListenersDeInput() {
    document.querySelectorAll('.input-editavel').forEach(input => {
        if (['valor_conversoes', 'orcamento_diario', 'cpa_desejado', 'cpc_maximo'].includes(input.dataset.campo)) {
            input.addEventListener('blur', (e) => { e.target.value = parseFloat(e.target.value || 0).toFixed(2); });
        }
        input.addEventListener('change', (e) => {
            const id = e.target.dataset.id;
            const campo = e.target.dataset.campo;
            const valor = e.target.type === 'number' ? parseFloat(e.target.value || 0) : e.target.value;
            if (!alteracoes[id]) { alteracoes[id] = {}; }
            alteracoes[id][campo] = valor;
            e.target.classList.add('alterado');
            document.getElementById('btn-salvar').style.display = 'inline-block';
            document.getElementById('feedback-salvar').innerText = '';
        });
    });
}

async function salvarAlteracoes() {
    const btnSalvar = document.getElementById('btn-salvar');
    const feedback = document.getElementById('feedback-salvar');
    btnSalvar.disabled = true;
    feedback.innerText = 'Salvando...';
    const promessas = [];
    for (const id in alteracoes) {
        for (const campo in alteracoes[id]) {
            const valor = alteracoes[id][campo];
            promessas.push(fetch('/api/salvar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, campo, valor })
            }));
        }
    }
    try {
        await Promise.all(promessas);
        feedback.innerText = '✅ Salvo com sucesso!';
        alteracoes = {};
        document.querySelectorAll('.input-editavel.alterado').forEach(input => {
            input.classList.remove('alterado');
            input.classList.add('editado');
        });
        setTimeout(() => {
             btnSalvar.style.display = 'none';
             feedback.innerText = '';
        }, 2000);
    } catch (erro) {
        feedback.innerText = '❌ Erro ao salvar.';
        console.error("Erro ao salvar alterações:", erro);
    } finally {
        btnSalvar.disabled = false;
    }
}