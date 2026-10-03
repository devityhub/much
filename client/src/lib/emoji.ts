/**
 * Catálogo de emojis com palavras-chave em português.
 * Cada entrada é "emoji palavras separadas por espaço", e as entradas são separadas por ";".
 */

export interface Emoji {
  char: string;
  keywords: string;
}

export interface EmojiCategory {
  id: string;
  label: string;
  icon: string;
  emojis: Emoji[];
}

const RAW: { id: string; label: string; icon: string; data: string }[] = [
  {
    id: 'carinhas',
    label: 'Carinhas',
    icon: '😀',
    data: `😀 sorriso feliz alegre;😃 sorriso aberto feliz;😄 sorriso alegre olhos;😁 sorriso dentes;😆 risada gargalhada;😅 risada suor alivio;🤣 rolando de rir chorando;😂 chorando de rir lagrima;🙂 sorriso leve;🙃 cabeca pra baixo ironia;😉 piscadinha flerte;😊 sorriso timido fofo;😇 anjo santo;🥰 apaixonado coracoes amor;😍 olhos de coracao amor;🤩 estrelas uau incrivel;😘 beijo;😗 bico beijo;😚 beijo olhos fechados;😙 beijo sorriso;😋 delicia lambendo gostoso;😛 lingua;😜 lingua piscadinha zoeira;🤪 doido maluco zoeira;😝 lingua olhos fechados;🤑 dinheiro rico;🤗 abraco;🤭 risinho opa vergonha;🤫 silencio segredo shh;🤔 pensando duvida hmm;🤐 boca fechada segredo;🤨 desconfiado sobrancelha;😐 neutro serio;😑 sem expressao tedio;😶 sem boca calado;😏 malicioso sorrisinho;😒 desanimado chateado;🙄 revirando os olhos;😬 careta constrangido;🤥 mentira nariz;😌 aliviado tranquilo;😔 triste cabeca baixa;😪 sono cansado;🤤 babando;😴 dormindo zzz;😷 mascara doente;🤒 febre termometro doente;🤕 machucado curativo;🤢 nojo verde;🤮 vomitando;🤧 espirro resfriado;🥵 calor quente suando;🥶 frio congelando;😵 tonto zonzo;🤯 cabeca explodindo choque;🤠 cowboy chapeu;🥳 festa comemorando aniversario;😎 oculos de sol estiloso;🤓 nerd oculos;🧐 monoculo analisando;😕 confuso;😟 preocupado;🙁 triste leve;😮 boca aberta surpreso;😯 surpreso ah;😲 chocado;😳 corado vergonha;🥺 olhos pidao carinha de pena;😦 triste boca aberta;😨 medo assustado;😰 ansioso suor;😥 decepcionado alivio;😢 chorando triste;😭 chorando muito choro;😱 grito de medo pavor;😖 sofrendo;😣 perseverando aperto;😞 decepcionado;😓 suando triste;😩 cansado exausto;😫 cansadao exausto;😤 bufando raiva orgulho;😡 raiva furioso vermelho;😠 bravo raiva;🤬 palavrao raiva;😈 diabinho travesso;👿 diabo raiva;💀 caveira morto morri;☠️ caveira perigo;💩 coco merda;🤡 palhaco;👻 fantasma assombrado;👽 alienigena et;🤖 robo;😺 gato sorriso;😹 gato chorando de rir;😻 gato apaixonado;😽 gato beijo;🙈 macaco olhos tapados vergonha;🙉 macaco orelhas tapadas;🙊 macaco boca tapada;💋 beijo marca batom;💌 carta de amor;💘 coracao flecha;💝 coracao presente;💖 coracao brilhante;💗 coracao crescendo;💓 coracao batendo;💞 coracoes girando;💕 dois coracoes;❤️ coracao vermelho amor;🧡 coracao laranja;💛 coracao amarelo;💚 coracao verde;💙 coracao azul;💜 coracao roxo;🖤 coracao preto;💔 coracao partido;❣️ coracao exclamacao;💯 cem nota maxima top;💢 raiva simbolo;💥 explosao boom;💫 tontura estrela;💦 gotas suor;💨 correndo vento;🕳️ buraco;💤 zzz sono`,
  },
  {
    id: 'pessoas',
    label: 'Pessoas',
    icon: '👋',
    data: `👋 tchau oi acenando;🤚 mao levantada;🖐️ mao aberta cinco;✋ mao parada;🖖 saudacao vulcano;👌 ok otimo;✌️ paz vitoria;🤞 dedos cruzados sorte;🤟 te amo mao;🤘 rock chifre;🤙 me liga shaka;👈 aponta esquerda;👉 aponta direita;👆 aponta cima;👇 aponta baixo;☝️ dedo cima;👍 curtir legal positivo;👎 nao gostei negativo;✊ punho;👊 soco toca aqui;🤛 punho esquerda;🤜 punho direita;👏 palmas aplausos parabens;🙌 maos pra cima aleluia;👐 maos abertas;🤲 maos juntas;🤝 aperto de mao acordo;🙏 orando por favor obrigado;✍️ escrevendo;💅 esmalte unhas;🤳 selfie;💪 musculo forte;🦵 perna;🦶 pe;👂 orelha ouvindo;👃 nariz;🧠 cerebro;🦷 dente;🦴 osso;👀 olhos olhando;👁️ olho;👅 lingua;👄 boca labios;👶 bebe;🧒 crianca;👦 menino;👧 menina;🧑 pessoa;👨 homem;👩 mulher;🧑‍🦱 cabelo cacheado;👱 cabelo loiro;🧔 barba;👴 velho idoso;👵 velha idosa;🙍 franzindo;🙎 bico emburrado;🙅 nao proibido;🙆 ok braços;💁 informacao atendente;🙋 levantando a mao;🙇 reverencia desculpa;🤦 palma na testa facepalm;🤷 sei la ombros;👮 policial;🕵️ detetive;💂 guarda;👷 obra construtor;🤴 principe;👸 princesa;👰 noiva;🤵 noivo terno;🦸 heroi;🦹 vilao;🎅 papai noel;🧙 mago bruxo;🧚 fada;🧛 vampiro;🧜 sereia;🧟 zumbi;💆 massagem;💇 cabelereiro corte;🚶 andando;🏃 correndo;💃 dancando mulher;🕺 dancando homem;👯 orelhas de coelho festa;🧖 sauna;🧗 escalada;🤺 esgrima;🏇 cavalo jockey;⛷️ esqui;🏂 snowboard;🏌️ golfe;🏄 surfe;🚣 remo barco;🏊 natacao nadando;⛹️ basquete;🏋️ academia peso;🚴 bicicleta;🚵 mountain bike;🤸 estrela ginastica;🤼 luta;🤽 polo aquatico;🤾 handebol;🤹 malabarismo;🧘 meditacao yoga;🛀 banho banheira;🛌 na cama dormindo;👭 duas amigas maos;👬 dois amigos maos;👫 casal maos;👪 familia;🗣️ falando;👤 silhueta perfil;👥 duas pessoas`,
  },
  {
    id: 'animais',
    label: 'Animais',
    icon: '🐶',
    data: `🐶 cachorro dog;🐱 gato cat;🐭 rato;🐹 hamster;🐰 coelho;🦊 raposa;🐻 urso;🐼 panda;🐻‍❄️ urso polar;🐨 koala;🐯 tigre;🦁 leao;🐮 vaca;🐷 porco;🐽 nariz de porco;🐸 sapo;🐵 macaco;🙈 macaco sem ver;🐒 macaco;🐔 galinha;🐧 pinguim;🐦 passaro;🐤 pintinho;🦆 pato;🦅 aguia;🦉 coruja;🦇 morcego;🐺 lobo;🐗 javali;🐴 cavalo;🦄 unicornio;🐝 abelha;🐛 lagarta;🦋 borboleta;🐌 caracol;🐞 joaninha;🐜 formiga;🦗 grilo;🕷️ aranha;🕸️ teia;🦂 escorpiao;🐢 tartaruga;🐍 cobra;🦎 lagartixa;🦖 dinossauro trex;🦕 dinossauro;🐙 polvo;🦑 lula;🦐 camarao;🦞 lagosta;🦀 caranguejo;🐡 baiacu;🐠 peixe tropical;🐟 peixe;🐬 golfinho;🐳 baleia;🐋 baleia grande;🦈 tubarao;🐊 crocodilo;🐅 tigre grande;🐆 leopardo;🦓 zebra;🦍 gorila;🐘 elefante;🦛 hipopotamo;🦏 rinoceronte;🐪 camelo;🦒 girafa;🦘 canguru;🐃 bufalo;🐂 boi;🐄 vaca leiteira;🐎 cavalo correndo;🐖 porco;🐏 carneiro;🐑 ovelha;🦙 lhama;🐐 cabra;🦌 veado;🐕 cachorro;🐩 poodle;🐕‍🦺 cao de servico;🐈 gato;🐈‍⬛ gato preto;🐓 galo;🦃 peru;🦚 pavao;🦜 papagaio;🦢 cisne;🕊️ pomba paz;🐇 coelho;🦝 guaxinim;🦡 texugo;🐁 camundongo;🐀 ratazana;🐿️ esquilo;🦔 ourico;🐾 patinhas pegadas;🌵 cacto;🎄 arvore de natal;🌲 pinheiro;🌳 arvore;🌴 coqueiro palmeira;🌱 muda planta;🌿 erva folha;☘️ trevo;🍀 trevo quatro folhas sorte;🍃 folhas vento;🍂 folhas de outono;🍁 folha de bordo;🌾 trigo;🌷 tulipa;🌹 rosa;🥀 rosa murcha;🌺 hibisco;🌸 flor de cerejeira;🌼 margarida;🌻 girassol;🍄 cogumelo;🌰 castanha;🐚 concha;🌍 mundo terra planeta;🌎 terra americas;🌕 lua cheia;🌙 lua;⭐ estrela;🌟 estrela brilhante;✨ brilhos faiscas;⚡ raio energia;🔥 fogo chama top;🌈 arco iris;☀️ sol;⛅ nuvem sol;☁️ nuvem;🌧️ chuva;⛈️ tempestade;❄️ floco de neve frio;⛄ boneco de neve;💧 gota agua;🌊 onda mar`,
  },
  {
    id: 'comida',
    label: 'Comida',
    icon: '🍕',
    data: `🍏 maca verde;🍎 maca;🍐 pera;🍊 laranja;🍋 limao;🍌 banana;🍉 melancia;🍇 uva;🍓 morango;🍈 melao;🍒 cereja;🍑 pessego;🥭 manga;🍍 abacaxi;🥥 coco;🥝 kiwi;🍅 tomate;🍆 berinjela;🥑 abacate;🥦 brocolis;🥬 folha verde;🥒 pepino;🌶️ pimenta;🌽 milho;🥕 cenoura;🥔 batata;🍠 batata doce;🥐 croissant;🥯 bagel;🍞 pao;🥖 baguete;🥨 pretzel;🧀 queijo;🥚 ovo;🍳 ovo frito;🥞 panqueca;🥓 bacon;🥩 carne bife;🍗 coxa frango;🍖 carne osso;🦴 osso;🌭 hot dog;🍔 hamburguer;🍟 batata frita;🍕 pizza;🥪 sanduiche;🥙 wrap;🌮 taco;🌯 burrito;🥗 salada;🥘 panela comida;🍝 macarrao espaguete;🍜 lamen sopa;🍲 sopa;🍛 curry arroz;🍣 sushi;🍱 bento;🥟 guioza;🍤 camarao frito;🍙 bolinho de arroz;🍚 arroz;🍘 biscoito de arroz;🍥 narutomaki;🥮 bolo da lua;🥠 biscoito da sorte;🍢 espetinho;🍡 dango;🍧 raspadinha;🍨 sorvete;🍦 sorvete casquinha;🥧 torta;🧁 cupcake;🍰 bolo fatia;🎂 bolo de aniversario;🍮 pudim;🍭 pirulito;🍬 bala doce;🍫 chocolate;🍿 pipoca;🍩 rosquinha donut;🍪 biscoito cookie;🌰 castanha;🥜 amendoim;🍯 mel;🥛 leite;🍼 mamadeira;☕ cafe;🍵 cha;🥤 refrigerante copo;🍶 sake;🍺 cerveja chopp;🍻 cervejas brinde;🥂 brinde champanhe;🍷 vinho;🥃 whisky;🍸 drink martini;🍹 drink tropical;🥄 colher;🍴 garfo faca;🍽️ prato talheres;🥣 tigela;🥡 marmita;🧂 sal`,
  },
  {
    id: 'atividades',
    label: 'Atividades',
    icon: '⚽',
    data: `⚽ futebol bola;🏀 basquete;🏈 futebol americano;⚾ beisebol;🥎 softbol;🎾 tenis;🏐 volei;🏉 rugby;🥏 frisbee;🎱 sinuca bilhar;🏓 ping pong;🏸 badminton;🏒 hoquei;🥍 lacrosse;🏏 criquete;🥅 gol trave;⛳ golfe;🏹 arco e flecha;🎣 pescaria;🥊 boxe luva;🥋 judo karate;🎽 corrida camisa;🛹 skate;🛷 trenó;⛸️ patinacao no gelo;🎿 esqui;⛷️ esquiando;🏂 snowboard;🏋️ levantamento de peso;🤸 ginastica;🤼 luta livre;🤾 handebol;⛹️ basquete jogando;🏌️ golfe jogando;🏇 corrida de cavalo;🧘 yoga meditacao;🏄 surfando;🏊 nadando;🤽 polo aquatico;🚣 remando;🧗 escalando;🚵 ciclismo montanha;🚴 pedalando;🏆 trofeu campeao vitoria;🥇 medalha de ouro primeiro;🥈 medalha de prata;🥉 medalha de bronze;🏅 medalha;🎖️ medalha militar;🏵️ roseta;🎗️ fita;🎫 ingresso;🎟️ entrada;🎪 circo;🤹 malabares;🎭 teatro mascaras;🎨 arte pintura;🎬 cinema claquete filme;🎤 microfone cantar karaoke;🎧 fone de ouvido musica;🎼 partitura;🎹 piano teclado;🥁 bateria tambor;🎷 saxofone;🎺 trompete;🎸 guitarra violao;🎻 violino;🎲 dado jogo;♟️ xadrez peao;🎯 alvo dardo acertou;🎳 boliche;🎮 videogame controle;🕹️ joystick arcade;🎰 caca niquel;🧩 quebra cabeca;🧸 ursinho brinquedo;🎈 balao festa;🎉 festa confete parabens;🎊 confete festa;🎁 presente;🎀 laco fita;🎇 fogos faiscas;🎆 fogos de artificio;🎠 carrossel;🎡 roda gigante;🎢 montanha russa`,
  },
  {
    id: 'viagem',
    label: 'Viagem',
    icon: '🚗',
    data: `🚗 carro automovel;🚕 taxi;🚙 suv carro;🚌 onibus;🚎 trolebus;🏎️ carro de corrida;🚓 viatura policia;🚑 ambulancia;🚒 bombeiro caminhao;🚐 van;🚚 caminhao;🚛 carreta;🚜 trator;🛵 scooter moto;🏍️ moto;🚲 bicicleta;🛴 patinete;🛹 skate;🚏 parada de onibus;🛣️ estrada rodovia;🛤️ trilhos trem;⛽ posto gasolina;🚨 sirene policia;🚥 semaforo;🚦 sinal;🚧 obras;⚓ ancora;⛵ veleiro barco;🛶 canoa;🚤 lancha;🛳️ navio;⛴️ balsa;🛥️ iate;🚢 navio grande;✈️ aviao viagem;🛫 decolagem;🛬 pouso;💺 assento;🚁 helicoptero;🚟 teleferico;🚠 bondinho;🚡 gondola;🛰️ satelite;🚀 foguete lancamento;🛸 nave ovni;🚉 estacao;🚆 trem;🚄 trem bala;🚝 monotrilho;🚂 locomotiva;🚃 vagao;🚋 bonde;🚞 trem de montanha;🎡 roda gigante;🗼 torre de toquio;🗽 estatua da liberdade;🗿 moai;🏰 castelo;🏯 castelo japones;🏟️ estadio;🎢 montanha russa;⛲ chafariz;⛱️ guarda sol praia;🏖️ praia;🏝️ ilha;🏜️ deserto;🌋 vulcao;⛰️ montanha;🏔️ montanha com neve;🗻 monte fuji;🏕️ acampamento;⛺ barraca;🏞️ parque;🏠 casa;🏡 casa com jardim;🏘️ casas;🏚️ casa abandonada;🏗️ construcao;🏭 fabrica;🏢 predio escritorio;🏬 shopping loja;🏣 correio;🏤 correio europeu;🏥 hospital;🏦 banco;🏨 hotel;🏪 mercado conveniencia;🏫 escola;🏩 motel;💒 casamento igreja;⛪ igreja;🕌 mesquita;🕍 sinagoga;🗺️ mapa;🧭 bussola;🧳 mala viagem;🌃 cidade a noite;🌆 cidade ao por do sol;🌇 por do sol;🌉 ponte a noite;🌌 via lactea estrelas;🎑 lua paisagem;🏙️ cidade horizonte;🌁 neblina cidade`,
  },
  {
    id: 'objetos',
    label: 'Objetos',
    icon: '💡',
    data: `⌚ relogio de pulso;📱 celular telefone;📲 celular chamando;💻 notebook computador;⌨️ teclado;🖥️ computador monitor;🖨️ impressora;🖱️ mouse;🕹️ joystick;💽 disquete;💾 disquete salvar;💿 cd;📀 dvd;📷 camera foto;📸 camera flash;📹 filmadora;🎥 camera de cinema;📽️ projetor;🎞️ filme rolo;📞 telefone fone;☎️ telefone fixo;📟 pager;📠 fax;📺 tv televisao;📻 radio;🎙️ microfone estudio;🎚️ controle deslizante;🎛️ botoes mesa de som;🧭 bussola;⏱️ cronometro;⏲️ timer;⏰ despertador alarme;🕰️ relogio de mesa;⌛ ampulheta;⏳ ampulheta tempo;📡 antena satelite;🔋 bateria;🔌 tomada plug;💡 lampada ideia;🔦 lanterna;🕯️ vela;🧯 extintor;🛢️ barril petroleo;💸 dinheiro voando;💵 dolar dinheiro;💴 iene;💶 euro;💷 libra;💰 saco de dinheiro;💳 cartao de credito;💎 diamante joia;⚖️ balanca justica;🧰 caixa de ferramentas;🔧 chave inglesa;🔨 martelo;⚒️ ferramentas;🛠️ martelo chave;⛏️ picareta;🔩 parafuso;⚙️ engrenagem configuracao;🧱 tijolo;⛓️ corrente;🧲 ima;🔫 arma dagua;💣 bomba;🧨 dinamite;🔪 faca;🗡️ espada;🛡️ escudo;🚬 cigarro;⚰️ caixao;🏺 anfora;🔮 bola de cristal;🧿 olho grego;🧸 ursinho;🧹 vassoura;🧺 cesto;🧻 papel higienico;🧼 sabao;🧽 esponja;🛁 banheira;🚿 chuveiro;🚽 vaso sanitario;🛋️ sofa;🛏️ cama;🚪 porta;🖼️ quadro moldura;🛒 carrinho de compras;🎒 mochila;👓 oculos;🕶️ oculos escuros;🥼 avental laboratorio;👔 gravata;👕 camiseta;👖 calca jeans;🧥 jaqueta;👗 vestido;👘 quimono;👠 salto alto;👟 tenis;🥾 bota;🧦 meia;🧢 bone;🎩 cartola;👑 coroa;💍 anel aliança;👛 bolsa carteira;🎓 formatura capelo;📚 livros estudo;📖 livro aberto;📓 caderno;📝 anotacao lapis;✏️ lapis;🖊️ caneta;🖌️ pincel;🖍️ giz de cera;📌 alfinete;📍 marcador local;📎 clipe;✂️ tesoura;📏 regua;📐 esquadro;📅 calendario;📆 calendario data;🗓️ agenda;📊 grafico barras;📈 grafico subindo;📉 grafico caindo;📋 prancheta;📁 pasta;📂 pasta aberta;🗂️ arquivos;📰 jornal noticia;✉️ envelope email;📧 email;📨 mensagem recebida;📩 mensagem enviada;📤 caixa de saida;📥 caixa de entrada;📦 pacote caixa;🔑 chave;🔒 cadeado fechado;🔓 cadeado aberto;🔍 lupa buscar;🔎 lupa direita;💊 remedio pilula;💉 injecao vacina;🧪 tubo de ensaio;🧫 placa de petri;🧬 dna;🔬 microscopio;🔭 telescopio`,
  },
  {
    id: 'simbolos',
    label: 'Símbolos',
    icon: '✅',
    data: `✅ check certo feito;❌ errado x nao;❎ x verde;✔️ check;☑️ caixa marcada;❓ interrogacao duvida;❔ interrogacao branca;❗ exclamacao atencao;❕ exclamacao branca;‼️ duas exclamacoes;⁉️ interrobang;⚠️ aviso cuidado;🚫 proibido;⛔ entrada proibida;🔞 maior de 18;📵 sem celular;🚭 nao fume;🚯 nao jogue lixo;🚱 agua nao potavel;🚳 sem bicicletas;❇️ faisca;✳️ asterisco;✴️ estrela oito pontas;🔅 brilho baixo;🔆 brilho alto;⁇ interrogacoes;♻️ reciclagem;⚜️ flor de lis;🔱 tridente;📛 cracha nome;🔰 iniciante japao;⭕ circulo vermelho;✖️ multiplicacao;➕ mais;➖ menos;➗ divisao;♾️ infinito;💲 dolar simbolo;💱 cambio;™️ marca registrada;©️ copyright;®️ registrado;〰️ linha ondulada;➰ loop;➿ loop duplo;🔚 fim;🔙 voltar;🔛 ligado on;🔜 logo mais;🔝 topo cima;🔄 girar atualizar;🔃 recarregar;🔁 repetir;🔂 repetir uma vez;▶️ play;⏸️ pausa;⏹️ parar stop;⏺️ gravar;⏭️ proxima;⏮️ anterior;⏩ avancar;⏪ voltar rapido;🔼 cima;🔽 baixo;⏫ subir rapido;⏬ descer rapido;⬆️ seta cima;⬇️ seta baixo;⬅️ seta esquerda;➡️ seta direita;↗️ seta diagonal;↘️ seta baixo direita;↙️ seta baixo esquerda;↖️ seta cima esquerda;↕️ seta vertical;↔️ seta horizontal;↩️ retornar;↪️ avancar seta;⤴️ seta curva cima;⤵️ seta curva baixo;🔀 aleatorio shuffle;🔊 som alto volume;🔉 som medio;🔈 som baixo;🔇 mudo sem som;📢 megafone aviso;📣 corneta torcida;🔔 campainha notificacao;🔕 sino cortado silencioso;🎵 nota musical;🎶 notas musicais musica;💬 balao de fala chat;💭 pensamento;🗯️ balao de raiva;💤 zzz;🔺 triangulo vermelho;🔻 triangulo invertido;🔶 diamante laranja;🔷 diamante azul;🔸 diamante pequeno;🔹 diamante azul pequeno;🔘 botao radio;🔳 quadrado branco;🔲 quadrado preto;⚫ bolinha preta;⚪ bolinha branca;🔴 bolinha vermelha;🔵 bolinha azul;⬛ quadrado preto grande;⬜ quadrado branco grande;♠️ espadas;♥️ copas;♦️ ouros;♣️ paus;🃏 joker curinga;🀄 mahjong;🎴 cartas flor;🕐 uma hora;🕛 meia noite doze;⌚ relogio;🏳️ bandeira branca;🏴 bandeira preta;🏁 bandeira quadriculada largada;🚩 bandeira vermelha;🏳️‍🌈 bandeira arco iris lgbt;🇧🇷 brasil bandeira`,
  },
];

