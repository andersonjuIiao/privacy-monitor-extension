# privacy-monitor-extension

Extensão para Firefox que detecta e apresenta ao usuário os principais vetores de rastreamento e violação de privacidade presentes na navegação web moderna.

## Funcionalidades

- Detecção de conexões a domínios de terceira parte, com identificação do tipo de recurso carregado e número de requisições, ordenados por relevância
- Detecção de cookies injetados via header Set-Cookie, diferenciando primeira parte vs. terceira parte, sessão vs. persistente, e exibindo atributos HttpOnly e Secure
- Detecção de supercookies: HSTS supercookies (Strict-Transport-Security de terceiros) e ETag supercookies, mecanismos de rastreamento persistente que sobrevivem à limpeza de cookies
- Monitoramento de armazenamento de dados via Web Storage API (localStorage e sessionStorage) e IndexedDB, exibindo chaves, tamanhos e número de entradas
- Detecção de browser fingerprinting via hooks no contexto da página (injected.js): Canvas API (toDataURL, toBlob, getImageData), WebGL/WebGL2 (getParameter, getExtension, getSupportedExtensions) e AudioContext/OfflineAudioContext (createOscillator, createDynamicsCompressor, createAnalyser)
- Detecção de scripts externos suspeitos com nomes associados a ferramentas de hijacking, miners ou stealers
- Detecção de redirecionamentos cross-domain como indicativo de cookie syncing entre redes de publicidade
- Detecção de cookie syncing via parâmetros de sincronismo de identificadores em URLs de terceiros (uid, sync, partner_id, tdid, etc.)
- Pontuação de privacidade (Privacy Score) de 0 a 100 calculada em tempo real com 7 categorias de penalização independentes

## Estrutura do repositório

```
privacy-monitor-extension/
├── manifest.json       # Configuração da extensão (Manifest V2)
├── privacy.js          # Background script principal
├── content_script.js   # Script injetado nas páginas para coleta de storage e detecção de scripts suspeitos
├── injected.js         # Script executado no contexto da página para hooks de fingerprinting
├── popup.html          # Interface do popup com abas por categoria
├── popup.js            # Lógica do popup
└── README.md           # Este arquivo
```

## Requisitos

- Mozilla Firefox 115 ou superior

## Instalação

1. Clone o repositório:
   ```
   git clone https://github.com/andersonjuIiao/privacy-monitor-extension.git
   ```

2. Abra o Firefox e acesse:
   ```
   about:debugging#/runtime/this-firefox
   ```

3. Clique em **Carregar extensão temporária** e selecione o arquivo `manifest.json` dentro da pasta do projeto.

4. A extensão será carregada e o ícone aparecerá na barra de ferramentas do Firefox.

## Uso

1. Navegue para qualquer página web.
2. Clique no ícone da extensão na barra de ferramentas do Firefox.
3. O popup exibirá cinco abas:
   - **Domínios**: lista de domínios de terceira parte detectados, ordenados por número de requisições
   - **Cookies**: cookies convencionais (1a/3a parte, sessão/persistente) e supercookies (HSTS/ETag)
   - **Storage**: dados armazenados via localStorage, sessionStorage e IndexedDB
   - **Fingerprint**: chamadas detectadas a APIs de Canvas, WebGL e AudioContext
   - **Hijack**: scripts suspeitos, redirecionamentos cross-domain e cookie syncing
4. O **Privacy Score** no topo indica o nível de privacidade da página de 0 a 100.
5. Clique em **Atualizar dados** para recalcular com os dados mais recentes.

## Metodologia do Privacy Score

A pontuação começa em 100 e é decrementada conforme os vetores de rastreamento detectados:

| Vetor | Penalização | Teto |
|---|---|---|
| Domínios de terceira parte | -2 por domínio | -30 pontos |
| Cookies de terceira parte | -1 por cookie | -15 pontos |
| Supercookies (HSTS / ETag) | -5 por supercookie | -20 pontos |
| Fingerprinting | -10 por técnica (Canvas / WebGL / Audio) | -30 pontos |
| Cookie syncing | -3 por ocorrência | -15 pontos |
| Scripts suspeitos | -5 por script | -20 pontos |
| Redirects suspeitos (main_frame) | -3 por redirect | -15 pontos |

**Classificação:**
- 80 a 100 pontos: Boa privacidade
- 60 a 79 pontos: Privacidade moderada
- 40 a 59 pontos: Privacidade ruim
- 0 a 39 pontos: Privacidade crítica

## Observação sobre o Firefox 150

O Firefox 150 possui o Fingerprinting Resistance Level 2 ativo nativamente, que randomiza os valores retornados por Canvas, WebGL e AudioContext por domínio. Isso significa que mesmo que a extensão detecte chamadas a essas APIs, os valores retornados ao rastreador já são adulterados pelo próprio navegador, oferecendo proteção adicional ao usuário.

## Autores

Aluno: Antonio Anderson de Araújo Julião

Orientador: Prof. Me. João Eduardo Luisi

Desenvolvido como projeto da disciplina de Tecnologias Hacker — Insper 2026.
