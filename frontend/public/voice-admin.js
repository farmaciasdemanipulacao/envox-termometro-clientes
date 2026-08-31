(() => {
  const API = '/api/v1';
  const state = {
    token: localStorage.getItem('envox_voice_token') || '',
    campaigns: [],
    selected: null,
  };

  const $ = (selector) => document.querySelector(selector);
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  function authHeaders() {
    return {
      Authorization: `Bearer ${state.token}`,
      'Content-Type': 'application/json',
    };
  }

  async function request(path, options = {}) {
    const response = await fetch(API + path, {
      ...options,
      headers: { ...authHeaders(), ...(options.headers || {}) },
    });

    let data = null;
    try { data = await response.json(); } catch (_) {}

    if (response.status === 401) {
      logout();
      throw new Error('Sessão expirada');
    }
    if (!response.ok) {
      const detail = data?.detail;
      throw new Error(
        typeof detail === 'string'
          ? detail
          : detail?.message || data?.message || `Erro ${response.status}`
      );
    }
    return data;
  }

  async function login() {
    const username = $('#user').value.trim();
    const password = $('#pass').value;
    $('#loginErr').textContent = '';

    try {
      const response = await fetch(API + '/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Credenciais inválidas');

      state.token = data.access_token;
      localStorage.setItem('envox_voice_token', state.token);
      localStorage.setItem('envox_voice_user', data.full_name || data.username || username);
      await showApp();
    } catch (error) {
      $('#loginErr').textContent = error.message;
    }
  }

  function logout() {
    state.token = '';
    localStorage.removeItem('envox_voice_token');
    localStorage.removeItem('envox_voice_user');
    location.reload();
  }

  async function showApp() {
    $('#login').classList.add('hidden');
    $('#app').classList.remove('hidden');
    $('#who').textContent = localStorage.getItem('envox_voice_user') || '';
    await loadCampaigns();
  }

  const fmt = (value) => value === null || value === undefined ? '–' : Number(value).toFixed(1);
  const statusLabel = (status) => ({
    pending: 'Pendente', sent: 'Enviado', opened: 'Aberto', started: 'Iniciado', completed: 'Concluído'
  })[status] || status;
  const healthClass = (classification) => classification === 'Crítico'
    ? 'critical'
    : classification === 'Atenção' ? 'attention' : 'healthy';

  async function loadCampaigns() {
    state.campaigns = await request('/voice/campaigns');
    const root = $('#campaigns');
    root.innerHTML = state.campaigns.length
      ? state.campaigns.map((campaign) => `
          <div class="campaign ${state.selected === campaign.id ? 'active' : ''}" data-id="${campaign.id}">
            <strong>${escapeHtml(campaign.name)}</strong>
            <div class="campaign-tags">
              <span class="tag">${escapeHtml(campaign.client)}</span>
              <span class="tag">${escapeHtml(campaign.status)}</span>
            </div>
          </div>
        `).join('')
      : '<p class="muted">Nenhuma campanha criada.</p>';

    root.querySelectorAll('.campaign').forEach((element) => {
      element.addEventListener('click', () => selectCampaign(element.dataset.id));
    });
  }

  async function selectCampaign(id) {
    state.selected = id;
    await loadCampaigns();
    $('#empty').classList.add('hidden');
    $('#detail').classList.remove('hidden');

    const campaign = state.campaigns.find((item) => item.id === id);
    $('#campaignTitle').textContent = campaign?.name || 'Campanha';
    $('#campaignMeta').textContent = [campaign?.client, campaign?.status].filter(Boolean).join(' · ');
    await refreshDetail();
  }

  function renderRespondents(respondents) {
    $('#respondentRows').innerHTML = respondents.length
      ? respondents.map((respondent) => `
          <tr>
            <td><strong>${escapeHtml(respondent.name)}</strong><div class="muted">${escapeHtml(respondent.role_function || '')}</div></td>
            <td>${escapeHtml([respondent.unit, respondent.sector].filter(Boolean).join(' / ') || '–')}</td>
            <td>${escapeHtml(respondent.regional || '–')}</td>
            <td>${escapeHtml(statusLabel(respondent.status))}</td>
            <td>${fmt(respondent.perception_score)}</td>
            <td>${fmt(respondent.risk_score)}</td>
            <td class="health ${healthClass(respondent.classification)}">${escapeHtml(respondent.classification || '–')}</td>
            <td><button class="btn ghost copy-link" data-url="${escapeHtml(respondent.url)}">Copiar</button></td>
          </tr>
        `).join('')
      : '<tr><td colspan="8" class="muted">Nenhum respondente importado.</td></tr>';

    document.querySelectorAll('.copy-link').forEach((button) => {
      button.addEventListener('click', async () => {
        await navigator.clipboard.writeText(button.dataset.url);
        button.textContent = 'Copiado';
        setTimeout(() => { button.textContent = 'Copiar'; }, 900);
      });
    });
  }

  function renderMatrix(matrix) {
    $('#matrixRows').innerHTML = matrix.length
      ? matrix.map((row) => `
          <tr>
            <td>${escapeHtml(row.unit)}</td><td>${escapeHtml(row.sector)}</td><td>${escapeHtml(row.regional)}</td>
            <td>${row.respondents}</td><td>${fmt(row.atendimento)}</td><td>${fmt(row.prazo)}</td>
            <td>${fmt(row.qualidade)}</td><td>${fmt(row.proatividade)}</td><td>${fmt(row.confianca)}</td>
            <td class="${(row.risk || 0) >= 65 ? 'critical' : (row.risk || 0) >= 40 ? 'attention' : 'healthy'}">${fmt(row.risk)}</td>
          </tr>
        `).join('')
      : '<tr><td colspan="10" class="muted">A matriz será preenchida após as primeiras conclusões.</td></tr>';
  }

  function renderCauses(analysis) {
    const causes = [];
    Object.entries(analysis.main_causes || {}).forEach(([group, items]) => {
      (items || []).forEach((item) => causes.push({ group, ...item }));
    });
    causes.sort((a, b) => b.count - a.count);
    $('#causes').innerHTML = causes.length
      ? causes.slice(0, 12).map((item) => `<div class="cause"><span>${escapeHtml(item.cause)}</span><strong>${item.count}</strong></div>`).join('')
      : '<p class="muted">Sem dados suficientes.</p>';
  }

  function renderActions(analysis) {
    $('#actions').innerHTML = (analysis.recommended_actions || []).length
      ? analysis.recommended_actions.map((action) => `
          <div class="action">
            <strong>${escapeHtml(action.label)} · ${fmt(action.score)}</strong>
            <div class="muted">Prioridade ${escapeHtml(action.priority)}</div>
            <div class="action-text">${escapeHtml(action.action)}</div>
          </div>
        `).join('')
      : '<p class="muted">Sem recomendações ainda.</p>';
  }

  function renderCausal(causal) {
    const patterns = (causal.correction_patterns || []).map((item) => `
      <div class="cause"><span>${escapeHtml(item.pattern)}</span><strong>${item.count}</strong></div>
    `).join('');
    const interpretation = (causal.interpretation || []).map((item) => `
      <div class="action"><strong>${escapeHtml(item.signal)} · ${item.count}</strong><div>${escapeHtml(item.meaning)}</div></div>
    `).join('');
    $('#causal').innerHTML = patterns + interpretation + (causal.note ? `<p class="muted">${escapeHtml(causal.note)}</p>` : '');
  }

  function renderLostDemands(analysis) {
    const lost = analysis.invisible_or_lost_demands || {};
    const items = (lost.expected_but_not_delivered || []).map((text) => `<div class="action">${escapeHtml(text)}</div>`).join('');
    $('#lost').innerHTML = `
      <p><strong>Pessoas que deixaram de solicitar:</strong> ${lost.respondents_who_stopped_requesting || 0}</p>
      ${items || '<p class="muted">Nenhuma demanda aberta registrada ainda.</p>'}
    `;
  }

  async function refreshDetail() {
    if (!state.selected) return;

    const [dashboard, respondents, analysis] = await Promise.all([
      request(`/voice/campaigns/${state.selected}/dashboard`),
      request(`/voice/campaigns/${state.selected}/respondents`),
      request(`/voice/campaigns/${state.selected}/analysis`),
    ]);

    let causal;
    try {
      causal = await request(`/voice/campaigns/${state.selected}/secovi-causal-analysis`);
    } catch (_) {
      causal = { note: 'Esta campanha não usa a versão causal refinada.' };
    }

    $('#kTotal').textContent = dashboard.respondents;
    $('#kCompletion').textContent = `${fmt(dashboard.completion_rate)}%`;
    $('#kScore').textContent = fmt(dashboard.average_perception_score);
    $('#kRisk').textContent = fmt(dashboard.average_risk);
    $('#kCritical').textContent = dashboard.classifications?.['Crítico'] || 0;

    renderRespondents(respondents);
    renderMatrix(dashboard.matrix || []);
    renderCauses(analysis);
    renderActions(analysis);
    renderCausal(causal);
    renderLostDemands(analysis);
  }

  function openModal(title, html) {
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = html;
    $('#modal').classList.remove('hidden');
  }

  function closeModal() {
    $('#modal').classList.add('hidden');
  }

  function openImportModal() {
    if (!state.selected) return;
    openModal('Importar respondentes', `
      <p class="muted">CSV com colunas: <code>nome, whatsapp, cargo, setor, unidade, regional</code>. O sistema gera um link permanente individual para cada pessoa.</p>
      <textarea id="csvText" rows="12" placeholder="nome,whatsapp,cargo,setor,unidade,regional\nMaria,5541...,Gestora,Unihab,Secovi-PR,Londrina"></textarea>
      <div class="toolbar modal-actions"><input id="csvFile" type="file" accept=".csv,text/csv"><button class="btn" id="doImport">Importar</button></div>
      <div id="importMsg"></div>
    `);

    $('#csvFile').addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (file) $('#csvText').value = await file.text();
    });

    $('#doImport').addEventListener('click', async () => {
      try {
        const result = await request(`/voice/campaigns/${state.selected}/respondents/import-csv`, {
          method: 'POST',
          body: JSON.stringify({ csv_text: $('#csvText').value }),
        });
        $('#importMsg').innerHTML = `<div class="ok">${result.created} respondentes importados. ${result.errors?.length ? `${result.errors.length} linhas com erro.` : ''}</div>`;
        await refreshDetail();
      } catch (error) {
        $('#importMsg').innerHTML = `<div class="err">${escapeHtml(error.message)}</div>`;
      }
    });
  }

  function openSecoviModal() {
    openModal('Criar campanha Secovi-PR', `
      <p>Será criada a versão <strong>refinada</strong>, com 19 perguntas e diagnóstico causal de retrabalho.</p>
      <label>Nome da campanha</label><input id="secName" value="Diagnóstico de Percepção da Parceria Secovi-PR + Envox">
      <label>Domínio público</label><input id="secUrl" value="https://pesquisa.envox.com.br">
      <button class="btn modal-actions" id="createSec">Criar campanha</button>
      <div id="secMsg"></div>
    `);

    $('#createSec').addEventListener('click', async () => {
      try {
        const result = await request('/voice/bootstrap/secovi-refined', {
          method: 'POST',
          body: JSON.stringify({
            campaign_name: $('#secName').value,
            public_base_url: $('#secUrl').value,
          }),
        });
        await loadCampaigns();
        closeModal();
        await selectCampaign(result.campaign_id);
      } catch (error) {
        $('#secMsg').innerHTML = `<div class="err">${escapeHtml(error.message)}</div>`;
      }
    });
  }

  $('#loginBtn').addEventListener('click', login);
  $('#pass').addEventListener('keydown', (event) => { if (event.key === 'Enter') login(); });
  $('#logoutBtn').addEventListener('click', logout);
  $('#refreshBtn').addEventListener('click', refreshDetail);
  $('#importBtn').addEventListener('click', openImportModal);
  $('#newSecovi').addEventListener('click', openSecoviModal);
  $('#closeModal').addEventListener('click', closeModal);
  $('#modal').addEventListener('click', (event) => { if (event.target.id === 'modal') closeModal(); });

  if (state.token) showApp();
})();
