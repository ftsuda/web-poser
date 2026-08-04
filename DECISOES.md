# Decisões Técnicas e Problemas Encontrados

Registro de problemas encontrados durante a implementação, opções consideradas e decisão tomada. Cada entrada segue: **Contexto → Opções → Decisão → Motivo**.

---

## Índice

As **129 decisões**, na ordem em que foram tomadas. Os números **nunca são reaproveitados** — o `PLANO.md`, o `HISTORICO.md` e as próprias entradas se citam por eles. Decisão desdobrada depois ganha subnúmero (78.1, 78.2…) em vez de número novo.

- **#1** — [Aviso "not wrapped in act(...)" nos testes do Toolbar (react-i18next)](#1-aviso-not-wrapped-in-act-nos-testes-do-toolbar-react-i18next)
- **#2** — [Aviso "THREE.Clock: This module has been deprecated" no console](#2-aviso-threeclock-this-module-has-been-deprecated-no-console)
- **#3** — [Arrastar o mouse no viewport não gira a câmera (OrbitControls) durante teste manual via automação de navegador](#3-arrastar-o-mouse-no-viewport-não-gira-a-câmera-orbitcontrols-durante-teste-manual-via-automação-de-navegador)
- **#4** — ["Cannot assign to read only property 'position'" ao passar instâncias de `THREE.Vector3`/`THREE.Quaternion` como props JSX (fase 2, `Figure.tsx`)](#4-cannot-assign-to-read-only-property-position-ao-passar-instâncias-de-threevector3threequaternion-como-props-jsx-fase-2-figuretsx)
- **#5** — [Avaliação da biblioteca `mannequin.js` como possível dependência para a geometria do boneco](#5-avaliação-da-biblioteca-mannequinjs-como-possível-dependência-para-a-geometria-do-boneco)
- **#6** — [`@react-three/test-renderer` não expõe `TransformControls` (drei) como um nó localizável por tipo/props na árvore da cena](#6-react-threetest-renderer-não-expõe-transformcontrols-drei-como-um-nó-localizável-por-tipoprops-na-árvore-da-cena)
- **#7** — [Gizmo de translação do `root` "arrancava" o boneco do chão e descolava a sombra — bug real reportado pelo usuário na validação manual da fase 3](#7-gizmo-de-translação-do-root-arrancava-o-boneco-do-chão-e-descolava-a-sombra--bug-real-reportado-pelo-usuário-na-validação-manual-da-fase-3)
- **#8** — [Fase 4 (Câmera) — troca perspectiva/ortográfica sem remontar o componente de câmera do drei](#8-fase-4-câmera--troca-perspectivaortográfica-sem-remontar-o-componente-de-câmera-do-drei)
- **#9** — [Fase 5 (Keyframes) — captura de PNG sob demanda em resolução configurável, sem flash visual](#9-fase-5-keyframes--captura-de-png-sob-demanda-em-resolução-configurável-sem-flash-visual)
- **#10** — [Pedido do usuário — "teste de captura" com parte do boneco abaixo do plano do chão](#10-pedido-do-usuário--teste-de-captura-com-parte-do-boneco-abaixo-do-plano-do-chão)
- **#11** — [Fase 6 — esclarecimento de "lista de cenas" → conceito de *workspace* com snapshots de cena](#11-fase-6--esclarecimento-de-lista-de-cenas--conceito-de-workspace-com-snapshots-de-cena)
- **#12** — [Fase 7 (IK) — CCD por eixo trava contra o limite articular e não converge, mesmo para alvos alcançáveis](#12-fase-7-ik--ccd-por-eixo-trava-contra-o-limite-articular-e-não-converge-mesmo-para-alvos-alcançáveis)
- **#13** — [Fase 8 (poses predefinidas) — limites de `hip.x`/`shoulder.x` em `skeleton.ts` tinham a faixa grande do lado errado (bug desde a fase 2)](#13-fase-8-poses-predefinidas--limites-de-hipxshoulderx-em-skeletonts-tinham-a-faixa-grande-do-lado-errado-bug-desde-a-fase-2)
- **#14** — [Fase 9, item 12 — auditoria completa de sinal/direção das juntas restantes (spine/chest/neck/head, clavicle, wrist, ankle, eixos y/z de hip/shoulder)](#14-fase-9-item-12--auditoria-completa-de-sinaldireção-das-juntas-restantes-spinechestneckhead-clavicle-wrist-ankle-eixos-yz-de-hipshoulder)
- **#15** — [Ajuste de proporções corporais e visual do boneco (pescoço/tronco, dedos, rosto) — pedido do usuário](#15-ajuste-de-proporções-corporais-e-visual-do-boneco-pescoçotronco-dedos-rosto--pedido-do-usuário)
- **#16** — [Junta `upperChest`, mãos com 3 falanges por dedo, polegar em cilindro e conectores de tronco mais robustos — pedido do usuário](#16-junta-upperchest-mãos-com-3-falanges-por-dedo-polegar-em-cilindro-e-conectores-de-tronco-mais-robustos--pedido-do-usuário)
- **#17** — [Correção — conector `chest`↔`spine` ainda fino após o #16](#17-correção--conector-chestspine-ainda-fino-após-o-16)
- **#18** — [`chest` em trapézio (mais largo em cima, mais estreito embaixo) + offset `spine`→`chest` encolhido para compensar](#18-chest-em-trapézio-mais-largo-em-cima-mais-estreito-embaixo--offset-spinechest-encolhido-para-compensar)
- **#19** — [T-pose como padrão, botão de retorno, combo box de seleção de junta, olhos pretos e topo do chest fechado](#19-t-pose-como-padrão-botão-de-retorno-combo-box-de-seleção-de-junta-olhos-pretos-e-topo-do-chest-fechado)
- **#20** — [Polegar para trás na T-pose (bug real) + remodelagem do tronco (chest em 2 trapézios, cilindro achatado, conector spine-root mais largo)](#20-polegar-para-trás-na-t-pose-bug-real--remodelagem-do-tronco-chest-em-2-trapézios-cilindro-achatado-conector-spine-root-mais-largo)
- **#21** — [Novo modelo visual "manequim de madeira" — `skeleton2.ts`/`Figure2.tsx` substitui `skeleton.ts`/`Figure.tsx` como renderer ativo](#21-novo-modelo-visual-manequim-de-madeira--skeleton2tsfigure2tsx-substitui-skeletontsfiguretsx-como-renderer-ativo)
- **#22** — [Revisão das mãos — torção neutra do antebraço (não só na T-pose), bug real no lado R, e pino de latão marcando o dorso da mão](#22-revisão-das-mãos--torção-neutra-do-antebraço-não-só-na-t-pose-bug-real-no-lado-r-e-pino-de-latão-marcando-o-dorso-da-mão)
- **#23** — [Correção do #22 — o "conflito" do braço R era um bug de quiralidade na própria verificação, não um limite real do esqueleto; `elbow.R.y=135` revertido para o espelho simples `-45`](#23-correção-do-22--o-conflito-do-braço-r-era-um-bug-de-quiralidade-na-própria-verificação-não-um-limite-real-do-esqueleto-elbowry135-revertido-para-o-espelho-simples--45)
- **#24** — [Palma exatamente paralela ao chão na T-pose — ajuste na modelagem (offsets de `thumb1`/`fingersBase`), não na pose](#24-palma-exatamente-paralela-ao-chão-na-t-pose--ajuste-na-modelagem-offsets-de-thumb1fingersbase-não-na-pose)
- **#25** — [Remodelagem completa da mão — alinhada aos eixos locais do punho, torção neutra ±90°, proporções humanas](#25-remodelagem-completa-da-mão--alinhada-aos-eixos-locais-do-punho-torção-neutra-90-proporções-humanas)
- **#26** — [Braços mais curtos, ombros mais próximos do tronco e chest mais baixo — confirmados pela antropometria antes de aplicar](#26-braços-mais-curtos-ombros-mais-próximos-do-tronco-e-chest-mais-baixo--confirmados-pela-antropometria-antes-de-aplicar)
- **#27** — [Revisão da ligação chest/upperChest → neck — pescoço visível engrossado (era "palito" de 0,39 da largura da cabeça)](#27-revisão-da-ligação-chestupperchest--neck--pescoço-visível-engrossado-era-palito-de-039-da-largura-da-cabeça)
- **#28** — [Verificação de cabeça e pernas — cabeça proporcional (sem ajuste); pernas re-ancoradas nos marcos (o offset do quadril "comia" 3 cm)](#28-verificação-de-cabeça-e-pernas--cabeça-proporcional-sem-ajuste-pernas-re-ancoradas-nos-marcos-o-offset-do-quadril-comia-3-cm)
- **#29** — [Limites articulares customizáveis por workspace — `joint-limits.json` como camada por cima dos padrões do código](#29-limites-articulares-customizáveis-por-workspace--joint-limitsjson-como-camada-por-cima-dos-padrões-do-código)
- **#30** — [Poses de mão, poses de corpo com colocação no chão e simetria esquerda/direita — e a correção de `clavicle.R.z`](#30-poses-de-mão-poses-de-corpo-com-colocação-no-chão-e-simetria-esquerdadireita--e-a-correção-de-claviclerz)
- **#31** — [Fase 9 (refinamentos de UX e workspace) — quatro decisões confirmadas com o usuário e três detalhes técnicos que não eram óbvios](#31-fase-9-refinamentos-de-ux-e-workspace--quatro-decisões-confirmadas-com-o-usuário-e-três-detalhes-técnicos-que-não-eram-óbvios)
- **#32** — [Fechamento do mapa de atalhos e remoção do renderizador antigo (dívida técnica dos itens 20 e 22 do cardápio)](#32-fechamento-do-mapa-de-atalhos-e-remoção-do-renderizador-antigo-dívida-técnica-dos-itens-20-e-22-do-cardápio)
- **#33** — [Régua vertical ancorada no boneco selecionado](#33-régua-vertical-ancorada-no-boneco-selecionado)
- **#34** — [Espelho e inversão parciais: a simetria passa a valer da junta selecionada para baixo](#34-espelho-e-inversão-parciais-a-simetria-passa-a-valer-da-junta-selecionada-para-baixo)
- **#35** — [Poses de luta em par e o botão de pose aleatória](#35-poses-de-luta-em-par-e-o-botão-de-pose-aleatória)
- **#36** — [Primeira entrega do catálogo: 18 poses novas (apontar, apoios no chão, A-pose) e o combo agrupado](#36-primeira-entrega-do-catálogo-18-poses-novas-apontar-apoios-no-chão-a-pose-e-o-combo-agrupado)
- **#37** — [Segunda entrega do catálogo: 26 poses novas (expressivas, ação e 13 poses em par)](#37-segunda-entrega-do-catálogo-26-poses-novas-expressivas-ação-e-13-poses-em-par)
- **#38** — [Terceira entrega do catálogo: meditação, poses de postura, "deitado em X" e o mata-leão sentado](#38-terceira-entrega-do-catálogo-meditação-poses-de-postura-deitado-em-x-e-o-mata-leão-sentado)
- **#39** — [Cor livre para os bonecos, no lugar da paleta fixa de 5](#39-cor-livre-para-os-bonecos-no-lugar-da-paleta-fixa-de-5)
- **#40** — [Mata-leão deitado, e a direção dos braços no "deitado em X"](#40-mata-leão-deitado-e-a-direção-dos-braços-no-deitado-em-x)
- **#41** — [Poses em dupla aplicadas automaticamente no segundo boneco](#41-poses-em-dupla-aplicadas-automaticamente-no-segundo-boneco)
- **#42** — [Biblioteca de poses do usuário e travamento de juntas](#42-biblioteca-de-poses-do-usuário-e-travamento-de-juntas)
- **#43** — [Mistura entre duas poses — e por que o quatérnio foi reprovado](#43-mistura-entre-duas-poses--e-por-que-o-quatérnio-foi-reprovado)
- **#44** — [Giro do cotovelo/joelho (IK), e o aviso de alcance que mentia](#44-giro-do-cotovelojoelho-ik-e-o-aviso-de-alcance-que-mentia)
- **#45** — [Dedo indicador separado, e a adução do polegar que faltava](#45-dedo-indicador-separado-e-a-adução-do-polegar-que-faltava)
- **#46** — [Câmera no vocabulário de fotografia: lente em milímetros, enquadramento, ângulo e movimento A→B](#46-câmera-no-vocabulário-de-fotografia-lente-em-milímetros-enquadramento-ângulo-e-movimento-ab)
- **#47** — [Termo em inglês no botão, tradução como legenda](#47-termo-em-inglês-no-botão-tradução-como-legenda)
- **#48** — [Sem seleção, o enquadramento é do conjunto](#48-sem-seleção-o-enquadramento-é-do-conjunto)
- **#49** — [Contra-picado limitado pelo chão](#49-contra-picado-limitado-pelo-chão)
- **#50** — [O vocabulário de câmera completo](#50-o-vocabulário-de-câmera-completo)
- **#51** — [Enquadramento por combo, com botão de confirmar](#51-enquadramento-por-combo-com-botão-de-confirmar)
- **#52** — [Mini animador: as quatro decisões que o pedido deixou em aberto](#52-mini-animador-as-quatro-decisões-que-o-pedido-deixou-em-aberto)
- **#53** — [Máscara de enquadramento, e a caixa da pose em dupla](#53-máscara-de-enquadramento-e-a-caixa-da-pose-em-dupla)
- **#54** — [Fim da reprodução devolve a cena, e o keyframe intermediário](#54-fim-da-reprodução-devolve-a-cena-e-o-keyframe-intermediário)
- **#55** — [O vídeo saía errado — e as três funcionalidades da mesma leva](#55-o-vídeo-saía-errado--e-as-três-funcionalidades-da-mesma-leva)
- **#56** — [Redutor/acelerador global da animação](#56-redutoracelerador-global-da-animação)
- **#57** — [Ferramentas de criação de poses padrão](#57-ferramentas-de-criação-de-poses-padrão)
- **#58** — [Apoiar no chão e espelho ao vivo](#58-apoiar-no-chão-e-espelho-ao-vivo)
- **#59** — [Zerar por grupo e copiar só um membro](#59-zerar-por-grupo-e-copiar-só-um-membro)
- **#60** — [Trechos de animação prontos (solo e em dupla)](#60-trechos-de-animação-prontos-solo-e-em-dupla)
- **#61** — [Guarda de luta: cotovelo direito baixado](#61-guarda-de-luta-cotovelo-direito-baixado)
- **#62** — [Poses e trechos de dança pop (K-pop)](#62-poses-e-trechos-de-dança-pop-k-pop)
- **#63** — [Joelhada na barriga com cambalhota](#63-joelhada-na-barriga-com-cambalhota)
- **#64** — [Chave de braço sentada (empurrão/puxão) + trecho `armLock`](#64-chave-de-braço-sentada-empurrãopuxão--trecho-armlock)
- **#65** — [Nove itens de animação: bancada, régua no rodapé, grupos e biblioteca de trechos](#65-nove-itens-de-animação-bancada-régua-no-rodapé-grupos-e-biblioteca-de-trechos)
- **#66** — [Rolagem horizontal nos painéis e a ordem de Animação e Instantâneos](#66-rolagem-horizontal-nos-painéis-e-a-ordem-de-animação-e-instantâneos)
- **#67** — [Botões do card, captura fixa no topo e papel-cebola (item 31)](#67-botões-do-card-captura-fixa-no-topo-e-papel-cebola-item-31)
- **#68** — [Área de transferência de poses](#68-área-de-transferência-de-poses)
- **#69** — [Confirmação ao regravar, "Inserir" na barra e o nome da animação junto da biblioteca](#69-confirmação-ao-regravar-inserir-na-barra-e-o-nome-da-animação-junto-da-biblioteca)
- **#70** — [Espelho completo do boneco](#70-espelho-completo-do-boneco)
- **#71** — [Barra da linha do tempo em duas fileiras](#71-barra-da-linha-do-tempo-em-duas-fileiras)
- **#72** — [Duas poses de balé e a pirueta](#72-duas-poses-de-balé-e-a-pirueta)
- **#73** — [O keyframe que está na bancada: destaque no card e marca na régua](#73-o-keyframe-que-está-na-bancada-destaque-no-card-e-marca-na-régua)
- **#74** — [Papel-cebola com escolha de lado](#74-papel-cebola-com-escolha-de-lado)
- **#75** — [Marca do playhead no card do keyframe](#75-marca-do-playhead-no-card-do-keyframe)
- **#76** — [Gizmo de translação de junta (arrasto de cadeia) — e a aposentadoria do IK de 2 ossos](#76-gizmo-de-translação-de-junta-arrasto-de-cadeia--e-a-aposentadoria-do-ik-de-2-ossos)
- **#77** — [Juntas travadas em vermelho enquanto o gizmo de mover está ativo](#77-juntas-travadas-em-vermelho-enquanto-o-gizmo-de-mover-está-ativo)
- **#78** — [Câmera de cena separada do viewport de trabalho (fase 11)](#78-câmera-de-cena-separada-do-viewport-de-trabalho-fase-11)
- **#78.1** — [Correção do "ver pela câmera" torcendo a câmera, e controles numéricos de posição/rotação](#781-correção-do-ver-pela-câmera-torcendo-a-câmera-e-controles-numéricos-de-posiçãorotação)
- **#78.2** — [Botões Mover/Girar da câmera no painel](#782-botões-movergirar-da-câmera-no-painel)
- **#78.3** — ["Vertical 9:16" direto no seletor da máscara de enquadramento](#783-vertical-916-direto-no-seletor-da-máscara-de-enquadramento)
- **#78.4** — [Máscara por proporção e resoluções como proporção × qualidade](#784-máscara-por-proporção-e-resoluções-como-proporção--qualidade)
- **#79** — [Exportar e importar uma animação em JSON, com remapeamento para os bonecos da cena](#79-exportar-e-importar-uma-animação-em-json-com-remapeamento-para-os-bonecos-da-cena)
- **#80** — [Objetos de cena 3D redimensionáveis, com vértice livre](#80-objetos-de-cena-3d-redimensionáveis-com-vértice-livre)
- **#81** — [Casca de palito e pose em arquivo JSON — a ponte com o celular](#81-casca-de-palito-e-pose-em-arquivo-json--a-ponte-com-o-celular)
- **#82** — [Enxertar uma animação importada, carimbar a câmera atual e a confirmação de regravar em `<dialog>`](#82-enxertar-uma-animação-importada-carimbar-a-câmera-atual-e-a-confirmação-de-regravar-em-dialog)
- **#83** — [Reorganização do painel de Animação: teto na lista, seções recolhíveis e as ações da linha do tempo juntas](#83-reorganização-do-painel-de-animação-teto-na-lista-seções-recolhíveis-e-as-ações-da-linha-do-tempo-juntas)
- **#84** — [Reorganização dos painéis de Propriedades e Câmera](#84-reorganização-dos-painéis-de-propriedades-e-câmera)
- **#85** — [Remoção do glTF: a cena passa a ser um `.json`](#85-remoção-do-gltf-a-cena-passa-a-ser-um-json)
- **#86** — [Uma codificação só para o boneco, e um leitor só](#86-uma-codificação-só-para-o-boneco-e-um-leitor-só)
- **#87** — [Um caminho só para boneco em arquivo](#87-um-caminho-só-para-boneco-em-arquivo)
- **#88** — [Uma convenção de botão para todos os painéis](#88-uma-convenção-de-botão-para-todos-os-painéis)
- **#89** — [Quatro ajustes de layout, e uma régua que o navegador não desenha](#89-quatro-ajustes-de-layout-e-uma-régua-que-o-navegador-não-desenha)
- **#90** — [Consolidar doze sessões num lugar em que a décima terceira começa lendo](#90-consolidar-doze-sessões-num-lugar-em-que-a-décima-terceira-começa-lendo)
- **#91** — [Mapa de profundidade: uma rampa linear, três escolhas independentes (fase 13)](#91-mapa-de-profundidade-uma-rampa-linear-três-escolhas-independentes-fase-13)
- **#92** — [Módulo de poses — a casca de toque do item 44, com sessão própria](#92-módulo-de-poses--a-casca-de-toque-do-item-44-com-sessão-própria)
- **#93** — [Vista Livre com edição destravável — arrasto no plano da tela + gizmo de setas](#93-vista-livre-com-edição-destravável--arrasto-no-plano-da-tela--gizmo-de-setas)
- **#94** — [Quinze sugestões registradas, nove implementadas — o lote de acabamento do módulo de poses](#94-quinze-sugestões-registradas-nove-implementadas--o-lote-de-acabamento-do-módulo-de-poses)
- **#95** — [O smoke de Playwright do módulo de poses — o item 57, e o fim do "falta a conferência visual" para o essencial](#95-o-smoke-de-playwright-do-módulo-de-poses--o-item-57-e-o-fim-do-falta-a-conferência-visual-para-o-essencial)
- **#96** — [Rotação por eixo na aba Junta, anéis gimbal de leitura e o reset por eixo — itens 60 e 61](#96-rotação-por-eixo-na-aba-junta-anéis-gimbal-de-leitura-e-o-reset-por-eixo--itens-60-e-61)
- **#97** — [Âncora de junta e a raiz que gira no arrasto — itens 62 e 63](#97-âncora-de-junta-e-a-raiz-que-gira-no-arrasto--itens-62-e-63)
- **#98** — [Trazer a sessão da outra casca — item 54](#98-trazer-a-sessão-da-outra-casca--item-54)
- **#99** — [A raiz nunca teve trava — e ganhou três, uma por eixo (item 64)](#99-a-raiz-nunca-teve-trava--e-ganhou-três-uma-por-eixo-item-64)
- **#100** — [A confirmação da troca de sessão vira modal — o `ConfirmDialog` que já existia](#100-a-confirmação-da-troca-de-sessão-vira-modal--o-confirmdialog-que-já-existia)
- **#101** — [A sessão atravessa o ar: remessa por QR code, sem rede e sem arquivo (item 65)](#101-a-sessão-atravessa-o-ar-remessa-por-qr-code-sem-rede-e-sem-arquivo-item-65)
- **#102** — [O app muda de nome: Virtual Mockup vira WebPoser, com migração das chaves](#102-o-app-muda-de-nome-virtual-mockup-vira-webposer-com-migração-das-chaves)
- **#103** — [O primeiro endereço público: GitHub Pages por workflow, com a suíte como portão](#103-o-primeiro-endereço-público-github-pages-por-workflow-com-a-suíte-como-portão)
  - **#103.1** — [O `package-lock.json` tem de ser gerado no Linux](#1031-o-package-lockjson-tem-de-ser-gerado-no-linux)
  - **#103.2** — [O que faltava era habilitar o Pages no repositório](#1032-o-que-faltava-era-habilitar-o-pages-no-repositório)
- **#104** — [Licença MIT — a última pendência da publicação](#104-licença-mit--a-última-pendência-da-publicação)
- **#105** — [O lote dos baratos: itens 53, 55, 35, 19, 8, 52 — e a revisão de sombras do 17](#105-o-lote-dos-baratos-itens-53-55-35-19-8-52--e-a-revisão-de-sombras-do-17)
- **#106** — [Easing por trecho — a maior lacuna da animação (item 26)](#106-easing-por-trecho--a-maior-lacuna-da-animação-item-26)
- **#107** — [A dívida do viewport: redesenho sob demanda (item 21) e a matemática de arrasto extraída (item 58)](#107-a-dívida-do-viewport-redesenho-sob-demanda-item-21-e-a-matemática-de-arrasto-extraída-item-58)
- **#108** — [Amarração de objeto a junta e o kit de armas — movimento emprestado, cenário intacto](#108-amarração-de-objeto-a-junta-e-o-kit-de-armas--movimento-emprestado-cenário-intacto)
- **#109** — [Pose por imagem, etapas 1–2 — o retargeting testado por ida-e-volta e a CLI `pose:from-image`](#109-pose-por-imagem-etapas-12--o-retargeting-testado-por-ida-e-volta-e-a-cli-posefrom-image)
- **#110** — [Setas do gizmo de translação do módulo de poses dobradas — alvo de dedo, travado por teste](#110-setas-do-gizmo-de-translação-do-módulo-de-poses-dobradas--alvo-de-dedo-travado-por-teste)
- **#111** — [Pose por marcação manual — a foto de referência (item 7), o root como âncora e a profundidade que sai do encurtamento](#111-pose-por-marcação-manual--a-foto-de-referência-item-7-o-root-como-âncora-e-a-profundidade-que-sai-do-encurtamento)
- **#112** — [Zoom e deslocamento da foto de referência — gestos nos dois modos, e a marca que só se confirma na soltura](#112-zoom-e-deslocamento-da-foto-de-referência--gestos-nos-dois-modos-e-a-marca-que-só-se-confirma-na-soltura)
- **#113** — [A sequência de marcação agrupada por membro — alternar lados confundia](#113-a-sequência-de-marcação-agrupada-por-membro--alternar-lados-confundia)
- **#113.1** — [A base do pescoço entra como marca — o prumo do tronco vira o eixo primário](#1131-a-base-do-pescoço-entra-como-marca--o-prumo-do-tronco-vira-o-eixo-primário)
- **#114** — [Vídeo como referência — o mesmo papel vegetal, com o frame no lugar do tempo](#114-vídeo-como-referência--o-mesmo-papel-vegetal-com-o-frame-no-lugar-do-tempo)
- **#115** — [Profundidade também nos PARES — ombros e quadris, a torção que a foto esconde](#115-profundidade-também-nos-pares--ombros-e-quadris-a-torção-que-a-foto-esconde)
- **#115.1** — [O cursor da marcação — uma junta por vez, e a profundidade que é dela](#1151-o-cursor-da-marcação--uma-junta-por-vez-e-a-profundidade-que-é-dela)
- **#115.2** — [A linha do tempo do vídeo empilhada — rótulo em cima, barra inteira embaixo](#1152-a-linha-do-tempo-do-vídeo-empilhada--rótulo-em-cima-barra-inteira-embaixo)
- **#116** — [Giro da raiz atravessando os ±180° — o ramo do Euler é escolhido, não sorteado](#116-giro-da-raiz-atravessando-os-180--o-ramo-do-euler-é-escolhido-não-sorteado)
- **#116.1** — [O gizmo deixou de embaralhar os números da raiz](#1161-o-gizmo-deixou-de-embaralhar-os-números-da-raiz)
- **#117** — [Mover o BLOCO nomeado de keyframes — o vizinho é pulado inteiro](#117-mover-o-bloco-nomeado-de-keyframes--o-vizinho-é-pulado-inteiro)
- **#117.1** — [Arrumação de dois controles — as setas do bloco em linha própria, e a silhueta antes da casca](#1171-arruma%C3%A7%C3%A3o-de-dois-controles--as-setas-do-bloco-em-linha-pr%C3%B3pria-e-a-silhueta-antes-da-casca)
- **#118** — [Um gesto, um passo de undo — o histórico registra o estado de quando o botão é solto](#118-um-gesto-um-passo-de-undo--o-histórico-registra-o-estado-de-quando-o-botão-é-solto)
- **#118.1** — [A profundidade escolhida fica acesa — o `aria-pressed` que só o leitor de tela via](#1181-a-profundidade-escolhida-fica-acesa--o-aria-pressed-que-só-o-leitor-de-tela-via)
- **#119** — [O tronco quebrado em dois e a raiz conferida pelos quadris — o que um ponto sobre o eixo pode e o que não pode dizer](#119-o-tronco-quebrado-em-dois-e-a-raiz-conferida-pelos-quadris--o-que-um-ponto-sobre-o-eixo-pode-e-o-que-não-pode-dizer)

---

## 1. Aviso "not wrapped in act(...)" nos testes do Toolbar (react-i18next)

**Contexto:** ao escrever os testes RTL de `Toolbar.tsx` (fase 1), o console emite `An update to Toolbar inside a test was not wrapped in act(...)` mesmo em testes sem nenhuma interação assíncrona explícita. Todas as asserções passam — é um aviso, não uma falha.

**Investigação:** o hook `useTranslation` do `react-i18next` usa `useSyncExternalStore` para se inscrever nos eventos do i18next (`languageChanged`). Essa inscrição roda num `useEffect`, ou seja, só é conectada um tick *depois* da montagem do componente. Qualquer emissão de evento do i18next nesse intervalo (mesmo internamente, durante a resolução do idioma inicial) dispara uma atualização de estado fora do `act()` que envolve o `render()` do testing-library — um padrão de conflito conhecido entre bibliotecas baseadas em `useSyncExternalStore` (react-i18next, Apollo, Redux) e testing environments. Confirmado lendo o código-fonte de `i18next` e `react-i18next`. (Uma hipótese inicial apontava para a opção `initImmediate`; descartada após grep no bundle do `i18next` mostrar que essa opção não é lida em nenhum lugar do core — é exclusiva de plugins de backend que não usamos aqui. A opção foi removida do código por não ter efeito real, inclusive causando erro de tipo no TypeScript por não existir em `InitOptions`.)

**Opções consideradas:**
1. **Aceitar como ruído conhecido e documentar** — não afeta corretude nem faz nenhum teste falhar; é o comportamento relatado por outros projetos que usam react-i18next + RTL.
2. **Envolver cada `render()` com um flush extra (`await act(async () => {})`)** — reduz a incidência mas não elimina 100% (a ordem de atribuição do aviso no console do Vitest pode vazar para o teste seguinte quando os testes rodam em sequência no mesmo arquivo).
3. **Silenciar via `console.error` mockado nos testes afetados** — esconde o sintoma sem resolver a causa; desaconselhado, pode mascarar avisos reais no futuro.

**Decisão:** opção 1, com uma mitigação leve da opção 2 mantida (helper `renderToolbar` com flush) por reduzir parte da ocorrência sem custo de complexidade relevante. Não adoto a opção 3 (mascarar console.error).

**Motivo:** o aviso é cosmético — todas as asserções de comportamento continuam passando — e a causa raiz está fora do nosso código (interação entre duas bibliotecas de terceiros). Investir mais tempo nisso na fase 1 não muda o comportamento da aplicação. Revisitar apenas se, em fases futuras, avisos assim começarem a mascarar falhas reais de teste.

---

## 2. Aviso "THREE.Clock: This module has been deprecated" no console

**Contexto:** tanto nos testes (`@react-three/test-renderer`) quanto no navegador real, aparece o aviso `THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.`

**Investigação:** o aviso vem de dentro do próprio `@react-three/fiber` (que ainda usa `THREE.Clock` internamente no seu loop de render), não de código nosso — não há nenhuma referência a `THREE.Clock` neste projeto.

**Decisão:** ignorar por ora; é um aviso interno de uma dependência de terceiros (three.js reagindo ao uso que `@react-three/fiber` faz de uma de suas próprias APIs), sem ação possível do nosso lado além de aguardar uma atualização do `@react-three/fiber` que troque para `THREE.Timer`. Não afeta o funcionamento.

---

## 3. Arrastar o mouse no viewport não gira a câmera (OrbitControls) durante teste manual via automação de navegador

**Contexto:** ao validar a fase 1 no navegador via automação (claude-in-chrome), um `left_click_drag` sobre o canvas 3D não produziu nenhuma rotação de câmera visível, embora a cena renderize corretamente (chão, grade, sombra, fundo).

**Investigação:** o `OrbitControls` do `@react-three/drei` escuta eventos `PointerEvent` (`pointerdown`/`pointermove`/`pointerup`) no elemento do canvas. Ferramentas de automação de navegador frequentemente disparam `MouseEvent` clássicos em vez de `PointerEvent`, que o `OrbitControls` não reconhece — uma limitação conhecida de automação sobre canvases baseados em ponteiro, não um defeito da configuração da câmera (que está correta: iluminação, ground plane de 20×20 e posição inicial `[3,2,4]` condizem exatamente com o enquadramento visto no screenshot).

**Decisão:** não investigar mais a fundo por automação — o item "aparência renderizada... gizmos" já está listado no `PLANO.md` como fora do escopo de teste automatizado, exatamente por esse tipo de fragilidade. A interação de órbita da câmera com mouse real fica pendente de **validação manual pelo usuário** no navegador (arrastar com o botão esquerdo deve orbitar; botão direito ou duas teclas deve fazer pan; scroll deve dar zoom — comportamento padrão do `OrbitControls`).

---

## 4. "Cannot assign to read only property 'position'" ao passar instâncias de `THREE.Vector3`/`THREE.Quaternion` como props JSX (fase 2, `Figure.tsx`)

**Contexto:** o componente `Bone` (cápsula que liga uma junta à sua filha) calculava a posição/orientação com `new THREE.Vector3(...)` e `new THREE.Quaternion().setFromUnitVectors(...)` e passava essas instâncias diretamente como `position`/`quaternion` para `<mesh>`. Isso quebrava só nesse componente, com o erro `Cannot assign to read only property 'position' of object '#<Mesh>'` e o aviso `THREE.WARNING: Multiple instances of Three.js being imported.` no console dos testes.

**Investigação:** o `applyProps` do `@react-three/fiber` reconhece props do tipo `Vector3`/`Quaternion`/`Euler` via checagem de tipo (essencialmente um `instanceof` contra a classe `THREE` que o próprio `@react-three/fiber` usa internamente) e, quando reconhece, faz `alvo.copy(valor)` (mutação segura, pois `mesh.position` não tem *setter* — é um campo só de leitura reatribuído por cópia). O ambiente de teste (`@react-three/test-renderer`, que carrega um build CJS de `@react-three/fiber`) e o código do app (transformado como ESM pelo Vite/Vitest) acabam resolvendo **duas cópias distintas do pacote `three`** — confirmado pela existência de uma cópia aninhada em `node_modules/stats-gl/node_modules/three` além da raiz `node_modules/three`, e pelo aviso "Multiple instances" impresso pela própria biblioteca. Como a instância de `THREE.Quaternion` criada no componente pertence a uma cópia diferente da que `@react-three/fiber` reconhece, a checagem de tipo falha, o `applyProps` cai no caminho de atribuição direta (`objeto[chave] = valor`) e isso lança, pois `position`/`quaternion`/`rotation`/`scale` não são reatribuíveis diretamente em `Object3D`.

**Opções consideradas:**
1. **Nunca passar instâncias de classes do `three` (`Vector3`, `Quaternion`, `Euler`, `Color`) como prop JSX — sempre usar tuplas/arrays simples** (`position={[x,y,z]}`, `quaternion={[x,y,z,w]}`), deixando o `@react-three/fiber` chamar `.set(...)` internamente. Não depende de `instanceof` nem da identidade do pacote `three`, então funciona mesmo com múltiplas cópias do pacote no grafo de módulos.
2. **Deduplicar o pacote `three`** via `resolve.dedupe` (Vite) ou removendo a cópia aninhada em `stats-gl` (`npm dedupe`/override). Resolveria a causa raiz, mas depende de uma dependência de terceiro (`stats-gl`, usado pelo `@react-three/fiber` só em devtools/Stats) e pode voltar a duplicar em atualizações futuras.
3. **Mutar a instância existente do mesh via `ref` + `useLayoutEffect`** (`meshRef.current.position.copy(vetor)`), evitando props declarativas para esses campos. Funciona sempre, mas é mais verboso e foge do padrão declarativo usado no resto do projeto.

**Decisão:** opção 1. Ajustado `Bone` (`src/figure/Figure.tsx`) para converter `Vector3`/`Quaternion` em arrays (`.toArray()` / `[x,y,z,w]`) antes de repassá-los como props. É a forma idiomática recomendada pelo próprio `@react-three/fiber` para esses casos e resolve o problema no ponto de origem (nosso código), sem depender de alinhar versões de dependências de terceiros.

**Motivo:** solução mínima, local ao componente, sem tocar em `node_modules`/resolução de pacotes, e que também é a prática já usada em todo o resto do projeto (`SceneContent.tsx`, `constants.ts` só usam tuplas). Vale manter essa convenção — nunca instanciar classes do `three` para passar como prop JSX — nas próximas fases (câmera, gizmos, IK).

---

## 5. Avaliação da biblioteca `mannequin.js` como possível dependência para a geometria do boneco

**Contexto:** o usuário sugeriu revisar o formato do boneco usando como referência a biblioteca [mannequin.js](https://boytchev.github.io/mannequin.js/docs/userguide.html), que desenha figuras humanas articuladas sobre three.js com um visual mais "esculpido" que primitivas cruas.

**Investigação:** a biblioteca (`mannequin-js` no npm, v5.2.3) constrói cada parte do corpo com uma superfície paramétrica customizada (perfil revolucionado, via `ParametricShape`/`BufferGeometry` manual) — não com primitivas simples — o que explica o contorno mais orgânico. Tecnicamente, a classe base `Mannequin` estende `THREE.Group`, então uma figura poderia em princípio ser inserida numa cena `three.js` gerenciada por `@react-three/fiber` sem exigir o próprio *renderer* (a função `createStage` do pacote é só um atalho opcional para demos standalone). Porém:
- **Licença GPL-3.0** (confirmado em `package.json` do repositório) — copyleft forte; importar o código-fonte para o nosso bundle normalmente obriga a obra combinada a também ser GPL-3.0 **ao ser distribuída**, com o código correspondente disponibilizado. Nosso projeto não tem licença declarada (privado por padrão). O risco só é concreto se o app vier a ser compartilhado/distribuído no futuro — para uso puramente local e pessoal, a obrigação de disponibilizar fonte tipicamente não é acionada.
- **Descompasso de escopo:** a lib modela 5 dedos articulados por mão; nosso `skeleton.ts` modela só o polegar à parte (os outros 4 dedos em bloco), decisão já tomada deliberadamente com o usuário para simplificar seleção/picking.
- **API imperativa, sem tipos TypeScript** (`figura.torso.bend = 45`), exigiria uma camada adaptadora sobre o `figuresStore` (declarativo) e checagem `any`/`.d.ts` próprio.

**Opções apresentadas ao usuário:**
1. Reescrever a geometria própria usando perfis torneados (`LatheGeometry`, mesma técnica da lib) — sem adotar a dependência, sem risco de licença, mantendo `skeleton.ts`.
2. Ajuste leve na geometria existente (mais segmentos/curvas), esforço menor.
3. Adotar `mannequin.js` como dependência, aceitando GPL-3.0 e construindo o adaptador.
4. Manter a geometria da fase 2 como está e revisitar só na fase 8 (polimento).

**Decisão:** opção 1, escolhida pelo usuário. `Figure.tsx` foi reescrito: pelve/cintura/tórax agora são um volume torneado em forma de "barril" (`blobProfile`, revolução em Y) em vez de esferas com escala não-uniforme; os ossos dos membros também viraram perfis torneados afunilados com leve "barriga" (`limbProfile`), substituindo os cilindros de raio fixo/afunilado da fase anterior. Mãos e pés continuam como caixas achatadas em "pá". `skeleton.ts` não foi alterado.

**Motivo:** ganho visual sem o risco de licenciamento nem o descompasso de escopo — e sem introduzir uma segunda API imperativa/sem tipos dentro de uma base de código declarativa e 100% TypeScript.

**Bug encontrado e corrigido durante a implementação:** o `limbProfile` inicial gerava pontos de y=0 a y=`length` (começando na origem da junta), mas o `Bone` posiciona a malha no ponto médio do segmento (`midpoint`) — convenção herdada do `CylinderGeometry`/`BoxGeometry` anteriores, que são centrados na própria origem. Isso deslocava cada osso torneado em metade do seu próprio comprimento, quebrando visivelmente a figura (braços/pernas desconectados, tronco comprimido) — percebido na validação manual no navegador, não pelos testes automatizados (que checavam só o tipo de geometria, não a posição no mundo). Corrigido tornando `limbProfile` simétrico em torno de zero (-length/2..length/2), igual à convenção anterior. Adicionado um teste de regressão (`Figure.test.tsx`) que verifica `boundingBox.min.y ≈ -boundingBox.max.y` da geometria de um osso, para capturar esse tipo de erro de convenção de centralização no futuro.

---

## 6. `@react-three/test-renderer` não expõe `TransformControls` (drei) como um nó localizável por tipo/props na árvore da cena

**Contexto:** ao testar `SelectionGizmo.tsx` (fase 3), `renderer.scene.findByType('TransformControls')` e `renderer.scene.findByProps({...})` não encontravam o gizmo, mesmo com o componente renderizando sem erro.

**Investigação:** o `TransformControls` do `@react-three/drei` anexa seu gizmo visual (linhas/malhas dos eixos) de forma imperativa via um objeto auxiliar interno (`TransformControlsGizmo`) que não carrega os props React originais (`mode`, `showX/Y/Z`, `object` etc.) — esses props ficam só no elemento React de mais alto nível. `renderer.scene` (a árvore de objetos `THREE` já montados) não é o lugar certo para inspecionar esses props; `renderer.toTree()` (a árvore de elementos React, via `TreeNode.props`) expõe corretamente os props passados ao `<TransformControls>`.

**Decisão:** usar `renderer.toTree()` em vez de `renderer.scene.findByType/findByProps` para testar a fiação de props do gizmo (`mode`, `showX/Y/Z`, `space`). A identidade exata do `object` (`toBe(target)`) não é verificável de forma confiável por esse caminho (o valor retornado nos props aparenta ser uma serialização do objeto três, não a referência original) — não vale a pena investigar mais a fundo um detalhe de serialização interna do test-renderer; a fiação `object={target}` é trivialmente correta por inspeção do código-fonte.

**Motivo:** resolve o teste sem gastar mais tempo em uma particularidade de uma ferramenta de teste de terceiros; a interação real de arrastar o gizmo continua fora do escopo de teste automatizado (mesma limitação já documentada na decisão #3 para o `OrbitControls`), pendente de validação manual pelo usuário.

---

## 7. Gizmo de translação do `root` "arrancava" o boneco do chão e descolava a sombra — bug real reportado pelo usuário na validação manual da fase 3

**Contexto:** ao validar manualmente o gizmo (pendência deixada da fase 3), o usuário reportou: "ao mover ele posiciona o boneco acima, fora do plano" e "a sombra também se solta do corpo".

**Investigação:** `SelectionGizmo` anexava o gizmo de translação (para a junta `root`) ao **grupo interno** da junta (`joint-root`, criado por `JointNode`), não ao **grupo externo** que representa a colocação do boneco na cena (`figure-${id}`, criado por `Figure`). Esses dois grupos têm papéis diferentes:
- `figure-${id}` (externo): `position = figure.position` — a colocação editável pelo usuário. `FigureShadow` também é filho direto deste grupo.
- `joint-root` (interno, filho do externo): `position = [0, 0.9, 0]` — um offset **fixo** do `skeleton.ts` (altura do quadril acima da origem do boneco), não editável, igual para todo boneco na altura de referência.

Ao arrastar o gizmo anexado ao grupo interno, dois problemas aconteciam ao mesmo tempo:
1. **Durante o arrasto:** o `TransformControls` move só o grupo interno (e o corpo, que é filho dele) — o grupo externo (e a sombra, filha dele) não se move junto, daí a sombra "se soltar" visualmente do corpo enquanto o boneco é arrastado.
2. **Ao soltar:** `handleObjectChange` lia `target.position` (a posição do grupo **interno**, que já carrega o offset fixo `[0, 0.9, 0]`) e gravava esse valor diretamente como `figure.position` (a posição do grupo **externo**). No próximo render, o grupo interno volta a ser desenhado com seu offset fixo de novo (`position={joint.position}`, declarativo) — resultando no offset de 0,9 m **somado duas vezes**: uma vez pelo grupo externo (que passou a valer ~0,9) e de novo pelo grupo interno (que sempre vale 0,9). O corpo passa a flutuar a ~1,8 m do chão; a sombra (que só herda a posição do grupo externo) fica em ~0,9 m — os dois "fora do plano" e desalinhados entre si, exatamente como reportado.

**Decisão:** o alvo do gizmo de translação para `root` passou a ser o **grupo externo** (`figure-${id}`), não mais o grupo interno da junta. Implementado reaproveitando o mesmo callback `onJointRef(jointName, object)` já existente: `JointNode` deixou de se registrar sob a chave `"root"` (só o grupo externo se registra sob essa chave agora, em `Figure`). Nenhuma mudança foi necessária em `SelectionGizmo.tsx` nem em `Viewport.tsx` — a assinatura do callback não mudou, só qual objeto físico é reportado para aquela chave. O comportamento de rotação das demais juntas não tinha esse problema (o alvo já era o grupo correto, cuja rotação é a pose do store 1:1, sem nenhum offset fixo somado).

**Motivo:** correção mínima e localizada, sem introduzir um novo prop/mecanismo — só corrige *qual* objeto já registrado é o alvo correto para aquele caso específico (root/translação). Coberto por um novo teste de regressão em `Figure.test.tsx` que verifica que o objeto registrado para `"root"` é o grupo `figure-${id}`, não `joint-root`. Validado manualmente pelo usuário e por mim (arrastar X e Z mantém Y=0, sombra acompanha o corpo, sem erros no console) — o arrasto do gizmo de rotação também foi validado nessa mesma sessão e respeitou corretamente os limites articulares do `skeleton.ts` (ex.: `chest` no eixo Z travou exatamente em -15°, seu limite mínimo).

---

## 8. Fase 4 (Câmera) — troca perspectiva/ortográfica sem remontar o componente de câmera do drei

**Contexto:** o usuário pediu (antes de eu implementar) que os presets ortográficos (frente/costas/laterais/topo/3-4) trocassem a projeção da câmera de verdade (`THREE.OrthographicCamera`), não apenas reposicionassem uma câmera em perspectiva — ver decisão confirmada por `AskUserQuestion` no início da fase 4.

**Investigação:** a abordagem óbvia — renderizar condicionalmente `<PerspectiveCamera makeDefault>` ou `<OrthographicCamera makeDefault>` (drei) conforme um campo `projection` do store — desmonta/remonta o componente de câmera a cada troca de projeção. Isso cria uma corrida de timing real: o componente novo nasce na posição/orientação padrão (perda da pose atual), e o efeito que reposicionaria a câmera (`useThree().camera`) só reflete a nova instância depois que o `set({camera})` interno do drei (disparado dentro do `useLayoutEffect` do componente recém-montado) propaga pela store do R3F — não há garantia simples de ordem entre "o componente novo montou" e "meu efeito de reposicionamento leu a câmera nova", especialmente ao encadear isso com a lógica de presets/bookmarks (que também precisam mover a câmera na mesma leva de comandos).

**Opções consideradas:**
1. **Manter as duas instâncias de câmera vivas o tempo todo** (`useRef`, uma `PerspectiveCamera` e uma `OrthographicCamera`, criadas uma vez em `CameraRig.tsx`) e alternar qual é a "câmera padrão" do R3F via `useThree().set({ camera })`, copiando manualmente posição/`up`/quaternion (e recalculando o zoom ortográfico) da câmera antiga para a nova, sincronamente, sem depender de nenhum ciclo de montagem/desmontagem do React.
2. **Confiar em `<PerspectiveCamera>`/`<OrthographicCamera>` condicionais do drei**, com um efeito que só age quando `camera.isOrthographicCamera` já bate com a projeção esperada no store (uma espécie de "espera ativa" via dependência reativa em `camera`) — funcionaria, mas depende de um comportamento de timing do drei que não é parte da API pública/documentada, arriscando quebrar em atualizações futuras da lib.
3. **Não trocar o tipo de câmera de verdade** — simular "ortográfico" com uma perspectiva de FOV muito estreito a grande distância (truque comum em alguns engines). Rejeitada de saída: diverge do pedido explícito do usuário (projeção ortográfica real) e tem paralaxe residual perceptível.

**Decisão:** opção 1, implementada em `src/scene/CameraRig.tsx`. O `CameraRig` cria as duas câmeras uma única vez (`useRef`), mantém um `activeProjectionRef` para saber qual está ativa no momento, e um `useEffect` dedicado faz a troca (copiar pose + `set({camera})`) sempre que `projection` muda no `cameraStore`. Um segundo `useEffect` (que roda depois, na mesma leva de efeitos, por estar declarado depois no componente) aplica o comando pendente (preset/bookmark/salvar posição) contra a câmera **já correta**, sem nenhuma espera condicional — a ordem de execução dos dois efeitos dentro do mesmo componente é garantida pelo React, então não há corrida.

**Motivo:** elimina completamente a dependência de timing entre montagem de componente e leitura de estado reativo — a troca é 100% imperativa e síncrona, sob nosso controle total. Como efeito colateral positivo, presets/bookmarks e a troca de projeção compartilham a mesma câmera "atual" sempre disponível via `useRef`, sem precisar ler `useThree().camera` (que só reflete o próximo commit). O zoom ortográfico é calculado por `computeOrthographicZoom` (`cameraPresets.ts`) para enquadrar a cena de forma equivalente à perspectiva no mesmo ponto de distância, evitando um "salto" visual de escala ao alternar. Assim como o arraste do `TransformControls` (decisões #3 e #6), o `CameraRig` não tem teste automatizado da movimentação real da câmera (é puramente imperativo sobre um `THREE.Object3D` vivo) — só a lógica matemática pura (`cameraPresets.ts`) e as transições de estado do `cameraStore.ts` têm cobertura de teste; a movimentação real fica para validação manual no navegador.

**Decisão relacionada — bookmarks de câmera entram no `figuresStore`, não num store de câmera separado:** o plano exige explicitamente que "bookmarks de câmera (criar/remover) entram no histórico [de undo] normalmente", junto com pose/posição/bonecos — ao contrário da navegação livre (órbita/pan/zoom/FOV/projeção), que fica fora do histórico. Como o `zundo` (`temporal`) mantém uma pilha de undo **por store**, duas pilhas independentes (uma em `figuresStore`, outra num hipotético `cameraStore` com `temporal`) não dariam uma linha do tempo cronológica combinada e confiável para o Ctrl+Z. Por isso, `cameraBookmarks`/`nextCameraBookmarkSeq` foram adicionados ao `figuresStore` (que já é o único store com `temporal`), e `cameraStore.ts` ficou só com o estado de navegação pura (FOV, projeção ativa, comando pendente), sem `temporal`.

**Correção subsequente (mesmo dia, a pedido do usuário) — `sceneStore.ts` (fundo/grade) incorporado ao `figuresStore`:** o texto do plano também lista "configuração da cena" entre o que deveria ter undo — gap sinalizado ao usuário logo após a fase 4, que pediu a correção imediata.

**Opções consideradas:**
1. **Mover `environment` (fundo/grade) para dentro do `figuresStore`**, extinguindo `sceneStore.ts` como store separado — mesmo raciocínio já aplicado aos bookmarks de câmera: só um único store com `temporal` dá uma linha do tempo cronológica combinada e correta para o Ctrl+Z.
2. **Dar ao `sceneStore` seu próprio `temporal()` independente**, e fazer o atalho de undo chamar `undo()` em ambos os stores. Rejeitada: duas pilhas LIFO independentes não preservam a ordem cronológica real entre uma edição de boneco e uma edição de ambiente intercaladas (ex.: editar boneco → mudar fundo → editar boneco de novo → três `Ctrl+Z` não desfaria necessariamente nessa ordem exata) — o próprio problema que a decisão dos bookmarks já tinha evitado.
3. **Substituir o `zundo` por um histórico de undo escrito à mão**, cobrindo todos os stores de uma vez (uma lista global de patches/snapshots). Mais correto em tese, mas descarta uma peça de infraestrutura já testada e funcionando por um esforço bem maior do que o problema exige.

**Decisão:** opção 1. `environment: EnvironmentSettings` (mais `setBackground`/`toggleGrid`) migrou de `sceneStore.ts` para `figuresStore.ts`, entrando no `partialize`/`equality` do `temporal` do mesmo jeito que `cameraBookmarks`. `sceneStore.ts` e seu teste foram removidos; `Toolbar.tsx`, `Viewport.tsx` e `scene/constants.ts` (tipo `BackgroundTone`) passaram a importar de `figuresStore.ts`. Nenhuma mudança de comportamento fora do undo — os componentes continuam lendo/escrevendo `environment` do jeito que já faziam, só a origem do hook mudou de `useSceneStore` para `useFiguresStore`.

**Motivo:** consistência com a decisão já tomada para os bookmarks de câmera, e é a única opção que garante que `Ctrl+Z`/`Ctrl+Shift+Z` desfaçam qualquer combinação de edições de boneco e de ambiente na ordem cronológica exata em que aconteceram — validado manualmente no navegador (adicionar boneco → mudar fundo para escuro → mudar altura → desligar grade → 4× Ctrl+Z desfez nessa ordem exata: grade, altura, fundo, boneco). Coberto por 6 novos testes automatizados em `figuresStore.test.ts`, incluindo um teste específico de intercalação cronológica. Suíte completa em 187 testes, todos verdes; `tsc -b`, `eslint .` e `npm run build` continuam limpos.

---

## 9. Fase 5 (Keyframes) — captura de PNG sob demanda em resolução configurável, sem flash visual

**Contexto:** o plano pede uma captura "sob demanda" (não contínua), em resolução independente da janela, sem manter `preserveDrawingBuffer` permanentemente ligado (custo de performance). O risco óbvio: redimensionar o `WebGLRenderer` ao vivo para uma resolução maior (ex.: 4K numa janela pequena), renderizar, capturar e devolver ao tamanho normal — sem que o usuário veja um "pulo"/distorção do canvas visível durante a troca.

**Investigação:** `HTMLCanvasElement.toBlob()` (mesmo sobre um contexto WebGL sem `preserveDrawingBuffer`) captura o conteúdo do *drawing buffer* no momento exato da chamada — é assim que qualquer técnica de screenshot on-demand em three.js funciona (padrão bem estabelecido: `render()` seguido imediatamente de `toBlob()`/`toDataURL()`, antes de qualquer composição/paint do navegador limpar o buffer). Como `toBlob` é assíncrono só na entrega do `Blob` (callback), não na leitura do buffer, é seguro redimensionar o canvas de volta ao tamanho normal **imediatamente depois** de chamar `toBlob()` — antes do navegador ter qualquer chance de pintar o frame intermediário — desde que nenhum `await`/yield aconteça entre o `gl.render()` na resolução alvo e o `gl.setSize()` de volta ao normal (tudo síncrono, mesma tarefa JS).

**Opções consideradas:**
1. **Redimensionar o `WebGLRenderer` ao vivo** (`gl.setSize(w, h, false)`, ajustar aspecto/frustum da câmera ativa, `gl.render`, `toBlob`, restaurar tudo de volta na mesma tarefa síncrona). Mais simples de implementar, reaproveita a câmera/cena já montadas pelo R3F.
2. **Renderizar num `THREE.WebGLRenderTarget` off-screen** dedicado (nunca toca o canvas visível), lendo pixels via `readRenderTargetPixels` e desenhando num canvas 2D auxiliar para gerar o blob. Zero risco de flash por construção, mas exige inverter manualmente a ordem das linhas (WebGL é bottom-up) e é sensivelmente mais código para um ganho que a opção 1 já entrega na prática.
3. **Um segundo `<canvas>`/`WebGLRenderer` inteiramente separado**, sincronizado com a mesma cena. Evita qualquer interferência com o canvas principal, mas duplica contexto WebGL (custo de memória/GPU) só para uma operação ocasional.

**Decisão:** opção 1, implementada em `src/scene/KeyframeCapture.tsx`. Validado manualmente no navegador (Chrome, várias resoluções e câmeras — perspectiva e ortográfica) comparando screenshots antes/depois da captura: nenhuma distorção ou flash visível, e o PNG baixado confere exatamente com a resolução pedida (`file` reportou `800 x 600` para uma captura customizada), sem esticar a cena.

**Motivo:** entrega o requisito do plano (captura sem `preserveDrawingBuffer` permanente, sem impacto visual) com a menor superfície de código nova, reaproveitando a câmera/cena que o R3F já gerencia. Revisitar a opção 2 apenas se algum navegador/GPU específico mostrar artefatos que a validação manual não pegou.

**Decisão relacionada — ocultar grade/gizmos na captura via `scene.traverse`, não via estado do React:** a alternativa óbvia seria reaproveitar as ações do store (`toggleGrid`, limpar seleção) para esconder grade/gizmo antes de capturar e restaurar depois. Rejeitada: (a) `toggleGrid` passa pelo `zundo` e criaria entradas fantasmas no histórico de undo a cada captura; (b) esconder/restaurar via React exige um ciclo de re-render inteiro (não é síncrono como a técnica acima), reabrindo a janela de risco de flash. Em vez disso, `KeyframeCapture` percorre a cena (`scene.traverse`) e alterna `object.visible` diretamente nos objetos `THREE` — a grade é localizável pelo `name="scene-grid"` (adicionado em `SceneContent.tsx`); o gizmo é localizável pela flag pública `isTransformControlsGizmo` que o `three-stdlib` já expõe no objeto do gizmo (achado ao ler o código-fonte da lib — diferente da limitação de introspecção da decisão #6, que era sobre o *test-renderer* não expor props React, não sobre o objeto `THREE` em si estar inacessível em runtime).

**Descoberta técnica — `eslint-plugin-react-hooks` (regra de imutabilidade) proíbe mutar diretamente o valor devolvido por `useThree()`:** ao tentar `camera.aspect = ...` sobre a câmera obtida via `useThree(state => state.camera)`, o lint acusou "Cannot access refs during render"-style error ("Modifying a value returned from a hook"). Como `CameraRig.tsx` nunca mutava diretamente o valor do hook (usa suas próprias câmeras via `useRef`), esse padrão não tinha aparecido antes. Resolvido lendo a câmera ativa via o acessor imperativo `useThree(state => state.get)` (`getThree().camera`) só no momento de mutar — o valor reativo (`activeCamera`) continua sendo usado apenas como dependência do efeito, nunca mutado diretamente. Vale manter essa convenção em código futuro que precise mutar objetos `THREE` obtidos via `useThree()`.

---

## 10. Pedido do usuário — "teste de captura" com parte do boneco abaixo do plano do chão

**Contexto:** o usuário pediu para incluir um teste de captura em que parte do boneco fica abaixo do plano horizontal (chão), verificando que essa parte não aparece no PNG capturado.

**Investigação:** um teste automatizado que verifique *conteúdo de pixel* de um PNG capturado exigiria rasterização WebGL real — inviável no ambiente de teste (`vitest`/`jsdom`/`@react-three/test-renderer`), que não tem GPU nem contexto WebGL de verdade. Essa limitação já é reconhecida desde o início do projeto (`PLANO.md` > "Modelo de desenvolvimento: TDD" > "O que não entra em teste automatizado: ... captura real de PNG — validação manual"), e seguida em toda a fase 5 (`KeyframeCapture.tsx` não tem teste automatizado pelo mesmo motivo).

Validado manualmente no navegador: com o `root` do boneco em `Y = -0,4` (parte inferior das pernas abaixo do plano do chão em `Y = 0`), tanto a visualização ao vivo quanto o PNG capturado (Full HD) mostram o boneco cortado exatamente na altura do chão — a parte abaixo não aparece. Isso já funcionava **sem nenhuma mudança de código**: é oclusão padrão por teste de profundidade (*z-buffer*) do WebGL contra a malha opaca do chão (`SceneContent.tsx`, `meshStandardMaterial` sem `transparent`), presente desde a fase 1. O usuário confirmou que o PNG não deve ser transparente (fundo opaco) — reforça que a oclusão por profundidade é exatamente o mecanismo certo (não é uma questão de compor camadas com alpha).

**Decisão:** não há bug a corrigir — o comportamento pedido já é garantido pelo pipeline de renderização padrão. Em vez de um teste automatizado (inviável), o cenário foi registrado como item validado manualmente no checklist da fase 5 (`PLANO.md`), para ficar documentado e ser re-verificado manualmente se o código de renderização do chão ou da captura mudar no futuro.

**Motivo:** mantém a mesma política de teste já aplicada a toda a fase 5 (e às fases 3-4 para interações de gizmo/câmera) — lógica pura ganha teste automatizado, pixel real de WebGL não. Adicionar uma dependência nova (headless-gl, Playwright com captura de tela, etc.) só para viabilizar esse teste específico seria desproporcional ao problema (nenhum bug encontrado) e está fora do escopo combinado no plano.

---

## 11. Fase 6 — esclarecimento de "lista de cenas" → conceito de *workspace* com snapshots de cena

**Contexto:** a tabela de fases lista "lista de cenas" como entrega da fase 6, mas o conceito não é detalhado em nenhuma outra parte do `PLANO.md` (só reaparece numa nota da fase 5, ao justificar o campo "Nome da cena"). Antes de desenhar a arquitetura, parei e perguntei ao usuário o que o termo deveria significar, conforme a diretriz do projeto de não adotar premissas críticas sozinho.

**Esclarecimento do usuário:** uma "cena" é o conjunto de metadados de todos os bonecos posicionados/posados. A necessidade real é poder tirar **snapshots** nomeados desse conjunto, para recuperar poses/posições depois. Bookmarks de câmera continuam podendo ser trocados **sem** alterar a pose (comportamento já existente desde a fase 4) — múltiplas posições de câmera para a mesma cena. O conjunto de cenas + bookmarks deve ser agrupado num "workspace", e o usuário pediu para avaliar se gravar cada cena em `.glb` continua adequado, preferindo que o workspace seja persistido como um **arquivo de metadados no sistema de arquivos que aponta para os `.glb`s**, sendo estes salvos/carregados independentemente.

**Decisão de modelo (confirmada com o usuário via pergunta direta):** manter **1 cena = 1 `.glb`** (não um `.glb` único com múltiplas `scenes` internas do glTF) — o importador do Blender lida de forma inconsistente entre versões com glTFs de cena múltipla (às vezes achata tudo, às vezes só importa a cena padrão), o que arriscaria o requisito de compatibilidade com Blender já validado nas fases anteriores. Cada cena exportada continua sendo um `.glb` autocontido e válido isoladamente, reaproveitando 100% do schema de `extras["virtual-mockup"]` já especificado (figuras, ambiente, bookmarks de câmera, contador de keyframe).

**Opções consideradas para a persistência do *workspace* em si (a coleção de cenas):**
1. **Pasta escolhida via File System Access API + arquivo de manifesto `workspace.json` na mesma pasta**, apontando por nome de arquivo para os `.glb`s de cada cena (cada um salvo/lido independentemente, como pedido). Reaproveita exatamente o mesmo padrão já construído e validado na fase 5 para a pasta de keyframes (`showDirectoryPicker`, handle de diretório restrito à sessão) — risco técnico baixo por já ser um caminho testado no projeto. Sem a API (Firefox/Safari), cai para seleção manual de múltiplos arquivos (o `workspace.json` + os `.glb`s referenciados de uma vez, via `<input type="file" multiple>`).
2. **Um único arquivo compactado (`.zip`)** contendo o manifesto e todos os `.glb`s embutidos. Portátil num arquivo só, mas exige uma dependência nova de zip (ou um escritor/leitor de zip caseiro, não trivial de fazer corretamente) e contradiz diretamente o pedido do usuário de que os `.glb`s continuem independentes.
3. **Manifesto avulso via download/upload simples, sem handle de pasta** — "salvar workspace" baixa o `workspace.json` e dispara o download de cada `.glb` referenciado separadamente; "abrir workspace" pede para selecionar o `workspace.json` e depois volta a pedir cada `.glb` referenciado manualmente. Funciona em qualquer navegador sem nenhuma API nova, mas é uma experiência mais truncada (vários diálogos) e mais frágil (religar arquivos pelo nome).

**Decisão:** opção 1, com a opção 3 como *fallback* automático quando `showDirectoryPicker` não existir (mesmo padrão de detecção de recurso já usado no `KeyframePanel.tsx`). O handle da pasta do workspace fica restrito à sessão (não persistido entre aberturas do app), na mesma linha já decidida para a pasta de keyframes — reabrir um workspace gravado em disco exige escolher a pasta de novo a cada sessão. Isso é diferente do autosave contínuo em `localStorage` (ver abaixo), que continua restaurando automaticamente sem nenhuma ação do usuário.

**Modelo de dados adotado (baixo impacto no código já existente):** em vez de reestruturar `figuresStore.ts` para aninhar tudo dentro de um array de cenas (o que exigiria reescrever praticamente toda ação do store e todo componente consumidor), o store ganha:
- Os campos já existentes (`figures`, `environment`, `cameraBookmarks`, `sceneName`, `nextKeyframeNumber` etc.) continuam representando a **cena de trabalho ativa**, exatamente como hoje — nenhuma ação/componente existente muda.
- Um novo catálogo `scenes: SceneSnapshot[]` (cada item: id, nome, e a cópia serializada dos campos acima) + `activeSceneId`, junto de ações novas: `saveSceneSnapshot` (grava/atualiza um snapshot a partir do estado de trabalho atual), `loadSceneSnapshot` (substitui o estado de trabalho pelo snapshot escolhido — um único `set()`, então vira **um** passo de undo), `renameSceneSnapshot`, `removeSceneSnapshot`.
- `scenes` entra no `partialize`/`equality` do `zundo` (criar/renomear/remover snapshot é edição de conteúdo, mesmo raciocínio já aplicado aos bookmarks de câmera — decisão #8); `activeSceneId` fica de fora, como `selectedFigureId` (é um ponteiro de navegação, não conteúdo).
- Cada `SceneSnapshot` do catálogo é exatamente o que vira um `.glb` ao exportar aquela cena — nenhum schema novo de `extras` é necessário, só passar a incluir `sceneName`/`name` explicitamente no bloco `extras` (lacuna pequena do exemplo original do plano, que listava `environment`/`keyframeCounter`/`cameraBookmarks`/`figures` mas não o nome da cena).

**Motivo:** entrega exatamente o que o usuário pediu (snapshots nomeados, workspace como metadados apontando para `.glb`s independentes no sistema de arquivos, bookmarks de câmera continuam por cena) reaproveitando ao máximo arquitetura já validada (padrão de diretório da fase 5, schema de `extras` já especificado, política de undo já estabelecida para bookmarks) e minimizando o raio de mudança em código já testado — evita um refactor total e arriscado do `figuresStore.ts` para um resultado equivalente.

**Duas decisões de implementação confirmadas com o usuário durante a fase 6 (via pergunta direta, antes de prosseguir):**
1. **Geometria exportada no `.glb`:** esfera por junta + cilindro por osso (headless, `figureObject3D.ts`), em vez do visual esculpido completo (`LatheGeometry`) de `Figure.tsx` — suficiente como referência de layout/pose no Blender, já que a reconstrução no app é 100% baseada em `extras`, não na geometria do arquivo. Extrair a geometria completa para um módulo compartilhado fica como melhoria futura, se um dia for necessário.
2. **Câmeras exportadas:** uma câmera glTF por bookmark de câmera salvo (não uma única câmera "atual"), para manter a exportação da cena inteiramente headless (sem depender do `<Canvas>` montado) e por já serem as vistas nomeadas com sentido de reabrir.

**Pendência conhecida — reimportar um `.glb` reexportado pelo Blender falhou na validação manual do usuário:** ao testar o roteiro de "ida e volta com o Blender" (app → exportar `.glb` → abrir e reexportar no Blender → reimportar no app), o usuário relatou problemas ao reimportar o arquivo que voltou do Blender. Causa raiz **não investigada** — o usuário marcou explicitamente como não prioritário e pediu para seguir para a próxima fase sem gastar tempo nisso agora. Hipótese mais provável (não confirmada): o Blender só preserva `extras` como *custom property* se a opção correspondente estiver ligada na exportação (ver PLANO.md > "Riscos e mitigações"), e o app ainda não tem o fallback "sem extras" (reconstrução por nome de nó) implementado — só a leitura de `extras` está pronta hoje. Retomar quando o usuário priorizar: (1) pedir os detalhes exatos do erro/comportamento; (2) confirmar se a opção de custom properties estava ativa na exportação do Blender; (3) se for mesmo ausência de `extras`, implementar o fallback por nomenclatura de nó já previsto no plano.

---

## 12. Fase 7 (IK) — CCD por eixo trava contra o limite articular e não converge, mesmo para alvos alcançáveis

**Contexto:** implementando o solver CCD manual para as cadeias de 2 elos (ombro+cotovelo → pulso; quadril+joelho → tornozelo), com um teste automatizado simples: braço em repouso, alvo a 0,538 m do ombro (dentro do alcance máximo de 0,58 m = comprimento braço+antebraço, portanto geometricamente alcançável). O solver não convergia (ficava ~0,04 m longe do alvo, ~7% do comprimento do braço) mesmo aumentando as iterações de 12 para 30.

**Investigação (com um teste isolado imprimindo o estado a cada passo, não só suposição):** a primeira versão calculava, por junta, uma rotação 3D "ideal" (quaternion) que alinha o vetor junta→efetuador ao vetor junta→alvo, decompunha em Euler XYZ e **descartava (zerava) os eixos sem grau de liberdade** (ex.: `elbow.z`, que não é DOF do cotovelo) — perdendo parte da rotação computada, já que a decomposição Euler não separa "quanto era realmente necessário em cada eixo" de forma independente. Corrigido para calcular o ângulo **exato ao redor de cada eixo individualmente** (projeção dos dois vetores no plano perpendicular ao eixo + ângulo com sinal via produto vetorial) — mais robusto, nunca toca eixos travados. Mesmo assim, o cotovelo continuava preso em `x=0` (limite mínimo, "esticado") para sempre: o cálculo local pedia uma flexão **negativa** (hiperextensão, fora do limite `[0,150]`) porque, a partir da orientação atual do ombro, a única forma de alinhar o antebraço na direção do alvo *pelo próprio referencial do cotovelo* exigia girar "para o lado errado". O ombro deveria compensar reorientando o antebraço para um ângulo onde a flexão positiva do cotovelo ajudasse — mas isso nunca aconteceu em nenhuma das 30 iterações: o cotovelo fica preso contra o limite indefinidamente, um problema conhecido de CCD ingênuo com limites articulares (mínimo local espúrio contra a borda de um limite, sem escapar).

**Opções consideradas:**
1. **Tentar contornar dentro do CCD** (mais iterações, alternar a ordem base↔ponta entre iterações, pequena perturbação aleatória ao detectar uma junta presa no limite por várias iterações seguidas). Mantém a arquitetura já escrita, mas é ajuste de parâmetros/heurística sem garantia de convergência — o tipo de "força bruta" que a diretriz do projeto pede para evitar; poderia continuar falhando em outras poses/alvos sem um jeito confiável de saber quando.
2. **Substituir por IK analítico de 2 ossos** ("two-bone IK", a mesma técnica usada por engines de jogos — `TwoBoneIKConstraint` da Unity, `Two Bone IK` da Unreal): fórmula fechada (lei dos cossenos) para o ângulo de flexão do cotovelo/joelho + um vetor de mira para orientar o ombro/quadril na direção do alvo (com um "pole vector" simples definindo o plano de dobra, ex.: cotovelo sempre dobra para trás/para o lado do corpo). Estruturalmente imune a ficar preso contra um limite (o ângulo de flexão é calculado direto, não descoberto por tentativa), continua respeitando os limites de `skeleton.ts` (grampeia o ângulo calculado), e ainda é "pequeno e controlável" — só duas fórmulas de trigonometria por cadeia, arguavelmente mais simples e mais previsível que CCD iterativo.
3. **Reescrever como CCD "verdadeiro" (rotação 3D por junta, sem separar eixo a eixo), mas com um número de iterações bem maior (ex. 100+) e projeção/clamping mais tolerante.** Mais fiel ao termo literal "CCD" do plano, mas provavelmente sofreria do mesmo tipo de mínimo local (o problema não é a granularidade eixo-a-eixo, é a natureza iterativa gulosa de CCD contra limites duros) — arriscaria trocar um bug conhecido por um bug parecido, sem resolver a causa raiz.

**Decisão:** opção 2, confirmada pelo usuário. Implementado em `src/figure/ikSolver.ts`: lei dos cossenos para o ângulo de flexão da junta intermediária + construção de uma base ortonormal completa (direção do membro + eixo de dobra) para orientar a junta-base, extraindo a rotação de uma vez em vez de "apontar e decompor" (que deixaria a torção/eixo de dobra arbitrários).

**Dois bugs reais encontrados e corrigidos durante a implementação (via teste isolado imprimindo cada etapa, não suposição):**
1. **Sinal do eixo de dobra invertido:** apontar a junta-base só pela direção (rotação mínima) deixa o eixo X da junta intermediária (seu eixo de dobra) num ângulo arbitrário ao redor do braço — a flexão calculada então dobrava num plano errado, batendo a distância certa "por acaso" em alguns casos mas errando o alvo por até 0,36 m (~60% do comprimento do braço) em outros. Corrigido construindo a base ortonormal completa (eixo Y = direção do membro, eixo X = eixo de dobra) de uma vez, via `Matrix4.makeBasis`. Verificado numericamente (não assumido) que o eixo X resultante bate exatamente com o eixo de dobra pretendido.
2. **Sentido da flexão invertido em relação à base construída:** mesmo com a base geometricamente correta (verificado: eixo de dobra e posição da junta intermediária batem exatamente com o esperado), a flexão positiva dobrava para o lado errado — testei os dois sentidos (`+flexão`/`-flexão`) num alvo alcançável e confirmei numericamente que o esqueleto exige o oposto do que a construção da base "deveria" produzir pela convenção óbvia. Corrigido usando o eixo de dobra **oposto** (`-bendAxis`) como eixo X da base, o que faz a flexão positiva (a única permitida, já que o limite nunca hiperestende) dobrar para o lado certo.
3. **Caso degenerado (alvo já alcançado, braço esticado na direção do alvo):** a referência usada para definir o plano de dobra (baseada na posição atual da junta intermediária) fica mal-condicionada quando o membro já aponta na direção do alvo — o eixo de referência caía num vetor global arbitrário, forçando uma torção grande e desnecessária na junta-base (que, num caso, estourou o limite do ombro e distorceu a posição final por 0,82 m ao ser grampeada). Corrigido usando o eixo de dobra **atual** da junta intermediária como referência de contingência nesse caso, em vez de um vetor fixo do mundo — sempre bem definido, e mais alinhado à pose atual.

**Limitação aceita (documentada em `ikSolver.ts`, não é requisito do plano):** a torção livre da junta-base (grau de liberdade que não afeta a posição do efetuador, ex. `shoulder.y` quando o cotovelo está quase esticado) não é otimizada para minimizar o movimento — pode variar de forma pouco previsível entre chamadas próximas (ex.: um alvo quase parado ainda pode produzir uma torção grande, mas posicionalmente correta). Como o efetuador sempre chega exatamente onde deveria, isso é só um detalhe estético/de continuidade visual ao arrastar, não um erro de posição — revisitar só se incomodar na validação manual.

**Motivo:** a única forma de ter confiança nesse tipo de matemática geométrica é verificar cada etapa numericamente (posição da junta intermediária, eixo de dobra resultante, distância final) em vez de confiar na álgebra feita "de cabeça" — os dois bugs de sinal só apareceram porque testei com alvos concretos e conferi os números, não porque a derivação "parecia" errada.

---

## 13. Fase 8 (poses predefinidas) — limites de `hip.x`/`shoulder.x` em `skeleton.ts` tinham a faixa grande do lado errado (bug desde a fase 2)

**Contexto:** o usuário testou os presets "sentado" e "correndo" no navegador e reportou: as pernas de "sentado" e o braço de "correndo" giravam para trás, não para frente.

**Investigação (numérica, com `buildJointFrames`, não só visual):** montei a cinemática direta de `hip.L` e `shoulder.L` isoladamente (só esse eixo rotacionado, nada mais) e medi a posição resultante da junta filha no mundo. Resultado: **`hip.x` e `shoulder.x` positivos giram o membro para trás** (-Z, sentido oposto ao "front" já convencionado no projeto pelas juntas `ball.*`/polegar), não para frente como eu tinha assumido ao escrever `posePresets.ts`. Isso por si só seria só um bug nos meus valores dos presets (bastaria inverter o sinal) — mas o `skeleton.ts` (fase 2) define `hip.x: {min:-30, max:120}` e `shoulder.x: {min:-90, max:180}`, ou seja, **a faixa grande (120°/180°, anatomicamente compatível com flexão) está do lado que na verdade estende para trás, e a faixa pequena (-30°/-90°, compatível só com extensão) está do lado que flexiona para frente.** Isso significa que inverter só o sinal dos presets não bastava: "sentado" precisa de ~90° de flexão para frente, e esse lado só permitia -30°.

Esse bug ficou adormecido desde a fase 2 porque nenhum consumidor anterior (sliders de FK, IK) precisava afirmar "esse valor numérico específico = frente de verdade" — os sliders funcionam em qualquer direção sem checar o significado anatômico, e o IK sempre resolve em função do alvo, não de uma direção nomeada. Só os presets, que precisam de uma pose fisicamente correta e nomeada ("sentado"), expuseram o problema.

**Opções apresentadas ao usuário:**
1. Corrigir os limites em `skeleton.ts` (trocar `hip.x` para `{min:-120,max:30}` e `shoulder.x` para `{min:-180,max:90}` — só inverte qual lado é grande/pequeno, mesma amplitude total, sem mudar geometria/renderização) e ajustar os presets para o sinal correto.
2. Manter os limites como estão e ajustar só os presets para usar o lado "frente" disponível hoje (limitado a -30°/-90°) — rejeitada de saída na pergunta ao usuário: não dá pra fazer um "sentado" convincente com só 30° de flexão de quadril.

**Decisão:** opção 1, confirmada pelo usuário. `skeleton.ts`: `hip.L`/`hip.R`.limits.x → `{min:-120,max:30}`; `shoulder.L`/`shoulder.R`.limits.x → `{min:-180,max:90}`. `posePresets.ts`: todos os valores de `hip.x`/`shoulder.x` dos presets `sitting`/`walking`/`running` tiveram o sinal invertido (a relação contralateral braço/perna já estava certa — só a direção absoluta estava invertida). Revalidado numericamente (posição do joelho/tornozelo/cotovelo no mundo) antes de mexer nos testes, e visualmente no navegador depois.

**Efeito colateral (aceito, de baixo risco):** qualquer pose já salva (cena/boneco exportado) usando esses dois eixos é re-grampeada pelos novos limites ao reabrir — projeto ainda em uso pessoal, sem cenas de produção salvas. Um teste do solver de IK (`ikSolver.test.ts`) precisou trocar o alvo de teste: o alvo antigo (deslocado em +X a partir do ombro esquerdo) passou a exigir uma torção livre da junta-base (ver decisão #12, limitação aceita) que bate no novo limite; um alvo em -X (fisicamente equivalente, só do outro lado) converge perfeitamente — não é uma regressão do solver, só sensibilidade já documentada da torção não-otimizada a mudanças na forma dos limites.

**Motivo:** o relato do usuário apontava para um problema visual específico, mas a causa raiz só apareceu investigando com cinemática direta real (não suposição) — confirma, de novo, que bugs de sinal/direção neste tipo de código exigem verificação numérica, não dedução.

---

## 14. Fase 9, item 12 — auditoria completa de sinal/direção das juntas restantes (spine/chest/neck/head, clavicle, wrist, ankle, eixos y/z de hip/shoulder)

**Contexto:** a correção #13 tratou só `hip.x`/`shoulder.x` — os dois eixos que o bug relatado expôs. O usuário pediu, como item 12 da Fase 9, auditar as juntas/eixos restantes com o mesmo método numérico, antes de confiar que nenhum outro eixo tem o mesmo problema.

**Método:** o mesmo de #13 — `buildJointFrames`, rotacionar um eixo por vez a partir da pose de repouso, medir a posição resultante do filho (ou de um ponto sintético local, quando o filho ficava exatamente sobre o próprio eixo de rotação e não revelava nada) no mundo. Cobertos: `spine`/`chest`/`neck`/`head` (x/y/z), `clavicle.L/R` (y/z), `shoulder.L/R` (y/z — x já coberto no #13), `wrist.L/R` (x/z), `ankle.L/R` (x/z), `hip.L/R` (y/z — x já coberto no #13), com verificação cruzada via a identidade de rotação padrão (`Rot(eixo,θ)`) para confirmar as fórmulas medidas.

**Achados (4, apresentados ao usuário via pergunta direta antes de mexer em `skeleton.ts` de novo):**

1. **`spine.x` e `chest.x`: mesmo padrão do #13, faixa grande do lado errado.** Diferença estrutural do `hip`/`shoulder`: como o filho de `spine`/`chest` fica **acima** (não abaixo, como nos membros), a mesma rotação em X produz o sinal oposto de "flexiona para a frente" — **positivo** flexiona o tronco para frente nesses dois (não é inconsistência, é a mesma rotação vista de lados opostos do pivô; `neck.x` já seguia essa convenção corretamente e não precisou de ajuste). Mas a AMPLITUDE estava trocada: `spine.x` tinha `{min:-45,max:30}` e `chest.x` tinha `{min:-25,max:20}` — a flexão para frente (que anatomicamente tem alcance maior, como a flexão de tronco ao curvar-se) estava com a faixa **menor** que a extensão para trás.

2. **`elbow.x` só permitia a direção anatomicamente impossível.** Com o ombro em repouso, a única faixa permitida (`{min:0,max:150}`) dobrava o antebraço para **trás** (extensão/hiperextensão), nunca para frente (flexão real — o cotovelo só dobra para a frente na anatomia humana, ao contrário do joelho). `knee.x` usa a mesma forma de faixa (`{min:0,max:150}`) mas está correta para o joelho (que realmente flexiona para trás) — o bug era específico do cotovelo. Isso não foi pego na validação visual da fase 8 (que checou a direção geral do braço, já corrigida pelo #13) nem na validação da fase 7 (IK, que só checa se o pulso chega no alvo, não a direção anatômica do cotovelo em si).

3. **`ankle.x` tinha o mesmo padrão de amplitude trocada do item 1.** Usando um ponto sintético "reto para baixo" (em vez do filho real `ball.*`, cujo deslocamento para a frente contaminava a leitura direta), confirmei: X positivo = flexão plantar (aponta o pé para baixo, maior amplitude real, ~50°); X negativo = dorsiflexão (levanta a ponta do pé, menor amplitude, ~20°). A faixa antiga (`{min:-50,max:20}`) tinha isso invertido.

4. **Achado arquitetural (não é bug de faixa): eixos Y (torção) e Z (abdução/lateral) de toda junta pareada L/R têm sentido anatômico oposto para o mesmo sinal.** Ex.: `shoulder.L.z` positivo abre o braço para o lado (abdução); `shoulder.R.z` positivo, com o mesmo código/sinal, puxa o braço para o outro lado do corpo (adução) — confirmado numericamente e também para `clavicle.y/z`, `hip.z`, `wrist.z`. Causa: a junta R é só um espelhamento de **posição** (offset X negado) — a rotação em si não é espelhada. O eixo X não sofre disso porque não depende da coordenada X, só de Y/Z (por isso #13 não teve esse problema). As faixas desses eixos já são simétricas em todos os casos (não há grampeamento errado, nenhuma pose fica impossível), então isso nunca quebrou nenhum preset existente (nenhum usa esses eixos hoje) — mas uma pose simétrica futura (ex. "braços abertos", "pernas afastadas") precisaria de **sinais opostos** entre L e R nesses dois eixos, não do mesmo valor.

**Opções apresentadas ao usuário:** (a) corrigir tudo agora (itens 1-3 em `skeleton.ts`/`posePresets.ts`/`ikSolver.ts`, mais documentar o item 4); (b) corrigir só os 2 bugs já 100% confirmados na hora (spine/chest.x, elbow.x), documentando ankle.x e o item 4 como pendência separada; (c) só documentar os 4 achados em `DECISOES.md`, sem mexer em código nesta sessão.

**Decisão:** opção (a), confirmada pelo usuário. Para o item 4 especificamente, a decisão tomada foi **documentar a convenção** (comentário extenso no topo de `skeleton.ts`, mais um teste de regressão travando o comportamento atual) em vez de reescrever a forma como as juntas L/R são espelhadas — essa segunda alternativa exigiria reconstruir a base local de cada junta R com uma reflexão de verdade (não só negar a posição), o que se estende por `jointFrames.ts`, a renderização (`Figure.tsx`) e o solver de IK, e esse espelhamento "barato" (só a posição) é aliás uma convenção comum em rigs 3D — não tratei como bug a corrigir na origem, só como comportamento a deixar explícito para quem for montar uma pose simétrica no futuro.

**Mudanças em código:**
- `skeleton.ts`: `spine.x` → `{min:-30,max:45}`; `chest.x` → `{min:-20,max:25}`; `elbow.L/R.x` → `{min:-150,max:0}` (era `{min:0,max:150}`); `ankle.L/R.x` → `{min:-20,max:50}` (era `{min:-50,max:20}`). Docblock do módulo reescrito explicando a convenção de sinal de X por grupo de junta (tronco vs. membro) e o espelhamento Y/Z documentado no achado 4.
- `ikSolver.ts`: o solver sempre aplicava `flexionDeg` (sempre ≥ 0, vindo da lei dos cossenos) diretamente ao eixo X da junta intermediária — funcionava para `knee` (positivo=flexão, inalterado) mas travava o `elbow` em 0 (já que a nova faixa só aceita valores ≤0). Corrigido derivando o sinal correto (`flexesNegative`) a partir do próprio `midLimits.x` da junta (não hardcoded por nome), e invertendo **junto** o sinal usado para construir o eixo de dobra da junta-base (`localHingeAxis`) — pela identidade `Rot(eixo,θ) = Rot(-eixo,-θ)`, os dois sinais invertidos juntos preservam a posição final alcançada, só mudam qual sinal numérico representa a mesma dobra física. Verificado pelos testes de convergência existentes (que comparam a posição final alcançada com o alvo, não só se o limite foi respeitado) — não assumido.
- `posePresets.ts`: valores de `elbow.x` em `walking`/`running` tiveram o sinal invertido (`10→-10`, `15→-15`, `60→-60`, `90→-90`); `sitting`/`walking`/`running` não usam `spine`/`chest`/`ankle.z`, então não precisaram de ajuste (os valores de `ankle.x` já usados, como `-5` em `sitting`, continuam válidos — só a AMPLITUDE do eixo mudou, não o sentido de cada sinal).
- Novo `src/figure/__tests__/jointSignConvention.test.ts`: trava numérica das convenções confirmadas (tronco flexiona positivo, membros flexionam negativo, faixas maiores do lado certo, elbow só permite negativo, e o espelhamento Y/Z documentado como comportamento intencional, não regressão).
- Testes existentes atualizados para a nova faixa/sinal de `elbow.x` (todos os valores eram arbitrários para exercitar clamping/undo/round-trip, não presets reais): `skeleton.test.ts`, `sceneSerialization.test.ts`, `useKeyboardShortcuts.test.tsx` (trocado `ArrowRight`→`ArrowLeft` nos dois testes que moviam `elbow.L`), `figuresStore.test.ts`, `PropertiesPanel.test.tsx`.
- Suíte completa: 378 testes, todos verdes; `tsc -b`, `eslint .` e `npm run build` continuam limpos.

**Motivo:** o pedido do usuário era justamente não confiar mais nos presets/limites sem checagem numérica de todo o esqueleto — encontrar 3 bugs reais adicionais (2 deles em juntas nunca antes escrutinadas numericamente, o cotovelo sendo o mais sério por afetar tanto FK quanto IK) confirma que a mesma classe de erro (assumir a direção de um eixo em vez de medir) se repetiu em várias juntas desde a fase 2, e que a auditoria completa era necessária antes de tratar `posePresets.ts` como confiável.

---

## 15. Ajuste de proporções corporais e visual do boneco (pescoço/tronco, dedos, rosto) — pedido do usuário

**Contexto:** o usuário pediu 4 ajustes: (1) diminuir o espaço entre `chest` e `neck` (cabeça mais próxima do corpo); (2) diminuir o espaço entre `chest` e `spine`, ajustando o comprimento dos braços em consequência; (3) representar os 4 dedos (exceto polegar) com um paralelepípedo e incluir uma forma após a junta final de `fingers`/`thumb`, já que hoje não dá pra ver o efeito de rotacioná-las; (4) alguma referência geométrica para a frente do rosto (nariz/olhos/boca/orelhas). Pedido inicial: "diminuir" os dois espaços do tronco, sem números. Pedi para confirmar dois pontos em aberto (compensar a altura total de 1,70 m documentada, e textura vs. geometria para o rosto) — o usuário redirecionou: em vez de responder a pergunta de compensação de altura, pediu para **rever as proporções conforme um corpo físico real médio de 1,70 m**, e confirmou geometria (não textura) para o rosto.

**Investigação (proporções antropométricas, não "diminuir" arbitrário):** usando frações de altura total (H) de Drillis & Contini (1966, tabela padrão de biomecânica, amplamente reproduzida — ex. Winter, *Biomechanics and Motor Control of Human Movement*), calculadas para H=1,70 m:

| Marco (altura do chão) | Fração de H | Valor (1,70 m) |
|---|---|---|
| tornozelo | 0,039 H | 0,066 m |
| joelho | 0,285 H | 0,485 m |
| quadril | 0,530 H | 0,901 m |
| ombro | 0,818 H | 1,391 m |
| topo da cabeça | 1,000 H | 1,700 m |

Segmentos derivados (diferença entre marcos consecutivos): canela 0,246H, coxa 0,245H, tronco (quadril→ombro) 0,288H=0,490m, cabeça+pescoço (ombro→topo) 0,182H=0,309m, cabeça sozinha 0,130H=0,221m → pescoço sozinho ≈0,088m.

Comparando com `skeleton.ts` (antes do ajuste): `root` (quadril, 0,90m) já batia quase exatamente. Pernas (coxa/canela, 0,40m cada) já batiam (~4% curto, não fui atrás por não ter sido pedido). **Braços já batiam** (ombro→cotovelo 0,32m vs. ideal 0,316m; cotovelo→pulso 0,26m vs. ideal 0,248m) — ou seja, o item 2 original ("ajustar braços") **não era necessário**, uma vez corrigido o tronco. O achado real: `spine`+`chest` somavam só 0,40m (ideal ≈0,49m — **tronco curto demais**, não longo) e `chest`→`neck` sozinho já era 0,24m (**mais que o triplo** do pescoço real ≈0,088m), com `neck`→`head` (0,16m) mais a própria esfera da cabeça ainda somando mais — o "pescoço" visual (osso torneado entre `chest` e `neck`) tinha ~24cm de comprimento, claramente desproporcional. Ou seja: o pedido original #2 (encurtar o tronco) tinha o diagnóstico invertido — o problema real sempre foi o pescoço longo demais, não o tronco curto.

**Opções apresentadas ao usuário** (após a investigação, antes de mexer no código): (a) implementar as novas proporções calculadas (crescer o tronco, encolher drasticamente o pescoço, manter braços/pernas como estão) — a soma dá quase exatamente 1,70m de novo, sem precisar compensar em outro lugar; (b) só encurtar o pescoço, sem crescer o tronco (aceita ficar mais baixo que 1,70m); (c) manter o pedido literal original (encurtar tronco e braços), ignorando a antropometria. Apresentei (a) como recomendada, com a tabela de números; o usuário confirmou.

**Decisão:** opção (a). Mudanças em `skeleton.ts` (só offsets `position`, nenhum limite/DOF mudou):
- `spine`: `[0,0.14,0]` → `[0,0.17,0]`
- `chest`: `[0,0.26,0]` → `[0,0.32,0]`
- `neck`: `[0,0.24,0]` → `[0,0.08,0]`
- `head`, braços, pernas: **inalterados** (já batiam com a antropometria).

Para os itens 3 e 4, decidido **não** adicionar novas juntas ao `skeleton.ts` (manteria os "27 juntas" documentados e o schema de pose intactos) — em vez disso, geometria estática extra em `Figure.tsx`, anexada como filha do próprio grupo da junta (`fingers.L/R`, `thumb2.L/R`, `head`), herdando a rotação da junta automaticamente:
- `TIP_CAPS`: um paralelepípedo na ponta de `fingers.L/R` (bloco dos 4 dedos) e um menor em `thumb2.L/R` (ponta do polegar) — antes, esses dois graus de liberdade não tinham nenhuma geometria além do próprio pivô, então girá-los não tinha efeito visível nenhum.
- `FaceFeatures`: nariz, 2 olhos, boca e 2 orelhas — pequenas esferas/caixa na esfera da cabeça, **mesma cor do boneco** (sem textura, relevo/sombreado basta para distinguir, mantendo a estética de manequim de madeira entalhado já estabelecida).

**Validação:** 3 novos testes em `Figure.test.tsx` (face com ≥7 meshes no grupo `joint-head`; `TIP_CAPS` presentes nas 4 juntas; posar `fingers.L` move o bloco no mundo — trava de regressão do bug relatado). Suíte completa em 381 testes, todos verdes; `tsc -b`, `eslint .` e `npm run build` continuam limpos. Validado visualmente no navegador (via automação Chrome, `npm run preview`, janela redimensionada para 2400×1600 para ter resolução suficiente e recortar a cabeça em zoom): pescoço visivelmente curto (cabeça encostada nos ombros), tronco com proporção natural, nariz/olhos/orelha visíveis por relevo na cabeça, bloco dos dedos visível e se movendo ao rotacionar `fingers.L` (antes: nenhum efeito visível). Sem erros no console.

**Motivo:** o pedido original presumia um diagnóstico (tronco longo demais) que a antropometria mostrou estar invertido — seguir a proporção real de um corpo médio de 1,70m, em vez da "figura de desenho" idealizada de 8 cabeças usada no rascunho da fase 2, resolve o sintoma relatado (cabeça "flutuando" longe do corpo) pela causa certa (pescoço), sem precisar tocar em braços/pernas que já estavam corretos, e sem introduzir uma redistribuição arbitrária de altura.

---

## 16. Junta `upperChest`, mãos com 3 falanges por dedo, polegar em cilindro e conectores de tronco mais robustos — pedido do usuário

**Contexto:** o usuário pediu "avaliar" (não implementar direto) 3 mudanças: (1) uma junta entre `chest` e `neck`, com as clavículas passando a ser filhas dela, porque "a falta desse ponto faz com que o pescoço não fique visível"; (2) refazer as mãos com 3 juntas de falange para o grupo dos 4 dedos (imagem de referência anexada: cadeia de 3 segmentos + 3 juntas antes do bloco da palma), polegar em cilindros, dedos em paralelepípedos, proporções corrigidas ("parecem desproporcionais"); (3) conectores mais robustos entre `chest`↔`spine`↔`root`, em vez de um cilindro fino.

**Investigação antes de implementar:** o diagnóstico do item 1 (pescoço invisível) estava certo no sintoma, mas não na causa apontada. Reproduzindo o cálculo: o offset `chest→neck` era só 0,08m (ajustado no #15), mas o bloco torneado do `chest` (`TORSO_BLOCKS.chest.height=0,24`, estende ±0,12m a partir da própria origem) **ultrapassava essa distância** — a junta `neck` ficava embutida dentro do volume do `chest`, escondida, independentemente de existir ou não uma junta nova no meio. O item 3 tinha a mesma causa-raiz: os offsets `spine`/`chest` cresceram no #15 mas `TORSO_BLOCKS` não acompanhou, deixando um vão preenchido só pelo osso conector fino (`limbProfile`) entre os blobs — um "palito" entre dois blocos largos.

**Opções apresentadas ao usuário** (resumo, detalhe completo na resposta da conversa): (a) implementar a junta nova como pedido, mais o ajuste de `TORSO_BLOCKS` (necessário de qualquer forma, item 3); (b) implementar as mãos/polegar como pedido; (c) alternativa descartada preventivamente para o item 1 — só ajustar `TORSO_BLOCKS` sem adicionar a junta nova, já que isso sozinho já resolveria a visibilidade; rejeitada porque a junta nova dá uma capacidade real adicional (inclinar a base do pescoço/clavículas independente do tórax inteiro) que o usuário pediu explicitamente, não é só um workaround visual. Apresentei nomes/faixas/offsets concretos para os três itens; o usuário confirmou.

**Decisão e mudanças em `skeleton.ts` (27 → 32 juntas):**
- **Item 1:** nova junta `upperChest` (filha de `chest`, só eixo X, `{min:-15,max:15}`) — `neck` passa a ser filha dela (offset `chest→neck` de 0,08m dividido em dois saltos de 0,04m, mantendo o total) e `clavicle.L`/`clavicle.R` também passam a ser filhas dela em vez de `chest` (offset ajustado de `[±0.1,0.05,0]` para `[±0.1,0.01,0]`, preservando a posição absoluta do ombro na pose de repouso). Como a hierarquia é transitiva, dobrar o `chest` continua movendo os ombros normalmente — a junta nova é aditiva, não muda nenhum comportamento existente.
- **Item 2:** `fingers.L`/`fingers.R` (1 junta cada) substituídas por uma cadeia de 3 (`fingersBase`→`fingersMid`→`fingersTip`, aproximando MCP→PIP→DIP), todas só eixo X, faixas 0-90°/0-110°/0-90° (PIP dobra mais, como numa mão real) — continuam representando os 4 dedos "em bloco" (mesma simplificação da fase 2, só a junta única virou uma cadeia). `thumb1`/`thumb2` mantidos (já são MCP+IP, certo para um polegar real), só com offsets maiores (proporção corrigida: thumb1 `0,03→0,035`, thumb2 `0,02→0,025` em cada eixo).
- **Item 3:** `TORSO_BLOCKS` recalibrado junto: `root` 0,16→0,18, `spine` 0,13→0,22 (para se sobrepor levemente ao `root` e ao `chest`, sem vão), `chest` 0,24→0,12 (encolhido de propósito, para NÃO alcançar `upperChest`/`neck` — é o que resolve o item 1 na prática).

**Mudanças em `Figure.tsx`:** `Bone` ganhou um terceiro modo de geometria (`shape: 'taper'|'paddle'|'cylinder'`, antes só um booleano `paddle`) — `CylinderGeometry` lisa para os ossos do polegar (`thumb1`/`thumb2`), mantendo `BoxGeometry` (paralelepípedo) para a cadeia de dedos inteira (`fingersBase`/`fingersMid`/`fingersTip`, antes só o segmento único `fingers`). `TIP_CAPS` (bloco estático na ponta, sem junta própria — ver #15) atualizado: removido de `fingers.*` (agora é o próprio `fingersTip` que faz esse papel, com uma tampa pequena representando só a falange distal); `thumb2.*` passou a usar a forma `cylinder` em vez de `box`, para combinar com o resto do polegar.

**Validação:** contagem/hierarquia atualizada em `skeleton.test.ts`, `jointFrames.test.ts` (27→32), `figureObject3D.test.ts` (contagem de meshes 53→63); testes de `Figure.tsx` reescritos para os novos nomes de junta, mais 2 novos (ossos do polegar são cilindro; posar `fingersBase.L` move `fingersTip.L` no mundo — trava de regressão). Suíte completa em 384 testes, todos verdes; `tsc -b`, `eslint .` e `npm run build` continuam limpos. Validado visualmente no navegador (janela 2400×1600, zoom recortado): pescoço agora visível (não mais escondido no `chest`), tronco sem "palito" entre os blocos, cadeia de dedos dobrando visivelmente ao posar `fingersBase.L`, polegar com segmentos cilíndricos distintos do resto do braço. Sem erros no console.

**Motivo:** os dois sintomas relatados pelo usuário (pescoço sumido, "palito" entre chest/spine/root) tinham a mesma causa raiz (blocos torneados desatualizados em relação aos offsets do #15) — corrigir só isso já resolvia visualmente, mas a junta `upperChest` pedida ainda tem valor próprio (grau de liberdade novo, real), então implementei as duas coisas juntas em vez de descartar o pedido original com base no diagnóstico técnico.

---

## 17. Correção — conector `chest`↔`spine` ainda fino após o #16

**Contexto:** o usuário testou o resultado do #16 e reportou que o conector entre `chest` e `spine` continuava parecendo um cilindro fino.

**Causa raiz:** o ajuste do #16 (`TORSO_BLOCKS.chest` encolhido para 0,12m, de propósito, para não esconder o pescoço) teve um efeito colateral que eu não recalculei: o vão entre o topo do bloco de `spine` e a base do bloco de `chest` ficou maior, não menor — refazendo a conta (offset `spine→chest`=0,32m; `spine` altura 0,22m/±0,11; `chest` altura 0,12m/±0,06): vão = 0,32-0,11-0,06 = **0,15m** só coberto pelo osso conector fino (`limbProfile`, raio automático calculado para membros, não para tronco). Reportei esse recálculo ao usuário — não é um pedido novo, é o mesmo item 3 do #16 que eu não fechei direito.

**Decisão:** em vez de tentar fechar o vão só aumentando os blocos (o que reabriria o problema do pescoço escondido, já que `chest` precisa continuar baixo), separei os dois ajustes:
1. `spine` cresce mais (0,22→0,28m) — sem risco, o próximo filho de `spine` (`chest`) está longe (0,32m), então não há chance de esconder nada.
2. Novo `TORSO_BONE_RADIUS`, um mapa de raio explícito por junta-filha que sobrepõe o cálculo automático do `Bone` (pensado para ossos de membro, não de tronco) — o osso `spine→chest` passa a ter raio fixo de 0,085m (perto do `maxRadius` dos blocos vizinhos), em vez do raio calculado automaticamente (que já batia no teto de 0,035m mesmo assim, pequeno perto dos blocos de até 0,115m de raio).

**Validação:** suíte completa em 384 testes, todos verdes (nenhum teste dependia dos valores exatos de raio/altura); `tsc -b`, `eslint .` e `npm run build` continuam limpos. Validado visualmente no navegador: tronco (`root`/`spine`/`chest`) agora uma forma contínua e arredondada, sem trecho fino visível em nenhuma transição; pescoço continua visível. Sem erros no console.

**Motivo:** a lição do #16 (mudar um offset sem revisar o raio/altura de tudo que depende dele) se repetiu numa escala menor — desta vez corrigido separando explicitamente "quão alto cada bloco pode crescer sem esconder o próximo" (regra já existente) de "quão grosso o osso conector deve ser" (regra nova, `TORSO_BONE_RADIUS`), para não depender só da sobreposição dos blocos.

---

## 18. `chest` em trapézio (mais largo em cima, mais estreito embaixo) + offset `spine`→`chest` encolhido para compensar

**Contexto:** o usuário pediu para o `chest` ficar visualmente mais alto e um pouco mais largo, com a parte de cima (ombros) mais larga que a de baixo (cintura) — "trapézio regular, base maior para cima", visto de frente — e para encolher a ligação `chest`↔`spine` para compensar a diferença. Pediu também para eu **verificar se a mudança visual do chest está atrelada a mudança nas juntas**, antes de implementar.

**Verificação pedida pelo usuário:** sim, há acoplamento, em dois sentidos:
1. O tamanho visual do `chest` não pode crescer livremente para CIMA — desde o #16/#17, a margem entre o topo do bloco do `chest` e a junta `upperChest`/`neck` é o que mantém o pescoço visível (crescer para cima re-esconderia o pescoço, o mesmo bug do #16). Por isso toda a altura pedida foi adicionada para BAIXO (em direção ao `spine`), mantendo o topo na mesma distância da origem do `chest` já validada no #16/#17.
2. O próprio pedido do usuário (encolher `spine`→`chest`) É uma mudança de junta (`skeleton.ts`), não só visual — diferente dos ajustes anteriores desta rodada (#16/#17), que só mexiam em geometria (`Figure.tsx`) sem tocar nos offsets.

**Decisão e mudanças:**
- `Figure.tsx`: `chest` deixou de usar `blobProfile` (barril simétrico, mesmo raio nas duas pontas) — novo `trapezoidProfile`, que aceita extensão e raio diferentes para cima/baixo da origem da junta. `CHEST_SHAPE`: `topExtent` mantido em 0,07m (igual à meia-altura anterior, preserva a margem de segurança do pescoço), `bottomExtent` estendido para 0,15m (o aumento de altura pedido, todo para baixo), `topRadius` 0,13m (mais largo que o raio único anterior de 0,115m) e `bottomRadius` 0,09m (mais estreito, afunilando para a cintura).
- `skeleton.ts`: offset `spine`→`chest` reduzido de 0,32 para 0,24m (pedido do usuário, para compensar o bloco mais alto).

**Efeito colateral (aceito, não perguntado — é um ajuste de proporção incremental, mesma categoria dos ajustes visuais anteriores desta sessão):** a altura total do esqueleto (raiz até o topo da cabeça) encolhe ~0,08 m em relação ao valor calibrado no #15 (~1,70-1,72 m), já que o offset `spine`→`chest` ficou menor sem compensação em outro ponto da cadeia vertical — o próprio bloco do `chest` ocupa agora visualmente parte desse espaço, então o efeito visual esperado é o tronco continuar com aparência proporcional, só um pouco mais baixo no total.

**Validação:** suíte completa em 384 testes, todos verdes (nenhum teste dependia dos valores exatos de raio/offset do `chest`); `tsc -b`, `eslint .` e `npm run build` continuam limpos. Validado visualmente no navegador: `chest` claramente mais largo nos ombros e mais estreito na cintura (silhueta em V visível de frente), transição para `spine`/`root` continua contínua e arredondada (sem "palito"), pescoço continua visível. Sem erros no console.

**Motivo:** o pedido já veio com a compensação especificada pelo próprio usuário (encolher o offset), então a única decisão de implementação em aberto era COMO distribuir o aumento de altura do bloco (para cima, para baixo, ou os dois) — escolhi "só para baixo" especificamente para não reabrir o bug do pescoço escondido (#16), replicando a margem de segurança já validada duas vezes nesta sessão.

---

## 19. T-pose como padrão, botão de retorno, combo box de seleção de junta, olhos pretos e topo do chest fechado

**Contexto:** o usuário pediu 4 funcionalidades/ajustes, para facilitar novas rodadas de ajuste fino no boneco: (1) T-pose (braços na horizontal, palmas para baixo) como pose padrão ao criar um boneco; (2) botão para voltar à T-pose a qualquer momento; (3) combo box com todas as juntas posáveis, agrupadas por optgroup (tronco, cabeça, braço direito/esquerdo, perna direita/esquerda), para alcançar juntas encobertas por outras partes do corpo sem precisar acertar o clique no viewport; (4) fechar o topo do `chest` (estava oco/aberto) e fixar a cor dos olhos em preto, independente da cor do boneco.

**Investigação (item 1 — palma para baixo, não deduzido):** braços na horizontal exige `shoulder.{L,R}.z = ±90` (abdução completa — sinal já confirmado em `DECISOES.md` #14: mesmo valor numérico abduz um lado e aduz o outro, então `shoulder.L.z=90` e `shoulder.R.z=-90`). Isso sozinho **não** vira a palma para baixo — rotação em torno do próprio eixo Z não afeta esse eixo, então a "normal da palma" (aproximada pelo eixo local +Z do pulso, que aponta para a frente/+Z na pose de repouso, coerente com a "posição anatômica" médica de referência) continua apontando para a frente depois só da abdução. Descobri, varrendo `elbow.*.y` numericamente (`buildJointFrames`, medindo a orientação resultante do pulso, não supondo): `elbow.L.y = -90` e `elbow.R.y = +90` (sinais opostos entre os lados — mesmo padrão de espelhamento Y/Z documentado no `skeleton.ts` para outras juntas pareadas) fazem a normal da palma apontar exatamente para -Y (para baixo). Isso exigiu alargar o limite de `elbow.*.y` de ±80° para ±90° (dentro da faixa real de pronação/supinação, que chega perto de 90°).

**Decisão e mudanças:**
- `skeleton.ts`: `elbow.L/R.y` de `{min:-80,max:80}` para `{min:-90,max:90}`.
- `posePresets.ts`: novo preset `tpose` (`shoulder.L.z=90`, `elbow.L.y=-90`, `shoulder.R.z=-90`, `elbow.R.y=90`), inserido na lista `POSE_PRESET_KEYS` logo após `standing`.
- `figuresStore.ts`: `addFigure` passa a usar `resolvePosePreset('tpose')` como pose inicial, em vez de `{}` — efeito colateral aceito: várias asserções de teste que esperavam `pose: {}`/`undefined` num boneco recém-criado precisaram ser atualizadas para o valor da T-pose (não é regressão, é a nova pose inicial esperada).
- `PropertiesPanel.tsx`: botão "T-pose" some junto dos outros presets (a lista de botões já era gerada a partir de `POSE_PRESET_KEYS`, então bastou adicionar o rótulo). Novo combo box "Selecionar junta" (sempre visível com um boneco selecionado, antes do bloco condicional raiz/junta), com uma opção "Raiz" mais 6 `<optgroup>` — `src/figure/jointGroups.ts` (novo módulo) define o agrupamento e tem teste garantindo que cobre exatamente as juntas de `JOINT_NAMES` (exceto `root`), sem faltar/duplicar nenhuma — trava de regressão para quando novas juntas forem adicionadas no futuro.
- `Figure.tsx`: `EYE_COLOR` fixo (`#0a0a0a`) para as 2 esferas dos olhos, em vez da cor do boneco (nariz/boca/orelhas continuam na cor do corpo). `trapezoidProfile` (chest) ganhou `closeTop`/`closeBottom` opcionais — um ponto extra de raio ~0 na mesma altura da ponta fecha aquele lado do `LatheGeometry` com uma "tampa" plana; usado só no topo do `chest` (a ponta mais exposta/visível, era onde o usuário via o interior oco).

**Validação:** 385→392 testes (novo `jointGroups.test.ts`; novos casos em `Figure.test.tsx` para olhos pretos e topo fechado do chest; `PropertiesPanel.test.tsx` para o botão T-pose e o combo box de junta; ajustes em `figuresStore.test.ts`/`posePresets.test.ts` para a nova pose inicial e o 5º preset), todos verdes; `tsc -b`, `eslint .` e `npm run build` continuam limpos. Validado visualmente no navegador: braços na horizontal com o polegar apontando para a frente (confirma palma para baixo) em ambos os lados; olhos pretos, nariz/orelhas na cor do boneco; topo do `chest` sem abertura visível (vista de cima); combo box lista as juntas certas por grupo e o valor `select.value` (setado via evento, já que `<select>` nativo não é clicável de forma confiável por automação) muda a junta selecionada corretamente, incluindo `fingersTip.R` (ponta do dedo, minúscula e praticamente impossível de clicar no viewport). Sem erros no console.

**Motivo:** o pedido do usuário era explicitamente para "facilitar os testes" dos próximos ajustes finos — T-pose separa os membros do corpo (evita sobreposição visual) e o combo box resolve o acesso a qualquer junta independentemente de estar visível/clicável, então as duas funcionalidades se complementam diretamente para esse objetivo.

---

## 20. Polegar para trás na T-pose (bug real) + remodelagem do tronco (chest em 2 trapézios, cilindro achatado, conector spine-root mais largo)

**Contexto:** o usuário testou a T-pose do #19 e reportou: "na posição em pé normal está OK" (confirma que o offset de `thumb1.*` em si não é o problema), mas na T-pose com palma para baixo o polegar fica virado para trás. Junto, pediu para remodelar o tronco seguindo uma imagem de referência: `chest` = dois trapézios ligados pela base maior; um cilindro achatado ligando `chest` ao `spine`; `spine`/`chest`/`pivô` já bem modelados, só a ligação `spine`↔`pivô` (root) precisa ficar mais larga vista de frente.

**Investigação (polegar, não deduzida):** o #19 escolheu `elbow.*.y` medindo a normal "abstrata" do pulso (eixo local +Z do `wrist`) até apontar para -Y (baixo). Reproduzindo com `buildJointFrames`, mas medindo agora a posição REAL de `thumb1.L` (não a normal abstrata): com `elbow.L.y=-90` (valor do #19), `thumb1.L` fica em `(0.030, -0.035, -0.035)` relativo ao pulso — **Z negativo, para trás**, confirmando o relato. A causa: o offset de `thumb1.*` no `skeleton.ts` tem componentes em X, Y **e** Z (não é um vetor puro no eixo Z), então girar até a normal abstrata apontar para baixo NÃO garante que o polegar (que segue uma direção diferente) acabe apontando para a frente — são dois vetores distintos, girando juntos mas não alinhados. Varredura fina de `elbow.L.y` (20° a 60°, depois `elbow.R.y` espelhado) medindo `thumb1.*` de verdade: `elbow.L.y=45` dá `thumb1.L` relativo `(0.030, 0.000, 0.049)` — Z máximo positivo (frente) e Y exatamente 0 (polegar nivelado, nem para cima nem para baixo), o melhor resultado da varredura. `elbow.R.y=-45` dá o espelho exato.

**Decisão (polegar):** `posePresets.ts`, preset `tpose`: `elbow.L.y` de `-90` para `45`; `elbow.R.y` de `90` para `-45`. Novo teste em `posePresets.test.ts` usando a posição real de `thumb1.*` (não uma normal abstrata) como trava de regressão.

**Remodelagem do tronco:** aplicada como pedida, sem opções alternativas apresentadas (instrução já veio com o desenho de referência) —
- `chest` = dois trapézios (`CHEST_SHAPE.upper`/`CHEST_SHAPE.lower`) em vez de um só: `upper` vai da origem do `chest` até `+0.07` (margem de segurança do pescoço inalterada, DECISOES.md #16/#17), afunilando de 0,13 (linha dos ombros) até 0,105 — esse 0,105 é a "base maior" que liga aos dois trapézios (bate exatamente com o topo do `lower`, sem descontinuidade); `lower` vai da origem até `-0,15`, afunilando de 0,105 até 0,085 (base do `chest`, de onde parte o cilindro).
- Cilindro achatado `chest`↔`spine`: `CYLINDER_JOINTS` (antes só os ossos do polegar) ganhou `chest` — o osso `spine→chest` agora renderiza como `CylinderGeometry` (não mais o perfil torneado orgânico). `Bone` ganhou uma prop `depthRatio` (achata no Z do próprio segmento) — só é geometricamente correta para ossos verticais sem componente X/Z no offset (é o caso de todo conector de tronco, confirmado lendo os offsets do `skeleton.ts`), porque nesse caso o quaternion do osso fica na identidade e Z local = Z do mundo.
- Conector `root`→`spine` mais largo: `TORSO_BONE_RADIUS` (uma constante `Record<string, number>`) virou `TORSO_CONNECTORS` (`Record<string, {radius, depthRatio?}>`), com uma entrada nova `spine: {radius: 0.1}` — antes só existia `chest: {radius: 0.085}` (do #17), então esse conector específico nunca tinha sido alargado.

**Validação:** suíte completa em 393 testes (só 1 novo, o do polegar — a remodelagem do tronco reaproveitou a cobertura estrutural já existente de `Figure.test.tsx`, que continuou passando sem alteração), todos verdes; `tsc -b`, `eslint .` e `npm run build` continuam limpos. Validado visualmente no navegador: polegares das duas mãos apontando para a frente na T-pose; `chest` com silhueta em dois degraus visíveis (ombros largos → afunila → afunila mais), sem abertura no topo; transição `chest`→cilindro→`spine`→`root` contínua, sem trecho fino "palito" em nenhum ponto. Sem erros no console.

**Motivo:** o polegar exigiu voltar à investigação numérica porque a métrica original (normal abstrata do pulso) não era um proxy confiável para "onde o polegar aponta de verdade" — outra confirmação de que medir a posição real da junta, não uma aproximação geométrica plausível, é o que evita esse tipo de bug (mesma lição já registrada em #13/#14/#15). O tronco seguiu o desenho de referência do usuário à risca, sem decisões de design próprias a justificar.

---

## 21. Novo modelo visual "manequim de madeira" — `skeleton2.ts`/`Figure2.tsx` substitui `skeleton.ts`/`Figure.tsx` como renderer ativo

**Contexto:** o usuário trocou o renderer do boneco no `Viewport.tsx` para um novo par de arquivos, `src/figure/skeleton2.ts` e `src/figure/Figure2.tsx`, que reproduzem visualmente um manequim articulado de madeira (referência: foto de 3 vistas costas/lado/frente da revista Animax) — cabeça em ovo liso, pescoço em carretel torneado, tronco em blocos entalhados (peito, bola da cintura, pelve), membros torneados com leve entasis unidos por bolas de junta expostas, mãos em lâmina chata afunilada e pés em cunha com bloco de dedos. Pedido para registrar a troca em `DECISOES.md`/`PLANO.md` e confirmar que as funcionalidades continuam OK.

**Decisão de arquitetura (já implementada, aqui só documentada):** `skeleton2.ts` **não redefine a cinemática** — reexporta `skeleton.ts` inteiro (`export * from './skeleton'`) e só adiciona uma camada de dados puramente visual: `JOINT_PARTS` (peças renderizadas na origem de cada uma das 32 juntas — lathe/ellipsoid/box) e `BONE_STYLES` (perfil do osso pai→filho — torneado/lâmina/oculto), indexados pelo mesmo nome de junta usado em `skeleton.ts`. Isso garante por construção que distâncias entre juntas, hierarquia, limites de rotação e toda a lógica de pose/IK/undo permanecem idênticos ao modelo anterior — só a malha desenhada em cada junta muda. `Figure2.tsx` espelha a estrutura de `Figure.tsx` (mesmos nomes de mesh `joint-*`/`segment-*`, mesma API de seleção/emissivo/refs de junta/sombra), lendo de `getJointParts`/`getBoneStyle` em vez de tabelas hardcoded por nome de junta. `Viewport.tsx` faz a troca com uma única linha (`import { Figure2 as Figure } from '../figure/Figure2'`), com o import antigo comentado ao lado para reverter facilmente se necessário.

**Validação (feita nesta sessão, já que a implementação veio de uma sessão anterior cuja transcrição foi compactada):**
- Suíte completa: **426 testes, todos verdes** (`skeleton2.test.ts` cobre reexport idêntico de `skeleton.ts`, cobertura completa de `JOINT_PARTS`/`BONE_STYLES` sem chaves faltando/sobrando, validade geométrica dos perfis, simetria L/R e ancoragem no mundo na pose de descanso — ex.: topo do ovo da cabeça fecha em 1,70 m, sola dos pés em Y≈0; `Figure2.test.tsx` cobre hierarquia de grupos, aplicação de pose/rotação, pintura por cor do boneco, geometrias específicas — cabeça lathe, tronco em blocos, membros torneados, mão em lâmina, ossos ocultos não renderizados —, olhos sempre pretos, seleção/destaque emissivo e registro de refs de junta).
- `tsc -b`, `eslint .` e `npm run build` limpos.
- Validado visualmente no navegador (`vite preview`, bundle conferido pelo hash do arquivo servido): boneco criado já nasce em T-pose com a nova geometria — cabeça em ovo com olhos/nariz/orelhas, bolas de junta visíveis em ombro/cotovelo/punho/quadril/joelho/tornozelo, tronco em blocos com a bola da cintura entre peito e pelve, mãos em lâmina, pés em cunha com bloco de dedos separado. Confirmado que a troca de renderer não quebrou nenhuma funcionalidade que depende da árvore de juntas: seleção de junta por clique (destaque emissivo cobre a peça certa, ex. cabeça inteira), combo box de seleção de junta com optgroups, botões de pose predefinida (`Em pé`/`T-pose`/`Sentado`/`Andando`/`Correndo` alternados e re-renderizados corretamente), gizmo de posição/rotação da raiz. Sem erros no console após reload (só avisos de depreciação do THREE.js pré-existentes, não relacionados a esta mudança).

**Motivo:** como `skeleton2.ts` é uma reexportação estrita da cinemática de `skeleton.ts` (não uma cópia), toda a correção numérica já documentada nas entradas #13/#14/#20 (sinais de eixo, T-pose com polegar para a frente) vale automaticamente para o novo renderer, sem precisar refazer a investigação — só a malha visual em cada junta mudou, não a matemática que define onde cada junta fica no mundo.

---

## 22. Revisão das mãos — torção neutra do antebraço (não só na T-pose), bug real no lado R, e pino de latão marcando o dorso da mão

**Contexto:** o usuário reportou que os dedos "aparentam estar errados" e pediu para: (1) considerar que, ao baixar o braço da T-pose para a posição normal, a mão não deve se mexer — só o ombro —, com a palma virada para baixo na T-pose e paralela à lateral da coxa quando abaixado; (2) colocar limites para os dedos não virarem para trás; (3) adicionar algo visual para identificar as costas da mão.

**Investigação (item 1 — não deduzida, numérica):** o #19/#20 tratavam `elbow.*.y` (torção de pronação/supinação) como um valor exclusivo da T-pose (`45`/`-45`), com a pose "em pé" usando `elbow.y=0` — ou seja, a mão "pulava" de torção ao alternar entre as duas poses, o que o usuário identificou corretamente como errado. Reproduzindo com `buildJointFrames` e medindo o PLANO real da mão (produto vetorial `wrist`→`fingersBase` × `wrist`→`thumb1` — mais completo que só checar a posição do polegar, ver adiante) em vez de só a posição do polegar: como o antebraço abaixo do ombro forma um corpo rígido sem torção própria entre as juntas intermediárias, abduzir o ombro (`shoulder.z`) gira esse corpo rígido inteiro em torno de um único eixo — então a MESMA torção do antebraço que deixa a palma para baixo na T-pose (braço horizontal) também deixa a palma virada para a coxa quando o braço está abaixado. Confirmado numericamente para o lado L: `elbow.L.y=45` dá a normal do plano da mão em `(-0.997,-0.061,-0.037)` (quase puro -X, lateral) com o braço abaixado, e em `(0.061,-0.997,-0.037)` (quase puro -Y, para baixo) na T-pose — os MESMOS 45°.

**Bug real encontrado no lado R (não um espelho de sinal):** repetindo a mesma varredura para R, `elbow.R.y=-45` (o espelho ingênuo de `45`) dá normal `(0.061,0.997,0.037)` na T-pose — **para CIMA, não para baixo** — um bug real que a métrica antiga (só checar `thumb1.z > wrist.z`, do #20) não pegava, porque aprovava por acidente um valor cuja palma não ficava para baixo. Variando `elbow.R.y` de -180° a 180° (não assumido por simetria), o valor que de fato deixa a normal em `(0.061,-0.997,-0.037)` é `elbow.R.y=135`, não `-45` — uma diferença de 180°, não só de sinal, consequência de `shoulder.R.z` usar sinal oposto de `shoulder.L.z` na T-pose combinado com a assimetria do offset bruto de `thumb1`/`fingersBase` (só a posição X é espelhada entre os lados, não a lógica de rotação — o produto vetorial da normal, sendo um pseudovetor, não espelha como um vetor comum ao negar X). Efeito colateral aceito: nessa mesma varredura, "palma para baixo" e "polegar para a frente" nunca acontecem ao mesmo tempo para R com uma torção só nesse eixo (são inversamente correlacionados) — com `elbow.R.y=135` o polegar de R fica ligeiramente para trás (desvio pequeno, mesma ordem de grandeza do desvio "para a frente" do lado L, só com o sinal trocado). Palma para baixo foi priorizada por ser o pedido explícito do usuário.

**Decisão (item 1):** `posePresets.ts` ganhou `NEUTRAL_ELBOW_TWIST = { 'elbow.L': 45, 'elbow.R': 135 }`, aplicado por `resolvePosePreset` como default em QUALQUER preset que não declare `elbow.*.y` explicitamente (antes só a `tpose` declarava). `standing` deixa de ser "todo eixo em zero" (só `elbow.*.y` foge disso agora); `tpose` não precisa mais declarar `elbow.*.y` — herda o mesmo default de `standing`, tornando as duas poses idênticas exceto por `shoulder.{L,R}`, exatamente o pedido do usuário. `walking`/`running`/`sitting` também passam a herdar essa torção neutra (antes resetavam para `elbow.y=0` sem querer, já que não declaravam o eixo). `skeleton.ts`: limite de `elbow.*.y` alargado de ±90 para ±150 (necessário para `135`).

**Item 2 (limites dos dedos):** investigado e já correto — `fingersBase`/`fingersMid`/`fingersTip` já tinham `limits.x: {min:0, max:...}` desde o #16 (não permitem valor negativo/"para trás"). O que fazia os dedos "aparecerem errados" era a mão inteira estar na orientação errada (item 1), não os limites em si — confirmado visualmente após a correção do item 1 (dedos dobrando visivelmente para dentro da palma, sem trecho "para trás"). Nenhuma mudança de limite foi necessária.

**Item 3 (marcador visual das costas da mão):** novo pino elipsoidal pequeno (`HAND_BACK_MARKER_L`/`_R` em `skeleton2.ts`, cor de latão fixa `#b08d3e` independente da cor do boneco — mesmo mecanismo dos olhos pretos) adicionado como segunda peça de `wrist.L`/`wrist.R`. Posição calculada numericamente: lado OPOSTO da normal do plano da mão (produto vetorial `wrist`→`fingersBase` × `wrist`→`thumb1`) na pose de descanso SEM torção (`elbow.y=0`), escalado para ~0,028m — por estar na malha da própria junta `wrist`, o pino acompanha qualquer torção/pose aplicada depois, sempre no dorso. L e R usam offsets diferentes (não espelho de sinal em X, mesma assimetria do item 1 — confirmado com teste de regressão dedicado).

**Validação:** suíte completa em 432 testes, todos verdes (`posePresets.test.ts`: nova trava usando a normal do plano da mão para os dois lados, substituindo os testes antigos baseados só na posição do polegar; `skeleton2.test.ts`: nova trava confirmando que o marcador fica do lado oposto da palma; `Figure2.test.tsx`: nova trava confirmando a cor fixa do marcador; `PropertiesPanel.test.tsx`: limite do slider Y do cotovelo atualizado para ±150); `tsc -b`, `eslint .` e `npm run build` continuam limpos. Validado visualmente no navegador (bundle conferido pelo hash do build): T-pose e "em pé" alternados sem "pulo" na mão; vista de cima confirma o pino de latão visível nas costas das duas mãos; dedos dobrando corretamente para dentro da palma ao posar `fingersBase.*`. Sem erros no console.

**Motivo:** a lição central é a mesma do #13/#14/#20 — métricas proxy (normal abstrata do pulso, ou só a posição do polegar) já aprovaram valores errados nesta base de código mais de uma vez; medir a geometria real e completa (aqui, o plano inteiro da mão via produto vetorial, não só um ponto) é o que evita repetir o erro. O bug do lado R especificamente só apareceu porque a varredura desta vez cobriu R de forma independente, em vez de assumir que o espelho de sinal do L funcionaria — outra confirmação de não generalizar por simetria sem checar.

---

## 23. Correção do #22 — o "conflito" do braço R era um bug de quiralidade na própria verificação, não um limite real do esqueleto; `elbow.R.y=135` revertido para o espelho simples `-45`

**Contexto:** o usuário testou o braço direito do #22 e reportou o polegar visualmente para trás, pedindo para "arrumar o braço direito" e "lembrar da decisão de usar ângulos espelhados" — sinalizando que a virada para `elbow.R.y=135` (não-espelhada) estava errada.

**Primeira tentativa (equivocada, revertida antes de ir ao ar):** reproduzi a varredura do #22 e voltei a confirmar que, variando só `elbow.R.y`, "palma para baixo" e "polegar para a frente" nunca batem juntos no lado R — então tentei uma segunda torção (`shoulder.R.y=120`, além de `elbow.R.y=135`) para resolver os dois ao mesmo tempo. **Essa combinação tem um defeito real, pego ANTES de publicar**: `shoulder.R.y` só deixa o braço "torcendo no próprio eixo" quando `shoulder.z=0`; combinado com `shoulder.z=-90` (T-pose), a composição de Euler NÃO comuta como eu assumi — `elbow.R` relativo a `shoulder.R` deixava de ser `(-0.32, 0, 0)` (horizontal) e passava a ter uma componente Z de 0,28, ou seja, o BRAÇO INTEIRO saía entortado para a frente, não só a mão. Confirmado numericamente com `buildJointFrames` medindo a posição relativa de `elbow.R`/`wrist.R`, e visualmente no navegador (o braço direito aparecia visivelmente dobrado, diferente do esquerdo). Descartado antes de qualquer commit visível ao usuário.

**Pergunta ao usuário:** diante do "conflito" (que parecia real: nenhuma combinação de `elbow.y` + punho, sem entortar o braço, batia os dois critérios ao mesmo tempo), perguntei qual prioridade o usuário preferia (palma para baixo com polegar levemente para trás; ângulo espelhado com palma para cima; ou mudar a geometria da mão). **A resposta do usuário foi rejeitar a pergunta e redirecionar**: "Considerar que o T-pose é um estado inicial onde não houve nenhum movimento no boneco. Assim, revisar todas as transformações que ocorreram para iniciarem zeradas a partir dessa posição." — uma tentativa de resolver o problema tornando a T-pose (não a pose "em pé") a referência-zero do esqueleto.

**Investigação dessa proposta, e a descoberta real:** ao tentar reconstruir a geometria da mão do zero para a T-pose ser a referência (mão R deveria apontar "para fora" ao longo do braço, com produto vetorial `dedos × polegar` = `(0,-1,0)`, igual ao L), a álgebra mostrou que, com os dedos apontando "para fora" (-X para R), NENHUM valor de polegar dá `(0,-1,0)` com `cross(dedos, polegar)` E `polegar.z > 0` (para a frente) ao mesmo tempo — o mesmo "conflito" reaparecia, agora na forma de equações, não de uma varredura de ângulo. Isso indicava que o "conflito" não dependia de qual pose é a referência — **era estrutural na própria métrica de verificação**. A causa: `cross(dedos, polegar)` é um produto vetorial (pseudovetor) — para dar "para fora da palma" ele precisa da ORDEM CERTA dos operandos, e essa ordem se INVERTE entre mão esquerda e direita (quiralidade: a mão direita é a imagem espelhada da esquerda, e um pseudovetor não respeita reflexão como um vetor de posição comum). Eu estava usando `cross(dedos, polegar)` (mesma ordem) para os dois lados e comparando os sinais — um erro de método que faz os dois lados parecerem em conflito quando não estão.

**Confirmação numérica:** usando `cross(polegar, dedos)` (ordem invertida) só no lado R, o valor `elbow.R.y=-45` — o espelho simples e ingênuo de `elbow.L.y=45`, exatamente o que o usuário pedia para lembrar — já dá `normal ≈ (-0.061, -0.997, -0.037)` na T-pose (palma para baixo, tão boa quanto o L) E `thumbFwd ≈ +0.0495` (polegar para a frente, idêntico ao L) — os dois critérios batem PERFEITAMENTE, nos dois lados, com o espelho de sinal simples. Confirmado também que `elbow.R.y=135` (o valor do #22), sob essa métrica corrigida, dá `normal.y=+0.997` (palma para CIMA) e `thumbFwd=-0.0495` (polegar para trás) — ou seja, a "correção" do #22 estava DUPLAMENTE errada, e o `-45` original (antes do #22) sempre esteve certo.

**Decisão:** revertido tudo do #22 relacionado à torção do braço R:
- `posePresets.ts`: `NEUTRAL_ELBOW_TWIST` volta a `{ 'elbow.L': 45, 'elbow.R': -45 }` (espelho simples); preset `tpose` volta a só declarar `shoulder.L`/`shoulder.R` (sem `elbow.R`/`shoulder.R.y` extras).
- `skeleton.ts`: limites de `elbow.*.y` e `shoulder.*.y` revertidos de ±150 para ±90 (a faixa alargada não é mais necessária).
- **Bug adicional encontrado e corrigido:** o pino de latão do #22 (`HAND_BACK_MARKER_R`) tinha sido posicionado com a MESMA métrica de quiralidade errada — ficava do lado da PALMA, não do dorso, no lado R. Corrigido negando o offset (`[0.019017,-0.001707,-0.02048]` → `[-0.019017,0.001707,0.02048]`), confirmado com `buildJointFrames` (produto escalar com a normal corrigida ≈ +1,0, antes era -1,0 — exatamente invertido).
- Testes atualizados para usar `cross(dedos, polegar)` no lado L e `cross(polegar, dedos)` no lado R (ordem invertida), documentando a quiralidade explicitamente em vez de assumir a mesma fórmula para os dois lados.

**Validação:** suíte completa em 432 testes, todos verdes; `tsc -b`, `eslint .` e `npm run build` continuam limpos. Validado visualmente no navegador (bundle conferido pelo hash do build): vista de topo confirma os dois braços perfeitamente retos e simétricos na T-pose (sem o entortamento do `shoulder.R.y` descartado); polegares para a frente nos dois lados; pose "em pé" com braços simétricos ao lado do corpo. Sem erros no console.

**Motivo:** o usuário estava certo desde a primeira mensagem — o espelho de sinal simples (`elbow.R.y=-45`) sempre foi a resposta certa; o "conflito" que motivou o #22 era um artefato de uma verificação que não levava a quiralidade em conta, não uma limitação real da geometria. A insistência do usuário em "lembrar a decisão de ângulos espelhados" foi o que levou a reexaminar a própria métrica em vez de aceitar o resultado dela — a mesma lição do #13/#14/#20/#22 (não confiar em proxy sem checar), agora aplicada à ferramenta de verificação em si, não só aos valores de pose.

---

## 24. Palma exatamente paralela ao chão na T-pose — ajuste na modelagem (offsets de `thumb1`/`fingersBase`), não na pose

**Contexto:** o usuário pediu, na T-pose (chamou de "A-pose" numa mensagem, esclarecido depois como sendo a T-pose mesmo), para girar os punhos até a palma ficar EXATAMENTE paralela ao plano horizontal — a normal do #23 chegava perto (`(0.061,-0.997,-0.037)`), mas não exatamente `(0,-1,0)`.

**Investigação (punho, descartada):** varredura 2D de `wrist.*.x`/`wrist.*.z` (as duas únicas rotações do punho) mostrou que o melhor resultado possível só reduz a inclinação de ~4,1° para ~2,1° (`wrist.z≈∓5°`, espelhado) — não zera, porque o punho não tem eixo de torção (só flexão e desvio radial/ulnar), e a fonte do desvio é uma leve torção residual que só um terceiro eixo resolveria. Perguntei ao usuário se preferia essa melhoria parcial ou adicionar um eixo de torção ao punho; a resposta foi **"ajustar na modelagem do boneco, não nos valores e ângulos de ajuste"** — ou seja, corrigir os offsets brutos de `skeleton.ts`, não a pose nem adicionar graus de liberdade novos.

**Investigação (modelagem, bem-sucedida):** o resíduo vinha de DOIS offsets brutos, não só do polegar — `fingersBase.*` também tem uma pequena componente fora do plano horizontal (medido: Y≈0,059 na T-pose, quando deveria ser 0 para os dedos ficarem num plano perfeitamente horizontal). Corrigido em duas etapas, com `buildJointFrames` (não estimado):
1. **Achatar `fingersBase`:** projetei a direção real de `fingersBase` (na T-pose, com `elbow.y=45/-45`) no plano horizontal (zerando a componente Y) e recalculei o offset bruto correspondente (mesmo comprimento, direção ligeiramente ajustada) via a rotação inversa do quaternion mundial do `wrist` naquela pose.
2. **Resolver `thumb1` exatamente:** com `fingersBase` já achatado, o produto vetorial `fingersBase`→`thumb1` só dá exatamente `(0,-1,0)` para um subconjunto de direções de `thumb1` (a solução geral de `cross(f,t)=alvo` é uma família de 1 parâmetro, `t = t_perpendicular + s·f`); escolhi o `s` mais próximo da direção atual do polegar (menor mudança visual) e recalculei o offset bruto pela mesma técnica.

**Resultado (verificado numericamente, não só medido):** com os novos offsets, a normal da mão dá **exatamente** `(0,-1,0)` na T-pose (erro `<1e-7`) — E, pela MESMA rotação rígida já estabelecida no #22 (abduzir o ombro gira a mão inteira sem alterar sua torção interna), a pose "em pé" (mesmos offsets, `shoulder.z=0`) também dá **exatamente** `(∓1,0,0)` (lateral puro). Um único ajuste de modelagem resolve as duas poses ao mesmo tempo, sem precisar de rotação de punho nem torção extra — a raiz do problema nunca foi a pose, era a forma bruta da mão ter uma leve torção residual.

**Decisão:** `skeleton.ts` — offsets ajustados (mesmo comprimento do vetor original, só a direção):
- `thumb1.L`: `[-0.035,-0.03,0.035]` → `[-0.036718,-0.025565,0.036718]`
- `thumb1.R`: `[0.035,-0.03,0.035]` → `[0.036718,-0.025565,0.036718]` (resolvido independentemente para R, respeitando a quiralidade — não é o espelho ingênuo de L)
- `fingersBase.L`: `[0,-0.06,0.005]` → `[-0.002504,-0.060104,0.002504]`
- `fingersBase.R`: `[0,-0.06,0.005]` → `[0.002504,-0.060104,0.002504]`
- `thumb2.*`/`fingersMid.*`/`fingersTip.*` não mudaram — seus offsets são relativos ao próprio pai (`thumb1`/`fingersBase`), que continua sem rotação própria por padrão, então a cadeia inteira acompanha o ajuste do pai automaticamente.

**Validação:** suíte completa em 432 testes, todos verdes SEM nenhuma mudança de teste necessária de início (as travas antigas usavam limiares como `>0,9`, que continuam batendo com os novos valores exatos) — apertei mesmo assim os dois testes de plano da mão (`posePresets.test.ts`) para `toBeCloseTo(..., 5)` em vez de limiar, travando a exatidão nova como regressão. `tsc -b`, `eslint .` e `npm run build` continuam limpos. Validado visualmente no navegador (bundle conferido pelo hash do build): vista de frente na T-pose mostra as duas mãos com o perfil fino e achatado esperado de uma palma perfeitamente horizontal, sem inclinação visível. Sem erros no console.

**Motivo:** o pedido do usuário — corrigir na modelagem, não na pose — era a escolha certa: o desvio de ~4° não era causado por nenhuma rotação de junta, e sim por uma imprecisão nos offsets brutos originais (prováveis valores "chutados" nas fases iniciais do projeto, antes de qualquer verificação numérica rigorosa). Consertar a fonte (a forma da mão) em vez de compensar com uma rotação a mais é mais robusto — funciona automaticamente em QUALQUER pose que use a torção neutra do #22/#23, não só a T-pose que motivou o pedido.

---

## 25. Remodelagem completa da mão — alinhada aos eixos locais do punho, torção neutra ±90°, proporções humanas

**Contexto:** o usuário pediu para refazer toda a geometria da mão (tudo de `wrist` para baixo) com proporções mais humanas, mantendo as 2 articulações do polegar e as 3 dos demais dedos em bloco, simplificando a malha se possível (ex.: juntar o nó com o dedo), e garantindo que a posição inicial tenha a palma para baixo e os polegares para a frente. Anexou uma captura mostrando os problemas: paralelepípedos dos nós "estranhos" (entortados), juntas dos dedos mal modeladas e a mão não aparentando a palma perfeitamente paralela ao chão. Referência visual: esquema em `maos.jpg` (palma em bloco, 3 falanges em blocos decrescentes com elipses de articulação entre elas, polegar em 2 segmentos ovais).

**Investigação (causa raiz):** as POSIÇÕES das juntas estavam matematicamente corretas (o #24 garantia a normal do plano da mão exata), mas **a mão inteira estava modelada 45° fora dos eixos locais do punho** — herança do polegar diagonal da fase 2, compensado pela torção neutra `elbow.y=±45` (#22/#23) em vez de corrigido na origem. Três sintomas da mesma causa: (1) as caixas dos nós, alinhadas aos eixos locais, renderizavam giradas 45° em relação ao plano real da mão — o "paralelepípedo estranho" da captura; (2) os ossos em lâmina eram orientados por rotação mínima (`setFromUnitVectors`), que deixa o rolamento em torno do eixo do osso arbitrário — a lâmina da palma ficava "rolada" 45°, parecendo não apontar para o chão mesmo com as juntas exatas; (3) **os eixos de dobra também ficavam 45° tortos**: `fingersBase.x` (eixo X local) não coincidia com a fileira dos nós, então curvar os dedos os movia na diagonal (metade para a palma, metade para trás), não em direção à palma.

**Opções apresentadas ao usuário (via pergunta direta):** (a) correção completa — torção neutra ±45→±90 e mão remodelada alinhada aos eixos locais (recomendada); (b) só correção visual — contra-rotação de ∓45° em todas as peças, mantendo cinemática e poses intactas, mas com a dobra dos dedos continuando diagonal. O usuário escolheu (a), e confirmou proporções realistas (mão ≈ 0,108×altura ≈ 18,4 cm do punho à ponta, Drillis & Contini — mesma fonte do corpo, #15) em vez de manter os ~15,3 cm atuais.

**Por que ±90 (e não outro valor):** o eixo de dobra dos dedos é o X local do punho, que na pose em pé aponta para `R_y(twist)·(1,0,0)` no mundo — só coincide com a fileira dos nós (eixo Z do mundo, com a palma na coxa) quando `cos(twist)=0`, ou seja, twist=±90. Com esse neutro, a mão modelada alinhada aos eixos (dedos -Y, polegar ∓X, palma -Z local) cai EXATAMENTE na orientação natural por construção: palma na coxa em pé (normal (∓1,0,0) exata), palma para baixo com polegar para a frente na T-pose (normal (0,-1,0) exata) — sem nenhum valor resolvido numericamente, ao contrário do #24.

**Mudanças:**
- `skeleton.ts`: offsets da mão trocados por valores limpos no referencial alinhado — `fingersBase/Mid/Tip` puros em -Y (`[0,-0.085,0]`/`[0,-0.043,0]`/`[0,-0.027,0]`, iguais nos dois lados), `thumb1` `[∓0.038,-0.026,0]`, `thumb2` `[∓0.034,-0.01,0]` (espelho ingênuo de X voltou a ser correto — não há mais componente quiral fora do plano). `elbow.y` de ±90 para `[0,180]` (L) / `[-180,0]` (R): faixa centrada no novo neutro ±90, mantendo ±90° de pronação/supinação para cada lado. `thumb2` trocou o DOF de X (que viraria só torção com o polegar ao longo de ∓X) para **Y** (`[-80,0]` L / `[0,80]` R, espelhado — a dobra real da ponta em direção à palma). `thumb1` manteve x/z (z segue sendo adução em direção aos dedos; x vira a componente distal para a palma).
- `posePresets.ts`: `NEUTRAL_ELBOW_TWIST` de `{L:45, R:-45}` para `{L:90, R:-90}`.
- `skeleton2.ts`: seção da mão reescrita — caixas dos nós substituídas por **elipses de dobradiça** (elipsoides alongados no eixo X local, que agora É o eixo de dobra — as elipses vermelhas do esquema `maos.jpg`), lâminas recalibradas (palma 0,056→0,080 de largura, espessura 0,026; falanges afunilando 0,078→0,064), ponta dos dedos e do polegar em lathe arredondado, polegar torneado em 2 segmentos. O pino de latão do dorso virou **um único offset para os dois lados** (`[0,-0.045,0.0155]` — dorso é +Z local em ambos, some a assimetria quiral do #23). Única peça quiral restante: a ponta do polegar (`thumbTip`, rotação Z ∓74° espelhada).
- `Figure2.tsx`: **nenhuma mudança** — com os ossos dos dedos em -Y puro, o caso antiparalelo do `setFromUnitVectors` do Three.js gira exatamente 180° em torno de Z (verificado numericamente com o three real, não assumido), mantendo a largura da lâmina em X e a espessura em Z — orientação determinística sem rolamento arbitrário.
- Testes: `jointSignConvention.test.ts` ganhou 3 travas novas (dedos curvam exatamente para -Z sem componente lateral; punho flexiona para a palma; polegar aduz no plano da palma); `skeleton2.test.ts` teve os testes de simetria/marcador reescritos (marcador idêntico nos dois lados; exceção de quiralidade agora é a ponta do polegar); `posePresets.test.ts`/`figuresStore.test.ts`/`PropertiesPanel.test.tsx` atualizados para a torção 90 e a faixa `[0,180]`. Os testes de plano da mão do #24 (exatidão `toBeCloseTo(...,5)`) passaram SEM alteração — a exatidão foi preservada por construção.

**Efeitos colaterais aceitos (mesmo precedente do #13 — projeto pessoal, sem cenas de produção):** poses salvas com `thumb2.x` são zeradas ao recarregar (o eixo deixou de ser DOF); poses salvas com `elbow.y` antigo (ex.: 45) passam a exibir a mão com 45° de torção a menos que antes.

**Validação:** suíte completa em 435 testes, todos verdes; `tsc -b`, `eslint .` e `npm run build` limpos. Validação visual no navegador real (Chrome headless via Playwright, contra o `vite dev` — a extensão do Chrome não estava disponível nesta sessão): T-pose com a mão em lâmina fina perfeitamente horizontal vista de frente, polegares para a frente nos dois lados na vista de topo, pino de latão visível no dorso, e — o teste-chave da mudança — curvar `fingersBase.L`/`fingersMid.L` pelos sliders faz os dedos descerem RETO em direção à palma (na vista de topo eles somem além da linha dos nós, sem varrer para trás; na frontal formam um gancho para baixo). Sem erros no console.

**Motivo:** mesma filosofia do #24 levada até o fim — o #24 corrigiu os NÚMEROS dos offsets mas manteve a mão diagonal; a diagonal era a verdadeira causa raiz de todos os sintomas relatados (visual E de articulação). Alinhar a modelagem aos eixos elimina a classe inteira de problemas de uma vez: orientação exata por construção, eixos de dobra anatômicos, espelhamento L/R simples de novo, e dados legíveis (offsets com um único componente não-nulo por eixo) em vez de valores resolvidos numericamente.

---

## 26. Braços mais curtos, ombros mais próximos do tronco e chest mais baixo — confirmados pela antropometria antes de aplicar

**Contexto:** o usuário pediu 3 ajustes ("braços parecem muito compridos", "juntas shoulder muito afastadas do tronco", "chest mais para baixo"), pedindo explicitamente para **confirmar antes se fazem sentido do ponto de vista da fisionomia**.

**Verificação (numérica, contra Drillis & Contini — mesma fonte do #15 — mais a envergadura empírica ≈1,04×altura):** os três pedidos se confirmaram:

| Medida | Modelo (antes) | Referência (1,70 m) |
|---|---|---|
| Altura do cotovelo | 1,02 m | 0,630H = 1,07 m |
| Altura do punho | 0,76 m | 0,485H = 0,82 m |
| Ponta dos dedos em pé | 0,58 m | 0,377H = 0,64 m |
| Distância entre juntas dos ombros | 0,48 m | ~0,23H ≈ 0,39 m |
| Envergadura | 2,01 m | ~1,04H ≈ 1,77 m |
| Base do bloco do peito | 1,25 m (0,735H) | borda costal ~0,70H ≈ 1,19 m |

**Diagnóstico do braço (por que o #15 tinha dado "braços OK"):** o #15 validou os COMPRIMENTOS de segmento (0,186H/0,146H, medidos do acrômio) quando a junta do ombro do modelo ficava mais alta; depois das mudanças de tronco (#16/#18) ela assentou em 1,34 m e os braços nunca foram re-ancorados nas ALTURAS reais dos marcos — o mesmo comprimento pendurado de um pivô mais baixo põe cotovelo/punho/dedos ~5-6,5 cm abaixo do real (mãos quase no joelho). A distância entre ombros tinha um erro independente: 0,48 m corresponde à largura biacromial + o braço medido DO acrômio — mas os centros articulares reais ficam ~3 cm mediais ao acrômio (≈0,39 m entre si); usar os dois valores "de borda" ao mesmo tempo dupla-conta a largura (por isso a envergadura estourava em 24 cm).

**Decisão (confirmada pelo usuário via pergunta direta, com os valores propostos):**
- `skeleton.ts`: úmero (`shoulder→elbow`) 0,32→**0,27**; antebraço (`elbow→wrist`) 0,26→**0,245**; offset X de `shoulder.L/R` 0,14→**0,095** (junta a ±0,195 do centro com a clavícula). Resultado verificado: cotovelo 1,07 ✓, punho 0,825 ✓, ponta dos dedos 0,642 = 0,377H exato ✓, envergadura 1,79 ≈ 1,05H ✓. A mão do #25 (0,183 m) não mudou.
- Para o chest, apresentadas 2 implementações (esticar só a base para baixo, mantendo a linha dos ombros do bloco — que está correta em 0,82H — vs. descer o bloco inteiro); o usuário escolheu **esticar a base**: `CHEST_PROFILE` (skeleton2.ts) desce de -0,06 para **-0,115** (base em ~1,195 m ≈ 0,70H). Meio-termo consciente com o bug do #17 (base em -0,20 varria um arco visível na flexão máxima): com -0,115 o arco a +25° é ~5 cm, coberto pelo cone do abdômen (`BONE_STYLES.chest`), alargado junto (topo 0,10→0,104, ainda contido no bloco em largura e profundidade). Nenhuma junta mudou para o item 3 — só geometria visual.

**Validação:** suíte completa em 435 testes, todos verdes (únicas mudanças de teste: comprimento do úmero em `Figure2.test.tsx` 0,32→0,27 e um comentário de alcance em `ikSolver.test.ts` — os testes de IK usam alvos RELATIVOS às juntas, então nenhum alvo precisou mudar); `tsc -b`, `eslint .` e `npm run build` limpos. Validado visualmente no navegador real (Chrome headless via Playwright): T-pose com braços proporcionais e bolas dos ombros encostadas no bloco do peito como deltoides; em pé, dedos terminando na altura da coxa (antes, perto do joelho); tronco lendo como caixa torácica + abdômen curto + pelve; na flexão máxima do tronco vista de lado, sem buraco nem borda solta na base estendida do bloco. Sem erros no console.

**Motivo:** os três pedidos eram percepções visuais corretas com causas mensuráveis — dois deles (braço, ombro) eram inclusive resquícios de calibrações antigas que as mudanças de tronco posteriores invalidaram sem re-verificação. A regra do projeto (medir contra referência antes de aplicar, #13/#14/#15) de novo transformou "parece comprido" em números concretos e numa correção ancorada em marcos anatômicos, não num ajuste a olho.

---

## 27. Revisão da ligação chest/upperChest → neck — pescoço visível engrossado (era "palito" de 0,39 da largura da cabeça)

**Contexto:** o usuário pediu para rever a proporção do tamanho da ligação entre `chest`/`upperChest` e o `neck`, ajustando se necessário.

**Revisão (números + visual, antes de mexer):**
- **Cinemática: correta, nada a ajustar.** chest 1,31 → upperChest 1,35 → neck 1,39 → head 1,55 (queixo do ovo ~1,485). Base do pescoço em 1,39 ✓ (0,818H) e queixo ✓ (~0,87H) — calibrações do #15/#16 continuam válidas.
- **Visual: desproporcional.** Das peças da ligação, o osso `chest→upperChest`, o elipsoide do `upperChest`, o osso `upperChest→neck` e a bola do `neck` ficam todos ENTERRADOS no topo do bloco do peito (que sobe até 1,416) — o único trecho visível é o osso `neck→head`, de ~1,416 até o queixo (~1,485), com raio 0,025-0,030. Diâmetro visível ~0,05-0,06 m contra uma cabeça de 0,154 m de largura: **razão 0,39**, quando o humano real fica em ~0,7 (pescoço ⌀ ~0,11 m) e manequins de madeira em ~0,55-0,65. Confirmado no navegador: um "palito" entre dois volumes largos — o mesmo padrão de defeito já corrigido no tronco (#16/#17).

**Decisão (ajuste necessário, aplicado):** engrossar a pilha inteira do pescoço em `skeleton2.ts`, mantendo o estilo carretel e SEM tocar em nenhuma junta:
- Osso `neck→head` (o pescoço visível): de `{0,030 / 0,025 / 0,028}` para `{t0: 0,047; t0,55: 0,038; t1: 0,034}` — diâmetro visível ~0,08-0,09 m ≈ 0,55 da largura da cabeça; base larga assentada na bola, cintura de carretel no meio, topo afinando para entrar no queixo do ovo (na altura em que o ovo já está mais largo que o pescoço, ~1,51 m).
- Bola do `neck`: de r 0,03 para `[0,05, 0,042, 0,05]` — o topo dela desponta do platô do bloco do peito como assento do carretel e cobre o pivô quando o pescoço flexiona (sem vão na flexão máxima de 50°).
- Osso `upperChest→neck` (enterrado): de `{0,032/0,030}` para `{0,046/0,048}` — nada fino aparece se o `upperChest` inclinar (±15°).
- `chest→upperChest` e o elipsoide do `upperChest` ficaram como estavam: são profundamente internos ao bloco (raio ≥0,118 naquela faixa) e giram junto com ele — nunca expostos.

**Validação:** suíte completa em 435 testes, todos verdes SEM nenhuma mudança de teste (os testes de `skeleton2` validam estrutura/validade dos perfis, não raios específicos do pescoço); `tsc -b`, `eslint .` e `npm run build` limpos. Validado visualmente no navegador real (Chrome headless via Playwright, antes/depois): de frente e de lado o pescoço agora lê como carretel encorpado proporcional à cabeça; com `neck.x=50` (flexão máxima) vista de lado, a ligação continua contínua — a bola alargada cobre o pivô, sem buraco no topo do bloco. Sem erros no console.

**Motivo:** mesma classe de defeito visual dos #16/#17 (peça de ligação fina demais entre volumes largos), só que no pescoço — e a mesma regra de sempre: medir a razão contra referência (0,39 vs 0,55-0,74) transforma "rever a proporção" numa correção objetiva, restrita à camada visual porque a cinemática já batia com a antropometria.

---

## 28. Verificação de cabeça e pernas — cabeça proporcional (sem ajuste); pernas re-ancoradas nos marcos (o offset do quadril "comia" 3 cm)

**Contexto:** o usuário pediu para verificar se o tamanho da cabeça e o comprimento das pernas/tornozelos estão proporcionais.

**Cabeça — proporcional, nenhum ajuste feito.** Medindo o ovo (`HEAD_EGG_PROFILE`, junta em 1,55 m) contra a referência para 1,70 m: altura queixo→topo 0,215 m vs 0,221 (0,130H) = −2,7%; largura 0,154 vs ~0,148 = +4%; profundidade 0,177 vs ~0,190 = −7%; razão "cabeças de altura" 7,9 (faixa adulta 7,5-7,7). Todos os desvios abaixo do limiar visual, e o topo do ovo fecha exatamente 1,70 m (já travado por teste em `skeleton2.test.ts`).

**Pernas — desproporção real (pequena), confirmada e corrigida.** Medições (antes):

| Marco | Modelo | Referência (1,70 m) | Δ |
|---|---|---|---|
| Junta do quadril | 0,87 m | 0,530H = 0,90 m | −3 cm |
| Joelho | 0,47 m | 0,285H = 0,485 m | −1,5 cm |
| Tornozelo | 0,07 m | 0,039H = 0,066 m | +0,4 cm ✓ |
| Coxa / canela | 0,40 m cada | 0,245H / 0,246H ≈ 0,417 m | −4% |

Causa: o `root` já está na altura certa do quadril (0,90 = 0,530H), mas os offsets de `hip.*` desciam mais 3 cm (`[±0.09,-0.03,0]`) — as juntas do quadril ficavam em 0,87 e esses 3 cm saíam do orçamento das pernas, deixando coxa/canela 4% curtas e o joelho 1,5 cm baixo. Isso é exatamente o "pernas ~4% curtas, não fui atrás por não ter sido pedido" já registrado no #15, agora com a causa identificada.

**Decisão (confirmada pelo usuário via pergunta direta):** `skeleton.ts` — `hip.L/R` y `-0.03`→**0** (juntas do quadril na altura do `root`, 0,90 ✓) e `knee`/`ankle` offsets `0.40`→**0,415** cada (joelho em 0,485 ✓). O tornozelo permanece em 0,07 m (vs 0,066 real): os 4 mm mantêm a sola do pé exatamente no chão, dentro da tolerância — `ankle`/`ball` e toda a geometria do pé ficaram intocados.

**Validação:** suíte completa em 435 testes, todos verdes SEM nenhuma mudança de teste (as travas de ancoragem — sola do pé em Y≈0, topo da cabeça em 1,70 — continuam passando por construção, já que só o meio da cadeia mudou); `tsc -b`, `eslint .` e `npm run build` limpos. Validado visualmente no navegador real (Chrome headless via Playwright): corpo inteiro de frente e de lado com pernas visivelmente mais longas e joelho na altura certa, pés apoiados no chão, transição pelve→coxa contínua. Efeito colateral visual aceito e documentado no comentário do `PELVIS_PROFILE`: as bolas `hip.*` subiram 3 cm e agora ficam embutidas no bloco da pelve (antes despontavam por baixo) — as coxas continuam emergindo sob o bloco, sem vão. Sem erros no console.

**Motivo:** mesma classe de achado do #26 (marco anatômico correto no `root`, mas um offset intermediário deslocando tudo abaixo dele) — e a mesma lição: verificar as ALTURAS dos marcos, não só os comprimentos dos segmentos, é o que revela esse tipo de erro. A verificação da cabeça, por outro lado, confirma que nem toda revisão precisa virar mudança: os números fecharam e o modelo ficou como estava.

## 29. Limites articulares customizáveis por workspace — `joint-limits.json` como camada por cima dos padrões do código

**Contexto:** o usuário pediu para avaliar onde os limites de movimentação de `skeleton.ts` são usados e permitir customizá-los via JSON gravado no workspace — os valores do código não podem mudar, o JSON recebe uma cópia dos padrões ao salvar e é lido ao abrir.

**Avaliação (onde os limites são consumidos):** todos os consumidores derivam de `JOINTS[].limits`, e há exatamente um ponto de imposição — `clampJointRotation` (usado pelo store, `posePresets`, `ikSolver` e pela validação ao carregar cena). Além dele: `getJointAxes` (a **presença** do eixo define os DOFs → sliders, gizmo e ciclo de eixo dos atalhos), `PropertiesPanel` (faixa dos sliders), `ikSolver` (o sinal dos limites do meio da cadeia decide o sentido da dobra: joelho dobra ao contrário do cotovelo) e `sceneSerialization` (grampeia poses ao ler `.glb`/autosave). Conclusão: basta uma camada efetiva por trás de `getJoint` para que a aplicação inteira obedeça ao JSON, sem tocar em nenhum valor do código.

**Inconsistências levantadas e levadas ao usuário antes de implementar:** (a) `root` está em `FREE_JOINTS` e ignora limites — customizá-lo não teria efeito; (b) presença do eixo = existência do DOF, então deixar o JSON acrescentar/remover eixos mudaria a UI, não só a faixa; (c) a convenção L/R do #14 (mesmo número, movimento oposto em Y/Z) é fácil de errar editando à mão e não dá para validar automaticamente.

**Decisões (todas confirmadas pelo usuário via pergunta direta):**

| Questão | Escolha | Consequência |
|---|---|---|
| Onde gravar | **Arquivo separado** `joint-limits.json`, apontado por `workspace.json` | dump de 31 juntas fica editável à mão sem inchar o manifesto; no fallback sem File System Access o usuário precisa selecioná-lo junto |
| O que pode mudar | **Só min/max de eixos existentes** | `getJointAxes` nunca muda: sliders/gizmo/atalhos e o IK ficam com a mesma forma; eixo desconhecido é ignorado |
| Pose fora da faixa nova | **Grampear** | mesmo comportamento que o app já tinha para valores fora de faixa ao carregar |
| Persistência | **Autosave + botão "Restaurar limites padrão"** | sobrevive ao recarregar a página; sem editor de limites na UI (a edição é no JSON) |

**Implementação:** `skeleton.ts` ganhou a camada de overrides (`sanitizeJointLimitOverrides`/`setJointLimitOverrides`/`resetJointLimitOverrides`/`getJointLimitOverrides`) — `JOINTS` e os valores do código permanecem intocados, e `getJoint` passou a devolver a definição **efetiva** (offset/hierarquia do código + limites customizados), com `getDefaultJointLimits` para quem precisa do padrão. Escolhido guardar o estado no próprio `skeleton.ts` em vez de um módulo novo para não criar ciclo de import (qualquer módulo de limites teria que ler `JOINTS` e ser lido por ele). `sanitize` descarta junta desconhecida/`root`, eixo que não é DOF, valor não numérico, `min > max` e o que for igual ao padrão (o resultado é só a diferença real — é isso que a UI usa para saber se há customização), e limita a faixa a ±360°. `persistence/jointLimitsFile.ts` monta/lê o arquivo (com um campo `leiame` embutido, já que JSON não aceita comentários e o arquivo existe para ser editado à mão); `workspaceFolder.ts` grava-o ao salvar e o aplica ao abrir; `figuresStore` mantém um espelho `jointLimits` (para entrar no autosave e re-renderizar os sliders) fora do `partialize` do undo.

**A ordem é o ponto crítico:** ao abrir um workspace, os limites são instalados **antes** de reconstruir as cenas — é na leitura das poses (`figureFromExtras`) que o clamp acontece, então uma pose fora da faixa nova só é corrigida se os limites já estiverem valendo. Vale igual no autosave (`loadWorkspaceFromLocalStorage`). Onde a cena de trabalho não passa por essa leitura (workspace sem cena ativa, ou o botão de restaurar), o próprio store reajusta as poses — preservando a identidade dos arrays quando nada muda, para não empilhar undo à toa.

**Efeitos colaterais aceitos e documentados:** (a) abrir uma pasta **sem** `joint-limits.json` volta aos padrões do código, em vez de herdar os limites do workspace aberto antes; (b) os limites são globais da aplicação (não por boneco nem por cena), então salvar um workspace enquanto outro está com limites customizados copia esses limites para o novo; (c) o `.glb` de uma cena isolada não carrega limites — eles são característica do modelo, não conteúdo de cena.

**Validação:** suíte em 472 testes (37 novos), todos verdes; `tsc -b`, `eslint .` e `npm run build` limpos. Validado no navegador real (Chrome headless): com `knee.L` limitado a 0-45 pelo workspace, o slider passa a ir até 45, a pose salva em 150° volta ajustada para 45°, o painel de Cenas mostra o aviso de customização e o botão "Restaurar limites padrão" devolve a faixa 0-150 sem recarregar a página. Sem erros no console.

**Motivo:** concentrar a customização atrás do único ponto de leitura que já existia (`getJoint`) manteve a mudança pequena e impossível de contornar — nenhum consumidor precisa saber que existe customização. Proibir a criação/remoção de DOF pelo JSON foi o que permitiu isso: como a lista de eixos não muda, nada na UI nem no IK precisa reagir à troca de limites além da faixa dos sliders.

## 30. Poses de mão, poses de corpo com colocação no chão e simetria esquerda/direita — e a correção de `clavicle.R.z`

**Contexto:** o usuário pediu (a) 4 poses de mão tratadas separadamente por lado — aberta, relaxada, fechada e thumbs-up; (b) 5 poses de corpo — deitado com as mãos atrás da cabeça, fetal (sentado abraçando os joelhos), luta, voo do Superman e modelo de revista; (c) copiar a pose de um lado espelhada para o outro e inverter os dois lados, lembrando do ângulo invertido documentado no #14.

**Investigação (feita ANTES de perguntar, para as perguntas serem concretas):**

1. **A regra do espelho é exata, não aproximada.** Rotação é pseudovetor: sob a reflexão sagital `M = diag(-1, 1, 1)`, a componente em X se preserva e as perpendiculares invertem. Para Euler XYZ fecha algebricamente — `M·Rx(a)Ry(b)Rz(c)·M = Rx(a)Ry(-b)Rz(-c)`, porque `M` comuta com `Rx` e conjuga `Ry`/`Rz` na rotação inversa. Confirmado numericamente montando a cinemática direta com uma pose arbitrária de um lado e o espelho do outro: **erro 0,000 m** em todas as juntas pareadas. Copiar sem negar Y/Z erra até **0,95 m**.

2. **`clavicle.R.z` era o único par do esqueleto cujos limites não eram espelho um do outro** (`[0, 20]` nos dois lados, em vez de `[-20, 0]` no R). Como o mesmo sinal produz o movimento anatômico oposto em Y/Z (#14), isso deixava a clavícula direita só ABAIXANDO enquanto a esquerda só levantava — e era exatamente o que quebrava o espelhamento (6 cm de erro na cadeia do braço quando `clavicle.z ≠ 0`).

3. **`applyPosePreset` nunca tocava em posição/rotação do boneco** — o que torna "deitado" e "fetal" impossíveis (e já deixava o "Sentado" existente flutuando no ar).

**Decisões (confirmadas pelo usuário via pergunta direta):**

| Questão | Escolha | Consequência |
|---|---|---|
| `clavicle.R.z` | **Corrigir para `[-20, 0]`** (espelho do L) | é a única alteração de limite do código; levantar o ombro direito passa a ser possível e o espelho fica exato |
| Presets e o chão | **Preset pode ajustar o root** | ganham rotação e altura do quadril; corrige o "Sentado" de quebra |
| Escopo do espelho | **Só juntas `.L`/`.R`** (sem preferência declarada; adotada a recomendação) | tronco, pescoço, cabeça e a rotação do boneco ficam intactos |
| UI | **Mão no contexto, simetria na raiz** | selecionar qualquer junta do braço revela as poses DAQUELA mão; espelhar/inverter ficam junto das poses de corpo |

**Implementação:** `poseMirror.ts` (regra do espelho, cópia de um lado e troca dos dois — a troca é involução, aplicar duas vezes devolve a original) e `handPresets.ts` (as 4 poses de mão, parciais: só as 5 juntas de polegar/dedos de um lado, **sem o punho**, para preservar o ângulo que o usuário já deu a ele). As duas mãos saem de uma tabela só: os valores são declarados na convenção do lado esquerdo e o direito é gerado por `mirrorRotation` — não há como um lado sair de sincronia com o outro. `posePresets.ts` ganhou `PosePresetPlacement` (rotação + altura do quadril, com o deslocamento vertical escalado pela altura do boneco) e o campo `hands`, que faz "punho fechado" ser o mesmo gesto quer venha de uma pose de corpo, quer do botão da mão. Poses simétricas usam o helper `symmetric()`, que também deriva o lado direito por reflexão.

**Quais poses de corpo usam qual mão (escolha do usuário, num segundo passo):** sentado e andando usam a mão **relaxada**; correndo, luta e Superman usam o **punho fechado**; deitado, fetal e modelo usam a relaxada. **"Em pé" e T-pose ficam com a mão aberta** — o usuário pediu explicitamente para não alterá-las, e faz sentido: são as poses de referência do esqueleto e a T-pose é como um boneco nasce, então qualquer curvatura de dedo ali viraria o novo "neutro" do modelo. O mapa completo está travado num teste, para não se perder num ajuste futuro.

**Os ângulos das poses novas foram RESOLVIDOS numericamente, não estimados:** uma busca em grade sobre os eixos livres de ombro/cotovelo minimizando a distância do punho a um alvo geométrico — atrás da cabeça, em volta da canela, na altura do rosto, na cintura. Os erros finais ficaram entre 2 e 3 cm. A trava de regressão são os próprios alvos, em `posePresets.test.ts`.

**A pelve reclinada é o que torna a pose fetal possível.** Com o quadril flexionado 115° em relação a uma pelve reta, a coxa mal passa da horizontal e o pé fura o chão: seriam necessários ~175° de flexão de joelho contra os 130 disponíveis. Reclinando a pelve 30° (`rotation.x = -30`, exatamente o que uma pessoa faz ao abraçar os joelhos), a coxa sobe de fato, o joelho fica 33 cm acima do quadril e a sola encosta no chão. O `hipHeightM` de cada pose foi resolvido pela mesma busca, e um teste percorre TODAS as juntas de TODOS os presets exigindo que nenhuma atravesse o chão.

**A direção que o boneco encara (giro em Y) é preservada nas poses que não inclinam.** Sem isso, clicar em "Andando" zeraria a orientação que o usuário deu ao boneco — regressão gratuita nas 5 poses que já existiam. Nas poses que inclinam (deitado/fetal/superman) a rotação é imposta inteira: misturar a inclinação com um giro prévio deixaria o boneco rolado sobre o próprio eixo em vez de deitado. X/Z (onde ele está no chão) nunca mudam.

**Validação:** suíte em 580 testes (108 novos), todos verdes; `tsc -b`, `eslint .` e `npm run build` limpos. Validado no Chrome real: as 5 poses novas conferem visualmente (deitado de costas com os cotovelos no chão, fetal com a sola apoiada, guarda de luta com as duas pontas de pé plantadas, Superman pairando de bruços, modelo com a mão na cintura e o cotovelo aberto); fechar a mão direita não altera a esquerda; e "Copiar direito → esquerdo" transforma uma pose assimétrica numa figura perfeitamente simétrica. Sem erros no console.

**Motivo:** derivar tudo o que é espelhável de uma única tabela (mão direita da esquerda, lado direito das poses simétricas do esquerdo, e o próprio comando de espelhar) faz da convenção do #14 uma propriedade verificada por teste em vez de uma regra a ser lembrada a cada valor digitado. Foi também o que expôs `clavicle.R.z`: a mesma checagem que valida o espelho valida os limites.

---

## 31. Fase 9 (refinamentos de UX e workspace) — quatro decisões confirmadas com o usuário e três detalhes técnicos que não eram óbvios

**Contexto:** a fase 9 juntava 13 itens de refinamento abertos mais um bug relatado. Três desses itens estavam marcados no próprio `PLANO.md` como "confirmar com o usuário antes de implementar", e um quarto (o escopo da fase) definia como o trabalho seria conduzido. Perguntei os quatro de uma vez, antes de escrever qualquer linha de código.

| Questão | Escolha do usuário | Consequência |
|---|---|---|
| Escopo | **Fase 9 inteira, bug primeiro** | bug → itens de UI → itens de viewport, numa sequência só |
| Boneco oculto (item 14) | **Totalmente inerte ao mouse** | clique/hover atravessam; ocultar o boneco selecionado limpa a seleção |
| Pivô do gizmo de rotação da raiz (item 13) | **Em torno do próprio root/quadril** | o alvo do gizmo é o grupo que já carrega `figure.rotation`; nenhuma compensação de posição |
| Painéis recolhíveis (item 8) | **Persistir em `localStorage`** | o layout volta como foi deixado ao reabrir o app |

### 31.1 O bug do boneco oculto era do sistema de eventos do R3F, não do `Raycaster`

**Investigação:** a hipótese registrada no plano era "o `Raycaster` não testa `visible`". Está correta, mas é só metade — e a metade que **não** resolve o caso. Lendo o código de `@react-three/fiber` (`events-*.esm.js`), o sistema de eventos não parte da raiz da cena: ele percorre `state.internal.interaction` (os objetos que têm handler de ponteiro registrado) e chama `raycaster.intersectObject(obj, true)` **em cada um deles**. Duas consequências:

1. Bloquear o raycast no grupo externo do boneco **não funcionaria** — o grupo pai nunca é consultado nesse caminho. (O three ≥ r152 até suporta interromper a recursão devolvendo `false` de `raycast`, confirmado lendo o `intersect()` em `three.core.js`; só que esse caminho não é o que o R3F usa para eventos.)
2. Por outro lado, **não registrar o handler** tira a peça da lista de objetos interativos por completo — clique e hover deixam de existir para ela, sem tocar em `raycast` nenhum.

**Decisão:** a correção é uma condição só, em `Figure2.tsx`: `onSelect` só é passado quando `figure.visible`. Sem prop nova, sem mexer em `raycast` (o que traria de volta o risco das duas cópias do pacote `three` no grafo de módulos — ver #4). O teste de regressão afirma o mecanismo real, não o sintoma: nenhuma malha do boneco oculto tem `__r3f.eventCount > 0`.

**Segunda metade da decisão do usuário:** ocultar o boneco **selecionado** limpa a seleção (`toggleVisibility` no `figuresStore`). Sem isso, sobraria um gizmo no viewport ancorado num corpo invisível, e daria para posar às cegas um boneco que não se vê. Mostrar de volta nunca mexe na seleção.

### 31.2 O gizmo de rotação da raiz precisa do grupo INTERNO — o oposto do gizmo de translação

O gizmo de translação da raiz foi corrigido na fase 3 para usar o grupo **externo** (`figure-<id>`), que é quem carrega `figure.position` (ver #7). Para a rotação vale exatamente o inverso: quem carrega `figure.rotation` de forma declarativa é o grupo **interno** (`joint-root`). Anexar o gizmo de rotação ao externo repetiria o bug do #7 pelo outro lado — o `TransformControls` giraria um grupo cuja rotação o React não controla, e o valor gravado seria reaplicado pelo grupo interno no render seguinte.

Como a chave `root` do callback `onJointRef` está reservada ao grupo externo desde o #7, o grupo interno passou a se registrar sob uma chave própria (`ROOT_PIVOT_REF_NAME = 'root:pivot'`), e o `Viewport` escolhe uma ou outra conforme o modo. Um teste de regressão trava que as duas chaves apontam para objetos **diferentes** — é essa distinção que impede a volta do #7.

O modo (mover/girar) vive no `uiStore`, fora do histórico de undo: é modo de ferramenta, como o toggle de IK, não conteúdo da cena.

### 31.3 Três decisões de arquitetura menores, tomadas por mim e registradas aqui

1. **Reset por junta usa a pose "Em pé" como referência, não zero cru.** Zerar todos os eixos parece o óbvio e está errado neste modelo: `elbow.*.y` tem torção neutra de ±90° (ver #25), então "zerar" o cotovelo torceria a mão para uma orientação que nenhuma pose usa. `resetJointRotation` lê o valor da junta em `resolvePosePreset('standing')` — é literalmente "aplicar o preset Em pé, mas só nesta junta". Para o `root`, zera só a rotação de colocação e preserva a posição.

2. **Preferências de layout ficam numa chave `localStorage` própria (`webposer:ui:v1`), separada do autosave do workspace.** Painel recolhido e régua ligada são preferências de quem está usando o app, não conteúdo da composição. Se entrassem no bloco do workspace, viajariam no `extras` do `.glb` e no `workspace.json` — poluindo um contrato de arquivo que o Blender também lê, sem nenhum ganho. Pela mesma razão a régua vertical **não** entrou em `environment` junto da grade, apesar da simetria aparente entre as duas.

3. **O autosave passou a devolver `boolean`.** `saveWorkspaceToLocalStorage` engolia silenciosamente qualquer falha de gravação (cota estourada, modo privado). Isso era aceitável enquanto nada era informado ao usuário; com o indicador de "salvo" na Toolbar, um indicador que diz "Salvo às 14:32" sem ter salvo nada é pior do que indicador nenhum. A função continua nunca lançando — só passou a reportar o resultado, e a Toolbar tem um estado de erro visível.

### 31.4 Erro de importação: o caso silencioso perigoso não era o arquivo corrompido

O item 4 pedia aviso ao importar um `.glb` inválido. Ao implementar, apareceu um segundo caso, pior: um `.glb` **válido** sem o bloco `extras` do app — exatamente o que o Blender produz quando as custom properties não viajam (a pendência aberta em #11). Esse arquivo não lançava exceção nenhuma: `sceneFromExtras` é deliberadamente tolerante (é a mesma função usada pelo autosave, onde a tolerância é desejada) e devolvia uma cena vazia, que **substituía a cena de trabalho do usuário** sem uma palavra.

`SceneFileError` distingue os dois casos (`unreadable` / `missingAppData`) na fronteira de `sceneFile.ts`, sem tocar em `sceneSerialization.ts`. A mensagem de `missingAppData` diz o que fazer ("reexporte com a opção de custom properties ligada") — não fecha a pendência do #11, mas transforma um sumiço inexplicável num diagnóstico.

### 31.5 Descoberta: o arrasto de gizmo **é** testável por automação — a limitação do #3 era da ferramenta, não do gizmo

O #3 registrou que arrastar `OrbitControls`/`TransformControls` não funcionava por automação, porque a ferramenta em uso disparava `MouseEvent` clássicos em vez de `PointerEvent`. Isso valeu para todas as fases seguintes (#6, #8, #9), deixando o arrasto real sempre pendente de validação manual.

Ao validar a fase 9 com Chrome via Playwright, o arrasto do gizmo de translação **funcionou**: `page.mouse.down/move/up` dispara `PointerEvent` de verdade, o `TransformControls` respondeu, o campo de posição foi de 0 a 0,386 m e o indicador de alinhamento com a grade acendeu na linha Z=0 durante o arrasto — o comportamento do item 10, observado ao vivo. **Isso não muda a política de teste do plano** (aparência renderizada e pixel real de WebGL continuam fora do teste automatizado), mas remove uma limitação de validação que constava como permanente: daqui em diante, interações de arrasto podem ser verificadas na validação assistida por navegador, sem depender só de inspeção do código-fonte.

**Validação da fase:** suíte em 639 testes (58 novos), todos verdes; `tsc -b`, `eslint .` e `npm run build` limpos. Validado no Chrome real (headless via Playwright, sobre `npm run preview`), sem nenhum erro de console: indicador de autosave percorrendo "Ainda não salvo" → "Salvando…" → "Salvo às 13:15"; desfazer/refazer pelos botões da Toolbar, desabilitando corretamente nas pontas do histórico; painel de ajuda abrindo pelo botão; régua vertical; gizmo de rotação da raiz com os três anéis centrados no quadril; reset de rotação da raiz e de junta; ocultar o boneco selecionado limpando a seleção; **o bug do item 14 reproduzido e corrigido no cenário exato relatado** (boneco oculto em primeiro plano, clique atravessando e selecionando o boneco visível atrás); badge de IK; painéis recolhendo e sobrevivendo a um reload; e "novo workspace" limpando tudo e desabilitando o desfazer.

---

## 32. Fechamento do mapa de atalhos e remoção do renderizador antigo (dívida técnica dos itens 20 e 22 do cardápio)

**Contexto:** dois itens de higiene levantados ao fim da fase 9 e priorizados pelo usuário. (a) O `PLANO.md` prometia `F`, `Ctrl+S` e `Q/W/E/R` na seção "Observação: uso do teclado", e nenhum tinha sido construído — o catálogo de `shortcuts.ts` os declarava ausentes de propósito, ou seja, o plano prometia o que não existia. (b) `Figure.tsx` (o renderizador de formas geradas em código) tinha virado código morto quando o visual de manequim de madeira entrou no lugar (#21), e o par `skeleton2`/`Figure2` carregava um "2" que só fazia sentido enquanto o "1" existisse.

### 32.1 O mapa de atalhos do plano não podia ser implementado ao pé da letra

Ao ler o código antes de escrever, dois descompassos entre o mapa proposto e o app apareceram:

1. **`R` já estava ocupado.** O mapa propõe `Q/W/E/R` como "modos de ferramenta (selecionar / mover / girar / IK)", mas `R` virou "alternar FK/IK do membro da junta selecionada" na fase 7 — próximo do espírito, e já documentado no painel de ajuda.
2. **O app não tem "modo de ferramenta".** A ideia de `Q/W/E/R` vem de softwares 3D onde uma ferramenta global fica ativa. Aqui, o que existe é: a seleção decide o que o gizmo faz (junta → rotação; raiz → o modo escolhido), e só a raiz tem dois modos — a alternância mover/girar que nasceu na fase 9 (item 13).

**Opções apresentadas ao usuário:** (1) construir `F`, `Ctrl+S` e `W`/`E`, tirando o `Q` do mapa; (2) construir só `F` e `Ctrl+S`, tirando `Q/W/E/R` inteiro; (3) não construir nada e enxugar o plano para o que já existe.

**Decisão:** opção 1. `W`/`E` passam a alternar o gizmo da raiz entre mover e girar — a leitura mais próxima possível da convenção dos softwares 3D dentro do que o app realmente tem. O `Q` ("selecionar") **não foi construído**: não há modo de seleção separado para ativar, e `Esc` já limpa a seleção. Isso está registrado tanto no docblock de `SHORTCUT_CATALOG` quanto no `PLANO.md`, para o plano parar de prometer o que não existe — que era o ponto do item.

**`Ctrl+S` exigiu uma ação de store nova, não só uma ligação.** "Salvar cena" tem duas leituras no app (gravar snapshot no catálogo ou exportar `.glb`); o usuário escolheu o catálogo. Só que `saveSceneSnapshot` **sempre acrescenta** um snapshot — é o "salvar como" do painel. Ligado direto ao `Ctrl+S`, cada toque encheria o catálogo de duplicatas chamadas "Cena 1". Por isso nasceu `saveOrUpdateActiveScene`: regrava a cena ativa (dados **e** nome, que acompanha o campo "Nome da cena" da Toolbar) ou cria a primeira se não houver nenhuma; se a cena ativa tiver sido removida do catálogo, cai no caminho de criar. É o "salvar" de um editor, e entra no undo como qualquer edição de conteúdo.

Detalhe do handler: `saveScene` devolve `true` **sempre**, mesmo quando não há nada de novo para gravar. Não é descuido — é o `preventDefault` que impede o diálogo "salvar página" do navegador de abrir por cima do app, e ele só acontece quando a ação se declara tratada. Coberto por teste (`event.defaultPrevented`).

**`F` (enquadrar) mede a caixa real do boneco, não estima pela altura.** A alternativa barata seria calcular a distância a partir de `figure.height`; ela erra feio nas poses que mudam a silhueta (Superman deitado ocupa uma caixa completamente diferente de um boneco em pé). O `CameraRig` usa `Box3.setFromObject` sobre o grupo `figure-<id>` vivo na cena e enquadra a esfera envolvente. A matemática ficou num módulo puro e testado (`computeFrameDistance` em `cameraPresets.ts`), que considera FOV vertical **e** a proporção da janela — numa janela mais estreita que alta, quem limita é a largura, e ignorar isso cortaria os braços do boneco na T-pose. A direção de visão atual é preservada: enquadrar aproxima, não escolhe um ângulo pelo usuário.

### 32.2 Remoção do renderizador antigo e fusão da camada visual

**Decisão do usuário:** remover `Figure.tsx` (o renderizador antigo), renomear `Figure2.tsx` → `Figure.tsx` e **fundir `skeleton2.ts` dentro de `skeleton.ts`** (em vez de renomear para algo como `figureVisuals.ts`, que era a recomendação).

Consequência aceita: `skeleton.ts` passou de ~570 para ~1140 linhas, com cinemática (juntas, offsets, limites) e aparência (`JOINT_PARTS`/`BONE_STYLES`) no mesmo arquivo. A fusão foi mecânica e sem risco — `skeleton2.ts` era `export * from './skeleton'` mais a camada visual, sem nenhuma colisão de nome entre os dois conjuntos de exportações (verificado antes de mexer). Um cabeçalho de seção separa visualmente as duas metades, e o teste da camada visual continua num arquivo próprio (`skeletonParts.test.ts`, antigo `skeleton2.test.ts`).

O renderizador antigo levou junto seus 27 testes (`Figure.test.tsx` original), que exercitavam geometria que não existe mais — daí a suíte cair de 639 para 612 antes dos testes novos dos atalhos. **Nada de comportamento se perdeu:** os testes do renderizador atual já cobrem hierarquia de juntas, cores, seleção, refs, sombra e ancoragem no mundo.

Detalhe que só aparece ao renomear: `Viewport.tsx` mantinha `import { Figure2 as Figure }` com o import antigo comentado ao lado, exatamente para permitir reverter o visual com uma linha (#21). Com a decisão de remover, o alias e o comentário saíram — a troca de renderizador deixou de ser uma opção viva, e manter o comentário sugeriria o contrário.

**Validação:** suíte em 633 testes, todos verdes; `tsc -b`, `eslint .` e `npm run build` limpos. Validado no Chrome real (headless via Playwright), sem erro de console: o boneco continua renderizando igual após a remoção/renomeação; `F` reenquadra a câmera de um boneco minúsculo ao longe para a tela cheia preservando o ângulo; `E`/`W` alternam o gizmo da raiz (confirmado pelo `aria-pressed` dos botões e pelo gizmo no viewport); `Ctrl+S` grava a cena e um segundo `Ctrl+S` **atualiza** a mesma em vez de duplicar; e o painel de ajuda (`?`) lista as três teclas novas.

---

## 33. Régua vertical ancorada no boneco selecionado

**Contexto:** na fase 9 (item 11) a régua nasceu num ponto fixo do chão (`RULER_POSITION = [-0,5; 0; -0,5]`, um cruzamento da grade), como referência comum para comparar vários bonecos. O usuário pediu para alinhá-la ao boneco selecionado.

**A ambiguidade que precisou de resposta.** "Alinhar com o eixo Z do boneco" tem duas leituras opostas na vista frontal — que é justamente onde altura se lê: (a) régua **ao lado** do boneco, na mesma profundidade (mesmo Z, afastada em X), ou (b) régua **sobre o eixo Z** do boneco (mesmo X, afastada em Z), que na vista frontal a esconderia atrás do corpo. Perguntado, o usuário definiu uma terceira: a régua acompanha o eixo Y **centrada no gizmo de translação**, e **pode passar por dentro do boneco**. Sem boneco selecionado, ela some da cena.

**Decisões que a implementação exigiu além do posicionamento:**

1. **A régua nasce sempre no chão, descartando o Y da âncora.** Ela é ancorada em `figure.position`, mas só X e Z são usados. Se acompanhasse o Y, um boneco erguido levaria a régua junto e a altura do salto — a única coisa que se quer medir ali — marcaria zero, sempre. Validado no navegador com um boneco em Y = 0,8 m: a régua continua do chão e o gizmo fica na marca dos 0,8.

2. **Desenhada sem teste de profundidade (`depthTest: false`).** Ancorada no eixo do corpo, a régua fica *dentro* dele — e ficaria enterrada justamente na faixa mais interessante de leitura: o bloco do peito chega a 0,148 m de raio (`skeleton.ts`), então até o traço maior (0,16 m) só apareceria 12 mm para fora, e os traços finos (0,07 m) sumiriam por completo. Sem isso, "pode passar por dentro do boneco" viraria "não dá para ver a régua". É o mesmo tratamento que o `TransformControls` já dá ao próprio gizmo em que ela se ancora, o que mantém a coerência visual dos overlays.

3. **`position: null` em vez de a decisão morar no `Viewport`.** O componente recebe a posição do boneco selecionado ou `null`, e devolve `null` nesse caso — mesmo padrão do `GridAlignmentIndicator`. Assim o "some sem seleção" fica coberto por teste de componente; o `Viewport` (dentro de um `<Canvas>`) não tem teste automatizado.

4. **Dica na Toolbar.** Como a régua agora depende da seleção, marcar a caixa sem nenhum boneco selecionado não muda nada na tela — o que parece defeito. O rótulo ganhou `title` ("Régua de altura no boneco selecionado", chave `toolbar.rulerHint` nos dois idiomas) explicando a condição.

O `RULER_POSITION` foi removido de `constants.ts`: com a âncora vinda do estado, uma constante de posição fixa só poderia mentir.

**Validação:** 4 testes novos (âncora em X/Z, nascer no chão com boneco erguido, não desenhar sem seleção, `depthTest` desligado); suíte em **637 testes**, todos verdes; `tsc -b`, `eslint .` e `npm run build` limpos. Validado no Chrome real (headless via Playwright), sem erro de console: com dois bonecos em posições diferentes, a régua salta de um para o outro conforme a seleção; some ao clicar no vazio (com a caixa da Toolbar ainda marcada); e aparece por cima do corpo, legível, com o boneco erguido do chão.

---

## 34. Espelho e inversão parciais: a simetria passa a valer da junta selecionada para baixo

**Contexto:** as operações de simetria do #30 (copiar um lado espelhado para o outro, inverter os dois) valiam sempre o boneco inteiro, e por isso viviam só no painel da raiz. O usuário pediu que fossem parciais — "se o ombro direito estiver selecionado, somente ela e as juntas depois dela até a mão são afetadas; as pernas ficariam intactas".

**A definição de escopo adotada — subárvore, não "membro".** O escopo é a junta selecionada mais todos os seus descendentes (`getJointSubtree`, novo em `skeleton.ts`, o contrário exato do `getJointChain` que já existia), interseção com as juntas pareadas. Não é uma tabela de membros porque a hierarquia já responde a pergunta melhor do que uma lista escrita à mão responderia, e de graça:

- `shoulder.R` → do ombro à ponta dos dedos (a clavícula, que está ACIMA, fica de fora — como o usuário descreveu);
- `spine`, `chest`, `upperChest` → os **dois braços**, e nenhuma perna: as pernas nascem na raiz, não no tronco, então "tronco para baixo" não as inclui. Vale a pena saber disso ao ler a dica na tela;
- `root` → o boneco inteiro, que é exatamente o comportamento antigo. O comando de corpo todo virou um caso particular do parcial, em vez de um caminho separado;
- `neck`, `head` → vazio; não há par nenhum embaixo.

**Decisões que a implementação exigiu:**

1. **O escopo inclui os DOIS lados, e não depende do lado da junta selecionada.** Espelhar escreve na junta pareada: o destino é tão afetado quanto a origem, então `getMirrorScope('shoulder.R')` devolve as 8 juntas da direita e as 8 da esquerda. E `shoulder.L` devolve o mesmo conjunto — o que a seleção define é **até onde** a operação vai, não a direção da cópia. Por isso os rótulos dos botões continuam dizendo a direção explicitamente ("Copiar direito → esquerdo") em vez de virarem "deste lado para o outro": com uma junta do lado esquerdo selecionada, "deste lado" seria ambíguo justamente para quem estivesse consertando o lado errado.

2. **Parâmetro opcional, comportamento antigo intacto.** `mirrorPoseSide(pose, from, scopeJoint?)` e `swapPoseSides(pose, scopeJoint?)` (e as ações `mirrorSide`/`swapSides` do store) mantêm a assinatura anterior funcionando — sem `scopeJoint` é o boneco inteiro. Nenhuma chamada existente precisou mudar, e os testes do #30 continuam valendo como trava de regressão do caso completo.

3. **A simetria saiu do painel da raiz e virou um `SymmetryFieldset` reaproveitado.** Os mesmos três botões aparecem na raiz e em qualquer junta com par embaixo; o que muda é a dica (`symmetryScopeHint`, com o nome da junta interpolado) e o alcance. Onde o escopo é vazio (pescoço, cabeça) o bloco **não é renderizado** em vez de aparecer sem efeito — é a mesma regra que a régua do #33 seguiu: controle que não faz nada é lido como defeito. No painel da junta ele fica **depois** da rotação, para não empurrar os sliders (o controle principal) para longe do topo.

4. **A involução continua valendo no parcial.** Inverter duas vezes com o mesmo escopo devolve a pose original — o que mantém o botão seguro como alternância, agora também restrito a um membro.

**Verificação numérica (o mesmo padrão do #30, não uma inspeção visual):** com o escopo na clavícula direita — o braço inteiro pendurado numa junta central —, cada junta do braço cai na posição de mundo do par com X negado, **erro 0,000 m**, enquanto o joelho, fora do escopo, permanece a mais de 5 cm da posição espelhada. É a trava que prova as duas metades do pedido de uma vez: o que está no escopo espelha exatamente, o que está fora não se move.

**Validação:** 22 testes novos (subárvore do esqueleto, escopo, espelho/inversão parciais, ações do store e o painel), suíte em **659 testes** verdes; `tsc -b`, `eslint .` e `npm run build` limpos. Validado no Chrome real (headless via Playwright), sem erro de console: partindo da pose "Andando" (assimétrica nos quatro membros), espelhar com `shoulder.R` selecionado deixa os braços simétricos e a passada das pernas intacta; inverter com `hip.L` selecionado troca as pernas sem desfazer os braços; a dica na tela acompanha a junta selecionada ("Vale de shoulder.R para baixo…"), o bloco some na cabeça e continua aparecendo no tronco e na raiz.

---

## 35. Poses de luta em par e o botão de pose aleatória

**Contexto:** o usuário pediu três pares de poses de luta — soco, chute e gravata por trás, cada golpe com a pose de quem dá e a de quem recebe — e um botão que sorteia uma pose qualquer dentro dos limites.

**Duas definições confirmadas antes de implementar:**

| Questão | Escolha do usuário | Consequência |
|---|---|---|
| Como reage quem recebe o golpe | **De pé, no instante do impacto** | os dois bonecos do par ficam no mesmo nível do chão; encaixar o par é só ajustar a distância entre eles, sem acertar altura relativa |
| O que o sorteio inclui | **Só as juntas do corpo** | mãos ficam abertas; posição e direção que o boneco encara não mudam |

**O que faz de um par um par é geométrico, e foi resolvido numericamente.** Um par de poses só serve se o golpe de uma chegar na altura exata do alvo da outra. Os três encontros foram RESOLVIDOS por busca em grade contra a cinemática direta (mesmo método do #30), não estimados:

| Par | Encontro | Erro | Distância entre os quadris |
|---|---|---|---|
| Soco | punho direito × **rosto** (ponto do nariz/olhos, não a junta da cabeça) | 1,500 m contra 1,500 m | **0,63 m** |
| Chute | pé × barriga (junta `spine`) | 1,043 m contra 1,043 m — 0,1 mm | **0,94 m** |
| Gravata | punhos × pescoço | 1,37 m contra 1,39 m — 1,9 cm | **0,33 m** (corpo a corpo) |

Essas distâncias são resultado medido, não ajuste no olho: com quem recebe girado 180°, um ponto de `z` local cai em `D − z` no mundo, então `D = alcance do golpe + z do alvo`. Estão travadas em teste.

**A descoberta que mudou uma pose: tronco em extensão inviabilizava o par do soco.** A primeira versão de "Soco (levando)" tinha o tronco arqueado para trás, o que parece o óbvio para quem leva um golpe. Só que isso põe o rosto **21 cm atrás do próprio quadril**, e como o punho do atacante alcança 0,62 m à frente do dele, o par só encaixava a **0,41 m** — com os dois corpos atravessados na cena. A correção foi inclinar o tronco para a **frente** (`spine.x = +15`) e deixar o recuo por conta do **pescoço**, no limite de extensão (`neck.x = -40`, `head.x = -20`): é o boxeador que vinha avançando quando o soco parou sua cabeça. O rosto passa a ficar sobre o próprio quadril, o par encaixa a 0,63 m, e o gesto ("queixo jogado para cima, joelhos cedendo") ficou mais legível, não menos. Foi o cálculo da distância que expôs o problema — nenhuma inspeção visual da pose sozinha o revelaria.

**Outras decisões da implementação:**

1. **A altura do quadril de cada pose sai da restrição do chão, não do chute de um número.** Subir o quadril translada o corpo inteiro, então a relação é linear: `hipHeightM = 0,9 + (folga − ponto mais baixo)`. Todas as poses novas plantam os pés (a mais alta a 2,3 cm do chão) menos a que chuta, que tem uma perna no ar por definição — e é a única fora da lista `GROUNDED` dos testes.

2. **"Levando o chute" teve os braços re-resolvidos depois de ver na tela.** Com o tronco dobrado 60°, os ombros abertos deixavam as mãos estendidas à frente — parecia mergulho, não proteção. Re-resolvidos contra o alvo "mãos na barriga" (7 cm dali), com o cotovelo bem fechado, o gesto virou o de quem se encolhe em volta do golpe.

3. **As duas poses simétricas usam o helper `symmetric()`** ("levando o chute" e "recebendo a gravata"): só o lado esquerdo é declarado e o direito sai por reflexão exata, como as demais poses simétricas do #30 — os dois lados não têm como sair de sincronia.

4. **Pose aleatória é módulo próprio (`randomPose.ts`), não um preset.** Um preset é uma tabela fixa; o sorteio é uma função. Cada eixo sai uniforme dentro da faixa da PRÓPRIA junta, lida por `getJoint` — assim um `joint-limits.json` do workspace (#29) aperta também o sorteio, em vez de o botão furar a configuração do usuário. Valores inteiros, como os sliders. O gerador é injetável (`resolveRandomPose(random)`) para os testes fixarem o sorteio em vez de torcer pela sorte.

5. **O resultado do sorteio NÃO é uma pose plausível, e isso é o esperado.** Ângulos independentes por junta cruzam membros e enfiam pé no chão; é o que "qualquer pose dentro dos limites" significa, e é o ponto do botão — um ponto de partida inesperado para depois ajustar. Registrado no docblock para ninguém "consertar" isso depois.

6. **O botão fica junto das poses predefinidas, mas com borda tracejada e ocupando a linha inteira.** É a mesma pergunta ("por onde começo?"), mas não é um preset: cada clique dá uma pose diferente, e o visual precisa dizer isso.

**Validação:** 50 testes novos, suíte em **709 testes** verdes; `tsc -b`, `eslint .` e `npm run build` limpos. Validado no Chrome real (headless via Playwright), sem erro de console: os três pares montados com dois bonecos alinhados nas distâncias medidas — o punho chega ao rosto, o pé à barriga, os braços dão a volta no pescoço — e o botão de sorteio dando poses diferentes a cada clique.

---

## 36. Primeira entrega do catálogo: 18 poses novas (apontar, apoios no chão, A-pose) e o combo agrupado

**Contexto:** depois de sugerir um catálogo de poses, o usuário pediu para implementar todas, com um combo box agrupado nas categorias sugeridas, e mão-faca nas de apontar. Confirmadas duas coisas antes de começar: entrega em **duas etapas** (esta = apontar + apoios no chão + A-pose, 18 poses; a próxima = pares, ação e expressivas, 26) e o combo **não aplica sozinho** — quem aplica é um botão "Aplicar pose"; o sorteio segue como botão à parte, fora da lista.

**Convenções medidas antes de posar qualquer coisa** (nenhuma foi deduzida):

- **Direção da palma = -Z local do punho.** Com o braço à frente, a torção neutra (`elbow.R.y = -90`) deixa a palma na VERTICAL — a mão-faca já sai de graça; `0` deixa a palma para baixo (indicar/comandar) e `-180` para cima (apresentar). É `elbow.y` que decide o sentido do gesto, com o mesmo braço.
- **Rotação da raiz:** `x = 90` deita de bruços (cabeça para +Z), `x = -90` de costas, `z = 90` deita sobre o lado direito com o rosto para a frente.

**Por que apontar usa a mão aberta.** Os quatro dedos do modelo são uma cadeia só (`fingersBase → fingersMid → fingersTip`); só o polegar é independente. Apontar com o indicador é impossível sem dividir a geometria da mão. A mão reta faz o papel — e em silhueta lê melhor que um indicador, que sempre some. Três coisas fazem o gesto ler como apontar e não como alcançar, e as três estão travadas em teste: **punho zerado** (a mão continua a linha do antebraço), **cotovelo quase estendido** e **cabeça acompanhando**. A exceção é "Polegar para trás", a única pose de apontar com dedo de verdade que o modelo permite — o polegar sai apontando para trás com 3° de erro.

**Três limitações do modelo que apareceram ao resolver os apoios, e o que foi feito com cada uma** (todas documentadas na dica da própria pose, para não parecerem defeito):

1. **O boneco não alcança os próprios pés.** O tronco dobra no máximo 70° (coluna 45 + peito 25), e flexionar o quadril LEVANTA a perna em vez de baixar o tronco. Com as mãos a 0,44 m do chão, elas chegam à canela. A pose foi entregue como **"Alongamento à frente"** — o que ela de fato é — em vez de "tocar os pés", que seria promessa falsa.
2. **Agachar de pé chapado E com o pé sob o corpo é impossível.** A dorsiflexão do tornozelo vai a 20°. Ou o pé fica chapado 46 cm à frente do quadril (e na tela lê como "sentado no ar" — foi a primeira versão, corrigida depois de ver o print), ou fica sob o corpo com o **calcanhar erguido**. Escolhida a segunda: é exatamente como agacha quem tem tornozelo rígido.
3. **O braço é mais longo que a coxa** (0,515 contra 0,415 m). No "de quatro", com o tronco na altura que põe o joelho no chão, um braço reto atravessaria o piso — daí o cotovelo dobrado 67°. O punho vai ao limite de extensão (-60°) para a mão assentar em vez de espetar o chão.

**A heurística de altura do quadril tem um limite, e ele foi encontrado.** Para poses cujo apoio é pé, joelho ou mão, a altura sai de uma relação linear: subir o quadril translada o corpo inteiro, então `hipHeightM = 0,9 + (folga − ponto mais baixo)`. Isso NÃO vale quando quem encosta no chão é o **bloco do tronco** — a busca só enxerga juntas, e o corpo afundava no piso. Nessas (de bruços, de lado) a altura vem da geometria: meia-espessura da pelve (0,081 m em Z) e meia-largura da cintura escapular (0,195 m em X).

**O combo agrupado.** 34 poses em 6 grupos (Referência, Dia a dia, Apoios no chão, Apontar, Ação, Luta) — a grade de botões não cabia mais. `POSE_PRESET_KEYS` passou a ser **derivado** de `POSE_PRESET_GROUPS`: não há como uma pose existir e não aparecer em lugar nenhum, e um teste trava os dois sentidos. A descrição da pose escolhida aparece abaixo do combo, no lugar do antigo tooltip por botão — informação que antes exigia passar o mouse em cada um.

**Validação:** 89 testes novos, suíte em **798 testes** verdes; `tsc -b`, `eslint .` e `npm run build` limpos. Validado no Chrome real (headless via Playwright), sem erro de console: os 6 grupos do combo com a contagem certa, escolher no combo sem aplicar não muda o boneco, e as 15 poses conferidas visualmente uma a uma (foi assim que o agachado errado apareceu).

---

## 37. Segunda entrega do catálogo: 26 poses novas (expressivas, ação e 13 poses em par)

**Contexto:** fecha o que ficou combinado no #36 — pares, ação e expressivas. Duas categorias novas no combo ("Expressivas" e "Em par"), as de empurrar e o clinche entrando no grupo de luta que já existia. O catálogo vai de 34 para **60 poses em 8 grupos**.

**A regra de encaixe dos pares, e por que ela é exata.** A rotação de um preset é aplicada NA junta `root`, e o deslocamento vertical fica fora dela (no grupo externo). Consequência: girar o segundo boneco 180° em torno de Y e afastá-lo `D` metros em Z leva um ponto `(x, y, z)` medido no primeiro para `(-x, y, D - z)` — sem aproximação. Isso permitiu resolver cada par numericamente e, em três casos, verificar que **a mesma pose serve para os dois bonecos** (aperto de mão, abraço, clinche): basta aplicá-la espelhada e medir. Nos pares que olham para o mesmo lado (cavalinho) o mapeamento é só a translação em Z.

**As distâncias fazem parte do resultado, não são enfeite.** Cada par tem um número que saiu da geometria e que está na dica da pose no painel — sem ele o encaixe resolvido não chega ao usuário: aperto de mão **0,755 m** (o dobro do alcance da mão, porque o encontro é no meio do caminho), abraço **0,26**, dança **0,36**, clinche **0,40**, empurrão **0,467**, puxar **0,69**, cavalinho **0,16** atrás. Os testes travam os encontros: mãos dadas da dança com **3 mm** de erro, mãos do puxão com **2 cm**, e a superfície do peito de quem leva o empurrão caindo exatamente onde estão as mãos de quem empurra.

**Duas limitações medidas, e o que fixou cada distância:**

1. **O abraço não pode ter os peitos colados.** A cabeça do modelo só GIRA, nunca se desloca. Mesmo com pescoço e cabeça inclinados no máximo (30°+15°, o que afasta cada rosto 7,3 cm da linha média), aproximar os troncos faz os dois crânios se atravessarem: a 0,20 m a checagem de sobreposição dos dois elipsoides de cabeça dá **0,73** (atravessados) e a 0,26 m dá **1,24** (livres). Daí D = 0,26, com os peitos a 8 cm. Está travado em teste como desigualdade elipsoidal, não como um número mágico.

2. **Braços cruzados não chegam a agarrar o braço oposto.** A adução do ombro — levar o braço para o outro lado do corpo — vai só a **20°** no modelo; o resto do cruzamento tem de vir da rotação interna, que já fica no limite (`shoulder.R.y = 90`). As mãos param perto da linha média. Os antebraços se cruzam de fato à frente do tronco, que é o que a silhueta mostra, e a dica da pose diz o motivo em vez de prometer o que não acontece.

**Três erros que só o print pegou** (a busca numérica dava custo baixo em todos os três):

1. **Clinche com os braços erguidos.** Os punhos batiam o alvo atrás da cabeça do outro, mas os **cotovelos** ficavam altos e abertos — na tela os dois pareciam se render, não brigar. Re-resolvido com duas penalidades explícitas (cotovelo ao menos 18 cm ABAIXO do punho e a no máximo 0,26 m da linha média), o cotovelo caiu para 1,22 m contra o punho em 1,44 e fechou para 0,10 m da linha média. O que faz a pose ler não era a mão, era o cotovelo — e agora isso é teste.
2. **"Carregado no colo" fazendo abdominal.** Com o corpo deitado, o +Z dele virou o +Y do mundo: flexionar o quadril levanta o joelho. Os 40° da primeira versão punham as duas pernas apontando para o alto. Com 15° o joelho sobe 0,11 m acima do eixo do corpo e o tornozelo desce 0,16 m — a perna pende.
3. **Mãos dentro do corpo do outro.** Nas primeiras versões de abraço e dança as mãos caíam entre a coluna e as costas do parceiro. Corrigido medindo as peças de verdade em vez de estimar: pelve 0,081 m de meia-espessura, peito 0,104 na linha dos ombros, cabeça 0,077 de meia-largura por 0,089 de meia-profundidade.

**A ordem de resolver importa: altura ANTES de alcance.** "Sendo ajudado a levantar" saiu 49 cm fora do alvo na primeira tentativa porque o braço foi resolvido com o boneco em pé e só depois o quadril desceu para 0,415 — a mão desceu junto. Vale para toda pose que não fica em pé: fixar `hipHeightM` primeiro, resolver o alcance depois. O mesmo erro apareceu, menor, em "carregando nas costas" (4,5 cm) e foi corrigido do mesmo jeito.

**Rotação de quem é carregado no colo, deduzida em vez de tentada.** Deitar de costas E atravessado (eixo do corpo ao longo de X) precisa de uma rotação que não é nenhuma das três do #36. Em vez de tentar combinações, montou-se a base ortonormal desejada — o +Y do corpo indo para o +X do mundo, o +Z do corpo para o +Y — e extraiu-se o Euler XYZ correspondente: **(-90, 0, -90)**. Conferido medindo: cabeça em +0,61, tornozelo em -0,71, e a frente do peito apontando para cima.

**Outras decisões:**

1. **Grupos novos em vez de inchar os existentes.** "Em par" reúne as 10 poses de dois bonecos que não são briga; empurrão e clinche vão para "Luta (pares)", que já tinha esse contrato. "Ação" cresceu de 2 para 8.
2. **A mão de cada pose segue a regra do #35/#36:** fechada em quem impulsiona ou agarra (saltar, arremessar, escalar, comemorar), **aberta** em quem usa a palma como superfície (empurrar, carregar caixa, carregar no colo) ou em quem tem a mão como gesto (acenar, assustar-se), relaxada no resto.
3. **Poses simétricas usam o helper `symmetric()`** — 8 das 26. "Carregado no colo" é simétrica na POSE mas ficou fora do teste de espelho: a colocação gira o boneco 90° em Z, e aí o espelho sagital do mundo deixa de valer.

**Validação:** 20 testes novos, suíte em **945 testes** verdes (48 arquivos); `tsc -b`, `eslint .` e `npm run build` limpos. Validado no Chrome real (headless via Playwright), sem erro de console: os 8 grupos do combo com a contagem certa (60 poses), as poses de um boneco conferidas de frente e de lado, e os 8 pares montados com dois bonecos nas distâncias resolvidas — foi assim que o clinche e o colo apareceram errados.

---

## 38. Terceira entrega do catálogo: meditação, poses de postura, "deitado em X" e o mata-leão sentado

**Contexto:** pedido nominal do usuário — meditação, "empresário de sucesso" (em pé de braços cruzados), "pose de herói" (peito estufado, mãos na cintura, pernas abertas), deitado em X, duas sentadas escoradas nas mãos com o tronco levemente para trás, e o mata-leão com o adversário sentado. São **9 poses** (o X virou duas) e o catálogo vai de 60 para **69**, sem grupo novo.

**Três dúvidas levantadas antes de construir, e o que o usuário escolheu:**

1. "Empresário" e "herói" quase repetiam "Braços cruzados" e "Mãos na cintura", que já existiam → **criar as duas à parte**, com a postura que as diferencia (peito estufado, ombros para trás, pernas afastadas), preservando as neutras.
2. Deitado em X de costas ou de bruços → **as duas**.
3. Onde fica quem aplica o mata-leão → **ajoelhado atrás** (não sentado com as pernas em volta nem em pé).

**O que faz "empresário" e "herói" não serem cópias.** O ombro vai para trás pela CLAVÍCULA, não pelo ombro: `clavicle.y` positivo no lado L recua a junta do ombro 2,5 cm (medido; o eixo z da clavícula só levanta, não recua). Some-se o tronco em extensão — que põe a junta do peito à FRENTE da linha dos ombros, o inverso do que acontece em pé neutro, e é isso que os testes travam — e as pernas afastadas: 0,53 m entre os tornozelos no empresário, 0,69 m no herói (contra 0,18 em pé). No herói, `ankle.z` compensa a abertura do quadril para a sola continuar chapada.

**Efeito colateral medido, e registrado em vez de escondido:** ombro para trás ENCURTA o alcance cruzado. As mãos do "empresário" param ainda mais perto da linha média (x ≈ 0,01) que as de "Braços cruzados" (0,05) — a adução do ombro já batia no limite de 20° e a postura piora o quadro. O cruzamento dos antebraços, que é o que a silhueta mostra, continua inteiro.

**De bruços, a cabeça TEM de virar.** Com o corpo de barriga para baixo, o ponto do rosto (nariz/olhos) cai **9,5 cm abaixo** da junta da cabeça — de cara reta ele atravessaria o piso. Virando o pescoço 55° e a cabeça mais 25°, o rosto sobe para y = 0,125. É a única assimetria da pose, e por isso ela fica fora do teste de espelho enquanto a versão de costas (que não precisa virar nada) entra.

**A pelve reclinada é o que torna "sentado com joelhos dobrados" possível.** O quadril flexiona no máximo **120° em relação à pelve**. Com a pelve reta e o boneco sentado no chão, isso não é suficiente para recolher o joelho: o pé para a 0,70 m à frente e a pose vira uma sentada preguiçosa, não "pernas dobradas". Reclinando a pelve 25° pelo `rotation.x` sobram 145° efetivos — o joelho sobe para 0,46 m e o pé vem para 0,36 m, com a sola chapada. E a reclinação é, literalmente, o "tronco levemente para trás" que o usuário pediu: uma coisa resolveu a outra. O preço é que a pose passa a IMPOR a direção que o boneco encara, como toda pose que o inclina.

**"Sola no chão" são DUAS alturas, não uma.** Pedir só o tornozelo em 0,07 deixava o pé na ponta; pedir só a ponta em 0,01 deixava o pé inteiro enterrado 5 cm (o teste de "nenhuma junta atravessa o chão" não pega isso, porque as juntas do pé continuam acima do zero — quem afunda é a malha). As duas juntas travadas ao mesmo tempo é o que significa pé chapado, e é assim que as poses sentadas e o teste ficaram. O mesmo vale para a mão espalmada: punho em 0,09 E ponta dos dedos em 0,04, senão a mão fica espetada no chão.

**Mata-leão: a inclinação e a distância brigam entre si, e saíram juntas.** Inclinar mais quem aplica alcança melhor a garganta, mas enfia o peito dele na cabeça de quem senta. Varrendo 3 inclinações × 4 distâncias e medindo as duas coisas, o ponto certo é **12°/8° de inclinação a 0,45 m**: o punho fica a 3,6 cm do alvo e a frente do peito para em z = -0,296 contra a nuca do outro em -0,286 — **encostado**, que é exatamente onde a cabeça de quem é estrangulado descansa. Com 30° de inclinação a mesma distância dava 6 cm de interpenetração. A chave fecha de verdade: a mão esquerda para a **7 mm** do eixo do próprio antebraço direito.

**A garganta foi calculada no referencial do PESCOÇO.** Somar 8,5 cm no Z do mundo erraria o alvo em quase 4 cm, porque o tronco de quem recebe está reclinado 36°. O alvo de quem aplica e o das próprias mãos de quem recebe usam o mesmo ponto.

**Meditação reaproveita as pernas de "Pernas cruzadas"** — com a mesma limitação de abertura de quadril já registrada no #36 — e o alvo de cada mão não foi escolhido: é a posição MEDIDA do joelho depois de montar as pernas, com 6 cm a mais em Y para a mão pousar por cima e não dentro dele. O punho chega a 2,6 cm dali e a palma aponta exatamente para +Y.

**Validação:** 52 testes novos, suíte em **997 testes** verdes (48 arquivos); `tsc -b`, `eslint .` e `npm run build` limpos. Validado no Chrome real (headless via Playwright), sem erro de console: 69 poses nos 8 grupos, as poses de um boneco conferidas de frente, de lado e de cima (o X só se lê de cima), e o par do mata-leão montado com os dois bonecos — com as posições lidas do próprio painel, depois de uma leitura equivocada do print sugerir um deslocamento que não existia.

---

## 39. Cor livre para os bonecos, no lugar da paleta fixa de 5

**Contexto:** pedido do usuário — poder escolher qualquer cor para os bonecos, em vez das cores predefinidas. Até aqui o "swatch" redondo da lista era um BOTÃO que ciclava entre as 5 cores de `COLOR_PALETTE`, e o store recusava qualquer coisa fora dela.

**A UI é o `<input type="color">` nativo.** Ele já é o próprio indicador da cor atual (dispensa o quadradinho colorido separado), abre o seletor do sistema, funciona no teclado e não traz dependência nenhuma. Só precisou de CSS para caber no mesmo círculo de 1,1 rem que o botão ocupava: `appearance: none` mais o zeramento do preenchimento interno (`::-webkit-color-swatch` / `::-moz-color-swatch`), senão a moldura que cada navegador desenha por conta própria estouraria a altura da linha da lista.

**A validação mudou de LISTA para FORMATO, e isso não é detalhe.** `setColor` agora aceita qualquer `#rrggbb`, mas continua recusando o que não for cor — e isso passou a ser obrigatório, não opcional: o valor vai direto para o `MeshStandardMaterial` do three.js e para o `style` inline do painel, e não vem só do seletor. Vem também de `.glb` importado e do `localStorage` do autosave, que antes eram filtrados de graça pela checagem de pertencimento à paleta. `figureFromExtras` fazia `typeof source.color === 'string' ? source.color : '#e04040'`, o que deixaria passar `'red'`, `'rgb(1,2,3)'` ou qualquer string. Agora as duas portas usam o mesmo `normalizeFigureColor`, que normaliza para minúsculas e expande a forma curta `#rgb` (válida em CSS, e plausível em quem editar um arquivo à mão).

**A unicidade caiu.** Antes dois bonecos não podiam ter a mesma cor. Com um seletor de cor livre, manter a regra significaria um seletor que às vezes simplesmente não faz nada — e dois bonecos da mesma cor é escolha de quem monta a cena, não erro. A paleta CONTINUA existindo, só que como cor padrão em rodízio: bonecos novos ainda nascem de cores diferentes, que era o objetivo real dela.

**Bug latente encontrado ao soltar a unicidade.** `addFigure`/`duplicateFigure` faziam `nextAvailableColor(figures)` e devolviam `null` quando a paleta acabava. Isso nunca travou o app por coincidência: `MAX_FIGURES` (5) e o tamanho da paleta (5) são iguais E as cores eram únicas, então a paleta só esgotava junto com o limite. Permitir cor repetida quebra essa coincidência — com dois bonecos pintados da mesma cor sobraria cor na paleta e o app recusaria acrescentar o terceiro, com o limite longe. A função virou `nextDefaultColor`, que nunca devolve `null` (cai no rodízio `figures.length % paleta.length`), e o limite de bonecos voltou a ser só o `MAX_FIGURES`. Há teste travando exatamente esse caso.

**Característica conhecida, não alterada:** como todo controle contínuo do app (os sliders de rotação, por exemplo), o seletor de cor grava no store a cada evento, e arrastar dentro do seletor empilha várias entradas de undo. Mudar isso exigiria mexer no `handleSet` do `zundo`, que vale para o store inteiro — fora do escopo deste pedido, e o comportamento fica consistente com o que já existia.

**Validação:** 4 testes novos e 3 reescritos (os antigos travavam justamente o oposto: só cor da paleta e cor única), suíte em **1001 testes** verdes; `tsc -b`, `eslint .` e `npm run build` limpos. Validado no Chrome real, sem erro de console: swatch com `type="color"`, cores iniciais vindas da paleta, dois bonecos recebendo a MESMA cor fora da paleta (`#7f3ac1`) e ainda assim sendo possível acrescentar bonecos até o limite de 5.

---

## 40. Mata-leão deitado, e a direção dos braços no "deitado em X"

**Contexto:** dois pedidos do usuário na mesma leva — uma pose em par de mata-leão no chão (quem aplica deitado de costas por baixo, com as pernas em volta do tronco do outro, os dois de barriga para cima) e a correção dos braços das duas poses "deitado em X", que estavam apontando para os PÉS.

**A escala de `shoulder.z` deitado, que é a raiz do defeito relatado.** Com o boneco deitado, o corpo inteiro fica no plano do chão: o +Y local (subir a coluna) vira -Z de costas e +Z de bruços, e o +X local continua +X. Ou seja, `shoulder.z` gira o braço DENTRO do chão e **não muda a altura do punho** — medido, o punho fica em y = 0,136 para qualquer valor do eixo. A escala é:

| `shoulder.L.z` | direção do braço | punho (dz em relação ao ombro) |
|---|---|---|
| 0 | ao longo do corpo, para os PÉS | — |
| 52 (valor antigo) | para os pés e um pouco para fora | 0,32 na direção dos pés |
| **90** | **exatamente para o LADO** | 0,000 |
| 145 | para o alto e ainda aberto | 0,42 na direção da cabeça |
| 180 | colado ao eixo do corpo, para a cabeça | 0,51 |

Os 52° originais foram herdados de um palpite de "braço aberto" pensado como se o boneco estivesse em pé — deitado, eles apontam para os pés, que é exatamente o que o usuário viu. De costas a pose foi para **90** (punho na linha do ombro, a 0,71 m da linha média) e de bruços para **145**, que é o que o usuário pediu como "para o alto" sem transformar o X numa flecha: em 180° os dois braços ficariam paralelos ao corpo e a pose perderia a abertura. O teste passou a comparar o punho com o PRÓPRIO ombro em vez de medir só a distância entre os dois punhos — a métrica antiga (abertura em X) não distingue "para o lado" de "para os pés", e por isso aprovava o defeito.

**Mata-leão deitado: três coisas que o "deitado de costas" inverte.**

1. **Levantar a cabeça é `neck.x` POSITIVO.** Em pé, quem estrangula estende o pescoço (negativo). Deitado de costas, isso empurra o crânio contra o chão — a primeira tentativa enterrou a cabeça 9 mm. O sinal certo é o oposto, e o motivo é o mesmo que vale para a pose inteira: o corpo girou 90°.
2. **Envolver o outro com as pernas é FLEXÃO de quadril.** Com o +Z do corpo virado para o +Y do mundo, flexionar o quadril sobe a perna — exatamente o movimento de abraçar o tronco. Os dois quadris ficam cravados no limite de -120°, que é tudo o que o modelo dá.
3. **Os alvos das pernas têm de estar a UM COMPRIMENTO DE COXA do quadril.** Alvo mais perto que 0,415 m é inalcançável por definição (o osso não encolhe) e o joelho pararia a meio caminho, com custo baixo e resultado errado. Recolocados sobre a esfera de alcance, os joelhos caem a 1 mm do alvo.

**Empilhar os dois é uma conta, não um ajuste no olho.** `hipHeightM` de 0,31 para quem recebe contra 0,11 de quem aplica: os 0,20 m de diferença são a soma das duas meias-espessuras de peito (0,104 cada). Os corpos ficam comprimidos 2,5 cm um contra o outro, que é o que um estrangulamento faz. O deslocamento horizontal — 0,10 m na direção dos próprios pés — é o que põe a cabeça de quem aplica ATRÁS da de quem recebe, e vai na dica da pose porque é a única parte que o preset não consegue impor sozinho.

**As duas cabeças, de novo.** Mesmo problema do abraço (#37): a cabeça do modelo só gira, nunca se desloca. Aqui a saída foi a inclinação lateral do pescoço, cada um para um lado — os crânios ficam a 0,207 m, acima dos 0,18 m que as duas meias-larguras somam.

**Encaixes travados em teste:** antebraço direito de quem aplica a 3,6 cm da garganta (medida no frame do pescoço, não somando no eixo do mundo), mão esquerda a 1,9 cm do eixo do próprio antebraço, joelhos para fora das costelas e acima do peito de quem recebe, tornozelos cruzando na linha média acima da barriga, e a cabeça de quem aplica acima do chão.

**Validação:** 9 testes novos/reescritos, suíte em **1010 testes** verdes; `tsc -b`, `eslint .` e `npm run build` limpos. Validado no Chrome real, sem erro de console: 71 poses no combo, as duas do X conferidas de cima (é o único ângulo em que a direção dos braços se lê) e o par montado com os dois bonecos.

## 41. Poses em dupla aplicadas automaticamente no segundo boneco

Pedido do usuário: em poses em par, com dois bonecos na cena, aplicar a pose num deles deve pôr o outro na pose correspondente automaticamente.

**A tabela é a dica do painel virando número.** As 23 poses em par sempre vieram aos pares, e as dicas já diziam com qual pose cada uma encaixa e a que distância ("encaixa com Empurrão (levando) a 0,47 m"). Isso era instrução para o usuário executar à mão: aplicar a outra metade no segundo boneco e arrastá-lo até bater. O `posePairs.ts` transforma essas mesmas frases em dados — pose do parceiro, distância e se ele fica de frente ou olhando para o mesmo lado — e é o store que executa. Nenhuma distância foi inventada: todas são as que os testes de geometria de `posePresets.test.ts` já travavam, e o `posePairs.test.ts` volta a medir cada encontro (mão × mão, punho × rosto, antebraço × garganta) através da montagem automática.

**Escopo: exatamente dois bonecos.** Com três ou mais não há como saber qual é o parceiro, e desmontar a pose do boneco errado é pior do que não fazer nada — aí a montagem continua manual, guiada pela dica, que por isso continua trazendo a distância. Com um boneco só, nada muda.

**Fora da tabela de propósito:** "guarda de luta" mora no grupo de luta mas é pose SOLO — não tem contato nenhum que fixe uma distância, e arbitrar uma seria chute.

**O par é um corpo rígido — e é aí que estava a armadilha.** A montagem canônica é medida com quem recebe a pose olhando para +Z; o giro de encenação que o usuário deu a ele é aplicado depois, ao deslocamento E à rotação do parceiro. Somar graus em `rotation.y` funciona enquanto a pose do parceiro é em pé, e QUEBRA nas poses que já impõem rotação própria (o "colo", com o carregado deitado atravessado, e o mata-leão deitado): ângulos de Euler não se somam, e mexer em `y` ali ROLA o corpo em torno do próprio eixo em vez de mudar a direção que ele encara. A composição correta sai por matriz (`Ry(giro) · rotação da pose`, decomposta de volta em Euler XYZ), que no caso em pé reduz exatamente à soma. Um teste percorre vários ângulos justamente porque o erro seria invisível a 0°.

**Dois detalhes de sinal e escala.** Nos pares de frente a distância é simétrica (cada um está a D à frente do outro); nos pares de mesmo sentido ela troca de sinal, e um teste trava a consistência mútua da tabela inteira — sem isso, aplicar a pose A montaria um par diferente de aplicar a pose B, e o segundo boneco pularia de lugar. A distância acompanha a altura dos bonecos pela **média** das duas escalas: a distância é parte alcance de um e parte alvo do outro, e a média é a repartição neutra (com alturas iguais, o caso comum, é exata).

**Uma edição só.** As duas metades saem de um único `set`, então um Ctrl+Z desfaz o par inteiro em vez de deixar o segundo boneco posado sozinho.

**Aviso no painel** (`posePairAuto`, chave nova nos dois idiomas), mostrado só quando aplicar vai mesmo mexer no outro boneco — pose em par E exatamente dois bonecos.

**Validação:** 33 testes novos, suíte em **1043 testes** verdes; `tsc -b`, `eslint .` e `npm run build` limpos. Validado no Chrome real sem erro de console: oito pares montados só clicando "Aplicar pose" no primeiro boneco (o segundo estava deslocado de propósito), com a posição e a rotação resultantes lidas nos campos do painel e conferindo com a tabela, mais dois casos com o boneco de origem girado 40° — inclusive o "colo", que é o caso da composição por matriz.

## 42. Biblioteca de poses do usuário e travamento de juntas

Pedido do usuário: implementar o salvar/carregar que viabiliza a biblioteca de poses (item A.1 do plano) e o travamento de juntas (item A.5). Três decisões foram confirmadas com ele antes de começar — uma delas é justamente a que o plano marcava com ❓.

### Biblioteca de poses

**Uma pose salva guarda o ASSENTAMENTO, não só as juntas** (decisão do usuário). Junto com as rotações vão a inclinação do boneco e a altura do quadril — exatamente os dois campos que `PosePresetPlacement` já carrega nas poses de fábrica (#30). Sem eles, salvar uma pose deitada e reaplicá-la traria o boneco de volta em pé e atravessando o chão; com eles, as poses do usuário ficam tão capazes quanto as de fábrica. O que a pose NUNCA guarda é onde o boneco está no chão (X/Z), a altura, a cor e o nome: isso é identidade e encenação de cada boneco, e é a mesma regra que `applyPosePreset` já seguia.

**`preservesHeading` é derivado, não gravado.** Um boneco sem inclinação (X e Z zerados) está em pé, e aí o giro em Y dele não faz parte da pose — é para onde ele estava encarando na cena, e aplicar preserva. Gravar o campo num arquivo editável à mão só criaria a chance de ele contradizer a rotação; a rotação é a fonte da verdade, e a leitura recalcula.

**A altura é desfeita na captura.** O `groundOffsetM` é dividido pela escala do boneco ao salvar e multiplicado pela de quem recebe ao aplicar, para que a mesma pose salva de um boneco de 1,50 m assente corretamente num de 1,90 m.

**A biblioteca é do WORKSPACE, não da cena.** É o que permite montar uma pose numa cena e reaplicá-la em qualquer boneco de qualquer outra — e é por isso que ela não entra em `.glb` nenhum e sobrevive a trocar de cena. Persistência pelo padrão já construído no #29: arquivo próprio `poses.json` na pasta, apontado pelo manifesto, sanitizado na leitura, mais o autosave em `localStorage`. Salvar e remover uma pose entram no histórico de undo, como salvar e remover um snapshot de cena — as duas coisas são conteúdo do workspace.

**UI: o mesmo combo.** As poses do usuário aparecem num grupo "Minhas poses" no combo das poses de fábrica, com o valor prefixado (`saved:`) para não colidir com as chaves. Escolher e aplicar uma pose passa a ser um gesto só, venha ela de onde vier; "Remover da biblioteca" só aparece com uma pose do usuário escolhida.

### Travamento de juntas

**Uma regra só, sem exceções a memorizar** (decisão do usuário, entre três alcances possíveis): junta travada não muda por NADA automático — slider, gizmo, teclado, IK, sorteio, espelhar/inverter, aplicar pose (de fábrica ou da biblioteca) e aplicar pose importada de arquivo. Em troca da simplicidade, o painel mostra quantas juntas estão travadas na visão da raiz, para o efeito nunca ficar inexplicável. Isso habilita o fluxo que o item do plano pedia: travar os braços e testar várias poses de perna.

**A trava é estado de TRABALHO, não conteúdo da cena** (a decisão que o plano marcava com ❓). Ela vive na sessão e no autosave do navegador; o `.glb` continua contendo apenas a pose, e reabrir uma cena salva traz tudo destravado. Consequência coerente: a trava também fica fora do histórico de undo — travar não é uma edição do boneco, e desfazer uma edição não pode reabrir a proteção que o usuário fechou.

**O IK para o membro inteiro, em vez de aplicar meia solução.** Não é preguiça: o solver é analítico de DOIS ossos e não sabe resolver com um deles preso. Escrever só a metade destravada levaria o punho para um lugar que ninguém pediu — pior do que não mexer. Com uma junta da cadeia travada, `applyIKTarget` registra o alvo, marca "não alcançado" (o gizmo mostra que o arrasto não teve efeito) e não escreve pose nenhuma. O painel avisa antes, para não ler como "o IK está quebrado".

**Detalhes que só aparecem ao integrar:** a `root` não pode ser travada (é colocação do boneco na cena, não pose); duplicar um boneco leva as travas junto (a cópia tem a mesma pose a proteger); remover o boneco leva as travas dele; e carregar uma cena PODA as travas de bonecos que não estão nela — ids de boneco são gerados por cena, então uma trava órfã recairia sobre um boneco diferente com o mesmo id. Numa pose em dupla, o parceiro também é protegido: as duas metades passam pelo mesmo `mergeLockedJoints`.

### Validação

79 testes novos, suíte em **1122 testes** verdes; `tsc -b`, `eslint .` e `npm run build` limpos. Validado no Chrome real sem erro de console: pose deitada salva na biblioteca e aplicada num segundo boneco (que manteve o próprio X e recebeu inclinação -90° e altura -0,79 m), cotovelo travado em -120° sobrevivendo a "Correndo" e ao sorteio com o slider desabilitado e o aviso na tela, "Destravar todas" devolvendo o controle, e biblioteca e travas intactas depois de recarregar a página (autosave).

## 43. Mistura entre duas poses — e por que o quatérnio foi reprovado

Pedido do usuário: o item A.6 do plano, um slider que interpola duas poses, "de maneira simples". 0% é a pose que o boneco tem, 100% é a pose escolhida no combo (de fábrica ou da biblioteca). **Não é animação:** o resultado é uma pose estática única, sem linha do tempo nem quadros — a mistura é só a forma de chegar até ela, e o que fica gravado é a pose final, como qualquer outra edição.

### O plano previa quatérnio. A medição reprovou.

O item trazia uma ressalva técnica ("interpolar ângulos de Euler pode passar por orientações estranhas em rotações grandes; provavelmente interpolar por quatérnio") e pedia validação numérica antes. Feita a medição, **o risco é o oposto do previsto**:

- **Interpolar por EIXO nunca sai dos limites articulares.** Cada eixo tem uma faixa `[min, max]`, e um valor entre dois valores válidos é válido — a faixa é convexa. Medido em 6 pares de poses × 41 passos × todas as juntas: a correção do clamp sobre o resultado é **0,000000°**. O clamp literalmente nunca tem o que fazer.
- **O quatérnio sai da faixa, e feio.** A pose deste modelo não é uma orientação livre: é um conjunto de ângulos por eixo, cada um com sua faixa. O caminho mais curto entre duas orientações passa fora dessa caixa, e ao voltar para Euler cai numa representação equivalente porém fora do limite. Caso concreto medido: `elbow.R` na mistura entre "clinche" e "alongamento à frente" dá **x = +99°** com limite `[-150, 0]` — o clamp então puxa para 0 e o braço ESTICA sozinho no meio da mistura.
- **Em salto visível:** o maior deslocamento entre dois passos consecutivos do slider foi de **0,562 m** no quatérnio contra **0,033 m** por eixo (par "mãos na cintura" → "comemorando").

Ou seja: interpolar por eixo é ao mesmo tempo o método mais simples e o único que respeita o contrato do modelo. A ressalva do plano valeria para um rig de orientações livres — não para este, onde a pose É um conjunto de sliders por eixo. O item do plano foi corrigido junto com esta entrega.

### A invariante que amarra tudo: 100% é "Aplicar pose"

As duas pontas são resolvidas para o boneco ANTES de misturar — a rotação do root já com o giro de encenação embutido (regra do `preservesHeading`) e a altura do quadril já multiplicada pela escala da altura dele. Com isso, a mistura em 100% dá exatamente o mesmo resultado que o botão "Aplicar pose", e o slider vira um superconjunto dele em vez de um terceiro jeito de posar com resultado próprio. Há teste travando isso para poses em pé e deitadas.

### As pontas são capturadas uma vez

A base é lida no PRIMEIRO evento do slider e guardada com uma chave (boneco + pose alvo). Reler a pose atual a cada evento faria cada passo partir do resultado do anterior — e arrastar de volta para 0% não devolveria a pose original. Trocar de boneco ou de pose alvo recomeça a mistura naturalmente, pela chave, sem efeito nenhum para limpar estado. Aplicar ou sortear também reinicia: a pose do boneco mudou, a base guardada não vale mais.

### Correção de chão: o meio do caminho é o produto

A altura do quadril interpola em linha reta, mas a geometria das pernas não. Medido: no meio do caminho de "em pé" para "ajoelhado" o boneco **afunda 17 cm no chão**, embora as duas pontas estejam perfeitamente assentadas. Como o ponto intermediário é justamente o que esta funcionalidade entrega, isso seria entregar uma pose quebrada.

A correção sobe apenas o afundamento **extra** — o que a mistura criou, descontado o que as pontas já tinham. É essa formulação que preserva as duas invariantes: 0% e 100% ficam intactos mesmo quando o usuário deixou o boneco enterrado de propósito. E ela nunca BAIXA o boneco: o problema é atravessar o chão, não flutuar (uma pose de voo continua voando). Depois da correção, a junta mais baixa fica em 0,000 m ao longo de todo o caminho nos cinco pares medidos.

Detalhe menor no mesmo espírito: a rotação do root interpola pelo **menor arco** (de 170° para -170° são 20°, não 340°), porque ela não tem limites — é a colocação do boneco na cena, e dá a volta completa. As juntas não precisam disso: os limites já as mantêm no caminho curto.

### Validação

31 testes novos, suíte em **1153 testes** verdes; `tsc -b`, `eslint .` e `npm run build` limpos. Validado no Chrome real sem erro de console: `hip.L` percorrendo 0 → -12 → -25 → -37 → -50 em passos de 25% (linear, como esperado), voltar a 0% devolvendo a pose original, 100% e "Aplicar pose" dando a mesma altura, e a mistura para uma pose deitada girando o boneco de 0° a -90° com o pé apoiado no chão no meio do caminho — 30 cm acima de onde a interpolação linear pura o teria deixado.

## 44. Giro do cotovelo/joelho (IK), e o aviso de alcance que mentia

Dois pedidos na mesma leva, os dois vindos da avaliação de "travar o punho e posicionar o braço pelo cotovelo".

### O aviso corrigido

Com uma junta da cadeia travada (#42), o painel mostrava *dois* avisos ao arrastar o alvo: o da trava e o antigo "Alvo fora de alcance — **aproximação mais próxima aplicada**". O segundo mentia: com a cadeia travada nada é aplicado, a pose sai referencialmente idêntica. Agora ele só aparece quando a cadeia está livre; travada, quem explica é o aviso da trava.

### O que a avaliação do pedido mostrou

O pedido era "travar o punho e mover o braço a partir do cotovelo, com o tronco e o punho parados". Duas conclusões:

1. **Metade já existia.** O alvo do IK **já é** o punho preso no espaço: enquanto o alvo não se move, a mão não sai do lugar. E o tronco também nunca se move — a cadeia é `[shoulder, elbow]`, o solver nunca escreve no `chest`. Não havia nada a construir dessa metade.
2. **O que faltava é um grau de liberdade só.** Com o ombro parado e a mão presa no alvo, o cotovelo não fica livre: ele percorre uma **circunferência** em torno do eixo ombro→mão. É o giro (*pole vector*), e o solver **já decidia esse ângulo sozinho** desde o #12 — herdando o da pose atual para dar continuidade ao arrastar o alvo. Expor o controle foi alimentar esse parâmetro de fora, sem tocar na geometria.

**O verbo, porém, tinha de ser outro.** "Travar" no app significa *não escreva nesta junta* — proteção. "Prender no espaço" significaria o oposto: *escreva o que for preciso nas outras juntas para este ponto não sair do lugar* — restrição. Pior: manter a mão apontando para o mesmo lado enquanto o cotovelo gira exigiria escrever no próprio punho, o contrário da regra única do #42. Por isso o controle novo não usa a trava: ele usa o alvo do IK, que já é o pino, e a trava continua significando só uma coisa.

### A volta inteira não existe — e é isso que a implementação respeita

Medição feita antes de implementar (12 combinações de membro e alvo, giro varrido de -180° a 175° em passos de 5°):

- A faixa alcançável é **contígua**, não esburacada: **85° a 220° de arco no braço** e **25° a 105° na perna**, conforme os limites do ombro/quadril. Um cotovelo real também não dá a volta.
- **Fora dela o efetuador escapa até 88 cm do alvo.** A rotação da base é grampeada pelos limites e o braço inteiro sai de lugar — o oposto do que o controle promete.

Daí a regra da ação: **só aplica se a mão continuar no alvo** (tolerância de 1 cm; dentro da faixa o erro medido é 0,0 mm, fora dela ≥ 18 cm — qualquer corte entre os dois classifica igual). Recusar deixa o membro parado na borda da faixa, como um slider de junta que bate no limite, em vez de arrancar a mão do lugar.

### O ângulo é lido da pose, nunca guardado

`getSwivelAngle` mede o giro atual a partir das posições das juntas; o controle exibe esse valor e escreve resolvendo. Não há estado intermediário para sair de sincronia: um ângulo que os limites não permitem simplesmente não aparece no controle. A propriedade que sustenta isso está travada em teste — **medir o giro e reaplicá-lo reproduz a mesma pose, com 0,0 mm de erro no efetuador**, em 12 combinações de pose e membro.

A referência do zero (`swivelZero`, por cadeia) vive no frame do **pai da junta-base**, ou seja, no tronco: cotovelo para trás, joelho para a frente. Assim o ângulo acompanha o boneco — girar o boneco inteiro não muda o número —, com a mesma escada de fallback que o solver já usava para o caso degenerado (membro apontado exatamente na direção da referência).

### Validação

16 testes novos, suíte em **1169 testes** verdes; `tsc -b`, `eslint .` e `npm run build` limpos. Validado no Chrome real sem erro de console: giro inicial lido em 48°, +30° aceito, +60° **recusado** (borda da faixa), -40° aceito, 180° recusado — e o alvo do IK com os **mesmos três valores em todas as linhas**, que é a promessa central; ombro travado deixa o controle desabilitado; e com a cadeia travada só o aviso da trava aparece.

## 45. Dedo indicador separado, e a adução do polegar que faltava

Pedido do usuário: modelar polegar e indicador individualmente e deixar os três dedos restantes no bloco existente. A avaliação prévia mediu a mão antes de mexer nela, e a medição partiu o trabalho em dois passos — o segundo é o pedido, o primeiro é a condição para ele valer alguma coisa.

### Passo 1: a adução do polegar ia só até 40°

Varredura de 4.845 poses de polegar contra 1.200 do indicador hipotético: com `thumb1.z` limitado a 40°, a menor distância possível entre a ponta do polegar e a ponta do indicador era **2,61 cm**. Ou seja, separar o indicador não produziria pinça nenhuma — o polegar não alcança a linha dele. O contato aparece a partir de ~75° (0,07 cm) e é exato em 80° (0,04 cm); a 60° sobram 1,17 cm, a espessura de um lápis.

A mesma medição denunciou um defeito que já existia: no punho fechado a ponta do polegar parava em X = -6,4 cm, **2,4 cm fora da borda da mão** (meia-largura 4,0 cm). O polegar fechava AO LADO do punho, embora o comentário do preset dissesse "por cima dos dedos" desde a fase 2 — o preset já usava 35° dos 40° disponíveis, e o teto era o limite, não a escolha.

Daí a faixa de `thumb1.z` ir a 80° (espelhada: -80° no lado R) e o punho fechado ser reajustado para `thumb1 { x: 40, z: 75 }, thumb2 { y: -65 }` — valores medidos, não estimados: a ponta cai em (-0,032, -0,047, -0,052), com 2,0 cm de folga do eixo das falanges no plano YZ, exatamente a soma da meia-espessura da lâmina (0,0095) com o raio da ponta do polegar (0,0115). Repousa sobre os dedos, que é o que o comentário sempre prometeu.

### Passo 2: o indicador

Três juntas por mão (`indexBase/Mid/Tip`), com **um grau de liberdade só** (flexão em X), os mesmos limites e os mesmos comprimentos de falange do bloco. Manter o comprimento é decisão, não descuido: o alvo antropométrico da mão (0,183 m do punho à ponta) está calibrado no bloco desde o #25, e encurtar só o indicador exigiria uma razão que não temos como medir aqui — inventá-la seria pior que a simetria.

**A repartição da fileira dos nós.** A palma tem 8,0 cm na linha dos nós. O indicador fica com o quarto radial (o lado do polegar), centrado em X = ∓0,030; o bloco dos outros três fica com os 6,0 cm restantes, centrado a 1,0 cm do lado oposto. Larguras com 1 mm de recuo de cada lado deixam uma fresta de 2 mm entre os dois — visível, e é ela que faz o indicador ler como dedo à parte quando a mão está aberta.

**O pivô não se move; só o desenho.** Deslocar a junta `fingersBase` 1 cm em X inclinaria a lâmina da palma em 6,7° (`atan(0,010/0,085)`), porque o osso é desenhado entre as duas juntas. Então as juntas do bloco continuam em X = 0 e quem sai do centro é a geometria, via um `offsetX` novo nas lâminas. Isso é **exato, não aproximado**: a flexão dos dedos gira em torno do eixo X, e esse eixo é a própria fileira dos nós — a posição X do pivô sobre a própria linha de rotação não muda o movimento em nada. Já o indicador não precisa de deslocamento: quem está fora do centro é a junta dele.

**O sinal do deslocamento é uma armadilha, e está travado em teste.** As lâminas são orientadas por uma rotação de 180° que alinha o +Y do molde ao -Y do osso, e essa rotação inverte o X local. Por isso o `offsetX` é somado ao PONTO MÉDIO do osso (espaço local da junta pai), não à geometria: assim o sinal que se lê no `skeleton.ts` é o sinal que aparece na tela. Um teste de renderização (`Figure.test.tsx`) lê a posição da malha e exige +0,01 no lado L e -0,01 no R.

**Poses de mão.** As quatro existentes fecham o indicador junto com o bloco (o gesto não muda). Duas novas: **apontando** (punho fechado, indicador estendido) e **pinça** (as duas pontas encostadas). E as cinco poses de corpo que apontam — apontar à frente, para cima, para baixo, ao longe, para o outro — deixaram a "mão-faca" do #36, que existia só porque apontar com dedo era impossível, e passaram a apontar com o dedo. Para isso o campo `hands` de um preset de corpo passou a aceitar `{ L, R }`: aponta a mão do gesto, a outra continua aberta, descansando. `apresentando` e `quem, eu?` seguem de mão aberta de propósito — são gestos de palma. `polegar para trás` continua com o polegar, que é o que a pose é.

### Compatibilidade: o punho salvo que viraria um "apontando"

Arquivo gravado antes disto — cena, `.glb`, biblioteca de poses, autosave — não tem as juntas `index*`, e a leitura ignora junta ausente: o indicador nasceria **esticado** no meio de um punho fechado. `withLegacyIndexFinger` copia o ângulo do bloco para o indicador na leitura, o que reproduz o gesto antigo exatamente (lá, um número comandava os quatro dedos). A decisão é por MÃO: basta o arquivo trazer uma junta `index*` daquele lado para a mão inteira passar intacta — preencher pela metade inventaria um gesto que ninguém salvou. Um ponto só, usado pelas cenas (`figureFromExtras`, que também atende o import de `.glb`) e pela biblioteca de poses (`sanitizeSavedPoses`).

### Validação

O esqueleto foi de 32 para 38 juntas, e a maior parte da conferência saiu de graça: os testes tabelados de espelho L/R, limites, peças e convenção de sinal passaram a cobrir as novas sozinhos. Só duas travas precisaram mudar de forma, porque o bloco virou quiral: elas agora exigem que o deslocamento lateral seja **exatamente espelhado** entre as mãos, em vez de proibir deslocamento.

26 testes novos, suíte em **1192 testes** verdes; `tsc -b`, `eslint .` e `npm run build` limpos. Validado no Chrome real sem erro de console: as seis juntas do indicador aparecem no combo, as seis poses de mão estão lá, e os ângulos aplicados batem — aberta (0/0), fechada (85/85), **apontando (indicador 0, bloco 85)**, pinça (50/35, polegar em -80). Na pose de corpo "apontando à frente", indicador direito em 0 com o bloco direito em 85, e a mão esquerda inteira em 0.

## 46. Câmera no vocabulário de fotografia: lente em milímetros, enquadramento, ângulo e movimento A→B

Pedido do usuário, com duas tabelas de referência anexadas (faixas de distância focal e seus efeitos; tamanhos de plano e ângulos de câmera). O objetivo declarado é facilitar o registro de keyframes.

### A inconsistência resolvida antes de começar: qual lado do sensor

O `fov` de uma `PerspectiveCamera` do three.js é **vertical**, e a captura de keyframe troca o `aspect` da câmera para o da resolução escolhida (`KeyframeCapture.tsx`) — 16:9, 1:1 ou o que o usuário pedir. Converter milímetros pela LARGURA do sensor (36 mm, o padrão do Blender) faria a mesma lente enquadrar diferente na tela e no PNG, porque o vertical mudaria com a proporção.

Por isso a conversão é ancorada na ALTURA do sensor full-frame: `FOV = 2·atan(12/f)`. Assim "50 mm" significa sempre o mesmo enquadramento vertical, e capturar em quadrado recorta as laterais — exatamente o que um recorte quadrado faz numa foto full-frame. A conversão é exata nos dois sentidos (medido: `mm → FOV → mm` reproduz o valor com 8 casas).

### Três controles independentes, que se compõem

- **Lente** (`lens.ts`): decide a compressão de perspectiva. Botões 14/24/35/50/85/100/200 mm, com a família da tabela no rótulo de ajuda (grande angular, padrão, retrato, super teleobjetiva).
- **Tamanho do plano** (`shotFraming.ts`): decide o recorte — alvo e distância. Os cortes são medidos nos MARCOS do boneco, lidos do esqueleto na pose atual: o plano médio corta na cintura (`spine`), o primeiro plano nos ombros (clavículas), e o alto da cabeça (o topo do ovo, +0,15 local) é sempre a borda de cima. O plano geral usa a caixa de todas as juntas, então um boneco deitado enquadra diferente de um em pé. O **plano detalhe** é a junta selecionada — é o que este app tem de específico para apontar; sem junta escolhida, é o rosto.
- **Ângulo**: decide de que ALTURA se olha (elevação: 0° no nível dos olhos, -30° contra-picado, +30° picado, 90° vista aérea). O azimute — o lado de onde a câmera já olhava — é preservado, a mesma regra que a tecla `F` já seguia: mudar o ângulo não tira o usuário do lado que ele escolheu.

**A composição é o que torna os milímetros previsíveis.** Com um plano ativo, trocar a lente REENQUADRA: a câmera se afasta o quanto for preciso para o mesmo trecho do corpo continuar ocupando a tela. É o efeito que o item 11 do plano queria — 24 mm e 200 mm no mesmo primeiro plano mudam a distorção do rosto e a compressão do fundo, não o recorte (conferido no navegador, lado a lado).

### Ângulo holandês e por cima do ombro (os dois que não encaixavam)

O **holandês** não é posição, é inclinação: o topo da tela girado em torno do próprio eixo de visão. Com a câmera inclinada, a órbita do mouse passa a girar em torno do eixo torto — o `OrbitControls` orbita em volta do `camera.up`. O usuário optou por incluir mesmo assim; o painel avisa disso enquanto a inclinação está ativa e oferece "Endireitar". A faixa vai a ±45°: além disso não é ângulo holandês, é câmera de cabeça para baixo. E o **bookmark passou a guardar o `up`**, senão uma vista salva inclinada voltaria endireitada — campo opcional, e arquivo gravado antes disto não ganha um `up` inventado.

O **por cima do ombro** exige dois bonecos: a câmera fica atrás e ao lado da cabeça de quem está selecionado, olhando para a cabeça do outro. É o único preset que resolve posição E distância sozinho — a distância é a que os dois bonecos já têm entre si, e impor um tamanho de plano por cima disso desmancharia o enquadramento. Com um boneco só, o botão fica desabilitado.

### Movimento entre dois pontos

Mesmo desenho da mistura de poses (#43): as duas pontas são estados completos e o slider anda entre elas, com 0% sendo exatamente A e 100% exatamente B. Cada ponta guarda **a câmera inteira** — posição, alvo, inclinação e lente —, e por isso os quatro botões pedidos (aproximar, afastar, orbitar, transladar) são só ATALHOS que geram B a partir de A. Quem quiser um *dolly zoom* marca A perto com grande angular e B longe com teleobjetiva: a lente interpola junto (conferido no navegador: 24 mm → 69 mm → 200 mm, exatamente a média geométrica no meio).

**A interpolação é feita nas coordenadas do controle, não na posição bruta.** Alvo em linha reta, direção por arco e distância/lente em progressão geométrica. Interpolar a posição direto faria a câmera cortar caminho por dentro de uma órbita — a corda em vez do arco, mergulhando na direção do alvo — e faria um zoom parecer rápido no começo e lento no fim. Numa meia-volta exata não há eixo de giro implícito, e o quatérnio escolheria um qualquer: aí o giro é forçado em torno da vertical do mundo, que é o caminho que se espera ao rodear um boneco.

### Validação

62 testes novos, suíte em **1253 testes** verdes; `tsc -b`, `eslint .` e `npm run build` limpos.

Uma mudança de configuração foi necessária: o `testTimeout` do Vitest subiu de 5 s (padrão) para 20 s. Não é regressão — os casos pesados (os 200 sorteios de `randomPose`, os arquivos de painel que remontam a UI a cada interação) levam ~4 s isolados e passavam dos 5 s por disputa de CPU com a suíte já em ~1250 testes paralelos.

Validado no Chrome real sem erro de console: os sete botões de lente aplicam a distância focal pedida; o mesmo primeiro plano em 24 mm e em 200 mm mantém o recorte e muda a distorção; os quatro ângulos reposicionam a câmera preservando o lado; a inclinação de 25° aparece no horizonte e o aviso da órbita torta acompanha; o slider só libera com as duas pontas marcadas; e o dolly zoom fecha em 24/69/200 mm nas três posições.

## 47. Termo em inglês no botão, tradução como legenda

Pedido do usuário, logo depois do #46. O motivo está nas próprias tabelas de referência que ele passou: elas têm uma coluna "Parâmetro (Inglês)" e outra "Tradução" porque o termo em inglês **é o texto que se digita num gerador de imagem**. Traduzi-lo no botão obrigava a traduzir de volta na hora de usar.

Então esses botões passaram a mostrar duas linhas: o TERMO em cima (`Close-Up`, `Low Angle`, `Bird's-Eye View`, `Over-the-Shoulder`, `Zoom In`, `Rotate`…) e a tradução embaixo, menor e esmaecida, como legenda.

**Os termos ficam FORA do i18n**, em mapas junto do domínio (`SHOT_TERMS`/`ANGLE_TERMS` em `shotFraming.ts`, `MOVE_TERMS` em `cameraMove.ts`, `LENS_FAMILY_TERMS` em `lens.ts`). Não é descuido: um texto que precisa ser idêntico em qualquer idioma da interface não é uma tradução — se fosse uma chave de i18n, alguém traduziria o dicionário `en` de volta para "português" um dia sem perceber que quebrou a serventia. Estão travados por teste contra a tabela.

**A legenda muda de papel entre os idiomas**, e isso é intencional. Em pt-BR ela é a tradução ("Primeiro plano"); em inglês, traduzir seria repetir o botão, então ela vira uma glosa curta do efeito da tabela ("Face and shoulders", "From below: imposing"). Nos dois casos a segunda linha explica a primeira.

**Escopo:** só o vocabulário que vem das tabelas (tamanhos de plano, ângulos, famílias de lente) e os quatro verbos de movimento, que o usuário também escreveu em inglês no pedido. As ações do próprio app — "Marcar A", "Limpar", "Endireitar" — e as vistas ortográficas que já existiam continuam traduzidas: não são termos de prompt.

O nome acessível de cada botão passou a ser a junção das duas linhas ("Close-Up Primeiro plano"), o que é a leitura certa para quem usa leitor de tela; os testes casam pelo termo.

Suíte em **1256 testes** verdes; `tsc -b`, `eslint .` e `npm run build` limpos; conferido no Chrome real sem erro de console.

### Correção na sequência: botão habilitado que não fazia nada

O usuário relatou que os botões de enquadramento "não funcionavam" — e não funcionavam mesmo, sem boneco SELECIONADO. O painel só os desabilitava quando a cena estava vazia, mas enquadrar é sempre sobre um boneco: com um na cena e nenhum selecionado, o rig não tinha o que medir e o clique morria em silêncio. Agora os planos, os ângulos e o por cima do ombro dependem da seleção, e a dica diz qual dos dois passos falta ("Adicione um boneco" ou "Selecione um boneco"). Junto, o rig deixou de cair no primeiro boneco da lista quando não havia seleção no por cima do ombro — o painel promete o boneco selecionado, e o fallback contradizia a promessa.

## 48. Sem seleção, o enquadramento é do conjunto

Pedido do usuário logo depois da correção do #47: quando nenhum boneco está selecionado, mirar no ponto médio de todos os bonecos da cena — "usar este recurso para enquadramentos que fazem sentido funcionar desta maneira".

**Quais fazem sentido** (`GROUP_SHOT_KEYS`): plano geral extremo, plano geral e plano médio. Primeiro plano e plano detalhe ficam de fora de propósito — um close no "meio de todo mundo" é um close no ar entre as pessoas, e o plano detalhe já é definido pela junta selecionada, que também exige um boneco. O "por cima do ombro" continua exigindo seleção: quem está em primeiro plano é o boneco escolhido, e sem essa escolha não há de que ombro olhar.

O painel passou a decidir o botão pela mesma função do domínio (`canApplyShot`) que o rig usa para agir, e a dica explica a diferença em vez de só dizer que falta alguma coisa. Os ângulos acompanham o conjunto: bastam bonecos na cena.

### O que a versão ingênua erra

A distância sai da **altura** enquadrada, porque o `fov` do three.js é vertical. Só que a altura de um grupo não diz nada sobre a largura dele: quatro bonecos lado a lado têm a altura de um só. A primeira versão convertia a largura da caixa do conjunto em altura equivalente pelo `aspect` da tela — e no navegador o boneco da ponta apareceu cortado mesmo assim.

O erro: essa conta mede a largura **no plano do alvo**, e quem está mais perto da câmera ocupa mais tela. Com os bonecos em diagonal, o da frente estoura o quadro enquanto a conta diz que cabe.

A versão correta é `fitDistance`: para cada canto da caixa do conjunto, medido a partir do alvo, o afastamento lateral (`q·direita`) não depende da distância da câmera, mas a profundidade sim (`q·visão + d`). Disso sai em forma fechada o `d` mínimo que põe aquele canto dentro do tronco de visão, sem iterar — e vale o maior dos cantos, comparado com a distância que o tamanho do plano pediria. De brinde, a vista aérea de um grupo passou a funcionar: olhando reto de cima, a "altura" do grupo vira profundidade e só a conferência de quadro salva o enquadramento.

### O plano médio corta os braços, não as pessoas

Com a caixa do corpo inteiro, três bonecos de braços abertos empurravam a câmera para trás até o "plano médio" sair igualzinho ao plano geral — o vão de braço a braço é do tamanho da altura do boneco. Mas o plano médio corta os braços abertos pelo mesmo motivo que corta as pernas: é um recorte. O que não pode faltar é o **tronco** de cada um.

Então o plano médio do grupo usa uma caixa diferente: a coluna de cada boneco, da cintura mais baixa à cabeça mais alta, com a largura dos ombros (`shoulderSpanM`, medido de `shoulder.L` a `shoulder.R` — não estimado). Na vertical ele não confere quadro nenhum, porque cortar é o serviço dele.

### Compatibilidade

Com **um** boneco só, o enquadramento de conjunto é numericamente idêntico ao do boneco selecionado, nos três planos — travado por teste. Selecionar ou não o único boneco da cena não pode mexer na câmera. O caminho do boneco selecionado não mudou em nada: a conferência de quadro é exclusiva do conjunto, porque um primeiro plano precisaria da largura do ROSTO e a caixa disponível é a do corpo.

Suíte em **1276 testes** verdes; `tsc -b`, `eslint .` e `npm run build` limpos. Conferido no Chrome real com três bonecos e nenhum selecionado, sem erro de console: os três planos abertos habilitados e os dois fechados não; plano geral com todos dentro do quadro (foi assim que o corte do boneco da ponta apareceu na primeira versão); plano médio cortando na cintura com os três troncos inteiros; contra-picado sobre o conjunto; e, ao selecionar um boneco, o plano geral volta a ser só dele.

## 49. Contra-picado limitado pelo chão

Pedido do usuário logo depois do #48: o contra-picado não pode pôr a câmera abaixo do plano horizontal. Estava mesmo furando o chão — dava para ver o boneco por baixo do piso, com a grade acima da linha do horizonte.

A causa é que os 30° da tabela eram aplicados sempre, e **quanto mais longe a câmera está, mais fundo os mesmos 30° a levam**: num primeiro plano, a 1,5 m do rosto, 30° descem 75 cm e sobra chão; num plano geral, a 4 m, descem 2 m e a câmera acaba um metro abaixo do piso.

A solução não foi empurrar a câmera de volta para cima depois (isso desmancharia o enquadramento), e sim **limitar a inclinação**: `elevationAboveGround` resolve qual é o maior mergulho que ainda deixa a câmera no chão (`asin((0 − altura do alvo) / distância)`) e usa o que for menos fundo entre esse e os 30° da tabela. O contra-picado continua sendo contra-picado — a câmera segue abaixo do que enquadra —, só que com o ângulo que couber: −30° inteiros num primeiro plano, cerca de −12° num plano geral, quase nada num plano geral extremo, onde a câmera está a vinte metros.

**A restrição é circular no enquadramento de conjunto** (#48): a distância decide o quanto se pode inclinar, e a inclinação nova muda a caixa a caber e portanto a distância. Como cada passada só SOBE a câmera, poucas repetições fecham; e um último aperto do limite contra a distância final garante a câmera no chão ou acima dele, sem depender de a repetição ter convergido. No caminho do boneco selecionado não há circularidade: a distância vem só do tamanho do plano, então uma passada resolve exatamente.

Os outros ângulos não mudam — nível dos olhos, picado e vista aérea nunca descem. E o enquadramento também não: limitar a inclinação não mexe na distância do plano, o que está travado por teste (o plano geral em contra-picado fica à mesma distância do plano geral no nível dos olhos).

Suíte em **1280 testes** verdes; `tsc -b`, `eslint .` e `npm run build` limpos. Conferido no Chrome real, sem erro de console: o primeiro plano mantém os 30° e olha por baixo do queixo; o plano geral de um boneco e os três planos abertos do grupo param exatamente na linha do chão, com o horizonte rente aos pés e nada visto por baixo do piso.

## 50. O vocabulário de câmera completo

O usuário pediu sugestões de outros enquadramentos pré-definidos e mandou implementar todas. São seis famílias novas, mais três correções que só apareceram olhando o resultado no navegador.

### A lacuna maior não era um plano faltando

Era o **lado**. Até aqui todo plano herdava o azimute de onde a câmera estivesse, e os presets ortográficos que existiam são do MUNDO e ainda trocam a projeção. Não havia como pedir "3/4 de frente deste boneco, em perspectiva, mantendo o plano" — que é a vista padrão de quem desenha figura humana.

`ORIENTATION_KEYS` resolve isso: `Front View`, `Three-Quarter Front`, `Profile View`, `Three-Quarter Back`, `Back View`, girando a partir da FRENTE do boneco. A frente sai do +Z local da raiz (o lado do nariz e dos olhos, `skeleton.ts`), achatado no chão — é o quadril que diz para onde o corpo aponta, não a cabeça. Qual dos dois lados fica a cargo de onde a câmera já está, pelo mesmo princípio dos ângulos: pedir "perfil" de quem está à direita dá o perfil direito, não um lado sorteado. Com isso um *turnaround* (itens 12 e 13 do plano) vira uma descrição reproduzível.

### A escada de planos, e o que "Wide Shot" queria dizer

Entraram `Full Shot`, `Cowboy Shot` (corta no meio da coxa) e `Medium Close-Up` (no peito). Os cortes saem de marcos medidos — a coxa é o meio entre quadril e joelho, o peito é a junta `chest`.

E **`Wide Shot` mudou de sentido**, de propósito: era "corpo justo com 15% de folga", que é o que a literatura chama de *full shot*. Manter os dois nomes para o mesmo enquadramento seria dois botões com o mesmo resultado. Agora `Wide Shot` mostra o boneco NO ambiente (ocupando ~55% da tela) e `Full Shot` é o corpo justo de antes. Quem tinha um plano geral salvo vai vê-lo mais aberto — é a única mudança de comportamento desta entrega.

### Altura de câmera é uma família diferente de ângulo

`Ground / Knee / Hip / Shoulder Level`. Parece redundante com contra-picado e picado, e não é: **ângulo é inclinação, altura é posição**. Trinta graus a dois metros descem 1 m; a vinte metros descem 10 m e furariam o chão (foi o #49). "Na altura do joelho" dá o mesmo resultado em qualquer distância. Como as duas respondem à mesma pergunta, escolher uma desliga a outra.

### Worm's-Eye saiu de graça do limite do chão

A vista de verme pede −90° e o limite do #49 a segura no piso. Não precisou de caso especial nenhum: é a vista aérea de cabeça para baixo, e o chão define sozinho o "mais baixo que dá".

### Composição, POV, two shot e contracampo

`Rule of Thirds` sobe o sujeito para o terço de cima; `Lead Room` o empurra para o lado oposto ao que ele olha. Compor fora do centro custa tela — deslocar o quadro em 1/6 exige 1/3 a mais de espaço para nada sair pela borda oposta —, e o `Lead Room` acompanha o quanto o boneco está de perfil: de frente para a câmera não há lado para abrir, e o deslocamento é naturalmente zero, sem caso especial.

No `POV Shot` a câmera avança nove centímetros à frente dos olhos em vez de nascer neles. A alternativa seria esconder o boneco, mas `visible` é conteúdo: entra no undo e sobreviveria ao preset. Um passo à frente resolve sem efeito colateral. E o olhar sai da CABEÇA, não do corpo — o pescoço pode estar torcido, e é o olhar que define um POV.

`Reverse Angle` é meia-volta na câmera viva, então compõe com qualquer vista. `Dolly Zoom` e `Crane` entraram como geradores de ponta B: o dolly zoom afasta a câmera e alonga a lente na mesma proporção, o que mantém o sujeito do mesmo tamanho porque o `fov` sai de `2·atan(12/f)`.

### Três defeitos que só o navegador mostrou

**O two shot punha um boneco atrás do outro.** Estava geometricamente certo — a conferência de quadro garantia que os dois cabiam —, mas caber não é aparecer: olhado do eixo em que os dois estão alinhados, o da frente tapa o de trás. Agora o two shot escolhe a direção perpendicular à linha que liga o par, do lado em que a câmera já estava.

**A câmera na altura do joelho ia parar dentro da pelve.** Este só aparecia com a lente padrão do app (26 mm), muito mais aberta que os 50 mm dos testes: com uma grande angular o plano médio fica a menos de um metro do corpo, e não havia como descer até o joelho sem entrar no boneco. A regra do #49 — limitar a vista, nunca o enquadramento — não servia aqui, porque uma vista de dentro do boneco não serve para nada. A distância ganhou um piso: o suficiente para alcançar a altura pedida passando a pelo menos uma largura de ombros do eixo do corpo. É a única troca em que a altura vence o tamanho do plano, e vence pouco.

**O painel virou um paredão de botões.** Com plano, ângulo, altura, lado, composição e vistas, os trinta botões precisavam de rótulos de família — sem eles não dá para saber o que COMPÕE com o quê e o que SUBSTITUI o quê.

### O pedido virou objeto

`computeShotView` tinha sete argumentos posicionais e ia para doze. Virou `ShotRequest`, um objeto — nenhuma chamada com doze posições se lê. Foi a maior mudança mecânica da entrega e valeu por si.

Suíte em **1318 testes** verdes; `tsc -b`, `eslint .` e `npm run build` limpos. Conferido no Chrome real sem erro de console: os oito degraus da escada, as cinco vistas relativas ao boneco, as quatro alturas, a vista de verme, as duas composições, POV com um segundo boneco à frente do olhar, two shot com os dois lado a lado, contracampo, e o dolly zoom fechando em 26/51/103 mm nas três posições do slider.

## 51. Enquadramento por combo, com botão de confirmar

Pedido do usuário logo depois do #50, e a razão está no que o #50 produziu: trinta botões num painel de 240 px de largura. O mecanismo é o mesmo do combo de poses (#36) — escolher no combo não faz nada, só o botão aplica —, e pelo mesmo motivo: navegar pela lista com o teclado não pode sair mexendo na câmera a cada opção.

**Quatro combos e um botão, não quatro botões.** Plano, altura, lado e composição se COMPÕEM num enquadramento só, então há um "Aplicar enquadramento" que compromete tudo de uma vez. Aplicar peça por peça faria a câmera pular quatro vezes antes de o usuário terminar de montar o que queria. No store, as cinco ações granulares viraram um `applyFraming` que enfileira um comando só.

**Ângulo e altura foram para o MESMO combo**, em dois grupos. As duas respondem "de que altura se olha" e só uma pode valer — com botões isso precisava de comentário e de um `pressed` calculado; num combo é evidente por construção, e a exclusão mútua deixou de ser uma regra a manter.

**A composição virou uma escolha de quatro**, em vez de dois interruptores independentes: centralizado, terço de cima, espaço à frente, ou os dois. As combinações válidas ficam à vista.

**As vistas da cena ficaram num combo separado, com botão próprio.** Elas SUBSTITUEM o enquadramento em vez de compor com ele — resolvem posição e distância sozinhas —, e cada uma tem a sua exigência: POV precisa de seleção, over-the-shoulder e two shot precisam de dois bonecos, e o two shot ainda precisa de um plano aplicado, que é o tamanho que ele usa. O botão segue a vista escolhida e a dica diz o que falta.

**O termo em inglês continua vindo primeiro**, agora antes de um travessão (`Close-Up — Primeiro plano`), porque `<option>` não tem duas linhas. A regra do #47 não muda: o que vai para o prompt é o que está antes do travessão. Os botões que sobraram — os movimentos — continuam com termo em cima e legenda embaixo.

**Escopo:** só os enquadramentos, como pedido. Lente (botões numéricos de milímetros), movimento e inclinação holandesa continuam como estavam — não são escolhas de uma lista, e o slider da inclinação é contínuo.

Duas coisas que só apareceram no navegador: os combos estouravam a largura do painel (um `<select>` não encolhe abaixo do conteúdo sem `min-width: 0`, e as opções são longas), e o rótulo "Vistas" colidia com o "Vistas ortográficas" que já existia no mesmo painel — virou "Vistas da cena".

Suíte em **1316 testes** verdes; `tsc -b`, `eslint .` e `npm run build` limpos. Conferido no Chrome real sem erro de console: escolher no combo não move a câmera, o botão aplica, o enquadramento composto (americano + altura do joelho + 3/4 de frente + terços) sai num movimento só, e o combo de vistas aplica two shot e POV.

## 52. Mini animador: as quatro decisões que o pedido deixou em aberto

Pedido do usuário em 2026-07-27: um mini animador que interpola entre vários keyframes — bonecos posicionados + posição de câmera + duração em milissegundos — e exporta MP4, reusando o mecanismo de interpolação já existente e avaliando a `mediabunny` para o vídeo. O plano completo está em `PLANO.md` > "Mini animador (fase 10)"; aqui ficam só as decisões, que ele tomou depois de eu levantar três inconsistências entre o pedido e o código.

**Isto muda o escopo declarado do projeto.** O topo do `PLANO.md` dizia, desde a primeira linha, "**Fora de escopo:** geração de animações", e a seção de ideias repetia a restrição. A mudança é deliberada e do usuário; o texto do plano foi atualizado nos três lugares em vez de ficar contradizendo o que passou a existir.

**"Keyframe" já estava ocupado, e o usuário escolheu devolver a palavra.** No app, keyframe era a imagem PNG exportada: o painel "Keyframes", o `kf001.png`, a tecla `Espaço`, o campo `keyframeCounter` do formato da cena. Havia três saídas — chamar os marcos da animação de outra coisa, aceitar a ambiguidade, ou renomear o PNG. Ele escolheu a terceira: o PNG vira **instantâneo**/`snapshot` e "keyframe" passa a significar o que a palavra significa em todo lugar. É a opção mais cara (mexe em pastas, componentes, store, i18n, nome de arquivo e um campo persistido) e a única que não deixa dívida de vocabulário. O campo gravado passa a ser `snapshotCounter`, com leitura do `keyframeCounter` antigo como fallback, sem subir a versão do schema; o prefixo do arquivo vai de `kf###` para `snap###` continuando a mesma contagem por cena.

**A correção de chão sai na animação e fica na mistura.** O `blendPoses` (#43) levanta o boneco quando a pose intermediária afunda — medido em 17 cm no caminho de "em pé" para "ajoelhado". Mas o pedido diz, com todas as letras, que atravessar o chão não é problema e que quem resolve é o usuário com os keyframes certos. Reusar o mecanismo como está entregaria um movimento vertical que ninguém pôs nos keyframes; então a correção vira opção, ligada por padrão (o slider de mistura não muda) e desligada pelo animador. De quebra sai o custo de reconstruir as 32 juntas de cada boneco a cada quadro só para medir o afundamento.

**Um buraco que só a animação revela:** `BlendablePose` carrega `positionY` e mais nada de posição — a mistura de poses nunca precisou de X/Z porque acontece parada no lugar. Uma animação precisa, e o amostrador interpola a posição inteira. Não é defeito do #43: é o mecanismo sendo usado num eixo para o qual não tinha sido pedido.

**A animação vive no workspace, como a biblioteca de poses (#42), não na cena.** `localStorage` mais um `animations.json` na pasta, ao lado do `poses.json` e do `joint-limits.json`; entra no undo e no autosave, e **não** viaja no `.glb`. Consequência aceita: o `.glb` continua sem canais de animação glTF, o que mantém intacta a ida e volta com o Blender já validada na fase 6.

**A exportação do PNG também passa a esconder o destaque da junta selecionada.** O pedido diz que o vídeo tem de mostrar exatamente o que sairia numa imagem exportada — e hoje não mostraria: a captura esconde grade e gizmos por nome de objeto, mas o destaque amarelo é cor de material, aplicada por prop no `Figure.tsx`, e sai no PNG. Em vez de duas regras diferentes, o usuário escolheu corrigir a captura: uma opção só ("Ocultar grade/gizmos") esconde as três coisas, nas duas saídas. É a única das quatro decisões que muda o comportamento de um recurso já entregue.

**`mediabunny` aprovada (1.51.0).** Licença **MPL-2.0** — copyleft fraco, por arquivo: como dependência não modificada, não alcança o nosso código. Vale contrastar com a `mannequin.js`, descartada no início do projeto justamente por licença (GPL-3.0): a diferença aqui é real, não é a mesma situação. Zero dependências de runtime, TypeScript puro, tree-shakable e funcional offline depois de empacotada — a regra de "nenhuma dependência de rede em runtime" continua valendo. O `CanvasSource` lê o nosso próprio canvas WebGL e o `add(timestamp, duration)` devolve promessa de contrapressão, que é a forma exata do laço quadro a quadro. Descartada a `mp4-muxer` do mesmo autor: só empacota, deixaria a codificação em WebCodecs cru por nossa conta, e a `mediabunny` é a sua evolução.

**A exportação é quadro a quadro, não gravação de tela.** `canvas.captureStream()` + `MediaRecorder` seria menos código, mas grava em tempo real: a taxa de quadros passaria a depender da velocidade da máquina e o mesmo projeto sairia diferente a cada exportação. Renderizando quadro a quadro com o relógio nas nossas mãos, o arquivo é função apenas dos keyframes — e uma máquina lenta só demora mais, nunca produz outro vídeo.

**Consequência assumida, não escondida:** a interpolação existente é linear em `t`, então a velocidade é constante dentro de cada trecho e muda de golpe em cada keyframe. É o que a premissa "usar o mecanismo já existente" pede. Suavização de entrada/saída fica anotada como ideia, não construída.

### 52.1. O que a execução acrescentou (2026-07-27)

**A medição prevista no plano foi feita, e não mandou trocar de caminho.** A dúvida era se publicar a cena amostrada como estado React a cada quadro (≈500 objetos com 5 bonecos) seria caro demais, com o caminho imperativo — escrever nos `Group`s vivos — como saída. Medido no Chrome real (headless, 1600×900, 5 bonecos, dois keyframes bem distantes, janelas de 5 s): **mediana de 166,7 ms por quadro com a cena parada e 166,6 ms tocando**. Ou seja, a reprodução não acrescentou **um único intervalo de vsync** ao tempo por quadro; o custo do commit ficou abaixo da resolução da própria medição (16,7 ms), e portanto muito abaixo do limite de ~30 ms que mandaria trocar. O tempo por quadro naquele ambiente é da rasterização por software do headless, não do animador — num navegador com GPU ele cai, e a conclusão só melhora. O caminho imperativo continua anotado como saída, agora sem motivo para usá-lo.

**Esconder os apoios de tela virou um passe POR QUADRO, não um antes do laço.** Era o desenho óbvio esconder uma vez, exportar e restaurar no fim. Mas entre um quadro e outro há um commit de React (o `flushSync` que põe a cena do quadro) e o `update` do `TransformControls`, e qualquer um dos dois pode reacender um overlay no meio da exportação. Um passe pela árvore por quadro é ruído perto de renderizar a cena, e elimina a classe inteira de bug.

**O laço de exportação não recebe "desenhe" e "codifique" separados.** A primeira versão tinha `drawFrame` e `sink.addFrame` como dois passos do laço — e estava errada: `renderAtResolution` devolve o canvas ao tamanho da janela logo depois do `render`, então o codificador leria um quadro do tamanho errado. Os dois viraram um `encodeFrame` só, que renderiza e entrega no mesmo passo síncrono e devolve a contrapressão. O contrato ficou explícito no tipo, em vez de ser uma regra a lembrar.

**A linha do tempo tinha de NAVEGAR, não só marcar posição.** Na primeira versão, arrastar o slider só mudava um número: nada aparecia na tela, porque só a reprodução amostrava a animação. Isso torna a linha do tempo decorativa — e é justamente com ela que se confere um trecho sem esperar a animação tocar inteira. Arrastar virou um comando (`seek`) que o player atende amostrando aquele instante e pondo o resultado na tela, sem tocar na cena de trabalho. É deliberadamente diferente de "Ir para", que existe para AJUSTAR um keyframe e por isso carrega o retrato para a cena de verdade.

**Capturar sempre larga a pré-visualização.** O retrato é da cena de TRABALHO, e a pré-visualização é da animação: capturar com a animação na tela deixaria o usuário vendo uma coisa e gravando outra. Capturar (e regravar) passou a parar a reprodução e a limpar a pré-visualização antes, para que o que está na tela seja o que vai para o keyframe.

**Um buraco de estado que só aparece encurtando um trecho:** a linha do tempo pode ficar parada além do fim da animação (bastava reduzir uma duração), e o painel mostrava "2,0 s de 0,6 s". O instante exibido passou a ser sempre grampeado ao total, e apertar "tocar" com a linha do tempo no fim recomeça do zero — que é também o que se espera ao tocar de novo.

**Peso da `mediabunny`, medido e não estimado:** o bundle vai de 1.456,60 kB para 1.616,44 kB, ou **+159,84 kB (+41,45 kB comprimido)**, com o *tree-shaking* deixando só o caminho de escrita de MP4. Continua valendo o aviso de chunk >500 kB que o `three` já provocava.

**Verificado no Chrome real, sem erro de console:** três keyframes capturados com poses e enquadramentos diferentes, "ir para" devolvendo a cena ao retrato, reprodução na tela e um **MP4 de verdade** — `Corrida.mp4`, 265.512 bytes, caixa `ftypisom`, 15 quadros a 24 fps de uma animação de 0,6 s a 1080×1080. Os codecs disponíveis naquele navegador eram `avc1`, `av01` e `vp09`; a ordem de preferência escolheu H.264, como planejado.

**Dois ajustes de UI que só o navegador mostrou:** o rótulo "Nome" do painel colidia com o nome do boneco e o da cena (virou "Nome da animação" — mesma classe do "Vistas" do #51), e os botões "Renomear" e "Regravar" saíam cortados na largura de 240 px. E uma decisão de layout: com **sete** colunas, o painel de Animação nasce **recolhido** — é o único que não faz parte do fluxo de posar e capturar. Isso obrigou a corrigir a leitura das preferências, que só aceitava `true`: um painel recolhido por padrão precisa que o `false` gravado ao expandi-lo também valha, senão ele voltaria recolhido a cada sessão.

## 53. Máscara de enquadramento, e a caixa da pose em dupla

Pedido do usuário em 2026-07-27, logo depois da fase 10: construir a máscara de *letterbox* que o #52 tinha deixado anotada e não construída, e uma caixa para ligar/desligar a montagem automática do par (#41). Duas escolhas foram levadas a ele antes de começar; as duas recomendações foram aceitas.

### Máscara de enquadramento

**O problema é antigo e o #52 só o tornou visível.** A exportação — PNG desde a fase 5, MP4 desde a fase 10 — troca a proporção da câmera em `applyOutputAspect`. Ou seja: o enquadramento composto na tela **nunca** foi o do arquivo, e a diferença cresce quanto mais a janela se afasta da resolução de saída. Com sete painéis abertos numa tela de 2400×1250, a área de desenho fica em 1166×1186 — quase quadrada — enquanto a saída padrão é 16:9. Compor ali e exportar era um chute.

**Um controle só, na Toolbar, com três estados** (decisão do usuário entre três desenhos): *sem máscara* / *do instantâneo* / *da animação*. As duas resoluções são independentes — dá para ter um PNG 4K quadrado e um vídeo Full HD —, e uma caixa em cada painel abriria a pergunta "e se as duas estiverem ligadas?". Um seletor não tem essa pergunta. Fica ao lado da régua, que é a outra preferência de tela, e é persistido no mesmo `webposer:ui:v1`.

**Escurecer por fora, com contorno fino** (decisão do usuário entre três aparências), como Blender e Maya: tarja opaca esconderia o que está logo fora do quadro, que é justamente o que se quer ver ao decidir se cabe; só contorno se perde em cena clara.

**A máscara SOZINHA mentiria.** Este é o ponto que o item anotado no #52 não previa. Desenhar um retângulo 16:9 dentro de uma janela quase quadrada e escurecer o resto sugere que o arquivo é aquele recorte — e não é: a exportação preserva o campo de visão **vertical** e ALARGA o horizontal, então o arquivo contém laterais que a janela nunca chegou a mostrar. Para o retângulo dizer a verdade, a câmera tem de se afastar até o quadro inteiro caber. O fator é exato e sai numa linha: **altura do retângulo ÷ altura da janela** (1 quando a saída é mais estreita que a janela — aí só sobra dos lados, e basta cobrir a sobra).

**O afastamento é `setViewOffset`, não `camera.zoom`.** `zoom` já tem dono: é por ele que o `CameraRig` faz a câmera ortográfica equivaler à distância da perspectiva (`computeOrthographicZoom`). Disputar o mesmo campo quebraria a projeção ortográfica ou obrigaria a multiplicar o fator da máscara em cada um dos cinco pontos em que o `CameraRig` escreve `zoom`. `view` é um canal separado, funciona igual nas duas câmeras e some com um `clearViewOffset` — o teste trava que a ortográfica se afasta pelo fator certo **com o `zoom` dela intocado**.

**A exportação suspende o afastamento — e é isso que mantém a promessa de pé.** `applyOutputAspect` limpa o deslocamento de vista antes de renderizar e o devolve depois. Sem isso o arquivo sairia com as próprias barras da máscara desenhadas nele. Como `applyOutputAspect` é a peça única compartilhada por PNG e MP4 (#52), a garantia vale para as duas saídas de graça.

**As barras são DOM, não objeto de cena.** Duas consequências que se somam: nada ali pode vazar para o arquivo (o PNG e o MP4 leem o buffer do WebGL, que a máscara nunca toca), e o véu sai de um `box-shadow` só, sem geometria nem material novos. `pointer-events: none` mantém órbita e seleção funcionando por baixo.

**Compensação do arrasto de deslocamento, que só apareceu ao pensar no uso.** O `OrbitControls` calcula quanto andar a partir do `fov` e da altura do elemento (confirmado no fonte do `three-stdlib`) e **não** consulta o deslocamento de vista — então, com a câmera afastada, a cena andaria `fit` vezes menos que o cursor e o ponto sob o mouse escorregaria. `panSpeed` multiplica o delta em pixels antes dessa conta, então `1/fit` cancela o afastamento exatamente. Girar e aproximar não precisam de nada: um é radianos por pixel, o outro é fator de escala, e nenhum depende da extensão do quadro.

### Caixa da pose em dupla

**Uma opção do store, não uma leitura do store de UI.** `applyPosePreset` ganhou um terceiro parâmetro opcional (`{ pairPartner }`), com o padrão sendo montar o par — todo o comportamento do #41 continua valendo para quem chama sem dizer nada. Quem decide é o painel. O caminho contrário (o store espiando o `uiStore`) acoplaria conteúdo a preferência de tela e tornaria o comportamento de uma ação do store dependente de estado invisível para quem a chama.

**A caixa só aparece quando há um par para montar** — pose em dupla E exatamente dois bonecos —, que é a mesma condição do aviso do #41; fora disso, marcar não mudaria nada. Como a escolha é persistida, quem prefere montar à mão não precisa desmarcar de novo a cada pose. O aviso troca junto com a caixa: marcado, ele diz que o outro boneco vai ser posado; desmarcado, diz que ele fica intocado e que a distância a usar está na dica da pose logo acima.

**Desmarcada, o parceiro fica idêntico — não "quase".** O teste compara a **identidade do objeto**, não os campos: aplicar a pose não pode nem recriar o boneco parceiro, senão ele entraria no histórico de undo como se tivesse mudado.

**Persistência com a leitura dos dois valores.** O padrão desta preferência é LIGADO, então aceitar só `true` na leitura (como o arquivo fazia originalmente para a régua) faria o desligamento ser esquecido a cada sessão — o mesmo defeito corrigido no #52.1 para o painel que nasce recolhido. Ficou explícito no comentário, porque é a segunda vez que essa armadilha aparece.

### Verificação

**23 testes novos, suíte em 1.434 testes** verdes; `tsc -b`, `eslint .` e `npm run build` limpos. Peso: **+4,13 kB no bundle** (1.616,44 → 1.620,57 kB).

**No Chrome real, sem nenhum erro de console**, numa área de desenho de 1166×1186 (quase quadrada, o caso difícil):

- Máscara 16:9 medida em **1,7778** de proporção, centrada (265,1 px acima × 265,2 px abaixo); trocando a resolução do instantâneo para quadrada ela vira **1,0000**; trocando a fonte para a animação em 4K ela acompanha a resolução do vídeo.
- **O PNG exportado saiu byte a byte idêntico com e sem máscara** (100.368 bytes nos dois) — a prova de que o afastamento não contamina o arquivo.
- **O que a máscara delimita é o que o arquivo contém:** a silhueta do boneco medida dentro do retângulo claro na tela e no PNG de 1920×1080 gravado em seguida difere no máximo **0,12% do quadro** (0,0012 no topo, 0,0005 à direita) — cerca de 1 px em 1080.
- **Arrasto de deslocamento:** 200 px de arrasto moveram a cena **176,4 px sem máscara e 174,7 px com** (1% de diferença, ruído da medição por centroide). Sem a compensação teriam sido ~97,5 px, já que o afastamento ali era de 0,553.
- **Pose em dupla:** desmarcada, aplicar "Aperto de mão" deixou o segundo boneco em Z = 0; marcada, ele foi para **0,755 m**, a distância da tabela do #41. As duas preferências sobreviveram a recarregar a página.

**Um rótulo ambíguo, de novo.** "Enquadramento" na Toolbar colidia com o fieldset "Enquadramento" do painel de Câmera — terceira vez que isso aparece (o "Vistas" do #51, o "Nome" do #52.1). Virou "Máscara de enquadramento". Vale registrar o padrão: rótulo curto e genérico num app com sete painéis quase sempre já existe em outro lugar.

## 54. Fim da reprodução devolve a cena, e o keyframe intermediário

Dois pedidos do usuário em 2026-07-28: parar a animação ao chegar ao fim da linha do tempo, e um botão para criar um keyframe intermediário na posição do slider.

### O que "parar no fim" queria dizer

**A reprodução já parava** — o laço tem `pause()` desde a fase 10, e conferi no Chrome antes de mexer: o slider estaciona em 2,0 s de 2,0 s e o botão volta a "Tocar", e assim fica. (Uma primeira sonda minha sugeriu o contrário; era artefato de medição — as leituras via Playwright levaram 1,3 s de uma animação de 2 s, e a última caiu depois do fim. A sonda foi refeita amostrando dentro da própria página.)

Levado isso ao usuário, o que faltava era outra coisa: **a pré-visualização continuava presa na tela**. Enquanto ela está lá, o `Viewport` renderiza o retrato da animação no lugar da cena de trabalho — então editar não aparece em lugar nenhum, e era preciso apertar "Parar" para voltar a trabalhar. Chegar ao fim passou a **largar a pré-visualização**.

**A câmera fica onde a animação terminou, e a linha do tempo também.** Não é "Parar" (que rebobina): o enquadramento final é justamente o que se quer conferir depois de assistir, e o slider no fim diz onde a animação acabou. O que sai de cena é só o retrato dos bonecos.

**Pausar e navegar continuam segurando a pré-visualização**, de propósito: ali o usuário está PEDINDO para ver um instante. Só a chegada automática ao fim solta — que é onde não há gesto nenhum dizendo "continue me mostrando isto".

### Keyframe intermediário

**Cortar um trecho não pode mudar a animação** (decisão do usuário entre dividir a duração e empurrar o resto para frente). O keyframe novo guarda exatamente o que já se via naquele instante, e a duração do trecho cortado se reparte entre as duas metades: o total e o instante de todos os outros keyframes não se mexem. É um ponto de ajuste, não uma edição — e é o que permite usá-lo do jeito natural: inserir, "ir para", corrigir só o que incomodava naquele meio do caminho.

**Isso só é verdade porque a interpolação tem propriedade de semigrupo** — e verificar isso foi o trabalho de verdade. Distância e lente andam em progressão geométrica, a direção da câmera anda por arco, a pose anda por eixo e o giro do root pelo menor arco: em todas, cortar no meio e reinterpolar cada metade reproduz o mesmo caminho. Confirmado por medição, não por argumento: cada junta, cada eixo, posição, alvo e lente batem a 1e-9 em onze instantes ao longo do trecho.

**Menos um canal, e ele obrigou a uma peça nova.** O topo da tela (`up`) é interpolado em linha reta e só então reendireitado contra a direção de visão. Guardar no keyframe o valor JÁ reendireitado faz cada metade partir de outro lugar da reta original — **medido: 1,46° de desvio de orientação num par comum e 3,29° com ângulo holandês entre as pontas**, ou seja, o horizonte inclinaria diferente no meio do trecho e a promessa seria falsa. O `splitCameraView` guarda o valor da reta, **antes** de reendireitar, e com isso o desvio cai para o piso da medida (~1e-6 grau, que é a resolução de um `acos` em ponto flutuante duplo). Não muda nada do que se vê: os dois vetores geram o MESMO plano com a direção de visão, e é o plano que define a orientação — o `lookAt` reendireita sozinho. Um teste trava justamente isso: os vetores `up` são diferentes e a orientação é idêntica.

**Errei a métrica antes de acertar o código.** A primeira versão do teste comparava vetor `up` com vetor `up` e acusou 16,8° de "desvio" logo depois da correção — medindo a representação, não a imagem. A comparação certa é entre as bases ortonormais das câmeras, que é o que o espectador vê.

**O corte tem de cair estritamente dentro de um trecho.** Em cima de um keyframe não há o que dividir, e uma metade de duração zero seria grampeada para 1 ms por `clampKeyframeDuration` — alongando a animação justamente na operação que promete não mexer nela. O botão fica desabilitado nesses casos, e também durante a reprodução, onde o instante mudaria entre ver o botão e clicá-lo.

**Inserir navega até o keyframe novo.** É o passo seguinte natural (inserir → ajustar), e é o que põe na tela o que se vai editar. Diferente de "Ir para", que carrega o retrato para a cena de trabalho, aqui basta a navegação: o keyframe acabou de ser criado a partir do que já estava na tela.

### Verificação

**20 testes novos, suíte em 1.454 testes** verdes; `tsc -b`, `eslint .` e `npm run build` limpos.

**No Chrome real, sem erro de console:**

- Depois de a animação chegar ao fim, **aplicar uma pose mudou a tela** — a prova direta do pedido, já que com a pré-visualização presa a edição não apareceria.
- O botão fica desabilitado no instante 0 e no fim, e habilitado no meio do trecho.
- Inserir a 600 ms de um trecho de 1000 ms deixou as durações em **600 e 400**, com o total intacto; inserir de novo a 300 ms compôs para **300, 300 e 400**.
- E a prova visual da promessa: os quadros renderizados em 200, 400, 600 e 800 ms saíram **pixel a pixel idênticos** antes e depois da inserção.

## 55. O vídeo saía errado — e as três funcionalidades da mesma leva

Pedido do usuário em 2026-07-28: copiar a câmera de um keyframe vizinho, copiar a pose de um boneco para outro, fixar padrões (lente 35 mm, 60 fps, 720p) e **investigar por que o último quadro aparecia rapidamente no início do vídeo**.

### O defeito do vídeo, que era maior que o sintoma

**O sintoma relatado era a ponta de um problema sério: o arquivo exportado não era a animação.** Medido com um experimento comparável ponto a ponto — mesma cena, mesma câmera, mesma resolução, mesmo caminho de renderização — pondo o boneco a percorrer a tela da esquerda para a direita e medindo o centroide da silhueta em cada quadro:

| | quadros medidos (0 = borda esquerda, 1 = direita) |
| --- | --- |
| PNG do app (referência) | 0,259 · 0,334 · 0,420 · 0,519 · 0,633 · 0,758 · 0,896 |
| MP4, **antes** | **0,518** · 0,258 · 0,258 · 0,258 · 0,375 · 0,375 · 0,375 |
| MP4, **depois** | 0,258 · 0,334 · 0,420 · 0,516 · 0,627 · 0,747 · 0,872 |

Ou seja: o primeiro quadro do arquivo era a **cena de trabalho** (0,518 contra 0,523 medidos nela) e o resto avançava **aos saltos**, repetindo imagens. O que o usuário via como "o último quadro aparece rápido no começo" é a explicação exata: no fluxo normal, a cena de trabalho na hora de exportar É o último keyframe — acabou de ser capturado dela.

**A causa: dois reconciliadores de React, e um deles é assíncrono.** O `<Canvas>` do `@react-three/fiber` não desenha os filhos pelo React do DOM; ele tem um reconciliador próprio e entrega a cena com `root.render(children)` — chamado **dentro de uma função `async`**, depois de um `await configure(...)`. Duas consequências que se somam:

1. O `flushSync` do `react-dom` **não esvazia a fila do R3F**. O laço de exportação chamava `flushSync`, achava que a cena do quadro já estava na árvore, e renderizava a anterior.
2. Mesmo o `flushSync` do próprio `@react-three/fiber` **não alcança** o que chega pela prop `children`, porque aquele `root.render` acontece num microtask, fora de qualquer flush.

**A correção tem duas partes, e a segunda é estrutural.** Trocar para o `flushSync` do `@react-three/fiber` acabou com os saltos, mas sobrou **exatamente um quadro de atraso** (medido: `vídeo[i+1] == referência[i]`, com diferença de 0,0006 — o vídeo ganhava um quadro espúrio no começo e perdia o último). O conserto de verdade foi tirar os bonecos do caminho dos `children`: o novo `SceneFigures.tsx` assina as lojas **de dentro** do `<Canvas>`, então mudar a pré-visualização vira trabalho direto no root do R3F, que o `flushSync` dele esvazia na hora. Com as duas partes, o arquivo passou a bater com a referência quadro a quadro, com diferença máxima de **0,0009** — ruído de compressão H.264.

**Por que isso passou na fase 10.** A validação de lá conferiu dimensões, duração, caixa `ftypisom` e ausência de pixels amarelos — nunca **o conteúdo quadro a quadro**. É a lição da entrega: para um arquivo gerado, conferir metadados não é conferir o arquivo.

**Sonda descartada no caminho:** a primeira medição usou `requestVideoFrameCallback` durante a reprodução e, em headless, entregou dois quadros de treze. A segunda comparou o vídeo com **capturas de tela** do app, e misturou a diferença de proporção (tela 1166×1186 × arquivo 1080×1080) com o atraso. Só a terceira — PNG exportado pelo app, na mesma resolução do vídeo — isolou uma coisa da outra.

### Copiar a câmera do keyframe vizinho

`copyAnimationKeyframeCamera(animationId, keyframeId, ±1)`: leva **só** a câmera, deixando o retrato dos bonecos e a duração do trecho intactos — o teste compara a identidade do objeto `figures`, não os campos. É o gesto de "segura o enquadramento": um trecho em que a câmera fica parada e só a cena se move. Dois botões por card, desabilitados nas pontas.

### Copiar a pose de um boneco para outro

Passa pelo **mesmo caminho da biblioteca de poses** (#42) — `captureFigurePose` seguido de `withPose` —, e é isso que dá de graça todas as regras certas: vai o assentamento (juntas, inclinação do corpo e altura do quadril, esta desfeita da escala da origem e refeita na do destino, medido em 1,50/1,70 no teste); não vão o lugar no chão, a altura, a cor nem o nome; um boneco em pé preserva o giro de encenação de quem recebe; e as **juntas travadas do destino continuam intactas**. Copiar e "salvar na biblioteca e aplicar" dão exatamente o mesmo resultado, por construção.

Na UI (escolha do usuário entre três desenhos): um combo de destino mais um botão "Copiar", no painel de Propriedades, que só aparece havendo outro boneco na cena. O destino escolhido é reconferido a cada render em vez de guardado — remover o boneco de destino deixaria um id órfão.

### Padrões

- **Lente 35 mm** (`DEFAULT_FOCAL_MM`), de onde passa a sair o `CAMERA_DEFAULTS.fov`: 37,849° verticais, contra os 26,991° dos 50 mm anteriores. É a grande angular discreta do repórter — abre o bastante para corpo inteiro com ambiente, sem a distorção de rosto das ultra grandes angulares.
- **60 fps de padrão, com o seletor mantido** (decisão do usuário): 24 e 25 continuam ali para casar com material de cinema e PAL.
- **720p acrescentado à lista e padrão só do VÍDEO** (decisão do usuário). O instantâneo continua nascendo em Full HD: o PNG é referência para desenhar, e ali resolução alta é o que se quer. A exportação renderiza um quadro por vez, então a resolução multiplica direto a espera — daí o vídeo começar mais baixo. A lista de presets é a mesma dos dois painéis; só o ponto de partida difere (`DEFAULT_VIDEO_RESOLUTION_PRESET`).

### Verificação

**17 testes novos, suíte em 1.471 testes** verdes; `tsc -b`, `eslint .` e `npm run build` limpos.

**No Chrome real, sem erro de console:** a lente nasce em 35 mm, o animador em 60 fps e 720p, o instantâneo em Full HD, e a lista mostra as quatro resoluções; copiar a pose levou o joelho do boneco 2 de 0° para 40° (o valor do boneco 1) sem tirá-lo de X=2; copiar a câmera do keyframe anterior trocou a lente do keyframe 2 de 85 mm para 24 mm **deixando o joelho em 6°**; e o vídeo exportado voltou a bater com o PNG de referência em todos os quadros.

## 56. Redutor/acelerador global da animação

Pedido do usuário em 2026-07-28: um multiplicador de velocidade preenchido à mão, aplicado a **toda a linha do tempo**, sem separação por keyframe, que muda a velocidade da geração do vídeo (exemplos dados: 0,5 reduz 50%; 1,15 aumenta 15%).

**A inconsistência do enunciado, levada ao usuário:** o pedido dizia "uma casa decimal", mas o exemplo `1.15` tem duas — com uma casa, 1,15 viraria 1,2 e o vídeo sairia 4% mais curto do que o exemplo pede. O usuário escolheu **duas casas, de 0,05 em 0,05**, e a faixa de **0,1 a 5,0**.

**É multiplicador de VELOCIDADE, não de duração.** O vídeo dura `linha do tempo ÷ velocidade`: a 0,5 fica o dobro de comprido, a 1,15 fica em 87% — que é o que "reduzir 50%" e "aumentar 15%" querem dizer. Por isso `animationOutputDurationMs` divide.

**A linha do tempo não se mexe.** A velocidade é a taxa com que se anda por ela, não uma reescrita dela: os keyframes continuam nos mesmos instantes, as durações digitadas em cada card continuam valendo o que dizem, e o "inserir keyframe aqui", o slider e o "ir para" nem sabem que ela existe. Assim, mudar a velocidade de uma animação pronta não desmancha nenhum ajuste fino de tempo — e voltar a 1,00 devolve exatamente o que havia.

**Onde ela vive (escolha do usuário entre duas):** é campo da **animação**, e não ajuste de painel como fps e resolução. Entra no undo, no autosave e no `animations.json`, e por isso a mesma animação rende o mesmo vídeo amanhã — um ajuste de ferramenta voltaria a 1,00 a cada recarregamento, e o vídeo sairia diferente sem ninguém ter mexido nele. Cada animação tem a sua.

**Duas partes na implementação:**

- **Reprodução na tela:** o relógio anda `Δreal × velocidade`, e a velocidade é lida **a cada quadro** — mexer no campo com a animação tocando vale na hora, sem parar e tocar de novo.
- **Exportação:** a linha do tempo de quadros é gerada sobre a duração **de saída** (`frameTimeline(animationOutputDurationMs(...))`) e cada quadro é amostrado por `sampleAnimationOutput`, que converte o relógio do arquivo para o da animação (`tempo do vídeo × velocidade`). A 0,5 são o dobro dos quadros, cada um meio passo adiante — câmera lenta de verdade, e não a mesma coisa com quadros repetidos.

**Detalhes que os testes fixam:** `clampAnimationSpeed` arredonda à grade de 0,05 e devolve o valor exato de duas casas (sem o arredondamento final, `23 × 0,05` daria 1.1500000000000001 no campo); `animationOutputDurationMs` **não** arredonda, porque é a divisão exata que faz o último quadro cair em cima do último keyframe; sair do campo vazio devolve o valor anterior em vez de virar o mínimo; e `animations.json` sem o campo (arquivo gravado antes disto) abre em 1,00 — que é o que quem montou aquela animação viu na tela.

### Verificação

**19 testes novos, suíte em 1.490 testes** verdes; `tsc -b`, `eslint .` e `npm run build` limpos.

**No Chrome real, sem erro de console**, com um boneco atravessando a tela e o centroide da silhueta medido em cada quadro do MP4 (linha do tempo de 800 ms a 25 fps):

| velocidade | quadros | duração do arquivo | dica do painel |
| --- | --- | --- | --- |
| 1,00 | 21 (21 esperados) | 0,84 s | 0.8s |
| 0,50 | 41 (41 esperados) | 1,64 s | 1.6s |
| 2,00 | 11 (11 esperados) | 0,44 s | 0.4s |

E o caminho andado é o mesmo: os quadros **pares** do vídeo a 0,5 repetem a rampa inteira da velocidade normal com diferença máxima de **0,0005** (ruído de compressão) — o dobro de quadros cobrindo o mesmo percurso, que é a definição de câmera lenta.

A reprodução na tela foi medida pela **taxa**, não pelo tempo total: em renderização por software (headless), montar e desmontar a pré-visualização custa mais de um segundo e varia a cada rodada, então a mesma velocidade foi medida em duas linhas do tempo (2 s e 6 s) e o custo fixo cancelado na diferença. Os 4 s a mais de linha do tempo levaram **3.831 ms** a 1,00, **7.981 ms** a 0,50 e **1.959 ms** a 2,00 — contra 4.000, 8.000 e 2.000 esperados.

Persistência conferida no navegador: 1,35 digitado sobrevive a **Ctrl+Z** (volta a 1,00), a refazer e a **recarregar a página**.

## 57. Ferramentas de criação de poses padrão

Pedido do usuário em 2026-07-28: implementar os itens 1, 3 e 4 do levantamento sobre como otimizar a criação de poses. O diagnóstico que os motivou está registrado ali: o ritual de arquivos já é seguro (paridade pt-BR/en tem teste, `POSE_PRESET_LABEL_KEYS` é um `Record` completo, grupos e pares valem nos dois sentidos, e quatro invariantes já rodam sobre as 71 poses). **O custo estava em inventar os números às cegas** — como o próprio preset `fighting` documenta: "saíram de uma busca numérica que planta as DUAS pontas de pé no chão ao mesmo tempo (com o quadril em 0,90 o pé de trás flutuava 7 cm)".

### `seatOnGround` — a busca numérica virou função (item 3)

`src/figure/poseGround.ts`. Dá o `groundOffsetM`/`hipHeightM` que assenta uma pose no chão.

**A referência de "encostado" não é y=0, e isso não é detalhe.** A junta mais baixa do boneco em pé fica a **0,0100 m** do chão (medido), porque a junta é o centro de uma esfera e a geometria do pé desce abaixo dela. Assentar "com a junta mais baixa em zero" enterraria toda pose em pé nesse centímetro. Por isso a folga é **medida da pose neutra** em vez de fixada — e o assentamento da pose em pé dá exatamente zero, por construção.

Diferença para a correção de chão do `poseBlend` (#43): aquela **só levanta**, de propósito (o problema de uma mistura é atravessar o chão, não flutuar). Esta levanta e baixa — flutuar é o erro mais comum de quem monta pose à mão. Medido nos dois sentidos: tornozelo estendido afunda a ponta do pé 5,7 cm (assento +6,7 cm); dobrar os dois joelhos com o quadril parado pendura o boneco a 36,5 cm (assento −35,5 cm).

**Confronto com as 71 poses afinadas à mão:** mediana de **3,4 mm**, **59 das 71 dentro de 1 cm**. E as 9 que divergem mais de 5 cm são **exatamente** as que não pisam no chão — `superman`, `jumping`, `running` (fase de voo), `carriedCradle`, `carriedPiggyback`, `groundChokeGiving`, `groundChokeTaking`, `rearChokeSeated`, `lyingSpreadSupine` —, todas divergindo para baixo, porque o cálculo tentaria plantá-las no chão. Isso está travado por teste, e vale como **detector**: uma pose nova que apareça nessa lista sem estar no ar (ou carregada por outro boneco) tem assentamento errado.

### `poseCodegen` — posar no app e colher o preset (item 1)

`src/figure/poseCodegen.ts` mais o CLI `tools/pose-para-preset.mjs` (`npm run pose:preset -- poses.json`).

O caminho mais curto já estava quase pronto e ninguém usava: **`SavedPose` carrega exatamente os quatro dados que um preset precisa** — `pose`, `rotation`, `groundOffsetM` e o `preservesHeading` derivado deles. Faltava a tradução. Agora se posa no app (gizmo com limites, IK, espelho, travas — o editor certo), salva-se na biblioteca, exporta-se o workspace e o bloco de preset sai pronto para colar.

Cinco coisas que uma cópia crua do JSON perderia, e que o tradutor sabe:

1. O preset é **parcial** — emitir os eixos zerados de 32 juntas faria um bloco ilegível.
2. `elbow.*.y` ausente **não é zero**: é a torção neutra do antebraço (±90, #25). Copiar o valor cru apagaria a convenção do arquivo.
3. As juntas da mão saem da pose e viram `hands: 'fist'` quando batem com uma pose de mão pronta — inclusive `{ L, R }` diferentes, como as poses de apontar (#45).
4. `hipHeightM = STANDING_HIP_HEIGHT_M + groundOffsetM`, não o deslocamento guardado.
5. `rotation` presente ou ausente é o que decide o `preservesHeading` do preset.

**O teste que sustenta a ferramenta:** para **todas as 71 poses**, gerar o bloco a partir da pose resolvida e reexpandi-lo — com uma implementação independente das regras, escrita no teste — devolve a mesma pose, junta por junta e eixo por eixo, dentro do passo de arredondamento (0,1°). Colocação e direção também sobrevivem à ida e volta.

Os avisos são o resto: pose acima do assentamento calculado (`superman` avisa 104,0 cm), pose atravessando o chão (com o nome do teste que vai reprovar) e mão que não bate com pose pronta. O CLI ainda imprime as seis coisas que só a mão faz — chave na união, grupo, i18n nos dois idiomas, `POSE_PRESET_LABEL_KEYS`, teste de intenção e, se for o caso, o pareamento.

### Folha de contato (item 4)

`tools/folha-de-contato.mjs` (`npm run poses:folha`): aplica todas as poses do combo e monta um PNG único com a grade — a revisão do catálogo inteiro numa olhada, e uma linha de base para quando o esqueleto mudar.

**Duas escolhas de método, decididas por medição e não por gosto** — a primeira tentativa saiu mecanicamente correta e visualmente inútil:

- **Cada célula é um INSTANTÂNEO do app, não uma captura de tela.** Posar exige o boneco selecionado, então a captura de tela põe o gizmo de seleção em todas as células; o instantâneo passa pelo `hideOverlaysOnCapture`, que já esconde grade, gizmos e o destaque da junta.
- **Câmera em perspectiva com "plano geral", fixa.** As três candidatas foram renderizadas lado a lado com três poses extremas (T-pose, deitada, voando): a ortográfica de frente transforma toda pose deitada num borrão, a ortográfica de 3/4 sequer enquadra (o boneco sai minúsculo), e a perspectiva com plano geral lê bem nas três. Fixa em todas as células de propósito: é a câmera fixa que faz a folha **comparar** as poses — enquadrar pose a pose deixaria cada célula bonita e a folha inútil.

São duas folhas: a vista **padrão** (o plano geral como ele vem — já um 3/4 de frente) e a **girada**, o mesmo enquadramento mais 40° de órbita, perto do perfil, que é o que deixa ler a profundidade dos chutes, socos e poses sentadas. O arrasto do giro é **calculado** a partir da geometria do `OrbitControls` (2π por altura do elemento), não estimado. Os nomes dizem o que a folha é, e não o que se gostaria que fosse: o enquadramento não é uma vista frontal estrita.

**O Playwright continua fora do `package.json`.** A validação em navegador sempre rodou de fora, e pendurar os navegadores no `npm install` de quem só quer usar o app seria caro; a ferramenta aceita `--playwright=<caminho>` e, sem ele, explica como instalar.

## 58. Apoiar no chão e espelho ao vivo

Pedido do usuário em 2026-07-28: implementar os itens **33** e **3** da lista de propostas, com o lembrete de "não esquecer a referência invertida dos membros direito e esquerdo".

### Apoiar no chão (item 33)

`seatFigureOnGround(figureId)` no `figuresStore`, em cima do `seatOnGround` do #57. Mexe **só na altura**: onde o boneco está no chão é encenação de quem monta a cena, e a pose não é tocada. É conteúdo — entra no undo, como qualquer edição de posição.

**O botão aparece nas DUAS seções do painel** (raiz selecionada e junta selecionada). A primeira versão o pôs só na seção de posição, e a validação no navegador esbarrou nisso na hora: depois de dobrar os dois joelhos, quem está posando tem uma JUNTA selecionada, e teria de voltar à raiz só para apoiar o boneco — atrito exatamente no momento em que a ação é necessária. As duas seções são exclusivas, então nunca há dois botões na tela.

### Espelho ao vivo (item 3)

`liveMirrorEnabled` + `toggleLiveMirror`, interceptando **`setJointRotation`** — que é o caminho de TODA edição de junta: slider, gizmo, teclado e o resultado do IK. Interceptar ali é o que faz o modo valer em todos eles sem que nenhum precise saber que ele existe.

**A referência invertida, que é o ponto todo.** As juntas pareadas do esqueleto são espelhadas só em POSIÇÃO (offset X negado), sem espelhar a rotação — então o mesmo valor numérico em Y/Z produz o movimento anatômico **oposto** nos dois lados (#14). Copiar o valor cru erraria até 0,95 m de posição de junta (medido no #30). O que se escreve no par é a **reflexão sagital `(x, −y, −z)`**, reusando o `mirrorRotation` do `poseMirror.ts` — reusar, e não reescrever, é o que garante que o modo ao vivo e o botão "copiar direito → esquerdo" nunca divirjam.

O polegar é a demonstração mais crua disso, e virou teste: o mesmo movimento vai de 0 a **+80** no lado esquerdo e de 0 a **−80** no direito. Copiar cru não erraria "um pouco" — cairia fora da faixa do destino, seria grampeado a zero, e o polegar direito simplesmente não se mexeria.

Três decisões menores, todas com teste:

- **A rotação inteira é espelhada, não o eixo mexido.** O slider manda um eixo por vez; espelhar só ele deixaria o outro lado meio espelhado.
- **Junta travada ganha do espelho** (#42: junta travada não muda por NADA automático). Vale para o destino: editar a esquerda com a direita travada mexe só na esquerda.
- **É modo de trabalho, não conteúdo.** Fica fora do `partialize`, logo fora do undo — como as travas. Diferente delas, **não sobrevive a recarregar a página**: um modo que reescreve o outro lado a cada edição não pode voltar ligado sem ninguém ter pedido.

### Verificação

**18 testes novos** (15 de loja, 3 de painel), suíte em **1.671 testes** verdes; `tsc -b`, `eslint .` e `npm run build` limpos.

**No Chrome real, sem erro de console:** um boneco erguido à mão para Y=0,5 voltou a 0 ao apoiar; com os dois joelhos dobrados a 90°, apoiar **baixou** o boneco para Y=−0,355 — o mesmo valor que o teste de unidade mede, e a prova de que a função desce, e não só sobe. Com o espelho ligado, `shoulder.L z = 35` escreveu `shoulder.R z = −35`; com `shoulder.R` travado, a esquerda foi para 10 e a direita ficou em −35; desligado, a esquerda foi para −20 e a direita continuou onde estava.

## 59. Zerar por grupo e copiar só um membro

Pedido do usuário em 2026-07-28: os itens **4** e o resto do **2** da lista de propostas.

### Zerar por grupo (item 4)

`resetJointGroup(figureId, group)` e um bloco de seis botões — tronco, cabeça, os dois braços, as duas pernas —, com os rótulos dos MESMOS grupos que o combo de seleção de junta já usa: quem se acostumou com eles não aprende nomes novos.

**"Zerar" é voltar à pose NEUTRA, não a zeros literais**, e a diferença é visível: `elbow.*.y` tem torção neutra de ±90 (#25), então escrever zero deixaria o antebraço com a palma para trás. A regra vem reusada do reset por junta (fase 9, item 6), que já resolvia isso — medido no navegador: zerar o braço direito devolveu `elbow.R.y = −90`, e não 0.

A mão vai junto com o braço, porque `JOINT_GROUPS` já a inclui — e um "zerar só as mãos" à parte seria redundante: a pose de mão "aberta" já é exatamente a neutra.

Duas escolhas menores: junta travada sobrevive ao reset (#42), e **grupo inteiro travado deixa o botão desabilitado** em vez de virar um botão inerte — mesma escolha do slider de junta travada. Com tudo travado a ação nem empilha passo de undo.

### Copiar só um membro (resto do item 2)

`copyFigurePose(fromId, toId, group?)`. Sem grupo, é o que já existia: a pose inteira pelo caminho da biblioteca de poses, com assentamento. Com grupo, **só aquelas juntas — e a colocação de quem recebe não é tocada**.

Essa diferença é a decisão do item, não um detalhe de implementação: o assentamento (inclinação do corpo e altura do quadril) é propriedade da pose INTEIRA, e aplicá-lo por causa de um braço tiraria o boneco do chão onde ele estava. Copiar ângulos de junta também dispensa a captura e a reescala do `captureFigurePose`, porque ângulo não depende da altura do boneco — só o assentamento depende, e ele justamente não viaja.

Na UI, um combo "O que copiar" ao lado do destino, com "Pose inteira" mais os seis grupos, e a dica do botão trocando junto para dizer o que vai (e o que não vai) acontecer.

### Verificação

**14 testes novos** (11 de loja, 3 de painel), suíte em **1.685 testes** verdes; `tsc -b`, `eslint .` e `npm run build` limpos.

**No Chrome real, sem erro de console:** zerar o braço direito levou `shoulder.R.x` de −55 a 0 e `elbow.R.x` de −80 a 0, deixando `elbow.R.y` em **−90** (a torção neutra) e a perna esquerda intacta em 45°; com pescoço e cabeça travados o botão "Cabeça" apareceu desabilitado; e copiar só o braço esquerdo levou `shoulder.L.x = −70` para o outro boneco **sem** mexer no joelho dele nem tirá-lo de X=2.

**Um erro que a validação pegou:** o teste de painel usava `getByRole('button', { name: 'Copiar', exact: true })`, e `exact` não existe nas opções do Testing Library (existe no Playwright). O Vitest não faz checagem de tipos, então os 57 testes passaram; foi o `tsc` da build que reprovou — e, como a build falhou, o preview continuou servindo o pacote antigo e a sonda não achou os controles novos. Vale como lembrete: sonda que não acha um controle novo pode estar olhando para uma build velha.

## 60. Trechos de animação prontos (solo e em dupla)

Pedido do usuário em 2026-07-28: trechos de animação predefinidos, análogos às poses de fábrica — andando, pulando e correndo como cenas individuais; dança, aperto de mão, cavalinho, pegando no colo, clinche, soco, chute e os três mata-leões (em pé, sentado, deitado) como cenas em dupla. Complemento na mesma conversa: **os mata-leões começam com os dois em pé, o adversário já de costas**, e entra um trecho a mais — **empurrar pelo ombro e girar** — em que B termina de costas para A, servindo de entrada para qualquer golpe por trás. Decidido junto (perguntas feitas antes de implementar): o trecho entra **no final da linha do tempo atual**; as duplas escolhem os papéis em **dois combos** no painel; andar/correr/pular **deslocam o boneco pelo espaço**; e a **câmera atual fica congelada** em todos os keyframes gerados.

### O modelo: passos declarados sobre as poses que já existem

`src/animation/animationClips.ts` — 14 trechos (3 individuais + 11 duplas), cada um de 5 a 15 passos (89 no total), cada passo = pose de fábrica + desvios parciais (`overrides`) + colocação. Três decisões estruturais:

- **As poses-chave dos encontros não foram redigitadas**: o instante de contato de cada golpe/carga usa as poses em par de `posePresets.ts` na MESMA distância medida de `posePairs.ts` (soco 0,629, chute 0,815, aperto 0,755, clinche 0,40, mata-leão 0,39/0,45/0,10, cavalinho −0,16, colo 0,28) — travado por teste: mudou a tabela do par, o teste do trecho acusa. A composição de rotação por matriz saiu de `resolvePairedRotation` para a função exposta `composePlacementRotation`, reusada pelos trechos (somar graus em Y rolaria o corpo das poses deitadas).
- **Referencial do trecho = boneco do papel A**: tudo é declarado com A na origem olhando +Z; aplicar gira deslocamentos e rotações pelo heading atual de A e parte da posição dele. "Andar para a frente" é a frente que o usuário deu ao boneco (validado no teste: A a 90°, andar avança em +X). Deslocamentos no chão escalam pela altura (média das duas escalas nas duplas, como na montagem de pares).
- **A referência invertida dos membros L/R (lembrada pelo usuário, #14) entra pelos espelhos, não à mão**: a passada oposta do andar/correr é `mirror: true` — espelho sagital exato da pose inteira (`swapPoseSides` + `(x,−y,−z)` nas juntas centrais). Exceção deliberada: as passadas de quem CARREGA (cavalinho/colo) espelham só as pernas, declaradas nos dois lados à mão — espelhar o corpo inteiro trocaria os braços de lado e desfaria a pegada.

### Assentamento numérico em vez de altura chutada

Um passo pode pedir `seat: true`: o deslocamento vertical sai do `poseGround.ts` (#57) com a pose e a rotação daquele passo — é o que os agachamentos do salto, as fases de luta e as passadas usam. `liftM` dá a folga das fases aéreas (corrida +0,08) e `hipHeightM` explícito vale para o que é para ficar no ar (ápice do salto a 1,25; quem é carregado). A medição de TODOS os 89 passos pegou dois erros antes de qualquer teste: a passada do cavalinho afundava o carregador 5,4 cm (perna de trás re-varrida numericamente até o assentamento coincidir com o do preset, −0,036 vs −0,040) e o "debater-se" do mata-leão sentado usava `hip.L −75` — sentado com a perna horizontal em −90, ERGUER a perna é flexionar MAIS (−105); −75 enterrava o pé 34 cm no chão.

### Aplicação: uma edição, cena de trabalho intacta

`appendAnimationClip` (figuresStore) monta um keyframe por passo — retrato da cena ATUAL com os papéis substituídos, então quem não participa aparece parado em todos os passos — e acrescenta tudo num único `set`: **um Ctrl+Z remove o trecho inteiro**. A cena de trabalho não muda (só a animação ganha keyframes). O comando passa pelo `animationStore`/`AnimationPlayer` como a captura, porque só o player lê a câmera viva; dupla sem dois bonecos DISTINTOS é recusada sem tocar em nada. No painel, um fieldset "Trechos prontos": combo agrupado (individuais/duplas), dica por trecho, combos de papel A/B (B não lista o boneco de A; escolhas caem no padrão se o boneco sair de cena) e o botão com as mesmas condições da captura.

Detalhes que valem registro: os ciclos de andar/correr/dança terminam NA pose do primeiro passo (adicionar o trecho duas vezes emenda sem solavanco — na dança o giro de 360° embrulha para 0 pelo `cleanDegrees`); e o giro do empurrão anda 60° por keyframe sempre no mesmo sentido porque a interpolação da rotação do boneco é pelo menor arco (`lerpAngle`) — passos < 180° nunca giram ao contrário.

### Verificação

**51 testes novos** (28 do módulo, 9 da ação no store, 4 de painel + locales/estrutura), suíte em **1.726 testes / 73 arquivos** verdes; `tsc -b`, `eslint .` e `npm run build` limpos.

**No Chrome real, sem erro de console:** "Andando" criou 9 keyframes, "Soco" somou 15, "Mata-leão deitado" somou 22; os combos de papel apareceram só na dupla, com B sem listar o boneco de A; a linha do tempo tocou 3 s; **um** Ctrl+Z removeu os 9 keyframes do trecho recém-adicionado; e as capturas de tela conferiram o impacto do soco (punho no rosto, B arqueado), a chave sentada (A ajoelhado atrás de B sentado) e o mata-leão no chão (A por baixo com as pernas em volta, B por cima) — com o boneco que não participa parado em T-pose onde estava.

## 61. Guarda de luta: cotovelo direito baixado

Pedido do usuário em 2026-07-28: na pose "Luta", deixar o cotovelo direito mais baixo.

Medido antes de mexer: o braço de trás (`shoulder.R {x:-70, y:70, z:-70}`) punha o punho junto ao queixo, mas o COTOVELO ficava em **1,499 m — acima da linha do ombro — e 33 cm aberto** para o lado: braço de "asa", não guarda. A primeira varredura, presa só ao punho, não resolvia: o cotovelo gira num cone em volta da linha ombro–punho, e o ponto mais baixo desse cone ainda ficava alto e aberto.

Re-resolvido com as mesmas penalidades explícitas que consertaram o clinche (#37) — **cotovelo pelo menos 18 cm ABAIXO do punho e a no máximo 26 cm da linha média** —, varrendo `shoulder.R` e `elbow.R` em passos de 5° com refino de 1°. Resultado: `shoulder.R {x:-94, y:37, z:20}` (o `z` na adução máxima de +20, colando o braço ao corpo) com `elbow.R` inalterado em −135. Medido: cotovelo desce de 1,499 para **1,237 m** (18,9 cm abaixo do punho, 25 cm da linha média) e o punho fica a **2 mm** de onde estava — a guarda não muda, só o cotovelo desce.

A mudança propaga sozinha para os trechos de animação (#60): os passos de guarda do soco, do chute e do clinche usam o preset, não uma cópia.

### Verificação

Suíte em **1.726 testes** verdes (as travas da pose — punho na altura do rosto, à frente dele, pés plantados — seguem valendo); `tsc -b`, `eslint .` e `npm run build` limpos. Conferido no Chrome real, sem erro de console, de frente e de lado: os dois cotovelos apontam para baixo e o antebraço de trás fica quase vertical com o punho no queixo.

## 62. Poses e trechos de dança pop (K-pop)

Pedido do usuário em 2026-07-28: "3 poses e animações associadas para 3 posições comuns de dança do K-pop", seguindo o processo registrado em `CRIACAO-PRESETS.md`. Antes de implementar, 3 perguntas: quais movimentos (recomendei coração/robô/apontar, avisando que um V-sign clássico não dá para fazer — o modelo de mão não separa o dedo médio dos outros dois); onde encaixar as poses no catálogo; se cada animação seria um trecho novo independente ou uma variação da "Dança" genérica já existente. Respostas do usuário: **4** poses (acrescentou "onda de ombro" à recomendação), **novo grupo** "Dança pop", e **4 trechos solo independentes**.

### As 4 poses (`src/figure/posePresets.ts`, grupo `kpop`)

Todas resolvidas por varredura numérica com sweep grosso (passo 5–15°) e refino fino (passo 1°), a mesma técnica do #37/#61 — nenhum ângulo estimado a olho:

- **`kpopFingerHeart`** (coração com os dedos): mão em `pinch` (já existente no catálogo — as pontas do polegar e indicador já se tocam, é literalmente a forma do gesto) erguida perto do rosto. Alvo: punho a (0,12; 1,57; 0,13), com as mesmas penalidades do #61 (cotovelo abaixo do punho, perto da linha média). Resultado: punho a **5,2 cm** do alvo, cotovelo **5,4 cm** abaixo dele e a **16 cm** da linha média.
- **`kpopBoxArms`** (braços de robô): ombro na horizontal para o lado, cotovelo em ângulo reto, antebraço na VERTICAL — o "cactus arms". Não tinha alvo de contato; a busca teve dois pontos-alvo (cotovelo na altura do ombro, punho 0,245 m acima dele) e fechou com **custo zero**: `shoulder.R {x:-90, y:0, z:-90}`, `elbow.R {x:-90}`. Achado no processo: o eixo Z do ombro do lado R abduz com sinal **negativo** — usar o valor positivo da convenção L direto no lado R (sem passar pelo `symmetric()`) trava no limite do outro sentido (adução) e deixa o braço quase parado, foi o primeiro resultado errado da varredura.
- **`kpopPointDance`** (apontar com o quadril deslocado): reaproveita a base de apoio já resolvida de `model` (peso na perna esquerda) com o braço já resolvido de `pointUp` (aponta para cima) — nenhum número novo para as pernas. Medido: punho a (−0,106; 1,839; 0,127), chão a 0,0127 m (2,7 mm de folga a mais que o neutro — a mesma divergência que `model` já tem sem `hipHeightM` declarado).
- **`kpopShoulderWave`** (onda de ombro): o levante vem da CLAVÍCULA (`clavicle.R.z`, que só sobe, nunca desce — mesma junta do `headDown`), no máximo do catálogo (20°), mais uma inclinação de tronco na mesma direção. Medido: ombro direito **12 cm** mais alto que o esquerdo, pernas intocadas.

### Os 4 trechos (`src/animation/animationClips.ts`, solo)

Cada pose ganhou um trecho curto (5 a 7 passos) que entra no gesto, dá um "pulso" ou alterna o lado, e volta a ficar em pé — nenhum desloca o boneco no chão. Dois usam `mirror: true` para a própria alternância de lado ser o passo de dança (o espelho sagital exato já trocava o braço/quadril de lado sozinho, sem redigitar nada): `kpopPointDance` alterna qual perna sustenta o peso e qual mão aponta; `kpopShoulderWave` alterna qual ombro isola, simulando a onda viajando de um lado a outro. `kpopBoxArms` ganhou dois overrides pequenos (`ROBOT_ARM_DOWN_L/R`) que recolhem um braço de cada vez ao neutro, por cima da pose — o "pêndulo" do robô. Todos os 21 passos foram medidos no chão ANTES do teste (mesma disciplina do #60): nenhum flutua ou afunda além da folga da própria pose de base.

### Verificação

**+8 testes de pose** (geometria das 4 + mão do gesto certa em cada lado) e **+4 testes de trecho** (deslocamento zero, bookends em pé, espelho sagital exato, braço recolhido no robô), suíte em **1.764 testes** verdes; `tsc -b`, `eslint .` e `npm run build` limpos.

**No Chrome real, sem erro de console:** as 4 poses aplicadas pelo combo (capturas conferindo a silhueta — braços em ângulo reto do robô, isolamento visível do ombro, quadril deslocado do apontar); os 4 trechos adicionados em sequência a uma animação nova somaram exatamente **25 keyframes** (7+7+5+6, o total dos passos declarados).

## 63. Joelhada na barriga com cambalhota

Pedido do usuário em 2026-07-28, com uma foto de referência (captura de um jogo de luta): implementar as poses em dupla de uma joelhada na barriga e um trecho de animação em que os dois começam em repouso, A crava o joelho e B dá uma cambalhota no ar em torno do joelho de A, caindo sentado de costas para ele.

### O par de poses: `kneeStrikeGiving` / `kneeStrikeTaking`

Resolvido na mesma ordem do soco/chute (#37): primeiro a reação (corpo dobrado, cabeça puxada para baixo, mais fechado que `kickTaking` — golpe de clinche, bem mais perto), medida a altura assentada da barriga (junta `spine`, 1,030 m); depois a perna que golpeia, varrida até o **JOELHO** (não o pé — a joelhada golpeia com a própria junta) bater nessa altura, com penalidades de ficar perto da linha média (≤8 cm) e bem projetado à frente (≥15 cm). Fechou com **0,0 cm de erro de altura**, 6,5 cm da linha média e 36,5 cm à frente do quadril. Os braços reaproveitam o grip de duas mãos já resolvido do `clinch` (mesmos ângulos, sem alvo novo — o alcance geométrico da pose é só o joelho). Encaixe do par: **gapM = 0,3653 m** — bem mais perto que soco (0,629) e chute (0,815), consistente com ser um golpe de clinche.

### O trecho `kneeStrike`: cambalhota sem giro espúrio

Os dois começam **em repouso** (`standing`, não em guarda — pedido explícito do usuário, diferente dos outros golpes), aproximam-se pela guarda até o clinche (mesma pose e distância de `clinch`, 0,4 m, reaproveitada) e A crava o joelho no encaixe medido. Daí em diante, B "voa": a cambalhota é pura rotação sobre a mesma pose dobrada de `kneeStrikeTaking`, com `hipHeightM` subindo e descendo (pico 1,35 m) e pousando sentado (`sittingLegsForward`, com a cabeça tombada de lado — atordoado).

**O ponto que exigiu verificação numérica, não só visual:** compor `rotation.x` (o giro da cambalhota) com `turnDeg: 180` (o giro que já vinha da colocação "de frente um para o outro") faz `composePlacementRotation` — que é por MATRIZ — devolver o ângulo espalhado entre eixos DIFERENTES a cada passo (ex.: contato vira `{x:0,y:180,z:0}`, decolagem vira `{x:90,y:0,z:180}` — o giro migrou de Y para Z entre um passo e o outro, embora seja a MESMA rotação física composta com o MESMO turnDeg). Como o player interpola cada eixo (x/y/z) **separado** pelo menor arco (`lerpAngle`, `poseBlend.ts`), um Y saltando de 180 para 0 bem no instante em que X sai do zero rasgaria um giro espúrio no meio da decolagem — pego ANTES de escrever qualquer teste, comparando a sequência real resolvida (script no scratchpad) contra a esperada.

Correção: a partir do contato, `rotation` passa a ser declarado por EXTENSO como `{x, y:0, z:180}` (em vez de só `turnDeg:180` sobre a pose em pé) — verificado por matriz que é a MESMA rotação física (diferença de 1e-16), mas agora com Y e Z **parados** em todos os passos do ar e só X variando, sempre −90° por passo (180→90→0→−90→−180). A única fronteira que ainda troca de convenção é a entrada no golpe (clinche → contato), onde a pose TAMBÉM muda inteira (200 ms, o instante do impacto) — aceito, é o único lugar que sobrou depois de eliminar a fronteira de dentro do próprio voo, que era a que importava.

Fisicamente, B nunca gira em Y: continua olhando para -Z do início ao fim (a mesma direção de quando encarava A antes do golpe). É a POSIÇÃO que muda de lado — B decola à frente de A (z > 0,2), passa por cima dele no pico (a ≤15 cm da posição dele) e aterrissa atrás (z < 0,2) — e é isso, não nenhum giro de Y, que faz o resultado ler como "de costas para A" na aterrissagem.

### Verificação

**+2 poses e +1 trecho**, suíte crescendo de 1.764 para **1.786 testes** (todos os novos: geometria do par, rotação eixo a eixo do trecho, posição decolando à frente/pousando atrás, orientação física do pouso comparada por matriz, altura subindo e descendo), tudo verde; `tsc -b`, `eslint .` e `npm run build` limpos.

**No Chrome real, sem erro de console:** o par aplicado com dois bonecos em cena encaixou automaticamente (joelho na barriga, grip na cabeça); o trecho `kneeStrike` somou **8 keyframes**; as capturas dos 3 keyframes-chave confirmaram visualmente a sequência inteira — contato (joelho cravado), pico (B de cabeça para baixo sobre A) e pouso (B sentado atrás de A, de costas para ele).

## 64. Chave de braço sentada (empurrão/puxão) + trecho `armLock`

Pedido do usuário em 2026-07-28/29, desta vez com uma foto de referência que eu li ERRADA na primeira tentativa (interpretei como um piledriver invertido — o usuário corrigiu: "Não tem lutador de ponta cabeça"). A partir daí o pedido passou a ser só por TEXTO: A agachado atrás de B sentado, uma perna travando a perna direita dele e o joelho nas costas; A prende o braço direito de B (o próprio braço direito por cima) e segura o punho dele com a mão esquerda; empurra com o peso do corpo (B curva para a frente) e depois puxa o punho rapidamente para trás (a coluna de B gira para a esquerda e arqueia para trás, no limite da articulação). Perguntei 3 rodadas de esclarecimento (leitura da imagem, estrutura da entrega — 2 poses de par + 1 trecho — e o que exatamente "dobra" no puxão) antes de implementar.

### As 4 poses novas: `armLockPushGiving`/`Taking` e `armLockPullGiving`/`Taking`

Duas poses de A (o mesmo agarre parado — pernas e braço "prende" IGUAIS nos dois instantes, só o tronco e o braço da chave mudam) e duas de B (o instante do empurrão e o do puxão final).

- **Pernas de A**: esquerda de base (mesmos ângulos de `rearChokeKneeling`), direita ativa — `hip.R`/`knee.R` varridos (sweep coarse 10°/refino por coordenada 1°) até o **joelho** chegar à altura da coluna de B. `hipHeightM` de A: **0,5212** (igual nas duas poses — a perna não muda entre elas).
- **Pernas de B**: as duas esticadas à frente (`sittingLegsForward`), a direita é o alvo do travamento. **Limitação assumida, medida e documentada**: o encaixe perna-contra-perna do travamento em si não foi resolvido numericamente — ficaria a mais de 0,5 m um do outro com a perna ativa nesta posição (a perna que "trava" é a mesma que sobe para golpear as costas, pressionando a base da coxa presa, não o tornozelo).
- **Braço da chave em B** (`shoulder.R`/`elbow.R`): varrido contra um alvo declarado "atrás do tronco" (a 0,10 m de profundidade — mesma ordem de grandeza da meia-espessura do peito usada em `groundChokeGiving`/`Taking`, ~0,104 m), a alturas diferentes: no empurrão, na coluna (spine); no puxão, no meio das costas (upperChest) — mais alto e mais fundo, com `shoulder.R.y` no LIMITE de 90°, literalmente "no limite da articulação".
- **Braço que segura o punho em A** (`shoulder.L`/`elbow.L`): varrido contra o punho DIREITO de B já montado na chave — 0,7 cm de erro no empurrão, 8,9 cm no puxão (o punho sobe e aprofunda bastante entre os dois instantes, e a mesma varredura por coordenadas não converge igualmente bem nos dois).
- **Braço que prende em A** (`shoulder.R`/`elbow.R`, o "gancho" por cima do braço de B): posicionado por razão anatômica, não por varredura — ver a lição de câmera abaixo, foi o que precisou de ajuste depois da primeira validação visual.
- **Sinal do giro do tronco confirmado numericamente** (não deduzido): `spine.y` POSITIVO gira o corpo para a ESQUERDA — verificado calculando a direção "de frente" da coluna sob rotação (vetor `(sinθ, cosθ)` no plano XZ) e conferindo que ela se desloca para o lado do X positivo, que é o lado esquerdo do próprio corpo (`hip.L` mora em X positivo).

Encaixe do par (`posePairs.ts`): **gapM = 0,238 m**, `facing: false` (os dois olham para o mesmo lado, A atrás — mesma família de `rearChokeKneeling`/`rearChokeSeated`), reaproveitado igual nos dois pares (push e pull): é o mesmo agarre parado, só a força muda de direção.

### A lição da câmera: o ângulo padrão engana

A primeira validação visual (screenshot na vista 3/4 padrão do app) pareceu MOSTRAR A sentado em cima da cabeça de B, os braços formando um laço acima das duas cabeças — um resultado que bateu os alvos numéricos (erro de poucos cm nos dois contatos) mas parecia claramente errado de olhar, o sintoma que o `CRIACAO-PRESETS.md` avisa ("bateu o alvo mas fica errado de olhar? o alvo estava incompleto"). Medindo a causa (altura da cabeça de A vs. de B): A kneeling tem a cabeça 33-35 cm ACIMA da de B sentado — esperado dado que A ajoelhado tem o quadril bem mais alto (0,52 m) que B sentado com as pernas esticadas (0,05-0,20 m), mas a vista 3/4 (quase de frente para as duas cabeças) exagerava a leitura.

Trocando para as vistas ortográficas do painel de câmera (Esquerda/Topo/Frente, em vez de arrastar o mouse na órbita — que não girou nada nestas telas headless), o perfil de lado mostrou a pose CORRETA: A claramente agachado atrás, tronco curvado sobre as costas de B, joelho cravado — a vista 3/4 é que era enganosa, não a pose. Ainda assim, ajustei o braço "prende" de A (`shoulder.R` de `{x:-70,y:60,z:-10}` para `{x:-25,y:40,z:-15}`, `elbow.R` de −90 para −100) para baixar o gancho e tirar o efeito de "laço" acima das cabeças, sem mexer nos dois contatos já resolvidos (joelho e punho ficam noutro ramo cinemático, não mudam).

### O trecho `armLock`

5 passos (o mínimo da faixa 5-15): repouso em pé → A se aproxima andando (`walking`, `seat: true`) enquanto B senta (`sittingLegsForward`) → os dois já no lugar (`kneelingBoth`/`sittingLegsForward`) → a chave fecha no encaixe medido (`armLockPushGiving`/`Taking`, 0,238 m) → o puxão final (`armLockPullGiving`/`Taking`, mesmo encaixe). B fica parado em `at: [0, 0,238]` do início ao fim — quem se desloca é A, vindo de trás, mesmo padrão de `rearChokeSeated`/`rearChokeGround`.

### Verificação

**+4 poses e +1 trecho**, suíte crescendo de 1.786 para **1.815 testes**: geometria das 4 poses (grupo/mão/limites), o encaixe do joelho na coluna e do punho no punho preso (nos dois instantes), o trecho com B parado e A se deslocando, e o encaixe do puxão final na tabela de encaixes — tudo verde; `tsc -b`, `eslint .` e `npm run build` limpos.

**No Chrome/dev real, sem erro de console:** o par aplicado com dois bonecos encaixou automaticamente nos dois instantes; o trecho `armLock` somou **5 keyframes**; capturas nas vistas 3/4, lateral, superior e frontal confirmaram a leitura correta da pose (crouch atrás, joelho na coluna, chave no braço, puxão arqueando/girando o tronco) nos dois instantes.

## 65. Nove itens de animação: bancada, régua no rodapé, grupos e biblioteca de trechos

Pedido do usuário em 2026-07-29, na sequência da revisão que acrescentou os itens 36–39 ao `PLANO.md`: **implementar os itens 27, 28, 29, 30, 34, 36, 37, 38 e 39**, "seguindo uma ordem lógica das atividades". A ordem executada foi a que a própria avaliação de conflitos daquela revisão indicou — 36 (a base) → 34 → 28 → 27 → 29 → 38 → 37 → 39 → 30 —, e os itens que dependiam de decisão do usuário já vinham decididos do texto do plano.

**Ajuste pedido no meio da execução:** o item 29 (régua da linha do tempo) mudou de lugar — "posicionar a régua na parte inferior da tela, não precisa ficar no mesmo painel de animação e com possibilidade de expandir/contrair". Foi implementado assim, e o texto do item no plano foi corrigido.

### 36 — a animação de trabalho, e a inconsistência que o pedido escondia

O enunciado original era "não será obrigatório salvar uma animação primeiro". Levado ao usuário antes de escrever: **não existia passo de salvar**. `Criar` era o que fazia a animação existir, e a persistência (undo, autosave e `animations.json`) já era automática desde a fase 10 — o que incomodava era o batismo antecipado. Decisão dele: criação preguiçosa, com a possibilidade de **nomear e guardar** uma cópia para reabrir depois, e **reabrir sobrescreve a "default"**.

- **`WORKING_ANIMATION_ID = 'working'`** (`animation.ts`): id reservado da animação de trabalho. Ela é uma animação como qualquer outra — entra no undo, no autosave e no `animations.json` desde o primeiro keyframe; o que o id distingue é o PAPEL. As demais são a biblioteca.
- **Criar e capturar no MESMO `set`**, e portanto no mesmo passo de undo (`withTargetAnimation`): sem isso, um Ctrl+Z depois da primeira captura deixaria uma animação vazia para trás. Vale para a captura, para os trechos prontos, para os trechos salvos e para os keyframes do movimento de câmera.
- **Abrir substitui a bancada** num único passo de undo — o contrato que os snapshots de cena já tinham (#11). `saveAnimationToLibrary`, `openAnimationFromLibrary` e `overwriteSavedAnimation` são as três ações novas.
- **`activeAnimationId` saiu do `animationStore`.** Com a bancada única, "qual está aberta" deixou de existir como pergunta: painel e player resolvem a de trabalho por `findWorkingAnimation`. Estado que só podia divergir foi removido em vez de mantido em dia.
- **Migração de graça:** animações de um autosave antigo entram como biblioteca (nenhuma tem o id reservado), e a bancada nasce na primeira captura.

### 34 — o movimento A→B da câmera vira keyframes

`appendCameraMoveKeyframes`: dois keyframes com a MESMA cena e as duas câmeras do movimento, no fim da linha do tempo, numa edição de undo. O `Movimento A→B` (#46) e o animador sempre usaram o mesmo `interpolateCameraView` e não se falavam; agora o botão está no próprio painel de câmera, ao lado do slider que monta o movimento. Os dois retratos são o mesmo objeto: um travelling move a câmera, não os bonecos.

### 28 e 27 — pausa, pose do vizinho, laço e ciclo

- **`copyAnimationKeyframeFigures`** é o simétrico exato de `copyAnimationKeyframeCamera` (#55): segura a POSE e deixa só a câmera se mover.
- **`duplicateAnimationKeyframe`**: a cópia entra logo depois com a MESMA duração — dois retratos iguais são uma pausa, e ela dura o mesmo que o trecho que chegou ali, um valor que o usuário já escolheu.
- **`closeAnimationCycle`**: copia o primeiro keyframe para o fim, com a duração do último trecho (a cadência em vigor no fim). **Sem o rótulo do primeiro** — ver item 38.
- **Laço (`advancePlayheadMs`)**: função pura, e é ela que carrega a regra — sem laço, chegar ao fim para; com laço, o EXCEDENTE reentra pelo começo (`raw % total`), para o ciclo emendar no passo em que estava mesmo depois de um quadro lento. Só na tela: o MP4 continua com uma passada.

### 29 — a régua saiu do painel e virou barra de rodapé

`TimelineBar.tsx`, peça nova do `AppShell`, largura inteira, recolhível pelo mesmo mecanismo dos painéis (`PANEL_KEYS` ganhou `timeline`) e **nascendo recolhida**, pela mesma razão do painel de Animação: quem está só posando não perde altura de viewport.

- **A divisão ficou clara:** no painel fica o que é EDIÇÃO (capturar, lista de keyframes, velocidade, exportar); na barra, o que é NAVEGAÇÃO (régua, transporte, pular keyframe, laço).
- **Marcas dos keyframes** por `<datalist>` — o jeito nativo de o próprio controle mostrar onde eles estão — e passo de 1 ms no slider, em vez dos 10 ms de antes.
- **`stepFrameMs` não arredonda o resultado ao milissegundo**, e um teste trava isso: a 60 fps o quadro dura 16,666… ms, e arredondar fazia o instante reentrar como 1,9999 quadro — a seta emperrava no mesmo quadro. Entre dois quadros, cada seta cai no vizinho daquele lado; em cima de um, anda exatamente um.

### 38 — grupos são uma LEITURA da lista, não um objeto

Rótulo opcional por keyframe (`label?`, campo aditivo e sanitizado); keyframes **consecutivos** com o mesmo rótulo formam um grupo, com cabeçalho recolhível no painel e faixa na régua. Não há entidade "grupo" com intervalo a manter consistente a cada inserir/mover/remover — o que elimina a classe inteira de bugs de faixa órfã.

- **Duas regras de unicidade, e são diferentes de propósito.** `uniqueKeyframeLabel` (edição à mão) ACEITA o rótulo do grupo vizinho, porque ali o usuário está estendendo um grupo; `freeKeyframeLabel` (trecho inserido) recusa qualquer repetição, porque acrescentar "Andando" duas vezes tem de dar dois grupos ("Andando 1" e "Andando 2"), e não um bloco de dez keyframes. A primeira versão usava só a primeira regra e emendava os dois trechos — pego pelo teste do sufixo.
- **Herança:** o keyframe inserido pelo corte (#54) herda o rótulo do ANTERIOR (senão partiria o grupo em dois, e a inserção promete não mudar nada); o duplicado herda por ser cópia; o que fecha o ciclo (#27) **não** herda, porque está no fim e o grupo do começo não continua ali.
- **De graça:** o trecho pronto inserido já nasce rotulado com o próprio nome, e o sufixo resolve a segunda inserção sozinho — o grupo mais comum sai sem ninguém digitar nada.

### 37 — checkboxes só nos trechos individuais

`appendAnimationClip` passou a aceitar uma LISTA no papel A: cada boneco marcado executa o trecho inteiro, ancorado na própria posição e no próprio heading. Em dupla continua um combo por papel — decisão do usuário, e a razão é medida: os encaixes vêm par a par de `posePairs.ts`, e dois "A" cairiam exatamente no mesmo ponto. O padrão é o boneco selecionado marcado, para o gesto de um clique continuar existindo.

### 39 — trechos do usuário: papéis, sem câmera, reancorados

`clipLibrary.ts` + `clips.json` (manifesto, autosave e undo), no molde da biblioteca de poses (#42).

- **Guarda os keyframes literais SEM a câmera** (decisão do usuário): ao inserir, congela a câmera viva em todos, exatamente a regra dos trechos de fábrica (#60) — um trecho salvo se comporta como um pronto, em vez de sequestrar o enquadramento de quem o aplica.
- **Papéis, não bonecos**, e só é papel **quem se mexe na faixa**: um figurante parado o tempo todo era cenário, não parte do trecho. (Se ninguém se mexe, todos entram — é uma pausa gravada de propósito.)
- **Reancoragem completa:** posição e heading passam a ser relativos ao boneco do papel 0, com o deslocamento GIRADO pela diferença de heading e reescalado pela razão de altura; a altura do quadril acompanha a escala do próprio boneco. As mesmas regras de `applyPosePreset` e dos trechos de fábrica.
- **Recorte por faixa escolhida à mão** (decisão do usuário), inclusive nas duas pontas; menos de dois keyframes não vira trecho — isso é uma pose, e para pose já existe biblioteca.
- **Um papel só cai nas checkboxes do 37**; dois ou mais, um combo por papel. Era o `?` que o item deixou em aberto.

### 30 — miniatura por keyframe, em memória

`keyframeThumbnailStore.ts`: cache `keyframeId -> dataURL`, fora do conteúdo — era a recomendação embutida no próprio item, e a razão continua valendo: dataURL dentro do `Animation` incharia o `animations.json` e entraria no undo a cada captura. Renderizadas sob demanda pelo player (o único lugar com canvas vivo), a 160×90, reusando `renderAtResolution` + `hideSceneOverlays`; a bancada e o enquadramento voltam ao que eram. Abrir outra animação limpa o cache: ids de keyframe são únicos DENTRO de uma animação, e o `k1` de uma mostraria a miniatura do `k1` da outra.

### Verificação

**+132 testes**, suíte de 1.815 para **1.947**, todos verdes; `tsc -b`, `eslint .` e `npm run build` limpos.

**No Chrome real (`npm run preview`), sem nenhum erro de console:** painel e barra nascendo recolhidos; captura criando a animação de trabalho sozinha (2 keyframes); salvar na biblioteca, remover um keyframe e reabrir devolvendo os 2; trecho "Andando" aplicado aos DOIS bonecos marcados de uma vez (+9 keyframes); segunda inserção virando o grupo "Andando 2"; recolher o grupo escondendo os 9 cards; 20 marcas na régua e as faixas dos grupos desenhadas; pular keyframe e o passo de um quadro (1000 → 1017 ms a 60 fps, medido no valor do slider); duplicar e fechar o ciclo; um trecho salvo de 2 papéis reaplicado (+4 keyframes, reancorado na posição atual — conferido em 2,0 m); 17 miniaturas em `data:image/jpeg`; o movimento A→B virando 2 keyframes; e a reprodução ainda tocando depois do fim com o laço ligado.

**Nota de automação:** o `selectOption('2')` do Playwright casa por valor **ou** por rótulo, e os combos de faixa mostravam o número do keyframe (rótulo "2" no índice 1) — a primeira leitura do probe pareceu um bug do app que não existia. Os rótulos passaram a mostrar número **e** instante ("2 — 1.0s"), o que resolve a ambiguidade e ainda diz mais a quem lê.

## 66. Rolagem horizontal nos painéis e a ordem de Animação e Instantâneos

Pedido do usuário em 2026-07-29: tirar a rolagem horizontal do painel de Propriedades (os controles "Copiar pose para" e "O que copiar" na mesma linha) e do painel de Animação (os botões da biblioteca na mesma linha), pondo cada um em sua própria linha; e trocar a posição dos painéis, deixando **Animação antes de Instantâneos** da esquerda para a direita.

### Por que a barra aparecia

`.panel` tem `overflow-y: auto` e nada declarado no eixo X. Pelo CSS, `overflow-x: visible` **não sobrevive** a um `overflow-y` que não seja `visible`: ele computa para `auto`. Ou seja, todo painel já era um contêiner de rolagem horizontal esperando um filho largo demais — o conteúdo não vazava para fora, ganhava barra. Com 240 px de largura e 0,75 rem de padding sobram ~13,5 rem úteis, e qualquer fila de dois selects rotulados ou de quatro botões passa disso.

### Copiar pose: coluna, e o `min-width` do select

`.properties-panel__copy-pose` era `display: flex` em linha com dois `.properties-panel__field` (cada um já um flex de rótulo + controle) mais o botão. Virou coluna. Só isso não bastava: `.properties-panel__field input` tinha `width: 100%`, mas **o `select` não tinha regra nenhuma** e um `<select>` não encolhe abaixo da opção mais comprida ("Perna esquerda", nomes de boneco) sem `min-width: 0` — voltaria a empurrar o painel na primeira lista longa. A regra foi escrita com escopo no bloco de copiar pose, e não no `.properties-panel__field` inteiro, para não mexer em selects de outras seções que hoje cabem.

### Biblioteca de animações: uma PILHA, não uma quebra oportunista

A primeira tentativa foi `flex-wrap: wrap` com `flex: 1 1 6rem`, esperando dois botões por linha. Medido no navegador, deu **um por linha** — a base de 6 rem ficou a ~2 px de caber dois dentro do `fieldset`. Um layout que depende de uma folga de 2 px muda sozinho com uma tradução mais curta ou outra fonte.

E dois por linha era pior de qualquer forma: sobram ~95 px por botão e "Regravar a salva" sai cortado — exatamente o que obrigava o `padding: 0.25rem 0.2rem` e a fonte de 0,72 rem da versão anterior, que existiam para espremer três botões numa linha. Então o resultado virou explícito: `flex-direction: column`, cada botão com a largura toda, padding e corpo de fonte de volta ao tamanho dos outros botões do painel.

A classe foi renomeada de `animation-panel__row` para **`animation-panel__buttons`** (três usos no `AnimationPanel.tsx`): um seletor chamado "row" que renderiza uma coluna é a espécie de pista falsa que custa caro no próximo refactor.

### Ordem dos painéis

`AppShell.tsx`: `<AnimationPanel />` passou à frente de `<SnapshotPanel />` — a ordem do DOM é a do layout, já que os painéis são irmãos num flex row. Animação fica ao lado de Câmera, que é de onde vêm os keyframes (item 34), e Instantâneos — que é saída, não edição — encosta em Cenas. Um teste no `AppShell.test.tsx` trava a lista inteira pelos `aria-label` dos `aside`, porque essa ordem agora é requisito e não decoração.

De quebra, `.panel--animation` entrou na lista dos painéis à direita do viewport que se separam pela borda **esquerda**: faltava lá, e o `border-right` herdado de `.panel` desenhava linha dupla contra o vizinho.

### Verificação

Suíte de 1.947 para **1.948** (o teste de ordem), todos verdes; `tsc -b`, `eslint .` e `npm run build` limpos.

No Chrome real (`npm run preview`), sem erro de console, medindo `scrollWidth - clientWidth` de cada painel: **Propriedades 0 e Animação 0** (eram positivos), ordem lida do DOM igual a `Bonecos, Propriedades, Câmera, Animação, Instantâneos, Cenas`, os dois selects de copiar pose confirmados em linhas diferentes pelas caixas delimitadoras, e os quatro botões da biblioteca ocupando quatro linhas com a mesma borda direita.

**Achado não pedido, deixado como está:** o painel de **Câmera** ainda estoura 19 px — um `<fieldset>` do bloco "Enquadramento". É o mesmo defeito, em painel que o pedido não citava; fica registrado para ser tratado à parte.

## 67. Botões do card, captura fixa no topo e papel-cebola (item 31)

Pedido do usuário em 2026-07-29, em duas partes: arrumar os botões de cada card de keyframe em quatro linhas fixas e deixar "Capturar keyframe" mais largo, destacado **e grudado no topo** ("a rolagem só ocorre depois dele"); e implementar o **item 31, papel-cebola**.

### Quatro linhas declaradas, não deduzidas

`Ir para / Regravar`, `Câm ↑ / Câm ↓`, `Pose ↑ / Pose ↓` e `↑ / ↓ / Duplicar / ×`. Cada linha é uma `<div>` no JSX. A versão anterior era uma fila única com `flex-wrap` e um `nth-child(-n + 2)` decidindo quem tinha largura — quebrava sozinha, e qualquer botão novo bagunçava a conta do seletor. Com as linhas declaradas, a leitura também fica por assunto: o que é do keyframe, o que é da câmera, o que é da pose e o que é da ordem da lista. Só a última linha mistura larguras (`--mixed`): setas e `×` levam o próprio símbolo, "Duplicar" fica com a sobra.

### Captura: barra grudada, com o aviso junto

`position: sticky; top: 0` numa faixa que vem ANTES do nome da animação, com margens negativas anulando o padding de `.panel` para tapar de borda a borda o conteúdo que rola por baixo — sem isso sobra uma fresta de cada lado. O botão ganhou cor sólida sobre `--text-h`, que já vira claro no tema escuro (destaque sem variável nova).

O aviso de "por que não dá para capturar" viaja DENTRO da faixa: um botão desabilitado fixo no topo, com o motivo perdido lá embaixo na rolagem, não explica nada.

### Item 31 — papel-cebola

`onionSkin.ts` é só a LEITURA (`anchorKeyframeIndex`, `onionSkinFrames`), testável sem WebGL; `OnionSkin.tsx` desenha; o `animationStore` liga e desliga, como estado de ferramenta (fora do undo e do arquivo, ao lado de `repeat`).

- **O `ghost` do `Figure.tsx`** carrega as três coisas que o item previa (translúcido, sem sombra, sem gizmo) e mais uma que não estava à vista: **o fantasma não pode repetir os nomes de cena**. `CameraRig` acha o boneco por `getObjectByName('figure-<id>')`, que devolve o primeiro da travessia — com nomes repetidos, "enquadrar boneco" mediria a caixa de um keyframe vizinho, e o erro só apareceria como um enquadramento estranho, sem pista de causa. `figure-`, `joint-` e `segment-` são suprimidos no fantasma.
- **Uma cor por papel** (quente = passado, frio = futuro), a convenção dos programas 2D; `depthWrite` desligado para dois fantasmas se atravessarem sem um recortar o outro.
- **Fora das saídas de graça:** o grupo se chama `scene-onion-skin` e entrou em `OVERLAY_NAMES`. O PNG e o MP4 já escondem tudo o que está nessa lista — nenhuma regra nova a manter em dia.
- **Some enquanto toca ou exporta:** durante a reprodução quem manda é a pré-visualização, o âncora muda a cada quadro e os fantasmas piscariam de um keyframe para o outro.
- **Grupos são leitura, âncora também:** não há "keyframe selecionado" guardado em lugar nenhum — o âncora é calculado do playhead. Em cima de um keyframe, é ele; entre dois, é o de trás.

### O bug que o papel-cebola revelou: "Ir para" não movia o playhead

`goToKeyframe` carregava o retrato do keyframe na cena de trabalho e limpava a pré-visualização, mas **deixava `timeMs` onde estava**. Duas consequências: a régua do rodapé marcava 0,0s enquanto a cena mostrava o keyframe 3 (inconsistência que já existia e que a barra do item 29 pôs à vista), e o papel-cebola — que se ancora no instante — desenhava os vizinhos do keyframe ERRADO.

O sintoma na tela era enganoso: os fantasmas caíam exatamente em cima do boneco e a cena só ficava "lavada", sem nada aparecendo fora do lugar. `requestGoToKeyframe` passou a receber o instante (quem chama já tem `keyframeStartTimesMs` em mãos) e a mover o playhead junto.

### Verificação

**+25 testes**, suíte de 1.947 para **1.972**, todos verdes; `tsc -b`, `eslint .` e `npm run build` limpos.

No Chrome real (`npm run preview`), sem erro de console: as quatro linhas do card lidas do DOM na ordem pedida (`[["Ir para","Regravar"],["Câm ↑","Câm ↓"],["Pose ↑","Pose ↓"],["↑","↓","Duplicar","×"]]`), rolagem horizontal do painel em 0, o botão de captura com 36 px de altura e peso 700 continuando no topo depois de rolar 600 px (y 107 → 88, com o painel começando em 64), e o papel-cebola medido por contagem de pixels: no keyframe do meio, quentes 50.460 → 67.043 e frios 479 → 15.435 ao ligar; no primeiro keyframe só o fantasma frio (24.577); tocando, os frios voltam à linha de base (476).

**Duas armadilhas de automação, ambas custaram uma rodada:**

1. **Ler o canvas WebGL de fora não devolve nada.** Sem `preserveDrawingBuffer`, `createImageBitmap(canvas)` fora do `gl.render` dá buffer vazio — a sonda contou zero até no boneco vermelho que estava à vista. A medição passou a usar o SCREENSHOT do Playwright (composto pelo navegador) desenhado num canvas 2D.
2. **Cena idêntica esconde o fantasma.** Capturar três keyframes sem mudar nada põe os fantasmas exatamente sobre o boneco: parece que a funcionalidade não existe. Variar a POSE entre as capturas é o que torna o papel-cebola visível — e é o caso de uso real.

## 68. Área de transferência de poses

Pedido do usuário em 2026-07-29: copiar temporariamente uma pose para replicar em outra cena ou boneco, **só em memória** (sem persistir entre sessões), no rodapé do painel de Bonecos e com a possibilidade de apagar cada pose capturada.

### Por que um store à parte, e não um campo do `figuresStore`

Não é escolha de arrumação: é a única forma de o recurso funcionar. Carregar uma cena substitui figuras, animações e biblioteca de poses de uma vez — se a área de transferência morasse lá dentro, ela seria apagada exatamente no gesto que ela existe para servir ("copiar aqui, colar na outra cena"). Fora do `figuresStore`, ela sobrevive de graça, e há teste travando isso.

O `poseClipboardStore` também fica naturalmente fora do undo e do autosave, que é o que o "só em memória" pede. Mesmo lugar de `keyframeThumbnailStore` (#65): apoio de trabalho, não conteúdo.

### O que é guardado: a MESMA captura da biblioteca de poses

Cada entrada é uma `SavedPose` de `captureFigurePose` (#42) — juntas mais assentamento, com a altura do quadril já desfeita da escala do boneco de origem. Colar refaz na escala de quem recebe, então a mesma pose assenta igual num boneco de 1,50 m e num de 1,90 m, e uma pose deitada volta deitada. Reusar a captura em vez de escrever uma segunda é o que garante que copiar/colar e "salvar + aplicar" dêem exatamente o mesmo resultado, hoje e depois de qualquer mudança nas regras de assentamento.

`pasteFigurePose` no `figuresStore` é o único acréscimo lá: chama o mesmo `withPose` de `applySavedPose`, com as mesmas juntas travadas do destino e num `set` só (um passo de undo). A ação existe porque colar altera CONTEÚDO — a lista é de ferramenta, o resultado não.

### Onde fica, e por que não em Propriedades

No rodapé do painel de **Bonecos**, como pedido — e a razão sustenta o pedido: a lista é da SESSÃO, não do boneco selecionado. Em Propriedades ela desapareceria a cada troca de seleção, que é precisamente o gesto entre copiar e colar. Copiar age sobre o selecionado; colar aplica no selecionado; sem seleção os dois ficam desabilitados **e o painel diz por quê** — botão apagado sem explicação é o que faz o usuário procurar defeito onde não há.

- **Nomes desambiguados** (`uniqueClipboardName`): duas cópias do mesmo boneco virariam duas linhas idênticas, e aí só o acaso diz qual é qual. O sufixo `(2)` resolve sem obrigar ninguém a digitar. Mesma ideia dos rótulos de grupo de keyframes (#65), regra separada porque aqui não existe o caso "estender o grupo vizinho".
- **Sem limite de entradas:** cada uma é pequena, todas são apagáveis uma a uma (o pedido), e o painel rola.
- **O nome cede primeiro no layout:** os dois botões têm largura de conteúdo e o nome trunca com reticências — o painel de Bonecos é o mais estreito (220 px) e um nome longo o empurraria de volta à rolagem horizontal que a #66 acabou de tirar.

### Verificação

**+18 testes**, suíte de 1.972 para **1.990**, todos verdes; `tsc -b`, `eslint .` e `npm run build` limpos.

No Chrome real (`npm run preview`), sem erro de console: aviso de lista vazia; duas cópias virando "Boneco 1" e "Boneco 1 (2)"; apagar só a segunda; **trocar de cena preservando a entrada** (remover o boneco, criar outro) e **carregar um snapshot** também preservando; "Colar" desabilitado sem seleção; colar mudando o cotovelo esquerdo de 0° para −60°; **recarregar a página esvaziando a lista**, que é a decisão do usuário; e rolagem horizontal do painel em 0.

**Nota de teste:** a primeira versão do teste de junta travada usou `elbow.L` a +33°, e o cotovelo só dobra para um lado — o valor era grampeado a 0 antes mesmo de colar, e a falha parecia da colagem. Ângulo fora do limite não serve de sentinela.

## 69. Confirmação ao regravar, "Inserir" na barra e o nome da animação junto da biblioteca

Pedido do usuário em 2026-07-29: confirmar antes de regravar um keyframe (por cliques indevidos); mover "Inserir keyframe aqui" para a barra da linha do tempo, com o mesmo destaque de "Capturar keyframe"; e tirar o nome da animação do início do painel, aproximando-o do combo de animação salva.

### Regravar em dois passos

Regravar substitui a pose E a câmera guardadas pelo que está na tela; o Ctrl+Z é a única saída, e num card com oito botões o vizinho de "Regravar" é "Ir para". Vira confirmação em linha: o aviso em vermelho mais `Confirmar`/`Cancelar` no lugar da primeira linha do card — mesmo padrão do "novo workspace" no painel de Cenas (#31), que é a outra ação que um clique não desfaz.

- **Um id em confirmação, não um mapa:** abrir a confirmação de outro card fecha a anterior sozinha. Duas confirmações abertas ao mesmo tempo seriam duas chances de clicar na errada — o problema que o pedido veio resolver.
- **Só "Regravar" ganha confirmação.** Os outros botões do card ou são reversíveis à vista (mover, duplicar) ou não perdem nada (Ir para). Confirmação em tudo vira ruído, e ruído se clica no automático — que é como o clique indevido acontece.

### "Inserir keyframe aqui" foi para a barra

Ele corta o trecho **no instante do playhead**, e o playhead mora na barra do rodapé (item 29). Com ele no painel, a decisão ("onde estou?") ficava numa ponta da tela e a ação na outra. Foi para o fim da fileira de transporte, com o destaque de `Capturar keyframe` — é a única EDIÇÃO da barra, e por isso a única em destaque ali.

A aparência de destaque virou uma regra só, listando os dois seletores; o que muda entre eles é apenas a ocupação (o do painel toma a largura toda, o da barra mede o próprio texto). Duplicar o bloco de cor faria os dois destaques divergirem no primeiro ajuste de tema.

A regra do `disabled` foi junto sem mudança: em cima de um keyframe ou nas pontas não há trecho a cortar, e tocando o instante mudaria entre ver o botão e clicá-lo. Os três testes que a cobriam mudaram de arquivo com o botão, de `AnimationPanel.test.tsx` para `TimelineBar.test.tsx`.

### O nome da animação desceu para a biblioteca

Ele é do mesmo assunto que o bloco "Biblioteca de animações": é o nome que vira o arquivo MP4 e o padrão de "Nome para guardar", que fica logo abaixo. No topo do painel ele separava o botão de capturar da lista de keyframes sem ter relação com nenhum dos dois — e o topo é o espaço mais caro do painel, agora que a faixa de captura é fixa (#67).

### Verificação

**+3 testes** (a confirmação; os de inserir mudaram de arquivo), suíte de 1.990 para **1.993**, todos verdes; `tsc -b`, `eslint .` e `npm run build` limpos.

No Chrome real (`npm run preview`), sem erro de console: o aviso e o par Confirmar/Cancelar aparecendo, cancelar devolvendo o botão "Regravar" e confirmar fechando a confirmação; "Inserir keyframe aqui" com zero ocorrências no painel e uma na barra, com estilo computado **idêntico** ao de "Capturar keyframe" (peso 700, fundo `rgb(8, 6, 13)`, texto branco), desabilitado em cima de um keyframe, habilitado no meio do trecho e levando a lista de 2 para 3 keyframes; o campo do nome dentro do `fieldset` da biblioteca e depois do botão de capturar, a 164 px do combo "Animação salva"; e rolagem horizontal do painel em 0.

## 70. Espelho completo do boneco

Pedido do usuário em 2026-07-29: espelhar o boneco inteiro, e não só braços e pernas — as juntas sem par correspondente devem ter o ângulo invertido, mantendo também o espelhamento dos membros com direita e esquerda.

### A regra já existia; faltava aplicá-la onde não há par

A reflexão sagital `(x, y, z) → (x, -y, -z)` do `poseMirror.ts` (#30) é exata e vale para qualquer junta. Nas pareadas ela é aplicada ao TROCAR de lado; numa junta central não há para onde trocar, e por isso a reflexão se aplica sobre ela mesma. `mirrorPoseFull` é `swapPoseSides` mais esse passo — cinco juntas: `spine`, `chest`, `upperChest`, `neck`, `head`.

Sem ele, um tronco torcido e uma cabeça virada continuavam para o mesmo lado enquanto os braços trocavam: o boneco saía espelhado pela metade, que é a queixa que originou o pedido.

**A raiz fica de fora**, e não por esquecimento: ela não é pose, é a COLOCAÇÃO do boneco — quem a carrega é `figure.rotation`, não `figure.pose` (`Figure.tsx`, `poseLibrary.ts`). Espelhar o heading giraria o boneco na cena e negar X o mudaria de lugar: isso é refletir a CENA em torno do plano do mundo, não o boneco em torno do plano dele. O boneco continua onde está e encarando para onde encarava; o que vira do avesso é o corpo. Há teste travando posição e rotação intactas.

### Verificação numérica, não dedução

A trava principal é a mesma que o espelho parcial já tinha: montando a cinemática direta com uma pose torta dos dois lados **mais** tronco, pescoço e cabeça fora do eixo, cada junta cai na posição de mundo da correspondente com X negado — as pareadas na do par, as centrais na delas mesmas — com erro nulo a 9 casas. O controle negativo mede o que faltava: só trocar os lados deixa as juntas centrais a mais de 2 cm do espelho.

Continua uma involução: aplicar duas vezes devolve a pose original, então serve de alternar.

### Sem escopo, e o guarda que precisou mudar

As três operações de lado obedecem à junta selecionada (`scopeJoint`, #34). O espelho completo **não**: "o boneco todo" é o que o botão promete, e restringi-lo à seleção faria o botão mentir.

Isso expôs um detalhe do bloco de Simetria: ele sumia inteiro quando não havia junta pareada no escopo (com a cabeça selecionada, por exemplo). Manter o espelho completo lá dentro faria a ação sumir justamente onde ela continua válida — pareceria defeito. Agora só as três operações de lado somem; o `fieldset` fica, com o espelho completo e a caixa de espelho ao vivo. **De quebra corrige uma incoerência anterior:** o espelho ao vivo já era documentado como valendo para o boneco todo, e mesmo assim desaparecia conforme a junta selecionada.

### Verificação

**+10 testes**, suíte de 1.993 para **2.003**, todos verdes; `tsc -b`, `eslint .` e `npm run build` limpos.

No Chrome real (`npm run preview`), sem erro de console, sobre uma pose de corrida com a cabeça a 25° e o tronco a 12°: **"Inverter lados" deixa a cabeça em 25°** (o buraco relatado); o espelho completo leva a cabeça a −25°, o tronco a −12° e passa o ombro direito (−45°) para o esquerdo; aplicar de novo devolve 25°; e com a cabeça selecionada o botão continua na tela enquanto "Inverter lados" some.

**Nota de teste:** a primeira expectativa escrita supunha o ombro voltando a zero — mas a pose padrão nasce com os braços baixos (z perto de ±90), então o ombro direito recebe o espelho do que o ESQUERDO tinha, e não zero. Usar `mirrorRotation` na expectativa em vez de números escritos à mão também evitou o `-0` que o `toEqual` distingue de `0`.

## 71. Barra da linha do tempo em duas fileiras

Pedido do usuário em 2026-07-29: pôr os botões da barra em duas fileiras, com "Inserir keyframe aqui" acima dos botões de tocar.

`timeline-bar__controls` é uma coluna com duas linhas — inserir em cima, transporte embaixo — ao lado da régua, que continua crescendo com a janela (medido: 2.060 px de régua contra 304 px da coluna de controles).

Além de caber melhor, a divisão diz o que cada fileira é: eram sete controles numa fila só, e o único que EDITA a animação ficava colado no ▶ que anda um quadro. Sozinho na linha, o botão passa a tomar a largura da coluna — medir só o próprio texto deixaria uma sobra torta ao lado do transporte.

Sem mudança de comportamento: mesma regra de `disabled` (em cima de um keyframe, nas pontas ou tocando, não há trecho a cortar) e mesmos testes.

**Verificação:** suíte em **2.003**, todos verdes; `tsc -b`, `eslint .` e `npm run build` limpos. No Chrome real, sem erro de console: as duas linhas confirmadas por caixa delimitadora (inserir acima de "Tocar", mesma coluna, dois topos distintos).

**Nota de ferramenta:** rodar `npx prettier --write` neste arquivo reformatou-o inteiro no padrão do prettier (aspas duplas, ponto e vírgula), que **não** é o do projeto — não há config de prettier aqui, e o estilo do código é aspas simples sem ponto e vírgula. Desfeito com `--single-quote --no-semi --print-width 110`. Neste repositório, formatação é do `eslint`; prettier avulso não.

## 72. Duas poses de balé e a pirueta

Pedido do usuário em 2026-07-29: duas poses e uma animação de uma bailarina girando com uma perna levantada, girando sobre a outra.

### As poses, resolvidas por varredura numérica

Como as poses de encaixe do #35/#37, os ângulos saíram de busca sobre a cinemática direta, não de estimativa — e o que a busca otimiza é o que define a pose:

- **`balletPirouette`** (passé/retiré): apoia na perna ESQUERDA esticada, na meia-ponta; a direita levantada com `hip.R {x:-72, y:-40, z:-45}` e `knee.R {x:121}`. Duas exigências ao mesmo tempo, e é a segunda que faz a diferença: o pé encosta no joelho de apoio (**6,9 cm** entre as juntas, e o pé é mais largo que isso) **e** o joelho levantado aponta para fora — x = −0,315 m, z = +0,221 m. Só a primeira exigência produz um "coupé" de rua, com o joelho à frente; a abertura lateral é o *en dehors* que faz a pose ser de balé. Braços em coroa à frente (primeira posição), punhos a 18 cm um do outro. Tronco e cabeça com um leve giro — o *spot* do bailarino.
- **`balletPreparation`**: demi-plié com os pés virados para fora e os braços na segunda posição, quadril a 0,811 m. Ela existe para a pirueta ter começo e fim, em vez de o boneco surgir já rodando.

Ambas em `hipHeightM` medido com `seatedHipHeightM` (0,967 na meia-ponta, 0,811 no plié), não estimado.

### O trecho: 120° por passo, e isso não é estética

`balletPirouette` (11 keyframes): em pé → plié → sobe em retiré → **seis degraus de 120°** → plié → em pé. Duas voltas completas, 720°.

O tamanho do degrau é uma restrição, não um gosto: a interpolação da rotação do boneco (`lerpAngle`, em `poseBlend.ts`) toma sempre o caminho **mais curto**, e a conta `((to - from + 540) % 360) - 180` resolve um passo de exatamente 180° como **−180** — o boneco giraria ao contrário. Qualquer degrau ≥ 180 dá a volta pelo lado errado. Com 120° cada trecho tem um sentido só. Há teste travando `< 180` por degrau, com a razão escrita ao lado.

### A armadilha da clavícula

Na primeira medição os punhos saíram tortos numa pose declarada simétrica. Causa: a clavícula foi escrita com o MESMO sinal nos dois lados, e os limites dela são espelhados (`z: 0..20` na esquerda, `-20..0` na direita) — o valor positivo do lado direito grampeia em **zero**, e a assimetria se propaga por todo o braço. A regra do lado direito é `(x, −y, −z)`, e o `symmetric()` de `posePresets.ts` existe justamente para não depender de digitar isso à mão; a pirueta usa `symmetric` nos braços e declara só as pernas lado a lado, porque nelas a assimetria é a pose.

### Verificação

**+20 testes**, suíte de 2.003 para **2.023**, todos verdes; `tsc -b`, `eslint .` e `npm run build` limpos. Os testes novos travam as medidas que definem as poses (pé no joelho de apoio, joelho aberto, meia-ponta, simetria do plié) e a estrutura do trecho (soma 720°, sentido único, nenhum degrau ≥ 180°, gira no lugar).

No Chrome real (`npm run preview`), sem erro de console: as duas poses aplicadas e conferidas em imagem — inclusive na vista frontal, que é onde o *en dehors* se lê —, o trecho gerando **11 keyframes** e seis instantes ao longo da linha do tempo mostrando o giro sempre no mesmo sentido (costas → perfil → frente) com a perna de apoio no lugar.

**Nota de automação:** capturar keyframe (e portanto aplicar trecho) só vale em **perspectiva** — em ortográfica não há lente para interpolar. A sonda tirava a foto frontal numa vista ortográfica e depois encontrava o botão de aplicar desabilitado, o que parecia defeito do trecho.

## 73. O keyframe que está na bancada: destaque no card e marca na régua

Itens 40 e 41 do `PLANO.md`, pedidos pelo usuário. Depois de clicar "Ir para", nada na tela dizia em qual keyframe a cena de trabalho tinha sido carregada — e é exatamente essa informação que falta na hora de clicar "Regravar" no card certo.

### O destaque é "a bancada mostra este keyframe", não "o playhead está aqui"

A distinção decide todo o resto. "Ir para" carrega o retrato do keyframe na cena EDITÁVEL; arrastar a régua, ⏮/⏭ e as setas de quadro só mexem na pré-visualização. Derivar o destaque do `timeMs` — que não custaria estado nenhum, como o papel-cebola (#66) já faz — faria a marca andar enquanto a cena que se edita continuava sendo outra: o engano que o item existe para evitar, e justamente na operação de risco (regravar substitui pose e câmera).

Por isso é estado próprio: `visitedKeyframeId: string | null` no `animationStore`, ao lado de `onionSkin` e `preview` — estado de FERRAMENTA, fora do undo e fora do arquivo.

### As quatro regras de quem escreve e quem limpa

- **`requestGoToKeyframe` grava.** É o único lugar que grava, e é a definição do destaque.
- **`requestCaptureKeyframe` limpa.** O keyframe novo entra no fim; a bancada deixa de ser o retrato do que estava marcado.
- **`resetTimeline` limpa.** É o que roda ao abrir uma animação da biblioteca e ao apagar a de trabalho, e ids de keyframe são únicos DENTRO de uma animação — sem limpar, a marca do `k1` antigo cairia no `k1` da animação nova. Mesma razão que limpa o cache de miniaturas (#59), e são exatamente os mesmos dois pontos de chamada.
- **`requestUpdateKeyframe` NÃO limpa.** Regravar reescreve o keyframe em que se está, e continua-se nele; largar o destaque aí seria perder a marca bem no gesto que ela existe para guiar.

**Mover, duplicar e remover não pediram código nenhum:** o destaque casa por **id**, então reordenar leva a marca junto e remover faz a marca sumir sozinha. Leitura em vez de escrituração — a mesma escolha dos grupos de keyframe (#67).

### Na UI

- **Card** (item 40): `aria-current="true"` no `<li>` — a semântica certa para "o item atual de um conjunto", e o gancho estável do teste — mais um modificador de classe. O realce vem de `border-color` e de um `box-shadow` INTERNO, não de borda mais grossa: engrossar mexeria na caixa e faria a lista inteira dar um pulo a cada "Ir para". A cor é `--text-h`, que já vira clara no tema escuro; nada de variável nova, e nada de i18n, porque o destaque é visual.
- **Régua** (item 41): a marca não pôde entrar no `<datalist>` das marcas de keyframe — ele é a lista nativa do próprio `<input type=range>` e não aceita estilo por opção. Vai como elemento posicionado (`left` em porcentagem do total), a mesma técnica das faixas de grupo do #67, numa faixa fina PRÓPRIA logo abaixo da régua: em cima do controle disputaria espaço com o polegar, que é o que a mão arrasta. Três pixels de largura, e não um, para não se confundir com as marcas que o navegador desenha sozinho. Tem `title` (com i18n nas duas línguas), que é o que diz qual keyframe é.
- Recolhida a barra, o corpo não é renderizado e não há o que marcar — sem código para isso.

### Limite aceito

Um Ctrl+Z logo depois do "Ir para" devolve a cena anterior mas deixa o destaque parado. Carregar o retrato é edição de conteúdo, o destaque é ferramenta; assinar o histórico só para isto custaria mais que o incômodo.

### Verificação

**+10 testes** (6 no `AnimationPanel`, 4 na `TimelineBar`), suíte de 2.023 para **2.033**, todos verdes; `tsc -b`, `eslint .` e `npm run build` limpos. Os testes travam as quatro regras de limpeza, o "só um card por vez", o mover/remover por id, a posição da marca (50% com o k2 de três keyframes de 1 s) e a barra recolhida.

No Chrome real (`npm run preview`), sem erro de console: "Ir para" no keyframe 2 destaca **só** o card 2 e põe a marca a **0,500** da régua com o título certo; regravar mantém o destaque; capturar larga o destaque **e** apaga a marca. Conferido ampliado nos dois temas — traço escuro no claro, claro no escuro, abaixo do polegar e sem competir com ele.

## 74. Papel-cebola com escolha de lado

Pedido do usuário em 2026-07-29: poder mostrar o keyframe anterior e o seguinte **separadamente** ou os dois juntos.

### Por que ver um lado de cada vez muda o que se enxerga

Com os dois fantasmas ligados, uma pose no meio de um movimento fica cercada de corpo dos dois lados e some no meio deles — foi o que a medição mostrou: no keyframe do meio, com os dois ligados, o boneco de trabalho divide a imagem com ~13 mil pixels quentes e ~18 mil frios. Isolando o anterior lê-se de onde a pose **veio** (é o que interessa ao ajustar a chegada de um gesto); isolando o seguinte, para onde ela **vai**.

O modo escolhe **quem aparece, não o que cada um significa**: os papéis e as cores continuam os mesmos, então o fantasma quente é o passado nos três casos. Há teste travando isso — trocar a cor conforme o modo pareceria "aproveitar" o combo e destruiria a única convenção que o recurso tem.

### Dois campos, e não um de quatro valores

`onionSkin: boolean` continua sendo a liga/desliga, e o modo entrou como campo separado (`onionSkinMode: 'both' | 'previous' | 'next'`, `both` por padrão). Um campo só, de quatro valores, seria mais enxuto no papel e pior no uso: desligar e religar perderia o lado escolhido. Ligar/desligar é o gesto repetido; o lado é preferência que se faz uma vez. Teste travando o ida e volta.

### Na ponta, nada — e isso é decisão

No primeiro keyframe com "só o anterior" (ou no último com "só o seguinte") **não se desenha nada**. Cair no outro vizinho "para não ficar vazio" mostraria justamente o que quem escolheu um lado pediu para não ver. Medido no navegador: no keyframe 1 com "só o anterior", quentes e frios ficam nos ~450 pixels de linha de base.

### O resto seguiu o desenho que já existia

A regra de vizinhança continua em `onionSkin.ts`, testável sem WebGL: `onionSkinFrames` ganhou um terceiro parâmetro com padrão `both`, e é um filtro de papel — o âncora, as pontas e o mínimo de dois keyframes não mudaram. O combo aparece no painel **só com o papel-cebola ligado**: desligado seria um controle inerte na linha logo acima da lista de keyframes, o espaço mais disputado do painel. A dica foi reescrita para valer nos três modos (descreve os papéis e as cores, em vez de afirmar que os dois aparecem).

### Verificação

**+11 testes** (6 na leitura pura, 3 no desenho, 2 no painel), suíte de 2.033 para **2.044**, todos verdes; `tsc -b`, `eslint .` e `npm run build` limpos.

No Chrome real (`npm run preview`), sem erro de console, medido por contagem de pixels com o boneco de trabalho pintado de **verde** — de fábrica ele é vermelho e se confundiria com o fantasma quente:

| modo | pixels quentes | pixels frios |
| --- | --- | --- |
| anterior e seguinte | 13.322 | 17.932 |
| só o anterior | 14.899 | **410** |
| só o seguinte | **492** | 18.361 |
| keyframe 1, só o anterior | **493** | **410** |

Os ~450 são a linha de base da imagem sem fantasma nenhum. O painel continua sem rolagem horizontal (239 px de conteúdo em 239 px de largura).

## 75. Marca do playhead no card do keyframe

Pedido do usuário em 2026-07-29: ao clicar em ⏮/⏭ na linha do tempo, destacar no painel de Animação em qual keyframe ele parou.

### Duas marcas, e não uma

A marca do #73 diz **"a bancada está mostrando este keyframe"** — é ela que responde onde "Regravar" vai escrever. O ⏮/⏭ não carrega nada na bancada: ele só move o playhead, e o que muda na tela é a pré-visualização. Reaproveitar a mesma marca faria o card apontado dizer "é este que você está editando" a respeito de um keyframe que não foi carregado — e "Regravar" ali gravaria a cena de trabalho antiga por cima dele. É exatamente o acidente que o destaque do #73 e a confirmação do #69 existem para evitar.

Por isso são duas marcas, propositalmente desiguais em peso:

- **Bancada:** contorno inteiro do card mais `aria-current` (a semântica de "item atual do conjunto" pertence a esta, que é a de edição).
- **Playhead:** tarja fina na borda esquerda e um `▶` antes do título, com `title` traduzido. Mais fraca, porque é informação de navegação.

Quando as duas caem no mesmo card — o que acontece sempre depois de um "Ir para", que leva o playhead junto — os dois `box-shadow` se somam e continuam legíveis: contorno **e** tarja.

### Sem estado novo: é leitura do instante

`keyframeIndexAtTimeMs(animation, timeMs)` devolve o índice do keyframe que está EXATAMENTE naquele instante, ou -1. Nada é guardado, e por isso a marca vale de graça para tudo que move o playhead: ⏮/⏭, arrastar a régua, as setas de quadro que caem em cima de um keyframe, e o "Ir para".

**No meio de um trecho não há keyframe marcado.** É o que separa esta leitura do `anchorKeyframeIndex` do papel-cebola, que nesse caso devolve o keyframe de trás — lá a pergunta é "de quem estes fantasmas são vizinhos", e alguma resposta é obrigatória; aqui a pergunta é "o playhead parou em cima de qual", e a resposta certa entre dois keyframes é "nenhum". Duas funções parecidas com regras diferentes, cada uma com o comentário do porquê.

A comparação é **arredondada ao milissegundo**, que é como os instantes chegam: a régua manda inteiros e as setas de quadro caem na grade de 1/fps.

### Verificação

**+7 testes** (4 na função pura, 3 no painel), suíte de 2.044 para **2.051**, todos verdes; `tsc -b`, `eslint .` e `npm run build` limpos. Um dos testes trava justamente a independência das duas marcas: depois de "Ir para" no keyframe 2 as duas apontam para ele; andando com a régua, só a do playhead se move.

No Chrome real (`npm run preview`), com quatro keyframes e sem erro de console: três cliques em ⏭ levaram a marca de 0 → 1 → 2 → 3 acompanhando o relógio da barra (1.0s, 2.0s, 3.0s), um clique em ⏮ voltou para 2, no meio do trecho (1,5s) **nenhum** card ficou marcado e o `▶` sumiu da tela, e depois de "Ir para" no keyframe 2 um ⏭ deixou a bancada no 2 e o playhead no 3 — as duas marcas visíveis ao mesmo tempo, em cards diferentes.

## 76. Gizmo de translação de junta (arrasto de cadeia) — e a aposentadoria do IK de 2 ossos

Pedido do usuário em 2026-07-30: um gizmo de translação em TODAS as juntas do boneco, de forma que arrastar uma junta puxe/empurre automaticamente as juntas ACIMA dela até que ela chegue ao ponto arrastado, sem ultrapassar os limites articulares já existentes. A raiz é a única junta totalmente fixa. No limite de todas, o movimento trava. Ao final, tudo é convertido para o padrão usual de pose — nenhum formato novo de persistência. (Interpretação confirmada com o usuário: arrastar o cotovelo nunca rotaciona o próprio cotovelo — a cadeia que o posiciona é ombro → clavícula → tronco; o antebraço e a mão seguem RÍGIDOS, como num manequim físico.)

Quatro decisões tomadas com o usuário antes de escrever código:

1. **W/E alterna mover/girar na junta selecionada** — o `rootGizmoMode` virou `gizmoMode`, um modo único global (convenção dos softwares 3D): na raiz, mover/girar a colocação como antes; nas demais juntas, arrasto de cadeia / rotação FK. O seletor Mover/Girar do painel de Propriedades aparece agora também nas juntas arrastáveis.
2. **Todas as juntas, EXCETO mão/dedos** — arrastar a ponta de um dedo recrutando o tronco seria mais surpresa que utilidade; dedos continuam com sliders e presets de mão. Também ficam de fora `spine` e `hip.*`: o único ancestral delas é a raiz, que é fixa, então o gizmo nasceria morto — elas caem no gizmo de rotação em qualquer modo.
3. **Substitui o IK de 2 ossos da fase 7** — o arrasto cobre o caso de uso do alvo de IK (e mais). Saíram: `ikSolver.ts`, `ikActions.ts`, `ikStore.ts`, `IKTargetGizmo.tsx`, o atalho **R**, o badge "IK" do painel de Bonecos e o toggle/alvo/giro do painel de Propriedades. **Perda aceita:** o controle numérico de giro do cotovelo (#44) — o gesto equivalente é arrastar o próprio cotovelo com o punho onde está.
4. **Junta travada = elo rígido, sem interromper a cadeia** — ela não rotaciona, mas o recrutamento continua nas juntas acima (o alcance total encolhe; com TODOS os ancestrais travados o gizmo não sai do lugar). Diverge de propósito do IK antigo, que recusava a cadeia inteira com junta travada: aquele solver era analítico e não sabia trabalhar com um elo preso; este é iterativo e simplesmente pula o elo.

### O solver: CCD com recrutamento progressivo — e por que isso não contradiz o #12

O #12 aboliu CCD depois que ele travou em mínimo local contra a borda de um limite. Aquele regime era outro: um alvo DISTANTE resolvido numa chamada única. Aqui o solver (`dragSolver.ts`) roda a cada evento de mouse, sempre da pose atual para um alvo a milímetros dela — cada chamada só precisa dar um passo pequeno, e "parar na borda" quando o alvo é inalcançável não é defeito: é exatamente o travamento que o pedido descreve.

O CCD ingênuo sobre a cadeia inteira, porém, tinha um vício medido nos testes: o resíduo de cada varredura vazava para o tronco mesmo em alvos que o braço alcançava sozinho (spine girava ~2,6° num arrasto de 3 cm do punho). Daí o **recrutamento progressivo**: resolve com a junta mais próxima apenas; só expande uma junta em direção à raiz quando o resíduo passa de `RECRUIT_THRESHOLD_M` (5 mm). O limiar é maior que a tolerância de alcance (1 mm) de propósito — o CCD não explora perfeitamente a torção da junta próxima e pode estacionar a 2-3 mm do alvo mesmo quando o membro sozinho alcançaria; expandir por causa DESSE resíduo balançaria o tronco a cada evento. Abaixo de 5 mm o gizmo só fica esse tanto atrás do mouse (imperceptível); acima é saturação de verdade, e a junta seguinte entra — que é a prioridade do pedido de forma literal.

O clamp continua sendo por eixo em Euler depois de uma rotação 3D — não é a rotação válida "mais próxima", mesma limitação já aceita pelo solver da fase 7 (`quaternionToClampedDegrees`); as varreduras seguintes compensam o que o clamp comeu.

### Conversão exata para o padrão usual

O solver opera sobre `buildJointFrames` (o mesmo grafo de transformos do FK) e devolve rotações Euler XYZ em graus por junta, já grampeadas. Um teste trava o invariante central: reconstruir o boneco com as rotações devolvidas coloca a junta arrastada exatamente em `achievedWorldPosition` (erro < 1e-6 m) — ou seja, a "conversão para o sistema atual" não é um passo separado que possa divergir; é o próprio formato de saída.

A escrita no store ganhou uma ação em lote, `setJointRotations`: mesmas regras da unitária (clamp, trava, espelho ao vivo — reflexão sagital, #14/#30) num único `set`, e portanto **um passo de undo por evento de arrasto** — uma chamada por junta empilharia até 5 passos por pixel arrastado.

### O gizmo: proxy efêmero com snap-back

O `TransformControls` não pode ser anexado ao `Group` real da junta — o `position` dele é o offset fixo do esqueleto, e arrastá-lo corromperia a hierarquia. `JointDragGizmo.tsx` usa um PROXY (grupo sem geometria, filho da cena): fora do arrasto ele segue a junta a cada quadro (`useFrame` — sliders, presets e undo movem a junta por fora); durante o arrasto, cada `onObjectChange` resolve a cadeia, grava a pose e reposiciona o proxy na posição efetivamente ALCANÇADA. Esse snap-back é o que implementa o "movimento trava": quando tudo satura, o gizmo para de seguir o mouse.

### Verificação

Saldo de **−35 testes** (todos os do IK antigo saíram; 22 novos entraram: convergência e prioridade do solver, invariante de reprodução por FK, travas rígidas sem quebra de cadeia, undo em passo único, fiação do gizmo, lote do store, seletor de modo no painel), suíte de 2.051 para **2.016**, todos verdes; `tsc -b`, `eslint .` e `npm run build` limpos. A interação de arrastar em si não é testável por automação (mesma ressalva dos demais gizmos) — **validada manualmente pelo usuário no navegador em 2026-07-30: funcionamento OK**.

## 77. Juntas travadas em vermelho enquanto o gizmo de mover está ativo

Pedido do usuário em 2026-07-30, na sequência do #76: uma identificação no boneco selecionado destacando as juntas travadas "durante o movimento de translação" — cor diferenciada. Duas decisões tomadas com o usuário:

1. **Quando:** sempre que o gizmo de translação de junta estiver visível (modo Mover numa junta arrastável), e não só com o botão do mouse pressionado. O valor do aviso está justamente em ANTES: quem vê o ombro vermelho antes de puxar o punho já sabe que ele vai ficar rígido — descobrir só no meio do arrasto seria tarde.
2. **Escopo:** todas as juntas travadas do boneco selecionado, e não só as da cadeia da junta arrastada. Regra simples, com a mesma semântica do cadeado em todo lugar; uma trava fora da cadeia continua visível (e trocar a junta selecionada não faz destaques aparecerem/sumirem de forma aparentemente aleatória).

### Como

Mesmo mecanismo do destaque de seleção que o `Figure.tsx` já tinha, um degrau mais fraco: emissivo `#ef4444` a 0,5 de intensidade (a seleção usa `#ffe066` a 0,6). Precedência explícita: **seleção > trava** quando a junta selecionada também está travada — a trava dela, aliás, nem afeta o próprio arrasto (a junta arrastada não rotaciona; quem importa são os ancestrais). Olhos continuam pretos e fantasmas continuam sem destaque nenhum, pelas mesmas razões da seleção (o corte do fantasma acontece no mesmo lugar único que já cortava clique/refs/seleção).

A fiação vive em `SceneFigures.tsx`: a condição de "gizmo de mover ativo" é a MESMA do `Viewport` para montar o `JointDragGizmo` (junta arrastável selecionada + `gizmoMode === 'translate'`), e só o boneco selecionado recebe `lockedJointNames` (via `getLockedJoints`). Nenhum estado novo, nenhum i18n — é leitura de `jointLocks` e `gizmoMode` que já existiam.

### Verificação

**+4 testes** no `Figure.test.tsx` (emissivo vermelho só nas juntas listadas; seleção vencendo a trava; sem lista, nenhum tom; fantasma imune), suíte de 2.016 para **2.020**, todos verdes; `tsc -b`, `eslint .` e `npm run build` limpos. **Conferência visual feita pelo usuário no navegador em 2026-07-30, junto com a validação do arrasto do #76: funcionamento OK.**

## 78. Câmera de cena separada do viewport de trabalho (fase 11)

Pedido do usuário em 2026-07-30: a câmera deixar de ser o viewport — mover-se pela bancada livremente sem afetar o enquadramento —, com um elemento visual mostrando onde a câmera está e uma máscara vertical estilo TikTok/Instagram. Avaliação de viabilidade feita antes de qualquer código, e **cinco decisões respondidas pelo usuário**:

1. **Modo alternável** edição ↔ visão da câmera, com aviso destacado no viewport indicando o modo; botão no painel de Câmera. Todas as configurações existentes do painel passam a valer para a câmera de cena, **exceto as vistas ortográficas**.
2. **Máscara vertical = só um preset 9:16** (1080×1920) na lista de resoluções existente — a máscara de enquadramento (#53) já faz o resto.
3. **O painel de Câmera comanda a câmera de cena** (planos, POV, movimento A→B, lente, bookmarks…), com exceção das ortográficas.
4. **Gizmo arrastável e girável**, representação estilo Blender no modo edição.
5. **Posição persistida** com a cena; mover a câmera **não entra** no histórico de undo.

Mais duas propostas de borda aprovadas: viewport **travado** no modo visão-câmera (como o Blender por padrão; "lock camera to view" fica como ideia futura), e ortográficas/bookmarks ortográficos **voltam ao modo edição** automaticamente.

### Onde a câmera vive — e por que fora do undo

`figuresStore.sceneCamera`, no formato `CameraViewState` que os keyframes já usavam — **nenhuma migração de animação**. É conteúdo persistido (autosave, snapshots do catálogo — cada cena guarda o próprio enquadramento —, `.glb` por campo aditivo sem subir `SCENE_EXTRAS_VERSION`, mesmo precedente do `snapshotCounter`), mas fica fora do `partialize` do zundo: mover a câmera é ENQUADRAR, como a órbita, e um Ctrl+Z de pose não pode teleportá-la. A leitura (`sceneCameraFromExtras`) recusa câmera degenerada (posição no alvo, up nulo) devolvendo a padrão.

### Estado × objeto vivo

A fonte da verdade em repouso é o store; o `THREE.PerspectiveCamera` real é um singleton de módulo (`sceneCameraObject.ts`) que o `CameraRig` espelha do estado. A reprodução de animação escreve **direto no objeto** (a regra de desempenho de sempre: nada de um `set` de store por quadro) e comita o último enquadramento ao parar; o gizmo segue o objeto por `useFrame`, então acompanha os dois caminhos. Navegar pela linha do tempo e "ir para" escrevem no store de verdade — capturar logo depois grava o enquadramento daquele instante, o mesmo modelo mental de antes.

### O executor continua no `CameraRig`

Os comandos cinematográficos continuam passando por `pendingCommand` (as transições do `cameraStore` e seus testes ficaram praticamente intactos); o que mudou é o alvo: em vez de mover a câmera viva do viewport, o executor calcula com a MESMA matemática pura (`shotFraming.ts`, `cameraMove.ts`) partindo do estado da câmera de cena e grava o resultado (`commitSceneView`). A proporção dos planos passou a ser a da **saída** (`outputAspect.ts`: a resolução do vídeo ou do instantâneo, conforme a máscara) — é para o arquivo que a câmera enquadra, não para a janela. Exportação de MP4, miniaturas e PNG renderizam por câmeras montadas na hora (o PNG pela câmera de cena; o vídeo por uma descartável por quadro) — o viewport não é mais sequestrado, e a trava de órbita durante a reprodução **deixou de existir**: é justamente o que o pedido queria.

### Verificação

**17 testes novos/ajustados** (serialização com round-trip/defaults/degenerada; câmera fora do undo e por snapshot no `figuresStore`; modo de visão no `cameraStore` — ortográficas/F voltam à edição sem apagar o plano, bookmark perspectivo × ortográfico; atalho `0`; preset 9:16), suíte de 2.020 para **2.037**, toda verde; `tsc -b`, `eslint .` e `npm run build` limpos. **Validação no navegador pendente** (arrasto/giro do gizmo, troca de câmera ativa e exportações — os imperativos de sempre).

## 78.1. Correção do "ver pela câmera" torcendo a câmera, e controles numéricos de posição/rotação

Dois pedidos do usuário em 2026-07-30, na sequência da fase 11 (#78): o botão "Ver pela câmera" estava **girando a câmera para baixo**, e o painel de Câmera deveria ganhar controles de rotação e translação **iguais aos existentes para as poses**, integrados ao gizmo.

### O bug: o OrbitControls seguia a câmera padrão

O `<OrbitControls>` do drei, sem a prop `camera`, se liga à câmera PADRÃO do R3F (`explCamera = camera || defaultCamera`) e recria os controles quando ela muda. Entrar no modo visão-câmera troca a padrão para a câmera de cena — os controles rebindavam nela e o `update()` deles a torcia para o alvo antigo da órbita (tipicamente mais baixo que o alvo dela: a câmera "olhava para baixo"). `enabled={false}` não protege: o snap acontece no rebind, não no arrasto.

**Correção:** as câmeras de navegação viraram singletons de módulo (`viewportCameras.ts`, o mesmo padrão do `sceneCameraObject.ts`), e o `Viewport` passa a instância EXPLICITAMENTE na prop `camera` do `<OrbitControls>` (perspectiva ou ortográfica, conforme a projeção). Os controles nunca mais enxergam a câmera de cena, em nenhum modo. O `CameraRig` usa as mesmas instâncias (só completa aspecto/frustum com o tamanho da janela no primeiro uso).

### Controles numéricos, mão dupla com o gizmo

Dois fieldsets novos no painel de Câmera, no MESMO desenho da colocação do boneco no painel de Propriedades: **Posição (m)** em campos numéricos e **Rotação (°)** em sliders com a cor de cada eixo. Os valores são LIDOS de `figuresStore.sceneCamera` — arrastar/girar o gizmo (ou aplicar um plano, ou tocar a animação) os atualiza ao vivo — e editá-los grava pelo mesmo `setSceneCamera`, então gizmo, painel, modo visão e keyframes nunca divergem.

A conversão vive em `sceneCameraTransform.ts` (pura, testada): rotação em Euler **YXZ** (guinada → inclinação → rolagem, a ordem natural de câmera; X limitado a ±90° para a extração bater sempre com o slider), extraída de posição/alvo/topo e reconstruída preservando a distância ao alvo — girar pelo número é exatamente o modo E do gizmo, e transladar leva o alvo junto como o modo W. O slider Z é a inclinação lateral (o ângulo holandês visto pelo outro vocabulário; o slider Dutch Angle continua existindo como gesto rápido com faixa própria).

### Verificação

**10 testes novos** (`sceneCameraTransform.test.ts`: zero/guinada/inclinação, round-trip estável, giro sem mover posição/distância, rolagem do topo, degenerada; `CameraPanel.test.tsx`: posição translada o alvo junto, sliders refletem o store, girar preserva posição/distância e não empilha undo), suíte de 2.037 para **2.047**, toda verde; `tsc -b`, `eslint .` e `npm run build` limpos. A conferência visual do modo visão-câmera (agora sem a torção) segue com o usuário.

## 78.2. Botões Mover/Girar da câmera no painel

Pedido do usuário em 2026-07-30, fechando a leva do #78.1: um botão no painel de Câmera para alternar o gizmo dela entre translação e rotação.

**Como:** o par Mover/Girar entrou no fieldset "Câmera de cena", com os MESMOS rótulos do alternador de gizmo do painel de Propriedades (`panels.properties.gizmoTranslate/gizmoRotate` — nenhum termo novo para aprender) e agindo no MESMO `uiStore.gizmoMode` global dos atalhos W/E: é um gizmo só, compartilhado com as juntas, então painel, teclado e viewport nunca discordam. Apertado daqui, o botão também **seleciona a câmera** (desselecionando o boneco): o gesto é "quero mover/girar a câmera", e sem a seleção ele trocaria o modo de um gizmo que não está na tela. Desabilitado no modo visão-câmera, onde o gizmo não existe (mesma regra do "Posicionar na vista atual"); `aria-pressed` acende só com a câmera selecionada, para não parecer que o painel dela comanda o gizmo da junta.

**Verificação:** +2 testes no `CameraPanel.test.tsx` (troca de modo + seleção exclusiva; desabilitado no modo visão), suíte de 2.047 para **2.049**, toda verde; `tsc -b`, `eslint .` e `npm run build` limpos.

## 78.3. "Vertical 9:16" direto no seletor da máscara de enquadramento

Pedido do usuário em 2026-07-30: incluir o preset vertical como opção da máscara de enquadramento.

**Como:** uma quarta fonte no seletor da Toolbar — `vertical` — que, diferente das outras duas, não aponta para a resolução configurada de painel nenhum: é o 9:16 de TikTok/Instagram fixo (o MESMO preset `vertical` da lista de resoluções, fonte única do número), para compor no formato sem antes trocar a resolução do instantâneo ou do vídeo. A resolução que cada fonte representa foi extraída para uma função pura (`frameMaskResolution`, em `frameMask.ts`), consumida pelos dois lugares que decidiam isso separadamente: o `FrameMaskCamera` (o retângulo da máscara) e o `outputAspect.ts` (a proporção que os planos cinematográficos e o frustum do gizmo usam) — escolher "Vertical 9:16" muda a máscara, o enquadramento dos planos e o desenho do gizmo de uma vez, como as outras fontes. A validação de `localStorage` (`uiPreferences.ts`) já lia de `FRAME_MASK_SOURCES`, então a persistência veio de graça.

**Verificação:** +3 testes de `frameMaskResolution` e +1 na Toolbar (seleção e persistência do `vertical`), suíte de 2.049 para **2.052**, toda verde; `tsc -b`, `eslint .` e `npm run build` limpos.

## 78.4. Máscara por proporção e resoluções como proporção × qualidade

Pedido do usuário em 2026-07-30: deixar a máscara de enquadramento e as opções de gravação independentes.

1. **Máscara: sem máscara / 16:9 / 9:16 / 1:1.** As fontes "do instantâneo" e "da animação" saíram — como o usuário apontou, desde a fase 11 as duas saídas veem a MESMA câmera de cena, então "de qual painel vem a proporção" deixou de ser uma pergunta com sentido; o que interessa ao compor é a proporção do quadro, escolhida direto. `frameMaskResolution` ficou sem parâmetros de resolução (a escala nominal vem da tabela de resoluções, só a razão importa), e `FrameMaskCamera`/`outputAspect.ts` deixaram de assinar os stores de instantâneo/animação. Valor antigo persistido no `localStorage` (`snapshot`/`animation`) cai no default `off` pela validação que já existia.
2. **Resoluções de exportação = proporção × qualidade.** A lista única de presets (720p só no 16:9, 4K, quadrada e vertical só em 1080) virou duas escolhas independentes nos painéis de Instantâneos e de Animação: **proporção** (16:9, 9:16, 1:1 — os mesmos rótulos da máscara) e **qualidade** (1080p, 720p — o nome é o lado MENOR, como nos players, então 9:16 em 1080p é 1080×1920). Toda proporção grava nas duas qualidades; o 4K saiu ("não precisa", decisão do usuário — a personalizada do instantâneo continua aceitando até 3840 para quem quiser). O vídeo segue sem personalizada, como sempre foi; a personalizada do instantâneo desabilita o seletor de qualidade e preserva a resolução em vigor como ponto de partida. `outputResolutionFor(aspect, quality)` em `snapshot/constants.ts` é a única tabela — máscara, painéis e stores derivam dela.

Padrões: instantâneo nasce 16:9 em 1080p (era Full HD — o mesmo quadro), vídeo 16:9 em 720p (era 720p — idem): ninguém muda de resolução ao atualizar.

**Verificação:** testes reescritos onde o modelo mudou (`snapshotCaptureStore` com a tabela das seis combinações, `SnapshotPanel` com os dois seletores e a qualidade desabilitada na personalizada, `Toolbar` com as proporções, `frameMask`/`uiPreferences` com as fontes novas), suíte em **2.053**, toda verde; `tsc -b`, `eslint .` e `npm run build` limpos.

## 79. Exportar e importar uma animação em JSON, com remapeamento para os bonecos da cena

Pedido do usuário em 2026-07-30: exportar e importar um JSON com todos os dados de uma animação. Depois de uma primeira avaliação, o usuário fechou o desenho em três respostas (exportar só a de trabalho; a importação **não** entra na biblioteca e um `<dialog>` pergunta se substitui ou anexa; todos os keyframes de um arquivo são uma animação só) e pediu a avaliação de um segundo ponto — **remapear as posições para os bonecos que já estão em cena, em vez de recriar os gravados** —, fechado com mais três (absoluto ao substituir e reancorado ao anexar; preservar a visibilidade gravada; oferecer "recriar" como saída quando faltam bonecos).

### O arquivo é o `animations.json` de sempre

Nada de formato novo: exportar grava o mesmo schema do workspace (`version`, `leiame`, `animations[]`) com **uma** entrada, e importar passa pelo mesmo `sanitizeAnimations` (juntas grampeadas aos limites em vigor, keyframe sem bonecos ou sem câmera descartado). Consequências de graça: o arquivo exportado pode ser largado na pasta do workspace, e um `animations.json` inteiro pode ser importado sem pasta nenhuma — nesse caso **todos os keyframes viram uma linha do tempo só** (decisão do usuário), com nome e velocidade da primeira entrada. `parseImportedAnimation` devolve `null` quando não sobra keyframe aproveitável: o painel diz isso em vez de abrir um diálogo para importar coisa nenhuma.

### A biblioteca não entra na história

Importar mexe **só na animação de trabalho**: ou a substitui (nome, velocidade e keyframes vêm do arquivo) ou é anexado ao fim dela (nome e velocidade continuam sendo os da bancada — a velocidade é da linha do tempo inteira, e o nome é o do MP4 que vai sair dali). Um `set` só nos dois casos, portanto **um passo de undo**, como abrir uma animação salva. Os rótulos de grupo que chegam são desconflitados bloco a bloco (`freeKeyframeLabel`): dois trechos "Andando" viram dois grupos, não um bloco emendado.

### Remapear é o padrão; recriar é a saída

Uma animação gravada em outra cena é uma **coreografia** — quem a executa são os bonecos que já estão ali. No remapeamento, o boneco da cena mantém id, nome, cor e altura, e recebe pose, giro, colocação e **visibilidade** de cada keyframe (aparecer e sumir fazem parte da coreografia). Papel sem boneco não é executado; boneco sem papel fica parado em todos os keyframes. Quando a cena tem menos bonecos do que a animação usa, o remapeamento é desabilitado com o motivo à vista e sobra **recriar os bonecos gravados** — que é também o único modo fiel a nomes, cores e alturas de origem.

**Ancoragem, e a câmera junto.** Substituir usa as colocações **absolutas** gravadas, e a câmera do arquivo continua enquadrando exatamente o que enquadrava. Anexar **reancora** a ação no boneco do papel 0 (posição e heading, com o deslocamento no chão reescalado pela razão de altura, a mesma regra dos trechos) — e aplica à câmera de cada keyframe o **mesmo transporte rígido** (giro em Y em torno da âncora + translação; `up` gira, não translada). Sem isso, a emenda ficaria contínua para os bonecos e mostraria chão vazio: a câmera apontaria para onde a animação foi gravada. Em qualquer modo, a altura vertical gravada é corrigida pela escala do boneco que executa — sem isso um boneco de 1,55 m herdando a altura de quadril de um de 1,90 m flutuaria.

### Por que `animationRemap.ts` não reusa `resolveSavedClip`

O plano previa passar a importação pela máquina de papéis dos trechos salvos. Ao escrever, apareceu um impedimento: `resolveSavedClip` escala a altura de **todos** os papéis pela altura do boneco ÂNCORA — aproximação que serve a um trecho de dupla e erra numa animação de elenco misto —, e `buildKeyframesFromClip` congela **uma** câmera em todos os passos (a regra dos trechos, #60). Adaptar os dois teria mudado o comportamento de um recurso já entregue e testado, para servir a outro. O remapeamento ficou num módulo próprio, com a altura corrigida por papel e a câmera transportada por keyframe — e o `clipLibrary`, o formato `clips.json` e os trechos salvos **não foram tocados**. Efeito colateral bem-vindo: a visibilidade gravada é preservada sem estender o modelo de papéis (o remapeamento a lê direto do keyframe), então o campo novo em `SavedClipFigureState` que o plano previa deixou de ser necessário.

### O `<dialog>` e o jsdom

O diálogo é o elemento nativo (modalidade e `::backdrop` do navegador), mas o **jsdom 29 não implementa `showModal()`** — verificado antes de escrever. O componente renderiza `<dialog open>` controlado pelo React e chama `showModal()` só quando a função existe: um caminho de código, os dois ambientes atendidos, e o diálogo continua sendo encontrável por `getByRole('dialog')` nos testes. Enquanto ele está aberto, `uiStore.modalOpen` suspende os atalhos globais (mesma proteção que o painel de ajuda já tinha) — do contrário um `W` digitado sobre o diálogo trocaria o gizmo da cena por baixo dele.

### Verificação

**37 testes novos** (`animationRemap.test.ts`: identidade do boneco preservada, colocações absolutas, escala da altura, visibilidade, transporte da ação e a invariante da câmera relativa à âncora, papéis ausentes, ids/durações/rótulos; `animationsFile.test.ts`: round-trip do arquivo avulso, várias entradas viram uma linha do tempo, arquivo sem animação; `animationImport.test.ts`: as quatro combinações, um passo de undo, rótulos desconflitados, biblioteca intocada; `AnimationPanel.test.tsx`: exportar desabilitado/nome do arquivo, diálogo com o resumo, remapeamento padrão, aviso de bonecos insuficientes, anexar indisponível na bancada vazia, cancelar e arquivo inválido). Suíte de 2.053 para **2.090**, toda verde; `tsc -b`, `eslint .` e `npm run build` limpos.

## 80. Objetos de cena 3D redimensionáveis, com vértice livre

Pedido do usuário em 2026-07-30: avaliar (sem implementar) a inclusão de objetos 3D simples redimensionáveis na cena. A avaliação apontou que o encaixe é bom por uma razão específica — a complexidade do app é do MANEQUIM (esqueleto, limites articulares, poses, arrasto de cadeia, espelho, travas de junta), e um objeto de cena não reaproveita nada disso como custo: é `forma + tamanho + colocação + cor`. Cinco decisões foram levadas ao usuário antes de escrever código; ele respondeu todas, e acrescentou duas funcionalidades.

### Cenário estático foi a decisão que definiu o custo

`AnimationKeyframe.figures` é o retrato da cena. Se o objeto fosse ATOR, ele teria de entrar no keyframe, e daí em `sanitizeKeyframe`, no amostrador, na biblioteca de trechos, no remapeamento de elenco (#79), nas miniaturas e em toda ação de captura/regravação de keyframe — mais uma regra de compatibilidade para keyframes antigos, que não têm o campo (e cujo carregamento não pode apagar os objetos da cena). Com **cenário estático**, escolha do usuário, nada disso foi tocado: o objeto vive na cena e a animação continua exatamente como estava. É a diferença entre 🟡 e 🔴.

### Tamanho em metros, e por que isso proíbe `scale` de nó

O modelo guarda `size: [x, y, z]` em **metros** — a mesma unidade do boneco de 1,70 m, da grade de 1 m e da régua vertical. O gizmo de escala do viewport é só outra forma de arrastar esse número: `PropTransformGizmo` converte o fator do `TransformControls` contra o tamanho capturado no **início do arrasto** (usar o corrente comporia a cada evento de mouse e multiplicaria o objeto ao infinito) e devolve a escala do nó a 1 ao soltar.

A consequência não óbvia é que a geometria precisa ser construída **no tamanho real**, e não como primitiva unitária mais `scale` no nó: com desvios de vértice em metros absolutos, uma escala de nó multiplicaria a deformação junto com a primitiva — um canto puxado 10 cm passaria a valer 20 cm ao dobrar a caixa. Um caminho de código só, e de quebra o `.glb` sai com a malha de verdade em vez de primitiva + escala.

### Vértice livre: a decisão do usuário contra a recomendação, e o que a viabilizou

A avaliação recomendou **alças de face e de canto** em vez de vértice livre, porque mover um vértice arbitrário tira o objeto do território "primitiva com tamanho em metros". O usuário escolheu vértice livre. Dois mecanismos mantiveram a decisão viável sem virar editor de malha:

**1. Pontos de controle soldados.** O `BoxGeometry` do three tem **24** vértices, não 8 — cada face precisa dos seus, para ter normal e UV próprios. Arrastar "um canto" mexendo num só desses vértices rasgaria a malha em três pedaços; o mesmo vale para a costura do cilindro e os polos da esfera. Vértices coincidentes são soldados num ponto de controle, e mover o ponto move todas as cópias. Caixa 8, plano 4, rampa 6, cone 18, cilindro 34, esfera 114.

**2. Desvios esparsos, em metros absolutos, indexados por ponto de controle.** O arquivo guarda `forma + tamanho + { índice: [dx,dy,dz] }` — nunca uma malha solta. Objeto intacto não grava a chave; o `localStorage` e o `.glb` continuam pequenos; e o objeto permanece editável como primitiva depois de reabrir.

**O índice do ponto de controle virou contrato de arquivo.** Mudar `PROP_SEGMENTS` remapearia deformações já salvas para vértices errados — silenciosamente. Três defesas: a subdivisão é constante, a soldagem é feita sobre a primitiva **unitária** (a ordem não depende do tamanho do objeto, então redimensionar não embaralha desvios) e há um teste travando a contagem de cada forma. Trocar a forma de um objeto **descarta** os vértices movidos, e não há como não descartar: o ponto 3 de um cubo não é o ponto 3 de uma esfera. O painel avisa antes.

### Três estados de visibilidade que não são a mesma coisa

O usuário acrescentou duas funcionalidades depois da avaliação, e elas criaram um trio que a UI precisa distinguir:

- `visible` — conteúdo: desligado, some de tudo, **inclusive** do PNG e do MP4.
- `hiddenInEditor` — some só da bancada, **continua saindo** na captura. É o simétrico exato dos `OVERLAY_NAMES`: aqueles aparecem na tela e somem no arquivo.
- `locked` — visível e no arquivo, mas fora do alcance do clique.

**O simétrico exigiu mecanismo novo.** Quem esconde o objeto na bancada é o React (`visible={false}`), e a captura renderiza a árvore viva — então sem um passe que o reacenda, o cenário tirado da frente para posar sumiria também da foto. `revealEditorHidden` faz esse passe, marcado por `userData`, e é chamado **lado a lado** com `hideSceneOverlays`, nunca dentro dele: esconder apoios de tela é opção do usuário na captura de imagem, e reacender o cenário não pode depender dela. Objeto desligado de verdade não carrega a marca e continua fora da imagem.

"Oculto na bancada" vale só no **modo de edição** (`viewMode === 'edit'`): no modo visão-câmera se está conferindo o quadro, e o quadro tem o cenário.

**Os dois vão DENTRO do objeto, e portanto no undo** — decisão do usuário, seguindo a recomendação. Diverge das travas de junta (#42), que são estado de trabalho fora do histórico, e o motivo é que uma trava de objeto é propriedade da CENA (como o `visible` do boneco, que também é desfazível), e não um modo de sessão.

### Seleção generalizada, sem mudar o estado de lugar

Até aqui havia duas coisas selecionáveis e a exclusividade era feita à mão aos pares: o `SceneCameraGizmo` chamava `selectFigure(null)`, e o `Viewport` mantinha um efeito que apagava a câmera ao escolher um boneco. Com uma terceira, isso vira três pares para manter em dia. `store/selection.ts` passou a ser o ponto único de leitura (`useSelection`) e de escrita (`selectTarget`).

**O estado continua onde estava** (`figuresStore` para boneco e objeto, `cameraStore` para a câmera): movê-lo para um store novo tocaria ~15 arquivos e dezenas de testes sem mudar comportamento nenhum, e a seleção já está fora do histórico de undo nos dois lugares. O módulo importa os dois stores e nenhum store o importa — a dependência fica numa direção só, sem ciclo.

### Detalhes que só apareceram ao escrever

- **A rampa não existe no three.** Uma `ExtrudeGeometry` traria biselamento e UVs desnecessários; 8 triângulos escritos à mão, não indexados, dão normais chapadas e exatamente 6 pontos de controle depois da soldagem.
- **O plano é uma folha:** o eixo Z é ignorado pela geometria, e o material precisa de `DoubleSide` — sem isso ele desaparece quando a câmera passa para trás.
- **`normalizeFigureColor` mudou de casa.** O objeto precisa da mesma validação de cor livre (#39), mas importar o `figuresStore` a partir do módulo do objeto seria ciclo (o store é quem importa o objeto). A regra foi para `scene/hexColor.ts`, e o store a reexporta — nenhum importador existente mudou.
- **`updateProp` devolve o array ORIGINAL quando nada mudou**, ao contrário do `updateFigure`. É o que faz uma edição barrada pela trava não empilhar um passo de undo que não desfaz coisa alguma (a `equality` do `zundo` compara por referência).
- **Geometria é recurso de GPU.** Um arrasto de vértice emite dezenas de geometrias por segundo; sem o `dispose` no desmonte do `useMemo`, cada uma ficaria para trás.
- **Os números 40 e 41 já estavam ocupados** pelo destaque do keyframe na bancada (#73), acrescentados no fim do PLANO.md em 2026-07-29 e fora da seção da lista. A numeração nunca é reaproveitada, então o item virou **42**, em um grupo I novo — e as referências no código, escritas antes de eu notar, foram corrigidas.

### Verificação

**77 testes novos** (`propGeometry.test.ts`: contagem travada por forma, soldagem cobrindo todo vértice sem sobra, tamanho em metros, plano sem Z, sentido da rampa, malha que não rasga, desvio absoluto, normais recalculadas, geometria por objeto, apoio no chão com rotação e com vértice puxado, sanitização; `propsStore.test.ts`: criação/limite/duplicação, as três chaves independentes, objeto travado inerte a tudo, tamanho grampeado, desvio guardado e revertido, troca de forma descartando vértices e preservando tamanho, exclusividade da seleção nos três sentidos, undo, snapshot de cena, reset do workspace, cor livre; `propSerialization.test.ts`: ida e volta, campo aditivo em arquivo antigo, forma desconhecida virando caixa, desvio fora da forma descartado, `.glb` com malha real e nome de nó seguro, "oculto na bancada" não tirando o objeto do arquivo; `sceneCapture.test.ts`: reacender e restaurar, objeto desligado intocado, e a trava de que o passe **não** faz parte do `hideSceneOverlays`; `PropsSection.test.tsx`: lista, limite, cor, as três chaves, chave geral, medidas em metros, ferramenta de vértice, contador e aviso de descarte, controles inertes com objeto travado). Suíte de 2.090 para **2.167**, toda verde; `tsc -b`, `eslint .` e `npm run build` limpos. Os arrastos em si não são testáveis por automação (ressalva de sempre dos gizmos) — **falta a conferência visual no navegador pelo usuário**.

## 81. Casca de palito e pose em arquivo JSON — a ponte com o celular

Duas entregas de um pedido só (2026-07-30): preparar o terreno para editar poses em dispositivo touch. O usuário pediu antes três avaliações — a viabilidade de cascas alternativas do boneco, a de uma visão de celular em quadrante 2×2, e como implementá-la sem afetar o que já existe — e só então mandou implementar a parte que cabe **na aplicação atual**: a casca de palito e o arquivo de pose. A visão 2×2 não foi implementada e acabou **descartada** no mesmo dia — a versão de celular passou a ser planejada com um viewport único que alterna entre as vistas, em qualquer aparelho (PLANO.md > grupo J, item 44).

### Por que as duas coisas são a mesma entrega

O palito sozinho é só um desenho diferente. O que ele resolve é a **seleção por dedo**: as bolas de junta do manequim vão de 0,011 m (nós dos dedos) a 0,052 (ombro), e os blocos entalhados (peito, pelve, pé) não têm bola nenhuma para mirar. O arquivo de pose sozinho seria mais uma exportação. Juntos são a tomada: posa-se onde o dedo alcança, grava-se num JSON, refina-se no computador.

### A casca é dado, não código

A separação que o #32 deixou pronta (cinemática em `JOINTS`/limites, aparência em `JOINT_PARTS`/`BONE_STYLES`) fez a variante custar **uma tabela**, não um renderizador. `getJointParts`/`getBoneStyle` ganharam um segundo parâmetro `FigureStyle` cujo default é `wooden` — e é esse default que manteve intactos o enquadramento de câmera (`shotFraming.topOfJointParts`), a exportação e todos os testes que já existiam. Nenhuma pose, nenhum limite, nenhum arquivo e nenhum solver sabem que a variante existe.

As tabelas do palito são **geradas** a partir de `JOINT_NAMES`, e não escritas à mão como as do manequim: a casca é regular (uma esfera por junta, um cilindro por osso), e uma tabela literal de 32+31 entradas só criaria a chance de esquecer uma. As medidas ficam em dois mapas por nome sem lado, exportados para o teste poder cobrar medida explícita de cada junta — o valor de emergência existe para uma junta nova não derrubar a aplicação, não para ser usado.

### Três coisas do dimensionamento que não eram óbvias

- **Nem toda junta pode engordar.** A regra ingênua ("junta grande = alvo bom") quebra nos trechos apertados do esqueleto. `upperChest` e `neck` estão a 4 cm um do outro; com o raio das juntas grandes (0,045) viravam uma bola só, sem dois alvos distintos. Pior: com `chest` em 0,045 a esfera do peito **continha o centro** do `upperChest`, que virava uma calota protuberante em vez de um alvo — o peito caiu para 0,038 por causa disso. O invariante virou teste ("nenhuma esfera contém o centro da vizinha"), que é o que impede a regressão silenciosa; sobreposição parcial continua bem-vinda, é o que emenda as peças num corpo só.
- **Os dedos NÃO são dimensionados para o dedo.** Eles estão fora do arrasto de cadeia (`HAND_JOINTS` em `dragSolver.ts`), então engordá-los não daria alvo novo nenhum e só transformaria a mão num bloco.
- **Nenhum osso é `hidden` aqui.** Os três trechos escondidos no manequim (root→hip, ankle→ball, wrist→indexBase) só estavam cobertos pelos blocos da pelve, do pé e da palma. Sem eles, esconder deixaria vãos no quadril, no pé e na mão.

A cabeça é a única peça própria: esfera deslocada para cima em exatamente o próprio raio (base encostando na junta, topo fechando os mesmos 1,70 m do ovo do manequim) mais um **marcador escuro à frente**. Numa esfera lisa não há como saber para onde o boneco olha, e é justamente isso que orienta quem posa numa tela pequena; reusa o `tint: 'eye'` em vez de inventar tom novo.

### A casca é modo de tela, e por isso vale para todos

`figureStyle` mora no `uiStore` e persiste em `uiPreferences`, ao lado da régua e da máscara — não no `environment` da cena. Guardá-la lá a faria viajar no `extras` do `.glb` e no `workspace.json`, mudando um contrato de arquivo que o Blender também lê para descrever algo que nem existe fora da tela. Fica fora do undo pela mesma razão.

Consequência assumida: vale para **todos** os bonecos ao mesmo tempo — dois bonecos em cascas diferentes na mesma cena seriam dois desenhos do mesmo objeto, sem uso nenhum. Os fantasmas do papel-cebola seguem a casca da cena de trabalho, senão um palito rodeado de manequins translúcidos leria como dois modelos diferentes.

### O arquivo de pose é o keyframe, não um formato novo

Pedido explícito do usuário: "usar a mesma estrutura usada internamente nas animações". O campo `figure` do arquivo é **exatamente** o objeto que vive dentro de `keyframes[].figures[]` do `animations.json`, e a leitura passa pelo `sanitizeFigure` da própria animação — que teve de deixar de ser interno e virar exportado. Uma regra só de validação e grampeamento para os dois caminhos, e a promessa de que uma pose vinda do celular emenda como keyframe sem conversão.

A leitura aceita **seis formatos** da mesma família (arquivo de pose, boneco cru, keyframe solto, animação solta, `animations.json` inteiro, e array cru de qualquer um deles). É o que faz o arquivo ser ponte de verdade: uma animação exportada no computador serve de fonte de pose sem ser recortada à mão antes.

**Colocação no chão não é pose** — a regra que o usuário definiu, e a razão dela:

- Ao **gravar**, o boneco é considerado sempre no (0,0) do plano horizontal: X e Z saem zerados. Onde ele pisa é composição da cena de origem, e não tem por que viajar junto.
- Ao **carregar**, X e Z do boneco de destino são preservados e só o **Y** vem do arquivo. Quem recebe a pose já colocou o boneco no lugar; arrastá-lo para a origem seria desfazer esse trabalho. O Y, ao contrário, é pose: é ele que distingue agachado de pulando.

Já havia precedente exato disso no código — `withPose` e o blend de poses fazem `[figure.position[0], <novo Y>, figure.position[2]]` há tempos.

O Y entra **cru**, sem a escala por altura que `withPose` aplica ao `groundOffsetM` de uma pose salva: aqui a altura do boneco vem do mesmo arquivo, então o boneco fica do tamanho em que aquele Y foi medido e a medida absoluta já é a certa.

`id`, `name`, `color` e `visible` viajam no arquivo (para o objeto continuar sendo um `figures[]` válido de animação) mas **não são aplicados**: identidade e aparência são do boneco de destino, mesma regra do `poses.json` e do `applyImportedPose`. Juntas travadas também são respeitadas.

**Uma armadilha que virou regra:** `sanitizeFigure` nunca falha — preenche tudo com padrões. Um `{}` passaria como pose vazia e **apagaria a pose de destino sem avisar**. Exigir ao menos uma junta conhecida é o que distingue "pose lida" de "arquivo que por acaso é um objeto", e é o que faz o painel dizer "não tem pose aproveitável" em vez de zerar o boneco em silêncio.

A ação de store é nova (`applyImportedFigurePose`) em vez de estender `applyImportedPose`: aquela é do fluxo do `.glb` e não deve passar a mexer em colocação e rotação por tabela.

### Onde os botões moram (corrigido no mesmo dia)

Nasceram no painel de **Bonecos**, ao lado da área de transferência de poses, pela semelhança de propósito: as duas seções movem a pose do boneco selecionado para outro lugar, mudando só o alcance (memória da sessão × arquivo). O usuário pediu para movê-los ao painel de **Propriedades**, e o argumento que sustenta a mudança é mais forte que a semelhança original:

- Propriedades é o painel **do boneco selecionado**, e todas as demais operações sobre a pose do boneco INTEIRO já vivem lá — aplicar preset, misturar, salvar na biblioteca, copiar para outro boneco, simetria. A pose em arquivo é a mesma família de operação e estava sozinha do outro lado.
- A área de transferência tinha um motivo **próprio** para ficar em Bonecos, que não se aplicava aqui: a lista dela é da SESSÃO, não da seleção, e em Propriedades sumiria a cada troca de boneco — que é exatamente o gesto feito entre copiar e colar.

Consequência: a seção passou a aparecer só na **visão da raiz**, como as outras operações de boneco inteiro, e o estado "nenhum boneco selecionado" deixou de existir (o painel inteiro já não é renderizado sem seleção). Some com isso a chave `poseFileNoSelection` e a necessidade dos botões desabilitados; as chaves saíram de `panels.figures` para `panels.properties` e os rótulos perderam o "do selecionado", que virou redundante ao lado do nome do boneco exibido no topo do painel.

### Verificação

**50 testes novos**: `skeletonStick.test.ts` 18 (cobertura das duas tabelas, medidas explícitas, piso de alvo de toque, ossos mais finos que as juntas, o invariante de vizinhança, cabeça fechando 1,70 m e encostando na junta, marcador de direção, simetria L/R, e a trava de que o default continua sendo o manequim); `figurePoseFile.test.ts` 19; `PropertiesPanel.test.tsx` 6 (incluindo as duas travas de onde a seção aparece: nunca sem boneco, e só na visão da raiz); `uiStore.test.ts` 3; `figuresStore.test.ts` 2; `uiPreferences.test.ts` 2. Suíte em **2.218 testes**, toda verde; `tsc -b` e `eslint .` limpos.

**Conferido no navegador** (Playwright headless), diferente das entregas anteriores que ficaram dependendo de conferência manual:

- o palito renderiza com a mesma altura e proporções do manequim, juntas destacadas dos ossos, marcador de direção visível, e **nenhum erro de página**; a troca ida e volta pela Toolbar funciona e a preferência é gravada;
- o círculo completo do JSON foi exercitado pela UI real: exportar com o boneco em (3, 0.5, -2) gravou `position: [0, 0.5, 0]`; depois de mover o boneco para (-4, 0, 7), trocar a pose e a altura, carregar o arquivo devolveu `[-4, 0.5, 7]`, altura 1,55, nome e cor preservados — e a pose **reexportada saiu idêntica** à original nas 37 juntas.

## 82. Enxertar uma animação importada, carimbar a câmera atual e a confirmação de regravar em `<dialog>`

Pedido do usuário em 2026-07-31, em três partes: na importação de JSON, poder **substituir poses e câmeras a partir de um keyframe**, escolhendo os bonecos de origem e os de destino; um botão para **aplicar a câmera atual a todas as keyframes**; e tirar a confirmação de "Regravar" de dentro do card, levando-a para um `<dialog>`. Quatro decisões de desenho foram levadas ao usuário antes de escrever código, e ele respondeu as quatro (anexar o excedente; caixa para desligar a troca das câmeras; colocação absoluta; e — ampliando o pedido — faixa escolhível no carimbo da câmera, com confirmação em diálogo).

### Enxertar é um terceiro modo, não uma variação dos outros dois

`replace` e `append` **escrevem** uma linha do tempo; `substitute` **reescreve parte** de uma que já existe. A diferença não é de grau: no enxerto, tudo o que não foi escolhido tem de sobreviver — os keyframes anteriores ao ponto de entrada, os bonecos sem papel em cada keyframe atingido, as durações de cada trecho, os rótulos de grupo, o nome e a velocidade da bancada. É o que permite trocar a coreografia de um figurante no meio de uma cena montada sem remontar o resto dela.

Por isso o modo sai **antes** dos outros dois em `importAnimation` e não passa por `renumberKeyframes` nem reescreve nome/velocidade. Os ids dos keyframes atingidos são preservados de propósito: são os mesmos keyframes, editados.

**Os papéis já respondiam "de quem para quem".** O diálogo de importação (#79) já mapeia papel gravado → boneco da cena, com "— ninguém —" para deixar um de fora. Um papel em branco é um boneco de ORIGEM que não entra; o combo escolhe o boneco de DESTINO. Não foi preciso mecanismo novo — só dizer isso por escrito no diálogo, que antes não precisava dizer.

**Por isso "recriar os gravados" não enxerta.** Sem `assignment` não há mapa, e trazer o elenco do arquivo para o meio de uma linha do tempo montada não é enxerto: é outra animação. O botão fica desabilitado com o motivo à vista.

**Colocação absoluta** (decisão do usuário): o boneco de destino assume a posição e o giro gravados, como no modo "Substituir". Transportar para onde ele está no keyframe inicial é o contrato do "Anexar", que existe para emendar.

**O que sobra vai para o fim** (decisão do usuário): arquivo mais comprido do que o que resta da bancada estende a linha do tempo, com as durações e os rótulos gravados — estes desconflitados por `withFreeGroupLabels`, e **só eles**, porque os keyframes enxertados mantêm o rótulo do grupo onde já estavam. Nos keyframes novos, os bonecos sem papel congelam no estado do ÚLTIMO keyframe da bancada: é onde eles pararam.

**Boneco de destino ausente do retrato entra nele.** Um keyframe anterior à entrada do boneco em cena não o tem na lista de `figures`; sem acrescentá-lo, a substituição não teria efeito nenhum ali — justamente no boneco que se pediu para trocar.

**A caixa "substituir também as câmeras"** (decisão do usuário, marcada por padrão) existe porque as duas coisas se separam na prática: trocar a coreografia de um boneco raramente quer dizer jogar fora o enquadramento montado keyframe a keyframe. Desmarcada, só as poses entram.

O miolo do remapeamento (#79) foi **extraído**, não duplicado: `remapPosedKeyframes` devolve, por keyframe do arquivo, o mapa `boneco da cena → estado` e a câmera já transportada. `remapImportedKeyframes` monta o retrato a partir da CENA (não há linha do tempo anterior de onde tirá-lo); `substituteImportedKeyframes` monta a partir do keyframe da BANCADA. É exatamente aí que os dois modos divergem, e agora é a única coisa que os separa.

### Carimbar a câmera: faixa, não só "todas"

O gesto que faltava era achar um enquadramento e querer ele na animação inteira. Sem isso, a única saída era regravar keyframe a keyframe — e **regravar troca a pose junto**, o que obriga a passar por "Ir para" antes de cada um só para não perder o retrato. `applySceneCameraToKeyframes` mexe **só** na câmera, como o `copyAnimationKeyframeCamera` (#52); a diferença é a fonte (a câmera de cena viva, não o keyframe vizinho) e o alcance (uma faixa).

O usuário pediu a faixa escolhível, com 1..n preenchido por padrão: o gesto de um clique continua sendo "a animação toda", e quem quer segurar o enquadramento só num trecho aperta os dois combos. A faixa é normalizada (do 5 ao 2 é a faixa 2–5) e grampeada à lista.

**Fica no store, não no `AnimationPlayer`.** A câmera dos keyframes é a **câmera de cena** (`figuresStore.sceneCamera`), que o gizmo, o painel de câmera e o "Ir para" já mantêm em dia — é a mesma que o `readCameraView()` do player lê. Então não há nada a ler de dentro do `<Canvas>`, e a ação é uma edição de store comum: testável sem GPU e num passo de undo só.

**Desabilitado tocando.** Durante a reprodução quem anda é o objeto vivo da câmera; o store só é sincronizado ao parar (#52). Carimbar ali gravaria o enquadramento de antes do play, calado. O botão desabilita com o motivo à vista, em vez de tentar sincronizar sozinho — pausar por conta própria criaria uma corrida com o `setSceneCamera(lastView)` que o player faz ao parar.

### A confirmação de regravar saiu do card

A confirmação em linha (#69) ocupava a primeira fila de botões do keyframe: o aviso vermelho aparecia no meio de uma lista de cards iguais, colado nos botões dos keyframes **vizinhos**, que continuavam clicáveis — que é o clique indevido de que a confirmação deveria proteger. Num modal, o aviso é a única coisa na tela e o clique seguinte só pode ser "Confirmar" ou "Cancelar".

Como o card que originou o clique sai de vista, o diálogo repete **número e instante** do keyframe. O estado continua sendo um id só (`confirmingUpdateId`): abrir a confirmação de outro card fecha a anterior sozinho, e um keyframe removido enquanto o diálogo esperava faz a caixa desaparecer sem estado a limpar — o casamento é por id, não por posição.

**`ModalDialog.tsx`** nasceu aqui: eram três caixas com a mesma dança de `showModal`/`close`/Escape/`uiStore.modalOpen`. A ressalva do jsdom continua valendo palavra por palavra (#79): `<dialog open>` controlado pelo React, `showModal()` só quando a função existe. O CSS acompanhou — `.modal-dialog` leva a caixa e o `::backdrop`, e cada diálogo acrescenta só o que é dele.

### Verificação

**+25 testes**: `animationRemap.test.ts` (7) — o que muda e o que não muda no enxerto, a caixa da câmera, o excedente no fim, o boneco ausente do retrato, recusas e grampeamento do índice; `animationImport.test.ts` (5) — enxerto pelo store com bancada montada por captura, câmeras, rótulo desconflitado, um passo de undo e as recusas; `animationsStore.test.ts` (4) — carimbo da faixa, faixa invertida/fora da lista, recusas e undo; `AnimationPanel.test.tsx` (9) — seção de enxerto ausente na bancada vazia, enxerto pela UI real, "recriar" desabilitando o botão, faixa padrão 1..n e carimbo, faixa escolhida e cancelar, botão indisponível sem keyframes e tocando, o diálogo de regravar com o keyframe identificado, e a caixa que some com o keyframe removido. Suíte de 2.218 para **2.243**, toda verde; `tsc -b`, `eslint .` e `npm run build` limpos. **Falta a conferência visual do usuário no navegador** — as três caixas modais e o botão novo.

## 83. Reorganização do painel de Animação: teto na lista, seções recolhíveis e as ações da linha do tempo juntas

Pedido do usuário em 2026-07-31, logo depois do item anterior: revisar a ordem dos controles, aproximar o que é do mesmo assunto, e achar redundâncias e coisa sem uso. A revisão apontou um problema estrutural que a ordem sozinha não resolvia, e ele virou a primeira decisão.

### A lista de keyframes não tinha teto — e por isso a ordem não era real

`.animation-panel__keyframes` crescia sem limite: com quinze keyframes ela sozinha passava de 3.000 px, e **tudo o que vinha depois deixava de existir na prática** — a velocidade, "Fechar o ciclo", "Gerar miniaturas", a configuração de vídeo, o `Exportar MP4` e a biblioteca inteira. Era o mesmo efeito que obrigou a fixar o `Capturar` no topo (#69), só que nunca tratado para o resto do painel: dos doze blocos, apenas os quatro primeiros tinham ordem observável.

A lista passou a rolar DENTRO de si (`max-height: 45vh`). É o que devolve sentido a qualquer ordenação — sem isso, mover um botão para depois da lista é escondê-lo.

### Três seções recolhíveis, e por que não `<details>`

Trechos prontos (um combo de 21 opções que se escolhe uma vez por sessão), configuração de vídeo e biblioteca somam ~25 linhas de coisa ocasional. Recolhidas, somam três. Elas nascem **fechadas** e o estado persiste junto das preferências de painel: abrir "Trechos prontos" a cada sessão seria pior do que o problema que a seção resolve.

`CollapsibleSection` é um componente próprio, e **não** `<details>`/`<summary>`: o jsdom não aplica a regra de folha de estilo que esconde o conteúdo de um `<details>` fechado, então os testes veriam botões que o usuário não vê — o oposto do que um teste de painel deve garantir. Com renderização condicional (o mesmo padrão dos grupos de keyframe), o que não está na tela não está no DOM. O triângulo fica `aria-hidden`: sem isso o nome acessível do botão seria "▸ Trechos prontos", um rótulo que muda de texto ao ser clicado.

Também **não** é o `CollapsiblePanel`: aquele é o envelope da COLUNA (encolhe o painel e devolve espaço ao viewport). Este é um bloco interno. Por isso as chaves novas ficaram em `ANIMATION_SECTION_KEYS`, e não em `PANEL_KEYS` — que é, por definição, a lista de painéis do `AppShell`.

### "Ações da linha do tempo": um fieldset para o que age sobre a lista inteira

`Fechar o ciclo`, `Aplicar a câmera atual`, `Gerar miniaturas` e `Salvar faixa como trecho` fazem todas a mesma coisa — agem sobre a lista, não sobre um keyframe —, e estavam em três pontos diferentes do painel; duas delas depois do bloco de vídeo. Agora são um bloco só, logo abaixo da lista de que falam, fechado pela `Velocidade`, que é a outra propriedade da linha do tempo como um todo.

O "salvar faixa como trecho" saiu de dentro de "Trechos prontos" (onde estava desde o item 39) porque ele **lê a lista**: os dois combos são de keyframes da bancada. Dentro do catálogo, era saída disfarçada de entrada.

### Ordem final

Capturar (fixo) → papel-cebola + lista (rolando) → ações da linha do tempo → ▸ trechos prontos → ▸ vídeo → ▸ biblioteca e arquivos. As decisões já fechadas com o usuário ficaram de pé: capturar no topo e o nome da animação junto da biblioteca (#69), régua/transporte/⏮⏭ na barra do rodapé (item 29), quatro linhas fixas de botões por card.

### Redundâncias resolvidas

- **Leitura de tempo duplicada.** O painel mostrava `0,0s de 3,0s` e a barra do rodapé mostra exatamente o mesmo (`timeline.position`). A do painel era um cartaz apontando para outro lugar; saiu, com a chave `timelineMoved`. O que responde "e se eu puser 0,5?" continua no `speedHint`.
- **Dois seletores de faixa com rótulos quase iguais.** `até o keyframe` aparecia no salvar-trecho e no aplicar-câmera. Viraram "Salvar até o keyframe" e "Aplicar de/até o keyframe" — a ambiguidade tinha aparecido primeiro nos testes (`getByLabelText` achava dois), que é onde ela costuma dar sinal antes de dar no usuário.
- **"Regravar" com dois sentidos.** `Regravar` (um keyframe) e `Regravar a salva` (uma animação da biblioteca) são operações sem nada em comum. A segunda virou **"Atualizar a salva"**.
- **Proteção invertida.** `Regravar` (1 keyframe) confirmava em diálogo; `Limpar`, que apaga a linha do tempo inteira, não pedia nada — e ficava colado em "Salvar na biblioteca". Agora confirma pelo mesmo caminho, dizendo o nome da animação e quantos keyframes serão perdidos.
- **Dois sistemas de guarda no mesmo bloco.** Biblioteca interna e arquivo JSON estavam intercalados. O JSON virou um fieldset próprio ("Arquivo JSON avulso"), no fim da seção, levando junto a mensagem de erro de leitura/gravação — que é dele.
- **`KeyframeUpdateDialog` virou `ConfirmDialog`.** Com o "Limpar" confirmando também, o diálogo específico deu lugar a um genérico (título, linha de identificação do alvo, aviso, rótulo do botão).
- **Classe que mentia.** `animation-panel__insert` vestia três botões que não inserem nada — mesmo problema do `__row` que renderizava coluna. Virou `animation-panel__wide`.

### Sem uso: o que saiu e o que ficou, com a razão

Saiu a chave **`repeatHint`** (traduzida em pt-BR e en, nunca renderizada: a caixa "Repetir" da barra do rodapé não a mostra).

**Ficaram, documentados, `createAnimation`, `loadAnimationLibrary` e `loadClipLibrary`** — sem chamador de produção, só testes. Apagá-los custaria reescrever ~35 pontos de `animationsStore.test.ts` para montar animações por outro caminho, o que mudaria o que aqueles testes exercitam; e `loadWorkspaceCatalog` (o caminho real) é a versão grossa do mesmo carregamento, não um substituto exato. O risco real do código morto — alguém religar `createAnimation` a um botão e ressuscitar o "criar antes de capturar" que o item 36 matou — foi tratado onde ele acontece: no comentário da própria ação.

**`Câm ↑`/`Câm ↓` não foram removidos.** Depois de "Aplicar a câmera atual" numa faixa, eles perderam o caso comum (segurar o enquadramento ao longo de um trecho era N cliques, agora é um diálogo), mas continuam sendo a única forma de copiar a câmera de UM vizinho. Perder função não é o mesmo que não ter nenhuma.

### Verificação

**+4 testes** (as duas seções em `AnimationPanel.test.tsx`: o painel abre com capturar, lista e ações à vista e os três blocos fechados; abrir um mostra o conteúdo e grava a escolha. E duas em `uiPreferences.test.ts`: padrão recolhido com round-trip do `false`, e arquivo antigo sem o campo). **~45 pontos de teste ajustados** aos rótulos novos e ao estado inicial das seções, via um helper `abrirPainel()` — o mesmo gesto que os testes já faziam para o painel. Suíte de 2.243 para **2.247**, toda verde; `tsc -b`, `eslint .` e `npm run build` limpos. **Falta a conferência visual do usuário no navegador** — a rolagem da lista, as três seções e a moldura dos dois fieldsets novos.

## 84. Reorganização dos painéis de Propriedades e Câmera

Pedido do usuário em 2026-07-31, na sequência do item anterior: avaliar os dois painéis e reorganizá-los. O mecanismo de seções recolhíveis criado para o animador (#83) foi generalizado aqui — `ANIMATION_SECTION_KEYS` virou `SECTION_KEYS`, com prefixo por painel, porque um tipo chamado "seção de animação" descrevendo a simetria do boneco seria mentira de nome.

**Diferença de diagnóstico em relação ao animador.** Lá o problema era estrutural: a lista de keyframes crescia sem teto e escondia metade do painel. Aqui não há lista sem limite (as poses moram num combo) — **exceto a de bookmarks**, que ganhou o mesmo `max-height`. O problema destes dois painéis é de agrupamento e ordem, e por isso a reorganização é mais de mover do que de esconder.

### Propriedades: a colocação estava atrás de cinco blocos de pose

Posição e Rotação da raiz eram os últimos blocos do painel, e o **gizmo W/E — que é a versão arrastável desses mesmos números** — ficava separado deles por três fieldsets. Montar a cena é o que se faz antes de posar, e é para cá que a lista de bonecos manda. Os três subiram, juntos, para logo abaixo do combo de junta.

**Um fieldset com cinco assuntos.** "Poses predefinidas" tinha 193 linhas e abrigava aplicar, sortear, misturar, salvar na biblioteca, remover e **copiar a pose para outro boneco** — que não é uma pose predefinida em sentido nenhum. Virou duas seções: `poses` (escolher e aplicar; nasce ABERTA, é o motivo de o painel existir) e `poseTransfer` ("Guardar e copiar": salvar, copiar para outro boneco e o arquivo `.json` — tudo o que tira a pose daqui e a leva para outro lugar).

**Renomear e remover ficaram com o combo, e não na seção de guardar** — ajuste em relação ao que foi proposto ao usuário. As duas ações agem sobre a pose ESCOLHIDA no combo; na outra seção elas mirariam algo que pode estar recolhido e fora de vista.

**A dupla invertida.** Simetria e "Zerar por grupo" apareciam em ordem trocada entre a vista da raiz e a da junta: trocar a junta selecionada reordenava o painel sem que nada tivesse mudado de assunto. As duas vistas agora terminam igual — simetria (recolhível) e depois zerar por grupo —, e na vista de junta a **rotação subiu**: ela é O controle da junta, e presets de mão e gizmo são ajustes de contexto.

**`renameSavedPose` ganhou o botão que nunca teve.** A ação existia no store, testada, desde a biblioteca de poses (#42): dava para salvar e apagar uma pose, mas não para corrigir o nome dela — enquanto animações, trechos e cenas renomeiam. Não era código morto; era funcionalidade pronta sem porta. O formulário de nome virou um componente só (`PoseNameForm`) com um `namingMode: 'save' | 'rename' | null`, porque é o mesmo gesto e os dois nunca aparecem ao mesmo tempo.

### Câmera: três modelos de interação no mesmo bloco

"Planos e ângulos" tinha (a) quatro combos que só agem no `Aplicar enquadramento`, (b) um combo de vistas com um SEGUNDO `Aplicar` no mesmo fieldset, e (c) o slider de inclinação holandesa, que aplica **ao vivo**. Três contratos diferentes sob uma legenda só.

- A **inclinação subiu para o bloco da lente**, que passou a se chamar "Lente e inclinação": são as duas propriedades contínuas da câmera, e agora os controles ao vivo estão juntos. A dica do roll foi junto; o que sobrou no enquadramento é só a dica de enquadramento, sem o encadeamento de três condições que existia para servir aos dois.
- **Vistas prontas** viraram seção própria, com o seu `Aplicar` — um por bloco.
- **"Bancada: vistas ortográficas"**: o comentário do topo do arquivo avisava que aquele bloco era a exceção do painel (comanda a câmera de TRABALHO, não a de cena). Um bloco que precisa de aviso para não ser confundido está com o nome errado; o aviso virou o título.

### Redundâncias e sem uso

- **`setViewMode` removida** do `cameraStore`: só `toggleViewMode` era usada em produção, e os quatro pontos de teste que a chamavam passaram a alternar pelo mesmo caminho do usuário.
- **Rótulos do gizmo num namespace comum.** O painel de Câmera chamava `t('panels.properties.gizmoTranslate')`: mudar o rótulo num painel mudava no outro sem querer. Viraram `common.gizmoTranslate`/`common.gizmoRotate`.
- **`loadPoseLibrary` e `renameSceneSnapshot` documentadas**, não removidas — mesmo raciocínio de #83. A segunda é o `renameSavedPose` de ontem: ação pronta esperando um botão no painel de Cenas.
- **Recuos tortos** deixados por edições antigas em duas linhas do `PropertiesPanel` (o nome do boneco e o estado vazio) — cosmético, mas era ruído em toda leitura do arquivo.
- **`Câm ↑`/`Câm ↓` do animador continuam de pé** (#83), e aqui a decisão simétrica: nada foi removido dos dois painéis por "ter perdido importância".

**Duas chaves nasceram órfãs e foram apagadas antes de fechar** (`properties.placement` e `properties.restore`): elas seriam legendas de caixas novas, e a reorganização acabou sendo por ADJACÊNCIA — agrupar sem desenhar mais uma moldura em volta de blocos que já têm a sua. Deixá-las seria repetir exatamente o defeito que este trabalho foi caçar.

### Ajuste no mesmo dia, depois de ver o painel

Três correções de ordem pedidas pelo usuário ao usar o resultado:

- **"Guardar e copiar" foi para o RODAPÉ do painel da raiz**, depois de simetria e do zerar por grupo. Salvar na biblioteca, copiar para outro boneco e exportar o `.json` são o fim de uma sessão de trabalho, não o meio dela — no meio, empurravam para baixo blocos que se usam enquanto se posa.
- **"Aleatória" desceu para depois da mistura.** A fila de cima é a da pose ESCOLHIDA no combo (aplicar, renomear, remover); o sorteio não olha para o combo — cada clique dá uma pose diferente —, e estar ali sugeria que ele sorteava dentro da seleção.
- **Na junta, o gizmo Mover/Girar subiu para antes da rotação**, como já estava na raiz. Escolher a ferramenta é o que se faz ANTES de mexer nos números, e ter a mesma ordem nas duas vistas é o que faz trocar de junta não reordenar o painel (a mesma razão da dupla simetria/zerar).

### Verificação

**+12 testes**: renomear pose (aplicado e cancelado, e ausente nas poses de fábrica); ordem dos blocos na raiz, seções recolhidas por padrão, as duas vistas terminando igual e a rotação antes do gizmo na junta; a inclinação dentro do bloco da lente, um `Aplicar` por bloco e as quatro seções recolhidas do painel de Câmera; e o novo padrão de recolhimento em `uiPreferences`. **~13 pontos de teste ajustados** ao estado inicial das seções, via um helper `abrirSecoes()` em cada arquivo — o mesmo gesto do `abrirPainel()` do animador. Suíte de 2.247 para **2.259**, toda verde; `tsc -b`, `eslint .` e `npm run build` limpos. **Falta a conferência visual do usuário no navegador** — as sete seções novas, a lista de bookmarks rolando e a ordem dos blocos nas duas vistas do painel de Propriedades.

## 85. Remoção do glTF: a cena passa a ser um `.json`

Pedido do usuário em 2026-07-31: "avaliar uma limpeza no código para remover todas as funcionalidades relacionadas a exportação/importação de arquivos glb". O levantamento mostrou que o `.glb` não era uma funcionalidade acessória — **era o formato de arquivo das cenas do workspace** (#11). Removê-lo é migrar a persistência em disco, não apagar código.

### O número que decidiu

O `.glb` carregava duas coisas: o bloco `extras["virtual-mockup"]` (o JSON com o estado inteiro) e uma geometria glTF — esfera por junta, cilindro por osso, malha real dos objetos, uma câmera por bookmark. **A importação nunca leu a geometria de volta**: `importSceneFromGlb` chamava só `readGlbExtras` → `sceneFromExtras`. A malha existia exclusivamente para abrir no Blender.

Medido antes de decidir (teste temporário, `exportSceneToGlb` contra `JSON.stringify(sceneToExtras(...))`):

| Cena | `.glb` | JSON | Razão |
|---|---|---|---|
| 1 boneco | 245 KB | 1,2 KB | 207x |
| 3 bonecos + 2 objetos | 723 KB | 3,3 KB | 222x |
| 6 bonecos + 5 objetos | 1,45 MB | 6,4 KB | 226x |

**~99,5% de cada arquivo de cena era geometria que só o Blender lia.**

### O que tornou a troca barata

`sceneSerialization.ts` **não mudou uma linha**. Ele já era JSON puro e já era o formato do autosave em `localStorage` — o mesmo `sceneToExtras` de que a cena volta a cada recarga da página. O caminho JSON já estava em produção; faltava só escrevê-lo em disco. Trocou-se o envelope, não o conteúdo: `SCENE_EXTRAS_VERSION` continua 1, e um `scene.json` tem exatamente os campos que o bloco de `extras` tinha.

### O que saiu, e por que nada disso serviria ao módulo de rigging

Apagados: `gltfIO.ts`, `figureObject3D.ts`, `propObject3D.ts` e dois arquivos de teste (~320 linhas de código, ~380 de teste). `sceneFile.ts` foi reescrito como I/O de JSON.

A pergunta do usuário ao fechar o escopo foi o custo de remover agora e depois fazer um módulo de integração com o Blender **com rigging de verdade** (juntas convertidas para armature, para keyframing avançado). A resposta é que o custo é próximo de zero, porque um exportador rigado não reaproveita nada disso: esfera + cilindro não vira armature, e um rig precisa de `THREE.Bone`, `SkinnedMesh` com `skinIndex`/`skinWeight`, `boneInverses` e `AnimationClip`. O único reaproveitamento seria o wrapper de ~30 linhas do `GLTFExporter` — que precisaria mudar de qualquer forma, já que não passava `animations` ao `.parse()`.

**Não se perde nada do que um rig realmente precisa**: `skeleton.ts` (hierarquia, posições, escala por altura), `jointFrames.ts` (grafo de transformos, que fica de qualquer jeito — o `dragSolver` usa), `sceneSerialization.ts`, `animation.ts` e `Figure.tsx`. E o `Figure.tsx` já é um manequim de **segmentos rígidos** (`SegmentPart` no espaço local de cada junta): isso mapeia 1:1 para armature com peso 1,0 por osso, ou seja, o exportador futuro não precisará de weight painting. Ver PLANO.md > "Integração com o Blender (rigging)".

### Achados de glTF preservados aqui, porque o código que os continha foi apagado

Descobertos lendo o fonte do `three-stdlib`, não a documentação. Quem escrever o módulo de rigging vai precisar deles:

- `extras` só é escrito em `scenes[0].extras` quando o objeto passado a `.parse()` é uma instância real de `THREE.Scene`. Um `Group` é envolvido numa cena sintética sem `userData`, e o bloco se perde.
- `binary: true` faz `onDone` receber um `ArrayBuffer` pronto (`.glb`), em vez do objeto JSON do `.gltf`.
- Ao reabrir, o bloco volta em `gltf.scene.userData` (um `THREE.Group` — o loader não recria o tipo `Scene`), **não** em `gltf.userData`, que só reflete `extras` no nível do documento e nunca é escrito pelo exportador.
- `PropertyBinding.sanitizeNodeName` **remove** (não substitui) `.` `:` `/` `[` `]` dos nomes de nó. Um nó `figure-1.shoulder.L` volta como `figure-1shoulderL`, quebrando qualquer busca por nome depois do round-trip — por isso os nomes usavam `_` como separador.

### Consequências aceitas

1. **Workspaces `.glb` já salvos em disco não abrem mais.** Decisão explícita do usuário: remoção total imediata, sem caminho de leitura legada nem conversor. O autosave do navegador não é afetado — ele nunca foi `.glb`.
2. **Não há mais ponte com o Blender** até o módulo de rigging existir. Aceito porque a ponte antiga só devolvia o JSON de `extras`: edição de malha ou de armature feita no Blender já era ignorada na importação, e o `.glb` nunca teve canal de animação (#52). O módulo novo SUBSTITUI essa ponte, não a estende.
3. **Nome de cena reservado.** Enquanto as cenas eram `.glb`, a extensão sozinha as separava dos arquivos fixos da pasta. Agora tudo é `.json`, e uma cena chamada "Poses" geraria `poses.json`, **apagando a biblioteca de poses do usuário**. `buildWorkspaceManifest` passou a reservar `workspace.json`, `joint-limits.json`, `poses.json`, `animations.json` e `clips.json` — a cena vira `poses-2.json`. Comparação em minúsculas, porque o sistema de arquivos do Windows não distingue caixa.

### O que ficou de fora de propósito

**Há duas codificações JSON do mesmo boneco** no projeto: `FigureExtras` usa `joints: { junta: [x,y,z] }` e o `Figure` do keyframe usa `pose: { junta: {x,y,z} }` — mesmo conteúdo, duas rotinas de sanitização (`figureFromExtras` e `sanitizeFigure`). O `figurePoseFile.ts` (#81) escolheu a do keyframe. Unificar era a hora certa, mas o usuário decidiu deixar para tarefa separada: mexer no formato do boneco quebraria a leitura do autosave existente e exigiria um caminho de migração, misturando dois riscos numa mudança só.

### Verificação

Suíte em **2.251**, toda verde — saíram os testes de `gltfIO` e `figureObject3D` e os de malha do `propObject3D`, entraram os do arquivo JSON (ordem das chaves, `scene.json` como fonte de boneco e de bookmarks, as duas falhas de leitura) e o do nome de cena reservado; `tsc -b` e `eslint .` limpos. As mensagens de erro de importação foram reescritas nos dois idiomas: `unreadable` agora é "não é um JSON válido" e `missingAppData` é "falta o campo version", em vez das explicações sobre custom properties do Blender.

## 86. Uma codificação só para o boneco, e um leitor só

Pedido do usuário em 2026-07-31, logo após a remoção do glTF (#85), que tinha deixado esta dívida registrada de propósito: havia **duas codificações JSON do mesmo boneco** — `joints:{junta:[x,y,z]}` na cena e `pose:{junta:{x,y,z}}` no keyframe —, com duas rotinas de sanitização a manter em dia.

### O levantamento achou quatro, não dois

| Leitor | Lia de | Junta | Rotação do boneco |
|---|---|---|---|
| `sceneSerialization.figureFromExtras` | cena, autosave | `joints:[x,y,z]` | tupla |
| `animation.sanitizeFigure` | `animations.json`, pose avulsa | `pose:{x,y,z}` | objeto |
| `clipLibrary` (bloco próprio) | `clips.json` | `pose:{x,y,z}` | objeto |
| `poseLibrary.sanitizeSavedPoses` | `poses.json` | `pose:[x,y,z]` | **as duas** |

Mais **três cópias privadas** de `asRecord`, `sanitizeRotation` e `sanitizeVec3`, com divergências silenciosas entre si: `sanitizeVec3` recusava `NaN` e o `tupleToVec3` da cena não — uma colocação `[NaN,0,0]` entrava na cena e só aparecia como boneco sumido na tela.

### O precedente já estava no código

`poseLibrary.toRotation` **já aceitava as duas codificações**, com o comentário "a mesma pose pode chegar do JSON da pasta ou do autosave". A solução já tinha sido escrita uma vez, para o mesmo problema, num canto só. O trabalho foi generalizá-la — como o `withLegacyIndexFinger` (#45) e o `keyframeCounter`→`snapshotCounter` (#52) já faziam para outros campos.

### O que foi feito

**`src/figure/figureFormat.ts`** passa a ser o leitor único: `asRecord`, `toRotation`, `readRotation`, `toVec3`, `clampHeight`, `sanitizePose` e `sanitizeFigure`.

**Mora em `figure/`, e não em `persistence/` nem em `animation/`**, porque o formato do boneco é do MODELO — ao lado do `skeleton.ts`, que define as juntas, e do `poseCompat.ts`, que migra as antigas. Antes disto, `persistence/figurePoseFile.ts` importava a leitura de `animation/animation.ts`: persistência perguntando ao animador qual é o formato do boneco, que é a camada errada. `sceneSerialization.ts` também deixou de ter leitura de boneco; o que sobrou nele é o que é da CENA (ambiente, câmera, bookmarks, objetos, contadores).

**Tudo grava `{x,y,z}` agora** — cena, animação, trechos, pose avulsa e `poses.json`, que era o último a gravar tuplas. `FigureExtras` deixou de ser um tipo próprio e virou um alias de `Figure`: **o arquivo de cena guarda o objeto do store verbatim**, que é o que permite colar um boneco de um `scene.json` dentro de um keyframe de `animations.json` sem conversão nenhuma.

### Duas políticas de rotação, de propósito

`toRotation` é ESTRITA (devolve `null` no ilegível) e `readRotation` nunca falha (completa com zero). Não é acidente nem sobra: uma junta ilegível numa POSE salva deve sumir — é o que permite reconhecer "isto não é uma pose" quando não sobra junta nenhuma —, enquanto num BONECO ela vira zero, que é exatamente o que a junta ausente já produz ao desenhar (`jointFrames` cai em `ZERO_ROTATION`).

Pelo mesmo motivo o `poseLibrary` **manteve o laço próprio** em vez de usar o `sanitizePose` compartilhado: além do descarte, ele exclui a `root` (a inclinação do boneco mora no campo `rotation` da pose). O que ele compartilha é o `toRotation`. Duas políticas documentadas não são duplicação; duas cópias da mesma política eram.

### Compatibilidade: leitura tolerante permanente, sem subir a versão

Decisão do usuário. `sanitizeFigure` lê `joints` como sinônimo de `pose`, e `toRotation` aceita tupla e objeto — para sempre, sem `SCENE_EXTRAS_VERSION` 2 e sem conversor. Um `scene.json`, um `poses.json` e, principalmente, **o autosave que todo usuário tem no `localStorage`** continuam abrindo. Sem isso, a primeira abertura do app depois desta mudança traria a cena de trabalho em T-pose e a biblioteca de poses vazia — e é justamente esse payload que o teste novo de autosave reproduz.

Quando o arquivo traz os dois campos, **`pose` manda**: é o que se grava hoje.

### Custo em tamanho, medido

O bloco de pose cresce ~50% (`"shoulder.L":[5,-3,2]` = 21 caracteres contra `"shoulder.L":{"x":5,"y":-3,"z":2}` = 32). Uma cena de 6 bonecos com todas as 38 juntas declaradas dá **9,9 KB** de arquivo, e um `poses.json` de 20 poses dá 27 KB. Irrelevante em disco e em `localStorage` — e para dimensionar: a mesma cena de 6 bonecos pesava **1,45 MB** como `.glb` até ontem (#85).

### Mudança de comportamento aceita

A colocação do boneco na cena passou a recusar `NaN` (antes só a leitura da animação recusava). Um arquivo editado à mão com `position:[NaN,0,0]` agora cai em `[0,0,0]` em vez de gerar um boneco em lugar nenhum. É correção, não regressão — e é o tipo de divergência que existir uma cópia por módulo produz.

### O que NÃO mudou

Objetos de cena (`PropExtras`) continuam gravando `rotation` e `size` em tupla: não são boneco, e o escopo aqui era o boneco. Passaram a usar o `toVec3`/`readRotation` compartilhados na leitura, o que os torna tolerantes de graça, sem mudar o que gravam.

### Verificação

**+17 testes** (`figureFormat.test.ts` novo, mais a leitura legada em `posesFile` e no autosave, e as três garantias de gravação em `sceneSerialization`), suíte de 2.251 para **2.268**, toda verde; `tsc -b`, `eslint .` e `npm run build` limpos. Vale notar que boa parte dos testes de cena já alimentava `joints:[x,y,z]` na entrada — viraram cobertura de leitura legada sem uma linha de mudança, o que é um bom sinal de que o contrato antigo continua honrado.

## 87. Um caminho só para boneco em arquivo

Pedido do usuário em 2026-07-31, depois de uma avaliação comparativa das duas funcionalidades: unificar o JSON da pose para gravar em plural e **remover exportar/importar boneco do painel de Bonecos**.

### O que a avaliação mostrou

Depois da unificação do formato do boneco (#86), os dois arquivos tinham virado quase o mesmo artefato. O que restava de diferença no que era gravado:

1. a chave de embrulho — `figures` (lista) contra `figure` (singular);
2. o X/Z zerado no arquivo de pose.

Duas funções de leitura, dois módulos, dois conjuntos de testes e **cinco chaves de mensagem de erro** (`importUnreadable`, `importMissingAppData`, `importFailed` de um lado; `importUnreadableJson`, `importNoPose` do outro) para produzir dois JSONs que diferiam por um `s`. Duas dessas mensagens eram a mesma frase escrita duas vezes.

### O defeito que a duplicação escondia

`parseFigureFile` exigia só `version: number` e depois procurava `source.figures`. **Todo arquivo do workspace tem `version`** — `poses.json`, `clips.json`, `animations.json`, `joint-limits.json`, `workspace.json` e o próprio arquivo de pose, que usava `figure` singular. Escolhendo qualquer um deles no seletor de "Importar boneco":

1. `readAppJson` passava;
2. `source.figures` não existia, então `figureFromExtras(undefined, 0)` devolvia um boneco PADRÃO com `pose: {}`;
3. `applyImportedPose` chamava `mergeLockedJoints(atual, {}, travadas)`, que devolve o que chega;
4. o boneco selecionado ia para T-pose a 1,70 m, e o painel ainda chamava `setErrorKey(null)` — sucesso declarado.

Ou seja: **exportar uma pose e tentar reimportá-la como boneco apagava a pose do boneco selecionado, em silêncio.** O Ctrl+Z recuperava, mas nada avisava.

O lado da pose tinha acertado isso desde o #81: `parseFigurePoseFile` devolve `null` quando não sobra junta conhecida, com o comentário dizendo exatamente por quê. A regra estava pensada, escrita e testada — num dos dois caminhos. Remover o outro apaga o defeito em vez de corrigi-lo duas vezes.

### As decisões

**Plural, por precedente.** O levantamento dos formatos deu 6 a 1: `scene.json`, boneco avulso, `animations.json`, `clips.json` e o autosave usavam `figures[]`; só o arquivo de pose usava `figure`. E a assimetria já era favorável — `findFigureSource` do arquivo de pose **já lia** `figures`, enquanto `parseFigureFile` não lia `figure`. Passar a gravar `figures: [um]` não custou nada na leitura, e `figure` continua sendo aceito para os arquivos que já existem por aí (inclusive no celular do usuário, que é o ponto do formato).

**As duas ações de store órfãs foram apagadas** (decisão do usuário), e não mantidas documentadas como `renameSceneSnapshot` e `loadPoseLibrary` (#83, #84). O precedente daquelas é outro: elas esperam um botão. Estas perderam o seu de propósito. E `applyImportedPose` era **subconjunto estrito** de `applyImportedFigurePose` — aquela aplicava altura e pose, esta aplica altura, pose, inclinação e Y, pelo mesmo `mergeLockedJoints`. Era a duplicação de código de verdade.

### A capacidade perdida, aceita explicitamente

Não há mais como trazer um boneco de arquivo como boneco **novo**: "Carregar pose" aplica a um boneco já existente e selecionado. Para trazer um de fora agora: acrescentar boneco, selecionar, carregar pose — perdendo nome, cor, visibilidade e o X/Z do arquivo.

O usuário optou por aceitar a perda em vez de compensá-la com um botão novo no painel de Propriedades. Vale registrar que a compensação seria barata se um dia fizer falta: o JSON da pose **já carrega** nome, cor, visibilidade e colocação — apenas não os aplica, por decisão do #81.

### A inversão de rótulos que sobrou resolvida

Antes, o arquivo chamado "pose" aplicava MAIS ao destino (altura, pose, inclinação e Y) do que o arquivo chamado "boneco" no modo com seleção (só altura e pose) — o contrário do que os dois rótulos sugerem. Com um caminho só, a questão deixa de existir.

### Verificação

Saíram `serializeFigureFile`/`parseFigureFile`, as ações `applyImportedPose`/`importFigureAsNew`, quatro chaves i18n (`exportFigure`/`importFigure` nos dois idiomas), duas regras de CSS e sete testes; o mock inteiro de `persistence/sceneFile` e `persistence/fileIO` saiu do `FiguresPanel.test.tsx`, que **não faz mais I/O de arquivo nenhum**. Entraram dois testes de compatibilidade (o `figure` singular lido igual ao `figures` de hoje, e a asserção da lista na gravação).

Suíte de 2.268 para **2.260**, toda verde; `tsc -b`, `eslint .` e `npm run build` limpos.

## 88. Uma convenção de botão para todos os painéis

Pedido do usuário em 2026-07-31, com uma captura de tela mostrando "Espelhar edições ao vivo" quebrado em três linhas ao lado de uma caixa de marcar.

### O diagnóstico: não havia convenção nenhuma

Sete regras diferentes de largura e padding para botão de painel, uma por painel, mais os botões que ninguém tinha lembrado de estilizar — esses ficavam do tamanho do próprio texto, encolhidos no meio de uma coluna de 220–260 px. "Posicionar na vista atual", "Apoiar no chão", "Resetar esta junta" e "Gerar keyframes do movimento" estavam nessa situação.

Pior: `.properties-panel__pose-presets` era uma grade de DUAS COLUNAS usada tanto para conjuntos legítimos (presets de mão, grupos de junta) quanto para envolver **um botão sozinho**. "Travar junta" saía com metade da largura e um buraco ao lado; "Inverter lados", terceiro numa grade de dois, caía sozinho na segunda fileira.

### A regra, e por que ela é semântica

Duas classes em `index.css`, e a escolha entre elas descreve o CONTEÚDO, não a aparência:

- **`.panel-action`** — a ação está sozinha no seu bloco. Largura do painel, que é o alvo de clique máximo disponível.
- **`.panel-actions`** — as ações formam um conjunto entre o qual se escolhe (presets de pose, grupos de junta, presets de mão, vistas de câmera). Grade de duas colunas: empilhar oito presets em largura cheia trocaria rolagem por nada.

Um botão sozinho nunca vai num `.panel-actions`. Escrito assim, o defeito do "Travar junta" deixa de ser possível por descuido — a classe errada fica visivelmente errada na leitura do JSX.

**A margem entre ações consecutivas é escopada a `fieldset > `** de propósito: contêineres próprios (`.scenes-panel__file-actions` e companhia) já espaçam por `gap`, e a regra somaria em cima disso.

### O defeito da captura de tela

Cada painel tem uma regra `__field input { width: 100% }` para os campos de texto, e ela alcançava também as caixas de marcar. Um `<input type="checkbox">` com `width: 100%` num flex vira um item que pede a linha inteira, encolhe até o mínimo e **não devolve o espaço**: o rótulo ao lado ficava com poucos caracteres por linha.

Conserto compartilhado pelos quatro painéis que têm campos (`properties`, `snapshot`, `camera`, `animation`): a caixa passa a ter tamanho próprio e `flex: 0 0 auto`. O mesmo defeito existia calado no painel de Instantâneos.

### Mudanças de layout pedidas

- **Objetos de cena:** o `select` de forma e o botão "Acrescentar" eram um `flex` lado a lado, e o combo ficava com o que sobrava — estreito demais para os nomes de forma. Viraram grade de uma coluna: combo em cima, botão de largura cheia embaixo.
- **Propriedades (raiz):** "Aplicar pose" em largura cheia (decisão do usuário; a alternativa era manter o par com "Aleatória"). "Renomear"/"Remover" continuam em par — são irmãs sobre a pose escolhida no combo. "Aleatória" e "Espelhar o boneco todo" em largura cheia.
- **Propriedades (junta):** "Travar junta", "Resetar esta junta", "Apoiar no chão" e "Inverter lados" em largura cheia. Os dois espelhos (direita→esquerda, esquerda→direita) continuam em par: ali se escolhe a DIREÇÃO da cópia, que é um conjunto.
- **Câmera:** "Posicionar na vista atual" e "Gerar keyframes do movimento" em largura cheia.
- **Animação:** a velocidade passou a ABRIR o bloco "Ações da linha do tempo" em vez de fechá-lo (decisão do usuário) — é a propriedade da linha do tempo como um todo, e não uma das ações. Vale notar que ela já ficava depois da lista de keyframes; o pedido original supunha que não.
- **Cenas:** as ações de arquivo ganharam separador e vão maior acima. Salvar um snapshot mexe no catálogo em memória; exportar grava um `.json` no disco — encostados, os dois pareciam a mesma fila, e é justamente a diferença que mais custa caro confundir.
- **Objetos (medidas):** as quatro ferramentas do gizmo eram `flex-wrap`, e a última sobrava sozinha na segunda linha com largura diferente das outras três. Viraram a grade de duas colunas.

### Verificação

Suíte de **2.260**, toda verde; `tsc -b`, `eslint .` e `npm run build` limpos. Nenhum teste consulta as classes mexidas — os únicos `querySelector` por classe da suíte são de `animation-panel__keyframe` e `timeline-bar__visited`, intocados.

**Falta a conferência visual do usuário**: não há driver de navegador no ambiente, e instalar um (com os binários do Chromium) sairia caro demais para uma revisão de CSS. O servidor de desenvolvimento foi deixado de pé para isso.

## 89. Quatro ajustes de layout, e uma régua que o navegador não desenha

Pedido do usuário em 2026-07-31, na sequência da convenção de botão (#88). Três dos quatro itens são aplicação direta dela; o quarto devolve uma informação que o HTML promete e nenhum navegador entrega.

### Rótulo em cima do controle, no painel de Propriedades

`.properties-panel__field` é o único campo do projeto que fica em LINHA — e existe assim por causa dos rótulos de uma letra dos eixos X/Y/Z. "Selecionar junta" é frase, e ao lado do próprio combo sobrava pouca largura para os nomes de junta.

Novo modificador `.properties-panel__field--stacked`, que devolve o campo ao desenho que `.camera-panel__field`, `.animation-panel__field`, `.snapshot-panel__field` e `.scenes-panel__field` já usam por padrão. A linha continua sendo a exceção, e agora está dito qual é o motivo dela.

A classe `properties-panel__joint-select`, que o campo carregava, saiu junto: nunca teve regra de CSS nenhuma nem foi consultada por teste — era nome sem dono.

### Inclinação: slider e "Endireitar" em linhas separadas

Dividindo a linha com o botão, o slider do dutch angle perdia justamente a largura de que o ajuste fino precisa. "Endireitar" é ação isolada e virou `.panel-action` em largura cheia, pela regra do #88; o slider ficou sozinho no `.camera-panel__slider-row`, que é como o slider do movimento de câmera já estava.

### "Salvar trecho" mudou de bloco

Estava em "Ações da linha do tempo", entre "Fechar o ciclo", "Aplicar a câmera" e "Gerar miniaturas". Das quatro, era a única que não MEXIA na linha do tempo: lê uma faixa dela para produzir um trecho — e trecho é o assunto do bloco "Trechos prontos", que é quem aplica, renomeia e remove.

Um efeito colateral bem-vindo: `clipNameDraft` sempre foi um estado só, usado pelo "Nome do trecho" (salvar) e pelo "Renomear trecho". Nos dois blocos separados isso era invisível e parecia acidente; juntos, o campo aparece uma vez acima dos dois botões que o consomem, e o compartilhamento vira o desenho.

O pedido dizia "bloco de vistas prontas" — nome de uma seção do painel de CÂMERA. Confirmado com o usuário antes de mexer: o destino é "Trechos prontos", no painel de Animação.

### A régua numerada da linha do tempo

O `<datalist id="timeline-keyframe-marks">` da barra já traz `<option value={start} label={index + 1}>`. O `label` é o mecanismo padrão para nomear uma marca de `range` — e **nenhum navegador o desenha**: sai o tique, some o número. Não há CSS que resolva; as marcas de um `datalist` não são estilizáveis nem endereçáveis.

Daí uma faixa própria abaixo do slider, com um `<span>` absoluto por keyframe em `left: (start / total) * 100%`. O navegador continua desenhando os tiques a partir do `datalist`; esta faixa só põe o número embaixo de cada um. **Numeração completa**, e não só do keyframe corrente (escolha do usuário): "estou no 3 de 7" passa a ser coisa que se lê, e não que se conta.

**O alinhamento com o slider precisou de recuo.** O centro do polegar não percorre a largura toda do controle — vai de meio polegar da borda esquerda a meio polegar da direita. Sem recuo, o "1" ficava à esquerda do tique do keyframe 1 e o último número à direita do dele, com o erro crescendo para as pontas. `margin: 0 calc(var(--range-thumb) / 2)` na faixa encolhe o sistema de coordenadas para o mesmo do slider, e o `0%–100%` daqui passa a ser o `0%–100%` de lá. `--range-thumb: 16px` é variável de `:root` porque é fato do navegador, não desta barra — o projeto não estiliza polegar em lugar nenhum.

**Os traços próprios foram retirados** (pedido do usuário): a primeira versão desenhava um tique por marca, e com os do `datalist` no mesmo lugar davam dois por keyframe. Sem traço, o destaque do keyframe que está na bancada (item 41) deixou de ser a espessura e passou a ser cor e peso — que é o que distingue um número dos vizinhos quando o tique é igual para todos.

Sobrou uma limitação conhecida: com muitos keyframes juntos, os números se sobrepõem. Aceita por ora — o `title` de cada marca ("Keyframe 4 — 3.2s") continua resolvendo caso a caso.

`.timeline-bar__visited` virou `.timeline-bar__mark--visited`: o elemento deixou de ser "a marca" para ser "a marca em destaque" entre várias, e o nome passou a dizer isso.

### Verificação

Suíte de 2.260 para **2.262** (a régua trocou quatro testes por seis), toda verde; `tsc -b`, `eslint .` e `npm run build` limpos.

**Falta a conferência visual do usuário** — em especial o recuo da régua, que é aproximação do polegar nativo e pode pedir ajuste do `--range-thumb`.

---

## 90. Consolidar doze sessões num lugar em que a décima terceira começa lendo

Pergunta do usuário em 2026-07-31: qual a melhor forma de consolidar as diferentes sessões de conversa feitas no projeto. São doze sessões e 349 MB de transcript em `~/.claude/projects/`.

### O diagnóstico: já estavam consolidadas, e faltava a porta

O ritual de documentar ao fim de cada sessão vinha sendo cumprido — 89 decisões numeradas com o porquê, 77 entregas datadas. **A consolidação não era o que faltava.** O que faltava era um lugar por onde entrar: uma sessão nova encontrava 4.700 linhas de documentação sem nenhum resumo, e o que ela precisava saber logo de cara — que não existe `npm test`, que nenhuma string de UI pode nascer sem chave de i18n, que só há um leitor de boneco desde o #86 — estava disperso no meio delas ou só no histórico de conversa, que não sobrevive à sessão.

Os `.jsonl` ficaram de fora por isso: o sinal deles já está destilado nos dois documentos, e o resto é ruído de ferramenta.

### O `CLAUDE.md`, e por que ele é curto

É o único arquivo que toda sessão nova carrega automaticamente, então cada linha nele custa contexto em toda sessão futura — o que empurra para o oposto de "copiar o plano". Ficou com o que não se descobre lendo código: os comandos reais, as regras que não se negociam (offline, TDD, i18n, português), o mapa das pastas, e uma lista de **invariantes conquistadas a duras penas** — as coisas que parecem detalhe e custaram uma decisão inteira, e que um agente desavisado desfaria por descuido. Cada uma cita o número da decisão, para o porquê continuar a um salto de distância em vez de ser reescrito.

O fluxo de trabalho do usuário entrou junto — perguntar antes, TDD, documentar depois nos dois lugares —, porque até aqui ele precisava ser repetido a cada sessão.

### O `HISTORICO.md`: o log sai do plano

O `PLANO.md` tinha 1.565 linhas e misturava três coisas: o que o app é, o que falta fazer e o que já foi feito. A terceira ocupava 890 linhas e crescia em **quatro blocos separados** — dois deles no meio da lista de propostas, porque em algum momento as entregas passaram a ser anexadas no fim do arquivo e a lista tinha ganhado grupos novos depois disso. O estrago era visível: os itens 40 e 41 do grupo H estavam separados do grupo por vinte entregas, e a proposta de rigging para o Blender morava entre duas entregas concluídas.

- **As 77 entradas foram para o `HISTORICO.md`**, reordenadas pela data de conclusão do próprio título, com ordenação **estável** — entradas da mesma data mantêm a ordem relativa, que é o que preserva referências como "ver a entrada seguinte" e "na sequência da reorganização do animador".
- **Nenhum texto de entrada foi alterado.** O corte foi conferido por contagem de linhas não-vazias antes e depois: zero perdidas, e as 84 acrescentadas são exatamente cabeçalho e índice.
- **Três referências que dependiam de posição foram corrigidas**, porque só elas quebravam com a mudança de arquivo: "a entrega no fim deste documento", "Entrega do item 42 acima" e "Substitui a ponte removida acima".
- **Os itens 40 e 41 voltaram para o grupo H** e a proposta do Blender ficou no `PLANO.md`, marcada como proposta sem número — a numeração não foi tocada, pela regra de sempre.

### Dois índices, e o que eles não são

`HISTORICO.md` e `DECISOES.md` ganharam índice no topo, com âncora por entrada. **Não são resumo** — resumo envelhece calado e passa a mentir. São só endereço: achar a #76 custava uma varredura de 2.783 linhas.

O do `DECISOES.md` lista 93 entradas para 89 números, porque o #31.5 e os #78.1–78.4 são desdobramentos que ganharam subnúmero em vez de número novo — o índice torna essa convenção visível pela primeira vez.

### O que ficou de fora

O `README.md` continua sendo o template do Vite, palavra por palavra. Está fora do que foi pedido e é decisão do usuário se o projeto quer um README de verdade.

---

## 91. Mapa de profundidade: uma rampa linear, três escolhas independentes (fase 13)

A fase 13 estava levantada desde 2026-07-31 no `PLANO.md` com **cinco decisões em aberto** e uma escolha de rota. Nenhuma linha foi escrita antes de o usuário responder às oito perguntas — o que evitou construir a coisa errada em três frentes de uma vez.

### A rota: por que o material nativo do three não servia

O `MeshDepthMaterial` com `BasicDepthPacking` emite `1 - fragCoordZ`, e já entrega a polaridade pedida (perto claro, longe escuro) em meia dúzia de linhas. O problema é que essa grandeza segue a distribuição em `1/z` da projeção em perspectiva: com o `near 0,1 / far 100` da câmera do projeto, 3 m dá cinza 0,032 e 5 m dá 0,019 — **o boneco inteiro ocupa cerca de três níveis de 256**. Apertar a faixa em volta do conteúdo salva a imagem, mas a rampa continua torta: o primeiro metro come metade da escala.

O usuário escolheu a **rota B** — um `ShaderMaterial` próprio de quinze linhas de GLSL que escreve `1 - (d - perto) / (longe - perto)`, com `d = -(modelViewMatrix * position).z`, a distância ao **plano** da câmera. Rampa reta, e o cinza no arquivo é o dado: o shader não inclui `<tonemapping_fragment>` nem `<colorspace_fragment>`, então o valor sai sem gama por cima. É o que ControlNet, compositing e relighting esperam ler. O teto continua sendo o PNG de 8 bits — anotado, não resolvido.

### O chão entra, mas não conta

A pergunta mais afiada do levantamento. O plano de 20×20 m é conteúdo de verdade — some no PNG só quando "ocultar grade/gizmos" está ligado, e a grade é outra coisa. Mas dentro da caixa envolvente ele vira uma rampa gigante que espreme o boneco de volta para os poucos níveis de cinza de que a faixa apertada acabou de salvá-lo.

**Decisão do usuário: desenhado, mas fora da conta.** A faixa é medida só por bonecos e objetos de cena; o chão é pintado com a mesma rampa e satura em preto lá atrás, que é o comportamento de qualquer renderizador. Isso é o que separou `depthContentBox` (quem entra na conta) de quem é desenhado (todo mundo).

A **elipse de contato** foi o caso oposto: ela é `transparent` com `depthWrite` desligado, e sob um material de profundidade viraria um disco opaco no chão **mentindo sobre a distância**. Some sempre — regra do modo, e não a opção de captura, que continua valendo para grade, gizmos, régua e papel-cebola.

### Três escolhas, e a função que existe só para elas serem independentes

O ponto em que o pedido do usuário foi mais específico: profundidade é **modo alternativo**, não segunda saída. Uma captura gera **um** arquivo; quem quer as duas versões gera duas vezes. E são três escolhas separadas — ver na tela, gerar o PNG, exportar o MP4 —, porque conferir o volume na tela não é a mesma coisa que querer o arquivo assim.

Independência de verdade custou uma função: **`suspendDepthMaterial`**. Com a vista em profundidade ligada, a cena viva já está com `overrideMaterial` posto e as elipses apagadas — capturar um PNG normal nesse estado sairia em profundidade, sem elipse. Então a saída normal **força** o modo normal e restaura depois. Sem nada ligado ela é inofensiva, e é por isso que a captura simplesmente sempre a chama, em vez de perguntar antes.

O sufixo `_depth` no nome nasceu daí: como são duas gerações, os números da sequência ficam diferentes (`snap001.png` e `snap002_depth.png`) e sem o sufixo não haveria como saber qual é qual. No MP4 ele é mais que conveniência — o nome do arquivo é o nome da animação, e sem sufixo a exportação em profundidade **sobrescreveria** o vídeo normal.

### O fundo tem um dono só

O erro que não foi cometido, e quase foi. O fundo precisa ir a preto no passe (o cinza do ambiente leria como distância média), e o caminho óbvio era mutar `scene.background` junto com o material, num lugar só.

Só que na TELA quem põe o fundo é o `Viewport`, por React (`<color attach="background">`). Com dois donos, desligar o modo daria isto: o R3F comita o cinza no `attach` e, logo depois, a limpeza do efeito restaura o "valor anterior" — que era o preto. A vista ficaria presa no escuro até alguém mexer noutra coisa.

Por isso o passe da tela (`attachDepthMaterial`) **não toca no fundo**, e o `Viewport` decide a cor reativamente; o fundo preto vive só nos passes de ARQUIVO (`applyDepthPass`), que são síncronos dentro de uma tarefa só e não disputam nada com o React. É a mesma disciplina do `RestoreScene` de sempre, com uma regra a mais: uma propriedade, um dono.

### Faixa automática, e por que a trava não é luxo

A caixa envolvente do conteúdo visível é o padrão óbvio e dá a melhor imagem de um quadro isolado. Numa **sequência**, é armadilha: cada quadro se remede, e um boneco que anda em direção à câmera sai sempre com o mesmo cinza — a informação de aproximação, que é justamente o que um depth map carrega, desaparece. A imagem "respira".

A trava (perto/longe em metros) é a saída, e mora numa seção **"Configurações" do painel de Cenas** por ser compartilhada pelas três saídas — dentro de qualquer uma delas ela pareceria pertencer só àquela. A alternância da tela ficou na **Toolbar**, ao lado da régua e da casca do boneco, pelo raciocínio do #81: é modo de visualização, fora do undo e fora do arquivo.

Duas escolhas menores caíram por consequência: `Box3.setFromObject` foi trocado por uma varredura própria (o do three **ignora a visibilidade**, e um boneco desligado no painel esticaria a faixa por algo que nem aparece na imagem), e a exportação de vídeo reaproveita **um** `ShaderMaterial` pelo laço inteiro, trocando só os uniformes — um material novo por quadro seria uma compilação de shader por quadro.

### O que ficou fora

As **miniaturas de keyframe** continuam sempre normais: elas existem para dizer qual keyframe é qual, e um cartão em cinza de profundidade diria menos. E a conferência visual no navegador continua sendo do usuário — WebGL real não existe em jsdom, como desde a fase 5.

### Adendo, no mesmo dia: o chão grampeado engolia o boneco

O usuário pediu uma alteração no chão "para evitar conflito com a profundidade dos bonecos", e a conta mostra que o conflito era grande. Tirar o chão da conta da faixa resolveu metade do problema e criou a outra metade: com a faixa medida só pelo boneco, o chão em primeiro plano cai **fora** dela, e grampear o que está fora significa pintá-lo de branco chapado.

Com a câmera padrão — 2 m de altura, 35 mm, boneco a ~5,4 m — o chão entra no quadro a ~2,5 m e a faixa começa a ~5,0 m. São **dois metros e meio de branco liso na metade de baixo da imagem**, no mesmo valor 1,0 que deveria ser exclusivo da superfície mais próxima do boneco. O peito e o rosto se dissolviam no piso exatamente na ponta clara da escala, que é o oposto do que um mapa de profundidade existe para fazer.

Quatro rotas foram medidas antes de perguntar: chão fora do passe (🟢, perde o contato com o solo), recortado pela faixa (🟡), encolhido em volta dos bonecos (🟢, mas a borda é reta no mundo e vira um degrau) e dentro da conta da faixa (🟢, e devolve o boneco a poucos níveis de cinza — o problema que a decisão original evitou). O usuário escolheu **um seletor de três valores com o recorte como padrão**, o que entrega a melhor rota sem fechar as outras antes da conferência visual.

**Recortar é por profundidade, não por geometria.** O material do chão descarta o fragmento cuja distância cai fora de perto/longe; a borda do "tapete" acompanha a distância em vez de ser um retângulo no mundo. O material do conteúdo **nunca** recorta, e essa assimetria é deliberada: com a faixa travada mais curta que o boneco, ele tem de clarear e escurecer nas pontas — sumir com metade dele seria um modo de falha muito pior do que saturar.

### O preço: `overrideMaterial` não servia mais

O chão precisa de um material **diferente** do resto, e `scene.overrideMaterial` é um só para a cena inteira. A troca virou material a material, por `traverse` — que era, aliás, o que o levantamento de viabilidade já previa.

Isso trouxe um problema que o `overrideMaterial` não tinha: com uma propriedade só, qualquer passe sabia restaurá-la; com N objetos, quem restaura precisa saber o que cada um era. E `suspendDepthMaterial` restaura o que **outro** passe trocou — é a função inteira da qual a independência das três escolhas depende.

A saída foi guardar o original em **marcas de `userData`** (`depthOriginalMaterial`, `depthHidden`) em vez de numa closure. O estado passa a viver no objeto, e não em quem o mexeu: qualquer passe desfaz o que outro fez, sem os dois se conhecerem. Duas consequências caem de graça — a aplicação vira **idempotente** (a marca só é gravada na primeira passada, então reaplicar não sobrescreve o original com o material de profundidade), e a vista na tela pode repeti-la **a cada quadro**, que é o que a faz alcançar um boneco ou objeto criado depois de o modo ter sido ligado. A dependência em `figureIds` que a versão anterior usava para isso saiu junto.

O usuário também decidiu **não** dar folga à faixa automática: a superfície mais próxima continua em 1,0 e a mais distante em 0,0, usando os 256 níveis inteiros.

## 92. Módulo de poses — a casca de toque do item 44, com sessão própria

**Contexto.** O item 44 do `PLANO.md` descrevia a "versão Lite" — uma segunda casca de UI sobre o mesmo núcleo, para posar no celular e no tablet — e terminava numa lista de ❓ "a decidir com o usuário antes de implementar". O pedido de implementação veio em 2026-07-31, com duas mudanças de enunciado: o nome de uso é **"Módulo de poses"** (a palavra "Lite" era só o apelido de projeto), e o painel de controle fica **embaixo em tela vertical e à direita em tela horizontal**. Todas as perguntas em aberto foram levadas ao usuário antes de qualquer código.

**As decisões do usuário, na ordem em que destravaram o desenho:**

| Questão | Decisão |
|---|---|
| O que o módulo produz | **Keyframes de animação**, como o item 44 já dizia — "módulo de poses" é o nome, não uma mudança de escopo. UI e sessão à parte; toda a lógica de poses/limites/juntas reutilizada integralmente, nenhuma estrutura nova de pose |
| Autosave | **Chave própria** (`webposer:poses:v1`) — a sessão do módulo não atropela a do desktop, nem o contrário |
| Desfazer | **Só botões** — sem os gestos de dois/três dedos do plano |
| Torção | **Painel E gesto** de girar dois dedos |
| Linha do tempo | **Gestão completa**: capturar, ir para, regravar, reordenar, apagar |
| Arquivo | **Abre e exporta** o JSON de animação — ponte de ida e volta com o desktop |
| Altura e X/Z | **Os dois liberados** (altura no painel; colocação pelo arrasto/setas, com a vista de cima andando no plano do chão) |
| Vista livre | **Cena toda**, com o manequim completo — e o filtro "mostrar só o boneco em edição" continua valendo |

**A sessão própria custou uma lição de ciclo de import.** A chave de autosave é decidida pela casca em vigor, e a casca precisa estar decidida ANTES de o `figuresStore` restaurar o autosave — que acontece no init do módulo. O primeiro rascunho pôs as chaves e a resolução no próprio `autosave.ts` e quebrou na hora: o `figuresStore` chama `loadWorkspaceFromLocalStorage` DE DENTRO do ciclo `autosave → poseLibrary → figureFormat → figuresStore`, quando o corpo do `autosave.ts` ainda nem rodou — toda `const` de lá estava em TDZ. A saída foi mover a identidade da sessão (as duas chaves e `resolveAutosaveKey`) para o `shellChoice.ts`, que é módulo-FOLHA e o primeiro import do `autosave.ts`; o `autosave.ts` reexporta. Pela mesma razão, **trocar de casca é recarga de página**: override persistido (`webposer:shell:v1`) + `location.reload()`, com a sessão corrente gravada de forma síncrona antes (o debounce de 800 ms podia estar no meio). A detecção automática é ponteiro grosso (`pointer: coarse`) **e** menor dimensão ≤ 1024 px, decidida uma vez no carregamento; o override tem botão na Toolbar do desktop e na barra do módulo.

**Um caminho de edição só, derivado da base da câmera.** Cada vista ortográfica trava um eixo do mundo; o arrasto projeta o raio do toque no plano que passa pela junta e é perpendicular a esse eixo, e resolve com o MESMo `solveJointDrag` do desktop. As **setas do painel são o arrasto em passos** (2 cm): empurram o mesmo alvo, no mesmo plano, pelo mesmo solver — a dimensão travada vale para elas de graça. A base de tela de cada vista é DERIVADA da base da câmera (forward × up), nunca escrita à mão — é o que faz "trás" e "lado direito", em que a direita da tela é o sentido oposto do mundo, saírem certas sem caso especial (`posesViews.ts`, com teste travando cada base). A raiz translada em vez de rotacionar; juntas fora do arrasto (mãos, `spine`/`hip.*` presas à raiz) desabilitam as setas em vez de fingir edição.

**Torção é sempre o DOF `y`.** O esqueleto modela todo osso ao longo do Y local, então "girar no próprio eixo" — pronação do antebraço, giro do ombro, torção do tronco — é o eixo `y` de quem o tem; dobradiça (joelho) não tem torção e o controle nem aparece (`jointTwist.ts`). O slider do painel edita esse eixo com os limites em vigor; o gesto de dois dedos aplica o delta do ângulo entre os ponteiros, mas só "vence" a câmera depois de acumular 10° de giro — pinça (zoom) e arrasto de dois dedos (pan) continuam com o `OrbitControls` até lá.

**"Ocultar os outros bonecos" é filtro de tela, não `visible`.** O plano sugeria `toggleVisibility`, mas `visible` é CONTEÚDO — vai no retrato do keyframe. Capturar com os outros "ocultos por conveniência" os gravaria invisíveis na animação. O filtro (`showOnlyEditing`) vive no store da casca, fora do undo e do arquivo, e só decide o que o viewport desenha.

**Regravar preserva a câmera gravada.** O desktop regrava keyframe com a câmera VIVA; o módulo não tem câmera de cena (decisão do item 44: fica só a câmera de trabalho, que não é gravada), então "regravar com a pose atual" reescreve os bonecos e repassa `keyframe.camera` — o enquadramento feito no desktop sobrevive à ida ao celular. A captura usa a câmera padrão (`DEFAULT_SCENE_CAMERA`), porque keyframe sem câmera é descartado pela sanitização.

**Fronteira com o existente.** Viewport próprio (`PosesViewport`, um `<Canvas>` só — sem `<View>`, sem scissor), store próprio (`posesShellStore`), CSS próprio sob `.poses-shell` com o responsivo por `orientation` (painel embaixo/à direita — decisão do usuário deste pedido). Nos arquivos compartilhados, só mudanças aditivas e opcionais: `Figure.tsx` ganhou `touchTargetRadius` (esfera invisível de toque por junta — invisível não escapa do Raycaster, então recebe clique e pointerdown) e `onJointPointerDown`; `autosave.ts` ganhou o parâmetro `key` com default no comportamento de hoje; `App.tsx` escolhe a casca; a Toolbar ganhou o botão de ida. O keyframe corrente da bancada (`currentKeyframeId`) replica a semântica do `visitedKeyframeId` do item 40 — "o que estou editando", não "onde o playhead está" — e ancora o papel-cebola, que reusa `onionSkin.ts` puro e o modo do `animationStore`.

**Ressalva de validação.** Arrasto de junta, gesto de torção, pinça de câmera e Web Share não são testáveis por unit test (mesma ressalva do gizmo, #31.5) — **falta a conferência visual no navegador**, em aparelho de toque real. O caminho por trás deles (projeção, solver, setas, torção por slider) está coberto por teste.

### Adendo, no mesmo dia: ajustes de UI após o teste em tela de celular

O usuário testou no modo device dos DevTools e pediu quatro ajustes; nenhum muda o desenho, todos mudam o couro:

- **Botões menores.** Os alvos de 44 px (a recomendação clássica de toque) estouravam a tela de celular somados: mínimos reduzidos para 36 px (32 nos botões de ação da lista de keyframes; captura de 64 para 52), com fontes um degrau menores.
- **Linhas de abas ROLÁVEIS.** Tanto a barra de vistas quanto a de abas do painel: botão não encolhe (`flex: none`/`1 0 auto` + `white-space: nowrap`) e o excesso rola (`overflow-x: auto`) — antes o flex espremia os rótulos e o que não coubesse ficava simplesmente inalcançável.
- **Reordenação.** Vistas na ordem de um giro em volta do boneco — Lado dir., Frente, Lado esq., Trás, Cima, Livre — e abas em **Boneco, Junta, Simetria, Keyframes, Arquivos** (rótulos do pedido, no singular/plural que o usuário escreveu). A aba inicial passou a ser a primeira, Boneco: sem boneco não há o que posar.
- **O combo de juntas do desktop na aba Junta.** O MESMO `<select>` do painel de Propriedades — raiz + grupos em `<optgroup>`, com os mesmos rótulos —, ligado ao mesmo `selectJoint` do toque no viewport. Substituiu o botão "selecionar a raiz" e o parágrafo com o nome da junta, que viraram redundantes. O mapa de rótulos dos grupos saiu de `PropertiesPanel.tsx` para `layout/jointGroupLabels.ts`: exportar constante de arquivo de componente derruba o fast refresh (`react-refresh/only-export-components`), e o lint barrou — como devia.

### Segundo adendo, no mesmo dia: o estouro horizontal era o `auto` do grid

Segunda rodada de teste no DevTools (425 px): o painel continuava com controles cortados à direita. O diagnóstico valeu registrar: a coluna única de `.poses-shell` ficava com a track implícita `auto`, e track `auto` assume o **max-content** do item mais largo — a barra de vistas, cujos botões não encolhem de propósito desde o primeiro adendo. O grid inteiro (barra, viewport E painel) herdava essa largura e a página estourava a tela; o `overflow-x: auto` da barra não ajudava em nada, porque o overflow dela nunca acontecia — o contêiner é que crescia. A correção é `grid-template-columns: minmax(0, 1fr)` (e o mesmo `minmax(0, 1fr)` na coluna do viewport em paisagem, onde `1fr` sozinho tem o mesmo mínimo `auto`).

Mais três ajustes pedidos na mesma rodada:

- **A seta › colada nas vistas.** A linha de vistas tinha `flex: 1` e empurrava a seta de próxima vista para a borda direita, perto do desfazer. Virou `flex: 0 1 auto` + `margin-left: auto` nas ações: ‹ vistas › formam um grupo à esquerda, desfazer/refazer/troca de casca ficam à direita.
- **Rotação da raiz por sliders.** Com a raiz selecionada, a aba Junta mostra três sliders livres (X/Y/Z, −180° a 180°, `setRootRotation`) no lugar do slider de torção — inclinar e girar o boneco inteiro não era alcançável pelo arrasto planar, e a torção da raiz era só o Y.
- **Pan e zoom nas vistas de edição.** O OrbitControls das ortográficas ganhou `touches: { ONE: PAN, TWO: DOLLY_PAN }` e `mouseButtons: { LEFT: PAN }`: um dedo (ou o botão esquerdo) em espaço VAZIO desloca a vista, pinça/roda aproxima — e um dedo sobre a junta continua sendo arrasto de pose, porque o pointerdown da junta desliga os controles. Antes, o gesto de um dedo fora do boneco não fazia nada nas vistas de edição (a translação só existia com dois dedos), o que na prática deixava o zoom/pan inacessível no DevTools e desconfortável no aparelho.

### Terceiro adendo, no mesmo dia: papel-cebola por dois checkboxes

Na aba Keyframes, o controle de papel-cebola era um liga/desliga geral mais três botões de modo (ambos/anterior/posterior) — quatro controles para um espaço de quatro estados. O usuário pediu a forma mínima: **dois checkboxes, "Anterior" e "Posterior", com o resultado inferido da combinação** — os dois marcados = ambos, um só = aquele, nenhum = desligado. O liga/desliga geral deixou de existir como controle porque ele É a combinação.

O modelo de dados não mudou: o par `(onionSkin, onionSkinMode)` do `animationStore` continua sendo a fonte — do desktop inclusive —, e os checkboxes são estado **derivado** dele, nunca um espelho paralelo. A conversão nas duas direções vive na própria aba (`showPrevious`/`showNext` na leitura, `applyOnion` na escrita), coberta pelas quatro combinações no teste do painel.

## 93. Vista Livre com edição destravável — arrasto no plano da tela + gizmo de setas

**Contexto.** O item 44 registrou a vista Livre do módulo de poses como navegação pura — "conferir a pose em 3D, sem risco de mexer nela". Em 2026-07-31 o usuário pediu a avaliação de liberá-la para edição, "igual ao original, com comandos de translação livres, sem rotação". A avaliação apontou custo baixo (o arrasto das vistas travadas já é "projetar o toque num plano e entregar ao solver"; faltava só o plano de normal arbitrária), um porém honesto (perde-se a vista sem risco de edição acidental) e uma pergunta de casca. As respostas do usuário desenharam a solução final, melhor que as duas variantes oferecidas:

- **Edição DESTRAVÁVEL, não permanente.** Um cadeado na barra de cima, visível só na vista Livre: travada (o padrão), a vista continua exatamente o que o item 44 pediu — manequim completo, navegação, risco zero; destravada, vira bancada de edição. O porém da avaliação foi resolvido pelo usuário com um interruptor em vez de uma escolha definitiva.
- **A casca ANUNCIA o modo.** Destravada mostra o palito (alvos gordos, "estou editando"); travada, o manequim completo ("estou conferindo"). A casca vira o indicador de estado — não é preciso procurar o cadeado para saber em qual modo se está.
- **Translação por dois caminhos, rotação por nenhum.** Arrastar a junta move no plano PARALELO À TELA que passa por ela (a normal é a direção da câmera capturada no momento do toque — orbitar depois não muda o plano); e um **gizmo de três setas de eixo** (X/Y/Z, cores de editor 3D, haste invisível gorda para o dedo) restringe o arrasto à reta do eixo — o alvo é o ponto da reta mais próximo do raio do toque (`closestPointOnAxisToRay`, pura e testada). Rotação continua fora, como o pedido disse: torção e raiz ficam com os sliders do painel.
- **Sem setas do painel na Livre** (decisão explícita do usuário). Era o item caro da avaliação — a base de tela da Livre depende da câmera viva, que orbita, e exigiria uma ponte câmera→store. O gizmo do viewport faz o papel delas com custo menor e no lugar onde o dedo já está.

**O que NÃO mudou:** as vistas ortográficas (plano da vista, setas do painel, gesto de torção) ficaram intactas; o gesto de torção continua só nelas; `POSES_VIEWS.free.editable` continua `false` — "editable" significa "vista de edição planar", e a Livre destravada é um modo por cima (`canEdit = view.editable || freeEditEnabled`), não uma sétima vista. O estado do cadeado é ferramenta: fora do undo, fora do arquivo, e não persiste — a vista volta travada a cada sessão, que é o padrão seguro.

**Ressalva de sempre:** o arrasto e o gizmo em si não são testáveis por unit test — a matemática dos dois caminhos é (plano de normal arbitrária equivale ao plano de eixo quando a normal É um eixo, travado por teste), e **falta a conferência visual no navegador**.

## 94. Quinze sugestões registradas, nove implementadas — o lote de acabamento do módulo de poses

**Contexto.** Depois de fechar o item 44 e seus ajustes, o usuário pediu sugestões de melhoria. O levantamento produziu quinze, das correções de robustez a funcionalidades novas, e a decisão dele foi: **registrar todas** como itens 45–59 do grupo J no `PLANO.md` (numeração seguindo do fim, como sempre) e **implementar nove** — as sete de robustez/usabilidade (45–51), o atalho do PWA (56) e o espelho por membro (59). As seis restantes (52–55, 57, 58) ficam registradas para decisão futura.

**As duas correções que eram bugs de verdade.** O arrasto com listeners no canvas perdia o `pointerup` quando o dedo saía dele — o arrasto ficava "grudado" até o toque seguinte (45; move/up/cancel foram para a `window`, no arrasto e no gesto de torção). E o Wake Lock era pedido uma vez: o navegador o solta ao perder visibilidade, então qualquer troca de aba deixava a tela apagando de novo (46; re-pedido no `visibilitychange`).

**Desempenho sem mudar comportamento.** Cada `pointermove` rodava o solver e re-renderizava a árvore dos bonecos; agora os moves são coalescidos por `requestAnimationFrame` e cada quadro resolve só o último evento (47) — a mesma preocupação que o plano do animador já registrava para o caminho de reprodução.

**Toque.** O gizmo da Livre ganhou tamanho constante em tela — reescalado por quadro pela distância da câmera, com grampo para não sumir nem engolir o boneco (48). "Enquadrar boneco" virou botão da barra: um contador de comando no store da casca, consumido pelo viewport — nas ortográficas repõe a câmera e o zoom da vista; na Livre mantém a direção de órbita e só recentra (49; contador, e não booleano, para dois toques dispararem duas vezes). O duplo toque na junta trava/destrava (50 — previsto no item 44 e até então de fora; raiz excluída). E os sliders de torção e da raiz ganharam botões ±1°/±5°, porque dedo em slider não acerta grau (51).

**O atalho do PWA exigiu uma regra de precedência.** O manifest não escreve em `localStorage`, então o atalho aponta para `./?shell=poses` e o `shellChoice` ganhou a leitura da URL — que **vence o override gravado**, por ser o gesto mais explícito. A consequência sutil: os botões de troca de casca não podem mais só recarregar — um app aberto pelo atalho ficaria preso à casca da URL —, então `switchShell` grava o override e navega REMOVENDO o parâmetro (56).

**Espelho por membro (59).** A aba Simetria ganhou o seletor de alcance — boneco inteiro ou a partir da junta selecionada — passando o mesmo `scopeJoint` que o desktop usa desde o #34; `getMirrorScope` diz quando a junta selecionada não tem par e a opção desabilita. Nenhuma rotina nova: só a UI expõe o parâmetro que as ações já aceitavam.

**Ressalva de validação:** duplo toque, gizmo reescalado, enquadrar e o arrasto na window são interação de ponteiro/câmera — cobertos onde a lógica é pura (comando de enquadrar, escopo do espelho, ajuste fino, precedência da URL) e pendentes de conferência visual no navegador no resto. É exatamente a lacuna que o item 57 (Playwright) existe para fechar.

## 95. O smoke de Playwright do módulo de poses — o item 57, e o fim do "falta a conferência visual" para o essencial

**Contexto.** Toda entrega do módulo de poses terminava com a mesma ressalva: arrasto, pan, troca de casca e gizmo não são testáveis em jsdom, "falta a conferência visual no navegador". O #31.5 tinha provado que o Playwright alcança arrasto de verdade (PointerEvent real, WebGL real); o item 57 registrou a dívida, e o usuário mandou pagá-la.

**O desenho.** `@playwright/test` como devDependency (rede só em tempo de desenvolvimento — a regra de zero rede é de RUNTIME), config na raiz (`playwright.config.ts`), specs em `e2e/`, comando próprio `npm run test:e2e`. Três fronteiras que importam:

- **Fora do vitest**: `e2e/**` entrou no `exclude` do `vite.config.ts` — sem isso o vitest coletaria os specs e morreria nos imports do Playwright. A suíte das ~2,4 mil continua sendo `npx vitest run`; o e2e é outra ferramenta, outro comando, outro tempo (1 min sobre o dev server, que a config sobe sozinha).
- **Asserção pelo AUTOSAVE, não por API de teste**: os smokes leem `webposer:poses:v1` do `localStorage` — o mesmo caminho que o app usa para persistir — em vez de expor store no `window` só para teste. O debounce de 800 ms vira `expect.poll`.
- **Coordenadas derivadas, não chutadas**: a posição em tela da raiz na vista de frente sai das mesmas constantes do viewport (alvo em (0, 1, 0) no centro do canvas, 2,4 m de altura enquadrada → a raiz está `altura/24` px abaixo do centro). O teste quebra junto com a constante, que é o comportamento certo.

**Os quatro smokes** (viewport 425×900, o alvo do módulo): casca decidida por `?shell=poses` e trocada pelos botões — incluindo a asserção de que a volta LIMPA o parâmetro da URL (a regra do #94); **arrasto real da raiz** movendo a colocação (o autosave registra X e Y mudados e Z travado pela vista); pan de um dedo no vazio sendo câmera e não pose; e a vista Livre com o cadeado alternando e a órbita travada sem tocar na pose. Todos coletam `pageerror` e `console.error` e terminam exigindo a lista vazia — o "console limpo" das validações manuais, automatizado.

**Uma lição de dev server**: o primeiro run falhou na troca de casca — o desktop carregou, mas depois dos 5 s padrão, porque o dev server compila os módulos da OUTRA casca na primeira visita. As asserções pós-navegação ganharam timeout folgado, com o porquê no comentário.

**O que o smoke NÃO cobre, dito com todas as letras:** gesto de torção de dois dedos, duplo toque, arrasto das setas do gizmo (a projeção e o alvo por eixo têm teste de unidade; o dedo na seta continua conferência manual), Web Share e o atalho do PWA instalado — multitoque e instalação são outra categoria de automação. A ressalva das entregas encolheu, não sumiu.

## 96. Rotação por eixo na aba Junta, anéis gimbal de leitura e o reset por eixo — itens 60 e 61

**Contexto.** Os itens 60 e 61 foram desenhados com o usuário em 2026-08-01 e registrados no `PLANO.md` sem implementar; nesta sessão ele mandou executar. O pedido original: controles de rotação por eixo para toda junta (no estilo dos sliders da raiz), substituindo a torção; um indicador visual dos eixos no gizmo, **não interativo**; o mesmo padrão de cores no gizmo e nos controles; e um botão no meio dos botões finos que devolve **só aquele eixo** ao valor inicial.

**A torção não perdeu nada — virou um dos sliders.** O esqueleto modela todo osso ao longo do Y local, então a torção sempre foi o DOF `y`; agora a aba Junta mostra um slider por eixo de DOF (`getJointAxes`, 1–3), com os limites EFETIVOS (override do workspace ?? `skeleton.ts`), aplicado por `setJointRotation` — clamp e trava valem, como em toda edição. O caso "esta junta não tem torção" (joelho) desapareceu: toda junta tem ≥1 DOF. O gesto de dois dedos no viewport continua exatamente onde estava, no `y` (`jointTwist.ts`). As chaves `twist*` e `rootRotation*` do i18n unificaram-se em `rotation*` — raiz e junta falam a mesma língua no painel.

**Um padrão de cor com um dono só.** X `#e04040`, Y `#40a840`, Z `#4060e0` moravam inline nas setas do gizmo; agora moram em `src/poses/gizmoStyle.ts` (junto da escala por distância do item 48), e três consumidores leem de lá: as setas, os anéis e os sliders (rótulo e `accent-color`). É a cor que faz o controle do painel e o desenho no viewport se explicarem um ao outro — mexer numa sem as outras deixaria o padrão mentindo.

**Anéis GIMBAL, não "anéis nos eixos locais".** A decisão do usuário foi o indicador fiel: a pose local é um Euler XYZ intrínseco, então o anel X vive no frame do PAI, o anel Y carrega a rotação X já aplicada, e o anel Z carrega X e Y — um anel fixo nos eixos locais mentiria em junta já rodada (giraria junto com o eixo que diz medir). A matemática é pura em `jointAxisFrames.ts` (frame do pai via `buildJointFrames` + dois quaternions encadeados), com sete testes de unidade — inclusive o de fidelidade (X ignora a própria junta; Z = Qx·Qy) e o de propagação (girar o ombro gira os anéis do cotovelo). A raiz é a exceção deliberada e registrada: três anéis nos EIXOS DO MUNDO, porque girá-la é colocação. O componente `JointAxisRings` só desenha: toros com `depthTest` desligado, tamanho constante em tela (o mesmo mecanismo do gizmo) e `raycast` nulo — os anéis não participam do toque, o alvo da junta fica livre. Aparecem em **todas as vistas de edição** (ortográficas + Livre destravada, onde convivem com as setas: setas arrastam, anéis só leem).

**O ⟲ devolve um eixo à MESMA referência do reset inteiro.** A linha fina virou `[−5°, −1°, ⟲, +1°, +5°]` (grade de 5 colunas), e o ⟲ usa `resolvePosePreset('standing')[junta]?.[eixo] ?? 0` — a referência que o `resetJointRotation` do store já usava. O cotovelo volta a y=90 (a torção neutra do #25), não a zero cru; a raiz volta a 0. Duas referências divergentes seria exatamente o tipo de cópia que o #86 mandou extinguir.

**O e2e pagou o custo dele: pegou um bug latente de verdade.** Com os anéis, o smoke do arrasto da raiz passou a falhar às vezes — e a investigação achou a causa no `handleUp` do arrasto, que **descartava o `pendingMove`** em vez de despachá-lo. O descarte sempre existiu (o coalescimento por rAF do item 47 joga fora o último trecho de qualquer gesto rápido), mas era imperceptível; a primeira renderização dos anéis compila shader novo NO MEIO do gesto, e o travamento de thread fazia o `pointerup` vencer o rAF — o arrasto inteiro era engolido. A correção é de princípio: soltar o dedo **despacha** o movimento pendente antes de limpar. De quebra, dois buracos do próprio smoke: o poll aceitava autosave vazio como sucesso (`null ≠ [0,0,0]` passa em falso — agora só aceita posição já movida), e o clique no boneco recém-criado corria contra a raiz React PRÓPRIA do Canvas (o painel confirma o clique antes de o boneco existir na cena 3D — dois `requestAnimationFrame` garantem um quadro pintado antes do arrasto).

**Ressalva de sempre, menor que antes:** a aparência dos anéis (espessura, raio, opacidade) e o conjunto no aparelho real são conferência visual; a matemática dos frames, os sliders, o ⟲ e o arrasto estão cobertos por unidade e pelo e2e.

## 97. Âncora de junta e a raiz que gira no arrasto — itens 62 e 63

**Contexto.** Dois pedidos avaliados e desenhados com o usuário na mesma sessão de 2026-08-01, registrados como itens 62 e 63 do `PLANO.md` antes de qualquer código, e implementados juntos por serem duas faces do mesmo funil: **âncora** = fixar a posição de uma junta no mundo ("se eu fixar o cotovelo, ele não vai mexer, mas punho e dedos funcionam considerando a limitação do cotovelo"); **raiz rotacionável** = mudar a regra "a raiz nunca se move" do arrasto para "a raiz gira, mas nunca translada".

**A âncora não é um solver — é um conjunto de travas derivado.** Num esqueleto FK a posição de uma junta depende SÓ dos ancestrais dela e da colocação da raiz; fixar o cotovelo equivale, portanto, a congelar ombro, clavícula, tronco… e a colocação inteira. O mecanismo de congelar já existia e é maduro: o #42. Nasceu `src/figure/jointPins.ts` espelhando `jointLocks.ts` (mapa por boneco, toggle, cópia no duplicar, poda por cena, sanitização do autosave — a `root` não é ancorável, como não é travável), mais duas derivações puras: `frozenJointsByPins` (a UNIÃO das cadeias de ancestrais das juntas ancoradas — várias âncoras se somam) e `isPlacementPinned` (qualquer âncora congela a colocação). A rotação da PRÓPRIA junta ancorada segue livre — girá-la não move a posição dela, e é o que deixa o punho alcançar o que os limites do cotovelo permitem; rigidez total é âncora + cadeado na mesma junta.

**Um funil só: `effectiveLockedJoints`.** A soma travas ∪ congeladas ∪ `root`-se-ancorado entra nos MESMOS pontos que já consultavam as travas — `mergeLockedJoints`, `setJointRotation(s)`, os resets, o espelho ao vivo e o solver de arrasto — trocando a leitura de `state.jointLocks` pela função nova, sem segundo mecanismo. Incluir `ROOT_JOINT_NAME` no conjunto quando há âncora é o detalhe que faz o item 62 e o 63 se encaixarem: é assim que o solver sabe não recrutar a raiz de boneco ancorado, e é inócuo em todos os demais consumidores (a raiz não é chave de pose).

**A colocação congelada foi a superfície genuinamente nova.** `setPosition`, `setRootRotation`, `seatFigureOnGround` e o reset da raiz ganharam a recusa no store — o que cobre gizmo, teclado, painel e arrasto de uma vez, no mesmo espírito do #42. Mas pose APLICADA também carrega colocação: preset com par, biblioteca, cópia entre bonecos, mistura e pose de arquivo passaram por `keepPinnedPlacement` — a posição e rotação atuais vencem as da pose aplicada. E o `TransformControls` do desktop exigiu supressão em vez de recusa: ele MUTA o objeto da cena antes de o store confirmar, e uma recusa silenciosa deixaria a tela dessincronizada — o gizmo da raiz ancorada (e o de rotação de junta congelada) simplesmente não monta, com o painel de Propriedades explicando o porquê.

**A raiz como último elo do CCD (item 63).** O recrutamento progressivo já era o mecanismo certo: a raiz virou o último elemento da lista `movable`, com o MESMO passo das juntas — menor rotação no mundo levando efetuador→alvo, clamp identidade (colocação não tem limite articular), pivô no quadril (é onde `buildJointFrames` aplica `figure.rotation`). Três eixos, por decisão explícita do usuário contra a recomendação de só Y — os efeitos colaterais aceitos estão no item: inclinar tira os pés do plano do chão, e o "gizmo trava na borda" praticamente desaparece. Todo alvo alcançável pela cadeia se comporta exatamente como antes (a raiz só entra depois de TUDO saturar); a válvula de escape para pés plantados é a âncora. O resultado sai num campo próprio (`rootRotation`, nunca dentro de `rotations` — colocação não é pose) e entra no store pelo `setJointRotations(id, rotations, rootRotation)`: juntas e colocação mudam **num passo de undo só**, nos dois caminhos de arrasto (desktop e módulo de poses).

**UI nas duas cascas, com a contagem que o #42 ensinou.** Botão "Fixar posição" ao lado do cadeado (que deixou de ser ação sozinha — as duas proteções viraram um conjunto de duas colunas, #88), aviso em três situações distintas (ancorada, congelada por âncora abaixo, colocação congelada), sliders/setas/reset desabilitados dizendo o porquê, contagem de âncoras com "soltar todas" no resumo da raiz, e destaque AZUL na junta ancorada (`Figure.tsx`) — diferente do vermelho da trava, e sempre visível no desktop (não só com gizmo ativo): um efeito que congela metade do boneco não pode depender de modo para se explicar.

**Dois testes antigos mudaram de verdade, e isso é o item 63 funcionando.** "Com todos os ancestrais travados a junta não sai do lugar" agora termina com o corpo girando atrás do alvo (e ganhou o irmão: com `root` no conjunto, nada se move); o replay de FK dos testes do solver passou a incluir a rotação da raiz. O comportamento antigo continua disponível — é exatamente o que a âncora produz.

**Ressalva de validação:** arrasto com giro de corpo, supressão do gizmo do desktop e o destaque azul são conferência visual no navegador; a matemática, o funil de travas, as guardas de colocação e a UI de painel estão cobertos por unidade (37 testes novos).

## 98. Trazer a sessão da outra casca — item 54

**Contexto.** As sessões do desktop e do módulo de poses são separadas por chave de `localStorage` desde o #92 (`webposer:workspace:v1` e `webposer:poses:v1`), por decisão do usuário — abrir o módulo não atropela o trabalho do desktop, nem o contrário. O item 54 registrou a peça que faltava nesse desenho: no mesmo aparelho, um jeito de continuar numa casca o que se começou na outra, sem passar por arquivo. Em 2026-08-01 o usuário mandou implementar, com três decisões confirmadas antes do código: viaja o **workspace inteiro** (não só a animação — a troca de keyframes por arquivo já existia na aba Arquivos), o gesto é **trazer** (puxar da outra chave para a sessão viva, e não empurrar para uma sessão que não está na tela), e os botões moram no **painel de Cenas** (desktop) e na **aba Arquivos** (módulo) — assunto de workspace num, ponte com a outra casca no outro.

**Por que "trazer" e não "levar".** Empurrar para a outra chave seria uma linha (`saveWorkspaceToLocalStorage` na chave alheia), mas o efeito só apareceria ao abrir a outra casca — um botão cujo resultado não se vê. Puxar substitui o que está NA TELA: o fluxo natural ("abro onde quero continuar e trago o que fiz lá") com feedback imediato. O custo foi uma ação nova no store, `loadRestoredWorkspace`, que aplica um `RestoredWorkspace` inteiro com o MESMO mapa de campos que o init consome do autosave — nenhum formato novo, nenhuma sanitização nova: a leitura passa por `loadWorkspaceFromLocalStorage`, o mesmo funil de qualquer restauração (limites articulares instalados ANTES de as poses serem reconstruídas, biblioteca e animações sanitizadas, travas e âncoras podadas).

**A troca não é desfazível, e cada casca limpa o próprio rastro.** Como o `resetWorkspace`, a ação limpa a seleção e zera o histórico de undo — o histórico pertencia à sessão que saiu da tela. Pelo mesmo motivo, o desktop reseta a linha do tempo (`resetTimeline` — o keyframe visitado do item 40 não existe mais) e o módulo zera o `currentKeyframeId`. A UI pede a confirmação em dois passos do "novo workspace" (substituir tudo não é gesto de um clique), e a sessão trazida se grava sozinha na chave da casca atual em seguida, pelo assinante de sempre do autosave. Sem sessão salva na outra chave, o botão avisa e não toca em nada.

## 99. A raiz nunca teve trava — e ganhou três, uma por eixo (item 64)

**Contexto.** O usuário relatou que "o botão de deixar a raiz travada aparentemente não funciona" — e a investigação achou coisa pior: a raiz não tinha NENHUM caminho funcional de trava. O `toggleJointLock` a ignora desde o #42 ("a raiz é colocação, não pose"), o painel de Propriedades do desktop nem mostra o cadeado para ela (o par trava/âncora vive no ramo de junta) e a aba Junta do módulo o mostra desabilitado. Era inócuo até o item 63: com o solver recrutando a raiz como último elo, ficou impossível impedir o giro de corpo sem apelar para a âncora — que congela a cadeia inteira, pesado demais para "só não gire". O pedido veio junto com o desenho: tratar a raiz de maneira especial, com a rotação travável **separadamente em cada eixo**, de modo que mexer nas outras juntas só deixe a raiz girar na direção destravada. Três decisões confirmadas antes do código, todas na recomendação: a trava **vale para tudo** (regime único do #42, não só para o arrasto), o controle é um **cadeado ao lado de cada slider** nas duas cascas, e o **cadeado geral não existe na raiz** — travar a raiz inteira é travar os três eixos.

**Tokens no mapa de sempre, não um mecanismo novo.** `root.x`/`root.y`/`root.z` entram no MESMO `JointLockMap` do #42 (`rootAxisLockToken`/`getLockedRootAxes` em `jointLocks.ts`; a `root` crua continua recusada). O que isso compra: persistência, cópia no duplicar, poda por cena e sanitização do autosave de graça, e o trânsito até o solver pelo funil que já existia — `effectiveLockedJoints` devolve a lista com os tokens dentro, e eles não colidem com nada (nunca são nome de junta nem chave de pose; `mergeLockedJoints` os atravessa ileso). A contagem "N juntas travadas" DESCONTA os tokens: ela fala de juntas, e os eixos têm os próprios cadeados à vista. "Destravar todas" solta os tokens junto — limpa a entrada inteira do boneco, e os cadeados abertos se explicam sozinhos.

**No solver, o eixo travado volta ao valor de partida — o mesmo regime do clamp.** O passo da raiz no CCD (item 63) ganhou uma linha: depois do clamp (identidade para a raiz), cada eixo travado é devolvido ao valor que a colocação tinha no INÍCIO do arrasto, e a varredura seguinte compensa o que a trava comeu — exatamente como o clamp de limites já fazia nas juntas. Com X e Z travados o corpo só gira de pé (a recomendação "só Y" do item 63, que o usuário descartou como padrão, virou uma escolha que ele liga quando quer); com os três, a raiz sai do recrutamento — o efeito que o cadeado quebrado deveria ter tido desde sempre.

**"Vale para tudo" espalhou a guarda pelos consumidores de colocação.** `setRootRotation` filtra os eixos travados da escrita — e esse é o caminho de TODA edição direta: slider, ajuste fino, teclado e o gesto de torção do módulo. O reset da raiz zera só os eixos destravados (os três travados = no-op, sem passo de undo fantasma). E o `keepPinnedPlacement` do item 62 generalizou-se em `keepGuardedPlacement`: âncora congela a colocação inteira, eixo travado preserva SÓ aquele eixo da rotação — um guardião único por onde passam preset (com par), biblioteca, cópia, colagem, mistura e pose importada. No gizmo do desktop, o anel do eixo travado simplesmente não aparece (`showX/Y/Z` do `TransformControls` — o mesmo mecanismo que já escondia eixos sem DOF nas juntas), o que evita a mutação-antes-da-recusa que o #97 documentou.

**UI: o cadeado mora no eixo que ele trava.** No desktop, cada `AxisSlider` da rotação da raiz ganhou um botãozinho de cadeado (aria-pressed, rótulo "Travar/Destravar eixo N"); no módulo, o cadeado entrou como sexta coluna da linha fina `[−5°, −1°, ⟲, +1°, +5°, 🔒]` — e o botão geral de travar, que na raiz sempre foi mentira ou botão morto, saiu de cena nas duas cascas ("Destravar todas" ficou, como ação sozinha). Reprodução de animação continua por fora, como toda trava: keyframe é conteúdo, trava é ferramenta.

**Ressalva de validação:** o comportamento do arrasto com eixo travado (o corpo girando só de pé) e o sumiço do anel no gizmo são conferência visual no navegador; a matemática do solver, as guardas do store, a persistência e a UI de painel estão cobertas por unidade (20 testes novos).

## 100. A confirmação da troca de sessão vira modal — o `ConfirmDialog` que já existia

**Contexto.** O #98 entregou o "trazer sessão da outra casca" com a confirmação inline em dois passos, no molde do "novo workspace". O usuário pediu a troca para o elemento `<dialog>` — e o pedido caiu em cima de uma peça pronta: o `ConfirmDialog` sobre `ModalDialog` que a confirmação de "Regravar keyframe" tinha criado (2026-07-31), com `showModal` de verdade no navegador (foco preso, `::backdrop`, Esc cancelando), aviso ao `uiStore` para calar os atalhos globais e o caminho degradado para o jsdom já resolvido (o `open` do JSX, porque o jsdom não implementa modalidade).

**Decisão: reusar, não escrever um segundo dialog.** Os dois pontos do item 54 — painel de Cenas no desktop e aba Arquivos no módulo de poses — passaram a renderizar `{isConfirmingBring && <ConfirmDialog .../>}` com título (o próprio rótulo do botão), a mesma mensagem de aviso e o mesmo "Substituir tudo"; o botão de trazer ficou sempre visível, em vez de dar lugar ao bloco inline. A justificativa é a mesma do modal de Regravar: substituir o workspace inteiro não pode ser um aviso espremido entre botões que continuam clicáveis — no modal, o aviso é a única coisa na tela. É o primeiro componente de `layout/` que o módulo de poses monta (ele já importava módulos de lá); a chave órfã `poses.file.bringSessionCancel` saiu dos dois dicionários — o "Cancelar" é o do próprio `ConfirmDialog`.

**Na sequência, o "Novo workspace" foi junto** (pedido do usuário): a confirmação em dois passos da fase 9, item 7 — o molde que o #98 tinha copiado — passou ao mesmo modal, e o painel de Cenas ficou sem nenhum confirm inline. As três ações destrutivas de workspace (limpar tudo, trazer sessão nas duas direções) agora confirmam do mesmo jeito.

## 101. A sessão atravessa o ar: remessa por QR code, sem rede e sem arquivo (item 65)

**Contexto.** O item 54 (#98) resolveu a troca de sessão entre as duas cascas — do MESMO aparelho: as chaves de `localStorage` não atravessam máquinas. O usuário quis o passo seguinte: "trazer toda a animação do desktop para um celular diferente, da maneira mais prática possível, de preferência sem envolver aplicações externas". A avaliação foi antes do código, como sempre: um QR só não carrega uma animação (limite de ~2,9 KB contra ~120 KB de JSON), arquivo por cabo envolve gerenciador e cabo, rede local feriria o "zero rede em runtime". Três decisões confirmadas, todas na recomendação: **sequência de QRs** (o desktop exibe quadros em ciclo, o celular coleta com a câmera), **a sessão inteira viaja** (o formato do item 54, nenhum caso especial), e **leitor nativo com fallback** (`BarcodeDetector` no Android/Chrome, `jsQR` empacotado no iOS/Safari).

**O payload é o do autosave — o transporte é que é novo.** `saveWorkspaceToLocalStorage`/`loadWorkspaceFromLocalStorage` se partiram em `serializeWorkspacePayload`/`parseWorkspacePayload` + a casca fina de `localStorage`: a remessa por QR serializa e sanitiza EXATAMENTE como qualquer restauração (limites articulares antes das poses, bibliotecas pelo funil de sempre), e no destino aplica com o `loadRestoredWorkspace` do item 54 — keyframe corrente zerado, undo limpo, confirmação de "Substituir tudo" (#100). Formato novo, zero.

**O protocolo aposta no deflate.** `qrTransfer.ts`: `CompressionStream('deflate')` nativo (o JSON de workspace repete as mesmas 32 chaves de junta em todo boneco de todo keyframe — encolhe ~10×), base64, fatias de 800 caracteres com cabeçalho `VMQR1|id|índice|total|payload`. O `id` (FNV-1a do base64 inteiro) separa remessas — fatia de outra remessa é ignorada sem derrubar o progresso — e a integridade é o Adler-32 que o formato zlib já carrega: fatia adulterada não infla, e a remontagem devolve `null` em vez de uma sessão corrompida. O coletor aceita fatias em QUALQUER ordem e conta repetição como nada: é assim que uma câmera coleta um ciclo de quadros, e é por isso que quadro perdido não é erro — ele volta na próxima volta. Duas surpresas de implementação ficam registradas: o jsdom não tem `Blob.stream()` (os streams são drenados à mão com `getReader`, escrita e leitura em paralelo para não travar no buffer) e a rejeição do lado da escrita precisa ser marcada como tratada antes de o `drain` rejeitar, ou o erro legítimo de checksum vira "unhandled rejection".

**QR nasce SVG; a câmera decide o caminho uma vez.** No desktop, `qrcode.toString(type: 'svg')` — nítido em qualquer zoom, existe no jsdom (canvas não), e o quadro fica sobre fundo branco fixo mesmo no tema escuro (QR invertido não escaneia em todo leitor). A sessão é fotografada na ABERTURA do modal: editar a cena com ele aberto não muda a remessa (mudaria o id e invalidaria o que o celular já coletou). No celular, `qrFrameReader.ts` escolhe o caminho na criação — detector nativo ou `jsQR` sobre um canvas reaproveitado — e o contrato é "quadro sem QR devolve `null`, nunca lança". O `parseWorkspacePayload` (que instala limites articulares, efeito colateral real) só roda DEPOIS do "sim" do usuário, na mesma ordem do "Trazer sessão do desktop".

**Ressalva de validação:** a coleta com câmera de verdade — foco, moiré de tela, cadência do ciclo (600 ms por quadro contra varredura de 250 ms) — é conferência visual com dois aparelhos; protocolo, remontagem, corrupção, geração dos quadros e os dois modais estão cobertos por unidade. As dependências novas (`qrcode`, `jsqr`) são empacotadas no bundle — o zero-rede proíbe download em runtime, não biblioteca instalada.

## 102. O app muda de nome: Virtual Mockup vira WebPoser, com migração das chaves

**Contexto.** O levantamento de publicação (PLANO.md > "Publicação e monetização", 2026-08-02) apontou "Virtual Mockup" como nome genérico — difícil de marcar, difícil de buscar — e recomendou que um rename viesse ANTES do primeiro endereço público, porque a PWA instalada e o `localStorage` casam com a origem. O usuário decidiu no mesmo dia: o app passa a chamar **WebPoser** (identificadores `webposer`), mantendo o diretório de trabalho local como está.

**O rename não podia apagar sessão de ninguém.** As quatro chaves de `localStorage` carregavam o nome antigo no prefixo — `virtual-mockup:{shell,workspace,poses,ui}:v1` — e trocá-las sem mais nada órfã o autosave das duas cascas, o override de casca e as preferências de painel. A saída é uma **migração de uma vez** (`migrateLegacyLocalStorage`, em `shellChoice.ts`): para cada chave, copia a legada para o prefixo `webposer:` SE a nova ainda não existe (quem já gravou com o nome novo não é atropelado por uma legada mais velha) e remove a legada (duplicar o payload do workspace flertaria com a cota — a mesma que motivou o `MAX_PROPS`). Roda no escopo de módulo do `shellChoice.ts` — o módulo-folha que todo leitor de storage importa primeiro (#92) — e o `main.tsx` o importa como PRIMEIRA linha, de propósito, para a ordem valer também para quem não passa pelo funil do autosave (as preferências de UI).

**O que mudou de nome e o que ficou.** Mudaram: as quatro chaves, o `name` do `package.json` (e do lock), o manifest da PWA, o `<title>`, as duas strings de i18n com o nome à mostra ("WebPoser" na Toolbar e na mensagem de arquivo alheio) e as menções nos quatro documentos canônicos. Ficaram, de propósito: as menções históricas a `extras["virtual-mockup"]` (o bloco do tempo do `.glb` — arquivos antigos REALMENTE tinham essa chave; renomear a história a falsearia) e, obviamente, o prefixo legado dentro da própria migração. O formato de arquivo não tem o nome do app em nenhum campo — nenhum contrato de arquivo mudou.

**Grafia:** `webposer` em identificadores (chaves, package, kebab) e **WebPoser** em texto de exibição (título, manifest, mensagens) — a mesma dupla que "virtual-mockup"/"Virtual Mockup" fazia.

## 103. O primeiro endereço público: GitHub Pages por workflow, com a suíte como portão

**Contexto.** O levantamento de publicação (`PLANO.md` > "Publicação e monetização", 2026-08-02) listou a hospedagem estática gratuita como o caminho 1, o mais barato, e disse que o único trabalho real seria "um workflow de build". O usuário pediu esse workflow, para o GitHub Pages, mencionando o contexto `/webposer`. O rename do #102 tinha acabado de acontecer exatamente por causa da amarra da origem, então a ordem estava certa.

**O `base: './'` já resolvia o "/webposer", e é por isso que ele não mudou.** O repositório se chama `web-poser`, então o Pages padrão serve em `/web-poser/`, não em `/webposer/` — a divergência foi levada ao usuário antes do código. A alternativa seria ler o caminho de uma variável de ambiente no `vite.config.ts` (`base: process.env.VITE_BASE ?? './'`) e fixar `/webposer/` no workflow, o que **exigiria renomear o repositório** e, pior, trocaria uma propriedade por uma configuração: com caminho relativo o bundle funciona em QUALQUER subcaminho — `/web-poser/`, `/webposer/`, um domínio próprio — e continua funcionando dentro da PWA instalada, que é a razão pela qual o `base: './'` existe desde a fase 1. O usuário escolheu manter. Renomear o repositório, se quiser, muda o endereço sozinho e não toca em uma linha de código.

**O portão é a regra do `CLAUDE.md`, não uma invenção do CI.** O job de build roda `npx vitest run`, `npm run lint` e `npm run build` — os três, nessa ordem, antes de o `dist/` virar artefato; o job de deploy tem `needs: build`. É a mesma frase que o projeto aplica a cada entrega ("antes de dar qualquer trabalho por concluído"), agora executada por quem não esquece. O custo é honesto e vale registrar: a suíte leva ~9 minutos nesta máquina, então **publicar deixa de ser instantâneo** — um push na `main` demora perto de dez minutos para chegar ao ar. Foi a escolha consciente do usuário entre esse tempo e o risco de publicar vermelho. O smoke de Playwright ficou de fora, coerente com o lugar que ele já ocupa no projeto: à parte da suíte, rodado por `npm run test:e2e`.

**Detalhes que são decisão, não boilerplate.** O gatilho é `push` na `main` mais `workflow_dispatch` — o histórico do projeto é todo direto na main, e o disparo manual serve para republicar sem commit. A `concurrency` usa `cancel-in-progress: false` de propósito: cancelar um deploy pela metade deixaria o site publicado num estado parcial, e esperar é mais barato que isso. As permissões são as três que o Pages por artefato exige (`contents: read`, `pages: write`, `id-token: write`), sem token pessoal e sem branch `gh-pages` — o artefato vai direto, e o `dist/` continua fora do versionamento.

**Publicar não fere o zero-rede.** Vale deixar escrito, porque a regra é de topo: a rede entrega o bundle **uma vez**; a partir daí o service worker serve tudo do cache, e o app roda offline como sempre rodou. O que a publicação acrescenta é a exigência de HTTPS (service worker e `getUserMedia` da remessa por QR só existem em contexto seguro) — que o Pages atende de graça, e que era um dos dois pré-requisitos técnicos anotados no levantamento.

**Ficou em aberto na hora, e foi resolvido em seguida:** o repositório não tinha `LICENSE` — o levantamento já apontava isso como a maior decisão pendente da publicação, e ela foi tomada no mesmo dia (#104, MIT).

### 103.1. O `package-lock.json` tem de ser gerado no Linux

A primeira rodada morreu no `npm ci`: `Missing: @emnapi/core@1.11.3` e `@emnapi/runtime@1.11.3 from lock file`. Não era lock desatualizado — apagá-lo e regerá-lo no Windows produzia **exatamente o mesmo arquivo defeituoso**, e `npm install --package-lock-only` sobre o lock existente relatava zero mudanças.

**A causa.** `@napi-rs/wasm-runtime` declara `@emnapi/core` e `@emnapi/runtime` como **peer dependencies**. Ele entra no grafo por `@rolldown/binding-wasm32-wasi` — o fallback WebAssembly do rolldown (Vite 8), pacote `optional` marcado `cpu: ["wasm32"]`. No Windows o npm não desce nesse ramo e nunca hoista os dois peers; no Linux ele desce, calcula a árvore ideal com os dois no topo, e o `npm ci` — que é estrito por contrato, e é por isso que se usa ele — recusa o lock que não os tem. O `npm install` local nunca reclamou porque ele é tolerante e o `node_modules` em disco já tinha tudo.

**O que NÃO resolve:** `npm install --package-lock-only --os=linux --cpu=x64 --libc=glibc`. Esses flags trocam a seleção de **binários** por plataforma, não a resolução de **peers** — o lock saiu diferente e continuou sem as duas entradas.

**O que resolve:** gerar o lock dentro do Linux (`docker run --rm -v "$PWD:/app" -w /app node:24 npm install --package-lock-only`). O arquivo resultante traz `node_modules/@emnapi/runtime` hoisted, **preserva as 6 entradas de `binding-win32`** (o desenvolvimento no Windows continua intacto — `npm ci --dry-run` local passa) e não move nenhuma dependência da aplicação: o diff é de 112 linhas, todas no canto `emnapi`/`fsevents`, mais `@napi-rs/wasm-runtime` de 1.1.6 para 1.2.2. Verificado em container antes de subir — `npm ci` no Linux instalou 598 pacotes, exit 0 —, e confirmado em campo na rodada seguinte, que atravessou instalação, suíte, lint e build.

**A invariante que fica:** rodar `npm install` no Windows e commitar o lock quebra o CI de novo, silenciosamente, porque nada avisa localmente. Toda vez que o lock mudar, ele tem de ser regerado no Linux.

### 103.2. O que faltava era habilitar o Pages no repositório

A rodada seguinte parou no `actions/configure-pages@v5` com "Get Pages site failed / Not Found". Não era erro de workflow: o Pages simplesmente **nunca tinha sido habilitado** no repositório, e a ação consulta a API para descobrir a URL base de um site que não existia. **O que destravou foi ligá-lo em `Settings > Pages`, com a origem em `GitHub Actions`** — o passo que o próprio #103 já anotava como pendente e que o workflow não alcança sozinho na primeira vez.

O `enablement: true` ficou no `configure-pages` como rede de segurança: ele liga o site pela API usando a permissão `pages: write` que o workflow já declara, e é idempotente depois de o site existir. Serve para quem clonar o projeto e não ler este arquivo; não substitui a visita à interface como caminho garantido.

**Rota descartada: publicar numa branch `gh-pages`.** Chegou a ser escrita — build empurrado como branch órfã por git puro, sem ação de terceiros — e foi desfeita porque o problema já estava resolvido e ela não resolvia nada a mais. Fica o registro do porquê ela não convive com o que existe: o Pages serve de **uma fonte só**, "GitHub Actions" ou "Deploy from a branch". Com a fonte na branch, o `deploy-pages@v4` passa a falhar; com a fonte em Actions, o push para a `gh-pages` funciona mas não é o que serve o site. Dois publicadores no mesmo workflow se atropelam — se um dia a rota por artefato incomodar, a troca é substituir, nunca somar.

*(A mensagem "Node 20 is being deprecated" que aparece no log é informativa e não vem daqui: é o runtime das próprias ações, não o `setup-node` do job, que já está em 24.)*

## 104. Licença MIT — a última pendência da publicação

**Contexto.** O levantamento de publicação (`PLANO.md` > "Publicação e monetização", 2026-08-02) apontava a licença como "a maior decisão em aberto desta seção" e como pré-requisito de qualquer endereço público: o repositório não tinha `LICENSE`, e código sem licença não é código aberto — é código sem permissão nenhuma, em que ninguém pode legalmente copiar, modificar ou redistribuir. Com o workflow do Pages (#103) prestes a tornar o repositório visível, a pendência virou bloqueio. O usuário decidiu: **MIT**.

**O que a escolha permite e o que ela custa.** A MIT é a permissiva mais curta e mais conhecida: qualquer um pode usar, copiar, modificar, distribuir e **vender** o software, com uma condição só — manter o aviso de copyright e a licença. Em troca, a garantia é zero. O custo honesto é que ela **autoriza o fork comercial**: alguém pode pegar o WebPoser, mudar o nome e cobrar por ele, sem devolver nada. Uma copyleft (GPL) impediria isso ao obrigar o derivado a abrir o código também — e foi exatamente por ser GPL-3.0 que a `mannequin.js` foi descartada no início do projeto (#5), o que torna adotá-la aqui uma incoerência de tom.

**Por que ela não briga com a monetização levantada.** Dos seis modelos do `PLANO.md`, cinco convivem sem atrito com código aberto, porque nenhum deles vende *acesso* ao software: doação, pague-o-quanto-quiser no itch.io, preço nas lojas (onde se vende a conveniência do empacotamento), **packs de conteúdo** — que são arquivos JSON, não código, e portanto ficam de fora da licença do software — e licença educacional, que é contrato de serviço. O único incompatível é o 6, o freemium com chave local; e o próprio levantamento já o registrava como última opção, com a ressalva de que código no navegador é inspecionável de qualquer forma. Ou seja, a MIT não fecha nenhuma porta que já não estivesse encostada.

**Compatibilidade das dependências, conferida e não presumida.** As doze dependências de runtime são MIT (React, React DOM, three, `@react-three/fiber`, `@react-three/drei`, zustand, zundo, i18next, react-i18next, `qrcode`), Apache-2.0 (`jsqr`) e MPL-2.0 (`mediabunny`). Todas distribuíveis dentro de um produto MIT: a MPL-2.0 é copyleft **fraco e por arquivo** e, com a biblioteca usada sem modificação, não alcança o nosso código — a avaliação que aprovou a `mediabunny` já tinha registrado isso, e continua valendo.

**O aviso de copyright.** `Copyright (c) 2026 Fernando Tsuda`, inferido do `user.email` do git; o nome legal é a única coisa aqui que pode precisar de correção, e é uma linha. O `package.json` ganhou `"license": "MIT"` (o `"private": true` fica, para impedir publicação acidental no npm) e o `README.md`, uma seção de licença com o quadro das dependências.

## 105. O lote dos baratos: itens 53, 55, 35, 19, 8, 52 — e a revisão de sombras do 17

O usuário mandou implementar os blocos 1 a 3 da ordem sugerida para as pendências do `PLANO.md` (2026-08-02). Este é o bloco 1 — sete itens pequenos, cada um com uma decisão que valia registrar:

**Badge de autosave no módulo (item 53).** Nenhuma string nova: o badge do `PosesTopBar` reusa as MESMAS chaves `toolbar.autosave*` da Toolbar, porque o estado é o mesmo `uiStore` — o módulo grava na chave própria (#92), mas o hook `useWorkspaceAutosave` é compartilhado. Numa barra de celular a frase não cabe: o badge é um ponto colorido (pendente/salvo/falha), e a frase vira o nome acessível e a dica de toque.

**Aba Arquivo aceita pose avulsa (item 55).** Exatamente o que o item previa: `parseFigurePoseFile` (#81/#87) já aceitava a família inteira de formatos — o botão "Aplicar pose do arquivo" só liga o leitor ao `applyImportedFigurePose` do boneco em edição. Desabilitado sem boneco em edição (a pose precisa de destino); as mensagens de erro são as mesmas do desktop (`errors.importNoPose`/`importUnreadableJson`).

**Filtro na lista de poses (item 35).** Busca por trecho do nome, sem caixa e SEM ACENTO ("em pe" acha "Em pé") — a normalização mora num módulo mínimo (`layout/poseFilter.ts`), travada por teste fora do render. Duas decisões de comportamento: a opção ESCOLHIDA nunca é filtrada para fora (um `<select>` cujo valor não está entre as opções fica em branco no meio da digitação) e grupo sem sobrevivente some inteiro. O filtro vale para presets e biblioteca de uma vez.

**Reordenar cenas e animações salvas (item 19).** Um helper só (`moveById`, no `figuresStore`) serve ao catálogo de cenas e à biblioteca de animações — como o item previa ("vale fazer os dois com o mesmo código"). Reordenar é conteúdo: entra no undo. Na biblioteca, o movimento acontece SÓ entre as salvas — a lista é remontada com a de trabalho de volta na posição absoluta em que estava, porque ela não é da biblioteca e o combo nem a lista. Nas bordas os botões desabilitam, na linguagem dos keyframes.

**Modo silhueta (item 8).** Preto chapado por `meshBasicMaterial` (sem luz) em TODAS as peças, inclusive olhos e pino da mão — silhueta é silhueta. Três decisões: os destaques emissivos (seleção/trava/âncora) SOMEM no modo (uma mancha amarela dentro do preto desfaria a leitura chapada que o modo existe para dar), o fantasma do papel-cebola VENCE a silhueta (ele é referência translúcida), e a elipse de contato fica de fora (não é corpo). É modo de visualização no regime da casca (#81): checkbox na Toolbar, preferência de tela persistida (`figureSilhouette`), fora do undo e fora do arquivo — e vale para o PNG e o MP4, porque é o material que a cena inteira usa.

**Poses de partida na aba Boneco (item 52).** A revisão consciente que o item pedia foi decidida pelo usuário ao mandar implementá-lo: o plano original tirou os presets da Lite, mas montar pose do zero no celular sem ponto de partida é trabalhoso. O combo usa o MESMO catálogo e os MESMOS rótulos do desktop — os mapas `POSE_PRESET_LABEL_KEYS`/`_HINT_KEYS`/`_GROUP_LABEL_KEYS` saíram do `PropertiesPanel.tsx` para `layout/posePresetLabels.ts`, porque duplicá-los seria uma cópia a divergir (as chaves de i18n ficam sob `panels.properties.*`, que é onde as traduções já moram). Sem o pareamento automático de dupla: montar par é assunto do desktop.

### A revisão do item 17 achou outra coisa: o boneco nunca projetou sombra

O item perguntava se a elipse de contato e a sombra real do shadow map juntas atrapalham a leitura. O levantamento mostrou que a pergunta partia de uma premissa falsa: **as peças do boneco nunca tiveram `castShadow`** — a sombra "real" sob um boneco simplesmente não existia. Só os objetos de cena (item 42) projetavam, o que dava uma cena inconsistente: um cubo com sombra ao lado de um boneco flutuando sem nenhuma. E a tabela de arquitetura do plano sempre prometeu "luz direcional com sombra suave (sombra ajuda a ler a posição espacial)".

A correção é a resposta do item: `castShadow` nas peças e ossos do boneco (o fantasma do papel-cebola não — referência não faz sombra; o `Canvas` já tinha `shadows`). As duas marcas agora COEXISTEM de propósito, porque dizem coisas diferentes: a elipse colorida é indicador de colocação/altura preso ao chão (decisão antiga, deliberada), a sombra cinza suave comunica volume e contato. **Falta a conferência visual no navegador** — se em alguma pose as duas brigarem, a válvula barata é um toggle da elipse, anotado como possibilidade e não construído.

## 106. Easing por trecho — a maior lacuna da animação (item 26)

O item dizia, e o leiame do `animations.json` documentava: com `t` linear, "a velocidade é constante dentro de cada trecho e muda em cada keyframe" — todo movimento parte e para de repente, e a câmera quebra visivelmente em cada keyframe. O conserto é exatamente o que o item previu: uma função pura `t → t'` aplicada ANTES de `blendFigure`/`interpolateCameraView`, sem mexer em nenhum mecanismo de interpolação.

**O modelo.** `AnimationKeyframe.easing?: 'linear' | 'easeInOut' | 'easeIn' | 'easeOut'` — a curva da transição que CHEGA ao keyframe, a mesma convenção da duração (e ignorada no primeiro pelo mesmo motivo). As curvas são as clássicas de custo zero: smoothstep `t²(3−2t)`, `t²` e `1−(1−t)²`, todas fixando as pontas EXATAS — é o que preserva o contrato "keyframe idêntico nas pontas" do amostrador. Bonecos e câmera andam pelo MESMO `t` remapeado, senão cena e enquadramento dessincronizariam.

**Campo aditivo, e 'linear' nunca é gravado.** Arquivo antigo sem o campo e arquivo novo em linear são a mesma coisa; a sanitização aceita só as quatro curvas conhecidas e descarta o resto sem invalidar o keyframe (easing é ajuste de movimento, não conteúdo do retrato). Escolher "Linear" no painel REMOVE o campo. Sem bump de versão — o precedente de sempre (`snapshotCounter`, `label`).

**A decisão embutida do item, resolvida pela saída honesta.** Com easing, o "Inserir keyframe aqui" (#54) deixa de ser invisível: duas metades reinterpoladas não reproduzem uma curva suave. Das duas rotas registradas no plano (repartir a curva por subdivisão × assumir linear e avisar), ficou a segunda — barata e honesta. Concretamente: o retrato guardado é o do instante SUAVIZADO (o que a animação de fato mostrava ali, inclusive a câmera do `splitCameraView`, cortada no `t` remapeado), e as DUAS metades assumem linear. O aviso aparece na barra da linha do tempo antes de inserir, quando o trecho sob o playhead tem suavização — visível, não só no `title`.

**O easing viaja nos trechos salvos.** A sinergia "39 × 26" anotada no plano se confirmou: `SavedClipStep` ganhou o campo, a captura o copia, a sanitização do `clips.json` o aceita e a inserção o devolve ao keyframe. Os trechos de fábrica (declarativos) continuam sem easing — são formatos distintos de propósito (#65).

**Na UI:** um combo "Suavização" por card de keyframe, ao lado da duração e com a mesma regra (o do primeiro keyframe desabilitado). Cinco chaves de i18n nos dois dicionários.

## 107. A dívida do viewport: redesenho sob demanda (item 21) e a matemática de arrasto extraída (item 58)

**`frameloop="demand"` (item 21).** Num app de poses estáticas, o loop contínuo do R3F era gasto puro de CPU/GPU e bateria com a cena parada — e virou mais urgente com o app publicado como PWA instalável (#103). O custo do item sempre foi a AUDITORIA, não a linha; ela está registrada como comentário no próprio `Canvas` e aqui: OrbitControls/TransformControls do drei invalidam sozinhos no `change`; a reprodução de animação escreve `preview`/`timeMs` no store a cada tick de rAF próprio, e o commit React resultante invalida o quadro; o `CameraRig` aplica vistas em efeitos disparados por re-render (o commit que o disparou já invalidou); os `useFrame` idempotentes (DepthPreview, gizmos que se realinham) rodam em todo quadro DESENHADO, e o que os alimenta só muda por estado React; captura de PNG e exportação de MP4 renderizam por conta própria (`gl.render`), fora do loop. Nenhum ponto precisou de `invalidate()` manual. **Escopo deliberado: só o `Viewport` do desktop** — o viewport do módulo de poses tem pan/zoom e gizmos próprios com outra dinâmica de invalidação, e entra como melhoria separada se a medição em aparelho pedir. Falta a conferência visual no navegador (órbita, arrasto de gizmo, reprodução, captura e vídeo com a cena parada entre eles).

**`posesDrag.ts` (item 58).** O `PosesViewport` concentrava arrasto planar, arrasto por eixo, gesto de torção e gizmo — e a parte geométrica ficava fora do alcance de unit test, como o próprio arquivo ressalvava. A extração separou o que é função pura: `dragTargetForPointer` (as três formas do mesmo arrasto — seta do gizmo, plano da tela na Livre, plano da vista travada — na ordem de especificidade), `draggedRootPosition`, e a máquina de estados do gesto de dois dedos (`TwistTracker`: o gesto só vence a câmera após `TWIST_DECIDE_DEG` acumulados, e ao vencer o acumulado sai inteiro, para o começo do giro não se perder). O componente ficou com a cola — eventos, refs, stores — e o comportamento foi preservado ponto a ponto, inclusive o detalhe de o ponteiro continuar rastreado quando não há junta torcível selecionada. Oito testes novos cobrem o que antes era só conferência visual; o arrasto REAL continua coberto pelo smoke de Playwright (#95).

## 108. Amarração de objeto a junta e o kit de armas — movimento emprestado, cenário intacto

O pedido (PLANO.md > "Objetos pré-modelados e amarração a juntas") parecia brigar com a decisão de topo nº 2 dos objetos de cena — "cenário não anda, não entra no retrato dos keyframes" (#80) — e o parecer já tinha mostrado que não briga: **amarração é DERIVAÇÃO, não conteúdo de keyframe**. O objeto ganhou `attachment: {figureId, jointName, position, rotation} | null`, e a colocação em mundo do amarrado é *calculada* a cada commit a partir do frame da junta (`propAttachment.attachedPropPlacement`, sobre `buildJointFrames` — derivação pura, sem procurar grupos `joint-*` na cena, para valer igual no desktop, na exportação e em qualquer casca). O keyframe continua gravando só bonecos + câmera; a espada acompanha a reprodução e o MP4 porque quem anda é a mão. As cinco dúvidas do parecer foram respondidas pelo usuário antes de codificar, todas na recomendação:

- **Remover o boneco devolve o objeto à própria colocação** — `position`/`rotation` do objeto NÃO mudam ao amarrar; são o endereço de retorno. O oposto deliberado é o **soltar manual**, que grava a colocação de mundo no objeto (ele fica onde está): sumir com a espada porque o boneco saiu seria efeito colateral; teleportá-la porque o usuário clicou "Soltar" seria pior.
- **O gizmo normal edita o offset.** `setPropPosition`/`setPropRotation` recebem a intenção em MUNDO (é o que o `TransformControls` produz) e, no amarrado, convertem para offset relativo à junta (`placementToAttachmentOffset` — a inversa, com ida-e-volta travada por teste). O `SceneProps` não precisou de um caminho novo de gizmo. No painel, os fieldsets de posição/rotação passam a editar o offset, e a legenda diz isso.
- **O offset passa pela escala de altura** (o `matrixWorld` da junta a carrega): a espada continua na mão do boneco de 1,90 m. O TAMANHO do objeto, nunca — metro é metro (#80); por isso a orientação sai por `getWorldQuaternion`, que descarta escala.
- **Compostas têm tamanho por eixo em metros, sem vértice livre** (`propShapeHasFreeVertex`): esticar a lâmina é feature, mas o modelo é íntegro — desvio gravado para composta é descartado na leitura, a ferramenta de vértices desabilita e as alças não são renderizadas. A contagem de pontos soldados delas (espada 181, escudo 119, bainha 34) entrou no teste de contrato como as demais, mas serve à MEDIÇÃO (apoiar no chão), não a alças.
- **Kit inicial: espada, escudo e bainha** — composições de primitivas fundidas em código (`mergeGeometries`), mesma regra do boneco: nada de asset externo. Moto e animais rígidos ficam para quando doerem; articulados continuam proposta separada. `MAX_PROPS = 20` de pé.

Miudezas que valeram decisão: a **cópia de objeto amarrado nasce solta** (duas espadas no mesmo offset se sobrepõem perfeitamente — invisível e inútil); **"Apoiar no chão" vira no-op no amarrado** (quem manda é a junta); e o `SceneProps` — que ignorava o preview da animação de propósito, por "cenário não anda" — passou a ler `preview?.figures ?? figures` **só para derivar a colocação dos amarrados**, o mesmo boneco que o `SceneFigures` desenha; sem isso a espada pararia no play e sairia errada no vídeo (armadilha achada na exploração, agora travada por teste de render). Persistência aditiva em `PropExtras.attachment`, sem bump de versão; a sanitização valida a junta contra `JOINT_NAMES` e o boneco contra os da MESMA cena (por isso os bonecos são lidos antes dos objetos no `sceneFromExtras`), e amarração órfã é PODADA — o objeto abre na própria colocação, que é exatamente o comportamento de remover o boneco. Espelho, sorteio e travas não ganharam caso especial: a amarração referencia a junta, e a junta é quem se move.

## 109. Pose por imagem, etapas 1–2 — o retargeting testado por ida-e-volta e a CLI `pose:from-image`

Da proposta "MCP de análise de pose", o usuário escolheu o primeiro corte: **só imagem → pose** (etapas 1–2; vídeo e a casca MCP ficam para cortes seguintes), rodando em **Node/wasm** (uma língua só), morando em **`tools/` + `src/` do próprio repositório** (fonte de verdade única do esqueleto) — e, contra a recomendação, **multi-pessoa já**: a CLI detecta até N pessoas e grava um arquivo de pose por pessoa.

**O núcleo (`src/pose-import/retarget.ts`) é puro e mora em `src/`, no padrão `poseCodegen`:** a CLI é boba. A estratégia de teste é a aposta da entrega: **ida-e-volta pela cinemática direta do próprio app** — uma pose conhecida vira landmarks sintéticos do BlazePose (posições de mundo das juntas via `buildJointFrames`, convertidas para o espaço do MediaPipe), e o retargeting tem de recuperar os ângulos que a geraram. T-pose recupera os ombros a ±90°, cotovelo dobrado recupera a flexão exata, agachamento recupera quadris e joelhos, boneco de costas recupera a raiz — se o esqueleto mudar, a fixture muda junto e o teste continua honesto. Por junta: raiz e tronco viram FRAMES ortonormais (linha dos quadris; linha dos ombros dividida meio a meio entre `spine` e `chest`); membros viram rotação de menor arco sobre a direção de repouso, e quando a articulação do meio está dobrada o PLANO do membro alinha o eixo da dobradiça antes de a flexão sair por `atan2`; punho resolve flexão+desvio pelo meio da mão (índice+mindinho). Tudo passa por `clampJointRotation` — DOF que a junta não tem é forçado a zero, e o filho é resolvido contra o que FICOU depois do grampo. **O que os landmarks não contam fica neutro e vira aviso impresso**, não silêncio: torção do antebraço (`NEUTRAL_ELBOW_TWIST`, #25), dedos (mão aberta), detalhe da coluna, altura (1,70 m).

**A conversão de espaço foi validada contra o MediaPipe real, não só contra a fixture:** world landmarks são y-para-baixo e z-para-a-câmera, origem entre os quadris; a conversão é `(x, −y, −z)` — e o X fica porque a esquerda de quem encara a câmera aparece em +X na imagem, exatamente onde `hip.L` mora quando o boneco encara +Z. Testada com duas fotos reais: numa foto de corpo inteiro a pose sai um rascunho utilizável (com o tronco ~30° inclinado pelo ruído de profundidade monocular que o plano previu — é rascunho para refinar, por desenho); numa foto adversarial (pernas ocultas, contraluz), o MediaPipe inventa quadris na altura do nariz *com visibility 1,0* — ou seja, o `visibility` não é confiável em oclusão, e o rascunho ruim é inevitável; os avisos por membro oculto cobrem o caso detectável.

**A CLI (`tools/pose-from-image.mjs`) não abre exceção no zero-rede:** o wasm do MediaPipe vem do `node_modules` (devDependency nova, `@mediapipe/tasks-vision` — a primeira dependência de ML do projeto, fora do bundle do app), o modelo `.task` (9 MB, Apache 2.0) é baixado UMA vez por um script separado e explícito (`npm run pose:model`, gitignored em `tools/models/`), e a página headless é servida inteira por interceptação de rota do Playwright — nenhuma requisição sai. O Chromium é o mesmo regime do `folha-de-contato.mjs` (resolvido de fora, não imposto no `npm install`). A saída é o formato "Pose em arquivo" (#86/#87) via `serializeFigurePoseFile` — entra pelo caminho de importação que já sanitiza tudo, no desktop e no módulo de poses (item 55). A devDependency nova obrigou o rito do lock (#103.1): regenerado no docker `node:24`, entradas `binding-win32` conferidas.

## 110. Setas do gizmo de translação do módulo de poses dobradas — alvo de dedo, travado por teste

O usuário reportou da prática: as setas do gizmo da vista Livre (#93) eram alvo difícil no touch. As medidas dobraram — haste (0,18 → 0,36 m de comprimento, raio 0,006 → 0,012), ponta (raio 0,02 → 0,04) e, o que importa para o dedo, o **cilindro invisível de toque** (raio 0,045 → 0,09, comprimento 0,3 → 0,6), tudo antes da reescala por distância do item 48, que continua a valer. As medidas saíram dos literais espalhados para um objeto `ARROW` nomeado no próprio componente.

O que mudou de regime: **o tamanho virou contrato testado**. O `FreeViewGizmo` passou a ser exportado (só para teste), e `posesGizmo.test.tsx` trava os MÍNIMOS — pelo menos o dobro do original em haste, ponta e alvo de toque — porque encolher de volta num refactor seria regressão de usabilidade silenciosa, não ajuste estético. O arrasto em si continua fora do alcance de unit test, como sempre (#31.5).

Efeito colateral aceito: os anéis gimbal (item 60, `RING_RADIUS_M = 0.14`) continuam "por dentro das setas", agora com folga bem maior — ficou proporcionalmente menor que antes ao lado das setas novas. São só leitura e não foram tocados; se a conferência no aparelho pedir, engordam em ajuste próprio.

## 111. Pose por marcação manual — a foto de referência (item 7), o root como âncora e a profundidade que sai do encurtamento

A proposta (PLANO.md > "Pose por marcação manual") nasceu como complemento do `pose:from-image` (#109): onde o MediaPipe erra calado — na foto adversarial do #109 ele inventou quadris na altura do nariz *com `visibility` 1,0* — o olho humano não erra. E roda no celular, onde a CLI (Playwright + modelo de 9 MB) nunca vai rodar. As dúvidas foram respondidas antes de codificar; três desenhos merecem registro:

**O root é ÂNCORA, não inferência (sugestão do usuário, melhor que a proposta original).** Em vez de derivar a raiz da linha dos quadris marcada — que numa foto em 3/4 é encurtada pela perspectiva e enganaria a conta —, o usuário ALINHA o boneco à foto (posição e rotação, com as ferramentas de sempre) e a inferência trata esse alinhamento como dado: devolve SÓ pose, nunca toca a colocação (`applyInferredPose`, que também respeita juntas travadas, #42). Isso eliminou o toggle "de costas" (a rotação do root já diz para onde a pessoa encara — há teste de boneco de costas marcado de frente) e transformou a maior fraqueza do 2D — a orientação — em decisão consciente de quem posa. O solver junta a junta é o MESMO do retarget, extraído para `poseSolver.ts`: frames ortonormais no tronco, menor arco + plano do membro, `atan2` nas dobradiças — landmarks do BlazePose e toques do usuário são só duas origens de pontos.

**A profundidade é opt-in por marcador, e sai do ENCURTAMENTO.** Um toque dá `(x, y)`; o primeiro corte é a pose no plano da vista (a base right/up vem da câmera viva, registrada por uma ponte de módulo — `viewportViewBasis` — nas duas cascas). Quem quiser tirar um ponto do plano marca "à frente"/"atrás": o comprimento real do osso o esqueleto conhece, a foto mostra a projeção, e `dz = √(L² − proj²)` — o sinal é o estado do marcador. A escala foto→metro sai da MEDIANA das razões osso-2D/osso-real (robusta a um membro encurtado), o cálculo anda pai→filho na cadeia (o punho "à frente" mede contra o cotovelo já levantado), e encurtamento dentro do ruído (<5% do osso) vira aviso em vez de profundidade fantasma. Uma correção real no solver saiu daqui: com dados contraditórios (ponto levantado sem o vizinho), o alinhamento de plano escolhia o frame girado 180° em torno do osso e o grampo mutilava a decomposição — agora, entre as duas orientações do plano, fica a mais próxima do menor arco.

**A foto é papel vegetal POR CIMA, e o modo de marcação engole os toques.** Camada DOM sobre o viewport (regime do `FrameMaskOverlay`): nunca sai no PNG/MP4, não briga com o dono único do fundo (#91), e com `pointer-events: none` fora da marcação — órbita e seleção atravessam. No modo de marcação a camada vira `pointer-events: auto` e é ISSO que congela câmera e boneco durante as marcas, sem tocar em nenhum controle: o alinhamento root↔foto fica protegido por construção. As marcas são coordenadas normalizadas DA FOTO (não do contêiner) — redimensionar a janela move a foto e as marcas vão junto. Estado inteiro em store de sessão próprio (`referenceImageStore`, compartilhado pelas cascas — a foto sobrevive à troca desktop↔módulo): fora do undo, do arquivo e até do `localStorage`, com object URL revogado na troca; o que persiste é o RESULTADO. Sequência guiada de 13 pontos obrigatórios + 3 opcionais (tronco e raiz não se marcam — a raiz é o alinhamento, o tronco sai das linhas de ombros e quadris), controles num componente só (`ReferencePhotoControls`) usado pela seção "Foto de referência" do painel de Propriedades e pela aba "Foto" do módulo. Avisos como CHAVES de i18n — a CLI imprime em português, a UI traduz; cada chamador fala com o usuário na língua dele.

## 112. Zoom e deslocamento da foto de referência — gestos nos dois modos, e a marca que só se confirma na soltura

Pedido do usuário, um dia depois do #111: dar zoom e mover a foto de referência. A avaliação prévia mostrou que o pedido é **ajuda visual pura** — as marcas são normalizadas à foto (vão junto com qualquer transformação, sem conversão) e a inferência só usa direções entre marcas (nem percebe). As duas dúvidas de interação foram perguntadas antes de codificar: **gestos + slider** (contra as alternativas só-gesto e só-painel), e **os gestos valem também DURANTE a marcação** — marcar punho e tornozelo com precisão no touch pede zoom na hora, sem sair do modo.

**A vista é matemática pura num módulo próprio** (`scene/referencePhotoView.ts`): o retângulo "contain" de sempre vira base, o zoom amplia em torno do centro dele e o deslocamento é guardado em FRAÇÕES do base (não em pixels) — redimensionar a janela muda o base e a foto fica no mesmo lugar relativo, o mesmo raciocínio das marcas. `zoomPhotoViewAround` mantém fixo o pixel sob o ponteiro (roda e pinça ampliam "para onde se aponta"), e o grampo de deslocamento cresce com o zoom (±(0,5 + zoom/2)): dá para levar qualquer canto ao centro, e a foto nunca se perde sem volta — e há o "Recentrar" de toda forma. Zoom entre 0,25× e 8×; o slider do painel é em **log2** (o passo perceptivo de 50% para 100% é o mesmo de 200% para 400%). A vista mora no `referenceImageStore` com o resto do estado da foto — sessão pura, zerada ao trocar de foto (o enquadramento era DAQUELA foto).

**Um modo novo, "Ajustar foto", irmão do modo de marcação e exclusivo com ele.** Fora dos modos a camada continua `pointer-events: none` (órbita atravessa); em qualquer um dos dois ela engole os toques e congela a câmera — no ajuste, arrastar com um dedo move a foto; nos DOIS, pinça e roda ampliam. A exclusividade é do sentido dos toques: um dedo ou é "mover a foto" ou é "colocar marca", nunca a ambiguidade. `touch-action: none` nos dois modos, senão o navegador fica com a pinça (zoom da página) antes de nós; a roda é ouvinte nativo com `passive: false`, senão o `preventDefault` não segura a rolagem.

**O efeito colateral que virou desenho: a marca deixou de nascer no `pointerdown`.** Descer o dedo pode ser o começo de uma pinça — se a marca nascesse ali, todo zoom de dois dedos deixaria uma marca órfã do primeiro dedo. O toque agora se confirma na SOLTURA de um dedo parado (deslocamento < 8 px); segundo dedo ou arrasto cancelam o candidato. A pinça é incremental por evento (zoom pela razão das distâncias em torno do ponto médio, deslocamento pelo movimento do ponto médio), lendo a vista SEMPRE do store — closure velha durante um gesto contínuo aplicaria deltas sobre estado passado.

## 113. A sequência de marcação agrupada por membro — alternar lados confundia

Da prática do usuário com a marcação (#111): a ordem original alternava esquerda/direita (ombro E, ombro D, cotovelo E, cotovelo D…), no espelho da lista de landmarks do BlazePose — e alternar lado a cada toque obriga a reencontrar a pessoa na foto a cada ponto. A ordem nova percorre **um membro inteiro de cada vez**: cabeça (com o nariz opcional logo junto), braço direito, braço esquerdo, perna direita, perna esquerda — direito antes do esquerdo, como o usuário pediu (o L/R segue sendo o DA PESSOA na foto). O olho anda uma cadeia contínua: ombro → cotovelo → punho.

Duas dúvidas foram perguntadas antes: **pescoço não ganhou ponto** — o usuário o citou na ordem, mas a direção do pescoço já sai do centro dos ombros para a marca da cabeça, e um toque a menos vale mais que a precisão marginal; e o **"pé duplicado" era a ponta do pé** — cada pé tem tornozelo (obrigatório) e ponta do pé (opcional, é o que dá a inclinação), e na ordem antiga os quatro pontos chegavam amontoados no fim da fila, parecendo repetição. A ponta do pé ficou, mas **agrupada na própria perna**, logo após o tornozelo dela — o agrupamento desfez a impressão de duplicação sem perder a inclinação do pé.

Só a ORDEM mudou: a inferência não olha a sequência (recebe o mapa de marcas), e nada mais depende dela além da fila guiada e da numeração dos marcadores. O teste da sequência deixou de conferir só tamanho e primeiro item e passou a travar a ordem INTEIRA — ordem guiada é UX decidida pelo usuário, não detalhe de implementação.

## 113.1. A base do pescoço entra como marca — o prumo do tronco vira o eixo primário

No #113 o pescoço tinha ficado de fora (recomendação aceita: a direção pescoço→cabeça já saía dos ombros, e um toque a menos valia mais). O usuário voltou com um motivo NOVO, que muda a conta: **a rotação do tronco**. E ele tem razão numa fraqueza real do solver: o frame do tronco nascia com a LINHA DOS OMBROS como eixo primário (`quatFromAxes(shoulderAxis, up)` — o prumo era só ortogonalizado contra ela). Na foto, o ombro se marca no trapézio/deltoide, não na junta — um ombro marcado um pouco mais alto ROLAVA a coluna inteira, e o prumo (quadris→centro dos ombros) herdava qualquer assimetria de marcação.

**Com a base do pescoço marcada, os papéis se invertem:** o prumo passa a ser quadris→pescoço — a coluna de verdade, num ponto que se marca sem ambiguidade — e vira o eixo primário do frame; a linha dos ombros é projetada no plano perpendicular a ele e só informa a TORÇÃO em torno do prumo. Cada dado passa a mandar no seu próprio DOF: o desnível de ombros (encolhida, ruído de marcação) deixa de vazar para a inclinação da coluna. O teste que trava isso é o do cenário real: ombro esquerdo marcado 0,05 acima — com o pescoço, a coluna fica reta (< 0,5°); sem ele, rolava > 3°. A direção pescoço→cabeça também melhora de graça (`head − neck` em vez de `head − shoulderCenter`).

**Obrigatória, por decisão do usuário na pergunta** (contra a alternativa pulável): é a única marca que ancora o prumo, e opcional seria pulada justamente nas fotos difíceis (3/4, tronco torcido), onde o fallback pelos ombros mais erra. Sem a marca no mapa (poses antigas, marcação parcial), a inferência cai no comportamento anterior — centro dos ombros como prumo e eixo dos ombros primário, sem projeção. O `solveTorso` do `poseSolver` NÃO mudou (o retarget continua ombros-primário: landmarks do MediaPipe não têm o problema do deltoide); a projeção é do chamador. Na fila, a marca entra entre o grupo da cabeça e o braço direito — de cima para baixo, como o usuário pediu no #113 ("cabeça, pescoço, braço direito…"). São 17 pontos, 14 obrigatórios.

## 114. Vídeo como referência — o mesmo papel vegetal, com o frame no lugar do tempo

O pedido: usar vídeo como referência com os mesmos recursos da foto (transparência, posicionamento, zoom) e frame a frame para avançar/retroceder — mantendo a foto. A avaliação (PLANO.md > "Vídeo como referência") confirmou o barato: **vídeo é um `kind` a mais da MESMA referência**, não um recurso paralelo. O `<video>` entra por object URL de arquivo local (zero-rede — quem decodifica é o navegador, nenhum byte sai), ocupa o MESMO retângulo transformado do `referencePhotoView` (opacidade, zoom e deslocamento valeram sem mudar uma linha da matemática), continua DOM por cima do viewport (nunca sai no PNG/MP4) e é só sessão. A marcação e a inferência operam sobre o frame parado sem saber a origem — e as marcas são MANTIDAS ao trocar de frame, de propósito: o fluxo de animação é marcar → inferir → gravar keyframe → avançar frames → arrastar as marcas (deltas pequenos) → inferir de novo. É a versão manual, de celular, da etapa 3 do MCP de pose (#109), sem o modelo de 9 MB.

**O frame não existe na API — só o tempo.** Avançar/retroceder é `currentTime ± 1/fps`, e o fps o navegador não conta. A resposta tem duas pontas (conforme a recomendação aceita): um **seletor de fps** no painel (taxas comuns, padrão 30), e a **medição oportunista** por `requestVideoFrameCallback` onde a API existir — durante a reprodução, a mediana dos intervalos de `mediaTime` entre frames apresentados, com filtro do que não é frame (seeks, pausas: só entre 8 e 240 fps) e ENCAIXE na taxa comum mais próxima (29,97 e 30 são indistinguíveis para o passo). A regra de convivência: **a medição nunca sobrescreve escolha manual** (`videoFpsManual`), e vídeo novo zera tudo. Setar `currentTime` decodifica o frame exato — sem `fastSeek`, que salta para o keyframe do codec.

**Quem manda é o elemento; o store só espelha.** O `<video>` vivo mora no overlay e fica registrado num ref de módulo (`referenceVideoElement` — o regime do `activeViewportCamera`, #111); os controles do painel comandam play/pause/seek direto nele, e os EVENTOS do elemento (`timeupdate`, `seeked`, `play`, `pause`…) escrevem o espelho (`videoTime`/`videoDuration`/`videoPlaying`) que a UI lê. Uma direção só por dado — comando desce pelo ref, estado sobe por evento — evita o cabo de guerra de dois donos do tempo. O frame a frame PAUSA antes de andar (andar tocando não é frame a frame), e a linha do tempo (scrubber + play/pause, incluídos por custarem um `<input type=range>` e dois botões) busca direto no elemento.

**Um carregador só** ("Carregar foto/vídeo…"): o MIME do arquivo decide o `kind` — dois botões seriam duas portas para a mesma prateleira. O bloco de frame/linha do tempo/fps só aparece com vídeo na mão, inclusive DURANTE a marcação (avançar frames com as marcas na tela é o fluxo de keyframes acima). O que o jsdom não decodifica (seek real, medição de fps de verdade) fica para a conferência no navegador, como sempre (#31.5); o resto — passo com grampo nas pontas, mediana com encaixe, espelho, dublê do elemento nos controles — é puro e está travado por teste.

## 115. Profundidade também nos PARES — ombros e quadris, a torção que a foto esconde

Pedido do usuário, da prática com a marcação: poder indicar a profundidade dos ombros e dos quadris "assim como é feito com os braços, de maneira a facilitar a torção do tronco". O buraco era real e estrutural: toda marca nasce NO PLANO da vista, e a profundidade era opt-in só para a **ponta de um osso** (`DEPTH_CHAINS` — cotovelo mede contra o ombro, punho contra o cotovelo). Ombro e quadril são a RAIZ do membro: não têm osso pai na marcação para encurtar. Consequência: a linha dos ombros ficava eternamente paralela à tela e o frame do tronco **nunca podia torcer** — o único DOF do tronco que a foto de frente esconde era justamente o que o usuário queria.

**A medida existe, só não é um osso: é o outro lado.** A distância entre os dois ombros (clavícula + ombro, 0,195 m por lado) e entre os dois quadris (0,09 m por lado) é RÍGIDA no esqueleto — as clavículas ficam neutras na inferência e os quadris pendem direto da raiz. Então a mesma conta de sempre vale com outra referência: a linha do par encurtada na foto, comparada com o vão real (em unidades de foto, pela mesma escala mediana dos ossos de membro), dá a separação em profundidade. `DEPTH_PAIRS` entra ao lado de `DEPTH_CHAINS`, e `poseMarkDepthKind` passa a dizer de onde cada marca tira profundidade: `'bone'`, `'pair'` ou `'none'` (cabeça, nariz e pescoço não têm nem osso nem par).

**Distribuição SIMÉTRICA, por decisão do usuário na pergunta** (contra "só o lado marcado se move"): o lado marcado vem meia separação à frente e o outro recua a outra metade. O centro do par fica onde estava — o prumo do tronco (quadris→pescoço, #113.1) e o centro dos ombros não se mexem, e o que sai da marcação é **torção pura**, sem inclinação de brinde. Efeito colateral bem-vindo: marcar o ombro direito "à frente" e marcar o esquerdo "atrás" dizem exatamente a mesma coisa (há teste), o que casa com a intuição de quem marca. Os dois lados com a MESMA profundidade não dizem nada de relativo — a foto só mede a diferença entre eles: aviso próprio (`warnDepthPairSame`) e o par fica no plano. Linha do par inteira na foto (pessoa de frente, sem torção) cai no aviso de sempre, `warnDepthImpossible`: não há encurtamento de onde tirar torção.

**Os pares são resolvidos ANTES das cadeias de osso** — o cotovelo mede o encurtamento contra o ombro JÁ erguido do plano, o mesmo raciocínio de pai-primeiro que já valia dentro das cadeias. E vale registrar onde cada metade do pedido chega: **os ombros são o que de fato produz a torção** (o frame do tronco vira, e `spine`/`chest` recebem a diferença para o frame da raiz); **os quadris fazem menos do que parece** — a pelve É a raiz, que a inferência não toca por contrato (decisão do usuário na mesma pergunta: "só as pernas"), e a profundidade das cadeias de perna é medida RELATIVA ao ponto do quadril, então um quadril fora do plano só muda a coxa quando o joelho não tem profundidade própria. Ficou porque o usuário pediu, é geometricamente honesto e serve à perna marcada pela metade; a torção da pelve continua sendo o alinhamento manual da raiz.

## 115.1. O cursor da marcação — uma junta por vez, e a profundidade que é dela

O sintoma, na palavra do usuário: "eu marco a junta e a profundidade refere-se a junta anterior". Não era engano de leitura — era o painel falando de duas juntas ao mesmo tempo. A fila avançava SOZINHA ao colocar a marca: o cabeçalho já pedia o ponto SEGUINTE ("Toque em: punho direito") enquanto o quadro de profundidade, ligado à marca recém-posta, dizia "cotovelo direito". Dois nomes na tela, um deles sempre o passado.

**A fila virou cursor** (decisão do usuário na pergunta, contra "avança sozinho, com volta"): o toque marca a junta CORRENTE e o cursor **fica nela**; quem anda é o usuário, com ◀ Anterior / Próximo ▶, pela sequência inteira dos 17 pontos — para frente e para trás, parando nas pontas. Custa um toque a mais por junta e paga com uma garantia: o nome no cabeçalho, o ponto que o toque marca e a profundidade logo abaixo são sempre a MESMA junta. O cursor É a seleção (`selectedMarkKey`, não um segundo estado): tocar um marcador já posto na foto também leva o cursor até ele, e o painel acompanha.

Os detalhes que caíram por consequência: `placeMark` grava no cursor **preservando a profundidade** (tocar de novo corrige a posição sem perder o "à frente" já escolhido); marcar um ponto antes pulado o tira dos pulados; "Pular ponto opcional" passou a pular o ponto CORRENTE (e só se ele for opcional e ainda não marcado), avançando em seguida. O `nextMarkStep` sobreviveu como a **fila do que falta** — é ele que põe o cursor no primeiro pendente ao entrar no modo e que responde "todos os pontos marcados" —, não mais como o alvo do toque; sem cursor no store (marcação forçada de fora, como nos testes do overlay), o toque cai na fila, como antes.

## 115.2. A linha do tempo do vídeo empilhada — rótulo em cima, barra inteira embaixo

Miudeza de painel com efeito real: o rótulo da linha do tempo carrega tempo E duração ("Linha do tempo (2,53 s / 10,00 s)"), e na linha única do `.photo-ref__row` sobrava um toco de barra à direita — justo o controle que mais se arrasta. Um modificador `--stack` (coluna, barra em largura cheia) resolve sem tocar nas outras linhas: opacidade, zoom e fps têm rótulo curto e continuam melhor lado a lado. A classe é o que o teste confere — CSS o jsdom não calcula, mas a escolha de layout é decisão do usuário e merece ficar travada.

## 116. Giro da raiz atravessando os ±180° — o ramo do Euler é escolhido, não sorteado

Pedido do usuário: "na animação, ajustar os giros do root em Y e Z, para que o extremo continue [girando] mesmo após o limite — de 180° para −135° deve seguir como se saísse de −180° para −135°, e não retornar para trás". A primeira medida do exemplo EXATO desmentiu a hipótese óbvia: o menor arco já valia (`lerpAngle`, #43) e a amostragem devolvia 180 → −168,75 → −157,5 → −146,25 → −135, os 45° no sentido certo. O defeito era vizinho, e mais feio.

**A mesma orientação tem DOIS Euler XYZ:** `(x, y, z)` e `(x+180, 180−y, z+180)`. Os sliders do painel escrevem eixo a eixo e ficam no primeiro; o gizmo de rotação escreve QUATERNION e deixa o three decompor, e essa decomposição só produz o ramo de `|y| ≤ 90` — um boneco de costas vira `(180, 0, 180)` em vez de `(0, 180, 0)`. Desenhado na tela, é a mesma pose; interpolado EIXO A EIXO, é outra história: entre `(0, 180, 0)` e `(−180, −45, −180)` — a mesma virada de 45° do exemplo, só que gravada pelo gizmo — o meio do trecho dá `(−90, −112,5, −90)`, ou seja, **o boneco deita no meio do caminho e chega girando ao contrário**. Era o que o usuário via, e explica o "em Y **e Z**": o giro se espalhava pelos três eixos.

**O conserto é escolher o ramo, não trocar a interpolação:** antes de misturar, a rotação de CHEGADA é reescrita no ramo mais próximo da PARTIDA (`alignRootRotation`, em `poseBlend.ts`, comparando a soma das distâncias angulares por eixo das duas formas). Quando as duas pontas já falam a mesma língua — o caso comum, animação montada só com sliders — a alternativa está mais longe e **nada muda**; quando não falam, o giro volta a ser um giro só. Ficou em `blendPoses`, depois dos retornos de 0% e 100%: as pontas continuam devolvidas intactas (mesmo objeto), e a mistura de poses do painel ganha a mesma imunidade de graça.

Trocar a interpolação da raiz por quatérnio (slerp) resolveria o mesmo e foi descartado: o resultado precisa voltar a Euler para ser guardado, e a volta cai sempre no ramo canônico — o painel passaria a mostrar `x=180, y=−22,5, z=180` no meio de um giro que o usuário pensa como "Y". O argumento do #43 contra o quatérnio (o modelo é um conjunto de ângulos por eixo) vale aqui por outro motivo: os números que o usuário lê e digita são os eixos.

## 116.1. O gizmo deixou de embaralhar os números da raiz

O #116 conserta a mistura, mas a origem do problema é a escrita: bastava o gizmo ENCOSTAR num boneco em `Y=180` para o painel passar a mostrar `x=−180, y=−0,5, z=−180`. Mesma pose, e o usuário perdendo a referência do número que ele mesmo digitou — todo keyframe gravado depois disso carregava o outro ramo.

A regra entrou no store, onde mora toda escrita: **rotação de raiz escrita POR INTEIRO (x, y e z juntos) é realinhada ao ramo que o boneco já usava**; escrita por EIXO passa intacta. A separação não é arbitrária — ela distingue exatamente as duas origens: o gizmo de rotação e o solver de arrasto entregam o triplo inteiro (nasceram de um quaternion decomposto), enquanto slider, ajuste fino, teclado e o gesto de torção do módulo escrevem um eixo de cada vez (e continuam aceitando valores fora de (−180, 180], como o teste de "rotação livre sem grampo" trava desde sempre). Vale nos dois caminhos de escrita: `setRootRotation` (gizmo) e `setJointRotations` (a raiz recrutada pelo arrasto, item 63).

O arrasto do gizmo não é testável por unit test (#31.5), mas a REGRA é: os testes escrevem o triplo do jeito que o three decompõe e conferem que o boneco continua em `(0, −135, 0)`. Falta a conferência visual no navegador — girar pelo gizmo e ver o painel acompanhando sem saltos.

## 117. Mover o BLOCO nomeado de keyframes — o vizinho é pulado inteiro

Pedido do usuário: no painel de keyframes, poder mover o bloco de keyframes nomeados inteiro, mantendo a ordem interna. O item 38 já dava o bloco — keyframes consecutivos de mesmo rótulo, com cabeçalho recolhível —, mas o cabeçalho era só leitura: as setas ↑ ↓ existiam por keyframe, e remontar uma caminhada de cinco retratos noutro lugar da linha do tempo era cinco viagens, uma por card, cada uma podendo embaralhar a ordem interna.

**O passo pula o VIZINHO INTEIRO** (decisão do usuário na pergunta, contra "um keyframe por vez"): se o bloco de cima for outro grupo nomeado, o salto é sobre ele todo; se for keyframe solto, sobre um. Não é enfeite — é a única forma coerente com o item 38: **grupo é uma LEITURA da lista, não um objeto**, e existe só enquanto seus keyframes estão grudados. Entrar no meio de um vizinho o partiria em dois blocos com o mesmo nome (que a regra de unicidade então renomearia para "Andando" e "Andando 2"), ou seja, mover um bloco destruiria outro. Pulando o vizinho inteiro, os dois sobrevivem e a operação é reversível: descer desfaz o subir.

A conta mora no `animation.ts`, ao lado do `keyframeGroups`, com a MESMA definição de bloco (trecho contíguo de mesmo rótulo; sem rótulo, o keyframe sozinho) — duas definições de "bloco" seria a primeira coisa a divergir. `moveKeyframeBlock` devolve **a mesma lista** quando não há para onde ir (bloco na ponta): é o que impede um passo de undo que não desfaz nada, e por isso a ação do store sai ANTES do `updateAnimation` nesse caso — o `map` devolveria um array novo mesmo com todos os itens iguais, e a `equality` do zundo compara `animations` por referência.

Durações e ordem interna viajam com os keyframes; o que muda é a posição do bloco na lista, e a linha do tempo se refaz a partir dela (a duração pertence ao keyframe de chegada, então cada trecho leva a sua). No painel, as setas ficam no cabeçalho do grupo, encostadas à direita — longe do ↑ ↓ de cada card, que é a mesma seta para outro alvo —, desabilitadas quando o bloco já é o primeiro ou o último. Só o painel de desktop ganhou: a aba de keyframes do módulo de poses é uma lista plana, sem cabeçalho de grupo.

## 117.1. Arrumação de dois controles — as setas do bloco em linha própria, e a silhueta antes da casca

Dois ajustes de arrumação pedidos logo depois do #117, no mesmo dia.

**As setas do bloco saíram da linha do título.** No #117 elas nasceram encostadas à direita do cabeçalho do grupo, na mesma linha do nome e da contagem. Nome de grupo é texto livre do usuário ("Andando devagar até a porta"), e disputar a linha com dois botões espremia os dois — a coluna do painel é estreita. O cabeçalho virou duas linhas: `animation-panel__group-title` (o botão de recolher com o nome, mais a contagem) em cima, as setas embaixo. O teste trava a ESTRUTURA, não o CSS (que o jsdom não calcula): a contagem está dentro do título, as setas não — mesma tática do #115.2.

**A silhueta passou à frente da casca do boneco na barra superior.** As duas são modos de visualização vizinhos (#81 e item 8), e a ordem antiga era a de chegada, não a de uso: a silhueta é a checagem de leitura que se liga e desliga o tempo todo enquanto se posa; a casca (manequim de madeira × boneco de palito) se escolhe uma vez e fica. O controle mais mexido ficou à esquerda, mais perto do olho e do polegar. Só a ordem no JSX mudou — nenhum estado, nenhuma regra. O teste compara a posição dos dois no DOM (`compareDocumentPosition`), que é o que "à esquerda" quer dizer numa barra em linha.

## 118. Um gesto, um passo de undo — o histórico registra o estado de quando o botão é solto

Pedido do usuário: o undo tem de guardar o estado dos bonecos **depois de soltar o botão do mouse**; o que passou entre o começo e o fim do gesto não interessa.

O `zundo` registra um passo por `set` que muda o conteúdo, e todo gesto contínuo do app escreve o store dezenas de vezes: o gizmo de arrasto resolve a cadeia a cada `onObjectChange`, o módulo de poses escreve uma vez por quadro do rAF, o slider de eixo dispara a cada pixel, o gizmo de objeto o mesmo. O resultado era um histórico feito de migalhas — um arrasto de dois segundos enchia sozinho o teto de 100 passos (empurrando para fora tudo o que veio antes), e o Ctrl+Z voltava um pixel em vez de desfazer o movimento. Curiosamente, o problema já tinha sido reconhecido de perto: `setJointRotations` nasceu (item 63) exatamente para que a cadeia inteira coubesse num `set` só, "senão uma chamada por junta empilharia até 5 passos por pixel arrastado". A conta certa, na granularidade errada — o que importa não é o pixel, é o gesto.

**O agrupador é `src/store/undoBatch.ts`**, e o mecanismo tem duas metades:

- no `pointerdown`, `beginUndoBatch` tira um retrato do estado (o mesmo recorte de `undoPartialize`) e **pausa** o rastreio do `zundo`. As escritas do arrasto acontecem normalmente — o boneco se mexe na tela, o autosave grava —, só não viram histórico;
- no `pointerup`, `endUndoBatch` religa o rastreio e empilha **um** passo: o retrato de antes. O undo volta para onde o gesto começou; o redo devolve onde ele parou.

Empilhar à mão é o preço de pausar, e por isso o `partialize`/`equality`/`limit` do store deixaram de ser literais dentro das opções do `temporal` e viraram `undoPartialize`/`undoEquality`/`UNDO_LIMIT` exportados: duas definições do que o histórico enxerga seria a primeira coisa a divergir, e o passo escrito à mão tem de respeitar o mesmo teto e a mesma noção de "nada mudou". Um gesto que não escreveu nada — clique no gizmo sem arrastar, dois dedos que acabaram sendo pan de câmera — não deixa passo: a comparação é referencial, e a referência de `figures` não mudou.

**A contagem (`depth`) existe porque gestos se sobrepõem.** No módulo de poses o arrasto de junta (um dedo) e a torção (dois) podem estar ativos ao mesmo tempo; com contador, o gesto composto continua sendo um passo só, em vez de o primeiro `pointerup` fechar o que o outro ainda estava usando.

**A rede de segurança não é luxo.** Um gesto que começa e nunca termina — o dedo sai da tela, a janela perde o foco, um `pointerup` que o componente não recebeu — deixaria o histórico pausado para sempre, e o undo pararia de funcionar sem nenhum aviso na tela. O módulo escuta `pointerup`/`pointercancel`/`blur` na janela e fecha o lote quando não sobra nenhum ponteiro pressionado (a contagem por `pointerId` é o que impede o primeiro dedo do gesto de dois interromper o outro). O fechamento é adiado por uma volta do loop de eventos, e isso é exigência do `PosesViewport`: o `handleUp` dele despacha, no mesmo `pointerup`, o último movimento pendente do rAF (a proteção do item 47 contra gesto rápido) — e essa escrita precisa cair **dentro** do lote, não depois dele.

O alcance foi escolhido pelo usuário: **todo gesto contínuo**, e não só o boneco. Entraram os dois gizmos do viewport (`SelectionGizmo`, `JointDragGizmo`), os do objeto de cena (mover/girar/medir e o arrasto de vértice), o arrasto e a torção do módulo de poses, e os sliders de painel (eixos de junta e da raiz, altura, mistura de poses) por um `UNDO_BATCH_POINTER_PROPS` compartilhado. Ajuste por **teclado** ficou de fora de propósito: cada toque de seta é uma edição discreta, e desfazer uma a uma é o que se espera dela. A câmera de cena não precisou de nada — ela já está fora do histórico desde a fase 11.

O arrasto em si continua fora do alcance do unit test (#31.5), então a cobertura é em dois níveis: o agrupador tem testes próprios (um passo por lote, o undo voltando ao estado de antes e não a um intermediário, o redo devolvendo o fim do gesto, aninhamento, teto, `futureStates` descartado e a rede de segurança fechando um lote esquecido), e o slider do painel de Propriedades — que é ponteiro de verdade em jsdom — tem o teste de ponta a ponta: `pointerdown`, cinco `change`, `pointerup`, um passo. Falta a conferência visual no navegador: arrastar um gizmo e conferir que um Ctrl+Z desfaz o movimento inteiro.

## 118.1. A profundidade escolhida fica acesa — o `aria-pressed` que só o leitor de tela via

Pedido do usuário, no mesmo dia: ao posar sobre foto ou vídeo, deixar o botão de profundidade **marcado**, para lembrar qual opção está valendo ao voltar àquele ponto.

O estado nunca esteve perdido. A escolha vive na marca (`PoseMark.depth`), sobrevive a mover o ponto, a andar com o cursor, a parar e recomeçar a marcação, e o painel já a expunha corretamente: `aria-pressed` verdadeiro no botão em vigor, com "No plano" valendo como padrão quando a marca não tem `depth`. O que faltava era do lado de fora — **nenhuma regra de CSS reagia a esse `aria-pressed`**. O atributo existia para o leitor de tela e para os testes; na tela, os três botões eram idênticos. Quem marcasse o ombro direito "atrás", seguisse marcando o resto do corpo e voltasse para reconferir — o gesto normal do fluxo, e mais ainda no vídeo, onde se marca frame a frame — não tinha como saber o que havia escolhido, a não ser refazendo a escolha.

Vale registrar por que o descuido passou: o app estiliza estado apertado por seletor de atributo (`[aria-pressed='true']`), e são oito regras espalhadas, uma por família de botão — não existe uma regra genérica que pegue qualquer botão apertado. É um padrão que funciona bem (cada família escolhe o próprio tratamento) e falha em silêncio: um grupo novo nasce funcional, acessível, testável e **invisível**. Não havia nada a corrigir no componente nem no store.

O tratamento é **botão cheio** (`background: var(--text-h)`), e não moldura acesa. A distinção segue a mesma lógica do #88 — a aparência descreve o conteúdo: a profundidade é escolha **exclusiva entre três** (no plano · à frente · atrás), como os presets de lente do painel de câmera, que são cheios; moldura acesa fica para as chaves **independentes**, como visível/travado/oculto na bancada, onde cada uma liga e desliga sozinha. As duas cores saem das variáveis de tema, então o marcado continua legível no claro e no escuro.

O teste não alcança o CSS (o jsdom não o calcula, como no #115.2 e no #117.1), então ele trava o que dá: o ROUND-TRIP do estado no painel — "No plano" marcado por padrão, a escolha trocando de botão ao clicar, e — o que ninguém cobria — a escolha **ainda marcada depois de sair da junta e voltar**, que é exatamente o cenário do pedido. Falta a conferência visual no navegador: um olhar aos três botões nas duas cascas, no tema claro e no escuro.

## 119. O tronco quebrado em dois e a raiz conferida pelos quadris — o que um ponto sobre o eixo pode e o que não pode dizer

Pedido do usuário, em duas etapas. Primeiro uma **avaliação**: valeria acrescentar um ponto para marcar a coluna na inferência de pose por foto, "para pegar rotações do tronco em relação à raiz"? Depois, lida a avaliação, a implementação — do ponto **e** da conferência da raiz que a avaliação levantou de passagem.

**O que a avaliação achou, e que muda o pedido.** Um ponto marcado **sobre o eixo** do tronco não pode dizer torção: girar o tronco em torno do próprio eixo não move ponto nenhum que esteja nesse eixo. Isso é geometria, não limitação de implementação — nenhum ajuste no solver o faria falar. A torção relativa à raiz já vinha da linha dos ombros contra a raiz, com o encurtamento do par saindo do plano (#115); medi-la de novo com um ponto axial é impossível, e medi-la melhor exigiria um segundo par transversal na cintura, cujo vão (~0,16 m) dá um sinal da mesma ordem do ruído de toque — os ombros só funcionam porque o vão é o dobro.

O que o ponto dá é outra coisa, e vale por si: a **quebra** do tronco. Até aqui, `solveTorso` montava um frame só, dos ombros, e o repartia **meio a meio** entre `spine` e `chest` — um chute, o único possível quando o que se conhece do tronco são as duas pontas. Consequência: todo tronco saía **reto**. Arco das costas, contraposto, ombro caído, encolhimento — tudo virava a mesma inclinação uniforme, e o desenhista ia corrigir à mão o que mais define o gesto da figura.

**Onde marcar, e por que não onde parecia.** O primeiro palpite — a cintura, junta `spine` — está errado, e o erro é instrutivo: a posição da junta `spine` **não depende de rotação nenhuma do tronco**. Ela é filha direta da raiz; quem gira a coluna é a rotação *dela*, que move o que está acima. Marcar ali daria zero informação. O ponto que a rotação da coluna move é a junta `chest` — a **base do tórax**, onde as costelas terminam. E o braço de alavanca melhora junto: quadris→tórax dá 0,41 m contra os 0,17 m da hipótese descartada, e o ruído angular de um toque de 1% da altura cai de ~5,7° para ~2,4°.

**A conta é exata, e não podia ser a ingênua.** Entre a raiz e a base do tórax há dois trechos: o fixo `root→spine` (0,17 m, que rotação de tronco nenhuma move) e o `spine→chest` (0,24 m), esse sim girado pela coluna. Tomar a direção do composto como se fosse a do osso subestima a quebra em ~40% — 30° de coluna apareceriam como 17,6°. Desfazer o trecho fixo cabe numa equação de segundo grau: com `d` a direção medida, `|t·d − a·ŷ| = b` resolve o alcance `t`, e o que sobra é o osso. Sempre solúvel, porque no esqueleto b > a. O eixo transversal continua vindo da repartição meio a meio — a marca diz a inclinação da coluna, jamais a torção em torno dela.

**Zona morta de 6°.** O total continua fixo pelo frame dos ombros: se a marca erra, a coluna vai para um lado e o peito compensa para o outro, e o resultado é um **S falso**, pior de olhar que a reta que o modelo antigo dava. Abaixo de 6° de desvio da repartição meio a meio, a marca é ignorada. O número sai da conta acima: ~2,4° de ruído na coluna, outro tanto no peito em sentido oposto, ~5° de S visível.

O ponto é **opcional** e **não aceita profundidade**: o encurtamento de um trecho de 0,24 m fora do plano é ~1 cm num corpo de 1,70 m, abaixo do próprio ruído de marcação. Ele fica logo depois da base do pescoço, fechando o **eixo do tronco** antes de a fila passar aos membros. O retarget automático (#109) não o recebe: o BlazePose tem 33 marcos e nenhum no meio da coluna — lá a repartição meio a meio continua.

**A raiz conferida pelos quadris.** A avaliação achou, no mesmo assunto, um buraco maior e mais barato. A raiz é o alinhamento manual do usuário e nenhuma inferência a toca (#111) — mas ela é a âncora de tudo: alinhá-la 15° torta faz o tronco inteiro sair 15° torto, e o erro reaparece justamente como a torção que se queria consertar. Os quadris já são marcados, a distância entre eles é rígida, e os pontos já estavam calculados: a linha deles é a medida da pelve que a foto sabe dar, e ninguém a estava usando para nada além das pernas.

Duas escolhas do usuário fecharam o desenho. A correção age por **botão próprio**, ao lado de "Inferir pose", nunca dentro dela: a colocação continua sendo ato explícito do usuário, com passo de undo próprio, e #111 fica intacta. E, **sem profundidade marcada nos quadris**, a correção faz só o que a foto vê — gira em torno do eixo de visão até as *projeções* casarem, o que corrige a inclinação lateral da pelve (um quadril mais alto) e **não inventa** o giro em profundidade. Deitar a pelve no plano da foto seria fabricar dado: a linha de uma pelve girada projeta-se na mesma direção da de uma pelve de frente, só mais curta. Com profundidade marcada, aí sim vale o arco mínimo completo, que corrige o giro sem tocar na inclinação frente/trás — a única coisa que a linha dos quadris nunca vê. O painel diz qual dos dois aplicou.

Fecha o ciclo um **aviso** na inferência: quando a linha marcada discorda da raiz em 5° ou mais, a lista de avisos diz que há um botão para acertar aquilo antes de inferir. É o que faz a conferência ser lembrada na hora certa, em vez de ficar num botão que ninguém sabe para que serve.

O teste de curvatura é de ida-e-volta, como o resto do módulo: uma pose em C (coluna +20°, peito −12°) marcada e reinferida. Sem a marca, os dois saem iguais e pequenos — a reta. Com ela, a coluna volta exata e o peito vai para o lado oposto. O peito não volta exato, e por um motivo que já existia: o prumo do frame do tronco é quadris→pescoço, um composto de três trechos que não é exatamente a orientação do peito — um viés de uns 3°, herdado da repartição meio a meio e deixado como estava, porque corrigi-lo exigiria medir um trecho de 0,08 m entre duas marcas vizinhas, ruído puro.
