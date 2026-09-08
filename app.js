/* global supabase, SALDO_CFG */
(function () {
  const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
  const cfg = window.SALDO_CFG;
  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnon);
  const $ = (id) => document.getElementById(id);

  let perfil = null;
  let itens = [];
  let lastUid = '';
  let sessId = sessionStorage.getItem('dv_sess') || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
  sessionStorage.setItem('dv_sess', sessId);

  UFS.forEach((uf) => {
    ['cadUf', 'pfUf'].forEach((id) => {
      const s = $(id);
      if (!s) return;
      if (s.options.length === 0) {
        const z = document.createElement('option');
        z.value = ''; z.textContent = '—';
        s.appendChild(z);
      }
      const o = document.createElement('option');
      o.value = uf; o.textContent = uf;
      s.appendChild(o);
    });
  });

  function soDigitos(s) { return String(s || '').replace(/\D/g, ''); }
  function cpfOk(raw) {
    const c = soDigitos(raw);
    if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
    let s = 0, i;
    for (i = 0; i < 9; i++) s += Number(c[i]) * (10 - i);
    let d = (s * 10) % 11; if (d === 10) d = 0;
    if (d !== Number(c[9])) return false;
    s = 0;
    for (i = 0; i < 10; i++) s += Number(c[i]) * (11 - i);
    d = (s * 10) % 11; if (d === 10) d = 0;
    return d === Number(c[10]);
  }
  function fmt(n, d) {
    const v = Number(n);
    if (!isFinite(v)) return '—';
    return v.toLocaleString('pt-BR', { maximumFractionDigits: d == null ? 1 : d });
  }
  function show(id) {
    ['viewAuth', 'viewPerfil', 'viewApp'].forEach((v) => $(v).classList.toggle('hidden', v !== id));
    $('whoBox').classList.toggle('hidden', id === 'viewAuth');
  }

  async function geo() {
    const out = {};
    const tryUrls = ['https://ipwho.is/', 'https://ipapi.co/json/'];
    for (let u = 0; u < tryUrls.length; u++) {
      try {
        const r = await fetch(tryUrls[u], { cache: 'no-store' });
        const j = await r.json();
        if (j && (j.ip || j.success !== false)) {
          out.ip = j.ip || out.ip;
          out.cidade = j.city || j.cidade || out.cidade;
          out.estado = j.region || j.region_name || j.estado || out.estado;
          out.pais = j.country || j.country_name || out.pais;
          out.pais_iso = j.country_code || j.country_code_iso3 || out.pais_iso;
          out.cep = j.postal || j.postal_code || out.cep;
          out.lat = j.latitude || j.lat || out.lat;
          out.lon = j.longitude || j.lon || j.lng || out.lon;
          const conn = j.connection || {};
          out.isp = conn.isp || j.isp || j.org || out.isp;
          out.org = conn.org || j.org || out.org;
          out.timezone_ip = (j.timezone && (j.timezone.id || j.timezone)) || j.timezone || out.timezone_ip;
          if (out.ip) break;
        }
      } catch (_) { /* tenta o próximo */ }
    }
    return out;
  }

  function deviceExtra() {
    const nav = navigator || {};
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection || {};
    return {
      user_agent: nav.userAgent || '',
      idioma: nav.language || '',
      idiomas: Array.isArray(nav.languages) ? nav.languages.join(',') : '',
      plataforma: nav.platform || '',
      tela: (screen.width || 0) + 'x' + (screen.height || 0) + '@' + (window.devicePixelRatio || 1),
      viewport: window.innerWidth + 'x' + window.innerHeight,
      timezone_local: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      referrer: document.referrer || '',
      url: location.href,
      query: location.search || '',
      conexao: conn.effectiveType || conn.type || '',
      extra: {
        sessao: sessId,
        cookie_enabled: !!nav.cookieEnabled,
        online: !!nav.onLine,
        hardware: nav.hardwareConcurrency || null,
        memoria_gb: nav.deviceMemory || null,
        touch: navigator.maxTouchPoints || 0,
        cor: screen.colorDepth || null,
        vendor: nav.vendor || '',
        do_not_track: nav.doNotTrack || null,
        hora_local: new Date().toISOString()
      }
    };
  }

  async function logar(evento, mais) {
    try {
      const { data: { session } } = await sb.auth.getSession();
      const user = session && session.user;
      if (!user) return;
      const g = await geo();
      const d = deviceExtra();
      const row = Object.assign({
        user_id: user.id,
        email: user.email || (perfil && perfil.email) || '',
        nome: (perfil && perfil.nome_completo) || user.user_metadata && user.user_metadata.full_name || '',
        cpf: (perfil && perfil.cpf) || '',
        evento: evento
      }, g, d, mais || {});
      if (mais && mais.extra) {
        row.extra = Object.assign({}, d.extra, mais.extra);
      }
      await sb.from('dv_portal_acessos').insert(row);
    } catch (_) { /* log não bloqueia */ }
  }

  function guardarCadastroLocal(email, p) {
    try {
      localStorage.setItem('dv_cad_' + String(email || '').toLowerCase(), JSON.stringify(p));
    } catch (_) {}
  }
  function lerCadastroLocal(email) {
    try {
      return JSON.parse(localStorage.getItem('dv_cad_' + String(email || '').toLowerCase()) || 'null');
    } catch (_) { return null; }
  }
  function dadosDoCadastro(user) {
    const m = (user && user.user_metadata) || {};
    const loc = lerCadastroLocal(user && user.email) || {};
    return {
      nome: loc.nome || m.full_name || m.nome || '',
      cpf: soDigitos(loc.cpf || m.cpf || ''),
      tel: loc.tel || m.telefone || '',
      empresa: loc.empresa || m.empresa || '',
      cargo: loc.cargo || m.cargo || '',
      cidade: loc.cidade || m.cidade || '',
      uf: loc.uf || m.uf || '',
      zap: loc.zap || m.whatsapp || ''
    };
  }
  function preencherPerfilForm(p) {
    if (!p) return;
    if (p.nome) $('pfNome').value = p.nome;
    if (p.cpf) $('pfCpf').value = p.cpf;
    if (p.tel) $('pfTel').value = p.tel;
    if (p.empresa) $('pfEmpresa').value = p.empresa;
    if (p.cargo) $('pfCargo').value = p.cargo;
    if (p.cidade) $('pfCidade').value = p.cidade;
    if (p.uf) $('pfUf').value = p.uf;
    if (p.zap) $('pfZap').value = p.zap;
  }
  function cadastroCompleto(p) {
    if (!p) return false;
    if (!p.nome || String(p.nome).trim().split(' ').length < 2) return false;
    if (!cpfOk(p.cpf)) return false;
    if (soDigitos(p.tel).length < 10) return false;
    if (!p.empresa || !p.cidade || !p.uf) return false;
    return true;
  }
  function mostrarAvisoEmail(email) {
    const html = '<b>Quase lá — confirme seu e-mail</b>'
      + 'Enviamos um link para <b>' + esc(email) + '</b>.<br><br>'
      + '1. Abra a caixa de entrada desse e-mail (e o spam / lixo eletrônico).<br>'
      + '2. Clique no link de confirmação da Cofelma / Supabase.<br>'
      + '3. Volte aqui, use a aba <b>Entrar</b> com o mesmo e-mail e a senha que cadastrou.<br><br>'
      + 'Os dados do cadastro (nome, CPF, empresa…) já ficaram salvos e não precisarão ser preenchidos de novo.';
    const box = $('cadOk');
    if (box) { box.innerHTML = html; box.classList.add('show'); }
    const loginBox = $('loginOk');
    if (loginBox) { loginBox.innerHTML = html; loginBox.classList.add('show'); }
    $('cadErr').textContent = '';
    $('tabLogin').classList.add('on'); $('tabCad').classList.remove('on');
    $('formLogin').classList.remove('hidden'); $('formCad').classList.add('hidden');
    $('loginEmail').value = email;
  }
  function perfilFromForm(prefix) {
    const nome = ($(prefix + 'Nome').value || '').trim();
    const cpf = soDigitos($(prefix + 'Cpf').value);
    const tel = ($(prefix + 'Tel').value || '').trim();
    const empresa = ($(prefix + 'Empresa').value || '').trim();
    const cargo = ($(prefix + 'Cargo').value || '').trim();
    const cidade = ($(prefix + 'Cidade').value || '').trim();
    const uf = ($(prefix + 'Uf').value || '').trim();
    const zap = (($(prefix + 'Zap') && $(prefix + 'Zap').value) || '').trim();
    if (!nome || nome.split(' ').length < 2) return { erro: 'Informe nome e sobrenome.' };
    if (!cpfOk(cpf)) return { erro: 'CPF inválido.' };
    if (soDigitos(tel).length < 10) return { erro: 'Telefone inválido.' };
    if (!empresa) return { erro: 'Informe a empresa.' };
    if (!cidade || !uf) return { erro: 'Informe cidade e UF.' };
    return { nome, cpf, tel, empresa, cargo, cidade, uf, zap };
  }

  async function salvarPerfil(p, user) {
    const row = {
      id: user.id,
      email: user.email,
      nome_completo: p.nome,
      cpf: p.cpf,
      telefone: p.tel,
      empresa: p.empresa,
      cargo: p.cargo || null,
      cidade: p.cidade,
      uf: p.uf,
      whatsapp: p.zap || null,
      google_sub: user.app_metadata && user.app_metadata.provider === 'google' ? user.id : null,
      atualizado_em: new Date().toISOString()
    };
    const { error } = await sb.from('dv_portal_perfis').upsert(row, { onConflict: 'id' });
    if (error) throw new Error(error.message);
    perfil = row;
  }

  async function carregarPerfil(user) {
    const { data, error } = await sb.from('dv_portal_perfis').select('*').eq('id', user.id).maybeSingle();
    if (error) throw new Error(error.message);
    perfil = data || null;
    return perfil;
  }

  async function carregarItens() {
    const { data, error } = await sb
      .from('disponibilidade_venda_itens')
      .select('cod_item,descricao,ncm,um,saldo,qtde_dc,n_dc,disponivel,atualizado_em')
      .eq('prefixo', cfg.prefixo)
      .order('disponivel', { ascending: false })
      .limit(5000);
    if (error) throw new Error(error.message);
    itens = data || [];
    render();
    await logar('consulta', { extra: { n_itens: itens.length } });
  }

  function visiveis() {
    const q = ($('busca').value || '').trim().toLowerCase();
    const sit = $('sit').value;
    return itens.filter((r) => {
      if (sit === 'disp' && !(Number(r.disponivel) > 0.0005)) return false;
      if (sit === 'neg' && Number(r.disponivel) > 0.0005) return false;
      if (!q) return true;
      return (r.cod_item + ' ' + r.descricao).toLowerCase().indexOf(q) >= 0;
    });
  }

  function render() {
    const rows = visiveis();
    let s = 0, d = 0, p = 0;
    rows.forEach((r) => {
      s += Number(r.saldo) || 0;
      d += Number(r.qtde_dc) || 0;
      p += Number(r.disponivel) || 0;
    });
    $('kN').textContent = fmt(rows.length, 0);
    $('kSaldo').textContent = fmt(s, 1);
    $('kDc').textContent = fmt(d, 1);
    $('kDisp').textContent = fmt(p, 1);
    const when = itens[0] && itens[0].atualizado_em
      ? new Date(itens[0].atualizado_em).toLocaleString('pt-BR')
      : '—';
    $('metaLinha').textContent = (itens.length ? (itens.length + ' itens no snapshot · atualizado ' + when) : 'Ainda não há snapshot. Publique no Gestão PCP.')
      + ' · disponível = saldo − DC';
    const tb = $('tb');
    if (!rows.length) {
      tb.innerHTML = '<tr><td colspan="6" style="padding:20px;text-align:center;color:#64748b">Nenhum item.</td></tr>';
      return;
    }
    tb.innerHTML = rows.map((r) => {
      const disp = Number(r.disponivel) || 0;
      const cls = disp > 0.0005 ? 'ok' : (disp < -0.0005 ? 'neg' : 'zero');
      return '<tr><td class="cod">' + esc(r.cod_item) + '</td><td>' + esc(r.descricao)
        + '</td><td>' + esc(r.um || '—')
        + '</td><td class="num">' + fmt(r.saldo, 1)
        + '</td><td class="num">' + fmt(r.qtde_dc, 1)
        + '</td><td class="num ' + cls + '">' + fmt(disp, 1) + '</td></tr>';
    }).join('');
  }
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  async function aposLogin(user, origem) {
    $('whoNome').textContent = user.email || '';
    try {
      await carregarPerfil(user);
    } catch (e) {
      $('loginErr').textContent = e.message;
      return;
    }
    if (!perfil || !perfil.cpf) {
      const p = dadosDoCadastro(user);
      if (cadastroCompleto(p)) {
        try {
          await salvarPerfil(p, user);
        } catch (_) { /* cai no formulário */ }
      }
    }
    if (!perfil || !perfil.cpf) {
      show('viewPerfil');
      preencherPerfilForm(dadosDoCadastro(user));
      await logar('login_sem_cadastro', { extra: { origem: origem } });
      return;
    }
    const ativo = !(perfil.ativo === false || perfil.ativo === 'f' || perfil.ativo === 'false');
    if (!ativo) {
      await logar('bloqueado', { extra: { origem: origem } });
      lastUid = '';
      await sb.auth.signOut();
      show('viewAuth');
      $('loginErr').textContent = 'Seu acesso foi bloqueado pelo PCP. Em caso de dúvida, fale com a Cofelma.';
      return;
    }
    $('whoNome').textContent = perfil.nome_completo + ' · ' + (user.email || '');
    show('viewApp');
    await logar(origem === 'cadastro' ? 'cadastro' : 'login', { extra: { origem: origem } });
    try {
      await carregarItens();
    } catch (e) {
      $('metaLinha').textContent = 'Erro ao ler saldo: ' + e.message;
    }
  }

  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_OUT') {
      lastUid = '';
      show('viewAuth');
      return;
    }
    if (!session || !session.user) {
      show('viewAuth');
      return;
    }
    if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'USER_UPDATED') {
      if (lastUid === session.user.id) return;
      lastUid = session.user.id;
      aposLogin(session.user, event === 'SIGNED_IN' ? 'login' : 'reabrir');
    }
  });

  $('tabLogin').addEventListener('click', () => {
    $('tabLogin').classList.add('on'); $('tabCad').classList.remove('on');
    $('formLogin').classList.remove('hidden'); $('formCad').classList.add('hidden');
  });
  $('tabCad').addEventListener('click', () => {
    $('tabCad').classList.add('on'); $('tabLogin').classList.remove('on');
    $('formCad').classList.remove('hidden'); $('formLogin').classList.add('hidden');
  });

  $('formLogin').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('loginErr').textContent = '';
    const { data, error } = await sb.auth.signInWithPassword({
      email: $('loginEmail').value.trim(),
      password: $('loginSenha').value
    });
    if (error) {
      $('loginErr').textContent = error.message === 'Invalid login credentials'
        ? 'E-mail ou senha inválidos.'
        : error.message;
      return;
    }
    if (data.user) aposLogin(data.user, 'senha');
  });

  $('formCad').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('cadErr').textContent = '';
    const p = perfilFromForm('cad');
    if (p.erro) { $('cadErr').textContent = p.erro; return; }
    const email = $('cadEmail').value.trim();
    const senha = $('cadSenha').value;
    guardarCadastroLocal(email, p);
    const { data, error } = await sb.auth.signUp({
      email,
      password: senha,
      options: {
        emailRedirectTo: location.origin + location.pathname,
        data: {
          full_name: p.nome,
          nome: p.nome,
          cpf: p.cpf,
          telefone: p.tel,
          empresa: p.empresa,
          cargo: p.cargo,
          cidade: p.cidade,
          uf: p.uf,
          whatsapp: p.zap
        }
      }
    });
    if (error) { $('cadErr').textContent = error.message; return; }
    if (!data.session) {
      mostrarAvisoEmail(email);
      return;
    }
    try {
      await salvarPerfil(p, data.user);
      await aposLogin(data.user, 'cadastro');
    } catch (err) {
      $('cadErr').textContent = err.message;
    }
  });

  $('formPerfil').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('pfErr').textContent = '';
    const p = perfilFromForm('pf');
    if (p.erro) { $('pfErr').textContent = p.erro; return; }
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { $('pfErr').textContent = 'Sessão expirada.'; return; }
    try {
      await salvarPerfil(p, user);
      await aposLogin(user, 'cadastro');
    } catch (err) {
      $('pfErr').textContent = err.message;
    }
  });

  $('btnGoogle').addEventListener('click', async () => {
    $('loginErr').textContent = '';
    const redirect = location.origin + location.pathname;
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirect }
    });
    if (error) $('loginErr').textContent = error.message + ' (ative o provedor Google no Supabase).';
  });

  $('btnSair').addEventListener('click', async () => {
    await logar('logout');
    await sb.auth.signOut();
    perfil = null;
    itens = [];
    show('viewAuth');
  });

  let tBusca = null;
  $('busca').addEventListener('input', () => {
    clearTimeout(tBusca);
    tBusca = setTimeout(() => {
      render();
      logar('busca', { extra: { q: $('busca').value } });
    }, 400);
  });
  $('sit').addEventListener('change', () => {
    render();
    logar('filtro', { extra: { sit: $('sit').value } });
  });
})();
