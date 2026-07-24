# Virtual Mockup — Plano do Projeto

Aplicativo frontend 3D, totalmente offline, para posar bonecos articulados (manequins de desenhista) e exportar imagens estáticas como keyframes de referência. **Fora de escopo:** geração de animações.

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

### Hierarquia de articulações (fisionomia humana, 27 juntas)

Diretriz: **o máximo de articulações do corpo humano**, com duas exceções acordadas — sem dedos nos pés e sem dedos individualizados nas mãos (o polegar é articulado à parte; os outros 4 dedos abrem/fecham juntos, em bloco).

```
root (pelve) — posição XYZ + rotação (colocação na cena)
├─ spine (lombar) ── chest (torácica) ── neck ── head
├─ clavicle.L/R (2 DOF — encolher/projetar o ombro)
│   └─ shoulder.L/R (3 DOF) ── elbow.L/R (2 DOF: flexão + pronação/supinação do antebraço)
│       └─ wrist.L/R (2 DOF)
│           ├─ thumb1.L/R (2 DOF, base do polegar) ── thumb2.L/R (1 DOF, dobra)
│           └─ fingers.L/R (1 DOF — os 4 dedos curvam juntos, de abertos a punho)
└─ hip.L/R (3 DOF) ── knee.L/R (1 DOF, dobradiça) ── ankle.L/R (2 DOF)
    └─ ball.L/R (1 DOF — flexão da planta/ponta do pé, permite pose "na ponta dos pés"; não são dedos)
```

Total: 27 juntas (1 root + 4 de tronco/cabeça + 14 de braços/mãos + 8 de pernas/pés). A pronação/supinação no cotovelo garante que a palma da mão pode virar para cima/baixo; clavículas permitem encolher os ombros. Cada junta é um `Group` (pivô) com a geometria do segmento como filha — girar o ombro carrega braço, antebraço e mão, como num boneco real.

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
- **Bookmarks de câmera:** salvar posições nomeadas da câmera dentro da cena — essencial para gerar keyframes consistentes do mesmo ângulo. Além de viajarem dentro do arquivo da cena completa, o **conjunto de bookmarks pode ser salvo/importado/exportado separadamente** (ver "Persistência"), para reutilizar os mesmos ângulos em cenas diferentes.

## Interação de pose

1. **Selecionar boneco** (clique no corpo) → gizmo de translação livre nos 3 eixos no root para posicioná-lo na cena, inclusive fora do chão (ex.: salto, voo) — a sombra permanece no chão como referência de altura.
2. **Selecionar articulação** (clique na esfera da junta) → gizmo de rotação restrito aos eixos/limites daquela junta + sliders numéricos no painel lateral.
3. **Modo IK (fase 7):** alvos arrastáveis nas mãos e pés; CCD resolve ombro+cotovelo / quadril+joelho respeitando os limites; alternância FK/IK por membro.
4. **Poses predefinidas** (em pé, sentado, andando, correndo) como ponto de partida — barato de implementar e muito útil.
5. **Undo/redo** (Ctrl+Z / Ctrl+Shift+Z ou Ctrl+Y) sobre alterações de pose, posição, bonecos e configuração da cena — disponível **desde a fase 3**, junto com a primeira edição de pose. A navegação de câmera (órbita/pan/zoom) fica **fora** do histórico de undo, seguindo o padrão dos editores 3D; bookmarks de câmera (criar/remover) entram no histórico normalmente.

## Persistência (formato da cena)

**Requisito:** o arquivo de cena gravado/reaberto deve ser compatível com padrões da indústria, especialmente o **Blender**.

O formato de arquivo adotado é **glTF 2.0 binário (`.glb`)** — padrão aberto da Khronos, importado e exportado nativamente pelo Blender (e por Maya, Godot, Unity, etc.) e com suporte de primeira classe no three.js (`GLTFExporter`/`GLTFLoader`). Um único arquivo serve aos dois propósitos:

- **No Blender:** ao abrir o `.glb`, os bonecos aparecem como hierarquias de objetos posados (a hierarquia de `Group`s das juntas vira a hierarquia de objetos), com cores como materiais e a câmera da cena incluída como câmera glTF — utilizável diretamente como referência de layout/keyframe.
- **No app:** os dados específicos da aplicação viajam no campo padrão **`extras`** do glTF (namespace próprio, ex.: `extras["virtual-mockup"]`), permitindo reabrir o arquivo com fidelidade total:

```jsonc
// extras["virtual-mockup"] no nó raiz da cena
{
  "version": 1,
  "name": "Pose final",   // nome da cena/snapshot (ver "Workspace: catálogo de cenas" abaixo)
  "environment": { "background": "#808080", "grid": true },
  "keyframeCounter": 12,   // próximo número da sequência kf### — viaja com a cena
  "cameraBookmarks": [{ "name": "plano geral", "position": [...], "target": [...], "fov": 50 }],
  "figures": [{ "id": "f1", "name": "Boneco 1", "color": "#e04040", "visible": true,
                "height": 1.70,
                "joints": { "shoulder.L": [x,y,z], "elbow.L": [x,0,0] } }]
}
```

Regras de leitura/gravação:

- **Reabertura no app:** o app reconstrói os bonecos a partir do seu próprio `skeleton.ts` e aplica as rotações registradas em `extras` — não depende da geometria contida no arquivo. Isso torna a reabertura robusta mesmo se o `.glb` passou pelo Blender e voltou (o Blender preserva `extras` como *custom properties* quando a opção de importação/exportação de custom properties está ativa).
- **Fallback sem `extras`:** se um `.glb` não tiver o bloco do app (ex.: editado/reexportado sem custom properties), o app oferece importação "melhor esforço" lendo as transformações dos nós cujo nome casa com a convenção de nomenclatura das juntas (`f1.shoulder.L` etc.) — por isso a nomenclatura dos nós é parte do contrato do formato.
- **Autosave** contínuo em `localStorage` usa o estado interno serializado (JSON leve, mesmo schema do `extras`) por desempenho; o `.glb` é o formato de gravação em arquivo (download/upload — nada sai do navegador).
- Campo `version` + validação com defaults ao carregar, para evoluir o formato sem quebrar cenas antigas.
- **Escala/unidades (parte do contrato):** glTF usa **metros**; o boneco é modelado em escala humana real (padrão 1,70 m, altura ajustável por boneco). Assim a cena abre no Blender no tamanho correto, sem fator de conversão.
- **Limitações documentadas:** limites articulares e presets de pose não são serializados (são definição do app, não da cena); animações glTF não são geradas (fora de escopo).

### Exportação/importação de um boneco individual

Além de gravar/reabrir a cena inteira, cada boneco pode ser salvo, importado e exportado **separadamente**, para reutilizar uma pose em outra cena ou compartilhar um boneco específico.

- **Formato:** o mesmo **glTF 2.0 binário (`.glb`)** da cena completa, reaproveitando 100% do exportador/importador da fase 6 — só que escopado a um único boneco (`extras["virtual-mockup"].figures` com um item, sem `environment`/`cameraBookmarks`/`keyframeCounter` de cena). Não introduz um segundo formato de arquivo.
  - **Formato alternativo considerado e descartado como formato principal:** BVH (Biovision Hierarchy) é o padrão da indústria especificamente para dados de esqueleto/pose (motion capture) e também é nativo no Blender, mas é orientado a animação (canais de rotação por frame) e não carrega metadados como cor/altura/nome — exigiria um parser/exportador próprio adicional só para ganhar compatibilidade com ferramentas de motion capture, fora do escopo atual. Decisão: reaproveitar o `.glb`; revisitar BVH só se surgir uma necessidade real de interoperabilidade com pipelines de motion capture.
- **Exportar:** com um boneco selecionado, "Exportar boneco" gera um `.glb` contendo nome, cor, altura e pose (rotações de todas as juntas) desse boneco.
- **Importar:** ao escolher um arquivo de boneco, (a) se houver um boneco selecionado, a pose e a altura importadas são aplicadas a ele (mantendo identidade, cor e posição atuais); (b) sem seleção — ou via uma opção explícita "importar como novo" — cria um boneco novo com os dados do arquivo (sujeito ao limite de 5 bonecos e a uma cor livre da paleta). Em ambos os casos, os ângulos importados passam pela mesma validação/grampeamento de `skeleton.ts` usada em qualquer outro carregamento.

### Exportação/importação de bookmarks de câmera

- **Formato:** também `.glb`, reaproveitando o mesmo pipeline — um arquivo com nós de câmera glTF nomeados e `extras["virtual-mockup"].cameraBookmarks`, sem bonecos nem dados de ambiente. BVH não se aplica aqui (é um formato de esqueleto, não de câmera), então esse arquivo usa `.glb` independentemente da decisão de formato de boneco.
- **Exportar:** salva todos os bookmarks da cena atual num único arquivo.
- **Importar:** os bookmarks do arquivo são **adicionados** aos da cena atual (não substituem a lista existente); em caso de nome duplicado, o importado recebe um sufixo automático — assim importar um conjunto de ângulos favoritos nunca apaga bookmarks já criados na cena.

### Workspace: catálogo de cenas (esclarecimento pedido pelo usuário, fase 6)

**Cena** = o conjunto de metadados de todos os bonecos posicionados/posados numa composição (bonecos, poses, ambiente, bookmarks de câmera daquela composição, contador de keyframe) — exatamente o que hoje já vive no estado principal do app e é exportável como um `.glb` (ver `extras["virtual-mockup"]` acima). Bookmarks de câmera continuam podendo ser trocados livremente **sem** alterar a pose (já implementado na fase 4) — várias posições de câmera para a mesma cena.

