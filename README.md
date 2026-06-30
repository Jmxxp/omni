# Omni V1

Omni V1 e um assistente de computador para Windows com visual inspirado na interface Jarvis existente, mas com um sistema novo por baixo: local, plug and play, configuravel em um lugar so e preparado para automacao segura.

A decisao do projeto agora e simples:

- Manter a experiencia visual que ja funcionava melhor: fundo preto, orb central viva, barra inferior premium e controles de midia.
- Trocar a arquitetura confusa por um Omni Core local.
- Remover dependencia obrigatoria de LiveKit no primeiro uso.
- Fazer microfone, camera, tela, texto e configuracoes funcionarem localmente.
- So adicionar ferramentas perigosas depois do Omni Guard.

## Status Atual

A base atual entrega:

- App React/Vite em `apps/desktop`.
- Estrutura Tauri preparada para app Windows nativo.
- Interface estilo Jarvis:
  - fundo preto;
  - orb Vanta no centro;
  - barra inferior translucida;
  - botao de microfone;
  - botao de camera;
  - botao de compartilhar tela;
  - botao de texto;
  - botao de configuracoes;
  - botao de suspender.
- Captura real de microfone via browser.
- Captura real de camera via browser.
- Compartilhamento real de tela via browser.
- Config Center plug and play.
- Omni Core local em Python.
- Configuracoes salvas localmente.
- Mensagens enviadas da UI para o Core.
- Guard inicial bloqueando execucao real de ferramentas sensiveis.

## Rodar

Requisitos atuais:

- Node.js 22+
- npm 10+
- Python 3.11+

Instalar:

```powershell
npm install
```

Rodar UI + Core:

```powershell
npm run dev
```

Abrir:

```text
http://127.0.0.1:5173
```

Parar:

```powershell
npm run dev:stop
```

## Arquitetura Atual

```text
omni/
  apps/
    desktop/
      src/
        App.tsx
        components/
        lib/
        styles/
      src-tauri/

  services/
    core/
      server.py
      omni_core/

  scripts/
    dev.mjs
    stop-dev.ps1
```

## Fluxo Atual

```text
Usuario abre Omni
  |
UI inicia em modo local
  |
UI conecta no Omni Core
  |
Usuario ativa mic/camera/tela ou digita texto
  |
Mensagem vai para o Core
  |
Core analisa objetivo
  |
Guard informa se e seguro ou precisa confirmacao
  |
UI mostra estado na orb e eventos na timeline
```

## Interface

A tela principal deve continuar minimalista:

- Orb central como elemento principal.
- Barra inferior como unico painel fixo de acao.
- Configuracoes em painel lateral.
- Preview de camera/tela apenas quando ativo.
- Timeline discreta, sem roubar foco.

Estados da orb:

- `idle`: pronto.
- `listening`: ouvindo.
- `planning`: planejando.
- `waiting_confirmation`: aguardando confirmacao.
- `executing`: executando.
- `completed`: concluido.
- `error`: erro.

## Config Center

O painel de configuracoes concentra:

- Geral.
- IA.
- Voz.
- Memoria.
- Ferramentas.
- Permissoes.

Objetivo: o usuario nao deve editar `.env`, procurar arquivo de config ou entender backend para usar o app.

## Omni Core

O Core local e o backend plug and play do Omni.

Responsabilidades:

- Servir `/health`.
- Servir `/settings`.
- Salvar configuracoes.
- Receber mensagens.
- Classificar risco inicial.
- Registrar eventos.
- Preparar a entrada do Omni Guard.

O Core ainda nao executa comandos reais no PC. Isso e proposital.

## Omni Guard

Antes de qualquer automacao real, o Guard precisa existir.

Regras iniciais:

- Nunca executar terminal sem permissao.
- Nunca deletar arquivo sem confirmacao.
- Nunca desligar/reiniciar PC sem confirmacao critica.
- Nunca enviar arquivos para API externa sem mostrar quais arquivos.
- Nunca expor chave de API em logs.

## Proximas Tarefas

1. Implementar registry real de ferramentas.
2. Implementar Omni Guard com permissoes por risco.
3. Adicionar ferramentas seguras:
   - abrir site;
   - abrir app;
   - listar arquivos;
   - criar pasta.
4. Adicionar ferramentas medias com confirmacao:
   - mover arquivo;
   - renomear arquivo;
   - automacao de navegador.
5. Adicionar logs completos de tool calls.
6. Adicionar Skills locais em YAML.
7. Instalar Rust e ativar build Tauri nativo.
8. Empacotar app Windows.

## Filosofia

O Omni nao deve ser uma demo dificil de configurar. Ele deve parecer simples:

1. instalar;
2. abrir;
3. configurar APIs numa tela;
4. usar.

Por dentro, ele pode ser poderoso. Por fora, tem que ser direto, bonito e confiavel.

