# Much

Voz, câmera e transmissão de tela com amigos, no estilo Discord:

- **Amigos e chamadas privadas:** adicione pelo nick, aceite pedidos e ligue direto (toque de chamada, atender/recusar).
- **Salas públicas:** funcionam como canais de voz. A barra lateral mostra quem está em cada sala, quem está falando, com o microfone desligado ou ao vivo. Cada sala tem nome, descrição, ícone e banner.
- **Divulgar a sala:** o dono marca uma sala como divulgada (no modal da sala ou pelo megafone no Explorar) e ela vira um cartão com banner, ícone, descrição e botão de entrar no perfil dele, visto por qualquer pessoa. Vale uma sala por dono.
- **Perfil na lateral da conversa:** nas mensagens diretas o perfil da pessoa fica docado à direita, com as mesmas opções do balão flutuante. O botão no topo esconde e mostra o painel, e clicar na foto abre o perfil completo.
- **Topo da conversa:** ligar, chamada de vídeo (a câmera já sai ligada), mensagens fixadas (qualquer um dos dois fixa, até 50 por conversa) e busca no texto da conversa. Clicar num resultado ou numa fixada carrega o histórico até ela e rola até a mensagem.
- **Grupos:** o botão "Adicionar amigos à DM" transforma a conversa num grupo com mais amigos (até 10 pessoas). O grupo tem conversa, figurinhas, fixadas, busca e chamada de voz e vídeo para todos: quem liga toca para os outros, e quem perdeu o toque vê a faixa "Chamada em andamento" para entrar depois. Qualquer membro muda o nome, o ícone e adiciona amigos; só o dono tira gente. Se o dono sai, o membro mais antigo assume, e o grupo some quando o último sai.
- **Configurações:** microfone, saída de áudio, volumes, teste de microfone, cancelamento de eco, supressão de ruído, câmera (resolução, espelhar, prévia) e transmissão de tela (resolução, fps, qualidade, prioridade e modo de áudio).
- **Modo leve:** em computadores sem aceleração de vídeo (VM, servidor, área de trabalho remota) o site liga sozinho um modo sem animações de movimento, desfoques, fundos animados e sombras grandes, que travam e pixelam quando desenhados pelo processador. Dá para forçar leve ou completo em Configurações > Aparência e desempenho.
- **Som do PC inteiro, menos o Discord:** quem transmite manda o áudio de tudo (jogo, música, vídeo) sem vazar a call do Discord.

```
streamflix/
  server/                 Node + Express + Socket.IO + SQLite (contas, amigos, salas, chamadas, sinalização WebRTC)
  client/                 React + Vite + Tailwind + Motion (site)
  desktop/                Electron (app do streamer, seletor de tela, ponte do áudio)
  native/audio-capture/   C++ (captura de áudio por processo no Windows)
```

## Como funciona o áudio sem o Discord

- **App desktop (recomendado, Windows 10 2004 / build 19041 ou mais novo):** o `audio-capture.exe` lista as sessões de áudio do Windows e captura cada programa separadamente pela API *Process Loopback*. O Discord e o próprio Much ficam de fora, e o resto é mixado em PCM 48 kHz estéreo. O Much é excluído para não recapturar a voz dos outros participantes, o que causaria eco. É só escolher "Som do PC, sem Discord" ao transmitir.
- **Navegador (Chrome/Edge), opção "Som do PC inteiro":** o navegador captura tudo que toca na **saída de áudio padrão do Windows**, sem conseguir separar programas. Para o Discord ficar de fora, ele precisa tocar em outra saída:
  1. No Discord: *Configurações → Voz e vídeo → Dispositivo de saída* e escolha um dispositivo que **não** seja o padrão do Windows (ex.: o fone, se o padrão é a caixa de som).
  2. Deixe jogos, música e vídeos na saída padrão.
  3. Ao transmitir, escolha *Tela inteira* e marque *Compartilhar áudio do sistema*.
- **Navegador, opção "Som de uma aba":** só o áudio de uma aba do Chrome/Edge.

Quem só assiste, fala ou liga a câmera pode usar o navegador normalmente.

## Requisitos

