// --- VARIÁVEIS GLOBAIS DE ESTADO ---
let todasCampanhas = [];
let campanhasSelecionadasIds = [];
let moedasSelecionadas = [];
let dadosAtuaisDaTabela = [];
let isInitialLoad = true;
let expanded = { campanhas: false, moedas: false };

// --- FUNÇÕES DE LÓGICA E RENDERIZAÇÃO ---

function renderizarDashboard(campanhasParaRenderizar) {
    dadosAtuaisDaTabela = campanhasParaRenderizar;
    renderizarTotais(campanhasParaRenderizar);
    renderizarTabela(campanhasParaRenderizar);
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
    const titulo = !dataInicio || dataInicio === dataFim ? 'Hoje' : 'Período';
    
    let metricsHTML = `<table class="totals-table"><thead><tr>
        <th>Moeda</th><th>Custo Total (<span class="math-inline">\{titulo\}\)</th\><th\>Valor Total de Conv\. \(</span>{titulo})</th><th>Resultado Total (<span class="math-inline">\{titulo\}\)</th\><th\>ROI Total \(</span>{titulo})</th>
    </tr></thead><tbody>`;

    for (const moeda in totaisPorMoeda) {
        const totais = totaisPorMoeda[moeda];
        const corResultado = totais.resultado >= 0 ? '#28a745' : '#dc3545';
        const roiTotal = totais.custo > 0 ? totais.resultado / totais.custo : 0;
        
        metricsHTML += `<tr>
            <td><span class="math-inline">\{moeda\}</td\>
<td\></span>{totais.custo.toLocaleString('pt-BR', { style: 'currency', currency: moeda })}</td>
            <td>${totais.valor_conversoes.toLocaleString('pt-BR', { style: 'currency', currency: moeda })}</td>
            <td style="color: <span class="math-inline">\{corResultado\}; font\-weight\: 500;"\></span>{totais.resultado.toLocaleString('pt-BR', { style: 'currency', currency: moeda })}</td>
            <td style="color: <span class="math-inline">\{corResultado\}; font\-weight\: 500;"\></span>{roiTotal.toLocaleString('pt-BR', { style: 'percent', minimumFractionDigits: 2 })}</td>
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
            const corResultado = (campanha.resultado || 0) >= 0 ? '#28a745' :
