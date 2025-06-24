// --- VARIÁVEIS GLOBAIS DE ESTADO ---
let todasCampanhas = [];
let campanhasSelecionadasIds = [];
let moedasSelecionadas = [];
let dadosAtuaisDaTabela = [];
let cotacaoAtual = null;
let timestampAtual = null;
let expanded = { campanhas: false, moedas: false };

// Variáveis globais para ordenação
let colunaOrdenada = null;
let ordemCrescente = true;

// --- FUNÇÕES DE LÓGICA E RENDERIZAÇÃO ---

function renderizarDashboard(campanhasParaRenderizar) {
    dadosAtuaisDaTabela = campanhasParaRenderizar;
    renderizarTotais(campanhasParaRenderizar);
    renderizarTabela(campanhasParaRenderizar);
    renderizarTimestamp(timestampAtual);
}

function renderizarTimestamp(timestamp) {
    const el = document.getElementById('info-ultima-atualizacao');
    if (timestamp && timestamp.valor) {
        const dataFormatada = new Date(timestamp.valor).toLocaleString('pt-BR', {
            year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
        el.innerHTML = `<small>Última atualização de dados: ${dataFormatada}</small>`;
    } else {
        el.innerHTML = `<small>Aguardando a primeira atualização de dados.</small>`;
    }
}

function renderizarTotais(campanhas) {
    const metricsContainer = document.getElementById('header-metrics');
    const totaisPorMoeda = {};

    campanhas.forEach(campanha => {
        const moeda = campanha.codigo_moeda || 'BRL';
        if (!totaisPorMoeda[moeda]) {
            totaisPorMoeda[moeda] = { custo: 0, valor_conversoes: 0, resultado: 0 };
        }
        totaisPorMoeda[moeda].custo += campanha.custo || 0;
        totaisPorMoeda[moeda].valor_conversoes += campanha.valor_conversoes || 0;
        totaisPorMoeda[moeda].resultado += campanha.resultado || 0;
    });

    const dataInicio = document.getElementById('data-inicio').value;
    const dataFim = document.getElementById('data-fim').value;
    const titulo = !dataInicio || dataInicio === dataFim ? 'Dia' : 'Período';
    
    let metricsHTML = `<table class="totals-table"><thead><tr>
        <th>Moeda</th><th>Custo Total (${titulo})</th><th>Valor Total de Conv. (${titulo})</th><th>Resultado Total (${titulo})</th><th>ROI Total (${titulo})</th>
    </tr></thead><tbody>`;

    for (const moeda in totaisPorMoeda) {
        const totais = totaisPorMoeda[moeda];
        const corResultado = totais.resultado >= 0 ? '#28a745' : '#dc3545';
        const roiTotal = totais.custo > 0 ? totais.resultado / totais.custo : 0;
        
        metricsHTML += `<tr>
            <td>${moeda}</td>
            <td>${totais.custo.toLocaleString('pt-BR', { style: 'currency', currency: moeda })}</td>
            <td>${totais.valor_conversoes.toLocaleString('pt-BR', { style: 'currency', currency: moeda })}</td>
            <td style="color: ${corResultado}; font-weight: 500;">${totais.resultado.toLocaleString('pt-BR', { style: 'currency', currency: moeda })}</td>
            <td style="color: ${corResultado}; font-weight: 500;">${roiTotal.toLocaleString('pt-BR', { style: 'percent', minimumFractionDigits: 2 })}</td>
        </tr>`;
    }

    if (cotacaoAtual && cotacaoAtual.rates && cotacaoAtual.rates.BRL && totaisPorMoeda['USD'] && Object.keys(totaisPorMoeda).length > 1) {
        const taxaCambio = cotacaoAtual.rates.BRL;
        let custoConsolidado = (totaisPorMoeda['BRL']?.custo || 0) + ((totaisPorMoeda['USD']?.custo || 0) * taxaCambio);
        let valorConsolidado = (totaisPorMoeda['BRL']?.valor_conversoes || 0) + ((totaisPorMoeda['USD']?.valor_conversoes || 0) * taxaCambio);
        const resultadoConsolidado = valorConsolidado - custoConsolidado;
        const roiConsolidado = custoConsolidado > 0 ? resultadoConsolidado / custoConsolidado : 0;
        const corResultadoConsolidado = resultadoConsolidado >= 0 ? '#28a745' : '#dc3545';
        
        metricsHTML += `<tr class="total-consolidado-row">
            <td>Total (BRL)</td>
            <td>${custoConsolidado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
            <td>${valorConsolidado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
            <td style="color: ${corResultadoConsolidado}; font-weight: 500;">${resultadoConsolidado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
            <td style="color: ${corResultadoConsolidado}; font-weight: 500;">${roiConsolidado.toLocaleString('pt-BR', { style: 'percent', minimumFractionDigits: 2 })}</td>
        </tr>`;
    }

    metricsHTML += `</tbody></table>`;
    if (Object.keys(totaisPorMoeda).length === 0) {
        metricsContainer.innerHTML = '';
    } else {
        metricsContainer.innerHTML = metricsHTML;
    }
}

function renderizarTabela(campanhas) {
    const container = document.getElementById('resumo-container');
    // Adicionamos um ID ao thead para facilitar a seleção posterior
    let tabelaHTML = `<div class="table-wrapper"><table><thead id="cabecalho-tabela"><tr>
        <th data-coluna="id">ID da Campanha</th>
        <th data-coluna="nome">Nome da Campanha</th>
        <th data-coluna="impressoes">Impressões</th>
        <th data-coluna="cliques">Cliques</th>
        <th data-coluna="cpc_medio">CPC Médio</th>
        <th data-coluna="custo">Custo</th>
        <th data-coluna="checkouts">Checkouts</th>
        <th data-coluna="conversoes">Conversões</th>
        <th data-coluna="valor_conversoes">Valor Conv.</th>
        <th data-coluna="resultado">Resultado</th>
        <th data-coluna="roi">ROI</th>
    </tr></thead><tbody>`;
    
    if (campanhas.length === 0) {
        tabelaHTML += '<tr><td colspan="11">Nenhuma campanha para exibir com os filtros atuais.</td></tr>';
    } else {
        campanhas.forEach(campanha => {
            const moeda = campanha.codigo_moeda || 'BRL';
            const checkouts = (campanha.checkouts || 0).toLocaleString('pt-BR');
            const cpcMedio = (campanha.cpc_medio || 0).toLocaleString('pt-BR', { style: 'currency', currency: moeda });
            const custo = (campanha.custo || 0).toLocaleString('pt-BR', { style: 'currency', currency: moeda });
            const valorConversoes = (campanha.valor_conversoes || 0).toLocaleString('pt-BR', { style: 'currency', currency: moeda });
            const resultado = (campanha.resultado || 0).toLocaleString('pt-BR', { style: 'currency', currency: moeda });
            const roi = (campanha.roi || 0).toLocaleString('pt-BR', { style: 'percent', minimumFractionDigits: 2 });
            const corResultado = (campanha.resultado || 0) >= 0 ? '#28a745' : '#dc3545';

            tabelaHTML += `<tr>
                <td><a href="/detalhes.html?id=${campanha.id}">${campanha.id}</a></td><td><a href="/detalhes.html?id=${campanha.id}">${campanha.nome}</a></td>
                <td>${(campanha.impressoes || 0).toLocaleString('pt-BR')}</td><td>${(campanha.cliques || 0).toLocaleString('pt-BR')}</td><td>${cpcMedio}</td><td>${custo}</td>
                <td>${checkouts}</td><td>${(campanha.conversoes || 0).toLocaleString('pt-BR')}</td><td>${valorConversoes}</td>
                <td style="color: ${corResultado}; font-weight: 500;">${resultado}</td><td style="color: ${corResultado}; font-weight: 500;">${roi}</td>
            </tr>`;
        });
    }
    tabelaHTML += `</tbody></table></div>`;
    container.innerHTML = tabelaHTML;
}

// Função para ordenar campanhas (VERSÃO CORRIGIDA E COM FEEDBACK VISUAL)
function ordenarCampanhasPorColuna(coluna) {
    if (colunaOrdenada === coluna) {
        ordemCrescente = !ordemCrescente;
    } else {
        colunaOrdenada = coluna;
        ordemCrescente = true;
    }

    // Ordena o array de dados
    dadosAtuaisDaTabela.sort((a, b) => {
        let valA = a[coluna] === null || a[coluna] === undefined ? '' : a[coluna];
        let valB = b[coluna] === null || b[coluna] === undefined ? '' : b[coluna];

        // Trata valores numéricos e strings
        if (typeof valA === 'number' && typeof valB === 'number') {
            // Comparação numérica direta
        } else if (!isNaN(Number(valA)) && !isNaN(Number(valB)) && valA !== '' && valB !== '') {
            valA = Number(valA);
            valB = Number(valB);
        } else {
            valA = String(valA).toLowerCase();
            valB = String(valB).toLowerCase();
        }

        if (valA < valB) return ordemCrescente ? -1 : 1;
        if (valA > valB) return ordemCrescente ? 1 : -1;
        return 0;
    });

    // Re-renderiza a tabela com os dados ordenados
    renderizarTabela(dadosAtuaisDaTabela);

    // Adiciona o feedback visual na coluna correta
    document.querySelectorAll('#cabecalho-tabela th').forEach(th => {
        th.classList.remove('sorted-asc', 'sorted-desc');
    });

    const thAtivo = document.querySelector(`#cabecalho-tabela th[data-coluna="${coluna}"]`);
    if (thAtivo) {
        thAtivo.classList.add(ordemCrescente ? 'sorted-asc' : 'sorted-desc');
    }
}

function aplicarFiltros() {
    campanhasSelecionadasIds = Array.from(document.querySelectorAll('#checkboxes-campanhas input:checked')).map(cb => cb.value);
    moedasSelecionadas = Array.from(document.querySelectorAll('#checkboxes-moedas input:checked')).map(cb => cb.value);

    const campanhasFiltradas = todasCampanhas.filter(c => {
        const correspondeCampanha = campanhasSelecionadasIds.includes(String(c.id));
        const correspondeMoeda = moedasSelecionadas.includes(c.codigo_moeda || 'BRL');
        return correspondeCampanha && correspondeMoeda;
    });
    
    renderizarDashboard(campanhasFiltradas);
}

function popularFiltro(tipo, campanhas) {
    const container = document.getElementById(`checkboxes-${tipo}`);
    if (!container) return;
    container.innerHTML = '';
    
    let itemsUnicos = [];
    if (tipo === 'campanhas') {
        itemsUnicos = campanhas;
    } else if (tipo === 'moedas') {
        itemsUnicos = [...new Set(campanhas.map(c => c.codigo_moeda || 'BRL'))];
    }
    
    itemsUnicos.forEach(item => {
        const id = tipo === 'campanhas' ? item.id : item;
        const nome = tipo === 'campanhas' ? item.nome : item;
        const listaSelecao = tipo === 'campanhas' ? campanhasSelecionadasIds : moedasSelecionadas;
        
        const isChecked = listaSelecao.includes(String(id));
        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" value="${id}" ${isChecked ? 'checked' : ''} /> ${nome}`;
        label.addEventListener('change', aplicarFiltros);
        container.appendChild(label);
    });
}

async function carregarResumo(url) {
    const container = document.getElementById('resumo-container');
    container.innerHTML = '<p>Carregando dados...</p>';
    document.getElementById('header-metrics').innerHTML = '';

    try {
        const [respostaCampanhas, respostaCotacao, respostaTimestamp] = await Promise.all([
            fetch(url),
            fetch('/api/cotacao'),
            fetch('/api/ultima-atualizacao')
        ]);

        if (!respostaCampanhas.ok) throw new Error(`Erro na API de campanhas.`);
        
        todasCampanhas = await respostaCampanhas.json();
        cotacaoAtual = await respostaCotacao.json();
        timestampAtual = await respostaTimestamp.json();

        // --- AJUSTE: garantir que parcela_abs_superior exista mesmo que venha como absoluteTopImpressionPercentage ---
        todasCampanhas.forEach(c => {
            if (c.absoluteTopImpressionPercentage !== undefined && c.parcela_abs_superior === undefined) {
                c.parcela_abs_superior = c.absoluteTopImpressionPercentage;
            }
        });
        // --- FIM DO AJUSTE ---

        // Lógica simplificada: Sempre redefine os filtros ao carregar novos dados
        campanhasSelecionadasIds = todasCampanhas.map(c => String(c.id));
        moedasSelecionadas = [...new Set(todasCampanhas.map(c => c.codigo_moeda || 'BRL'))];

        if (!Array.isArray(todasCampanhas) || todasCampanhas.length === 0) {
            renderizarDashboard([], timestampAtual);
            popularFiltro('campanhas', []);
            popularFiltro('moedas', []);
            return;
        }

        popularFiltro('campanhas', todasCampanhas);
        popularFiltro('moedas', todasCampanhas);
        aplicarFiltros();

    } catch (erro) {
        container.innerHTML = `<p>Ocorreu um erro ao carregar o resumo. Verifique o console.</p>`;
        console.error("Falha ao carregar o resumo:", erro);
    }
}

function toggleCheckboxes(tipo) {
    const checkboxes = document.getElementById(`checkboxes-${tipo}`);
    if(!checkboxes) return;
    const outroTipo = tipo === 'campanhas' ? 'moedas' : 'campanhas';
    const outroCheckbox = document.getElementById(`checkboxes-${outroTipo}`);
    if (outroCheckbox) {
        outroCheckbox.style.display = 'none';
        expanded[outroTipo] = false;
    }
    expanded[tipo] = !expanded[tipo];
    checkboxes.style.display = expanded[tipo] ? "block" : "none";
}

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

// Bloco DOMContentLoaded (VERSÃO CORRIGIDA E LIMPA)
document.addEventListener('DOMContentLoaded', () => {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia = String(hoje.getDate()).padStart(2, '0');
    const hojeFormatadoLocal = `${ano}-${mes}-${dia}`;
    
    document.getElementById('data-inicio').value = hojeFormatadoLocal;
    document.getElementById('data-fim').value = hojeFormatadoLocal;

    const urlInicial = `/api/resumo?inicio=${hojeFormatadoLocal}&fim=${hojeFormatadoLocal}`;
    carregarResumo(urlInicial);

    document.getElementById('btn-filtrar').addEventListener('click', () => {
        const url = `/api/resumo?inicio=${document.getElementById('data-inicio').value}&fim=${document.getElementById('data-fim').value}`;
        carregarResumo(url);
    });

    // Cole este bloco dentro do seu 'DOMContentLoaded' listener em script.js

document.getElementById('filtro-rapido-container').addEventListener('click', (event) => {
    if (!event.target.matches('.btn-filtro-data')) {
        return; // Sai se o clique não foi num botão de filtro
    }

    const botaoClicado = event.target;
    const periodo = botaoClicado.dataset.periodo;

    // Remove a classe 'ativo' de todos os botões do grupo
    document.querySelectorAll('.btn-filtro-data').forEach(btn => {
        btn.classList.remove('ativo');
    });
    // Adiciona a classe 'ativo' apenas ao botão clicado
    botaoClicado.classList.add('ativo');

    const dataFimInput = document.getElementById('data-fim');
    const dataInicioInput = document.getElementById('data-inicio');
    
    const hoje = new Date();
    let dataInicio = new Date();

    // Função para formatar a data para o formato YYYY-MM-DD
    const formatarData = (data) => {
        const ano = data.getFullYear();
        const mes = String(data.getMonth() + 1).padStart(2, '0');
        const dia = String(data.getDate()).padStart(2, '0');
        return `${ano}-${mes}-${dia}`;
    };

    dataFimInput.value = formatarData(hoje);

    switch (periodo) {
        case 'hoje':
            dataInicioInput.value = formatarData(hoje);
            break;
        case '7dias':
            dataInicio.setDate(hoje.getDate() - 6);
            dataInicioInput.value = formatarData(dataInicio);
            break;
        case '30dias':
            dataInicio.setDate(hoje.getDate() - 29);
            dataInicioInput.value = formatarData(dataInicio);
            break;
        case 'total':
            // Para "Todo Período", limpamos as datas.
            // A sua API deve ser capaz de interpretar datas vazias como "sem limite".
            dataInicioInput.value = '2020-01-01';
            dataFimInput.value = 'formatarData(hoje)';
            break;
    }

    // Dispara o clique no botão principal de filtro para recarregar os dados
    document.getElementById('btn-filtrar').click();
});

    document.getElementById('btn-exportar-csv').addEventListener('click', () => {
        if (dadosAtuaisDaTabela.length === 0) {
            alert("Não há dados para exportar com os filtros atuais."); return;
        }
        const headers = ["ID Campanha", "Nome Campanha", "Moeda", "Impressoes", "Cliques", "Custo", "Checkouts", "Conversoes", "Valor Conversoes", "Resultado", "ROI"];
        const dataRows = dadosAtuaisDaTabela.map(c => [
            c.id, c.nome, c.codigo_moeda || 'BRL',
            c.impressoes || 0, c.cliques || 0, c.custo || 0, c.checkouts || 0, c.conversoes || 0,
            c.valor_conversoes || 0, c.resultado || 0, (c.roi || 0).toFixed(4)
        ]);
        const dataHoje = new Date().toISOString().slice(0, 10);
        exportarParaCSV(headers, dataRows, `resumo_campanhas_${dataHoje}.csv`);
    });

    // Apenas UM listener para limpar os filtros
    document.getElementById('btn-limpar-filtros').addEventListener('click', () => {
        if (todasCampanhas.length === 0) return;
        
        campanhasSelecionadasIds = todasCampanhas.map(c => String(c.id));
        moedasSelecionadas = [...new Set(todasCampanhas.map(c => c.codigo_moeda || 'BRL'))];
        
        popularFiltro('campanhas', todasCampanhas);
        popularFiltro('moedas', todasCampanhas);
        
        aplicarFiltros();
    });

    // Listener para ordenação (Delegação de Eventos)
    document.getElementById('resumo-container').addEventListener('click', (event) => {
        const th = event.target.closest('th');
        if (th && th.dataset.coluna) {
            ordenarCampanhasPorColuna(th.dataset.coluna);
        }
    });
});