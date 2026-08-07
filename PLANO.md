# WebPoser — Plano do Projeto

Aplicativo frontend 3D, totalmente offline, para posar bonecos articulados (manequins de desenhista) e exportar imagens estáticas de referência (**instantâneos**). Desde a fase 10, também **anima entre poses-chave e exporta MP4** — ver "Mini animador"; até ali, "geração de animações" era escopo declarado como fora, e a mudança é decisão do usuário (`DECISOES.md` #52).

## Decisões de arquitetura

| Tema | Decisão |
|---|---|
| Manipulação de pose | FK (gizmo de rotação por articulação) como base + IK (arrastar mãos/pés) em fase posterior |
| Aparência do boneco | Manequim construído por primitivas 3D geradas em código — sem assets externos e **sem depender de bibliotecas de terceiros para a geometria** (avaliamos a `mannequin.js`, descartada por licença GPL-3.0 e descompasso de escopo; ver `DECISOES.md`). Torso/pelve como volumes torneados (`LatheGeometry`, perfil revolucionado em "barril"), membros como perfis torneados afunilados com leve volume muscular, mãos/pés em "pá" achatada — aproximando o visual de um manequim de madeira de desenhista |
| Distribuição | Por enquanto, execução via **servidor local** (`npm run dev` / `npm run preview`); **PWA já antecipado no plano** (fase 6) para instalação e uso offline sem servidor |
| Persistência | Arquivo de cena em **glTF 2.0 (.glb)** — padrão aberto compatível com Blender e demais DCCs — com dados do app em `extras`; autosave em `localStorage`. **O mesmo formato/pipeline é reaproveitado** para exportar/importar um boneco individual ou um conjunto de bookmarks de câmera separadamente da cena completa (ver "Persistência") |
| Exportação de imagem | Render sob demanda para PNG; **File System Access API** para escolher o diretório de keyframes (fallback: download) |
| Modelo de desenvolvimento | **TDD** — teste que falha primeiro, implementação mínima, validação pelo teste (red → green → refactor) |
| Idioma da UI | **Bilíngue (pt-BR + en)** com infraestrutura de i18n desde a fase 1; pt-BR como idioma padrão |

## Stack técnica

- **Vite + React 19 + TypeScript** — build estático
- **three** + **@react-three/fiber v9** (compatível com React 19) — renderização declarativa
- **@react-three/drei** — `OrbitControls`, `TransformControls`/`PivotControls`, `GizmoHelper` (bússola de eixos)
- **zustand** — estado global (cena, bonecos, seleção, câmera); **zundo** para undo/redo
- **react-i18next** — internacionalização (pt-BR padrão + en); dicionários embutidos no bundle (nenhuma carga por rede); toda string de UI nasce como chave de tradução, nunca hardcoded
- **IK:** solver CCD próprio operando sobre a hierarquia de `Object3D` (cadeias curtas de 2 elos: braço e perna). O `CCDIKSolver` do three exige `SkinnedMesh`, que não usaremos — um CCD manual para cadeias de 2 elos com limites articulares é pequeno e controlável.
- **Sem nenhuma dependência de rede em runtime** (fontes, texturas e ícones embutidos no bundle)

## Execução offline e distribuição

Um build Vite padrão não abre por duplo clique no `index.html` (`file://` bloqueia módulos ES), então o mecanismo de execução é decisão de plano, não detalhe:

- **Agora (fases 1–5):** execução via servidor local — `npm run dev` durante o desenvolvimento e `npm run preview` (ou `npx serve dist`) para uso. Tudo na própria máquina; nenhum acesso à rede externa.
- **Antecipado no plano (fase 6): PWA** com `vite-plugin-pwa` — após o primeiro acesso ao servidor local, o app é instalável e passa a rodar 100% offline, em janela própria, sem servidor. A janela própria também libera atalhos que o navegador reserva em abas.
- **Preparação desde a fase 1** para não retrabalhar depois: caminhos relativos no build (`base: './'`), zero requisições em runtime e manifest/ícones previstos na estrutura.

## Modelo do boneco

### Hierarquia de articulações (fisionomia humana, 32 juntas)

Diretriz: **o máximo de articulações do corpo humano**, com duas exceções acordadas — sem dedos nos pés e sem dedos individualizados nas mãos (o polegar é articulado à parte; os outros 4 dedos abrem/fecham juntos, em bloco, mas com 3 juntas de falange cada — ver ajuste de modelo pós-fase 8, `DECISOES.md` #16).

```
root (pelve) — posição XYZ + rotação (colocação na cena)
├─ spine (lombar) ── chest (torácica) ── upperChest (base do pescoço/ombros, 1 DOF) ── neck ── head
├─ upperChest ── clavicle.L/R (2 DOF — encolher/projetar o ombro)
│   └─ shoulder.L/R (3 DOF) ── elbow.L/R (2 DOF: flexão + pronação/supinação do antebraço)
│       └─ wrist.L/R (2 DOF)
│           ├─ thumb1.L/R (2 DOF, base do polegar) ── thumb2.L/R (1 DOF, dobra)
│           └─ fingersBase.L/R (1 DOF, MCP) ── fingersMid.L/R (1 DOF, PIP) ── fingersTip.L/R (1 DOF, DIP)
│               — os 4 dedos curvam juntos, de abertos a punho, mas agora em 3 pontos de dobra
└─ hip.L/R (3 DOF) ── knee.L/R (1 DOF, dobradiça) ── ankle.L/R (2 DOF)
    └─ ball.L/R (1 DOF — flexão da planta/ponta do pé, permite pose "na ponta dos pés"; não são dedos)
```

Total: 32 juntas (1 root + 5 de tronco/cabeça + 18 de braços/mãos + 8 de pernas/pés). A pronação/supinação no cotovelo garante que a palma da mão pode virar para cima/baixo; clavículas permitem encolher os ombros; `upperChest` inclina a base do pescoço/linha dos ombros para frente/trás independente de dobrar o tórax inteiro. Cada junta é um `Group` (pivô) com a geometria do segmento como filha — girar o ombro carrega braço, antebraço e mão, como num boneco real.

### Aparência (geometria dos segmentos)

Referência visual: manequim de madeira articulado de desenhista (boneco com juntas de esfera, segmentos maciços e arredondados — não um "boneco-palito"). A hierarquia de juntas do `skeleton.ts` não muda; o que muda é só a geometria renderizada em cada segmento (`Figure.tsx`):

- **Cabeça:** esfera (levemente ovalada), maior que as juntas comuns, sobre um pescoço curto. O pivô (junta `neck→head`) fica deslocado da própria esfera — a nuca não é o centro de massa da cabeça, então a esfera é renderizada um pouco à frente (+Z, mesma convenção de "frente" já usada por `ball.*` e pelo polegar no `skeleton.ts`) e um pouco abaixo (-Y) do pivô, em vez de centralizada exatamente sobre ele — evitando o efeito de o pivô parecer estar na "ponta" do elipsoide.
- **Torso, cintura e pelve:** volumes **torneados** (`LatheGeometry` — um perfil 2D revolucionado em torno do eixo vertical, a mesma técnica usada pela `mannequin.js` avaliada e descartada por licença, ver `DECISOES.md`), em forma de "barril" arredondado — bem mais orgânico que uma esfera esticada. A pelve é mais larga que a cintura, como no manequim de referência.
- **Braços e pernas (upper arm/forearm/coxa/canela):** também perfis torneados, afunilados (mais grossos perto do corpo, mais finos perto da junta seguinte) com uma leve "barriga" muscular no meio do segmento, em vez de cilindros/cápsulas de seção reta.
- **Mãos e pés:** blocos achatados em formato de "pá" (sem dedos individuais renderizados — coerente com a decisão de não haver juntas de dedo além do polegar).
- **Juntas (ombro, cotovelo, quadril, joelho etc.):** esferas discretas nos pivôs, visíveis o bastante para seleção por clique (fase 3), mas sem dominar a silhueta como no visual anterior (tipo "esqueleto").
- **Sem haste/pedestal físico:** o manequim de referência tem uma haste e base de madeira para ficar em pé sozinho — isso é um artefato do objeto físico (equilíbrio), não da aplicação; o `root` já cuida da colocação do boneco na cena.
- **Elipse de referência no chão (equivalente virtual da base):** cada boneco projeta uma elipse achatada e translúcida no chão, na cor do próprio boneco (mesma paleta usada para diferenciá-los) — funciona como uma "sombra de contato" sempre visível, ajudando a localizar visualmente onde cada boneco está colocado no plano do chão (útil desde já, e ainda mais na fase 3, ao posicionar o root por arrasto). Acompanha só X/Z e a altura (escala) do boneco — **fica sempre presa ao chão (Y≈0)**, mesmo que o boneco seja levantado no eixo Y, dando noção visual de altura (útil para poses de salto, voo, etc.).

### Limites articulares

Cada junta tem limites min/max por eixo (Euler, ordem definida por junta) para impedir poses anatomicamente impossíveis. Exemplos: cotovelo 0°–150° em um único eixo; joelho dobra só para trás; pescoço ±60°. Os limites ficam em um arquivo de definição do esqueleto (`skeleton.ts`) — fonte única usada pelo FK, pelo IK e pela validação ao carregar cenas.

### Múltiplos bonecos

- Até **5 bonecos** simultâneos; paleta fixa de 5 cores de alto contraste (ex.: vermelho, azul, verde, laranja, roxo) atribuídas automaticamente e trocáveis.
- **Altura ajustável por boneco** (ex.: 1,50–1,90 m, padrão 1,70 m): escala o esqueleto proporcionalmente, para diferenciar personagens nos keyframes além da cor.
- Painel de lista: adicionar, remover, duplicar (copia a pose), renomear, mostrar/ocultar, selecionar.

## Ambiente e câmera

- **Ambiente neutro:** fundo cinza configurável (claro/médio/escuro), plano de chão com grade, luz hemisférica + direcional com sombra suave (sombra ajuda a ler a posição espacial nos keyframes).
- **Câmera:** órbita/pan/zoom (OrbitControls), FOV ajustável, presets ortográficos rápidos (frente, costas, laterais, topo, 3/4).
- **Câmera de cena separada do viewport (fase 11, `DECISOES.md` #78):** a câmera que gera o PNG, o MP4 e os keyframes é um ELEMENTO da cena (`figuresStore.sceneCamera`), com gizmo próprio no viewport (estilo Blender, arrastável/girável com W/E) e um modo "visão da câmera" alternável (botão no painel ou tecla `0`) que trava o viewport no quadro dela. Navegar pela bancada não move a câmera; o painel de Câmera (planos, POV, movimento A→B, lente, bookmarks perspectivos) comanda a câmera de cena — só as vistas ortográficas continuam sendo navegação do viewport. Persistida com a cena, fora do undo.
- **Bookmarks de câmera:** salvar posições nomeadas da câmera dentro da cena — essencial para gerar keyframes consistentes do mesmo ângulo. Além de viajarem dentro do arquivo da cena completa, o **conjunto de bookmarks pode ser salvo/importado/exportado separadamente** (ver "Persistência"), para reutilizar os mesmos ângulos em cenas diferentes.

## Interação de pose

1. **Selecionar boneco** (clique no corpo) → gizmo de translação livre nos 3 eixos no root para posicioná-lo na cena, inclusive fora do chão (ex.: salto, voo) — a sombra permanece no chão como referência de altura.
2. **Selecionar articulação** (clique na esfera da junta) → gizmo de rotação restrito aos eixos/limites daquela junta + sliders numéricos no painel lateral.
3. **Modo IK (fase 7):** alvos arrastáveis nas mãos e pés; CCD resolve ombro+cotovelo / quadril+joelho respeitando os limites; alternância FK/IK por membro.
4. **Poses predefinidas** (em pé, sentado, andando, correndo) como ponto de partida — barato de implementar e muito útil.
5. **Undo/redo** (Ctrl+Z / Ctrl+Shift+Z ou Ctrl+Y) sobre alterações de pose, posição, bonecos e configuração da cena — disponível **desde a fase 3**, junto com a primeira edição de pose. A navegação de câmera (órbita/pan/zoom) fica **fora** do histórico de undo, seguindo o padrão dos editores 3D; bookmarks de câmera (criar/remover) entram no histórico normalmente. A granularidade é o **gesto, não o evento** (`DECISOES.md` #118): arrasto de gizmo, arrasto no módulo de poses e arrasto de slider registram um único passo, com o estado de quando o botão (ou o dedo) é solto — os intermediários não entram. Ajuste por teclado continua passo a passo.

## Persistência (formato da cena)

> **Mudança de formato decidida em 2026-07-31** (ver `DECISOES.md` #85): a cena era gravada em **glTF 2.0 binário (`.glb`)** e passou a ser um **`.json`**. O motivo está registrado na decisão — o app nunca leu de volta a geometria do `.glb`, só o bloco `extras`, e a malha respondia por ~99,5% do arquivo (245 KB contra 1,2 KB para um boneco). O **conteúdo** do arquivo não mudou: é o mesmo bloco de `sceneSerialization.ts`, agora no nível de cima do JSON em vez de dentro de `extras["virtual-mockup"]`. A compatibilidade com o Blender volta como módulo próprio — ver "Integração com o Blender (rigging)" abaixo.

O formato de arquivo é **JSON**, o mesmo padrão dos outros arquivos do workspace (`poses.json`, `animations.json`, `joint-limits.json`, `clips.json`): campo `version`, um `leiame` embutido explicando o arquivo (JSON não aceita comentários) e sanitização total na leitura. É legível e editável à mão, que é como os limites articulares e a biblioteca de poses já eram usados.

```jsonc
// scene.json — a cena inteira
{
  "version": 1,
  "leiame": ["Uma cena inteira: bonecos, objetos, ambiente, bookmarks de câmera e a câmera de cena.", "..."],
  "name": "Pose final",   // nome da cena/snapshot (ver "Workspace: catálogo de cenas" abaixo)
  "environment": { "background": "medium", "grid": true },
  "sceneCamera": { "position": [...], "target": [...], "up": [...], "focalMm": 50 },
  "snapshotCounter": 12,   // próximo número da sequência snap### — viaja com a cena
  "cameraBookmarks": [{ "name": "plano geral", "position": [...], "target": [...], "fov": 50 }],
  // O boneco é o objeto do store verbatim — o MESMO de keyframes[].figures[]
  // do animations.json e do arquivo de pose avulsa (DECISOES.md #86).
  "figures": [{ "id": "f1", "name": "Boneco 1", "color": "#e04040", "visible": true,
                "height": 1.70, "position": [x,y,z], "rotation": { "x":0,"y":0,"z":0 },
                "pose": { "shoulder.L": { "x":0,"y":0,"z":0 } } }],
  "props": [{ "shape": "box", "size": [...], "vertices": { "0": [dx,dy,dz] } }]
}
```

Regras de leitura/gravação:

- **Reabertura no app:** o app reconstrói os bonecos a partir do seu próprio `skeleton.ts` e aplica as rotações registradas no arquivo — nunca houve geometria a ler, e é isso que sempre tornou a reabertura robusta. Objetos de cena seguem a mesma regra: forma + tamanho + desvios de vértice, com a malha reconstruída por `propGeometry.buildPropGeometry`.
- **Arquivo que não é nosso:** um JSON sem o campo `version` é recusado com mensagem explícita (`missingAppData`), em vez de substituir a cena de trabalho por uma cena vazia; um texto que nem é JSON dá `unreadable`. As duas mensagens são o que o usuário vê no painel.
- **Uma codificação só para o boneco** (`DECISOES.md` #86): cena, animação, trechos, pose avulsa e `poses.json` gravam a junta como `{"x":0,"y":0,"z":0}`, e há **um leitor só** (`figure/figureFormat.ts`). A codificação antiga (`joints` com `[x,y,z]`) continua sendo aceita na leitura, para sempre — arquivo e autosave gravados antes continuam abrindo, sem bump de versão e sem conversor.
- **Autosave** contínuo em `localStorage` usa exatamente o mesmo schema (`sceneToExtras`/`sceneFromExtras`) — desde sempre. Trocar o envelope do arquivo não mexeu em uma linha dele.
- Campo `version` + validação com defaults ao carregar, para evoluir o formato sem quebrar cenas antigas. Campos aditivos (`props`, `sceneCamera`, `snapshotCounter`) não sobem a versão: um arquivo antigo sem eles abre com o conteúdo que sempre teve.
- **Escala/unidades (parte do contrato):** **metros**; o boneco é modelado em escala humana real (padrão 1,70 m, altura ajustável por boneco).
- **Limitações documentadas:** limites articulares, presets de pose, poses salvas, animações e trechos **não** ficam na cena — são do workspace, cada um no seu arquivo. A animação continua saindo em MP4, e nunca houve canais de animação glTF.

### Boneco individual em arquivo

> **Consolidado em 2026-07-31** (ver `DECISOES.md` #87). Havia DOIS arquivos de boneco avulso — "Exportar/Importar boneco" no painel de Bonecos e "Pose em arquivo" no de Propriedades. Depois da unificação do formato do boneco (#86) eles tinham virado quase o mesmo artefato, diferindo pela chave de embrulho e pelo X/Z, com duas rotinas de leitura, cinco chaves de mensagem de erro e uma falha silenciosa própria do primeiro. **O do painel de Bonecos foi removido.**

Cada boneco pode ser gravado e recarregado **separadamente**, para reaproveitar uma pose em outra cena ou levá-la do celular para o computador. Caminho único: **"Pose em arquivo"**, no painel de Propriedades, com o boneco selecionado (`figurePoseFile.ts`, `DECISOES.md` #81).

- **Formato:** `{version, leiame, figures: [um boneco]}`, com o boneco exatamente na estrutura de `keyframes[].figures[]` de uma animação. `figures` no plural é o nome usado por todos os outros formatos do projeto; `figure` singular, que este arquivo usou até o #87, continua sendo lido.
- **A leitura aceita a família inteira:** o arquivo de pose, um boneco cru, um keyframe solto, uma animação, um `animations.json` de workspace, um `scene.json` e um array de qualquer um deles. É isso que faz dele uma ponte de verdade — uma animação exportada no computador serve de fonte de pose sem ser recortada à mão antes.
- **Gravar:** o boneco é considerado no (0,0) do plano horizontal (X e Z saem zerados); o Y é preservado.
- **Carregar:** aplica altura, pose, inclinação e o Y ao boneco selecionado. **X/Z do destino são preservados** — onde o boneco pisa é composição, não pose. Identidade, cor e visibilidade são do boneco de destino; juntas travadas ficam intactas; ângulos passam pelo grampeamento de `skeleton.ts`, como em qualquer carregamento.
- **Não há "carregar como boneco novo"** (removido junto com o import do painel de Bonecos, perda aceita pelo usuário). Para trazer um boneco de fora: acrescentar boneco, selecionar, carregar pose — perdendo nome, cor, visibilidade e o X/Z do arquivo. Se um dia fizer falta, é barato: o JSON já carrega esses campos, apenas não os aplica.
- **Formato alternativo considerado e descartado:** BVH (Biovision Hierarchy) é o padrão da indústria para dados de esqueleto/pose (motion capture) e é nativo no Blender, mas é orientado a animação (canais de rotação por frame) e não carrega metadados como cor/altura/nome — exigiria um parser/exportador próprio só para ganhar compatibilidade com ferramentas de motion capture. Revisitar só se surgir necessidade real de interoperabilidade com esses pipelines.

### Exportação/importação de bookmarks de câmera

- **Formato:** também `.json`, reaproveitando o mesmo pipeline — um arquivo com a lista `cameraBookmarks`, sem bonecos nem dados de ambiente. Como no boneco, a leitura aceita um `scene.json` inteiro como fonte.
- **Exportar:** salva todos os bookmarks da cena atual num único arquivo.
- **Importar:** os bookmarks do arquivo são **adicionados** aos da cena atual (não substituem a lista existente); em caso de nome duplicado, o importado recebe um sufixo automático — assim importar um conjunto de ângulos favoritos nunca apaga bookmarks já criados na cena.

### Workspace: catálogo de cenas (esclarecimento pedido pelo usuário, fase 6)

**Cena** = o conjunto de metadados de todos os bonecos posicionados/posados numa composição (bonecos, poses, objetos, ambiente, bookmarks de câmera daquela composição, contador de instantâneo) — exatamente o que hoje já vive no estado principal do app e é exportável como um `.json` (ver o exemplo acima). Bookmarks de câmera continuam podendo ser trocados livremente **sem** alterar a pose (já implementado na fase 4) — várias posições de câmera para a mesma cena.

**Workspace** = uma coleção de **snapshots** de cena nomeados, guardada localmente (`localStorage`, com autosave contínuo e restauração automática ao abrir o app — sem diálogo de confirmação), que o usuário pode criar, renomear, remover e recarregar (recarregar um snapshot substitui a cena de trabalho atual, num único passo de undo). Criar/renomear/remover um snapshot entra no histórico de undo, como um bookmark de câmera; qual snapshot está "carregado no momento" não entra (é navegação, não conteúdo) — mesma lógica já aplicada a `cameraBookmarks`/seleção (ver `DECISOES.md` #8 e #11).

**Persistência do workspace em arquivo:** continua **1 cena = 1 arquivo** (`.json` desde `DECISOES.md` #85). Um "workspace" salvo em disco é uma **pasta** escolhida via File System Access API (mesmo padrão já usado para a pasta de instantâneos na fase 5) contendo um arquivo de manifesto `workspace.json` (nome + `activeSceneId` + lista de `{id, name, filename}` apontando para os `.json` de cena da pasta) mais os próprios arquivos de cada cena, salvos/carregados **independentemente** do manifesto. Sem a File System Access API (Firefox/Safari), cai para seleção manual de múltiplos arquivos (`workspace.json` + os arquivos de cena referenciados de uma vez). Pesquisa completa, alternativas descartadas (zip único; manifesto avulso por download/upload sem pasta) e justificativa em `DECISOES.md` #11.

**Nomes reservados:** como a pasta é hoje inteiramente `.json`, o nome de arquivo de uma cena não pode colidir com os arquivos fixos (`workspace.json`, `joint-limits.json`, `poses.json`, `animations.json`, `clips.json`). Uma cena chamada "Poses" vira `poses-2.json` — sem isso, salvar o workspace apagaria a biblioteca de poses do usuário. Comparação em minúsculas, porque o sistema de arquivos do Windows não distingue caixa.

### Integração com o Blender (rigging) — a fazer

A ponte com o Blender existiu na forma do `.glb` de cena (esfera por junta + cilindro por osso) e foi removida em `DECISOES.md` #85, porque não era o que se quer dela: **o app nunca leu de volta nada do que o Blender editasse** — só o bloco JSON de `extras` —, e o arquivo nunca teve canais de animação glTF. Ou seja, era uma exportação de referência visual disfarçada de ida e volta.

O que substitui, quando for a hora, é um **módulo isolado de exportação rigada**, para keyframing avançado no Blender:

- **Armature de verdade:** árvore de `THREE.Bone` a partir de `skeleton.ts` (que já tem hierarquia, posições locais e escala por altura), `SkinnedMesh` com `skinIndex`/`skinWeight` e `boneInverses` da pose de repouso.
- **Sem weight painting.** O `Figure.tsx` já desenha o boneco como **segmentos rígidos** (`SegmentPart` no espaço local de cada junta, mais os ossos): cada segmento amarra ao seu osso com peso 1,0. Rígido, correto, e o usuário suaviza no Blender se quiser.
- **Canais de animação:** um `AnimationClip` com trilhas de quaternion por osso, montado a partir dos keyframes de `animations.json` — passado ao `GLTFExporter` pela opção `animations`, que o exportador antigo nunca usou.
- **Mão única, assumidamente.** Exportar para o Blender e voltar não faz sentido: uma curva do graph editor não tem representação no modelo do app (pose por junta + câmera). O módulo exporta; o refino avançado termina lá.
- **Achados de glTF que o módulo vai precisar** estão preservados em `DECISOES.md` #85 (comportamento de `extras`/`THREE.Scene`, `binary: true`, e o `sanitizeNodeName` que **remove** `.` `:` `/` `[` `]` dos nomes de nó).

## Exportação de imagem (instantâneos)

> **Renomeação decidida na fase 10** (ver "Mini animador"): o que este documento e o app chamavam de **keyframe** (a imagem PNG capturada) passa a se chamar **instantâneo** / *snapshot*. A palavra "keyframe" fica reservada para os marcos da animação, que é o seu significado corrente. O texto abaixo já está no vocabulário novo; a renomeação no código é o passo 0 da fase 10.

- Botão "Capturar instantâneo": renderiza um frame sob demanda no canvas (sem `preserveDrawingBuffer` permanente) e gera o PNG via `canvas.toBlob`.
- **Diretório de destino via File System Access API** (`showDirectoryPicker`, Chrome/Edge): o usuário escolhe a pasta de saída uma vez e as capturas seguintes gravam direto nela, sem prompts — essencial para o fluxo de capturar muitas imagens em sequência. A permissão da pasta é rememorada na sessão. **Fallback** (navegadores sem a API, ex.: Firefox): download convencional.
- Resolução configurável independente da janela (ex.: 1920×1080, 1080×1080) renderizando em um target dimensionado.
- Opção de ocultar grade/gizmos na captura — que a partir da fase 10 esconde **também o destaque amarelo da junta selecionada** (decisão do usuário: a imagem exportada e o vídeo exportado têm de mostrar exatamente a mesma coisa; ver `DECISOES.md` #52).
- Nomenclatura sequencial automática: `nome-da-cena_snap001.png`, `snap002`… — o contador é persistido na cena (campo `snapshotCounter` do schema, lido também do antigo `keyframeCounter`), então reabrir a cena continua a sequência em vez de sobrescrever arquivos. **Desde 2026-08-07** (`DECISOES.md` #135) o nome termina com o carimbo de data e hora: `nome-da-cena_snap001_2026-08-07-1432.png`. O contador não sai — a data diz quando, o contador diz qual veio antes dentro do mesmo minuto.

> **Saída em mapa de profundidade:** construída na fase 13 (2026-07-31) — uma escolha por saída, no painel de cada uma. Ver "Depth map da câmera de cena".

## Mini animador (fase 10)

Pedido do usuário em 2026-07-27: um mini animador automático que interpola entre vários keyframes (bonecos posicionados + posição de câmera, com a duração de cada transição em milissegundos) e **exporta um MP4**. Isto **muda o escopo declarado no topo deste plano** — "geração de animações" saiu de "fora de escopo" e virou a fase 10; a decisão é do usuário e está registrada em `DECISOES.md` #52, junto com as outras quatro escolhas que fecharam as ambiguidades levantadas antes de planejar.

### Premissas do pedido (transcritas)

1. Usar o **mecanismo de interpolação já existente** — o da mistura de poses (`poseBlend.ts`, #43) e o do movimento de câmera entre dois pontos (`cameraMove.ts`, #46).
2. Vários keyframes, cada um com bonecos posicionados + posição de câmera, e a duração da interpolação entre eles em milissegundos.
3. Durante a animação **não** aparecem: destaque de junta selecionada, gizmos, régua e grade do chão — exatamente o que sairia numa imagem exportada.
4. Membros atravessarem o próprio corpo, outro boneco ou o chão **não é problema**: quem resolve é o usuário, com os keyframes certos.
5. Saída em **MP4**, avaliando a `mediabunny` para isso.

### Decisões que destravaram o plano (perguntadas ao usuário antes de escrever)

| Questão | Decisão |
|---|---|
| Colisão de nomes: "keyframe" já era o PNG exportado | **Renomear o PNG para "instantâneo"/`snapshot`.** "Keyframe" passa a ser o marco de animação — o significado correto da palavra |
| A correção de chão do `blendPoses` levanta o boneco no meio da transição | **Desligada na animação.** A premissa 4 diz que atravessar o chão é aceitável; levantar o boneco criaria um movimento vertical que o usuário não pôs nos keyframes. O slider de mistura de poses **mantém** a correção |
| Onde a animação vive | **No workspace, como a biblioteca de poses** (#42): `localStorage` + `animations.json` na pasta do workspace, disponível a partir de qualquer cena. Não viaja no `.glb` da cena |
| O PNG exportado ainda mostra a junta amarela | **Corrigir também o PNG**, sob a mesma opção "Ocultar grade/gizmos" — uma regra só, e a frase "o vídeo mostra o mesmo que a imagem" passa a ser literalmente verdadeira |

### Passo 0 — renomeação `keyframe` → `snapshot`

Mecânico, mas precisa vir primeiro: enquanto a palavra estiver ocupada, todo nome novo sai torto. Toca `src/keyframe/` → `src/snapshot/`, `KeyframeCapture.tsx` → `SnapshotCapture.tsx`, `keyframeCaptureStore.ts` → `snapshotCaptureStore.ts`, `KeyframePanel.tsx` → `SnapshotPanel.tsx`, `formatKeyframeFilename` → `formatSnapshotFilename`, `nextKeyframeNumber`/`consumeKeyframeNumber` no `figuresStore`, as chaves `panels.keyframes.*` do i18n nos dois idiomas e a descrição do atalho `Espaço` no `SHORTCUT_CATALOG`.

Dois pontos que **não** são renomear-e-pronto:

- **Formato da cena.** O campo gravado é `keyframeCounter`. Passa a **gravar** `snapshotCounter` e a **ler os dois** (novo primeiro, antigo como fallback), sem subir `SCENE_EXTRAS_VERSION` — é adição de campo, e cenas antigas continuam abrindo com a sequência intacta. Mesma regra no autosave.
- **Prefixo do arquivo.** `kf###` → `snap###`. O contador é por cena e continua de onde estava, então uma cena que já gravou até `kf012` grava o próximo como `snap013`: a sequência não reinicia e não há risco de sobrescrever nada na pasta.

### Modelo de dados

```ts
// src/animation/animation.ts
export interface AnimationKeyframe {
  id: string
  /** Duração, em ms, da transição que CHEGA a este keyframe. A do primeiro é ignorada. */
  durationMs: number
  /** Bonecos inteiros: pose, colocação, altura, cor, visibilidade. */
  figures: Figure[]
  /** Câmera viva: posição, alvo, topo da tela e lente — o mesmo `CameraViewState` do movimento (#46). */
  camera: CameraViewState
}

export interface Animation {
  id: string
  name: string
  keyframes: AnimationKeyframe[]
}
```

**A duração é a da chegada, não a da saída.** É o que casa com o jeito de montar: posa-se a cena, aponta-se a câmera, clica-se "Capturar keyframe" e diz-se em quanto tempo se chega até ali. Com a duração "até o próximo", o último keyframe teria um campo sem sentido e todo keyframe novo obrigaria a voltar e editar o anterior. Duração total = soma das durações.

**A câmera é lida viva, não do store.** Posição/alvo/topo não existem em estado React — vivem no `THREE.Camera` e no `OrbitControls`. Capturar reusa o caminho já aberto pelo `captureMovePoint` (#46): um comando pendente que o `CameraRig` executa, monta o `CameraViewState` e o entrega ao store.

### Interpolação (`src/animation/animationSampler.ts`)

`sampleAnimation(animation, timeMs)` devolve `{ figures, camera }` — o estado exato da cena naquele instante. É função pura, sem `three` a não ser pela matemática já existente, e portanto 100% testável sem GPU.

- **Câmera:** `interpolateCameraView(a, b, t)` sem alteração nenhuma. Alvo em linha reta, direção por arco, distância e lente em progressão geométrica — é exatamente o que o movimento entre dois pontos já faz.
- **Pose e giro do boneco:** o cálculo por eixo do `blendPoses`, **sem a correção de chão** (decisão acima). Na prática, `poseBlend.ts` ganha uma opção `{ groundCorrection: boolean }` com o padrão `true`, de modo que o slider de mistura não muda de comportamento. Desligar também elimina o custo de reconstruir as 32 juntas de cada boneco a cada quadro só para medir o afundamento.
- **Buraco real a tapar:** `BlendablePose` só carrega `positionY` — a mistura de poses nunca precisou de X/Z porque acontece parada no lugar. Uma animação precisa: um boneco que atravessa a cena muda X e Z. O amostrador interpola a **posição inteira** em linha reta, e o `y` continua saindo do mesmo lugar de sempre.
- **Propriedades que não interpolam** (`name`, `color`, `visible`, `height`): valem em **degrau**, com o valor do keyframe de partida do trecho. Cor e visibilidade são identidade, não movimento; altura é característica da personagem, e vê-la crescer no meio de um plano seria efeito, não animação. Trocar a visibilidade entre dois keyframes é, portanto, como um boneco entra e sai de cena.
- **Bonecos que só existem numa ponta:** o conjunto de bonecos do trecho é o do keyframe de **partida**. Quem também está na chegada interpola; quem não está fica parado no valor de partida. Um boneco que aparece só a partir do keyframe 3 entra em cena no keyframe 3, sem transição — o que é previsível e o que o usuário controla com os keyframes.
- **Bordas:** `timeMs ≤ 0` devolve o primeiro keyframe **idêntico** (o próprio objeto, sem ruído de ponto flutuante), `timeMs ≥ total` devolve o último — mesmo contrato das pontas do `blendPoses` e do `interpolateCameraView`.
- **Consequência assumida:** a interpolação é **linear em `t`**, então a velocidade é constante dentro de cada trecho e muda de golpe em cada keyframe. É o mecanismo existente, como a premissa 1 pediu. Suavização de entrada/saída fica anotada como ideia futura, não construída.

### Estado

Segue a divisão que o projeto já usa entre conteúdo e ferramenta:

- **`figuresStore.ts`** ganha `animations: Animation[]` e `nextAnimationSeq`, dentro do `partialize`/`equality` do `zundo` — igual à biblioteca de poses: criar, remover, reordenar e editar keyframe **entram no undo** e no autosave.
- **`src/store/animationStore.ts`** (novo, fora do undo, no modelo do `cameraStore`/`snapshotCaptureStore`): qual animação está aberta, `timeMs`, tocando ou não, fps, resolução, e o estado da exportação (progresso, cancelamento, erro). É navegação e configuração de ferramenta, não conteúdo.

### Reprodução na tela

Um componente sem visual dentro do `<Canvas>` (`src/scene/AnimationPlayer.tsx`, no molde do `CameraRig`/`SnapshotCapture`) avança o tempo por `requestAnimationFrame` usando o relógio de parede, amostra a animação e publica o resultado como **estado de pré-visualização**; o `Viewport` renderiza `previewFigures ?? figures`, sem tocar na cena de trabalho — parar a reprodução devolve a cena intacta. A câmera é posta no lugar pelo mesmo `applyView` do `CameraRig`.

**Ponto de medição obrigatório, não estimativa:** esse caminho re-renderiza a árvore React da cena a cada quadro (5 bonecos × 32 juntas ≈ 500 objetos). Antes de dar a reprodução por pronta, medir o tempo médio por quadro com 5 bonecos. Se passar de ~30 ms, a saída é o caminho imperativo — escrever as rotações direto nos `Group`s vivos, que o `Viewport` já registra num mapa `figureId:jointName` (`onJointRef`). A exportação **não** depende dessa medição: ela roda fora do tempo real, e um quadro lento só a deixa mais demorada, nunca menos fiel.

### Exportação MP4

**Determinística, quadro a quadro — não uma gravação em tempo real.** Nada de `canvas.captureStream()`/`MediaRecorder`: a taxa real de quadros dependeria da velocidade da máquina e o vídeo sairia diferente a cada exportação. O laço é: congelar o loop do R3F, e para cada quadro `i` amostrar em `t = i × 1000/fps`, aplicar, renderizar e entregar ao codificador.

- **Linha do tempo (`frameTimeline.ts`, pura e testável):** `n = round(total/1000 × fps) + 1` quadros, o quadro `i` no instante `i/fps` s com duração `1/fps` s. O `+1` é o quadro final: uma animação de 1 s a 30 fps tem 31 quadros, do instante 0 ao instante 1,0 inclusive.
- **O que se vê no vídeo:** um sinalizador de exportação no `uiStore` faz o `Viewport` montar a cena **sem** régua, gizmos, indicador de grade e destaque de junta, e o `SceneContent` sem a grade do chão. É a premissa 3 resolvida na árvore React, num único commit antes do laço, e não com um passe imperativo por quadro. O mesmo sinalizador é o que dá ao PNG o comportamento novo do destaque de junta.
- **Resolução e proporção:** reusa os presets do instantâneo e o mesmo trecho que ajusta `gl.setSize`/`camera.aspect` e restaura tudo depois — extraído do `SnapshotCapture.tsx` para um helper `renderAtResolution`, compartilhado pelos dois. Dimensões são forçadas a números **pares** (H.264 trabalha em macroblocos).
- **Destino:** `writeFileToDirectoryOrDownload` — a mesma pasta e o mesmo fallback de download do instantâneo. Nome: `nome-da-animação.mp4`, com carimbo de data e hora desde 2026-08-07 (`nome-da-animação_2026-08-07-1432.mp4`, ver `DECISOES.md` #135).
- **Progresso e cancelamento:** o laço é assíncrono (cede o controle a cada quadro), então a UI mostra "quadro 42 de 300" e o botão de cancelar funciona de verdade.

### Biblioteca de vídeo: `mediabunny` — avaliada e aprovada

Pesquisada a pedido do usuário (versão 1.51.0 em 2026-07-27):

- **Licença MPL-2.0** — copyleft **fraco, por arquivo**: usada como dependência não modificada, não contamina o nosso código. Diferente do caso da `mannequin.js`, descartada no início do projeto por ser GPL-3.0.
- **Zero dependências de runtime** (só dois pacotes de tipos), TypeScript puro, muito tree-shakable, e **funciona offline depois de empacotada** — respeita a regra de "nenhuma dependência de rede em runtime".
- **É o que precisamos e pouco mais:** `Output` + `Mp4OutputFormat` + `BufferTarget`, e um `CanvasSource` que lê o nosso próprio canvas WebGL. O `add(timestamp, duration)` recebe os tempos em segundos e devolve uma promessa que serve de contrapressão — é exatamente a forma do nosso laço.

```ts
const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() })
const source = new CanvasSource(gl.domElement, { codec: 'avc', bitrate: QUALITY_HIGH })
output.addVideoTrack(source, { frameRate: fps })
await output.start()
for (const frame of frames) { /* amostrar, renderizar */ await source.add(frame.timeS, frame.durationS) }
await output.finalize()
```

- **Codec:** `avc` (H.264) primeiro, por ser o que qualquer player abre; a disponibilidade é consultada em runtime e há queda para `av1`/`vp9` dentro do próprio MP4. Sem nenhum codificador disponível, o botão fica desabilitado com mensagem própria (i18n), em vez de falhar no meio.
- **Alternativa considerada:** `mp4-muxer` (do mesmo autor) só *empacota* — a codificação ficaria por nossa conta em WebCodecs cru. A `mediabunny` é a evolução dela e cobre as duas metades. Não há motivo para escolher a peça menor.

### Painel de UI

Painel novo (`AnimationPanel.tsx`), sétima coluna do `app-shell__body`, **nascendo recolhido** — o `uiStore` já persiste o estado de recolhimento por painel, e cinco painéis abertos já ocupam boa parte da tela.

- Combo de animações + criar / renomear / remover, no padrão do painel de Cenas.
- Lista de keyframes: número, duração em ms editável, mover ↑↓, "atualizar com o estado atual", remover, e "ir para" (põe a cena e a câmera naquele keyframe para poder ajustá-lo).
- "Capturar keyframe" — lê a cena e a câmera de uma vez.
- Linha do tempo: slider de 0 até a duração total, com tocar/parar.
- fps (24/25/30/60) e resolução (presets do instantâneo).
- "Exportar MP4", com barra de progresso, cancelar e a mensagem de erro quando o navegador não codifica.
- Toda string nasce como chave nos **dois** dicionários. Sem atalho de teclado novo nesta fase: `Espaço` é do instantâneo, e o mapa está fechado.

### Testes (TDD, como todo o resto)

Lógica pura, com teste que falha primeiro:

- **Amostrador:** `t=0` devolve o primeiro keyframe idêntico; `t=total`, o último; um trecho conhecido no meio confere valor a valor; **X/Z interpolam**; propriedades não interpoláveis ficam em degrau; boneco presente só numa ponta fica parado; duração 0 não divide por zero; e um teste que **trava a decisão da correção de chão** — uma pose que afunda no meio do caminho tem de afundar mesmo, e a mesma mistura pelo slider tem de continuar levantando.
- **Linha do tempo:** contagem de quadros e instantes para durações/fps variados, incluindo o quadro final e durações que não são múltiplos do fps.
- **Store:** adicionar/remover/reordenar/editar keyframe, undo/redo, e o round-trip do autosave e do `animations.json`.
- **Painel:** RTL, incluindo os estados desabilitados (sem animação, sem keyframes, sem codificador).
- **Paridade de i18n:** já coberta pelo teste existente.
- **Fora do teste automatizado** (como `CameraRig` e a captura de PNG): WebGL real e WebCodecs não existem em jsdom. Validação no navegador via Playwright sobre o `preview`, conferindo console limpo, o arquivo gerado e a duração/contagem de quadros do MP4.

### Riscos e mitigações

- **WebCodecs indisponível** (hoje: Firefox para Android). Detecção em runtime e o botão desabilitado com explicação — o mesmo padrão da File System Access API.
- **Canvas WebGL sem `preserveDrawingBuffer`:** o `CanvasSource` lê o canvas na hora do `add()`, e o buffer só é válido no mesmo passo síncrono do `gl.render`. É a mesma restrição sob a qual o `toBlob` do instantâneo já vive há quatro fases, então o laço mantém `render` e `add` juntos. Se ainda assim sair preto, a saída é copiar o quadro para um canvas 2D intermediário e alimentar um `VideoSampleSource`.
- **Memória:** o `BufferTarget` monta o arquivo inteiro em RAM — a 1080p30 e ~8 Mbps dá cerca de 1 MB por segundo de vídeo, ou ~60 MB para um minuto. Aceitável; se um dia incomodar, o caminho é o `StreamTarget` gravando direto num `FileSystemWritableFileStream`.
- **Peso do bundle:** o build já avisa sobre chunk >500 KB por causa do `three`. Medir o efeito da `mediabunny` depois de instalar; ela é tree-shakable e só usaremos o caminho de escrita de MP4.
- **Proporção do viewport ≠ proporção da exportação:** o enquadramento visto na tela não é o que sai no arquivo. Fica anotado como melhoria barata (uma máscara de *letterbox* no viewport enquanto o painel de animação estiver aberto), fora do pedido literal — decisão do usuário se entra. ✅ **Construída em seguida, ainda em 2026-07-27** (ver `DECISOES.md` #53) — e a estimativa de "barata" estava errada pela metade: o retângulo sozinho MENTIRIA, porque a exportação preserva o campo de visão vertical e alarga o horizontal; a máscara precisa afastar a câmera até o quadro inteiro caber. Também não ficou presa ao painel de animação: vale para o instantâneo também, com um seletor de qual saída.

### Ordem de execução

1. Passo 0: renomeação `keyframe` → `snapshot`, com a suíte verde antes e depois.
2. `animation.ts` + `animationSampler.ts` + `frameTimeline.ts` (lógica pura, TDD estrito) e a opção `groundCorrection` no `poseBlend.ts`.
3. `figuresStore` (conteúdo, undo) + `animationStore` (ferramenta) + autosave + `animations.json` + manifesto do workspace.
4. Captura de keyframe pelo `CameraRig` e "ir para" um keyframe.
5. `AnimationPanel` com a lista, a linha do tempo e a reprodução — inclui a **medição** do custo por quadro.
6. Sinalizador de exportação: cena limpa no vídeo **e** no PNG.
7. `mediabunny`, `renderAtResolution` compartilhado e o laço de exportação com progresso e cancelamento.
8. Validação no navegador e registro em `DECISOES.md`.

## Depth map da câmera de cena (fase 13) ✅

> **Construído em 2026-07-31** (ver `DECISOES.md` #91). O texto abaixo é o levantamento de viabilidade original, preservado porque é onde as alternativas foram pesadas; o que ficou decidido e o que foi construído estão em "Decisões tomadas" e "O que foi construído", no fim da seção.

Pergunta do usuário em 2026-07-31: a aplicação permite gerar, a partir da câmera de cena, uma saída em **mapa de profundidade** — bonecos e partes de boneco mais próximos da câmera em cinza mais claro, escurecendo conforme a distância? **Não permitia**: não havia `MeshDepthMaterial`, `overrideMaterial` nem qualquer modo de saída alternativo no projeto. Esta seção nasceu como levantamento de viabilidade, pedido explicitamente **sem alterar código**.

### Por que o encaixe é bom

Três coisas que já estão prontas e costumam ser o trabalho chato:

1. **`sceneCapture.ts` é funil único.** PNG (`SnapshotCapture.tsx`) e MP4 (`AnimationPlayer.tsx`) passam os dois por `renderAtResolution(gl, scene, camera, w, h, consume)`. Um modo de saída novo entra num lugar só.
2. **O padrão de mutação temporária já existe**, com o tipo `RestoreScene` e três exemplos (`hideOverlays`, `muteJointHighlight`, `revealEditorHidden`). O passe de profundidade é um quarto irmão — `applyDepthMaterial(scene): RestoreScene` —, sem inventar arquitetura.
3. **O PNG já sai da câmera de cena** (fase 11), que é exatamente a que o pedido cita. E `applyOutputAspect` já mexe na projeção da câmera durante a captura e restaura depois — é o vizinho natural do ajuste de faixa de profundidade.

A polaridade pedida também é a nativa: o `MeshDepthMaterial` do three com `BasicDepthPacking` emite `vec3(1.0 - fragCoordZ)` — **perto = claro, longe = escuro**, sem inverter nada.

### O problema real: a faixa de profundidade

A câmera usa `near: 0.1, far: 100` (`scene/constants.ts`). Profundidade em perspectiva se distribui em `1/z`, então com essa faixa a imagem sai **praticamente preta**:

| Distância da câmera | Cinza com `near 0,1 / far 100` | Cinza com `near 2 / far 6` |
|---|---|---|
| 3 m (distância típica de trabalho) | 0,032 | 0,50 |
| 5 m | 0,019 | 0,90 |

Com a faixa atual, o boneco inteiro ocupa **cerca de 3 níveis de 256**. Apertar `near`/`far` em volta do conteúdo visível durante a captura é o que torna a saída utilizável — e é um passe temporário, no mesmo molde do `applyOutputAspect`. Note que, mesmo apertada, a rampa continua não-linear: o primeiro metro come metade da escala.

### Duas rotas

| Rota | Como | Custo | Resultado |
|---|---|---|---|
| **A** | `MeshDepthMaterial` + faixa apertada calculada do bounding box | meia dúzia de linhas mais o cálculo dos limites | cinza **não-linear**; serve para leitura visual de profundidade |
| **B** | `ShaderMaterial` próprio com distância linear em espaço de vista | ~30 linhas de GLSL | rampa **linear**, com controle de inversão e de faixa |

**Recomendação: a rota B**, se o destino for outro software (ControlNet, compositing, relighting) — é o que essas ferramentas esperam, e o custo a mais é pequeno. A rota A basta se o depth map for só para leitura humana de volume.

### O que mais precisa entrar no passe

- **O fundo.** `Viewport.tsx` põe `<color attach="background">` com o cinza do ambiente (`#808080` no tom médio). Sob um material de profundidade ele continua sendo desenhado e leria como distância média — precisa ir a preto durante a captura, e voltar depois.
- **A elipse de contato** (`FigureShadow`) é `transparent` com `depthWrite={false}`. Sob um material de profundidade vira um **disco opaco** no chão. Quase certamente tem de sumir no passe — mas é regra nova, não a de "ocultar grade/gizmos".
- **Tipagem.** `renderAtResolution` recebe `scene` como `THREE.Object3D`, e tanto `overrideMaterial` quanto `background` são de `THREE.Scene`. A troca material a material por `traverse` (o que o `muteJointHighlight` já faz) evita o problema e mantém a assinatura.
- **Os objetos de cena** (item 42) entram sozinhos, e é o desejado: são volume de cenário e é isso que um depth map deve mostrar.
- **Papel-cebola e gizmos** já estão em `OVERLAY_NAMES` e já somem na captura — nada a fazer.

### Decisões tomadas (respondidas pelo usuário antes de implementar)

| Questão | Decisão |
|---|---|
| Rota A (nativo, não-linear) ou B (shader linear)? | **Rota B.** Um `ShaderMaterial` próprio com a distância linear em espaço de vista — é o que ferramentas de fora esperam, e o custo a mais é pequeno |
| O chão | **Entra desenhado, mas fora da conta da faixa.** Ele dá contato e leitura de volume; um plano de 20 m dentro da caixa envolvente espremeria o boneco em poucos níveis de cinza. **Revisto em seguida** (ver "O chão, revisitado") |
| A elipse de contato | **Sai sempre** no modo profundidade — é regra do modo, não a opção "ocultar grade/gizmos", que continua valendo para grade, gizmos, régua e papel-cebola |
| Vale para o MP4? | **Sim**, com escolha própria no painel de Animação |
| Modo alternativo ou segunda saída? | **Modo alternativo: uma saída gera UM arquivo.** Quem quer as duas versões gera duas vezes. O arquivo de profundidade leva o sufixo `_depth` — sem ele, o MP4 sobrescreveria o vídeo normal da mesma animação |
| Faixa automática ou manual? | **Automática por padrão, travável.** A caixa envolvente do conteúdo visível é o padrão; travar perto/longe é o que dá uma sequência com escala estável |
| Onde ficam os controles | Faixa (compartilhada pelas três saídas) numa seção **"Configurações" do painel de Cenas**; a alternância da **tela na Toolbar**, ao lado da régua e da casca do boneco; a escolha de cada saída no painel dela |
| Escopo da vista na tela | **Sempre que estiver ligada** — posando, navegando pela linha do tempo ou com a animação tocando |

**Restrição que valeu para tudo:** nenhuma funcionalidade existente muda de comportamento. A profundidade é uma forma **alternativa** de visualizar e de exportar a mesma cena.

### O que foi construído

- **`src/scene/depthMap.ts`** — a peça inteira: cálculo da faixa (caixa envolvente do conteúdo visível → distância no eixo de visão), os dois `ShaderMaterial` lineares (conteúdo e chão, diferindo só no recorte) e os passes no molde `RestoreScene` de `sceneCapture.ts`: `applyDepthMaterials`/`attachDepthMaterials` (tela), `applyDepthPass` (vídeo, materiais reaproveitados), `applyDepthMaterial` (PNG) e `suspendDepthMaterial` — este último é o que garante a independência das três escolhas, forçando o modo normal numa saída normal mesmo com a tela em profundidade.
- **`src/store/depthStore.ts`** — as três escolhas e a faixa, fora do undo e fora dos arquivos, como o `snapshotCaptureStore`. Não persiste: abrir o app com o viewport em cinza seria um susto.
- **`src/scene/DepthPreview.tsx`** — a vista na tela, dentro do `<Canvas>`, no molde do `CameraRig`. O fundo preto é do `Viewport`, por React: dois donos para a mesma propriedade deixariam a vista presa no preto ao desligar o modo.
- **Nomenclatura:** `formatSnapshotFilename(nome, seq, { depth })` e `formatAnimationFilename(nome, { depth })`, com o sufixo `_depth` compartilhado. Desde 2026-08-07 as duas aceitam também `{ now }` e terminam o nome com o carimbo de data e hora, **depois** do `_depth` (#135).

### O chão, revisitado (ainda em 2026-07-31)

Ficar de fora da conta da faixa resolveu metade do problema e criou a outra: como a faixa é medida só pelos bonecos, o chão em primeiro plano cai **fora** dela e, grampeado, vira uma cunha branca chapada. Com a câmera padrão (2 m de altura, 35 mm, boneco a ~5,4 m) o chão entra no quadro a ~2,5 m e o boneco começa a ~5 m: são dois metros e meio de branco liso ocupando a metade de baixo da imagem, no **mesmo branco** que deveria pertencer à superfície mais próxima do boneco — que passa a se confundir com o piso.

Quatro rotas foram avaliadas (chão fora do passe · recortado pela faixa · encolhido em volta dos bonecos · dentro da conta da faixa) e o usuário escolheu **um seletor de três valores**, com o recorte como padrão:

| Valor | O que faz |
|---|---|
| `clipped` (padrão) | O chão só é desenhado onde a profundidade dele cai **dentro** da faixa. Sobra o "tapete" em volta dos pés, de branco a preto; a cunha some. O recorte é por PROFUNDIDADE, não por geometria — a borda acompanha a distância, não um retângulo no mundo |
| `hidden` | O chão some do mapa, como a elipse de contato. Silhueta limpa sobre preto |
| `full` | O comportamento da primeira versão: rampa inteira e grampeamento |

**Custo arquitetural, e por que valeu:** o chão precisa de um material **diferente** do resto, e `scene.overrideMaterial` é um só para a cena inteira. A troca passou a ser material a material, por `traverse` — que era, aliás, o que o levantamento original previa. Os originais ficam em marcas de `userData` (`depthOriginalMaterial`, `depthHidden`), e não numa closure: é isso que permite a um passe desfazer o que outro fez, que é exatamente o que a independência das três escolhas exige. A aplicação é **idempotente**, e a vista na tela a repete a cada quadro — assim ela alcança um boneco ou um objeto criado depois de o modo ter sido ligado.

**Sem folga na faixa** (também decidido aqui): a superfície mais próxima continua em 1,0 e a mais distante em 0,0, usando os 256 níveis inteiros. É o que dá o máximo de resolução de profundidade sobre o boneco.

### O que não foi feito (e por quê)

- **PNG de 16 bits / `packDepthToRGBA`:** continua sendo o teto anotado nos riscos. Só vale a pena se um pipeline real reclamar da quantização.
- **A faixa automática ainda "respira"** num vídeo em que a câmera se aproxima: ela é remedida a cada quadro. É exatamente o que a trava resolve, e por isso ela existe.

### Riscos e mitigações

- **PNG de 8 bits por canal.** `canvas.toBlob('image/png')` sobre canvas WebGL não dá 16 bits. Para leitura visual é irrelevante; para um pipeline que quantiza de novo, é o teto. Mitigação, se um dia pesar: `packDepthToRGBA` (o `DEPTH_PACKING 3201` do próprio three) grava 32 bits espalhados nos quatro canais — deixa de ser uma imagem legível a olho, e vira dado.
- **Escala instável entre quadros**, se a faixa for automática e a câmera se mover. É a razão de ser da decisão 5.
- **Nada disso é testável com GPU real em jsdom** — a captura já vive assim desde a fase 5. Mitigação: a parte pura (cálculo da faixa a partir dos limites, decisão do que esconder) fica em `sceneCapture.ts` e **é** testável, que é exatamente a divisão que o projeto já pratica.

### Ordem de execução

1. ✅ Função pura de faixa de profundidade a partir do bounding box do conteúdo visível, com TDD estrito.
2. ✅ `applyDepthMaterial` + apagamento do fundo e da elipse, no molde `RestoreScene` de `sceneCapture.ts`, com teste de restauração exata (o que entrou volta, o que já estava apagado continua apagado).
3. ✅ Opção no painel de Instantâneos e o sufixo em `snapshotNaming.ts`, com as chaves de i18n nos dois idiomas — mais a do painel de Animação, a da Toolbar e a faixa no painel de Cenas.
4. ⏳ Conferência visual no navegador — **o que falta**. A rota B foi escolhida antes de implementar, então o que se confere aqui é o resultado, não a escolha.
5. ✅ Registro em `DECISOES.md` (#91) e a entrada de entrega no `HISTORICO.md`.

**Estimativa original: meio dia**, sem contar a decisão sobre a rota.

## Modelo de desenvolvimento: TDD

Todo recurso segue o ciclo **red → green → refactor**: (1) escrever um teste que expressa o comportamento esperado e **falha**; (2) implementar o mínimo para o teste passar; (3) refatorar mantendo os testes verdes. Nenhum recurso é considerado pronto sem teste que o valide.

**Ferramentas:** **Vitest** (nativo do ecossistema Vite) + **React Testing Library** com ambiente `jsdom` para componentes de UI; **@react-three/test-renderer** para testar o grafo de cena R3F sem GPU. `npm test` roda tudo em modo watch durante o desenvolvimento; a suíte completa deve passar antes de cada fase ser dada como concluída.

**Estratégia por camada** — a arquitetura já separa a lógica (testável headless) da renderização, e o TDD reforça essa separação:

- **Lógica pura (maior cobertura, TDD estrito):** definição do esqueleto e limites articulares (aplicar rotação fora do limite → valor é grampeado), solver IK (alvo alcançável → extremidade converge; inalcançável → melhor aproximação sem violar limites), serialização (round-trip estado → `.glb`/`extras` → estado idêntico; fallback por nomenclatura de nós; migração de `version`; round-trip também para a exportação escopada de um boneco individual e de um conjunto de bookmarks de câmera, incluindo a mesclagem de bookmarks importados com os existentes), regras de cena (máximo 5 bonecos, cores únicas, duplicação copia pose), mapa de atalhos (`shortcuts.ts` sem conflitos e ignorado em campos de texto), nomenclatura sequencial de keyframes.
- **Componentes de UI:** painéis, listas e formulários via React Testing Library (ex.: adicionar 5º boneco desabilita o botão de adicionar); teste de completude de i18n — toda chave usada existe em **ambos** os dicionários (pt-BR e en), sem strings hardcoded.
- **Grafo de cena:** hierarquia de juntas montada corretamente, seleção e visibilidade, via @react-three/test-renderer.
- **O que não entra em teste automatizado:** aparência renderizada (cores na tela, sombras, gizmos) e captura real de PNG — validação manual num checklist por fase; o teste de round-trip com o Blender da fase 6 também é manual, com o arquivo `.glb` de fixture versionado no repositório.

## Fases de implementação

| Fase | Entrega | Conteúdo |
|---|---|---|
| 1 ✅ | Fundação | Vite+TS+R3F, **Vitest + React Testing Library configurados desde o início**, **i18n (react-i18next, pt-BR + en)**, viewport, ambiente neutro, OrbitControls, layout da UI (toolbar, painéis) |
| 2 ✅ | Boneco | `skeleton.ts` (27 juntas + limites, escala em metros), geometria por primitivas, cores, altura ajustável, gestão de até 5 bonecos |
| 3 ✅ | Pose FK | Seleção de junta, gizmo de rotação com limites, sliders, posicionamento do root, duplicar boneco, **undo/redo (zundo)** |
| 4 ✅ | Câmera | FOV, presets ortográficos, bookmarks |
| 5 ✅ | Keyframes | Captura PNG com resolução configurável, numeração sequencial persistida, **File System Access API para escolher diretório** (fallback: download) |
| 6 ✅ | Persistência e PWA | Autosave localStorage, lista de cenas (workspace), gravar/reabrir `.glb` (glTF 2.0 com `extras`), **exportar/importar boneco individual e conjunto de bookmarks de câmera separadamente (mesmo `.glb`)**, teste de ida e volta com o Blender, **PWA (vite-plugin-pwa)** para uso instalado sem servidor |
| 7 ✅ | IK | IK analítico de 2 ossos para membros (troca de CCD, ver `DECISOES.md` #12), alvos arrastáveis, alternância FK/IK |
| 8 ✅ | Polimento | Poses predefinidas, painel de ajuda de atalhos |
| 9 ✅ | Refinamentos de UX e workspace | Botão de ajuda na Toolbar, indicador de "salvo", desfazer/refazer na Toolbar, aviso de erro ao importar `.glb` inválido, indicador de membros com IK ativo, resetar pose por junta, **botão "novo workspace" (limpar e resetar todo o ambiente)**, painéis recolhíveis, cores de eixo nos controles, indicador de alinhamento com a grade, régua vertical, gizmo de rotação da raiz |
| 10 ✅ | Mini animador | Renomeação `keyframe`→`snapshot`, keyframes de animação (bonecos + câmera + duração em ms), interpolação reusando `poseBlend`/`cameraMove`, reprodução no viewport, cena limpa na saída e **exportação MP4 com `mediabunny`** — ver "Mini animador" |
| 11 ✅ | Câmera de cena | Câmera de cena separada do viewport de trabalho, gizmo estilo Blender, controles numéricos de posição/rotação e máscara por proporção com preset 9:16 — ver `DECISOES.md` #78 e subnúmeros |
| 12 ✅ | Animação em arquivo | Exportar/importar uma animação em JSON, com remapeamento de elenco para os bonecos da cena — ver `DECISOES.md` #79 |
| 13 ✅ | Depth map | Saída em mapa de profundidade a partir da câmera de cena — perto claro, longe escuro, rampa linear. Escolha independente por saída (tela, PNG e MP4), faixa automática ou travada — ver "Depth map da câmera de cena" e `DECISOES.md` #91 |

*(as linhas 11 e 12 entraram na tabela em 2026-07-31, junto com a 13: as duas fases foram entregues sem passar por aqui — o registro delas está no `HISTORICO.md`.)*

Fases 1–6 formam o MVP completo dos requisitos 1–7; IK (fase 7) é o incremento de usabilidade acordado. Os atalhos de teclado (ver observação abaixo) são implementados incrementalmente junto com cada funcionalidade — ex.: setas, Tab e Ctrl+Z na fase 3, Espaço na fase 5, Ctrl+S na fase 6 — e não deixados para o final.

## Observação: uso do teclado

O teclado deve ser cidadão de primeira classe na aplicação, não um extra de polimento — toda ação frequente precisa ter atalho para agilizar o fluxo de posar/capturar. **Mapa completo, todo implementado** (fechado em 2026-07-25; a única proposta original descartada está anotada abaixo):

- **Setas:** rotação da junta selecionada no eixo ativo — passo normal; **Shift+setas** = passo maior; **Ctrl+setas** = passo fino. Com o root selecionado, setas movem o boneco no plano do chão.
- **Tab / Shift+Tab:** ciclar entre articulações do boneco atual; **1–5:** selecionar boneco pelo número.
- **Espaço:** capturar keyframe (ação mais frequente do fluxo; interceptado com `preventDefault` para não rolar a página/acionar botão focado).
- **W / E:** gizmo da raiz em mover / girar, na convenção dos softwares 3D; **R:** alternar FK/IK no membro da junta selecionada.
- **Ctrl+Z / Ctrl+Shift+Z (ou Ctrl+Y):** desfazer/refazer; **Ctrl+S:** salvar a cena de trabalho no catálogo (regrava a cena ativa, não duplica); **Ctrl+D:** duplicar boneco selecionado.
- **F:** enquadrar câmera no boneco selecionado; **teclado numérico (1/3/7, convenção Blender):** presets ortográficos; **Shift+1..5:** bookmarks de câmera.
- **Esc:** limpar seleção; **Delete:** remover boneco selecionado — sem diálogo de confirmação, Ctrl+Z desfaz; **H:** mostrar/ocultar boneco.
- **?**: painel de ajuda com a lista completa de atalhos.

**Descartado do mapa original:** o `Q` ("modo selecionar", do quarteto `Q/W/E/R` proposto no início) — o app não tem um modo de seleção separado para ativar (a seleção decide sozinha o que o gizmo faz), e `Esc` já limpa a seleção. Ver `DECISOES.md` #32.

Diretrizes:

- **Atalhos que o navegador não deixa interceptar são proibidos no mapa:** Ctrl+1..9 (troca de abas), Ctrl+W/T/N e **Alt+setas** (voltar/avançar no histórico) — por isso o passo fino usa Ctrl+setas e os bookmarks usam Shift+1..5, não Ctrl+números nem Alt. Já Ctrl+S e Ctrl+D **são** interceptáveis via `preventDefault` e podem ser usados. No PWA instalado (janela própria) essa restrição praticamente desaparece, mas o mapa deve funcionar no pior caso (aba de navegador).
- Atalhos são ignorados quando o foco estiver em campos de texto.
- O mapa fica centralizado em um módulo único (`shortcuts.ts`) para manutenção, teste de conflitos e exibição no painel de ajuda.

## Riscos e mitigações

- **IK instável/antinatural** → restringir a cadeias de 2 elos com limites articulares e damping; FK sempre disponível como fallback.
- **Picking de juntas pequenas** (agravado pelas juntas de polegar/dedos) → esferas de junta com raio de colisão maior que o visual; ciclo de seleção por clique repetido; Tab/Shift+Tab e zoom como alternativa garantida ao clique.
- **File System Access API indisponível (Firefox/Safari)** → detecção de recurso e fallback automático para download convencional; a UI indica qual modo está ativo.
- **Captura em alta resolução em GPU fraca** → render único sob demanda (não contínuo) e teto de resolução (ex.: 4K).
- **Gizmo vs. OrbitControls disputando o mouse** → padrão consolidado do drei: desabilitar OrbitControls enquanto o TransformControls arrasta.
- **Ida e volta com o Blender (.glb)** → o Blender só preserva `extras` com a opção de custom properties ligada, e pode renomear nós duplicados; mitigação: reconstrução a partir do `skeleton.ts` + convenção de nomenclatura de nós como contrato + teste de round-trip (app → Blender → app) incluído na fase 6.

> **Propostas de melhoria:** consolidadas numa lista única no fim deste documento — ver "Propostas de melhoria — lista única".

## Progresso

O log de entregas mudou de arquivo em 2026-07-31: está em **`HISTORICO.md`**, em ordem cronológica e com índice. Este documento ficou com o que o app é e o que falta fazer.

## Propostas de melhoria — lista única

**Este é o único lugar do documento com propostas de melhoria.** Reúne o catálogo levantado em 2026-07-25 (itens 1–25) e a revisão de pose, câmera e animação pedida em 2026-07-28 (itens 26–35), que antes viviam em duas seções separadas, uma delas perdida no meio do log de progresso.

**Não são compromisso nem prioridade** — é um cardápio para escolher. A numeração é histórica e **nunca é reaproveitada**: vários pontos deste documento e do `DECISOES.md` citam os itens pelo número (A.1, A.5, item 24…), por isso os concluídos continuam na lista com ✅, em vez de sair dela. Grupos novos entram no fim, sem renumerar o que já existe.

Marcadores: ✅ concluído · 🟢 barato · 🟡 médio · 🔴 grande · ❓ precisa de decisão do usuário antes de estimar.

Duas restrições de escopo valem para tudo o que segue: **nenhuma dependência de rede em runtime** (qualquer imagem ou dado externo entra por arquivo local escolhido pelo usuário) e, quando esta lista começou, **não gerar animações** — restrição que a fase 10 derrubou por decisão do usuário, e que nenhum item aqui pressupõe.

### Situação em 2026-07-28

- **23 abertas:** 7, 8, 9, 10 (referência) · 12, 13, 14 (câmera e captura) · 16, 17 (ambiente) · 18, 19 (workspace) · 21, 23 (dívida técnica) · 24, 25 (aparência) · 26 a 31 (animação) · 32 e 35 (posar) · 34 (câmera).
- **12 concluídas:** 1, 2, 3, 4, 5, 6, 11, 15, 20, 22 e 33 — cada uma com o apontador para o `DECISOES.md`. (São 11 números; o grupo A não tem item 7.)
- **Precisam de decisão antes de estimar (❓):** 14 (o que "fundo transparente" significa), 18 (miniatura embutida no `.glb` × ida e volta com o Blender), 24 (rompe a decisão de topo "sem assets externos"), 26 (easing × a garantia de inserção invisível) e 30 (onde guardar a miniatura de keyframe).
- **Se for para escolher três:** 26 (easing), 27 (laço + fechar o ciclo) e 29 (régua da linha do tempo) — easing é o que separa o resultado de "parece animado", laço destrava o ajuste de ciclos, e a régua é barata e se usa toda vez.

**Atualização em 2026-07-29 (fim do dia):** os itens **27, 28, 29, 30, 34, 36, 37, 38 e 39** foram **construídos** (ver `DECISOES.md` #65 e a entrega no `HISTORICO.md`) — restam **18 abertas**, e das de animação sobraram o **26** (easing, o ❓ maior) e o **31** (papel-cebola). O item 29 mudou de forma no caminho, a pedido do usuário: a régua virou uma barra no rodapé, fora do painel.

**Atualização em 2026-07-29:** entraram os itens **36 a 39** (animação, grupo H), pedidos pelo usuário já com as decisões de desenho tomadas — passam a ser **27 abertas**. A avaliação de conflitos com o que estava pendente, também pedida por ele, está no fim do grupo H ("Conflitos e ordem entre os itens 36–39 e o que já estava pendente").

**Atualização em 2026-08-02:** o usuário pediu a ordem sugerida para tudo que estava pendente e mandou implementar os três primeiros blocos dela — foram construídos **8, 17, 19, 21, 26, 35** desta lista e **52, 53, 55, 58** do módulo de poses (ver `DECISOES.md` #105–#107). Da lista numerada restam abertas: **7, 9, 10, 12, 13, 14❓, 16, 18❓, 23, 24❓, 25, 32** — o ❓ do 18 perdeu o objeto com a remoção do glTF (#85): sem `.glb`, a miniatura pode ser um dataURL no próprio `scene.json`, e o item ficou mais barato do que quando foi escrito.


**Atualização em 2026-08-04:** o usuário mandou implementar **9, 16, 23 e 32** (ver `DECISOES.md` #120–#123). Restam abertas: **10, 12, 13, 14❓, 18❓, 24❓, 25** — sete, e três delas esperando decisão dele. O item 23 encerrou com a premissa corrigida: os testes de 3D não eram os lentos.

### A. Fluxo de posar

1. ✅ **Biblioteca de poses do usuário** (concluído em 2026-07-26, ver `DECISOES.md` #42). Salvar a pose de um boneco com nome, reaplicá-la em qualquer boneco de qualquer cena e gravá-la no workspace como `poses.json` ao lado do `joint-limits.json` — pelo padrão do #29, como previsto aqui. Uma decisão a mais surgiu na execução e foi confirmada com o usuário: a pose salva guarda também o **assentamento** (inclinação e altura do quadril), senão uma pose deitada voltaria em pé atravessando o chão.
2. ✅ **Copiar/colar pose entre bonecos** (concluído em 2026-07-28, ver `DECISOES.md` #55). Combo de destino mais botão "Copiar", no painel de Propriedades, reusando `captureFigurePose` + `withPose` — leva o assentamento, não leva lugar/altura/cor/nome e respeita as juntas travadas do destino. A extensão prevista aqui — **colar só um membro** — foi feita em 2026-07-28 (`DECISOES.md` #59): um combo "O que copiar" ao lado do destino, com a pose inteira ou um grupo de `JOINT_GROUPS`; com grupo, a colocação de quem recebe não é tocada.
3. ✅ **Modo espelho ao vivo** (concluído em 2026-07-28, ver `DECISOES.md` #58). Caixa no painel de Propriedades; intercepta `setJointRotation`, que é o caminho de toda edição de junta (slider, gizmo, teclado e IK). Escreve no par a **reflexão sagital `(x, −y, −z)`** reusando `mirrorRotation` — copiar cru erraria até 0,95 m, e no polegar cairia fora da faixa do outro lado. Junta travada ganha do espelho; o modo fica fora do undo e não sobrevive a recarregar. Texto original do item: As operações do #30 são pontuais (aplico e acabou). As operações do #30 são pontuais (aplico e acabou). Um botão de alternância "espelhar edições" faria cada ajuste de slider/gizmo num lado se replicar espelhado no outro enquanto se posa — útil para poses simétricas (agachamento, braços abertos), onde hoje se ajusta um lado e se lembra de espelhar no fim. A regra já existe (`mirrorRotation`); o trabalho é decidir onde interceptar (`setJointRotation` no store) e como sinalizar o modo na UI.
4. ✅ **Resetar pose por membro ou grupo** (concluído em 2026-07-28, ver `DECISOES.md` #59). `resetJointGroup` mais um bloco de seis botões (tronco, cabeça, dois braços, duas pernas), nas duas seções do painel; devolve à pose NEUTRA, não a zeros literais, e grupo inteiro travado aparece desabilitado. Texto original do item: O item 6 da fase 9 prevê resetar **uma junta**; estender para "zerar o braço direito", "zerar as duas mãos", "zerar o tronco" custa quase nada em cima de `JOINT_GROUPS` e cobre melhor o uso real (raramente se quer zerar exatamente uma junta).
5. ✅ **Travar junta (lock)** (concluído em 2026-07-26, ver `DECISOES.md` #42). O ❓ foi decidido pelo usuário: o lock é **estado de trabalho** — vive na sessão e no autosave, não viaja no `.glb` e fica fora do histórico de undo. O alcance também foi escolhido por ele e ficou maior do que este item previa: junta travada não muda por NADA automático (slider, gizmo, teclado, IK, sorteio, espelho e aplicar pose), uma regra só, com a contagem de travas visível no painel. Com uma junta da cadeia travada, o IK para o membro inteiro em vez de aplicar meia solução.
6. ✅ **Mistura entre duas poses** (concluído em 2026-07-26, ver `DECISOES.md` #43). Slider 0-100% entre a pose atual e a escolhida no combo (preset ou biblioteca), com o resultado sendo uma pose estática única — não animação, como previsto aqui. ⚠️ **A ressalva técnica deste item estava invertida, e a medição que ele mesmo exigia mostrou isso:** interpolar por eixo nunca sai dos limites articulares (a faixa de cada eixo é convexa — correção do clamp medida em 0,000000°), enquanto o quatérnio sai e o clamp então distorce a pose no meio do caminho (`elbow.R` em +99° com limite `[-150, 0]`, salto de 0,562 m contra 0,033 m). O método simples era também o correto. Duas coisas a mais entraram na execução: 100% é idêntico a "Aplicar pose", e uma correção de chão impede o boneco de afundar 17 cm no meio da mistura.
32. ✅ **"Olhar para" — cabeça e pescoço** (concluído em 2026-08-04, ver `DECISOES.md` #123). Fieldset nos dois ramos do painel de Propriedades: alvo é a câmera de cena ou outro boneco visível, ação única com um passo de undo. A repartição do giro segue as AMPLITUDES (2/3 pescoço, 1/3 cabeça), não meio a meio — meio a meio saturava a cabeça e errava o alvo. O peso no tronco e o alvo por ponto digitado ficaram de fora, por decisão do usuário. Texto original do item: O gesto mais repetido ao montar cena com dois bonecos, e hoje só existe como dois sliders de `neck`/`head`. Mirar em: a câmera, outro boneco, ou um ponto. É um aim de duas juntas com os limites de sempre — bem mais simples que o solver de membro de `ikSolver.ts`. Opcionalmente com peso no tronco, para o corpo acompanhar.
33. ✅ **Botão "apoiar no chão"** (concluído em 2026-07-28, ver `DECISOES.md` #58; o cálculo veio do #57). `seatFigureOnGround` mexe só na altura, entra no undo, e o botão aparece nas duas seções do painel — depois de dobrar um joelho quem está posando tem uma junta selecionada, e voltar à raiz só para apoiar seria atrito no pior momento. Texto original do item: A correção de chão existe, mas **só dentro** de `blendPoses` (e desligada na animação, por decisão do #52). Depois de mexer no quadril ou nos joelhos, o boneco flutua ou afunda, e o conserto é na mão. Como ação avulsa é `buildJointFrames` + descer o root até a junta mais baixa tocar `y = 0` — código que já está todo escrito.
35. ✅ **Filtro na lista de poses** (concluído em 2026-08-02, ver `DECISOES.md` #105). Campo "Filtrar poses" acima do combo, busca por trecho do nome sem caixa e sem acento (`poseFilter.ts`); a pose escolhida nunca some do combo e o filtro vale para presets e biblioteca. Texto original do item: São dezenas de presets em grupos; um campo de busca por nome é meia hora de trabalho e retorno imediato. Baixa prioridade só porque as outras valem mais.

66. ✅ **Paridade de facilidades entre as duas cascas** (concluído em 2026-08-04, ver `DECISOES.md` #124). Pedido do usuário: o módulo de poses (item 44) resolveu para o dedo coisas que na bancada tinham ficado como estavam, e quatro delas voltaram — **ajuste fino `[−5°, −1°, ⟲, +1°, +5°]` por eixo** nos sliders da raiz e das juntas do painel de Propriedades (itens 51 e 61), **botão "Enquadrar boneco"** na Toolbar comandando a câmera de TRABALHO (item 49; o comando existia só na tecla F), **chave "Isolar seleção"** (só o boneco selecionado responde ao clique no viewport, os outros ficam visíveis e o clique os atravessa — `figureSelection.ts`) e **botão "Boneco inteiro"** na área de zerar por grupo (`resetFigure`: pose "Em pé", rotação zerada e volta à origem, num passo de undo). No sentido inverso, **"Apoiar no chão"** (item 33) foi para a aba Boneco do módulo. As quatro decisões de desenho foram perguntadas antes do código: o alcance do "zerar tudo" (pose + rotação + posição), a forma do isolamento (chave global, não cadeado por boneco), onde fica o botão de enquadrar (Toolbar, não painel de Câmera) e em que aba entra o apoiar (Boneco, não Junta).

### B. Referência para desenho — o propósito do app

7. ✅ **Imagem de referência no viewport** (concluído em 2026-08-03, como etapa 1 da proposta "Pose por marcação manual" — ver `DECISOES.md` #111). Foto local POR CIMA do viewport (papel vegetal com opacidade), nas duas cascas, só sessão com botão de limpar; nunca sai no PNG/MP4. Texto original do item: Carregar uma foto local (nunca por rede) como fundo do viewport ou como plano no espaço 3D, para posar o boneco por cima dela. É o uso clássico do manequim físico e hoje não há nada equivalente. ❓ Decidir se a imagem viaja no workspace (embutida, o que pode pesar muito) ou é só um auxílio de sessão, não persistido — **respondido**: só sessão.
8. ✅ **Modo silhueta** (concluído em 2026-08-02, ver `DECISOES.md` #105). Checkbox "Silhueta" na Toolbar, no regime da casca (preferência de tela, fora do undo e do arquivo): todas as peças em preto chapado (`meshBasicMaterial`), sem destaques emissivos; o fantasma do papel-cebola vence; clique e edição continuam; sai no PNG/MP4. A variante "só arestas" ficou de fora do primeiro corte. Texto original do item: Alternar o material do boneco para preto chapado (silhueta) ou só arestas — a silhueta é a primeira coisa que um ilustrador checa numa pose, e um render chapado revela problemas de leitura que a versão sombreada esconde. Barato: é um material alternativo em `Figure2.tsx`, sem tocar em geometria.
9. ✅ **Linha de ação e linhas de ombro/quadril** (concluído em 2026-08-04, ver `DECISOES.md` #122). Chave "Linhas de gesto" na Toolbar, ao lado da régua: a curva cabeça → pelve → pé de apoio (o mais BAIXO, que é o que sustenta) e as duas transversais, esticadas ao mesmo vão para as inclinações se compararem. Tubos com `depthTest={false}`, ancorados no boneco selecionado; somem no MP4 e obedecem à chave "ocultar grade/gizmos" no PNG. Texto original do item: Sobrepor no viewport a curva que liga cabeça → pelve → pé de apoio (a "linha de ação" do desenho gestual) e as duas linhas que mostram a inclinação relativa de ombros e quadril (o contraposto). É vocabulário direto de quem desenha figura humana, e todos os pontos necessários já saem de `buildJointFrames`.
10. 🟢 **Escala de cabeças.** Régua sobreposta marcando a divisão clássica de 7,5-8 cabeças. Combina com o item 11 da fase 9 (régua vertical) — talvez seja a mesma régua com um segundo modo de unidade, em vez de dois recursos separados.
11. ✅ **Presets de lente em milímetros** — construído em 2026-07-27 (ver `DECISOES.md` #46), junto com enquadramento cinematográfico, ângulos de câmera e movimento entre dois pontos. Texto original do item: O painel de câmera hoje expõe FOV em graus (`CameraPanel.tsx`); ilustrador e fotógrafo pensam em 24/35/50/85 mm. Botões de distância focal equivalente (conversão trivial para FOV) tornam o controle de distorção de perspectiva muito mais previsível — importante porque a perspectiva escolhida muda radicalmente a pose que se deve desenhar.

### C. Câmera e captura

12. 🟡 **Captura em lote dos bookmarks de câmera.** Um botão que percorre todos os bookmarks salvos e captura um PNG de cada, numerados — gera um "turnaround" completo da mesma pose num clique. A captura já é sob demanda (`KeyframeCapture.tsx`) e os bookmarks já existem; o trabalho é a fila e a nomenclatura dos arquivos.
13. 🟡 **Folha de contato.** Uma imagem única com várias vistas em grade (frente/lado/costas/3-4). Complementa o item 12: um arquivo para imprimir e deixar ao lado da prancheta, em vez de vários soltos.
14. 🟡❓ **PNG com fundo transparente.** Hoje o keyframe sai com o fundo cinza do ambiente. Uma saída com canal alfa permitiria abrir o boneco como camada sob o rascunho em qualquer editor raster (Krita, GIMP, Clip Studio Paint, Procreate, Photoshop) — o uso mais direto de uma imagem de referência. **Ressalva levantada em 2026-07-25, antes de implementar:** "fundo transparente" parece um flag e não é. Tirar o fundo tira **junto a sombra projetada**, que hoje cai sobre o plano de chão — e é justamente ela que comunica volume e contato com o solo num keyframe de referência. Sobra ainda a elipse de contato colorida (`FigureShadow`, ver "Aparência" acima), que é um *mesh* e não fundo: continuaria aparecendo na imagem, e provavelmente não é o desejado numa figura para compor sob um desenho. São três comportamentos distintos, e a escolha é do usuário:
    - **(a) só a cor de fundo fica transparente** — chão, grade e sombra permanecem na imagem. É o mais barato e o mais próximo de um flag, mas entrega pouco: quem quer compor sob um desenho normalmente não quer a grade junto.
    - **(b) só o boneco** — sai tudo menos a figura. Simples de explicar, porém **perde a sombra**, empobrecendo a leitura de profundidade da referência.
    - **(c) boneco + sombra sobre transparência** — o comportamento dos softwares 3D, via *shadow catcher*: um plano invisível que só se revela onde a sombra bate (o three.js tem material próprio para isso). É o melhor resultado e o de maior custo.

    Por isso o item foi rebaixado de 🟢 para 🟡: só a opção (a) é barata. Decidir com o usuário qual comportamento vale a pena antes de estimar de novo — e, seja qual for, definir o que fazer com a elipse de contato.
15. ✅ **Enquadrar câmera no boneco selecionado (tecla `F`)** — construído em 2026-07-25 junto com o item 22 (ver `DECISOES.md` #32). Mede a caixa envolvente real do boneco na cena, então acompanha a pose (um boneco deitado enquadra diferente de um em pé) e preserva a direção de onde a câmera já olha.
34. ✅ **Ligar o movimento A→B ao animador** (concluído em 2026-07-29, ver `DECISOES.md` #65). Botão "Gerar keyframes deste movimento" no próprio painel de câmera: dois keyframes com a cena atual e as duas câmeras, no fim da linha do tempo, numa edição de undo. Texto original do item: O `Movimento A→B` do painel de câmera e a animação usam **o mesmo** `interpolateCameraView` (#46) e mesmo assim não se falam. "Gerar keyframes deste movimento" — dois keyframes com a pose atual — fecharia o ciclo: quem já montou o travelling não teria de remontá-lo. Na mesma linha, escolher um bookmark ao capturar, em vez de aplicar-e-capturar.

*(item 69 acrescentado em 2026-08-06, a pedido do usuário, e implementado na mesma sessão — a numeração continua do fim, sem renumerar nada)*

69. ✅ **Apontar a câmera de cena para o assunto** (concluído em 2026-08-06, ver `DECISOES.md` #130). Dois botões no bloco "Rotação" do painel de Câmera: apontar para o boneco selecionado, ou para a média dos visíveis. É a versão automática dos três sliders de rotação logo acima — e o complemento do bloco de enquadramento, que escolhe plano e ângulo e por isso RECOLOCA a câmera inteira. As três decisões foram perguntadas antes do código:
    - **Só gira; a posição não muda.** O ponto de vista escolhido fica onde está, e o alvo passa a ser o assunto.
    - **Mira a base do tórax** (junta `chest`), o centro de massa visível do boneco: a cabeça deixaria o corpo na metade de baixo do quadro, a pelve na de cima. Calculado sem GPU, por `buildJointFrames`, como o "olhar para" do item 32.
    - **A média conta só os visíveis** — apontar para o meio de um grupo levando em conta quem não aparece puxaria a câmera para o vazio.
    - **O topo da tela é preservado**, inclusive inclinado: o ângulo holandês é escolha de quem enquadrou, e apontar não o desfaz.

### D. Ambiente e leitura de volume

16. ✅ **Direção e intensidade da luz controláveis** (concluído em 2026-08-04, ver `DECISOES.md` #121). Azimute, elevação e intensidade na seção "Configurações" do painel de Cenas — conteúdo de CENA (entra no undo, viaja no arquivo, serialização aditiva), com distância fixa em 8 m e o padrão reproduzindo a luz fixa de antes. O frustum da sombra foi para ±8 m porque com a luz girando o padrão do three a cortava. Texto original do item: A `directionalLight` de `SceneContent.tsx` tem posição fixa. Poder girar a luz (azimute/elevação) muda quais volumes ficam legíveis e é uma decisão de referência tão relevante quanto o ângulo de câmera — sombra é o que comunica forma num keyframe.
17. ✅ **Revisar sombra de contato vs. sombra projetada** (concluído em 2026-08-02, ver `DECISOES.md` #105). A revisão achou uma premissa falsa: o boneco NUNCA projetou sombra real (`castShadow` ausente das peças — só os objetos de cena projetavam). Corrigido: peças e ossos ganharam `castShadow` (fantasma não), cumprindo o que a tabela de arquitetura sempre prometeu; a elipse fica, como indicador distinto de colocação/altura. Falta a conferência visual no navegador. Texto original do item: Hoje coexistem duas coisas: a elipse translúcida sempre presa ao chão (`FigureShadow`, decisão deliberada como indicador de altura) e a sombra real do shadow map. Vale conferir se as duas juntas não atrapalham a leitura em algumas poses — em especial nas poses do #30 que erguem o boneco do chão (Superman) ou o deitam.

### E. Workspace e organização

18. 🟡 **Miniatura das cenas salvas.** O painel de Cenas lista só nomes; com 10 cenas, achar "aquela do salto" exige carregar uma a uma. Gerar um PNG pequeno no momento de salvar (a captura sob demanda já existe) e guardá-lo no `extras` do `.glb` da cena resolveria. ❓ Confirmar antes que embutir a miniatura não atrapalha a ida e volta com o Blender já validada na fase 6.
19. ✅ **Reordenar cenas na lista** (concluído em 2026-08-02, ver `DECISOES.md` #105). Setas ↑/↓ por cena no painel de Cenas, e — como previsto na avaliação de conflitos do item 36 — o mesmo código (`moveById`) serviu à biblioteca de animações ("Subir/Descer na lista"). Entra no undo; a animação de trabalho fica onde está. Texto original do item: Renomear já existe no store (`renameSceneSnapshot`), mas a ordem é fixa pela ordem de criação.

### F. Dívida técnica e higiene

20. ✅ **Código morto: `Figure.tsx` e a duplicidade `skeleton2.ts`** (resolvido em 2026-07-25, ver `DECISOES.md` #32). O renderizador antigo foi removido, `Figure2.tsx` voltou a se chamar `Figure.tsx` e a camada visual do `skeleton2.ts` foi **fundida** no `skeleton.ts` (escolha do usuário entre fundir e renomear) — um único arquivo de esqueleto, com cinemática e aparência separadas por um cabeçalho de seção. `Viewport.tsx` perdeu o alias `Figure2 as Figure` e o import comentado que permitia reverter o visual.
21. ✅ **`frameloop="demand"` no `Canvas`** (concluído em 2026-08-02, ver `DECISOES.md` #107). A auditoria prevista está registrada no comentário do próprio `Canvas` e no #107: nenhum ponto precisou de `invalidate()` manual (controles do drei invalidam no `change`; reprodução e comandos de câmera passam por estado React; captura/vídeo renderizam por conta própria). Escopo deliberado: só o `Viewport` do desktop — o viewport do módulo de poses fica para depois, se a medição em aparelho pedir. Falta a conferência visual no navegador. Texto original do item: Hoje o `Canvas` (`Viewport.tsx`) roda no modo padrão, redesenhando continuamente mesmo com a cena parada — o que num app de **poses estáticas** é gasto puro de CPU/GPU e bateria. Mudar para redesenho sob demanda casa com a natureza do app, mas exige auditar cada ponto que anima algo (gizmos, `OrbitControls`, captura) para invalidar o quadro corretamente; daí o custo médio e não baixo.
22. ✅ **Atalhos previstos no plano e não construídos** (resolvido em 2026-07-25, ver `DECISOES.md` #32). `F` (enquadrar no boneco selecionado, medindo a caixa real da pose), `Ctrl+S` (salva/regrava a cena ativa no catálogo, sem duplicar) e `W`/`E` (gizmo da raiz mover/girar) foram construídos; o `Q` saiu do mapa por não ter equivalente no app. O `SHORTCUT_CATALOG` — e portanto o painel `?` — cobre agora o mapa inteiro.
23. ✅ **Suíte de testes** (concluído em 2026-08-04, ver `DECISOES.md` #120). A premissa deste item estava ERRADA e a medição mostrou: os testes de 3D não são os lentos (o maior custa 9,8 s contra 75 s do `AnimationPanel`), e a alavanca real era que 89 dos 116 arquivos eram lógica pura pagando jsdom à toa. Virou `test.projects`: `unidade` (node, `*.test.ts`) e `interface` (jsdom, `*.test.tsx` + oito nominais). Suíte inteira de ~222 s para ~141 s; ciclo de lógica (`npm run test:rapido`) para ~40 s. Texto original do item: **1.490 testes, ~175 s** (581 quando este item foi escrito; 1.316 na última vez que a métrica foi atualizada). O tempo dobrou na entrega da câmera (#46) — a maior parte é disputa de CPU entre os arquivos de painel, que remontam a UI a cada interação, e foi o que obrigou a subir o `testTimeout` de 5 s para 20 s. O custo por rodada vem subindo a cada fase. Se passar a incomodar, o caminho é separar os testes de render 3D (os mais lentos, por montarem o `@react-three/test-renderer`) dos de lógica pura, permitindo rodar só os rápidos durante o desenvolvimento.

### G. Aparência do boneco

*(grupo acrescentado em 2026-07-25, depois da primeira leva — por isso a numeração continua do fim, sem renumerar os itens acima)*

24. 🔴❓ **Vestir o boneco a partir de duas imagens (frente e costas) da personagem.** Pedido de avaliação do usuário: dadas duas vistas de uma pessoa/personagem — frente e costas, fundo limpo, como uma folha de *turnaround* —, aplicar essas imagens no boneco como textura, de forma **determinística** e com resultado apenas aproximado. **Avaliação: viável**, mas por uma técnica diferente da que o nome sugere.
    - **Técnica: projeção planar, não desdobramento de UV.** Para cada vértice, projetar ortograficamente a posição **na pose de repouso** sobre o plano XY e usar isso como coordenada de textura (`u = (x − minX)/largura`, `v = (y − minY)/altura`); superfícies voltadas para a frente amostram a imagem frontal, as voltadas para trás amostram a de costas. É álgebra linear pura — mesma entrada, mesma saída, sem iteração, sem otimização, sem modelo treinado. Atende ao requisito de determinismo. `buildJointFrames` com uma pose zerada já entrega as matrizes de repouso necessárias.
    - **⚠️ Pegadinha não óbvia:** tanto a coordenada quanto a escolha frente/costas precisam ser **assadas na pose de repouso**, como atributos da geometria. Decidir "frente ou costas" em runtime pela normal da superfície já posada faz a textura DESLIZAR pelo corpo conforme se gira uma junta — um braço rotacionado passaria a amostrar a imagem de trás no meio do movimento. Assando um peso por vértice na pose neutra, o shader vira um `mix(frenteTex, costasTex, peso)` e a textura acompanha a pose rigidamente.
    - **A pose da imagem tem de bater com a do boneco.** Uma foto em guarda de luta projetada sobre um boneco de braços baixos põe calça no braço e fundo no tronco. A solução é o fluxo padrão de *projection painting*, e o app está bem posicionado para ele: **posar o boneco para casar com a imagem, projetar, assar** — feito isso, a textura fica presa à malha e o boneco volta a ser posável livremente.
    - **Limitações intrínsecas (não são falha de implementação):** as **laterais borram** (com duas vistas, tudo que aponta para os lados recebe pixels esticados da borda da silhueta); as **proporções não batem** (o boneco tem proporções fixas com só a altura ajustável, então a linha do cinto pode cair no quadril errado mesmo com a pose casada); e **o boneco não é um corpo humano** — com bolas de junta expostas, vãos entre segmentos, cabeça em ovo e mãos em lâmina, o resultado lê como "manequim de madeira pintado", não como a personagem. Rosto e detalhes finos não sobrevivem; cores e marcos grandes (colete, calça, coturno, boné) sim — o que pode bastar para referência de desenho.
    - **Detalhes do código:** `createBladeGeometry` (`Figure2.tsx`) não gera atributo `uv`, só posição e normais — irrelevante aqui, já que as coordenadas seriam geradas por nós de qualquer forma. A persistência ajuda (glTF suporta texturas embutidas, então o `.glb` continua abrindo no Blender com a textura junto), mas o peso é o problema: duas imagens embutidas superam de longe a cena inteira de hoje, e o autosave em `localStorage` provavelmente não aguentaria.
    - **❓ Tensão de escopo a resolver antes:** o topo deste plano decidiu explicitamente "manequim construído por primitivas, **sem assets externos**". Texturizar por foto rompe essa decisão. Não é impedimento técnico — é decisão do usuário.
    - **Custo:** 🔴 grande. Exigiria centralizar a geração de geometria (hoje criada dentro dos componentes React via `useMemo`), uma etapa de *bake*, um material com shader próprio, carregamento de imagem local, UI de alinhamento e revisão da persistência.
25. 🟢 **Alternativa barata ao item 24: cores por região do corpo.** Se o objetivo for referência de desenho e não semelhança, amostrar cores da imagem por região e colorir cada grupo de juntas (boné marrom, colete azul, tronco branco, calça verde-oliva, coturno preto) entrega o essencial — a distribuição de cores da personagem — por talvez 10% do custo. Perde padrão camuflado, rosto e qualquer detalhe, mas é trivialmente determinístico e não toca em geometria, shader nem persistência: é cor de material por junta, coisa que `Figure2.tsx` já sabe fazer (é assim que olhos e o pino do dorso da mão têm cor própria).

### H. Animação (grupo acrescentado em 2026-07-28, depois da fase 10)

*(a numeração continua do fim, sem renumerar os itens acima — mesma convenção do grupo G. Estes itens saíram da revisão de pose, câmera e animação pedida pelo usuário em 2026-07-28; os de pose e de câmera daquela revisão foram para os grupos A e C.)*

26. ✅ **Easing por trecho (aceleração/desaceleração)** (concluído em 2026-08-02, ver `DECISOES.md` #106). Saiu como o item previa: `applyEasing` puro remapeando o `t` do trecho antes de `blendFigure`/`interpolateCameraView`, seletor "Suavização" por keyframe (linear / suave nos dois lados / na entrada / na saída), campo aditivo que 'linear' nunca grava — e o easing viaja nos trechos salvos (a sinergia 39×26 anotada abaixo). Texto original do item: Hoje `sampleAnimation` calcula `t` linear (`animationSampler.ts`), e o leiame do `animations.json` até documenta a consequência: *"a velocidade é constante dentro de cada trecho e muda em cada keyframe"*. Na prática todo movimento parte e para de repente, e a câmera quebra visivelmente em cada keyframe. **É a maior lacuna da animação** — o que mais separa o vídeo atual de um que pareça animado. O conserto é uma função pura `t → t'` aplicada antes de `blendFigure`/`interpolateCameraView`: um seletor por keyframe (linear / suave nos dois lados / suave na entrada / suave na saída), do mesmo tamanho do campo de duração.
    - **❓ Decisão embutida — resolvida pela rota honesta e barata (2026-08-02):** o keyframe inserido dentro de um trecho suavizado guarda o retrato do instante SUAVIZADO e as duas metades assumem linear, com aviso visível na barra da linha do tempo antes de inserir. A subdivisão da curva fica anotada como upgrade possível se easing virar o padrão. Texto original: com easing, o "Inserir keyframe aqui" (#54) **deixa de ser invisível** — duas metades reinterpoladas linearmente não reproduzem uma curva suave. Ou o corte reparte a curva (subdivisão de Bézier, matemática conhecida), ou o keyframe inserido dentro de um trecho suavizado assume linear e o painel avisa. A segunda é honesta e barata; a primeira é a certa se easing virar o padrão.
27. ✅ **Laço na reprodução, e "fechar o ciclo"** (concluído em 2026-07-29, ver `DECISOES.md` #65). Checkbox **Repetir** na barra da linha do tempo, valendo só na tela (o arquivo continua com uma passada), com o excedente reentrando pelo começo para o ciclo emendar sem engasgo; e **"Fechar o ciclo"**, que copia o keyframe 1 para o fim com a duração do último trecho — sem levar o rótulo de grupo dele (seriam dois blocos com o mesmo nome). Texto original do item: `AnimationPlayer.tsx` para no fim de propósito (repetir sozinho esconderia onde a animação termina), mas para acertar um ciclo de caminhada é preciso clicar "Tocar" a cada volta. Um checkbox **Repetir** que afeta só a reprodução na tela — o arquivo continua com uma passada — custa pouquíssimo. Junto: um botão **"fechar o ciclo"**, que duplica o keyframe 1 no fim; sem ele nenhum ciclo emenda.
28. ✅ **Duplicar keyframe e copiar a pose do vizinho** (concluído em 2026-07-29, ver `DECISOES.md` #65). `copyAnimationKeyframeFigures` é o simétrico exato do "Câm ↑/↓", e duplicar põe a cópia logo depois com a MESMA duração — dois retratos iguais são a pausa, e ela dura o mesmo que o trecho que chegou ali. Texto original do item: Simétricos ao "Câm ↑/↓" (#55) e quase o mesmo código — `copyAnimationKeyframeCamera` trocando o campo. Hoje existe o gesto de **segurar o enquadramento e deixar a cena andar**; falta o complementar, **segurar a pose e mover só a câmera**. E duplicar um keyframe é como se cria uma pausa (dois retratos iguais), que hoje só sai recapturando a cena.
29. ✅ **Régua da linha do tempo, agora como BARRA DO RODAPÉ** (concluído em 2026-07-29, ver `DECISOES.md` #65). Pedido do usuário no meio da execução: a régua saiu do painel de Animação e virou `TimelineBar.tsx`, uma barra de largura inteira no rodapé, recolhível e nascendo recolhida. Ficou com as marcas dos keyframes (`<datalist>`), o passo de exatamente 1/fps, os botões de keyframe anterior/próximo, o transporte (tocar/parar) e a caixa **Repetir** do item 27 — no painel ficou o que é edição, aqui o que é navegação. As faixas dos grupos do item 38 são a segunda camada desta mesma régua. Texto original do item: O slider do `AnimationPanel` tem `step={10}` e nenhuma referência visual: não dá para ver onde estão os keyframes nem parar em cima de um. Três coisas baratas — marcas dos keyframes sob o slider (`<datalist>` resolve), setas ←/→ andando exatamente 1/fps, e botões "keyframe anterior/próximo". Muda o dia a dia de quem ajusta tempo.
30. ✅ **Miniatura por keyframe** (concluído em 2026-07-29, ver `DECISOES.md` #65). O ❓ foi resolvido pelo caminho recomendado aqui: cache em memória (`keyframeThumbnailStore.ts`), fora do conteúdo, refeito sob demanda pelo player a 160×90 com `renderAtResolution` + `hideSceneOverlays`; abrir outra animação limpa o cache, porque ids de keyframe são únicos DENTRO de uma animação. Texto original do item: Os cards dizem "Keyframe 3 — 1.5s". Com oito keyframes ninguém sabe qual é qual. A máquina já existe: `renderAtResolution` + `hideSceneOverlays` (`sceneCapture.ts`). Primo do item 18 (miniatura das cenas salvas), e com a mesma pergunta em aberto.
    - **❓ Decisão embutida — onde guardar.** Uma dataURL dentro do `Animation` incharia o `animations.json` e entraria no undo a cada captura. O caminho recomendado é um cache **em memória**, fora do store de conteúdo, chaveado por id de keyframe e refeito ao regravar.
31. ✅ **Papel-cebola (onion skin)** (concluído em 2026-07-29 — ver `DECISOES.md` #67). Caixa "Papel-cebola" no painel de Animação: o keyframe anterior sai em fantasma quente e o seguinte em frio, em volta do que está no playhead. `onionSkin.ts` é a leitura (quem é vizinho de quem, testável sem WebGL) e `OnionSkin.tsx` desenha; o `ghost` do `Figure.tsx` dá o translúcido, tira sombra, clique e gizmo — **e suprime os nomes de cena**, senão `getObjectByName('figure-<id>')` do `CameraRig` poderia enquadrar um fantasma. O grupo entrou em `OVERLAY_NAMES`, então PNG e MP4 já o escondem pela regra que existe. Some enquanto toca ou exporta. **De quebra, corrigiu um bug antigo:** "Ir para" carregava o retrato do keyframe mas não movia o playhead — a régua marcava 0,0s mostrando o keyframe 3. **Estendido em 2026-07-29** (pedido do usuário, ver `DECISOES.md` #74): combo "Mostrar" com os dois vizinhos, só o anterior ou só o seguinte. **Estendido de novo em 2026-08-06** (pedido do usuário, ver `DECISOES.md` #129): caixas para escolher **de quais bonecos** sai o fantasma, ao lado das opções de lado — com três pessoas em cena, cada fantasma virava três corpos translúcidos. Só aparecem com o papel-cebola ligado e dois bonecos ou mais; o estado guarda quem está de FORA (`onionSkinHiddenFigureIds`), para boneco novo nascer marcado; o filtro mora no módulo puro (`onionSkinFrames` devolve os `figures` de cada quadro já filtrados) e vale nas duas cascas, com controle nas duas.

    Texto original do item: 🟡 **Papel-cebola (onion skin).** Ver o keyframe anterior e o seguinte em fantasma enquanto se ajusta o atual — serve para pose e para animação. É a ferramenta clássica de animação que falta, e o app já sabe renderizar bonecos de um retrato: `SceneFigures.tsx` faz exatamente isso com a pré-visualização. Seria uma segunda lista, com material translúcido, sem gizmos e sem sombra.

*(itens 36 a 39 acrescentados em 2026-07-29, a pedido do usuário — as ambiguidades de cada um foram levadas a ele antes de escrever e as decisões estão embutidas no texto)*

36. ✅ **Linha do tempo sem "criar antes": animação de trabalho + biblioteca de animações salvas** (concluído em 2026-07-29, ver `DECISOES.md` #65). A captura (e o trecho, e o movimento de câmera) cria a animação de trabalho sozinha, no MESMO passo de undo; `activeAnimationId` deixou de existir, porque com uma bancada só a pergunta "qual está aberta" não existe mais. Texto original do item: Hoje capturar exige animação ativa (`canCapture` em `AnimationPanel.tsx`) e a única forma de ter uma é o botão "Criar" — ou seja, é preciso batizar a animação antes de pôr o primeiro keyframe. **Inconsistência levantada com o usuário antes de escrever este item:** não existe hoje nenhum passo de "salvar animação"; "Criar" é o que a faz existir e a persistência (undo, autosave e `animations.json`) já é automática desde a fase 10. O que incomoda é o batismo antecipado, não a gravação.
    - **Decisão do usuário:** criação **preguiçosa**. Capturar o primeiro keyframe (ou inserir um trecho pronto) sem animação ativa cria sozinha a **animação de trabalho** — a "default" —, já persistida como qualquer outra. Nomear e salvar guarda uma cópia na **biblioteca**, para reabrir depois; **reabrir uma salva sobrescreve a de trabalho**. É exatamente o contrato que o painel de Cenas já tem com os snapshots de cena (ver "Workspace: catálogo de cenas" e `DECISOES.md` #11): carregar substitui o que está na bancada, num **único passo de undo**.
    - **O que muda no código:** `requestCaptureKeyframe`/`requestAppendClip` deixam de exigir animação ativa e criam sob demanda, no mesmo passo de undo do keyframe que as motivou (senão Ctrl+Z deixaria uma animação vazia para trás); o combo passa a separar "de trabalho" da biblioteca; autosave e `animations.json` ganham a marca de qual é a de trabalho — **campo aditivo, sem subir versão de formato**, o mesmo precedente do `snapshotCounter` da fase 10.
    - **Risco a tratar:** sobrescrever a de trabalho joga fora o que estava nela. Mitigação já validada em outro canto do app — passo único de undo, como nos snapshots de cena — mais o aviso no painel; nada de diálogo de confirmação, que o projeto evita desde o `Delete` do boneco (fase 3).
37. ✅ **Checkboxes de bonecos nos trechos prontos (solo)** (concluído em 2026-07-29, ver `DECISOES.md` #65). `appendAnimationClip` aceita uma LISTA no papel A; em dupla continua um combo por papel. Texto original do item: O papel é um `select` de um boneco só (`animation-clip-role-a`), então um corpo de baile — as danças do #62, várias pessoas andando na mesma cena — é montado repetindo o mesmo trecho boneco a boneco, cada vez a partir do fim da linha do tempo. Com **checkboxes dos bonecos em cena**, marcar N aplica o trecho inteiro aos N ao mesmo tempo, cada um ancorado no próprio lugar e no próprio heading (a ancoragem por papel já é o que `appendAnimationClip` faz). Padrão: o boneco selecionado marcado, para o gesto de um clique continuar existindo.
    - **Trechos em DUPLA ficam como estão**, com os dois combos A e B — decisão do usuário: os papéis são distintos e os encaixes vêm **medidos par a par** de `posePairs.ts`; marcar vários para o mesmo papel os empilharia todos exatamente no mesmo ponto.
38. ✅ **Grupos rotulados de keyframes, recolhíveis** (concluído em 2026-07-29, ver `DECISOES.md` #65; o cabeçalho ganhou ↑ ↓ para mover o BLOCO inteiro em 2026-08-03, ver #117). Rótulo por keyframe, consecutivos iguais colapsando, cabeçalho recolhível no painel e faixa na régua do rodapé; duas regras de unicidade (estender o grupo vizinho à mão é aceito, repetir num trecho novo ganha sufixo) e herança de rótulo no cortar/duplicar — menos no que fecha o ciclo. Texto original do item: Com dez ou vinte cards "Keyframe 7 — 1.5s" ninguém sabe onde começa a caminhada e onde começa o salto. **Modelo decidido com o usuário:** rótulo opcional **por keyframe** (`label?: string` em `AnimationKeyframe`, campo aditivo com sanitização em `animation.ts`, como todo dado que vem do autosave e do `animations.json`); keyframes **consecutivos** com o mesmo rótulo formam um grupo, com cabeçalho **recolhível** na lista. Nada de entidade "grupo" com faixa a manter consistente a cada inserir/mover/remover — um grupo é uma leitura da lista, não um objeto à parte.
    - **Rótulo não se repete:** dois trechos de caminhada são "Andando 1" e "Andando 2". Repetir o mesmo nome não remonta um grupo partido (seriam dois blocos separados com o mesmo título, que é justamente a confusão que o item existe para tirar), então o painel força o sufixo.
    - Recolher/expandir é **estado de ferramenta**: fora do undo e do arquivo, como o recolhimento de painel do `uiStore`.
    - **Ganho de graça:** o trecho pronto inserido pode já nascer rotulado com o nome dele ("Andando 1"), e a regra do sufixo resolve a segunda inserção sozinha — o grupo mais comum sai sem ninguém digitar nada.
39. ✅ **Trechos salvos pelo usuário, no molde da biblioteca de poses** (concluído em 2026-07-29, ver `DECISOES.md` #65). `clipLibrary.ts` + `clips.json`: keyframes literais sem câmera, papéis em vez de bonecos (só entra quem se mexe na faixa), reancoragem com giro e escala de altura. O ❓ foi resolvido como previsto — um papel só cai nas checkboxes do 37, dois ou mais ganham um combo por papel. Texto original do item: O mesmo mecanismo do #42 (poses do usuário), aplicado a pedaços de linha do tempo: montou uma sequência que presta, salva com nome e reaplica em qualquer animação de qualquer cena.
    - **O que guarda:** os keyframes **literais** (poses, colocação, alturas, durações) **sem a câmera** — decisão do usuário. Ao inserir, congela a câmera atual em todos os keyframes, que é exatamente a regra dos trechos de fábrica (#60); com isso um trecho do usuário se comporta igual a um pronto, em vez de sequestrar o enquadramento de quem o aplica.
    - **Recorte:** **faixa escolhida à mão** (do keyframe X ao Y) — decisão do usuário —, e não a animação inteira nem obrigatoriamente um grupo do item 38.
    - **Persistência:** um `clips.json` na pasta do workspace, ao lado de `poses.json` e `animations.json`, apontado pelo manifesto e com linha no leiame, mais autosave e undo — caminho já trilhado duas vezes (`joint-limits.json` e o `poses.json` do #42).
    - **Na UI:** um grupo "Meus trechos" no mesmo combo dos prontos, do mesmo jeito que a biblioteca de poses divide espaço com os presets no painel de Propriedades.
    - **❓ Decisão embutida — como os bonecos gravados viram bonecos da cena.** Um trecho salvo carrega N bonecos concretos, e inserir precisa mapear cada um. O caminho barato é um combo por boneco gravado (papéis A, B, …), reusando o padrão dos trechos prontos; com **um** boneco só, cai nas checkboxes do item 37 e o comportamento fica idêntico ao de um trecho solo de fábrica.

#### Conflitos e ordem entre os itens 36–39 e o que já estava pendente

*(avaliação pedida pelo usuário em 2026-07-29, junto com os itens)*

- **38 × 29 (régua da linha do tempo) — compõem, e foi o próprio usuário quem apontou.** As faixas dos grupos são a segunda camada da mesma régua que o 29 propõe (marcas de keyframe, passo de 1/fps, pular keyframe), e dão sentido a um "pular grupo". Ordem natural: 29 primeiro, 38 em cima — ou os dois juntos, porque é mexida no mesmo controle.
- **38 × 30 (miniatura por keyframe) — disputam o espaço do card, e o 38 deve vir antes.** Com grupos recolhidos, a miniatura vira o resumo natural do grupo fechado, o que muda o desenho do 30 (e ajuda a decidir o ❓ dele: uma miniatura por grupo é muito menos coisa em memória que uma por keyframe). Fazer 30 antes de 38 é redesenhar o card duas vezes.
- **38 × 28 (duplicar keyframe) e × 27 ("fechar o ciclo") — regra a definir, custo baixo.** Keyframe duplicado ou inserido pelo "Inserir keyframe aqui" (#54) tem de **herdar o rótulo do vizinho**, senão parte o grupo em dois. Já o "fechar o ciclo" do 27 duplica o keyframe 1 no **fim** — esse, por definição, não pertence ao grupo inicial e precisa de rótulo próprio (ou de nenhum).
- **39 × 26 (easing) — sem conflito, com um ganho.** Como o trecho salvo guarda keyframes literais, qualquer campo novo do keyframe (o easing do 26, o rótulo do 38) viaja junto sem mudar o formato do trecho. O formato declarativo dos trechos de fábrica **não** tem essa propriedade — mais um motivo para os dois formatos coexistirem.
- **39 × #60 (trechos de fábrica) — duas formas de inserir, e é para ser assim.** O de fábrica é declarativo (pose de fábrica + desvios, papéis, `mirror`, encaixes medidos de `posePairs.ts`) e por isso funciona com qualquer boneco de qualquer altura; o do usuário é um retrato literal. Unificar os dois formatos custaria mais do que manter dois caminhos de inserção atrás do mesmo botão — mas a **ancoragem** do `appendAnimationClip` e o **rótulo automático** do 38 devem ser compartilhados pelos dois.
- **37 × 39.** As checkboxes valem para trecho de **um** boneco; um trecho salvo com dois ou mais cai nos combos de papel — é o ❓ do 39, e a regra do 37 (dupla continua com combos) já é a resposta consistente.
- **36 × 34 (ligar o movimento A→B ao animador) — o 36 destrava o 34.** "Gerar keyframes deste movimento" esbarraria hoje na mesma exigência de animação ativa; com a criação preguiçosa, o botão funciona partindo do zero absoluto.
- **36 × 19 (reordenar cenas na lista).** A biblioteca de animações nasce com o mesmo problema que o 19 descreve para as cenas (ordem fixa pela criação); se o 19 for feito, vale fazer os dois com o mesmo código.
- **36 e 39 × persistência.** O 36 acrescenta um campo (qual é a de trabalho) ao autosave e ao `animations.json` — aditivo, sem subir versão de formato, precedente do `snapshotCounter`. O 39 acrescenta um arquivo (`clips.json`) ao manifesto do workspace — precedente do `poses.json`. Nenhum dos dois toca o `.glb` da cena nem a ida e volta com o Blender validada na fase 6.
- **23 (tempo da suíte).** Os quatro itens são majoritariamente UI de painel, a classe de teste mais lenta da suíte (1.815 testes hoje). Não é impedimento — é a conta a esperar.
- **Sem interferência** com 31 (papel-cebola), 21 (`frameloop="demand"`), 26 fora do que está dito acima, nem com qualquer item dos grupos A–G.

*(itens 40 e 41 acrescentados em 2026-07-29, a pedido do usuário, para serem implementados depois)*

40. ✅ **Destacar no painel o keyframe que está na bancada ("Ir para")** (concluído em 2026-07-29, ver `DECISOES.md` #73). Saiu como planejado, e o ❓ foi resolvido pela recomendação: o destaque segue **só** o "Ir para". **Complementado em 2026-07-29** (pedido do usuário, ver `DECISOES.md` #75): o card em que o ⏮/⏭ parou ganhou marca PRÓPRIA, mais fraca — a alternativa do ❓ virou uma segunda marca em vez de substituir a primeira. **E em 2026-08-06** (pedido do usuário, ver `DECISOES.md` #131): a marca do playhead passou a ser **azul** (`--playhead`), porque distingui-las só pela forma bastava quando caíam no mesmo card e falhava justamente quando se separavam — navegando pela linha do tempo. Texto original do item: Depois de clicar "Ir para", nada na tela diz em qual keyframe a cena de trabalho foi carregada — e é justamente essa informação que falta na hora de clicar "Regravar" no card certo. O pedido do usuário é destacar o card correspondente.
    - **O destaque significa "a bancada está mostrando este keyframe"**, e não "o playhead está aqui". A distinção não é sutil: "Ir para" carrega o retrato do keyframe na cena de trabalho, enquanto arrastar a régua ou usar ⏮/⏭ só mexe na pré-visualização. Derivar o destaque do instante faria o card marcado mudar ao arrastar a régua, enquanto a cena editável continuaria sendo a de antes — exatamente o erro que o item existe para evitar.
    - **Por isso, estado próprio e não derivação:** `visitedKeyframeId: string | null` no `animationStore`, ao lado de `preview` e `onionSkin` — estado de ferramenta, fora do undo e do arquivo. `requestGoToKeyframe` grava; `requestCaptureKeyframe` limpa (o keyframe novo vai para o fim, e a bancada deixa de ser aquele); `resetTimeline` limpa (é o que roda ao abrir uma animação da biblioteca, e ids de keyframe são únicos DENTRO de uma animação — mesma razão que limpa o cache de miniaturas do #30). **`requestUpdateKeyframe` não limpa:** regravar reescreve o keyframe em que se está, e continua-se nele.
    - **Mover, duplicar e remover não pedem código nenhum:** o destaque casa por **id**, então reordenar leva a marca junto e remover o keyframe faz a marca sumir sozinha. Mesma escolha dos grupos do #38 — leitura em vez de escrituração.
    - **Na UI:** modificador de classe no `<li>` do card mais `aria-current="true"` (que é a semântica certa e dá o gancho estável ao teste); uma regra de CSS usando `--text-h`, que já acompanha o tema, em vez de variável nova. Sem i18n — o destaque é visual.
    - **Limite aceito:** um Ctrl+Z depois do "Ir para" devolve a cena anterior mas deixa o destaque parado. Carregar o retrato é edição de conteúdo, o destaque é ferramenta; assinar o histórico só para isso custa mais que o incômodo.
    - **❓ A confirmar com o usuário:** a recomendação é o destaque seguir **só** o "Ir para", pela razão do primeiro marcador. A alternativa é segui-lo pelo playhead — aí ⏮/⏭ e arrastar a régua também moveriam a marca, e não seria preciso estado novo (derivaria do instante como o papel-cebola já faz), mas se perde a leitura de "o que estou editando".

41. ✅ **Marcar o mesmo keyframe na régua do rodapé** (concluído em 2026-07-29, junto com o 40, ver `DECISOES.md` #73). Texto original do item: Complemento do item 40, pedido junto: o keyframe que está na bancada também aparece marcado na `TimelineBar`, para a barra e o painel contarem a mesma história.
    - **Depende do 40** e não acrescenta estado: lê o mesmo `visitedKeyframeId` e o converte em posição com o `keyframeStartTimesMs` que a barra já calcula.
    - **Não dá para usar o `<datalist>` das marcas:** ele é a lista nativa do próprio `<input type=range>` e não aceita estilo por opção. A marca vai como um elemento posicionado sobre a régua, na mesma técnica das faixas de grupo do #38 (`left` em porcentagem do total) — que já provou que essa camada funciona.
    - **Cuidado de leitura:** a régua já carrega o polegar do playhead e as faixas dos grupos. A marca precisa ser distinguível dos dois **sem competir** com o polegar, que é o que o usuário arrasta; um traço fino de cor de destaque abaixo da régua resolve sem disputar o mesmo espaço.
    - **Recolhida a barra, não há o que marcar** — o corpo dela nem é renderizado, e nenhum código extra é necessário para isso.

*(item 67 acrescentado em 2026-08-06, a pedido do usuário, e implementado na mesma sessão — a numeração continua do fim, sem renumerar nada)*

67. ✅ **Guarda temporária da bancada no "Ir para"** (concluído em 2026-08-06, ver `DECISOES.md` #127). Pedido do usuário: clicar "Ir para" num keyframe guarda a cena que estava na tela, e um botão a recupera. Fecha o "limite aceito" do item 40 — o Ctrl+Z sempre devolveu a cena de trabalho, mas nada na tela prometia a volta, e quem foi só conferir o keyframe 7 depois de posar cinco bonecos não pensa em desfazer. As quatro decisões de desenho foram perguntadas antes do código, e uma quinta veio no meio da execução:
    - **Guarda bonecos E câmera de cena** — o par exato que o "Ir para" sobrescreve. Objetos de cena ficam de fora: desde o item 42 são cenário estático, fora do retrato do keyframe.
    - **Um slot só, e recuperar TROCA**: a cena da tela entra na guarda no lugar da que sai, e o botão vira um alternador entre a cena que se estava montando e o keyframe visitado. Pilha ficou de fora (UI e memória por um gesto de ida e volta).
    - **Não sobrevive a recarregar**: estado de ferramenta, no regime do papel-cebola e do `visitedKeyframeId` — fora do undo e fora do arquivo.
    - **Vale nas duas cascas**: o "Ir para" da aba Keyframes do módulo de poses guarda também, e lá o Ctrl+Z não está ao alcance do polegar. A guarda é uma só, com um botão em cada casca.
    - **O destaque do keyframe não se larga** (pedido do usuário durante a execução): painel e régua do rodapé continuam marcando o keyframe escolhido depois de recuperar — é contra ele que o botão alterna, e a marca diz para onde o segundo clique leva.
    - **Só guarda o que MUDOU** (segundo pedido do usuário, na mesma sessão): percorrer keyframes não pode apagar a cena original. Bancada intocada desde o último "Ir para" — igualdade referencial do array de bonecos, a premissa do `undoEquality` — não é guardada de novo. A câmera de cena fica fora da conta de propósito: o ⏮/⏭ da régua escreve nela sem que a cena mude, e era o segundo caso da queixa. A marca viaja com a guarda, então recuperar duas vezes devolve um retrato que continua intocado.
    - **Limite anotado:** a guarda não é esvaziada ao carregar outra cena ou snapshot; o retrato continua válido e recuperá-lo é um passo de undo, mas o botão fica habilitado com uma cena de outro contexto.

68. ✅ **Três facilidades no card do keyframe** (concluído em 2026-08-06, ver `DECISOES.md` #128). Pedido do usuário, com as três decisões de desenho perguntadas antes do código:
    - **"Pos ↑ / Pos ↓" — copiar a colocação no plano do vizinho**, o terceiro par de setas do card ao lado de "Câm ↑↓" (#55) e "Pose ↑↓" (item 28). **Só X e Z**, onde o boneco pisa: o Y é altura de salto (movimento, não colocação) e o giro da raiz é outra propriedade. É o gesto de tirar a deriva de quem escorrega entre dois keyframes sem perder pose nem enquadramento. Bonecos casam por id; quem não tem par no vizinho não se move; sem diferença de colocação nada é reescrito (o undo não ganha passo vazio).
    - **Apagar confirma em MODAL**, no caminho do #100: era a única ação do card que jogava fora conteúdo gravado sem perguntar, enquanto "Regravar" pede confirmação desde o #69. **Nas duas cascas** — na aba Keyframes do módulo de poses o ✕ é alvo de dedo e não há Ctrl+Z ao alcance do polegar.
    - **Duplicar leva a bancada e os indicadores para a CÓPIA** (e não para o original): é ela que se ajusta em seguida, e o card novo marcado explica o que aconteceu. Reusa o `goToKeyframeWithStash` do item 67, então a duplicação também guarda a cena de trabalho. Dois passos de undo, de propósito — duplicar é edição da linha do tempo, carregar o retrato é edição da cena.
    - **Complemento (mesmo dia): escolher QUEM recebe a cópia.** As duas cópias entre vizinhos passavam sempre o elenco inteiro, e numa cena de duas pessoas acertar uma arrastava a outra. `CopyFiguresDialog` mostra caixas dos bonecos; aparece **só com 2+ bonecos em cena** (com um só não há escolha, e o clique continua direto), lista o **elenco comum aos dois keyframes** (`sharedKeyframeFigures` — quem não está nos dois não tem como receber nem de onde vir) e nasce com **todas marcadas**, lembrando na sessão quem ficou de fora. `figureIds` é opcional nas duas ações do store: sem ele, o comportamento é o de antes.

### I. Objetos de cena

*(grupo e item 42 acrescentados em 2026-07-30, a pedido do usuário — a numeração continua do fim, sem renumerar o que já existe; os números 40 e 41 já pertencem ao destaque do keyframe na bancada)*

42. ✅ **Objetos 3D simples redimensionáveis na cena** (concluído em 2026-07-30, ver `DECISOES.md` #80). Cubo/paralelepípedo, cilindro, esfera, cone, plano e rampa como cenário em volta dos bonecos. O usuário pediu a avaliação antes de implementar; ela apontou que a maior parte da complexidade do app é do MANEQUIM (esqueleto, limites, poses, IK, espelho, travas) e que nada disso é reaproveitado como custo aqui — um objeto é `forma + tamanho + colocação + cor`. Cinco decisões foram levadas a ele e respondidas antes de escrever qualquer código:
    - **Cenário estático, não ator.** O objeto **não** entra no retrato dos keyframes (`AnimationKeyframe.figures`). Foi a decisão que mais mudou o custo: manteve intactos o amostrador, a biblioteca de trechos, o remapeamento de elenco (#79) e o formato do `animations.json`.
    - **Tamanho em metros por eixo, nunca escala.** O gizmo de escala do viewport é só outra forma de arrastar o mesmo número; o que é gravado é sempre metro, na mesma unidade do boneco de 1,70 m e da grade de 1 m.
    - **Vértice livre**, e não alças de face/canto. Foi contra a recomendação da avaliação (que alertava para a saída do território "primitiva") e o usuário confirmou. Viabilizado sem virar editor de malha por dois mecanismos: **pontos de controle soldados** e **desvios esparsos em metros absolutos** — ver `DECISOES.md` #80.
    - **Pivô no centro + botão "apoiar no chão"**, teto de **20 objetos**, e a subseção mora no painel de Bonecos (não em painel próprio, que gastaria mais uma coluna numa tela com seis).
    - **Seleção generalizada**, pedida junto: com o objeto, passavam a ser três coisas selecionáveis e a exclusividade era mantida à mão aos pares.
    - **Duas funcionalidades acrescentadas pelo usuário depois da avaliação:** "ocultar na bancada" (some da tela de trabalho, **continua saindo** no PNG e no MP4 — o simétrico exato dos `OVERLAY_NAMES`) e "travar" (visível, mas fora do alcance do clique, para não selecionar o cenário por engano ao posar).


### J. Edição em dispositivo touch

*(grupo e itens 43-44 acrescentados em 2026-07-30, a pedido do usuário — a numeração continua do fim, sem renumerar o que já existe)*

43. ✅ **Casca de palito e pose em arquivo JSON** (concluído em 2026-07-30, ver `DECISOES.md` #81). Primeira etapa, dentro da aplicação atual, do objetivo maior de posar o boneco no celular. O usuário pediu três avaliações antes de qualquer código — cascas alternativas do boneco, a visão de celular em quadrante 2×2, e como implementá-la sem afetar o existente — e mandou implementar só o que cabe aqui.
    - **Casca de palito**, escolhida na Toolbar (`Boneco` > `Palito (juntas grandes)`): juntas como esferas grandes e ossos como cilindros finos, invertendo a proporção do manequim para o que se toca ficar gordo e o que só liga ficar magro. É **só aparência** — mesmo esqueleto, mesmas poses, mesmos limites, e o default de todo consumidor continua sendo o manequim de madeira.
    - **Pose em arquivo (.json)**, no painel de Propriedades, junto das demais operações de pose do boneco inteiro: exportar e carregar a pose do boneco selecionado. O arquivo usa **a estrutura interna das animações** (o objeto de `keyframes[].figures[]`), e a leitura aceita também um `animations.json` inteiro, um keyframe solto ou uma animação solta. *(A seção nasceu no painel de Bonecos e foi movida para cá no mesmo dia, a pedido do usuário — ver `DECISOES.md` #81.)*
    - **Contrato de colocação**, definido pelo usuário: grava como se o boneco estivesse no (0,0) do plano horizontal (X/Z zerados, Y preservado) e carrega mantendo X/Z do boneco de destino, trazendo do arquivo apenas o Y. Onde ele pisa é composição; agachar e pular são pose.
    - **Preferência de tela, não de cena:** a casca vale para todos os bonecos, fica fora do undo e não viaja no `.glb` nem no `workspace.json` — mesmo tratamento da régua e da máscara de enquadramento.

44. ✅ **Versão "Lite" — PWA de posagem para celular e tablet** (concluído em 2026-07-31, ver `DECISOES.md` #92 e o `HISTORICO.md`). O nome de uso ficou **"Módulo de poses"** — "Lite" era o apelido de projeto —, e o pedido de implementação acrescentou uma decisão de layout: o painel de controle fica **embaixo em tela vertical e à direita em tela horizontal**. Os ❓ do fim do item foram todos respondidos pelo usuário antes do código; as respostas estão anotadas neles. Texto original do item: Uma segunda casca de UI sobre o mesmo núcleo, desenhada para o dedo e para tela pequena.

    **Uma vista por vez, em qualquer aparelho.** A ideia de dividir o viewport — o quadrante 2×2 avaliado antes, e depois a grade 2×3/3×2 em tablet — está **descartada**, inclusive em tablet e computador (decisão do usuário). O viewport é sempre um só, ocupando a tela toda, e o usuário ALTERNA entre as vistas. A razão vale para telas grandes também: cada vista ortográfica precisa de área para a junta virar alvo de dedo, e seis painéis pequenos entregam seis alvos ruins em vez de um bom. Uma vista grande com troca rápida também mantém uma única casca a manter, em vez de dois modos de viewport com regras próprias de foco e de gizmo.

    **O que a Lite é para, e o que ela deliberadamente não é.** O objetivo é gerar POSES e keyframes; refinamento de câmera, duração entre keyframes, enquadramento, instantâneos e vídeo continuam sendo trabalho da aplicação completa. A ponte entre as duas é o JSON no formato de animação, que já existe e já vai e volta (item 43 / `DECISOES.md` #81).

    #### As seis vistas e a dimensão travada

    Cinco vistas ortográficas de edição, cada uma travando um eixo, mais uma de navegação livre sem edição nenhuma:

    | Vista | Trava | Edita | Serve para |
    |---|---|---|---|
    | Frente | Z (profundidade) | X, Y | silhueta frontal, braços e pernas abertos |
    | Trás | Z (profundidade) | X, Y | alcançar o que a frente esconde |
    | Lado esquerdo | X (lateral) | Z, Y | flexão/extensão, o perfil da pose |
    | Lado direito | X (lateral) | Z, Y | o mesmo, pelo outro lado |
    | Cima | Y (altura) | X, Z | torções do tronco e a colocação no chão |
    | Livre | — | nada¹ | conferir a pose em 3D, sem risco de mexer nela |

    > ¹ **Revisto em 2026-07-31** (`DECISOES.md` #93): a Livre ganhou edição **destravável** por um cadeado na barra — travada (padrão), continua exatamente como descrito; destravada, mostra o palito e edita por arrasto no plano da tela + gizmo de três setas de eixo (translação apenas, sem rotação e sem as setas do painel).

    São seis, e como só uma aparece de cada vez, acrescentar ou remover uma vista depois custa apenas uma entrada a mais no seletor — não há layout a rever junto.

    **A trava não toca no solver.** `dragSolver.solveJointDrag` recebe um alvo em coordenadas de MUNDO e devolve rotações já grampeadas, sem saber nada de câmera nem de ponteiro. Travar uma dimensão é só projetar o toque no plano que passa pela junta e é perpendicular ao eixo da vista — a profundidade fica a que já era. Vale escrever a projeção a partir da BASE DA CÂMERA da vista, e não com eixos escritos à mão: assim as vistas "trás" e "direito", em que arrastar para a direita na tela move o boneco no sentido oposto do mundo, saem certas de graça em vez de virarem dois casos especiais.

    #### Troca de vista e layout responsivo

    A vista ativa é simplesmente **a que está na tela** — não há vista em segundo plano nem foco a disputar, e por isso também não existe a regra de "promover a vista tocada". Tocar numa junta seleciona a junta, e só.

    - **Troca:** abas com o nome da vista, mais setas de avançar/voltar para percorrer as seis em sequência sem mirar numa aba específica. Deslizar o dedo na horizontal sobre o viewport é o gesto natural para o mesmo fim e vale considerar — com o cuidado de não brigar com o arrasto de junta (só a partir da borda, ou com dois dedos).
    - **O responsivo é o CROMO, não o viewport:** o que muda entre celular, tablet e computador é a barra de vistas (ícone só × ícone com rótulo), a altura e a densidade das abas do rodapé, e quanto texto de ajuda cabe. O viewport ocupa o resto em todos eles.
    - **Implementação:** um único `<Canvas>` com uma câmera que troca de posição/projeção ao mudar de vista. Sem `<View>` do drei, sem renderização por *scissor*, sem vários contextos WebGL — nada disso é necessário quando só há uma vista viva.
    - **Vantagem de manutenção:** com uma vista por vez, a vista ativa vira estado único e simples (`viewKey`), e o arrasto tem sempre um só plano de projeção em vigor. Era exatamente aí que a grade cobraria caro: seis vistas simultâneas exigiriam decidir, a cada toque, em qual delas o gesto começou e qual plano usar.

    #### Bonecos

    - De **1 a 5**, o mesmo teto da aplicação atual (`MAX_FIGURES`).
    - O boneco a editar é **escolhido explicitamente** — nada de editar por engano quem estava só passando na frente. Numa tela onde o alvo é o dedo, isso importa mais que no desktop.
    - Opção para **deixar invisíveis os bonecos que não estão sendo editados** (`toggleVisibility` já existe e já torna o boneco inerte ao clique).
    - **Edição só no palito** (item 43), nas cinco vistas ortográficas. A vista livre pode mostrar o boneco COMPLETO — o `style` do `<Figure>` já é prop, então isso é escolha por vista, não a preferência global da Toolbar.

    #### Câmera: sai a de CENA, fica a de TRABALHO

    A aplicação já trata as duas como coisas separadas desde a fase 11 (`DECISOES.md` #78), e a Lite simplesmente **fica com uma e descarta a outra** — decisão do usuário:

    - **Sai inteira a CÂMERA DE CENA**, que é a que define o quadro do PNG, do MP4 e dos keyframes: lente/distância focal, bookmarks, "ver pela câmera", posicionar/mover/girar a câmera, máscara de enquadramento e régua. Enquadrar é trabalho da aplicação completa.
    - **Fica a CÂMERA DE TRABALHO**, a que navega o viewport: deslocar e aproximar dentro de cada vista ortográfica (sem isso não se alcança uma junta pequena no celular) e orbitar livremente na vista de navegação. As cinco vistas de edição são a mesma câmera de trabalho presa a um eixo; a vista livre é ela solta.
    - **Nada da câmera de trabalho é gravado**, exatamente como no desktop: o keyframe leva valores padrão de câmera (ver o botão flutuante, abaixo), então para onde o usuário estava olhando na Lite não vaza para o arquivo nem atropela o enquadramento que será feito depois.

    #### Botão flutuante: salvar keyframe

    Um botão flutuante grava a pose atual como keyframe novo, com **câmera padrão** (a partir de `CAMERA_DEFAULTS`) e **duração padrão** (`DEFAULT_KEYFRAME_DURATION_MS`, 1 s).

    Dois detalhes verificados que economizam trabalho:

    - A ação de store `addAnimationKeyframe(animationId, camera)` **já recebe a câmera como parâmetro** — a Lite passa a padrão e não precisa de ação nova. O desvio que o desktop faz (um `pendingCommand` consumido pelo `AnimationPlayer` de dentro do `<Canvas>`) existe só porque lá é preciso ler a câmera VIVA; sem câmera de cena, a Lite chama a ação direto.
    - O keyframe **precisa** de uma câmera: `sanitizeAnimations` descarta keyframe sem ela. Por isso valores padrão, e não campo ausente.

    #### Controles no rodapé, em abas

    Tudo o que é edição mora numa faixa inferior dividida em abas — é a região que o polegar alcança, e abas evitam a barra única que não caberia. O que vem da aplicação atual (todas as ações já existem no store):

    - **Junta:** travar/destravar (`toggleJointLock`, `clearJointLocks`) e **voltar a junta à posição inicial** (`resetJointRotation`).
    - **Simetria:** copiar esquerda→direita e direita→esquerda (`mirrorSide`), **espelhar o boneco todo** (`mirrorWholeFigure`), inverter lados (`swapSides`) — com escopo de membro ou do boneco inteiro — e **espelhar mudanças ao vivo** (`toggleLiveMirror`).
    - **Papel-cebola:** anterior, posterior ou ambos. O modo já existe pronto (`OnionSkinMode = 'both' | 'previous' | 'next'`, com `setOnionSkinMode`) e o cálculo dos quadros vizinhos está num módulo puro (`onionSkin.ts`), reaproveitável sem tocar no componente de desktop.
    - **Translação fina:** setas cima/baixo/esquerda/direita para o ajuste que o dedo não acerta.

    **As setas são o arrasto, em passos.** Elas devem empurrar a junta **no plano da vista ativa**, alimentando o mesmo `solveJointDrag` — não uma segunda rotina de edição. Assim a dimensão travada vale para as setas automaticamente, o resultado é idêntico ao do arrasto e há um caminho de código só a manter.

    #### O que sai da Lite

    Presets de pose e de mão, biblioteca de poses, trechos de animação, importação/exportação `.glb` (boneco, cena e bookmarks), workspace em pasta, instantâneos PNG, exportação de vídeo, objetos de cena, e a **câmera de cena** inteira (ver acima — a câmera de trabalho fica).

    **Ressalva:** `posePresets.ts` sai da UI, **não do código** — `addFigure` usa `resolvePosePreset('tpose')` como pose inicial de todo boneco novo. Remover o módulo quebraria a criação de boneco na própria Lite.

    #### Facilidades de tela sensível ao toque

    Aproveitando o levantamento feito antes; a primeira é escolha explícita do usuário:

    - **Duplo toque numa junta = travar/destravar.** Põe o cadeado no próprio corpo, que é onde a mão já está.
    - **Alvos de toque invisíveis** maiores que a geometria, por junta — o palito já engordou as juntas, e uma esfera transparente maior fecha o resto.
    - **`touch-action: none`** no canvas: sem isso o navegador rouba o arrasto para rolar a página. É uma linha de CSS e é o maior atrito de canvas no celular.
    - **Rotação com dois dedos = torção da junta no próprio eixo.** Vale destacar que isto não é enfeite: com uma dimensão travada por vista, a torção (o eixo Y de pronação/supinação, o giro do ombro) **não é alcançável pelo arrasto planar**. Sem esse gesto — ou um controle equivalente no rodapé — fica um grau de liberdade inacessível na Lite.
    - **Dois dedos = desfazer, três = refazer** (convenção do Procreate), já que não há Ctrl+Z.
    - **Vibração ao saturar o limite articular:** o solver já devolve `reached: false` e a posição efetivamente alcançada. Ressalva honesta: a Vibration API funciona no Android e **não** no Safari do iOS, então é reforço, nunca o único aviso.
    - **Compartilhar (Web Share)** o JSON gerado, que é o substituto natural do "salvar na pasta" — a File System Access API não existe no iOS.
    - **Wake Lock** para a tela não apagar enquanto se estuda a pose.

    #### Arquitetura e isolamento (avaliação já feita, ver `DECISOES.md` #81)

    - O app **já é um PWA** instalável e offline (`vite-plugin-pwa`, fase 6) e o manifest usa `start_url: '.'` — desktop e celular resolvem para o mesmo `index.html`. Escolher a casca em runtime não exige tocar em **nada** da configuração do PWA, que é o caminho de menor risco.
    - **Uma única edição em arquivo existente:** `App.tsx` escolhendo entre `AppShell` e a casca Lite. Nenhum teste monta `App`, então essa edição não afeta a suíte. Todo o resto em arquivos novos: estado próprio em store novo (nunca no `uiStore`), CSS próprio sob classe raiz própria, e viewport novo — e **não** o `Viewport.tsx` atual adaptado, que carrega `CameraRig`, máscara, régua, papel-cebola, captura e gizmos.
    - **Componentes compartilhados só ganham props aditivas e opcionais**, com o default reproduzindo o comportamento de hoje. Se um teste existente precisar mudar para continuar passando, a fronteira foi violada.
    - **Detecção da casca:** ponteiro grosso **e** viewport estreito (não só a largura), decidida uma vez no carregamento, com override explícito e persistido para testar a Lite no desktop.

    #### ❓ A decidir com o usuário antes de implementar — **todas respondidas em 2026-07-31** (ver `DECISOES.md` #92)

    - **Autosave:** a Lite compartilha a chave `webposer:workspace:v1` com o desktop (recomendado — abrir no celular e continuar de onde parou, no mesmo aparelho), usa chave própria, ou não autossalva? → **Chave própria** (`webposer:poses:v1`): a sessão do módulo é separada da do desktop.
    - **Quanto de linha do tempo a Lite administra.** O papel-cebola de anterior/posterior implica que existe uma sequência e uma posição corrente nela — então a Lite precisa de ao menos um navegador de keyframes. Fica só em "acrescentar e navegar", ou também reordenar, substituir e apagar? → **Gestão completa**: capturar, ir para, regravar, reordenar e apagar (duração e câmera continuam no desktop; regravar preserva a câmera gravada).
    - **A Lite abre um JSON existente** para continuar uma animação começada no desktop, ou só exporta? → **Abre e exporta** (substituindo ou anexando à linha do tempo de trabalho), sem remapeamento de elenco.
    - **Desfazer:** a Lite tem histórico próprio (o `zundo` do `figuresStore` viria de graça) ou fica sem? → **Tem, por botões** — sem os gestos de dois/três dedos.
    - **Altura e colocação no chão:** a Lite deixa mudar a altura do boneco e posicionar os cinco no plano? A vista de cima é o lugar natural para o X/Z, e com cinco bonecos alguma separação é necessária. → **Os dois liberados**: altura no painel de Bonecos; colocação por arrasto/setas da raiz, com a vista de cima andando no plano do chão.
    - **Vista livre:** mostra só o boneco em edição ou a cena toda? → **A cena toda**, com o manequim completo; o filtro "mostrar só o boneco em edição" (de tela, não o `visible`) continua valendo.
    - **Torção:** confirmar o gesto de dois dedos como caminho para o eixo que o arrasto planar não alcança, ou preferir um controle no rodapé. → **Os dois**: slider no painel + giro de dois dedos (que só vence a câmera após 10° acumulados).

*(itens 45–59 acrescentados em 2026-07-31: as 15 sugestões de melhoria do módulo de poses levantadas após a entrega do item 44, registradas a pedido do usuário — a numeração continua do fim, sem renumerar nada. Os marcados ✅ foram implementados no mesmo dia, ver `DECISOES.md` #94.)*

45. ✅ **Arrasto solto fora do canvas** (concluído em 2026-07-31). Os listeners de `pointermove`/`pointerup` do arrasto e do gesto de torção passaram do canvas para a `window`: um arrasto rápido levava o dedo para fora do canvas antes do soltar, e o arrasto ficava "grudado" até o toque seguinte.

46. ✅ **Wake Lock re-pedido ao voltar à aba** (concluído em 2026-07-31). O navegador solta o lock quando a página perde visibilidade e o pedido era único; agora o `visibilitychange` re-pede ao ficar visível.

47. ✅ **Arrasto coalescido por `requestAnimationFrame`** (concluído em 2026-07-31). O solver e a re-renderização dos bonecos rodavam por `pointermove`; agora cada quadro resolve só o último evento — mitigação de desempenho para celular médio, sem mudança de comportamento.

48. ✅ **Gizmo com tamanho constante em tela** (concluído em 2026-07-31). As setas da vista Livre (#93) tinham 0,3 m fixos — minúsculas longe, gigantes perto; o grupo é reescalado por quadro pela distância da câmera.

49. ✅ **Botão "Enquadrar boneco"** (concluído em 2026-07-31). Com pan/zoom livres é fácil perder o boneco da vista; o botão da barra recentra a vista no boneco em edição — nas ortográficas repõe câmera e zoom da vista, na Livre mantém a direção de órbita.

50. ✅ **Duplo toque na junta = travar/destravar** (concluído em 2026-07-31). Estava na lista de facilidades do item 44 e tinha ficado de fora; põe o cadeado onde a mão já está (a raiz fica de fora — não trava).

51. ✅ **Botões ±1°/±5° nos sliders** (concluído em 2026-07-31). Torção e rotação da raiz ganharam ajuste fino por botão — dedo em slider é impreciso, e o grampeamento continua o dos limites.

52. ✅ **Poses de partida na aba Boneco** (concluído em 2026-08-02, ver `DECISOES.md` #105). A revisão consciente foi decidida pelo usuário ao mandar implementar: combo "Pose de partida" com o catálogo inteiro do desktop (rótulos compartilhados via `posePresetLabels.ts`, extraídos do `PropertiesPanel`) + "Aplicar pose" via `applyPosePreset`, sem o pareamento de dupla. Texto original do item: `applyPosePreset` já existe (em pé, sentado, T-pose…); montar pose do zero no celular sem ponto de partida é trabalhoso. O plano tirou os presets da Lite ("O que sai da Lite"), então é uma revisão consciente a decidir.

53. ✅ **Indicador de autosave no módulo** (concluído em 2026-08-02, ver `DECISOES.md` #105). Badge de ponto colorido no `PosesTopBar`, lendo o mesmo `uiStore` e reusando as chaves `toolbar.autosave*` como nome acessível/título — nenhuma string nova. Texto original do item: O módulo grava na chave própria mas não mostra estado; o `uiStore` já marca pendente/salvo/falha — falta só o badge.

54. ✅ **Trazer/levar a sessão entre as cascas** (concluído em 2026-08-01, ver DECISOES.md #98). As sessões são separadas por decisão (#92); no mesmo aparelho, um botão "trazer a sessão da outra casca" (com confirmação — substitui a sessão atual e zera o undo) no painel de Cenas do desktop e na aba Arquivos do módulo completa o desenho para quem começa numa casca e continua na outra.

55. ✅ **Aba Arquivos aceitar pose avulsa** (concluído em 2026-08-02, ver `DECISOES.md` #105). Botão "Aplicar pose do arquivo": `parseFigurePoseFile` → `applyImportedFigurePose` no boneco em edição, com as mensagens de erro do desktop; desabilitado sem boneco em edição. Texto original do item: O leitor de "Pose em arquivo" (#81/#87) aceita a família inteira de formatos; a aba só abre animação. Aplicar um JSON de pose ao boneco selecionado reusaria `parseFigurePoseFile` quase de graça.

56. ✅ **Atalho do PWA para o módulo de poses** (concluído em 2026-07-31). Entrada `shortcuts` no manifest apontando para `./?shell=poses`; a URL vence o override gravado (é o gesto mais explícito), e os botões de troca de casca removem o parâmetro ao navegar — sem isso, um app aberto pelo atalho ficaria preso à casca da URL.

57. ✅ **Playwright para o que o unit test não alcança** (concluído em 2026-08-01, ver `DECISOES.md` #95). Quatro smokes em `e2e/poses.spec.ts` (`npm run test:e2e`, Chromium sobre o dev server): casca por URL e troca pelos botões, arrasto REAL da raiz na vista de frente (asserção pelo autosave do módulo), pan de um dedo que não toca na pose, e vista Livre com cadeado — todos conferindo console limpo. Texto original: Arrasto, gizmo, pan por um dedo e troca de casca são conferência manual hoje; #31.5 já provou que o Playwright alcança arrasto. Um smoke por vista pagaria o custo rápido.

58. ✅ **Extrair a lógica de arrasto do `PosesViewport`** (concluído em 2026-08-02, ver `DECISOES.md` #107). `posesDrag.ts`: `dragTargetForPointer` (as três formas do arrasto), `draggedRootPosition` e a máquina de estados do gesto de torção (`TwistTracker`), tudo puro e coberto por 8 testes; o componente ficou só com a cola, comportamento preservado. Texto original do item: O componente concentra arrasto planar, por eixo, gesto de torção e gizmo; um módulo/hook testável separado deixaria a matemática coberta e o componente só com a cola.

59. ✅ **Espelho por membro na aba Simetria** (concluído em 2026-07-31). Seletor de alcance — boneco inteiro ou a partir da junta selecionada — usando o mesmo `scopeJoint` do desktop (#34); a opção por junta desabilita quando a selecionada não tem par no escopo.

*(itens 60–61 planejados em 2026-08-01 a pedido do usuário — desenho decidido com ele antes de qualquer código; implementados no mesmo dia, em sessão seguinte; a numeração continua do fim.)*

60. ✅ **Sliders de rotação por eixo na aba Junta + anéis gimbal de leitura** (concluído em 2026-08-01, ver `DECISOES.md` #96). Substitui o slider único de torção por **um bloco por eixo de DOF** da junta selecionada (`getJointAxes`, 1–3 eixos), no mesmo estilo dos sliders da raiz — min/max dos limites efetivos (override do workspace ?? `skeleton.ts`), aplicado via `setJointRotation` (clamp e trava valem). Decisões já tomadas:
    - **A torção não perde nada**: era só o eixo `y`, que vira um dos sliders; o gesto de dois dedos continua no `y`. O caso "sem torção" (joelho) desaparece — toda junta tem ≥1 DOF — e as chaves `twist*` do i18n saem.
    - **Cores por eixo, o padrão do gizmo**: X `#e04040`, Y `#40a840`, Z `#4060e0` (as mesmas das setas de translação) no rótulo e no `accent-color` do slider — nos da raiz também. As chaves `rootRotation*` do i18n unificam-se em `rotation*`.
    - **Indicador visual: ANÉIS GIMBAL, não interativos** (decisão do usuário), na junta selecionada do boneco em edição, em **todas as vistas de edição** (ortográficas + Livre destravada; na Livre convive com as setas de translação — setas arrastam, anéis só leem). Um anel colorido por eixo de DOF, **fiel ao Euler XYZ**: anel X no frame do pai, Y no frame após a rotação X, Z após X e Y — senão o anel mentiria em junta já rodada. Matemática pura num helper `jointAxisFrames(figure, junta)` (frame do pai via `buildJointFrames` + dois quaternions), testável por unidade; componente `JointAxisRings` só desenha, com tamanho constante em tela (mesmo mecanismo do gizmo de setas). Raiz: três anéis nos eixos do mundo.
    - Custo: painel + CSS + i18n baixos (RTL); anéis médios (helper por unidade, desenho para o e2e/visual).

61. ✅ **Botão "voltar ao inicial" por eixo, no meio dos botões finos** (concluído em 2026-08-01, ver `DECISOES.md` #96). A linha de ajuste fino vira **[−5°, −1°, ⟲, +1°, +5°]** (grade de 5 colunas); o ⟲ devolve **só aquele eixo** ao valor inicial. Decisões já tomadas:
    - **A referência é a MESMA do `resetJointRotation` do store**: `resolvePosePreset('standing')[junta]?.[eixo] ?? 0` — o cotovelo volta a y=90, não a zero cru. Raiz: 0 no eixo (a referência de colocação do reset).
    - Aplicado via `setJointRotation`/`setRootRotation` — trava e clamp respeitados; botão desabilitado com a junta travada.
    - Testes: reset do `elbow.L.y` ao neutro sem tocar no `x`; reset de um eixo da raiz; estado desabilitado por trava.

*(item 62 planejado em 2026-08-01 a pedido do usuário — desenho decidido com ele antes de qualquer código; implementado no mesmo dia, junto do 63, em sessão seguinte; a numeração continua do fim.)*

62. ✅ **Âncora de junta: fixar a posição no espaço e congelar tudo que vem antes** (concluído em 2026-08-01, ver `DECISOES.md` #97). Ancorar uma junta fixa a posição DELA no mundo: exemplo do usuário — cotovelo ancorado não sai do lugar, mas punho e dedos se movem "considerando a limitação do cotovelo"; nada proximal a ele mexe. Pelo modelo FK isso **não pede solver novo**: a posição de uma junta depende só dos ancestrais + raiz, então a âncora equivale a um **conjunto de travas derivado** — `getJointChain(junta)` inteiro, sem a própria junta — somado às travas manuais em todos os pontos que já as consultam (`mergeLockedJoints`, `solveJointDrag`, sliders/gizmo/teclado). No arrasto, o recrutamento progressivo do CCD morre naturalmente na âncora, sem tocar no solver. Decisões já tomadas (perguntadas antes de qualquer código):
    - **A rotação da própria junta ancorada continua livre** — cotovelo ancorado ainda dobra (isso move o punho, não o cotovelo). Rigidez total = âncora + cadeado na mesma junta.
    - **Várias âncoras por boneco**: o conjunto congelado é a UNIÃO das cadeias de ancestrais.
    - **A raiz congela junto** — parte genuinamente nova: âncora implica colocação congelada (gizmo de raiz na cena, arrasto de raiz no módulo de poses, sliders de raiz da aba Junta e campos do painel de Propriedades, todos desabilitados com o porquê). Âncora em `spine`/`hip.*` congela só a raiz — vira um "congelar colocação" útil por si.
    - **UI nas duas cascas**: botão ao lado do cadeado no painel de Propriedades e na aba Junta do módulo de poses, ícone próprio (âncora ≠ cadeado), indicador visual na junta ancorada e contagem visível como a das travas.
    - **Mesmo regime de persistência da trava (#42)**: estado de ferramenta — sessão/autosave, fora do undo e fora do arquivo de cena; duplicar boneco leva as âncoras junto.
    - Efeitos colaterais aceitos (regra única do #42): espelho/sorteio/aplicar pose preservam a cadeia congelada; reprodução de animação fica por fora, como as travas.
    - Custo estimado: uma sessão cheia — módulo puro `jointPins.ts` espelhando `jointLocks.ts` + derivação da cadeia, threading do conjunto derivado nos consumidores de trava, congelamento da raiz (a superfície mais espalhada), UI + i18n, tudo por TDD. Nenhum risco algorítmico.

*(item 63 planejado em 2026-08-01 a pedido do usuário — desenho decidido com ele antes de qualquer código; implementado no mesmo dia, junto do 62, em sessão seguinte; a numeração continua do fim.)*

63. ✅ **Raiz rotacionável no arrasto de junta — girar sim, transladar nunca** (concluído em 2026-08-01, ver `DECISOES.md` #97). Muda a regra "a raiz nunca se move" do `dragSolver`: no arrasto de junta, a raiz entra como **último elo recrutável** do recrutamento progressivo, com um passo de CCD que só GIRA a colocação (`figure.rotation`, pivô no quadril — é onde `buildJointFrames` aplica a rotação) — a translação da raiz continua proibida. Todo alvo alcançável pela cadeia se comporta exatamente como hoje (a raiz só entra depois de TODA a cadeia saturar); alvo fora de alcance faz o boneco girar atrás dele, em vez de o gizmo travar na borda. Decisões já tomadas (perguntadas antes de qualquer código):
    - **Os TRÊS eixos de rotação** (decisão do usuário, contra a recomendação de só Y): o corpo pode inclinar/tombar para alcançar o alvo. O passo do elo raiz fica idêntico ao das juntas (menor rotação no mundo levando efetuador→alvo), sem clamp — a raiz não tem limites. Efeito colateral aceito: com o pivô no quadril, inclinar tira os pés do plano do chão, e o "gizmo trava na borda" praticamente desaparece (o corpo sempre pode girar na direção do alvo).
    - **Sempre ativa, sem alternância de UI**: o recrutamento por último já protege o caso comum; quem não quiser o giro num boneco usa a **âncora (item 62)**, que congela a colocação e tira a raiz do recrutamento — é a válvula de escape para pés plantados.
    - **`hip.L`/`hip.R` continuam fora do arrasto**: com a raiz girando o gizmo deles deixaria de nascer morto, mas o ganho é marginal — `isDraggableJoint` fica como está (`spine` continua morto de qualquer jeito: está sobre o eixo do pivô).
    - **Contrato e escrita**: `JointDragResult` ganha a rotação resultante da raiz; `applyJointDrag` e o caminho do módulo de poses gravam juntas + raiz **num passo de undo só** (ação combinada no store). Espelho, sorteio e aplicar pose não tocam na raiz — inalterados.
    - Custo estimado: meia sessão a uma sessão — passo do elo raiz no solver + contrato, ação combinada nos dois stores, testes TDD dos dois caminhos. Sem UI nova e sem risco algorítmico.

*(item 64 planejado em 2026-08-01 a partir de um bug relatado pelo usuário — a raiz não tinha NENHUM caminho funcional de trava: `toggleJointLock` a ignora desde o #42, o desktop nem mostra o cadeado para ela e o módulo o mostra desabilitado; desde o item 63 o solver a recruta sem que haja como impedir sem âncora)*

64. ✅ **Trava por eixo na rotação da raiz** (concluído em 2026-08-01, ver `DECISOES.md` #99). A raiz ganha três cadeados independentes — um por eixo de rotação (X/Y/Z) — no lugar do cadeado geral que nunca funcionou nela. Eixo travado não muda por NADA (regime único do #42): o arrasto de junta (item 63) só gira a raiz nos eixos destravados (os três travados = raiz fora do recrutamento, o efeito que o cadeado deveria ter), slider/ajuste fino/⟲ do eixo desabilitam, teclado e gesto de torção são recusados no store, e pose aplicada preserva os eixos travados da colocação. Decisões já tomadas (perguntadas antes de qualquer código):
    - **Vale para tudo**, não só para o arrasto — sem uma trava com regras próprias para lembrar.
    - **Cadeado ao lado de cada slider** de rotação da raiz, nas duas cascas.
    - **Sem cadeado geral na raiz**: travar a raiz inteira = travar os três eixos.
    - Mecanismo: tokens `root.x`/`root.y`/`root.z` no MESMO mapa de travas do #42 (mesma persistência, cópia no duplicar, poda e sanitização); eles nunca colidem com nome de junta e passam ilesos por `mergeLockedJoints` (nunca são chave de pose). No solver, o passo da raiz devolve o eixo travado ao valor de partida — o mesmo regime do clamp de limites das juntas.

*(item 65 planejado em 2026-08-01 a pedido do usuário — trazer a animação do desktop para um celular DIFERENTE, onde as chaves de localStorage do item 54 não alcançam, sem app externo e sem rede)*

65. ✅ **Remessa da sessão por QR code — desktop → celular, sem rede e sem arquivo** (concluído em 2026-08-01, ver `DECISOES.md` #101). O desktop exibe a sessão inteira como uma **sequência de QR codes em ciclo** ("Enviar sessão por QR code", painel de Cenas); o celular coleta com a câmera ("Receber sessão por QR code", aba Arquivo do módulo de poses), em qualquer ordem, até completar — e confirma a substituição no próprio modal (#100). Decisões já tomadas (perguntadas antes de qualquer código):
    - **Sequência de QRs**, não arquivo por cabo nem rede local — zero rede preservado; o único canal é a câmera olhando a tela.
    - **A sessão inteira viaja**, no MESMO payload do autosave (formato do item 54) — nenhum formato novo; no destino é o mesmo `loadRestoredWorkspace` do "Trazer sessão".
    - **Leitor nativo com fallback**: `BarcodeDetector` onde existe (Android/Chrome), `jsQR` empacotado no resto (iOS/Safari) — decidido uma vez, em `qrFrameReader.ts`.
    - Protocolo em `src/persistence/qrTransfer.ts`: deflate nativo (`CompressionStream`, o JSON repetitivo encolhe ~10×) → base64 → fatias `VMQR1|id|índice|total|payload`; o id (FNV-1a) separa remessas, o checksum do deflate denuncia corrupção. Coleta tolera ordem, repetição e QR alheio.
    - A coleta com câmera de verdade fica de **conferência visual no navegador** (como o arrasto de gizmo); o resto — protocolo, remontagem, geração de SVG e os dois modais — é coberto por unit test.

### Integração com o Blender por rigging 🔴 ❓

*(proposta sem número — nasceu fora da lista, em 2026-07-31, junto da remoção do glTF)*

Substitui a ponte de `.glb` removida em 2026-07-31 (`DECISOES.md` #85), e não a restaura: exportação de **mão única** com armature de verdade (`THREE.Bone` a partir do `skeleton.ts`, `SkinnedMesh` com pesos rígidos 1,0 por segmento, `AnimationClip` com trilhas de quaternion vindas do `animations.json`). O detalhamento está em "Persistência (formato da cena)" > "Integração com o Blender (rigging)".

Favorecido por o `Figure.tsx` já desenhar o boneco como segmentos rígidos por junta: **não precisa de weight painting**. Marcado ❓ porque falta decidir quando — e se o refino de animação no Blender é mesmo um fluxo desejado, ou se o MP4 basta.

## Publicação e monetização — levantamento ❓

*(levantamento feito em 2026-08-02 a pedido do usuário; nada aqui está decidido — são as opções sobre a mesa, com custos e tensões, para escolher quando chegar a hora)*

### O ponto de partida joga a favor

O app já é, por arquitetura, a coisa mais barata que existe de publicar: **build 100% estático** (`base: './'`), **PWA instalável** configurada (`vite-plugin-pwa`, manifest em pt-BR, atalho do módulo de poses), **zero backend, zero contas, zero telemetria**. Publicar é servir arquivos; não há servidor para manter, escalar ou pagar. E o "zero rede em runtime" **permanece intacto**: a rede só entrega o app uma vez — depois disso o service worker serve tudo do cache, offline, como hoje.

Duas amarras técnicas que a publicação cria e que convém saber ANTES de escolher endereço:

- **HTTPS é obrigatório**, não opcional: service worker (PWA) e `getUserMedia` (a câmera da remessa por QR, item 65) só existem em contexto seguro. Fora de `localhost`, sem HTTPS o app nem instala.
- **A origem é um casamento**: a PWA instalada, o `localStorage` (autosave das duas sessões, #92) e as preferências ficam presos ao domínio. Trocar de endereço depois órfã cada instalação existente — o endereço definitivo deve ser escolhido cedo e não mudar.

### Caminhos de publicação, do mais barato ao mais envolvido

1. ✅ **Hospedagem estática gratuita** — GitHub Pages, Cloudflare Pages ou Netlify: custo zero, HTTPS de graça, deploy por push. É o mínimo viável completo: com isso o app já instala como PWA em qualquer celular/desktop. Único trabalho real: um workflow de build. **Feito em 2026-08-02** (`DECISOES.md` #103): `.github/workflows/pages.yml` publica no GitHub Pages a cada push na `main`, com a suíte, o lint e o build como portão. O `base: './'` dispensou qualquer configuração de caminho — o bundle serve em `/web-poser/`, `/webposer/` ou domínio próprio, indiferente. Falta só ligar o Pages em `Settings > Pages` com a origem em **GitHub Actions**.
2. **Domínio próprio** (~US$ 10–15/ano) apontando para a hospedagem acima: marca, URL estável (a amarra da origem, acima) e independência do provedor.
3. **itch.io** — vitrine natural para ferramenta de artista: aceita HTML5, o público é exatamente quem desenha, e o "pague o quanto quiser" já vem embutido. Serve como página de download E como canal de receita ao mesmo tempo.
4. **Lojas de aplicativo**, cada uma com seu atrito:
   - **Google Play** via TWA (Bubblewrap): o app continua sendo a PWA, embrulhada; taxa única de US$ 25.
   - **Microsoft Store** via PWABuilder: gratuito, o mesmo embrulho.
   - **App Store (iOS)**: exige wrapper de verdade (Capacitor), US$ 99/ano e revisão da Apple — o maior atrito, para deixar por último. Nota: no iOS a PWA instalada pelo Safari já funciona sem loja nenhuma.
5. **Desktop empacotado** (Tauri) só se aparecer demanda real de "quero um .exe" — a PWA instalada em janela própria já cobre o caso.

### Monetização — o que a arquitetura permite (e o que ela proíbe)

A restrição estruturante vem das regras do projeto: zero rede em runtime + sem contas + sem telemetria ⇒ **anúncios, assinatura com verificação online e analytics estão fora por construção**. Isso não é perda — é o argumento de venda: um app de artista que funciona no avião e não olha para o usuário. As opções compatíveis:

1. **Doação/apoio** — Pix, Ko-fi, GitHub Sponsors, Apoia.se: atrito zero, o app continua inteiro e gratuito; o link mora na página de apresentação (e no "sobre" do app, nunca como interrupção).
2. **Pague-o-quanto-quiser / preço fixo no itch.io ou Gumroad**: vende-se a conveniência do download organizado — quem quiser compilar do repositório, compila.
3. **Preço nas lojas**: o mesmo app, pago onde a loja já cuida do pagamento; a versão web gratuita fica sendo a demo sem limite de tempo. É o modelo "grátis na web, pago onde é cômodo".
4. **Packs de conteúdo** — a opção mais alinhada com o que o app já é: poses, animações, trechos e cenas são **arquivos JSON que o app importa hoje** (`poses.json`, `animations.json`, `clips.json`, cenas). Packs temáticos (combate, corrida, dança, poses de modelo vivo; cenários prontos) vendem-se como arquivos no itch.io/Gumroad **sem uma linha de código nova e sem DRM** — monetiza o conteúdo, não tranca a ferramenta. A folha de contato (`npm run poses:folha`) já gera o material de divulgação de cada pack.
5. **Licença educacional/institucional**: escolas e cursos de desenho pagando por uso em turma (material de apoio, packs sob medida, prioridade em pedidos). Não exige mecanismo técnico nenhum — é contrato, não código.
6. **Freemium com chave local** — só se 1–4 não bastarem: recursos "pro" (ex.: MP4, depth map) destravados por chave assinada validada offline (verificação de assinatura no bundle, sem servidor). Registrada a honestidade do modelo: código no navegador é inspecionável, a trava afasta o desonesto casual, não o determinado. Custo real de suporte e fricção; é a última opção, não a primeira.

### Pré-requisitos que valem para qualquer caminho

- **Licença do código** — ✅ **MIT, decidida em 2026-08-02** (`DECISOES.md` #104). Era a maior decisão em aberto desta seção; o usuário escolheu código aberto permissivo, que convive bem com os modelos de monetização 1–5 (doação, itch.io, packs de conteúdo, lojas, licença institucional) e é incompatível só com o 6 (freemium com trava). Todas as dependências de runtime são compatíveis: 10 MIT, `jsqr` Apache-2.0 e `mediabunny` MPL-2.0.
- **Nome e domínio**: ✅ renomeado — o app nasceu "Virtual Mockup" (genérico, difícil de marcar) e virou **WebPoser** em 2026-08-02 (`DECISOES.md` #102), antes do primeiro endereço público, exatamente pela amarra da origem. Falta só conferir a disponibilidade do domínio.
- **Ícones raster**: hoje só há `icon.svg`; lojas e o manifest pedem PNGs (192/512, maskable) e screenshots. Meio dia de trabalho.
- **Página de apresentação**: uma landing com GIFs do fluxo (posar → animar → exportar) — o material sai do próprio app (PNG/MP4 exportados, folha de contato).
- **Política de privacidade**: por arquitetura ela é uma frase ("nenhum dado sai do seu aparelho"), mas as lojas exigem a página; a LGPD está praticamente resolvida por construção.
- **Changelog visível**: o service worker atualiza sozinho (`autoUpdate`); com usuários de verdade, um "o que mudou" dentro do app evita a surpresa muda.

## MCP de análise de pose — imagem/vídeo → keyframes — etapas 1–2 ✅

*(proposta sem número — avaliação de viabilidade feita em 2026-08-02 a pedido do usuário; **etapas 1–2 concluídas em 2026-08-03**: núcleo de retargeting em `src/pose-import/` testado por ida-e-volta com a cinemática do app, e a CLI `npm run pose:from-image` com MediaPipe wasm em Chromium headless + `npm run pose:model` para o modelo. Ver `DECISOES.md` #109 e `HISTORICO.md`. **Pendentes: etapa 3 (vídeo → keyframes) e etapa 4 (casca MCP)**)*

Um servidor **MCP** (Model Context Protocol) que ferramentas de IA usam para analisar poses em imagens ou vídeos e gerar keyframes **no formato do app** (`animations.json`). Veredito da avaliação: **viável — e o MCP é a parte fácil** (~20% do trabalho); os 80% que decidem a qualidade moram no *retargeting*: converter landmarks em rotações por junta.

**A arquitetura não briga com nenhuma regra do projeto.** O MCP vive FORA do app — processo separado que escreve um `animations.json`; o arquivo entra pelo caminho de importação que já existe e que já sanitiza entrada não confiável (juntas desconhecidas fora, ângulos grampeados, keyframes inválidos ignorados). É o regime da regra "dado externo só entra por arquivo local que o usuário escolhe": zero-rede em runtime intacto, nenhuma dependência nova no bundle. Vantagem estrutural: o repositório é TypeScript, então o servidor pode **importar os módulos do próprio app** (`skeleton.ts`, limites, `serializeAnimationFile`) — uma fonte de verdade só; mudança no esqueleto quebra em compile, não em runtime.

**Pipeline:** imagem/vídeo → landmarks 3D (MediaPipe BlazePose, Apache 2.0, local, 33 pontos) → retargeting (vetores de osso → rotações relativas nas convenções do `buildJointFrames`) → clamp pelos limites → `animations.json`.

**Onde mora a dificuldade — e a saída honesta:**
- O **retargeting** é trabalho de precisão, não de pesquisa, e é 100% testável por TDD (fixture de T-pose → rotações zero; braço levantado → ângulo conhecido no ombro).
- O que os landmarks **não contam** fica **neutro** no keyframe: torção ao longo do osso, dedos/polegar (as cadeias de falange do app), o detalhe da coluna. O resultado é um **rascunho de pose** — e o app é exatamente o editor para refinar rascunho: acerta o grosso (tronco, membros, cabeça), o usuário ajusta o resto em minutos em vez de posar do zero.
- Profundidade monocular é ruidosa; o clamp da importação corta os absurdos e suavização temporal (filtro 1-euro) resolve o tremor em vídeo.
- Em vídeo, a escolha de QUAIS instantes viram keyframe é a divisão certa de trabalho do MCP: **LLM para semântica** ("os 6 momentos-chave do soco"), **modelo local para geometria** (pedir ângulos 3D direto ao LLM não funciona).

**Forma recomendada:** biblioteca + CLI primeiro (`pose:from-image`, na família de `pose:preset`/`poses:folha` em `tools/`), com o servidor MCP como **casca fina por cima** — o CLI serve sem cliente de IA no meio, e construir só o MCP deixaria o valor refém do protocolo.

**Custo estimado, por etapa (cada uma útil sozinha):**

| Etapa | O quê | Custo |
|---|---|---|
| 1 | Núcleo de retargeting (landmarks → rotações, TDD com fixtures) | 1–2 sessões — **é aqui que mora o risco** |
| 2 | Imagem → pose (MediaPipe + CLI) | ~1 sessão |
| 3 | Vídeo → keyframes (amostragem + suavização + seleção de instantes) | 1–2 sessões |
| 4 | Casca MCP (tools `pose_from_image`, `keyframes_from_video`) | ~1 sessão |

**Dúvidas — respondidas pelo usuário em 2026-08-03 (ver `DECISOES.md` #109):**

1. **Runtime do modelo:** ✅ **Node/wasm** (uma língua só; na prática, o wasm roda num Chromium headless do Playwright com rotas interceptadas — nada sai para a rede).
2. **Escopo do primeiro corte:** ✅ **só imagem → pose** (etapas 1–2); vídeo e casca MCP ficam para cortes seguintes.
3. **Onde mora:** ✅ **dentro do repositório** — núcleo em `src/pose-import/` (importa `skeleton.ts`, limites, `figurePoseFile`), CLI boba em `tools/`.
4. **Multi-pessoa:** ✅ **multi-pessoa já** (contra a recomendação): um arquivo de pose por pessoa detectada; a associação com bonecos da cena continua manual.

## Pose por marcação manual — foto + toques nas juntas → pose ✅

*(proposta sem número — avaliação, respostas e implementação em 2026-08-03: **as quatro etapas entregues**, incluindo o item 7 como etapa 1 e a profundidade opt-in por marcador da etapa 4. Ver `DECISOES.md` #111 e `HISTORICO.md`.)*

*Refinamentos do mesmo dia, da prática do usuário: zoom/deslocamento da foto (#112), sequência agrupada por membro (#113), marca da base do pescoço (#113.1), vídeo como referência (#114), profundidade também nos PARES — ombros e quadris, a torção do tronco (#115) —, o cursor de marcação, uma junta por vez (#115.1), a opção de profundidade em vigor acesa na tela (#118.1) e a marca da **base do tórax** com a **conferência da raiz pela linha dos quadris** (#119).*

*Sobre a marcação do tronco (#119): a fila tem **18 pontos**, 14 obrigatórios. A base do tórax é onde o tronco QUEBRA — sem ela, `spine` e `chest` repartem meio a meio o frame dos ombros e todo tronco sai reto. É um ponto SOBRE o eixo do tronco: diz a inclinação da coluna, nunca a torção em torno dela (essa continua vindo da linha dos ombros, #115). A raiz segue sendo o alinhamento manual do usuário (#111) e a inferência não a toca — mas "Acertar raiz pelos quadris" a confere contra a linha marcada, num botão próprio, e a inferência avisa quando as duas discordam.*

O pedido: carregar uma foto na tela, marcar manualmente os pontos das juntas principais (dedos ignorados) e a aplicação inferir a pose. Veredito: **é o complemento natural do `pose:from-image` (#109), e a parte difícil já está pronta** — o núcleo de retargeting (`src/pose-import/retarget.ts`) recebe landmarks e devolve a pose, testado por ida-e-volta. O que falta é um ADAPTADOR pequeno e a UI de marcação.

**Por que é mais barato do que parece:**
- O `retargetPose` só usa **direções normalizadas** entre os pontos — coordenadas em PIXELS da foto servem direto, sem conversão de escala nenhuma (medido no código: toda direção passa por `normalize()`).
- Ele já tolera ponto ausente por `visibility`: junta não marcada fica neutra com aviso — exatamente o contrato dos dedos ignorados.
- A saída entra pelos caminhos que já existem (aplicar no boneco selecionado, ou "Pose em arquivo").
- E cobre o buraco REAL do #109: na foto adversarial testada (pernas ocultas, contraluz), o MediaPipe inventou quadris na altura do nariz *dizendo* `visibility` 1,0. O olho humano não erra isso — a marcação manual é o plano B honesto, e roda no celular, onde a CLI (Playwright + modelo de 9 MB) nunca vai rodar.

**A limitação estrutural — e a saída honesta:** um toque na foto dá `(x, y)`; profundidade não existe. Primeiro corte: **pose no plano da vista** (`z = 0` no plano da câmera ativa) — flexões que aparecem na foto saem exatas; o que sai do plano fica achatado e o usuário refina no editor, que é o regime "rascunho de pose" já aceito no #109. Um segundo corte pode recuperar `|dz|` por comprimento de osso conhecido (o esqueleto do app dá os comprimentos; sobra o SINAL, resolvível por um toggle "frente/trás" por membro) — fica fora do primeiro corte.

**Pontos a marcar:** 2 ombros, 2 cotovelos, 2 punhos, 2 quadris, 2 joelhos, 2 tornozelos, cabeça (1 ponto), e opcionais: 2 pontas de pé, nariz (direção do olhar — só rende em vista lateral). **Tronco e raiz NÃO se marcam** — ver o fluxo abaixo. Total: 13 obrigatórios.

**Dúvidas — respondidas pelo usuário em 2026-08-03:**

1. **Onde mora a UI:** ✅ **em ambas as cascas** (desktop e módulo de poses).
2. **Raiz e profundidade:** ✅ desenho do usuário, MELHOR que o proposto — **o root não é inferido pelos ombros/quadris: é ajustado à mão, com o próprio boneco sobreposto à foto** como referência (posição E rotação), e fica TRAVADO; as demais juntas são inferidas considerando o root fixo. Isso elimina o toggle "de costas", conserta a vista 3/4 (a linha dos quadris achatada enganaria a inferência; o olho do usuário não) e transforma a limitação de profundidade em decisão consciente de quem posa.
3. **Foto e marcadores:** ✅ **só sessão, com botão de limpar** — nunca persistem; o que persiste é o RESULTADO (a pose aplicada, no undo).
4. **Destino da pose:** ✅ **aplicar no boneco selecionado**.

**Sinergia com o item 7 (verificada a pedido): a etapa inicial É o item 7.** "Ajustar o root com o boneco sobreposto à foto" exige exatamente o que o item 7 pede — foto local como fundo do viewport, com o boneco por cima. A resposta 3 ainda fecha o ❓ do item 7 (só sessão, não persiste). O plano de entrega natural é: **item 7 primeiro, como recurso avulso** (foto de referência com opacidade + limpar, nas duas cascas, no regime de estado de ferramenta — fora do undo e do arquivo), e a marcação como modo POR CIMA dele.

**Fluxo consolidado:** (1) carregar a foto de referência (item 7) → (2) alinhar o boneco à foto com as ferramentas que já existem — mover/girar o root sobre a imagem → (3) entrar no modo de marcação: sequência guiada de toques ("agora: cotovelo esquerdo"), marcadores arrastáveis, root intocado pela inferência → (4) "Inferir pose" aplica no boneco selecionado, juntas no plano da vista ativa, avisos do retarget na tela.

**Custo estimado, por etapa (cada uma útil sozinha):**

| Etapa | O quê | Custo |
|---|---|---|
| 1 | **Item 7**: foto de referência no viewport das duas cascas (arquivo local, opacidade, limpar; só sessão) | ~1 sessão |
| 2 | Adaptador `marcas 2D → pose` (root fixo dado, plano da câmera ativa, avisos) — puro, TDD com as fixtures projetadas do próprio retarget | 0,5–1 sessão |
| 3 | Modo de marcação nas duas cascas (sequência guiada, arrastar, inferir/aplicar) | 1–2 sessões |
| 4 | (depois, se doer) profundidade por comprimento de osso + toggle frente/trás | ~1 sessão |

Nenhuma regra ameaçada: a foto entra por arquivo local (regime explícito do zero-rede), nunca persiste, e os marcadores são estado de trabalho, fora do undo e fora do arquivo.

## Objetos pré-modelados e amarração a juntas — amarração + kit de armas ✅

*(proposta sem número — avaliação de viabilidade feita em 2026-08-02 a pedido do usuário; **concluído em 2026-08-03**: a metade 1 inteira (amarração como derivação do frame da junta, gizmo escrevendo offset, persistência aditiva) e o primeiro kit da metade 2 (espada, escudo e bainha — compostas sem vértice livre). Ver `DECISOES.md` #108 e `HISTORICO.md`. **Pendentes: moto e animais rígidos, conforme demanda**; animais articulados seguem fora, como proposta própria)*

O pedido tem duas metades independentes, com custos e riscos muito diferentes:

1. **Amarrar um objeto a uma junta** — espada seguindo a mão direita, escudo na esquerda, bainha na perna;
2. **Objetos pré-modelados** — armas, motos, animais (cachorro, touro, dinossauro) prontos para usar.

### Metade 1 — amarração: viável, e o caminho certo NÃO revoga o "cenário estático"

A tensão de frente: a decisão de topo nº 2 dos objetos de cena (item 42, `sceneProp.ts`) diz **"o objeto NÃO entra no retrato dos keyframes — cenário não anda"**, e foi ela que manteve animação, biblioteca de trechos e remapeamento intactos. Uma espada que acompanha a mão parece exigir revogá-la — mas não exige:

- **Amarração é DERIVAÇÃO, não conteúdo de keyframe.** O objeto ganha um campo `{figureId, jointName, offset}`; a colocação em mundo passa a ser *calculada* a cada quadro a partir do frame da junta (que `buildJointFrames` já fornece, e o `Figure.tsx` já expõe como grupos nomeados `joint-*`). O keyframe continua registrando SÓ bonecos + câmera — e a espada acompanha a animação, a reprodução e o MP4 **de graça**, porque quem anda é a mão, não ela. A decisão nº 2 sai intacta: o que o arquivo guarda do objeto continua estático; o movimento é emprestado.
- Persistência **aditiva** em `SceneExtras` (campo novo, sem subir versão — regra do projeto); sanitização poda amarração para boneco/junta que não existe; remover o boneco devolve o objeto à própria colocação (recomendação — ver dúvidas).
- Espelho, sorteio e travas não precisam de caso especial: a amarração referencia a junta, e a junta é quem se move. Trocar a espada de mão é gesto do usuário, não efeito colateral.
- Fora do escopo recomendado: empunhadura com DUAS mãos (restrição de cadeia dupla — problema de IK novo, custo desproporcional).

**Custo da amarração: 1–2 sessões** (campo + render derivado + UI no painel do objeto + persistência + testes), e ela já vale com as 6 formas atuais — uma "espada" de paralelepípedo amarrada à mão já testa o mecanismo inteiro.

### Metade 2 — pré-modelados: viável DENTRO da regra, com custo por modelo

A regra "sem assets externos para geometria" (nada de `.glb`/`.fbx`) **não bloqueia** a proposta — o boneco inteiro é a prova: pré-modelado aqui significa **composições de primitivas geradas em código** (`buildSword()`, `buildShield()`…), no mesmo mecanismo de `propGeometry`. Formas novas são **aditivas** ao contrato de arquivo (arquivo antigo continua abrindo; a contagem de pontos de controle por forma continua travada por teste). E o arquivo continua barato: grava `forma + tamanho`, nunca malha — o catálogo não pesa no `localStorage`.

O custo é o de MODELAR, um a um, como foi com o manequim:

| Classe | Exemplos | Custo estimado |
|---|---|---|
| Armas e acessórios | espada, escudo, bainha, lança | ~1 sessão o kit — poucas primitivas cada |
| Veículos | moto | 1–2 sessões por objeto — composição grande |
| Animais RÍGIDOS (estátua estilizada) | cachorro, touro, dinossauro | ~1 sessão por espécie simples; mais para dino |
| Animais ARTICULADOS (posáveis) | — | **fora deste parecer** — ver abaixo |

**A ressalva grande: animal posável é outro projeto.** O app inteiro assume UM esqueleto (32 juntas humanas): `JOINT_NAMES` global, poses, presets, espelho, IK, limites, biblioteca — tudo. Um cachorro que corre exige um segundo rig (quadrúpede), e multi-esqueleto atravessa cada um desses sistemas. Se um dia valer, é proposta separada com custo de várias fases — o parecer recomenda **animais rígidos primeiro** (decoração de cena, que o depth map e o PNG/MP4 já servem), e a decisão de articular fica adiada sem dívida.

### Ordem recomendada

Amarração primeiro (metade 1, mecanismo que valoriza tudo que vier depois) → kit de armas (o caso de uso que motivou o pedido, e o mais barato) → moto/animais rígidos conforme demanda.

**Dúvidas — respondidas pelo usuário em 2026-08-03 (ver `DECISOES.md` #108):**

1. **Amarração no arquivo da cena:** ✅ sim, campo aditivo (`PropExtras.attachment`); ao remover o boneco, o objeto **volta à própria colocação** (soltar manualmente é o oposto: grava a colocação de mundo, o objeto fica onde está).
2. **Offset da amarração:** ✅ **o gizmo normal edita o offset** (o arrasto vira offset relativo à junta); os campos numéricos do painel editam o mesmo offset, com a legenda dizendo isso.
3. **Formas compostas:** ✅ **tamanho por eixo em metros, SEM vértice livre** (esticar a lâmina é feature; o modelo fica íntegro — `propShapeHasFreeVertex`).
4. **Primeiro kit:** ✅ armas (espada, escudo, bainha); `MAX_PROPS = 20` continua valendo.
5. **Animais:** ✅ rígidos-primeiro conforme demanda, articulados adiados para proposta própria.

## Vídeo como referência — frame a frame sobre o papel vegetal ✅

*(proposta sem número — avaliação feita em 2026-08-03 a pedido do usuário; **concluído em 2026-08-03**, com as quatro dúvidas nas recomendações: fps auto-detectado com seletor de apoio, scrubber + play/pause, marcas mantidas ao trocar de frame, um carregador só. Ver `DECISOES.md` #114 e `HISTORICO.md`)*

O pedido: usar um VÍDEO como referência, com os mesmos recursos da foto (transparência, posicionamento, zoom) e controles para avançar/retroceder frame a frame — mantendo a funcionalidade de foto existente.

**Veredito: viável e barato — a infraestrutura da foto (#111/#112) serve quase inteira.** O `<video>` é um irmão do `<img>`: entra por object URL de arquivo local (zero-rede intacto — quem decodifica é o navegador, nenhum byte sai), é posicionado pelo MESMO retângulo transformado do `referencePhotoView` (opacidade, zoom e deslocamento valem sem mudar uma linha da matemática), continua DOM por cima do viewport (nunca sai no PNG/MP4) e é só sessão, como a foto. A marcação e a inferência operam sobre o frame PARADO exatamente como sobre uma foto — o solver nem fica sabendo a origem dos pontos.

**A única parte genuinamente nova: andar de frame.** A API de mídia do navegador não expõe "frame" — só `currentTime` em segundos; avançar/retroceder um frame é `currentTime ± 1/fps`, e o **fps não é exposto**. Saídas, da mais simples à mais fina:
1. **Seletor de fps** (24/25/30/60, padrão 30) — sempre funciona, honesto;
2. **Auto-detecção por `requestVideoFrameCallback`** (Chrome/Edge/Safari e Firefox recente): mede o intervalo real entre frames apresentados; cai no seletor onde a API não existir.

Detalhes que importam: setar `currentTime` decodifica o frame exato (não usar `fastSeek`, que salta para o keyframe do codec); os formatos aceitos são os do navegador (h264/mp4, vp8/9/webm, av1 — o MP4 exportado pelo próprio app abre); vídeo grande não pesa na memória como imagem — o navegador faz stream do disco.

**Desenho proposto (mantendo a foto intacta):**
- `referenceImageStore` ganha `kind: 'image' | 'video'` (+ fps); url, aspect, opacidade, vista e marcas são os MESMOS campos — vídeo novo zera marcas como foto nova zera.
- O overlay renderiza `<video>` quando for vídeo, com o mesmo rect/estilo, e registra o elemento num ref de módulo (precedente: `activeViewportCamera`) para os controles comandarem o seek sem acoplamento de árvore.
- Os controles moram no mesmo `ReferencePhotoControls`: o carregador aceita `image/*,video/*`, e o bloco de vídeo (frame ◀ ▶, linha do tempo) só aparece quando for vídeo.
- **Marcas mantidas ao trocar de frame — é a feature, não descuido:** o fluxo de animação vira marcar → inferir → gravar keyframe → avançar N frames → ARRASTAR as marcas (os deltas são pequenos) → inferir de novo. É a versão manual (e de celular) da etapa 3 do MCP de pose (#109, vídeo→keyframes automático), sem o modelo de 9 MB.

**Custo estimado: ~1 sessão** (store + overlay + controles + i18n + testes; solver intocado). O que o jsdom não alcança — decodificação e seek de verdade — fica para a conferência no navegador, regime já aceito (#31.5); o resto (próximo tempo de frame com grampo 0–duração, detecção de tipo, estado, UI condicional) é puro e testável.

**Dúvidas — fechadas em 2026-08-03, todas nas recomendações:**

1. **Passo do frame:** ✅ auto-detecção por `requestVideoFrameCallback` com seletor de fps como fallback/override.
2. **Linha do tempo:** ✅ scrubber arrastável E play/pause incluídos.
3. **Marcas ao andar de frame:** ✅ mantidas — é o fluxo de keyframes acima.
4. **Carregador:** ✅ um botão só ("Carregar foto/vídeo…"), o MIME decide.

## Estouro de memória no navegador — levantamento ❓

*(avaliação em 2026-08-03, a pedido do usuário, que relatou Out of Memory usando o app. **Não reproduzido aqui** — o que segue é auditoria de código: onde a memória cresce sem teto e onde ela é duplicada. A primeira recomendação é justamente MEDIR, para não consertar o item errado.)*

**O que auditei e está são** (para não se procurar ali):

- **Papel-cebola** é leitura por REFERÊNCIA (`OnionSkinFrame.keyframe`), não cópia dos bonecos.
- **Undo** tem `limit: 100` e todas as escritas do store são imutáveis, então as entradas COMPARTILHAM estrutura: só o que mudou de fato ocupa espaço novo.
- **Exportação MP4** tem contrapressão por quadro (`backpressure`), câmera descartável e material de profundidade criado UMA vez para o laço inteiro (nada de shader por quadro).
- **Object URLs** da referência são revogados ao trocar e ao limpar.
- **Malhas do boneco** nascem em `useMemo` com dependências estáveis (constantes do `skeleton.ts`): mudar de pose gira grupos, não recria geometria. `SceneProps` descarta a geometria do objeto ao trocá-la.
- **Resoluções de saída são limitadas**: vídeo até 1080p, instantâneo até 3840 px por lado (`MAX_SNAPSHOT_DIMENSION`).

**Onde NÃO há teto, por ordem de risco:**

1. **A referência (foto/vídeo) é o único dado do app sem limite de tamanho** — e é recente. Uma foto de celular de 48 Mpx decodifica para ~190 MB de bitmap (o arquivo tem 5 MB; o bitmap não). Um vídeo 4K mantém vários quadros decodificados. Some-se o zoom (#112): o elemento é posicionado com largura/altura de até **8× o contêiner**, e uma camada de vídeo escalada assim é cara de compor. Agrava: **"Mostrar foto" desligado só zera a opacidade** — o `<video>` continua montado e decodificando.
   - *Melhorias:* reamostrar a FOTO ao carregar (`createImageBitmap` + canvas, teto de ~4096 px no maior lado) e guardar o bitmap reduzido — a marcação é normalizada, então nada mais muda; pausar o vídeo e/ou soltar o elemento quando a camada está invisível; avisar quando o arquivo escolhido é muito grande. **Custo: ~meia sessão** (a foto é o grosso; o resto é pequeno).
2. **O MP4 inteiro vive em RAM, duas vezes.** `BufferTarget` guarda o arquivo (a 1080p30, ~1 MB por segundo de vídeo) e `new Blob([buffer])` copia — dois minutos de vídeo são ~120 MB × 2, mais a URL de download, que fica viva até a página recarregar. O próprio `videoExport.ts` já registra a saída: `StreamTarget` gravando direto num `FileSystemWritableFileStream` (o app já usa File System Access no workspace).
   - *Melhorias:* gravar direto em arquivo onde a API existir; revogar a URL da exportação anterior; soltar o buffer assim que o Blob existir. **Custo: ~meia sessão.**
3. **Duas cascas, dois contextos WebGL.** Trocar desktop ↔ módulo de poses monta outro `<Canvas>`; navegadores limitam contextos (~8–16) e derrubam o mais antigo — "context lost" se parece com falta de memória. *Melhoria:* conferir a liberação no desmonte e, se preciso, `dispose()`/`forceContextLoss()` explícito. **Custo: pequeno, mas exige conferência no navegador.**
4. **Miniaturas de keyframe como data URL** (`toDataURL('image/jpeg', 0.6)`, 160×90 ≈ 4 KB de base64 cada) vivem DENTRO do objeto da animação — logo, dentro do undo e do autosave, que tem cota de 5 MB no `localStorage`. Numa animação longa isso aperta o autosave antes da memória. *Melhoria:* tirar a miniatura do que entra no undo/arquivo, ou baixar para 96×54.
5. **O QR de sessão gera TODOS os quadros SVG de uma vez**, proporcional ao tamanho do workspace. *Melhoria:* gerar sob demanda, só o quadro exibido.
6. **Alocação por quadro na reprodução**: cada instante amostrado cria bonecos novos (`blendFigure`). É lixo de vida curta, não vazamento — só vira problema como pressão de GC (engasgo), e a saída seria reciclar objetos. Último da fila.

**Antes de qualquer conserto: um diagnóstico.** Hoje não há como ver a memória crescer. Um bloco de diagnóstico (ligável, no painel de Cenas ou na ajuda) com `renderer.info.memory.geometries/textures`, `renderer.info.programs.length`, contagem de bonecos/objetos/keyframes e, onde existir, `performance.memory.usedJSHeapSize` transforma "estourou" em número — e diz em segundos qual dos seis itens acima é o caso. **Custo: pequeno**, e é o que evita gastar uma sessão no item errado.

**Dúvidas ❓**
1. O estouro acontece em qual momento — sessão longa de edição, carregar foto/vídeo de referência, exportar MP4, ou trocar de casca?
2. Em que aparelho (desktop, tablet, celular) e com quanta memória?
3. Quer o diagnóstico primeiro (medir e então consertar), ou já os itens 1 e 2 direto?
