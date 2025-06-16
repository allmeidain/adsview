// --- VARIÁVEIS GLOBAIS DE ESTADO ---
let todasCampanhas = [];
let campanhasSelecionadasIds = [];
let moedasSelecionadas = [];
let dadosAtuaisDaTabela = [];
let isInitialLoad = true;
let expanded = { campanhas: false, moedas: false };

// --- FUNÇÕES DE LÓGICA E RENDERIZAÇÃO ---

function renderizarDashboard(campanhasParaRenderizar, cotacao, timestamp) {
    dadosAtuaisDaTabela = campanhasParaRenderizar;
    renderizarTotais(dadosAtuaisDaTabela, cotacao);
    renderizarTabela(dadosAtuaisDaTabela);
    renderizarTimestamp(timestamp);
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

function renderizarTotais(campanhas, cotacao) {
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
    const titulo = !dataInicio || dataInicio === dataFim ? 'Hoje' : 'Período';
    
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

    if (cotacao && cotacao.rates && cotacao.rates.BRL && totaisPorMoeda['USD'] && Object.keys(totaisPorMoeda).length > 1) {
        const taxaCambio = cotacao.rates.BRL;
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
    let tabelaHTML = `<div class="table-wrapper"><table><thead><tr>
        <th>ID da Campanha</th><th>Nome da Campanha</th><th>Impressões</th><th>Cliques</th><th>CPC Médio</th><th>Custo</th><th>Conversões</th><th>Valor Conv.</th><th>Resultado</th><th>ROI</th>
    </tr></thead><tbody>`;
    
    if (campanhas.length === 0) {
        tabelaHTML += '<tr><td colspan="10">Nenhuma campanha para exibir com os filtros atuais.</td></tr>';
    } else {
        campanhas.forEach(campanha => {
            const moeda = campanha.codigo_moeda || 'BRL';
            const cpcMedio = (campanha.cpc_medio || 0).toLocaleString('pt-BR', { style: 'currency', currency: moeda });
            const custo = (campanha.custo || 0).toLocaleString('pt-BR', { style: 'currency', currency: moeda });
            const valorConversoes = (campanha.valor_conversoes || 0).toLocaleString('pt-BR', { style: 'currency', currency: moeda });
            const resultado = (campanha.resultado || 0).toLocaleString('pt-BR', { style: 'currency', currency: moeda });
            const roi = (campanha.roi || 0).toLocaleString('pt-BR', { style: 'percent', minimumFractionDigits: 2 });
            const corResultado = (campanha.resultado || 0) >= 0 ? '#28a745' : '#dc3545';

            tabelaHTML += `<tr>
                <td><a href="/detalhes.html?id=${campanha.id}">${campanha.id}</a></td><td><a href="/detalhes.html?id=${campanha.id}">${campanha.nome}</a></td>
                <td>${(campanha.impressoes || 0).toLocaleString('pt-BR')}</td><td>${(campanha.cliques || 0).toLocaleString('pt-BR')}</td><td>${cpcMedio}</td><td>${custo}</td>
                <td>${(campanha.conversoes || 0).toLocaleString('pt-BR')}</td><td>${valorConversoes}</td><td style="color: ${corResultado}; font-weight: 500;">${resultado}</td><td style="color: ${corResultado}; font-weight: 500;">${roi}</td>
            </tr>`;
        });
    }
    tabelaHTML += `</tbody></table></div>`;
    container.innerHTML = tabelaHTML;
}

function aplicarFiltros(cotacao, timestamp) {
    campanhasSelecionadasIds = Array.from(document.querySelectorAll('#checkboxes-campanhas input:checked')).map(cb => cb.value);
    moedasSelecionadas = Array.from(document.querySelectorAll('#checkboxes-moedas input:checked')).map(cb => cb.value);

    const campanhasFiltradas = todasCampanhas.filter(c => {
        const correspondeCampanha = campanhasSelecionadasIds.includes(String(c.id));
        const correspondeMoeda = moedasSelecionadas.includes(c.codigo_moeda || 'BRL');
        return correspondeCampanha && correspondeMoeda;
    });
    
    renderizarDashboard(campanhasFiltradas, cotacao, timestamp);
}

function popularFiltro(tipo, campanhas, cotacao, timestamp) {
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
        label.addEventListener('change', () => aplicarFiltros(cotacao, timestamp));
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
        if (!respostaCotacao.ok) throw new Error(`Erro na API de cotação.`);
        if (!respostaTimestamp.ok) throw new Error(`Erro na API de timestamp.`);
        
        todasCampanhas = await respostaCampanhas.json();
        const cotacao = await respostaCotacao.json();
        const timestamp = await respostaTimestamp.json();
        
        sessionStorage.setItem('cotacao', JSON.stringify(cotacao));
        
        if (isInitialLoad && todasCampanhas.length > 0) {
            campanhasSelecionadasIds = todasCampanhas.map(c => String(c.id));
            moedasSelecionadas = [...new Set(todasCampanhas.map(c => c.codigo_moeda || 'BRL'))];
            isInitialLoad = false;
        }

        if (!Array.isArray(todasCampanhas) || todasCampanhas.length === 0) {
            renderizarDashboard([], null, timestamp);
            popularFiltro('campanhas', [], null, null);
            popularFiltro('moedas', [], null, null);
            return;
        }

        popularFiltro('campanhas', todasCampanhas, cotacao, timestamp);
        popularFiltro('moedas', todasCampanhas, cotacao, timestamp);
        aplicarFiltros(cotacao, timestamp);

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

    document.getElementById('btn-exportar-csv').addEventListener('click', () => {
        if (dadosAtuaisDaTabela.length === 0) {
            alert("Não há dados para exportar com os filtros atuais."); return;
        }
        const headers = ["ID Campanha", "Nome Campanha", "Moeda", "Impressoes", "Cliques", "Custo", "Conversoes", "Valor Conversoes", "Resultado", "ROI"];
        const dataRows = dadosAtuaisDaTabela.map(c => [
            c.id, c.nome, c.codigo_moeda || 'BRL',
            c.impressoes || 0, c.cliques || 0, c.custo || 0, c.conversoes || 0,
            c.valor_conversoes || 0, c.resultado || 0, (c.roi || 0).toFixed(4)
        ]);
        const dataHoje = new Date().toISOString().slice(0, 10);
        exportarParaCSV(headers, dataRows, `resumo_campanhas_${dataHoje}.csv`);
    });

    document.getElementById('btn-limpar-filtros').addEventListener('click', () => {
        if (todasCampanhas.length === 0) return;
        const cotacao = JSON.parse(sessionStorage.getItem('cotacao'));
        const timestamp = { valor: document.getElementById('info-ultima-atualizacao').dataset.timestamp }; // Simplified way to get timestamp back

        campanhasSelecionadasIds = todasCampanhas.map(c => String(c.id));
        moedasSelecionadas = [...new Set(todasCampanhas.map(c => c.codigo_moeda || 'BRL'))];
        
        popularFiltro('campanhas', todasCampanhas, cotacao, timestamp);
        popularFiltro('moedas', todasCampanhas, cotacao, timestamp);
        
        aplicarFiltros(cotacao, timestamp);
    });
});

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