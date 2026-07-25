# Decisões Técnicas e Problemas Encontrados

Registro de problemas encontrados durante a implementação, opções consideradas e decisão tomada. Cada entrada segue: **Contexto → Opções → Decisão → Motivo**.

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

2. **Preferências de layout ficam numa chave `localStorage` própria (`virtual-mockup:ui:v1`), separada do autosave do workspace.** Painel recolhido e régua ligada são preferências de quem está usando o app, não conteúdo da composição. Se entrassem no bloco do workspace, viajariam no `extras` do `.glb` e no `workspace.json` — poluindo um contrato de arquivo que o Blender também lê, sem nenhum ganho. Pela mesma razão a régua vertical **não** entrou em `environment` junto da grade, apesar da simetria aparente entre as duas.

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