function parse(data: string): Emoji[] {
  return data
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const space = entry.indexOf(' ');
      return space === -1 ? { char: entry, keywords: '' } : { char: entry.slice(0, space), keywords: entry.slice(space + 1) };
    });
}

export const EMOJI_CATEGORIES: EmojiCategory[] = RAW.map(({ id, label, icon, data }) => ({ id, label, icon, emojis: parse(data) }));

export const ALL_EMOJIS: Emoji[] = EMOJI_CATEGORIES.flatMap((c) => c.emojis);

const BY_CHAR = new Map(ALL_EMOJIS.map((e) => [e.char, e] as const));

/** Remove acentos para a busca achar "coracao" e "coração". */
function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function searchEmojis(query: string, limit = 60): Emoji[] {
  const q = normalize(query);
  if (!q) return [];
  const starts: Emoji[] = [];
  const contains: Emoji[] = [];
  for (const emoji of ALL_EMOJIS) {
    const words = emoji.keywords.split(' ');
    if (words.some((w) => w.startsWith(q))) starts.push(emoji);
    else if (emoji.keywords.includes(q)) contains.push(emoji);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}

const RECENTS_KEY = 'much.emojiRecents';
const MAX_RECENTS = 24;

export function loadEmojiRecents(): Emoji[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const chars = JSON.parse(raw) as unknown;
    if (!Array.isArray(chars)) return [];
    return chars
      .filter((c): c is string => typeof c === 'string')
      .map((c) => BY_CHAR.get(c))
      .filter((e): e is Emoji => Boolean(e))
      .slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

export function saveEmojiRecent(char: string): Emoji[] {
  const next = [char, ...loadEmojiRecents().map((e) => e.char).filter((c) => c !== char)].slice(0, MAX_RECENTS);
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    // modo privado sem storage: só não guarda
  }
  return next.map((c) => BY_CHAR.get(c)).filter((e): e is Emoji => Boolean(e));
}
