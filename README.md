# Saldo Cofelma — disponível para venda

Portal para representantes consultarem o **saldo disponível** dos itens **RC0** (NCM 84339090).

**Disponível = saldo Focco − pedidos DC.**

Site (Vercel): `https://saldo-cofelma.vercel.app`  
(GitHub Pages também: `https://rodrigof-lara.github.io/saldo_cofelma/`)

## Como funciona

1. O Gestão PCP calcula no Focco e **Publicar no portal** (ou o job de 1 hora) grava no Supabase.
2. O representante cria conta (e-mail + senha ou Google).
3. Preenche cadastro obrigatório: nome, CPF, telefone, empresa, cidade e UF.
4. Cada acesso grava log (IP, cidade/estado, dispositivo, etc.) em `dv_portal_acessos`.

## Configurar uma vez no Supabase

**Authentication → URL configuration**

- Site URL: `https://saldo-cofelma.vercel.app`
- Redirect URLs:
  - `https://saldo-cofelma.vercel.app`
  - `https://saldo-cofelma.vercel.app/`
  - `https://rodrigof-lara.github.io/saldo_cofelma/`
  - `http://localhost:5500/` (opcional, teste local)

**Authentication → Providers**

- Email: ligado. Para cadastro imediato, desligue *Confirm email*.
- Google (opcional): crie OAuth no Google Cloud e cole Client ID / Secret.

## Ver os logs

No Supabase: Table Editor → `dv_portal_acessos`  
(IP, cidade, estado, país, ISP, user-agent, tela, busca, login, logout).

Cadastros: `dv_portal_perfis`.

## Publicar o saldo

No Gestão PCP: **Estoque → Disponível para venda → Publicar no portal**.

Job horário (Windows):

```
schtasks /Create /SC HOURLY /TN "CofelmaDisponibilidadeVenda" /TR "C:\xampp\php\php.exe C:\xampp\htdocs\Gestao_PCP_v2\Estoque\disponibilidade_venda_job.php"
```