**Workspace** = uma coleção de **snapshots** de cena nomeados, guardada localmente (`localStorage`, com autosave contínuo e restauração automática ao abrir o app — sem diálogo de confirmação), que o usuário pode criar, renomear, remover e recarregar (recarregar um snapshot substitui a cena de trabalho atual, num único passo de undo). Criar/renomear/remover um snapshot entra no histórico de undo, como um bookmark de câmera; qual snapshot está "carregado no momento" não entra (é navegação, não conteúdo) — mesma lógica já aplicada a `cameraBookmarks`/seleção (ver `DECISOES.md` #8 e #11).

**Persistência do workspace em arquivo:** continua **1 cena = 1 `.glb`** (não um `.glb` único com múltiplas `scenes` internas do glTF — o importador do Blender lida de forma inconsistente com isso entre versões, arriscando a compatibilidade já validada). Um "workspace" salvo em disco é uma **pasta** escolhida via File System Access API (mesmo padrão já usado para a pasta de keyframes na fase 5) contendo um arquivo de manifesto `workspace.json` (nome + `activeSceneId` + lista de `{id, name, filename}` apontando para os `.glb`s da pasta) mais os próprios `.glb`s de cada cena, salvos/carregados **independentemente** do manifesto. Sem a File System Access API (Firefox/Safari), cai para seleção manual de múltiplos arquivos (`workspace.json` + os `.glb`s referenciados de uma vez). Pesquisa completa, alternativas descartadas (zip único; manifesto avulso por download/upload sem pasta) e justificativa em `DECISOES.md` #11.

## Exportação de imagem (keyframes)

- Botão "Capturar keyframe": renderiza um frame sob demanda no canvas (sem `preserveDrawingBuffer` permanente) e gera o PNG via `canvas.toBlob`.
- **Diretório de destino via File System Access API** (`showDirectoryPicker`, Chrome/Edge): o usuário escolhe a pasta de keyframes uma vez e as capturas seguintes gravam direto nela, sem prompts — essencial para o fluxo de capturar muitas imagens em sequência. A permissão da pasta é rememorada na sessão. **Fallback** (navegadores sem a API, ex.: Firefox): download convencional.
- Resolução configurável independente da janela (ex.: 1920×1080, 1080×1080) renderizando em um target dimensionado.
- Opção de ocultar grade/gizmos na captura.
- Nomenclatura sequencial automática: `nome-da-cena_kf001.png`, `kf002`… — o contador é persistido na cena (campo `keyframeCounter` do schema), então reabrir a cena continua a sequência em vez de sobrescrever arquivos.

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
| 9 | Refinamentos de UX e workspace | Botão de ajuda na Toolbar, indicador de "salvo", desfazer/refazer na Toolbar, aviso de erro ao importar `.glb` inválido, indicador de membros com IK ativo, resetar pose por junta, **botão "novo workspace" (limpar e resetar todo o ambiente)** |

Fases 1–6 formam o MVP completo dos requisitos 1–7; IK (fase 7) é o incremento de usabilidade acordado. Os atalhos de teclado (ver observação abaixo) são implementados incrementalmente junto com cada funcionalidade — ex.: setas, Tab e Ctrl+Z na fase 3, Espaço na fase 5, Ctrl+S na fase 6 — e não deixados para o final.

## Observação: uso do teclado

O teclado deve ser cidadão de primeira classe na aplicação, não um extra de polimento — toda ação frequente precisa ter atalho para agilizar o fluxo de posar/capturar. Mapa inicial proposto (revisável durante a implementação):

- **Setas:** rotação da junta selecionada no eixo ativo — passo normal; **Shift+setas** = passo maior; **Ctrl+setas** = passo fino. Com o root selecionado, setas movem o boneco no plano do chão.
- **Tab / Shift+Tab:** ciclar entre articulações do boneco atual; **1–5:** selecionar boneco pelo número.
- **Espaço:** capturar keyframe (ação mais frequente do fluxo; interceptado com `preventDefault` para não rolar a página/acionar botão focado).
- **Q/W/E/R:** alternar modos de ferramenta (selecionar / mover / girar / IK), no padrão de softwares 3D.
- **Ctrl+Z / Ctrl+Shift+Z (ou Ctrl+Y):** desfazer/refazer; **Ctrl+S:** salvar cena; **Ctrl+D:** duplicar boneco selecionado.
- **F:** enquadrar câmera no boneco selecionado; **teclado numérico (1/3/7, convenção Blender):** presets ortográficos; **Shift+1..5:** bookmarks de câmera.
- **Esc:** limpar seleção; **Delete:** remover boneco selecionado — sem diálogo de confirmação, Ctrl+Z desfaz; **H:** mostrar/ocultar boneco.
- **?**: painel de ajuda com a lista completa de atalhos.

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

## Progresso

### Fase 1 — Fundação ✅ (concluída em 2026-07-22)

**Entregue:**
- Projeto Vite + React 19 + TypeScript escalonado na raiz do repositório (`package.json`, `tsconfig*.json`, `vite.config.ts`), com `base: './'` já configurado para preparar a futura execução offline/PWA (fase 6).
- Vitest + React Testing Library + `@react-three/test-renderer` configurados e funcionando (`npm test` / `npx vitest run`); ambiente `jsdom`, `IS_REACT_ACT_ENVIRONMENT` ajustado.
- i18n com `react-i18next`: dicionários `pt-BR` (padrão) e `en` embutidos no bundle, com teste automatizado de paridade de chaves entre os dois idiomas (`src/i18n/__tests__/locales.test.ts`).
- `sceneStore` (zustand): configurações de ambiente (`background`: light/medium/dark, `grid`: boolean) — primeira fatia do estado global da cena, a ser estendida nas próximas fases com bonecos, câmera etc.
- Ambiente neutro 3D funcionando: `SceneContent` (chão 20×20, grade, luz hemisférica + luz direcional com sombra) testado via `@react-three/test-renderer`; `Viewport` compõe `<Canvas>` + `OrbitControls` + fundo configurável.
- Layout da UI: `Toolbar` (título, seletor de idioma, seletor de fundo, checkbox de grade) + `FiguresPanel`/`PropertiesPanel` (placeholders vazios, conteúdo real chega nas fases 2–3) + `AppShell` compondo tudo em landmarks semânticos (`header`, `aside` × 2, `main`).
- 15 testes automatizados em 7 arquivos, todos verdes; `tsc -b` e `eslint .` limpos; `npm run build` gera bundle funcional com caminhos relativos.
- **Validação manual no navegador** (via automação Chrome): layout renderiza corretamente, ambiente 3D aparece (chão, grade, sombra, fundo), troca de fundo/grade/idioma funciona em tempo real, sem erros no console.

**Não entregue nesta fase (fora do escopo da fundação):** bonecos, câmera configurável além do padrão, captura de keyframes, persistência — conforme planejado, chegam nas fases 2–6.

**Decisões técnicas e observações registradas em `DECISOES.md`:** aviso de `act()` no `react-i18next` (cosmético, investigado e documentado), aviso de depreciação do `THREE.Clock` (interno ao `@react-three/fiber`, fora do nosso controle), e a limitação de automação de navegador para testar arraste de `OrbitControls` (pendente de **validação manual pelo usuário**: confirmar que arrastar o botão esquerdo do mouse no viewport gira a câmera, botão direito faz pan e o scroll dá zoom).

**Aviso não bloqueante para fases futuras:** o bundle de produção já emite aviso de chunk >500KB (`three` é uma biblioteca grande); não é um problema da fase 1, mas vale revisitar `code-splitting`/`build.chunkSizeWarningLimit` caso o tamanho do bundle vire preocupação real mais adiante (não é requisito do plano atual).

### Fase 2 — Boneco ✅ (concluída em 2026-07-22)

**Entregue:**
- `src/figure/skeleton.ts`: fonte única do esqueleto — as 27 juntas da hierarquia (1 root + 4 tronco/cabeça + 14 braços/mãos + 8 pernas/pés), com offset local em metros (calculado por proporções clássicas de figura de desenho, 8 "cabeças" de altura, para a altura de referência de 1,70 m) e limites de rotação por eixo (graus) para cada junta não-livre. Eixo sem limite definido para uma junta = travado em 0 (não é grau de liberdade daquela junta); `root` é a exceção — fica livre (posição + rotação de colocação na cena), conforme o desenho da fase 1 do plano. `clampJointRotation` centraliza o grampeamento, reutilizável por FK, IK (fase 7) e validação de cena (fase 6). `getHeightScale` implementa a escala proporcional por altura ajustável (1,50–1,90 m, padrão 1,70 m).
- `src/figure/Figure.tsx`: componente R3F que percorre a hierarquia do `skeleton.ts` recursivamente, renderizando uma esfera por junta (raio variável por junta — maior no quadril/ombro/cabeça, menor no polegar/dedos) e uma cápsula por segmento ósseo (ligando cada junta ao offset local de cada filha, orientação calculada via quaternion), todas na cor do boneco. Escala do grupo raiz = `getHeightScale(altura)`; visibilidade e pose (graus→radianos) vêm do estado do boneco.
- `src/store/figuresStore.ts` (zustand): gestão de até 5 bonecos — `addFigure` (paleta fixa de 5 cores de alto contraste, atribuição automática da primeira cor livre, recusa ao exceder o limite), `removeFigure` (libera a cor), `duplicateFigure` (copia pose/altura, nova cor livre, recusa no limite), `renameFigure`, `toggleVisibility`, `selectFigure`, `setHeight` (grampeada a 1,50–1,90 m), `setColor` (só aceita cor da paleta e ainda não usada por outro boneco — implementa o requisito "atribuídas automaticamente e **trocáveis**"), `setPosition`/`setRootRotation` (colocação livre do root) e `setJointRotation` (grampeada via `skeleton.ts`). Novos bonecos (e duplicatas) nascem espaçados em X para não ficarem sobrepostos, já que o gizmo de posicionamento do root só chega na fase 3.
- `FiguresPanel` (UI): lista os bonecos com amostra de cor clicável (troca para a próxima cor livre da paleta), campo de nome editável, controle de altura (confirma ao perder o foco, não a cada tecla — ver decisão técnica), checkbox de mostrar/ocultar, botão remover, botão adicionar (desabilitado no limite de 5) e seleção por clique na linha. `Viewport` passou a renderizar todos os bonecos do `figuresStore` dentro do `<Canvas>`.
- 33 novos testes automatizados (skeleton: 20, figuresStore: 19 no total após a fase incluindo os da fase 1, Figure: 7, FiguresPanel: 9) — suíte completa em 67 testes, todos verdes; `tsc -b` e `eslint .` limpos; `npm run build` continua gerando bundle funcional.
- **Validação manual no navegador** (via automação Chrome): até 3 bonecos simultâneos renderizando corretamente como manequins reconhecíveis (cabeça, tronco, braços, pernas), cores distintas e trocáveis, altura ajustável visivelmente escalando o boneco, mostrar/ocultar e remover funcionando, bonecos espaçados sem sobreposição, sem erros no console.

**Não entregue nesta fase (fica para fases seguintes, conforme o plano):** seleção/gizmo de junta, sliders de pose, posicionamento do root por arrasto e duplicar boneco **na UI** (fase 3 — a lógica de `duplicateFigure` já existe e está testada no store, só falta o botão); câmera configurável, captura de keyframes, persistência.

**Decisão de escopo (não é uma inconsistência do plano, só uma clarificação):** a tabela de fases já separa "duplicar boneco" para a fase 3 (junto da edição de pose), enquanto a seção "Múltiplos bonecos" descreve o painel de lista completo (view incluindo duplicar). Segui a tabela de fases como autoridade — implementei a ação de duplicar no store agora (é regra de negócio pura, testável desde já) mas deixei o botão de UI para a fase 3, quando fizer sentido junto da cópia de pose.

**Decisões técnicas registradas em `DECISOES.md`:** erro "Cannot assign to read only property" causado por múltiplas cópias do pacote `three` carregadas simultaneamente (uma pelo build CJS do `@react-three/test-renderer`, outra pelo ESM do Vite) — resolvido evitando passar instâncias de `THREE.Vector3`/`Quaternion` como props JSX, sempre usando arrays simples (convenção a manter nas próximas fases).

### Adendo à Fase 2 — refinamento visual do boneco ✅ (concluído em 2026-07-22, revisado em 2026-07-22)

A pedido do usuário (com imagem de referência de um manequim de madeira de desenhista), o visual do boneco foi refinado **antes** de iniciar a fase 3, para já posar sobre a forma final. Passou por duas rodadas:

**Rodada 1 (elipsoides):** o marcador esférico único por junta virou uma esfera com escala não-uniforme — pelve, tórax e cabeça como elipsoides maiores — e os ossos de membro viraram cilindros afunilados (raio maior perto do corpo, menor perto da junta seguinte).

**Rodada 2 (perfis torneados, após avaliar a `mannequin.js` como referência — ver `DECISOES.md` #5):** o usuário pediu para revisar o formato apontando a biblioteca [mannequin.js](https://boytchev.github.io/mannequin.js/docs/userguide.html), que usa superfícies paramétricas para um visual mais orgânico. Pesquisa mostrou que a lib é GPL-3.0 e modela 5 dedos por mão (fora do nosso escopo simplificado) — o usuário optou por **não adotar a dependência** e, em vez disso, aplicar a mesma técnica (perfil revolucionado) na nossa própria geometria:
- Pelve (`root`), cintura (`spine`) e tórax (`chest`) agora são um único tipo de volume torneado em forma de "barril" (`LatheGeometry` com perfil gerado por `blobProfile`), substituindo as esferas de escala não-uniforme da rodada 1. Cabeça continua como esfera de escala não-uniforme (já adequada).
- Ossos de membro (ombro↔cotovelo↔pulso, quadril↔joelho↔tornozelo, clavícula↔ombro, polegar) também passaram a usar perfil torneado (`limbProfile`) com afunilamento **e** uma leve "barriga" muscular no meio do segmento, em vez do cilindro de raio reto da rodada 1.
- Mãos (`wrist→fingers`) e pés (`ankle→ball`) continuam como caixas achatadas em "pá" (inalterado).
- `skeleton.ts` (hierarquia de juntas e limites) **não foi alterado** em nenhuma das duas rodadas — a mudança é inteiramente de geometria/aparência em `Figure.tsx`.
- **Bug encontrado e corrigido durante a rodada 2** (registrado em `DECISOES.md` #5): o perfil dos ossos torneados inicialmente não era centrado na própria origem (ia de y=0 a y=comprimento), quebrando a posição dos ossos no mundo (`Bone` posiciona a malha no ponto médio do segmento, convenção que exige um perfil simétrico). Detectado na validação manual no navegador — não pelos testes automatizados, que checavam só o tipo de geometria. Corrigido e coberto por um novo teste de regressão que verifica a caixa delimitadora da geometria de um osso.
- 5 novos testes automatizados na rodada 2 (volume torneado maior que uma junta comum para pelve/tórax; ossos de membro usando `LatheGeometry`; teste de regressão da centralização do perfil) — suíte completa em 72 testes, todos verdes; `tsc -b`, `eslint .` e `npm run build` continuam limpos.
- **Validação manual no navegador (as duas rodadas):** boneco renderiza como um manequim articulado reconhecível (cabeça oval, tórax e pelve como blocos torneados distintos conectados por uma "cintura", membros afunilados com leve volume, mãos/pés em pá), sem erros no console.

### Ajustes ao plano (sem código) — pedidos pelo usuário, aplicados antes da fase 3

Três funcionalidades novas foram detalhadas no `PLANO.md` a pedido do usuário, com a pesquisa e as decisões de formato registradas no próprio texto do plano (seções "Persistência" e "Ambiente e câmera") e resumidas aqui:

1. **Exportar/importar um boneco individual** separadamente da cena completa — decisão (confirmada pelo usuário): reaproveitar o mesmo `.glb`/`extras` já usado para a cena completa, escopado a um boneco, em vez de adotar BVH (padrão da indústria para pose/esqueleto, mas exigiria um parser novo e não carrega cor/altura/nome). Alocado à fase 6, junto da persistência da cena completa (mesmo pipeline de exportação/importação).
2. **Exportar/importar um conjunto de bookmarks de câmera** separadamente da cena — mesmo `.glb`, importação por mesclagem (soma aos bookmarks existentes, sem sobrescrever). Também alocado à fase 6.
3. **Refinamento visual do boneco** (item acima) — decisão (confirmada pelo usuário): aplicado imediatamente, como adendo à fase 2, em vez de esperar a fase 3 ou 8.

Nenhuma dessas mudanças altera o escopo das fases 1–2 já entregues nem exige retrabalho — a fase 6 só ganhou dois itens de entrega explícitos na tabela de fases.

### Segundo adendo à Fase 2 — pivô da cabeça e elipse de sombra no chão ✅ (concluído em 2026-07-22)

A pedido do usuário, mais dois ajustes de `Figure.tsx` (nenhum mexe em `skeleton.ts`):

- **Pivô da cabeça:** a esfera da cabeça estava centralizada exatamente sobre a junta `neck→head`. Como a nuca fica na base do crânio (não no seu centro), a esfera agora é renderizada deslocada um pouco para frente (`HEAD_FORWARD_OFFSET = 0,025 m`, eixo +Z — mesma convenção de "frente" já usada por `ball.*`/polegar em `skeleton.ts`), deixando o pivô visivelmente por baixo/atrás da esfera, não no centro dela.
- **Elipse de sombra no chão:** cada boneco agora projeta uma elipse achatada e translúcida (`CircleGeometry` deitado, escala nos eixos X/Z, `MeshBasicMaterial` com `transparent`/`depthWrite={false}`) na cor do próprio boneco — o equivalente virtual da base de madeira do manequim de referência. Decisão tomada com o usuário: sempre visível (não só quando selecionado) e cor do boneco (não um tom neutro), desenhada como uma "sombra" achatada em vez de um disco sólido levantado. Escala junto com a altura do boneco (é filha do grupo raiz já escalado).
- 2 novos testes automatizados (deslocamento da cabeça; sombra com geometria/material/cor corretos) — suíte completa em 74 testes, todos verdes; `tsc -b`, `eslint .` e `npm run build` continuam limpos.
- **Validação manual no navegador:** cabeça com pivô visivelmente deslocado; duas figuras lado a lado mostrando elipses de sombra na cor de cada uma, sem erros no console.
- **Ajuste seguinte (mesmo dia):** o usuário observou que o pivô ainda parecia estar na "ponta" do elipsoide da cabeça. Adicionado também um deslocamento para baixo (`HEAD_DOWN_OFFSET = 0,03 m`, eixo -Y), deixando o pivô mais visivelmente dentro do volume da cabeça. Teste de deslocamento da cabeça estendido para checar X **e** Y; suíte em 74 testes, todos verdes; validado no navegador (zoom na cabeça) e sem erros no console.

### Fase 3 — Pose FK ✅ (concluída em 2026-07-22)

**Entregue:**
- `figuresStore` (zustand + **zundo**): `selectedJointName` e `activeAxis` (eixo com foco para os atalhos de seta), além do `selectedFigureId` já existente. Selecionar um boneco agora seleciona implicitamente seu `root` (pronto para mover/girar, conforme o passo 1 de "Interação de pose"). `selectJoint` define o eixo ativo como o primeiro grau de liberdade da junta (via novo `getJointAxes` em `skeleton.ts`); `setActiveAxis` troca entre os eixos da junta selecionada, ignorando eixos que não são DOF dela.
- **Undo/redo com `zundo`:** `useFiguresStore` envolvido com o middleware `temporal`, rastreando só `figures`/`nextFigureSeq` (`partialize`) — seleção de boneco/junta/eixo fica **fora** do histórico, como a navegação de câmera. `equality` referencial evita empilhar histórico quando nada muda de fato (ex.: só trocar de seleção), já que toda ação do store faz atualização imutável.
- **`src/shortcuts/shortcuts.ts`:** mapa central de atalhos, puro e testável — setas (rotação da junta no eixo ativo ou movimento do root no plano do chão; Shift = passo maior, Ctrl = passo fino), Tab/Shift+Tab (ciclar juntas), 1–5 (selecionar boneco pela posição), Ctrl+Z/Ctrl+Shift+Z/Ctrl+Y (desfazer/refazer), Ctrl+D (duplicar), Esc (limpar seleção), Delete (remover boneco), H (mostrar/ocultar) — todos ignorados com foco em campo de texto. `src/shortcuts/useKeyboardShortcuts.ts` liga o mapa ao estado da aplicação (um listener em `window`, montado uma vez em `AppShell`).
- **Seleção de junta no viewport:** `Figure.tsx` ganhou `onSelectJoint`/`selectedJointName` (clique no corpo/pivô de qualquer junta seleciona-a, com destaque emissivo amarelo) e `onJointRef` (registra o `Group` ao vivo de cada junta, usado para anexar o gizmo). Clicar em área vazia do viewport (`onPointerMissed`) limpa a seleção.
- **Gizmo 3D (`@react-three/drei` `TransformControls`):** `src/scene/SelectionGizmo.tsx` anexa o gizmo à junta selecionada — modo *translate* restrito ao plano do chão (X/Z, sem Y) para o `root`, modo *rotate* restrito aos eixos que são DOF daquela junta para as demais. `Viewport.tsx` mantém o registro de referências das juntas (por boneco), desabilita o `OrbitControls` enquanto o gizmo está sendo arrastado (mitigação já prevista em "Riscos e mitigações"), e aplica a mudança do gizmo de volta no store (com o mesmo grampeamento de `skeleton.ts` usado em qualquer outra edição de pose).
- **`PropertiesPanel`:** com o `root` selecionado, mostra posição XYZ (m) e rotação XYZ (°) em campos numéricos livres; com outra junta selecionada, mostra um slider por eixo de DOF (limitado ao min/max de `skeleton.ts`) e um botão por eixo para escolher o eixo ativo dos atalhos de teclado.
- **Duplicar boneco:** botão na lista de bonecos (`FiguresPanel`) e atalho Ctrl+D, usando a ação `duplicateFigure` do store (já implementada e testada desde a fase 2).
- 39 novos testes automatizados (skeleton `getJointAxes`: 3; figuresStore seleção/eixo ativo/undo-redo: 16; shortcuts.ts: 20 — já contabilizados; useKeyboardShortcuts: 15; Figure.tsx seleção/destaque/ref: 4; PropertiesPanel: 5; FiguresPanel duplicar: 2; SelectionGizmo: 4; AppShell atalho: 1) — suíte completa em 143 testes, todos verdes; `tsc -b`, `eslint .` e `npm run build` continuam limpos.
- **Validação manual no navegador:** clique em diferentes partes do corpo seleciona a junta correta (destaque visível, gizmo troca de modo/eixos corretamente entre root/tronco/membros); setas giram a junta ativa e o restante da cadeia acompanha via FK; Ctrl+Z desfaz corretamente múltiplas edições em sequência; Ctrl+D duplica o boneco selecionado; seleção por dígito (1–5) e H (mostrar/ocultar) funcionam; edição do campo de posição via evento nativo do DOM (`input`) atualiza a cena corretamente; sem erros no console.

**Não entregue nesta fase (fora do escopo definido no mapa de atalhos para fases futuras):** Espaço (captura de keyframe, fase 5), Q/W/E/R (alternância de modo de ferramenta — adiado por não haver IK ainda, fase 7), F/teclado numérico/Shift+1–5 (câmera, fase 4), Ctrl+S (salvar cena, fase 6), painel de ajuda `?` (fase 8).

**Decisões técnicas registradas em `DECISOES.md`:** entrada #6 sobre `@react-three/test-renderer` não expor `TransformControls` como nó localizável na árvore da cena — contornado usando `renderer.toTree()` (árvore de elementos React) em vez de `renderer.scene.findByType/findByProps`.

### Correção pós-fase 3 — gizmo de translação "arrancava" o boneco do chão ✅ (corrigido em 2026-07-23)

Na validação manual pendente (arrastar o gizmo com o mouse), o usuário reportou o bug: ao mover o `root` pelo gizmo, o boneco saltava para fora do plano do chão e a sombra se soltava do corpo.

**Causa raiz:** o gizmo de translação estava anexado ao **grupo interno** da junta `root` (que carrega um offset fixo `[0, 0.9, 0]` do `skeleton.ts`, a altura do quadril), em vez do **grupo externo** que representa `figure.position` (a colocação editável do boneco, do qual a sombra também é filha direta). Isso causava dois sintomas simultâneos: a sombra ficava para trás durante o arrasto (só o grupo interno se movia em tempo real) e, ao soltar, o offset fixo de 0,9 m era gravado como se fosse a posição do boneco e depois somado de novo pelo grupo interno no próximo render — o corpo acabava flutuando a ~1,8 m do chão.

**Correção:** o alvo do gizmo de translação para `root` passou a ser o grupo externo (`figure-${id}`), reaproveitando o mesmo callback `onJointRef` já existente — sem novo prop, sem mudanças em `SelectionGizmo.tsx` nem `Viewport.tsx`. Coberto por um novo teste de regressão em `Figure.test.tsx`. Detalhe completo em `DECISOES.md` #7.

**Validação manual (usuário + eu, via automação de navegador com arrasto real — funcionou desta vez, ao contrário do `OrbitControls`):** arrastar o gizmo nos eixos X e Z move o boneco corretamente mantendo Y=0 e a sombra alinhada aos pés; Ctrl+Z desfaz os incrementos do arrasto; o gizmo de rotação (testado na mesma sessão) também respeita corretamente os limites articulares do `skeleton.ts` (ex.: `chest` no eixo Z travou exatamente em -15°); sem erros no console. Suíte completa em 144 testes, todos verdes; `tsc -b`, `eslint .` e `npm run build` continuam limpos. **Fase 3 agora totalmente validada, sem pendências.**

### Ajuste pós-fase 3 — translação livre em Y, sombra presa ao chão ✅ (concluído em 2026-07-23)

A pedido do usuário: possibilitar levantar o boneco no eixo Y (ex.: poses de salto/voo), mantendo a sombra no chão como referência visual de altura.

- **`SelectionGizmo.tsx`:** o gizmo de translação do `root` passou a mostrar os 3 eixos (antes só X/Z, Y ficava restrito aos campos numéricos do painel). Nenhuma outra lógica mudou — `handleObjectChange` já gravava `target.position` completo, só faltava expor a seta Y no gizmo.
- **`Figure.tsx`:** a sombra (`FigureShadow`) deixou de ser filha do grupo que carrega a posição completa do boneco (incluindo Y) e passou a ter seu **próprio grupo pai**, que só herda X/Z de `figure.position` — a coordenada Y desse grupo é fixa, perto de zero (`SHADOW_GROUND_OFFSET`), independente de quão alto o boneco esteja. Isso evita que a sombra "suba junto" com o boneco quando ele é levantado.
- 1 novo teste automatizado em `Figure.test.tsx` (sombra fica em Y≈0 e acompanha X/Z mesmo com o boneco em `position=[1.2, 1.5, -0.6]`) e o teste de eixos do gizmo em `SelectionGizmo.test.tsx` foi atualizado para exigir `showY=true` no root — suíte completa em 145 testes, todos verdes; `tsc -b`, `eslint .` e `npm run build` continuam limpos.
- **Validação manual no navegador (arrasto real):** levantar o boneco pela seta verde (Y) resultou em `position.y ≈ 0,846` com X/Z inalterados e a sombra permanecendo visualmente no chão; mover em seguida pela seta X manteve a altura (Y) e moveu a sombra junto em X, continuando no chão; sem erros no console.

### Fase 4 — Câmera ✅ (concluída em 2026-07-23)

Antes de implementar, três decisões de arquitetura em aberto no plano foram confirmadas com o usuário via pergunta direta: (1) os presets ortográficos trocam a projeção da câmera de verdade (`THREE.OrthographicCamera`), não só reposicionam uma câmera em perspectiva; (2) os controles de câmera ficam num painel novo e dedicado ("Câmera"), não na Toolbar nem dentro do painel de Propriedades; (3) salvar um bookmark é um fluxo explícito — botão "Salvar posição atual" seguido de um campo de nome — em vez de Shift+1..5 salvar automaticamente num slot vazio.

**Entregue:**
- `src/scene/cameraPresets.ts`: lógica pura dos 6 presets ortográficos (frente/costas/esquerda/direita/topo/3-4) — direção e vetor "para cima" da câmera a partir de um alvo e distância (convenção +Z = frente, igual ao resto do projeto), mais `computeOrthographicZoom` (zoom que enquadra a cena de forma equivalente a uma perspectiva do mesmo FOV/distância, evitando um "salto" de escala ao trocar de projeção). Sem nenhuma dependência de R3F/three — 12 testes automatizados cobrindo os 6 presets e a fórmula de zoom.
- `src/store/cameraStore.ts`: FOV, projeção ativa (`perspective`/`orthographic`) e um "comando pendente" (`preset`/`toPerspective`/`applyBookmark`/`requestSaveBookmark`) que o `CameraRig` executa uma única vez. Fica **fora** do histórico de undo — é navegação de câmera, como órbita/pan/zoom (ver PLANO.md > "Interação de pose", item 5). 8 testes automatizados.
- `src/store/figuresStore.ts` (estendido): `cameraBookmarks`/`nextCameraBookmarkSeq` — bookmarks nomeados de câmera (posição, alvo, projeção, FOV, zoom) vivem no mesmo store (e mesmo histórico `zundo`) dos bonecos, porque o plano exige que criar/remover bookmark **entre** no histórico de undo normalmente, ao contrário da navegação livre; um único store com `temporal` é a única forma de ter uma linha do tempo cronológica combinada (decisão detalhada em `DECISOES.md` #8). 6 novos testes (criar, remover, ids distintos, undo/redo).
- `src/scene/CameraRig.tsx`: componente sem visual dentro do `<Canvas>` que mantém duas câmeras (`PerspectiveCamera`/`OrthographicCamera`) sempre vivas e alterna qual é a câmera ativa do R3F via `set({camera})`, copiando pose de uma para a outra — evita a corrida de desmontar/remontar um componente de câmera do drei a cada troca de projeção (decisão detalhada em `DECISOES.md` #8). Executa os presets, aplica/salva bookmarks e mantém o FOV sincronizado. Assim como o arraste do `TransformControls`, não tem teste automatizado da movimentação real (só a lógica pura em `cameraPresets.ts` e as transições do `cameraStore.ts` são cobertas) — validado manualmente no navegador.
- `src/layout/CameraPanel.tsx`: painel novo (4ª coluna do layout) com campo de FOV, os 6 botões de preset, botão "Voltar à perspectiva" (desabilitado quando já em perspectiva), lista de bookmarks (ir para / remover) e o fluxo "Salvar posição atual" → campo de nome → confirmar/cancelar. 8 testes automatizados (RTL).
- Atalhos de teclado: Numpad1/3/7 (convenção Blender) para frente/direita/topo; Ctrl+Numpad1/3 para costas/esquerda; Shift+1..5 para ir a um bookmark pelo índice. Precisou de um campo novo (`code`, `event.code`) em `ShortcutKeyEvent` para distinguir o numpad dos dígitos comuns (que já significam selecionar boneco) — o `key` sozinho é ambíguo com NumLock ligado. 6 novos testes em `shortcuts.ts` + 3 em `useKeyboardShortcuts.ts`.
- i18n: novas chaves em `panels.camera.*` (pt-BR e en).
- **Fora do escopo desta fase (adiado, não esquecido):** o atalho "F" (enquadrar câmera no boneco selecionado) está no mapa geral de atalhos do plano, mas não é um dos três itens de entrega listados para a fase 4 ("FOV, presets ortográficos, bookmarks") — fica para quando fizer sentido (fase 8 ou antes, se necessário).
- 39 novos testes automatizados (cameraPresets: 12; figuresStore bookmarks: 4; cameraStore: 8; shortcuts.ts: 4; useKeyboardShortcuts: 3; CameraPanel: 8) — suíte completa em 184 testes, todos verdes (a instabilidade observada rodando a suíte inteira em um único processo era contenção de recursos da máquina, não falha real — confirmado repetindo com menos workers em paralelo); `tsc -b`, `eslint .` e `npm run build` continuam limpos.
- **Validação manual no navegador:** presets Frente/Topo/3-4 mudam a projeção para ortográfica corretamente (grade "de cantos" no topo, silhueta achatada de frente); orbitar com o mouse a partir da vista de Topo funciona sem nenhum comportamento degenerado (o vetor "para cima" da câmera muda para o preset de topo, e o `OrbitControls` recalcula sua base interna a cada `update()`, então acompanha corretamente); "Voltar à perspectiva" preserva o ângulo de visão atual, só troca a projeção; salvar um bookmark na vista 3/4, orbitar livremente e depois reaplicá-lo (pelo botão e por Shift+1) restaurou exatamente a mesma posição/projeção/zoom; Numpad7 (Topo) funcionou via teclado; alterar o campo de FOV mudou a distorção da perspectiva em tempo real; sem erros no console (só o aviso pré-existente e não relacionado `THREE.WebGLShadowMap: PCFSoftShadowMap has been deprecated`, interno ao `@react-three/fiber`).

**Observação registrada e corrigida no mesmo dia:** o texto do plano ("Interação de pose", item 5) lista "configuração da cena" entre o que deveria ter undo/redo, mas `sceneStore.ts` (fundo/grade, da fase 1) nunca tinha sido integrado ao `zundo` — gap pré-existente, não introduzido por esta fase, sinalizado ao usuário e corrigido a pedido dele logo em seguida (ver abaixo).

### Correção pós-fase 4 — `sceneStore` incorporado ao histórico de undo ✅ (concluída em 2026-07-23)

`environment` (fundo/grade) migrou de um `sceneStore.ts` próprio (sem `zundo`) para dentro do `figuresStore.ts` — mesma solução já usada para os bookmarks de câmera na fase 4: como o `zundo` mantém uma pilha de undo por store, só um único store consegue dar ao `Ctrl+Z` uma linha do tempo cronológica combinada e correta entre edições de boneco e de ambiente intercaladas. `sceneStore.ts` foi removido; `Toolbar.tsx`, `Viewport.tsx` e `scene/constants.ts` passaram a importar `environment`/`BackgroundTone` de `figuresStore.ts`. Nenhuma mudança de comportamento visível fora do undo. Detalhe completo (opções consideradas e motivo) em `DECISOES.md` #8.

- 6 novos testes automatizados em `figuresStore.test.ts` (estado inicial, `setBackground`, `toggleGrid`, undo/redo de fundo, e um teste específico de intercalação cronológica: criar boneco → mudar fundo → mudar altura → alternar grade → 4 undos devem desfazer exatamente nessa ordem, não agrupados por tipo) — suíte completa em 187 testes, todos verdes; `tsc -b`, `eslint .` e `npm run build` continuam limpos.

### Fase 5 — Keyframes ✅ (concluída em 2026-07-23)

Antes de implementar, uma lacuna real do plano foi confirmada com o usuário via pergunta direta: a nomenclatura `nome-da-cena_kf001.png` pressupõe um "nome da cena", mas esse conceito só chegaria formalmente na fase 6 (lista de cenas). Decisão: adicionar um campo "Nome da cena" na Toolbar desde já (padrão "Cena 1", editável), que a fase 6 reaproveita sem retrabalho.

**Entregue:**
- `src/keyframe/keyframeNaming.ts`: lógica pura da nomenclatura sequencial — `slugifySceneName` (sanitiza o nome da cena para um nome de arquivo seguro: espaços e caracteres reservados do Windows viram hífen, hífens repetidos colapsam, acentos são preservados, fallback `scene` se o resultado ficar vazio) e `formatKeyframeFilename` (`nome-da-cena_kf001.png`, `kf002`…, com padding de 3 dígitos que se estende em vez de truncar após 999). 10 testes automatizados.
- `src/keyframe/constants.ts`: presets de resolução citados no plano (Full HD 1920×1080, Quadrada 1080×1080) mais 4K (3840×2160) como teto, conforme "Riscos e mitigações" → "teto de resolução (ex.: 4K)".
- `src/store/figuresStore.ts` (estendido): `sceneName` (undoable, igual a renomear um boneco) e `nextKeyframeNumber`/`consumeKeyframeNumber` (**fora** do histórico de undo — desfazer uma captura não devolveria o arquivo já salvo em disco, então voltar o contador arriscaria sobrescrever um arquivo existente na próxima captura). 6 novos testes.
- `src/store/keyframeCaptureStore.ts`: preset de resolução ativo, largura/altura (só editáveis com preset "Personalizada", grampeadas ao teto de 4K), opção de ocultar grade/gizmos na captura (padrão ligado), o handle de diretório escolhido (só dura a sessão, nunca persistido) e o gatilho de captura — mesmo padrão de "comando pendente" já usado pelo `cameraStore.ts`, fora do histórico de undo (é configuração de ferramenta, não conteúdo da cena). 10 testes automatizados.
- `src/scene/KeyframeCapture.tsx`: componente sem visual dentro do `<Canvas>` que executa a captura real — redimensiona o `WebGLRenderer` para a resolução pedida, ajusta o aspecto/frustum da câmera ativa (perspectiva ou ortográfica), oculta grade/gizmo via `scene.traverse` quando pedido, renderiza um frame, lê o PNG via `toBlob` e restaura tudo de volta **antes** de qualquer pintura do navegador — sem flash visível (técnica e alternativas descartadas documentadas em `DECISOES.md` #9). Escreve o arquivo via File System Access API (se uma pasta foi escolhida) ou aciona um download convencional (fallback). Assim como `CameraRig.tsx`, não tem teste automatizado da captura real (WebGL + File System Access não existem em jsdom) — validado manualmente no navegador.
- `src/layout/KeyframePanel.tsx`: painel novo (5ª coluna) com seletor de resolução (presets + campos de largura/altura quando "Personalizada"), checkbox de ocultar grade/gizmos, botão "Escolher pasta de destino" (só aparece se `showDirectoryPicker` existir no navegador; caso contrário mostra aviso de que as capturas serão baixadas), botão "Capturar keyframe" e feedback da última captura. 8 testes automatizados, incluindo o caminho sem File System Access API (que o próprio `jsdom` já cobre "de graça") e o caminho com a API mockada.
- Atalho **Espaço** para capturar keyframe (ação mais frequente do fluxo), com `preventDefault` para não rolar a página — reaproveita o mesmo `matchShortcut`/`isTypingTarget` já usados por todos os outros atalhos.
- Campo "Nome da cena" na `Toolbar.tsx`.
- i18n: novas chaves em `toolbar.sceneName` e `panels.keyframes.*` (pt-BR e en).
- 39 novos testes automatizados (keyframeNaming: 10; keyframeCaptureStore: 10; figuresStore sceneName+contador: 6; KeyframePanel: 8; Toolbar: 1; shortcuts.ts: 3; useKeyboardShortcuts: 1) — suíte completa em 226 testes, todos verdes; `tsc -b`, `eslint .` e `npm run build` continuam limpos. Durante a implementação, o `eslint-plugin-react-hooks` acusou mutação direta do valor devolvido por `useThree()` (câmera) — resolvido lendo a câmera ativa via o acessor imperativo `getThree().camera` só na hora de mutar (detalhe em `DECISOES.md` #9).
- **Validação manual no navegador:** capturei keyframes em resolução personalizada (800×600, perspectiva e ortográfica), com e sem "ocultar grade/gizmos" — o PNG baixado conferiu exatamente com a resolução pedida (`800 x 600`, verificado com `file`) sem distorção nem esticamento, com grade/gizmo corretamente presentes/ausentes conforme a opção; a viewport ao vivo não mostrou nenhum flash/pulo visual durante a captura; a numeração incrementou corretamente a cada captura (`Cena-1_kf001.png`, `kf002`, `kf003`, `kf004`, esta última disparada pelo atalho Espaço); sem erros no console. O fluxo de escolher pasta via File System Access API não foi validado por automação (abriria um seletor nativo do SO, que travaria a sessão) — a lógica de leitura/escrita foi coberta por teste automatizado com a API mockada; a interação real com o seletor de pasta fica pendente de validação manual pelo usuário.
- **Validação manual adicional, a pedido do usuário (chão ocultando parte do boneco abaixo do plano):** com o `root` do boneco em `Y = -0,4` (pernas/pés abaixo do plano do chão em `Y = 0`), capturei um keyframe em Full HD — tanto a viewport ao vivo quanto o PNG resultante mostram o boneco cortado exatamente na altura do chão, sem nenhuma parte abaixo do plano aparecendo. Já funcionava sem nenhuma mudança de código: é oclusão padrão por teste de profundidade do WebGL contra a malha opaca do chão (presente desde a fase 1), e o PNG capturado é sempre opaco (sem canal alfa), então não há composição de transparência envolvida. Um teste automatizado que verificasse o *conteúdo de pixel* do PNG exigiria rasterização WebGL real, inviável no ambiente de teste (mesma limitação já documentada para toda a captura de PNG) — detalhe completo em `DECISOES.md` #10.
- **Validação manual no navegador:** repeti a sequência do teste acima com interações reais (select de fundo, campo de altura, checkbox de grade) e 4× Ctrl+Z — cada undo desfez exatamente a edição mais recente, na ordem certa, terminando com a cena vazia; sem erros no console.

### Fase 6 — Persistência e PWA ✅ (concluída em 2026-07-23)

Antes de implementar, o conceito de "lista de cenas" (citado só na tabela de fases, sem detalhe no resto do plano) foi esclarecido com o usuário via pergunta direta — ver `DECISOES.md` #11 para a investigação completa, as opções de formato de arquivo consideradas e a decisão. Resumo do modelo adotado: **workspace** = coleção local de **snapshots de cena** nomeados (cada um = bonecos/poses/ambiente/bookmarks/contador de keyframe daquele momento), continua **1 cena = 1 `.glb`** (não um `.glb` único multi-cena, por risco de incompatibilidade com o importador do Blender), e o workspace salvo em disco é uma **pasta** com um manifesto `workspace.json` apontando para os `.glb`s independentes.

**Entregue:**
- `src/persistence/sceneSerialization.ts`: conversão pura (sem `three`/glTF) entre o estado de uma cena e o schema `extras["virtual-mockup"]` do plano — `figureToExtras`/`figureFromExtras`, `cameraBookmarkToExtras`/`cameraBookmarkFromExtras`, `sceneToExtras`/`sceneFromExtras`, com validação/grampeamento via `skeleton.ts` para dados não confiáveis (arquivo editado à mão, versão antiga etc.) e defaults completos quando campos estão ausentes. 25 testes.
- `src/persistence/gltfIO.ts`: wrapper fino de `GLTFExporter`/`GLTFLoader` (`three-stdlib`) para `.glb` binário — grava `extras` em `scenes[0].extras` (só funciona passando uma instância real de `THREE.Scene`, não um `Group`, achado lendo o código-fonte da lib) e lê de volta em `gltf.scene.userData`. **Descoberta importante: isso é 100% testável em `vitest`/`jsdom`, sem exceção de WebGL** — diferente da captura de PNG (fase 5) e do arraste de gizmo/câmera (fases 3-4), que continuam sem automação por dependerem de rasterização/ponteiro reais.
- `src/persistence/figureObject3D.ts`: monta a mesma hierarquia de `Group`s do `skeleton.ts` (posição/rotação local por junta) **sem depender de React/`<Canvas>`**, com geometria simplificada (esfera por junta + cilindro por osso) em vez do visual esculpido completo de `Figure.tsx` — decisão confirmada com o usuário (a reconstrução no app é 100% baseada em `extras`, a geometria do arquivo só serve de referência visual no Blender; o visual completo fica para se/quando for necessário, extraindo a geometria de `Figure.tsx` para um módulo compartilhado). Nomes de nó usam `_` em vez de `.`/`:`/`/` — o `GLTFLoader` remove esses caracteres ao reimportar (`PropertyBinding.sanitizeNodeName`), então `"figure-1.shoulder.L"` viraria `"figure-1shoulderL"`, quebrando busca por nome.
- `src/persistence/sceneFile.ts`: `exportSceneToGlb`/`importSceneFromGlb` (cena completa), `exportFigureToGlb`/`importFigureFromGlb` (boneco individual, sem `environment`/`cameraBookmarks`/`keyframeCounter`), `exportCameraBookmarksToGlb`/`importCameraBookmarksFromGlb` (conjunto de bookmarks, um nó de câmera glTF por bookmark — decisão confirmada com o usuário: um por bookmark salvo, não uma única câmera "atual", para manter a exportação 100% headless).
- `src/persistence/workspaceManifest.ts` + `src/persistence/workspaceFolder.ts`: manifesto `workspace.json` (nome de arquivo único por cena, mesmo com nomes de cena duplicados) e orquestração de salvar/abrir um workspace inteiro numa pasta via File System Access API, com fallback de seleção manual de múltiplos arquivos (`workspace.json` + `.glb`s juntos) para navegadores sem a API.
- `src/persistence/fileIO.ts`: utilitários de E/S compartilhados (extraídos de `KeyframeCapture.tsx`, que usava a mesma lógica só para PNG) — gravação com fallback de download, seleção de um ou vários arquivos.
- `src/persistence/autosave.ts` + `useWorkspaceAutosave.ts`: autosave contínuo do workspace inteiro em `localStorage` (debounce de 800 ms), restaurado **automaticamente ao abrir o app, sem diálogo de confirmação** (decisão confirmada com o usuário) — reaproveita o mesmo schema de `extras` por desempenho.
- `src/store/figuresStore.ts` (estendido): catálogo `scenes`/`activeSceneId` (workspace) integrado ao mesmo histórico de undo já existente — criar/renomear/remover snapshot é conteúdo (como bookmarks de câmera), `activeSceneId` fica fora (como seleção); `saveSceneSnapshot`/`loadSceneSnapshot`/`renameSceneSnapshot`/`removeSceneSnapshot`/`loadWorkspaceCatalog`; ações de importação `applyImportedPose`/`importFigureAsNew`/`importCameraBookmarks` (sufixo automático em nomes de bookmark duplicados, conforme o plano) e `loadSceneWorkingState` (importar cena substitui o estado de trabalho num único passo de undo).
- `src/layout/ScenesPanel.tsx` (6º painel, novo): lista de snapshots (carregar/remover), fluxo salvar-com-nome, exportar/importar a cena de trabalho como `.glb`, salvar/abrir workspace em pasta (com aviso quando a File System Access API não existe).
- Botões de exportar/importar boneco individual em `FiguresPanel.tsx` (aplica a um boneco selecionado ou cria um novo) e de bookmarks de câmera em `CameraPanel.tsx`.
- `vite-plugin-pwa`: manifest (`icons`, `theme_color`, `display: standalone`), service worker com pré-cache de todo o bundle (`generateSW`), registro automático. Ícone novo `public/icon.svg` (SVG, funciona em `any`/`maskable`) substituindo o placeholder genérico do template inicial.
- 90+ novos testes automatizados (sceneSerialization: 11; gltfIO: 2; figureObject3D: 7; sceneFile: 5; workspaceManifest: 4; workspaceFolder: 5; autosave: 4; useWorkspaceAutosave: 2; figuresStore workspace+importação: 20; ScenesPanel: 11; FiguresPanel: +6; CameraPanel: +2) — suíte completa em 300+ testes, todos verdes; `tsc -b`, `eslint .` e `npm run build` (incluindo geração do service worker/manifest) continuam limpos.
- **Validação manual no navegador** (via automação Chrome, `npm run preview`): manifest e service worker registrados e ativos; `caches` confirma que todo o bundle (JS/CSS/HTML/manifest/ícones) está pré-cacheado; fluxo completo real (sem mocks) de adicionar boneco → salvar snapshot "Pose inicial" → exportar cena atual (`.glb` baixado, confirmado como glTF binário v2 válido via header) → **recarregar a página simula reabrir o app** → boneco e snapshot restaurados automaticamente pelo autosave, sem diálogo; editar altura → "Carregar esta cena" reverteu exatamente ao valor salvo; Ctrl+Z desfez esse load num único passo, voltando ao valor editado; sem erros no console.

**Pendente de validação manual pelo usuário (mesma política das fases 1-5 — interação com diálogos nativos do SO não é automatizável, ver `DECISOES.md` #3):**
- Escolher pasta/arquivo de verdade nos fluxos que abrem o seletor nativo (`Importar boneco/cena/bookmarks (.glb)`, `Salvar/Abrir workspace em pasta`) — a lógica de leitura/escrita está coberta por testes automatizados com a API mockada; falta confirmar a interação real com o seletor do SO.
- Instalar o PWA de verdade (ícone "Instalar app" da barra de endereço/menu do navegador) e confirmar que ele abre em janela própria e continua funcionando com a rede desligada — a pré-carga do service worker foi confirmada via `caches`, mas o teste com a rede fisicamente desligada fica para o usuário.
- **Teste de ida e volta com o Blender** (app → `.glb` → Blender → `.glb` → app): depende do Blender instalado na máquina do usuário; o `.glb` exportado já foi validado como glTF binário v2 estruturalmente correto (header + parsing bem-sucedido pelo próprio `GLTFLoader` nos testes automatizados e na validação manual acima), mas a abertura real no Blender (preservação de `extras` como custom property, hierarquia de objetos visível) ainda não foi conferida.

**Pendência registrada (não bloqueante, adiada a pedido do usuário):** o usuário testou o roteiro acima e relatou problema ao reimportar no app um `.glb` que passou pelo Blender (exportado do app → aberto e reexportado pelo Blender → reimportado). Marcado explicitamente como não prioritário pelo usuário — não investigado a fundo, retomar quando ele priorizar. Detalhe e hipótese mais provável (fallback "sem extras" ainda não implementado) em `DECISOES.md` (pendência registrada na entrada da fase 6).

### Fase 7 — IK ✅ (concluída em 2026-07-23)

Antes de implementar, dois pontos de design sem detalhe no plano foram confirmados com o usuário via pergunta direta: (1) a alternância FK/IK fica num toggle no painel de Propriedades (ao selecionar qualquer junta do braço/perna), reaproveitando o atalho **R** para o membro selecionado — não a versão completa de modos de ferramenta Q/W/E/R (mudança maior, descartada por enquanto); (2) quando o alvo está fora de alcance, o alvo/indicador muda de cor (verde/vermelho), além de aplicar a melhor aproximação já prevista no plano.

**Mudança de arquitetura em relação ao plano original:** o plano previa um solver CCD manual. Na implementação, um CCD ingênuo (por junta ou por eixo, com limites articulares) travava indefinidamente contra o limite do cotovelo/joelho mesmo para alvos geometricamente alcançáveis — problema conhecido de mínimo local contra a borda de um limite duro. Trocado por **IK analítico de 2 ossos** (lei dos cossenos + construção de uma base ortonormal para orientar a junta-base), confirmado com o usuário como opção recomendada — investigação completa, 3 opções consideradas e os dois bugs de sinal reais encontrados e corrigidos durante a implementação (cada um confirmado numericamente, não por suposição) em `DECISOES.md` #12.

**Entregue:**
- `src/figure/jointFrames.ts`: extraído de `figureObject3D.ts` (fase 6) — constrói a árvore de transformos (`Group`s, sem geometria) de um boneco a partir de `figure.position/rotation/pose`, com `updateMatrixWorld` já aplicado. Reaproveitado tanto pela exportação glTF quanto pelo solver de IK — uma única fonte da cinemática direta do boneco. `figureObject3D.ts` foi refatorado para usar esse módulo (mesmo comportamento, testes existentes continuam verdes).
- `src/figure/ikSolver.ts`: `solveIKChain` — IK analítico de 2 ossos para as 4 cadeias do plano (`wrist.L`/`wrist.R`: ombro+cotovelo; `ankle.L`/`ankle.R`: quadril+joelho), sempre respeitando os limites de `skeleton.ts` (grampeamento por eixo) e com "melhor aproximação" quando o alvo está fora do alcance `[|L1-L2|, L1+L2]`. `getLimbEndEffector(jointName)` mapeia qualquer junta do braço/perna (base, intermediária ou efetuadora) para a cadeia correspondente — usado pela UI para saber quando mostrar o toggle de IK. 11 testes automatizados, incluindo alvo já alcançado, alvo alcançável, alvo fora de alcance (com verificação de que os limites articulares continuam respeitados) e as 4 cadeias resolvendo sem erro.
- `src/figure/ikActions.ts`: `toggleLimbIK` (liga/desliga IK para um membro, semeando o alvo na posição atual do efetuador ao ligar) e `applyIKTarget` (resolve a cadeia para um alvo e grava o resultado em `figuresStore` — undo normal, como qualquer edição de pose — mais `ikStore`, alvo/alcançabilidade). 6 testes automatizados.
- `src/store/ikStore.ts`: estado de ferramenta (quais membros, por boneco, estão em IK; posição do alvo de cada um; se o último `solve` alcançou o alvo) — fora do histórico de undo, como `cameraStore`/`keyframeCaptureStore` (é modo de ferramenta, não conteúdo; a pose resultante é que entra no undo). `removeFigure` limpa o estado de IK de um boneco removido, chamado nos dois pontos que removem boneco (botão e atalho Delete). 7 testes automatizados.
- `src/layout/PropertiesPanel.tsx` (estendido): ao selecionar qualquer junta de um braço/perna, mostra o toggle "IK ativo neste membro". Com IK ativo, os sliders de FK do ombro/cotovelo (ou quadril/joelho) somem, substituídos por campos numéricos XYZ do alvo (editar um campo já resolve a cadeia e atualiza a pose); um aviso aparece quando o alvo está fora de alcance. A junta-efetuadora (pulso/tornozelo) mantém seus próprios sliders de FK (torção, grau de liberdade que o IK não cobre) mesmo com o membro em IK. 6 novos testes.
- `src/scene/IKTargetGizmo.tsx`: alvo arrastável (nova esfera livre no mundo, com `TransformControls` em modo `translate`) — verde quando o alvo está alcançável, vermelho quando não (decisão confirmada com o usuário). Ao arrastar, chama `applyIKTarget` a cada mudança, igual a `SelectionGizmo.tsx`. `Viewport.tsx` renderiza esse gizmo em vez do gizmo de rotação de FK quando a junta selecionada pertence a um membro com IK ativo (exceto a própria junta-efetuadora, que continua com seu gizmo de FK). 3 testes automatizados (fiação de props, como `SelectionGizmo.test.tsx` — o arrasto em si não é testável, mesma política das fases 3-4).
- Atalho **R**: alterna IK para o membro da junta atualmente selecionada (`toggleLimbIK`); sem efeito se a junta selecionada não pertencer a um braço/perna. 4 novos testes (`shortcuts.ts` + `useKeyboardShortcuts.ts`).
- i18n: novas chaves em `panels.properties.ik*` (pt-BR e en).
- 41 novos testes automatizados (jointFrames: 4; ikSolver: 11; ikActions: 6; ikStore: 7; IKTargetGizmo: 3; PropertiesPanel: +6; shortcuts.ts: +2; useKeyboardShortcuts: +2) — suíte completa em 340 testes, todos verdes; `tsc -b`, `eslint .` e `npm run build` continuam limpos.
- **Validação manual no navegador** (via automação Chrome, `npm run preview`): selecionei `elbow.L`, ativei IK pelo toggle e confirmei o mesmo resultado pelo atalho **R**; editei o alvo (campos X/Y/Z) e o braço dobrou naturalmente (cotovelo flexionado) até alcançar um alvo dentro do raio do braço; um alvo fora de alcance mostrou o aviso em vermelho e a melhor aproximação aplicada, exatamente como esperado; Ctrl+Z desfez a pose resultante do IK como qualquer outra edição. Sem erros no console. **Não validado manualmente:** o arrasto do gizmo com o mouse em si (mesma limitação de automação das fases 3-4 — a edição pelos campos numéricos exercita exatamente a mesma função `applyIKTarget`, então o risco residual é baixo) e a cadeia da perna (`ankle.*` — só coberta por teste automatizado, já que usa o mesmo código do braço).

### Fase 8 — Polimento ✅ (concluída em 2026-07-23)

Antes de implementar, "refinamentos de UX" (terceiro item da fase, sem detalhe no plano) foi confirmado com o usuário via pergunta direta: entregar primeiro os dois itens concretos (poses predefinidas + painel de ajuda) e só depois levantar sugestões de refinamento — não adotado sozinho como escopo.

**Entregue:**
- `src/figure/posePresets.ts`: 4 poses predefinidas (em pé, sentado, andando, correndo) — `resolvePosePreset(key)` monta a pose completa (todas as juntas exceto o root), grampeada pelos limites de `skeleton.ts`. "Em pé" é a pose neutra (todos os ângulos em zero, já que o `skeleton.ts` já modela um boneco em pé relaxado). As demais foram desenhadas com a mesma convenção de sinal confirmada em `ikSolver.ts` (positivo = flexiona para a frente, tanto no quadril quanto no ombro) e **validadas visualmente no navegador** (não só por dedução) — sentado com quadris/joelhos dobrados, andando/correndo com a marcha cruzada braço-perna correta (visto de perfil). 11 testes automatizados, incluindo que toda pose respeita os limites articulares e que o braço/perna se movem em sentidos opostos (marcha cruzada).
- `figuresStore.applyPosePreset(id, key)`: substitui a pose interna do boneco (não mexe em posição/rotação do root), undo normal. 4 novos testes.
- `src/layout/PropertiesPanel.tsx`: novo bloco "Poses predefinidas" (4 botões) ao selecionar o root de um boneco. 1 novo teste.
- Painel de ajuda de atalhos (`?`): `SHORTCUT_CATALOG` em `shortcuts.ts` — catálogo declarativo dos atalhos **realmente implementados** (fonte única, evita uma segunda lista desatualizada; não lista itens do mapa do plano ainda não construídos, ex.: Q/W/E/R de modo de ferramenta, Ctrl+S). `src/store/uiStore.ts` guarda a visibilidade do painel (fora do undo). `src/layout/ShortcutsHelpPanel.tsx`: modal listando o catálogo, fecha com `?`/Esc ou clique fora. Enquanto o painel está aberto, `useKeyboardShortcuts.ts` suspende todos os outros atalhos (só `?`/Esc respondem), para não editar a cena "por baixo" do painel. 3+4+2 novos testes (`uiStore`, `ShortcutsHelpPanel`, `shortcuts.ts`/`useKeyboardShortcuts.ts`).
- 27 novos testes automatizados no total — suíte completa em 368 testes, todos verdes; `tsc -b`, `eslint .` e `npm run build` continuam limpos.
- **Validação manual no navegador:** apliquei as 4 poses predefinidas e confirmei visualmente que fazem sentido anatômico (sentado com as coxas erguidas, andando/correndo com a marcha cruzada nítida vista de perfil, correndo mais dinâmica que andando); abri e fechei o painel de ajuda pelo atalho `?` e por Esc, lista completa visível e rolável. Sem erros no console.

**Correção pós-validação (mesmo dia) — sentado/correndo giravam para trás:** o usuário testou de novo e reportou pernas (sentado) e braço (correndo) virados para trás. Investigação numérica revelou um bug mais fundo que o valor dos presets: os limites de `hip.x`/`shoulder.x` em `skeleton.ts` (desde a fase 2) tinham a faixa grande do lado anatômico errado (extensão, não flexão). Corrigido em `skeleton.ts` (com confirmação do usuário, já que reflexiona pose já salva) + sinais dos presets ajustados e revalidados numérica e visualmente. Detalhe completo em `DECISOES.md` #13.

O terceiro item da fase ("refinamentos de UX", sem detalhe no plano original) virou sugestões concretas ao final da fase, levantadas com base na experiência de construir as fases 1-7 — o usuário pediu para registrá-las como uma fase própria em vez de dentro desta. Ver **Fase 9** abaixo.

### Fase 9 — Refinamentos de UX e workspace 📋 (planejada em 2026-07-23, não iniciada)

Sugestões de refinamento de UX levantadas ao final da fase 8 (com base na experiência de construir as fases 1-7), mais um pedido do usuário — registradas aqui a pedido dele como uma fase própria, para implementar quando ele priorizar:

1. **Botão de ajuda visível na Toolbar** — hoje o painel de atalhos (`ShortcutsHelpPanel.tsx`) só abre pelo atalho `?`; quem não souber que existe nunca descobre.
2. **Indicador de "salvo"** — o autosave (`useWorkspaceAutosave.ts`) é silencioso; um indicador discreto ("Salvo às HH:MM") na Toolbar daria confiança de que nada foi perdido.
3. **Botões de Desfazer/Refazer na Toolbar** — hoje só via teclado (Ctrl+Z/Ctrl+Shift+Z); útil para quem prefere mouse.
4. **Feedback de erro ao importar um `.glb` inválido/corrompido** — hoje as funções de importação (`sceneFile.ts`) falham silenciosamente sem avisar o usuário.
5. **Indicador de quais membros estão com IK ativo** — fácil esquecer que um braço ficou em IK (`ikStore.ts`), já que hoje só aparece no painel de Propriedades ao selecionar uma junta daquele membro especificamente.
6. **Botão "resetar pose" por junta individual** — hoje só é possível resetar a pose inteira via preset "Em pé" (`posePresets.ts`); zerar só uma junta exige ajustar cada eixo manualmente.
7. **Botão "novo workspace"** (pedido do usuário): limpa e reseta todo o ambiente — todos os bonecos, o catálogo de cenas salvas, bookmarks de câmera e configuração do ambiente, voltando ao estado inicial (equivalente a começar do zero, sem precisar dar reload na página/apagar o `localStorage` manualmente). Precisa de confirmação do usuário antes de executar (ação destrutiva e irreversível — diferente de remover um boneco, que o Ctrl+Z desfaz; limpar o workspace inteiro reseta também o próprio histórico de undo).
8. **Painéis de controle recolhíveis** (pedido do usuário): opção de recolher cada painel lateral (Bonecos, Propriedades, Câmera, Keyframes, Cenas) para liberar espaço de trabalho no viewport — útil em telas menores ou ao focar só na visualização 3D. Precisa decidir se o estado recolhido/expandido de cada painel persiste (localStorage/autosave) ou reseta a cada sessão.
9. **Cores dos gizmos nas caixas de texto** (pedido do usuário): os campos numéricos de posição/rotação (root, alvo de IK) e os sliders de rotação de junta ganham a mesma cor do eixo correspondente no gizmo (convenção já usada pelo `TransformControls`: X=vermelho, Y=verde, Z=azul), tanto para translação quanto para rotação — facilita associar visualmente qual campo controla qual seta/anel do gizmo no viewport.
10. **Indicador visual de alinhamento com a grade** (pedido do usuário): ao arrastar o gizmo de translação do root (ou o alvo de IK), destacar quando a posição está exatamente sobre uma linha da grade do chão (`SceneContent.tsx`) — facilita posicionar o boneco alinhado à grade sem precisar digitar valores exatos nos campos numéricos. Não implica snapping automático (o plano não pede isso), só o indicador visual; se fizer sentido, avaliar snapping como extensão posterior.
11. **Régua/escala vertical no viewport** (pedido do usuário): uma régua no eixo Y, com o mesmo espaçamento da grade do chão (`GRID_DIVISIONS`/`GROUND_SIZE` em `src/scene/constants.ts`), para dar noção de altura/escala ao levantar um boneco do chão (poses de salto/voo) ou comparar alturas entre bonecos.
12. **Auditoria completa de sinal/direção das juntas** (pedido do usuário): a correção da `DECISOES.md` #13 tratou só `hip.x`/`shoulder.x` (os eixos que o bug relatado expôs) — falta conferir, com o mesmo método numérico (cinemática direta via `buildJointFrames`, medindo a posição resultante no mundo, não só visual), se as demais juntas/eixos (`spine`/`chest`/`neck`/`head`, `clavicle.*`, `wrist.*`, `ankle.*`, os eixos `y`/`z` de `hip`/`shoulder`, etc.) têm o sentido "positivo" consistente e intuitivo (e entre si — ex.: mesmo eixo/sinal para juntas espelhadas L/R quando fizer sentido). Só depois disso os presets (`posePresets.ts`) podem ser revisados com confiança de que nenhum outro eixo tem o mesmo problema.
13. **Pivô do root: gizmo de rotação além de translação, com sliders no painel de Propriedades** (pedido do usuário): hoje o gizmo do `root` só oferece translação (`SelectionGizmo.tsx`, `mode` fixo em `'translate'` quando `isRoot`) — a rotação de colocação do boneco (`figure.rotation`) só é ajustável pelos campos numéricos livres do painel de Propriedades, sem gizmo próprio nem sliders. Adicionar um gizmo de rotação para o root (alternável com o de translação, ex. como translate/rotate dos softwares 3D) e trocar os campos numéricos de rotação do root, no painel de Propriedades, pelos mesmos controles de slider já usados nas demais juntas — para consistência de interação. **Ponto a esclarecer na implementação:** a menção a "alterar o ponto do pivô" pode implicar mudar qual objeto/origem o gizmo de rotação usa como referência (ex.: girar em torno do próprio root em vez de um pivô diferente) — confirmar a intenção exata com o usuário antes de implementar.
