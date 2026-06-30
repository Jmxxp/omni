# Status Jarvis Desktop

Atualizado em 2026-06-30.

## O que foi feito

- Adicionei uma camada desktop com Electron em `electron/main.cjs`.
- O app agora consegue abrir uma janela nativa e subir o Next local por tras.
- O launcher tambem tenta iniciar o agente Python automaticamente.
- Adicionei build standalone do Next com `output: "standalone"`.
- Criei scripts para gerar app desktop:
  - `npm run desktop:build:web`
  - `npm run desktop:dist`
  - `npm run desktop:dist:win`
  - `npm run agent:build:win`
  - `npm run desktop:package:win`
- Criei `.env.example` com as chaves esperadas:
  - `LIVEKIT_URL`
  - `LIVEKIT_API_KEY`
  - `LIVEKIT_API_SECRET`
  - `GOOGLE_API_KEY`
  - `MEM0_API_KEY`
- Ajustei o agente Python para carregar `.env` tambem quando rodar empacotado.
- Troquei o `user_id` fixo por `JARVIS_USER_ID`.
- Criei `config/sites.json` para cadastrar sites/atalhos sem mexer no codigo.
- Melhorei a tela inicial: portugues, visual mais Jarvis, botao "Iniciar Jarvis".
- Criei icone novo em `build/icon.svg` e `build/icon.png`.
- Atualizei dependencias importantes:
  - `next` para `15.5.19`
  - `livekit-client` para `2.20.0`
  - `typescript` para `5.8.3`
  - adicionei `electron` e `electron-builder`
- O build web passou:
  - `npm run desktop:build:web`
- Foi gerado pacote Windows descompactado:
  - `dist-desktop/win-unpacked/Jarvis.exe`
- Foi gerado zip para teste/transferencia:
  - `dist-desktop/Jarvis-win-unpacked.zip`

## O que falta

- Resolver tela branca detectada na verificacao visual em producao antes de considerar pronto para usuario final.
- Rodar o build final em Windows, nao no macOS.
- No Windows, executar:

```powershell
npm install
npm run desktop:package:win
```

- Esse comando deve:
  - instalar dependencias;
  - empacotar o agente Python com PyInstaller;
  - gerar `jarvis-agent.exe`;
  - gerar o instalador final `Jarvis Setup 0.1.0.exe`.
- O instalador NSIS falhou no macOS com erro `makensis`, mas o `win-unpacked/Jarvis.exe` foi gerado.
- Testar no Windows real:
  - abrir app;
  - preencher `.env.local`;
  - conectar LiveKit;
  - testar Gemini voz;
  - testar microfone/camera/tela;
  - testar ferramentas de arquivos;
  - testar Chrome CDP/Playwright;
  - testar volume/brilho/apps do Windows.
- Revisar seguranca das ferramentas perigosas:
  - deletar arquivos;
  - limpar diretorio;
  - desligar/reiniciar PC;
  - comandos de terminal.

## Observacao importante

O projeto original e bem dependente de Windows. O macOS serviu para montar e validar parte do pacote, mas o `.exe` final completo precisa ser fechado e testado em uma maquina Windows.