- Node.js 20 ou 22 LTS
- Para compilar o `audio-capture.exe`: Visual Studio 2022 Build Tools com "Desenvolvimento para desktop com C++" (inclui CMake e o Windows SDK 10.0.20348 ou mais novo)
- Chrome, Edge ou o app desktop. Firefox funciona para voz e câmera.

## Rodando em desenvolvimento

```bash
npm install                      # instala server + client
cp server/.env.example server/.env
npm run dev                      # API em :43124 e site em http://127.0.0.1:43123
```

Abra http://127.0.0.1:43123, crie uma conta, adicione um amigo pelo nick ou crie uma sala pública.

### App desktop

```bash
native\audio-capture\build.bat   # gera native/audio-capture/build/Release/audio-capture.exe
cd desktop
npm install
npm start                        # abre o Much apontando para http://127.0.0.1:43123
```

Para apontar para outro servidor, use a variável `MUCH_URL` ou edite `desktop/config.json`:

```json
{ "serverUrl": "https://much.seudominio.com" }
```

Depois de instalado, o app também lê `%APPDATA%\Much\config.json`.

Para testar a captura sem o app:

```bash
audio-capture.exe --list                      # lista programas com áudio e mostra quais seriam excluídos
audio-capture.exe > saida.raw                 # PCM s16le 48000 Hz estéreo (Ctrl+C para parar)
```

Opções: `--exclude-name PREFIXO` (repetível, `discord` já vem incluído), `--exclude-pid PID` (exclui a árvore do processo), `--watch-stdin` (encerra quando o stdin fecha) e `--force` (ignora a checagem de versão do Windows).

## Produção

```bash
npm run build          # gera client/dist e server/dist
npm start              # o servidor serve a API, o Socket.IO e o site na mesma porta
```

Gerar o instalador do app desktop (antes, edite `desktop/config.json` com a URL de produção):

```bash
native\audio-capture\build.bat
cd desktop && npm run dist     # instalador em desktop/release/
```

### HTTPS é obrigatório

Câmera, microfone e tela só funcionam em `https://` ou em `localhost`. Opções:

- Um proxy reverso com certificado automático, como o [Caddy](https://caddyserver.com): `caddy reverse-proxy --from much.seudominio.com --to localhost:43124`
- Ou `SSL_KEY_PATH` / `SSL_CERT_PATH` no `.env` para o próprio servidor usar HTTPS.

O app desktop aceita um servidor `http://` na rede local, porque libera essa origem como segura.

### Variáveis do `server/.env`

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `PORT` | `3001` | Porta HTTP/HTTPS |
| `JWT_SECRET` | `dev-secret-change-me` | Segredo dos tokens de login (obrigatório com `NODE_ENV=production`) |
| `DB_PATH` | `server/data/streamflix.db` | SQLite das contas. Caminho fixo relativo ao pacote `server/` (não depende do diretório de onde o processo sobe), para restart não “sumir” com as contas |
| `CORS_ORIGIN` | qualquer | Origens permitidas, separadas por vírgula |
| `MAX_PEERS_PER_ROOM` | `6` | Limite de pessoas por sala pública (chamadas privadas são sempre de 2) |
| `STUN_URLS` | STUN do Google | Servidores STUN |
| `TURN_URLS` / `TURN_USERNAME` / `TURN_CREDENTIAL` | - | Servidor TURN (recomendado na internet) |
| `SSL_KEY_PATH` / `SSL_CERT_PATH` | - | Certificado para HTTPS direto no Node |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | - | App do Spotify para o modo DJ. Opcional: dá para cadastrar em Configurações › Conexões (veja abaixo) |
| `SPOTIFY_REDIRECT_URI` | endereço do pedido | Só se o callback precisar de um endereço diferente do usado para abrir o Much |
| `SPOTIFY_API_URL` / `SPOTIFY_ACCOUNTS_URL` | API oficial | Só para testes com um Spotify falso |

### Spotify (atividade no perfil e modo DJ)

Qualquer conta pode ligar o próprio Spotify em **Configurações › Conexões**. A partir daí o servidor lê "tocando agora" dessa pessoa enquanto ela está online (a cada 6s com música, 20s sem) e manda o que mudou para os amigos dela pelo evento `spotify:presence`. A música aparece no cartão do perfil, no perfil completo e nas listas de amigos, passando na frente de "Na sala X". É só leitura: o Much não manda nenhum comando para o Spotify de quem está sendo visto. Quem fica invisível ou desconecta a conta para de transmitir, e só amigos veem.

Quem conecta o Spotify e clica no botão verde da chamada vira o DJ: o app desktop captura só o áudio do Spotify e manda para todos da sala ou chamada. No Chrome ou no Edge, o DJ abre o [open.spotify.com](https://open.spotify.com) em outra aba e escolhe essa aba com "Compartilhar áudio da aba" ligado. Os outros veem o card "Tocando agora" e podem mutar ou baixar o volume.

O cadastro é feito em **Configurações › Conexões**, pela primeira conta criada no servidor (a dona da instância):

1. Entre em [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) e clique em **Create app**.
2. Em **Redirect URIs**, cole o endereço que a tela de Conexões mostra (botão **Copiar**). É o próprio endereço do Much com `/api/spotify/callback`, por exemplo `http://127.0.0.1:5173/api/spotify/callback` em desenvolvimento ou `https://much.seudominio.com/api/spotify/callback` em produção. O Spotify não aceita `localhost`, só `127.0.0.1`.
3. Marque **Web API** e salve. Copie o **Client ID** e o **Client secret**.
4. Cole os dois em Conexões e clique em **Salvar e conectar**. As chaves ficam no banco e valem para todos do servidor; não precisa reiniciar nada.
5. Enquanto o app estiver em **Development mode**, só as contas do Spotify adicionadas em **User Management** (até 25) conseguem conectar.

Em servidores onde o segredo precisa vir de fora (Docker, CI), preencha `SPOTIFY_CLIENT_ID` e `SPOTIFY_CLIENT_SECRET` no `server/.env`: aí o .env manda e a tela de Conexões passa a só mostrar o estado.

Limites: no app desktop, o DJ precisa do Windows 10 2004+ ou 11, com o app do Spotify aberto. No navegador, só Chrome e Edge no computador compartilham o áudio de abas (Firefox e Safari não). O Spotify Web usa proteção contra cópia (DRM), e em algumas versões a aba compartilhada pode ficar muda. Nesse caso o card avisa e o DJ deve usar o app desktop. Pausar, pular e buscar pelo Much exigem Spotify Premium. Com conta Free, o card e o áudio funcionam, e o controle é feito no próprio Spotify. Retransmitir o áudio do Spotify para outras pessoas vai contra os termos de uso do Spotify.

### TURN (coturn)

A conexão é P2P. Algumas redes, como NAT simétrico, 4G e redes corporativas, só conectam com um servidor TURN. Exemplo com [coturn](https://github.com/coturn/coturn) em `/etc/turnserver.conf`:

```
listening-port=3478
fingerprint
lt-cred-mech
user=much:senha-do-turn
realm=much.seudominio.com
```

E no `server/.env`:

```
TURN_URLS=turn:much.seudominio.com:3478?transport=udp,turn:much.seudominio.com:3478?transport=tcp
TURN_USERNAME=much
TURN_CREDENTIAL=senha-do-turn
```

Libere a porta 3478 (UDP e TCP) e a faixa de relay 49152-65535/UDP no firewall.

## Limites conhecidos

- A malha P2P envia a tela de cada streamer para cada espectador. Funciona bem até umas 6 pessoas por sala. Para salas maiores, seria preciso um SFU (ex: LiveKit).
- No navegador, o Discord só fica fora do áudio se tocar numa saída diferente da padrão do Windows. O app desktop não tem essa limitação.
- Se um programa for "pai" do Discord na árvore de processos (ex: `explorer.exe`), o áudio desse programa também fica de fora. Capturar esse programa em modo árvore incluiria o Discord.
- A captura por processo não existe no Windows Server 2019 / Windows 10 anterior à versão 2004 (build < 19041). Nesses sistemas, a tela é transmitida sem áudio do sistema pelo app desktop.
