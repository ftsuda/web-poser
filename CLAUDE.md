# WebPoser — guia para o agente

App frontend 3D **totalmente offline** para posar manequins de desenhista (bonecos articulados de 32 juntas), montar cenas, animar entre poses-chave e exportar PNG/MP4 de referência para desenho.

Este arquivo é a porta de entrada. O detalhe mora em três documentos, e **todos os três são registro canônico do projeto**:

| Arquivo | O que é |
|---|---|
| `PLANO.md` | O que o app é, arquitetura, modelo do boneco e **a lista única de propostas de melhoria** (itens numerados 1–69, grupos A–J) |
| `DECISOES.md` | As **153 decisões** numeradas (de #1 a #138, com subnúmeros), com a narrativa do porquê. É onde se descobre *por que* algo é como é. Tem índice no topo |
| `HISTORICO.md` | O log de **130 entregas**, em ordem cronológica — uma entrada por sessão de trabalho. Tem índice no topo |

Ao citar uma decisão, use o número (`DECISOES.md` #86); os três documentos se referenciam assim.

## Comandos

```bash
npm test                # a suíte inteira (~141 s) — dois projetos, ver #120
npm run test:rapido     # só a lógica pura, sem jsdom (~40 s) — o do dia a dia
npx vitest run <padrão> # um arquivo só
npm run build           # tsc -b && vite build
npm run lint            # eslint .
npm run dev             # servidor de desenvolvimento
npm run preview         # build servido, para conferência no navegador
npm run pose:preset     # converte pose salva da biblioteca em bloco de preset
npm run poses:folha     # folha de contato das poses
npm run pose:model      # baixa (uma vez) o modelo do MediaPipe para tools/models/
npm run pose:from-image # foto → arquivo(s) de pose do app (retargeting em src/pose-import/)
npm run test:e2e        # Playwright, à parte da suíte: smoke do módulo de poses (item 57),
                        # largura dos painéis (#126 — layout só existe em navegador) e
                        # "a edição aparece na tela" após navegar (#134 — é pergunta de pixel)
```

**Antes de dar qualquer trabalho por concluído:** `npm test`, `npm run build` e `npm run lint`, os três limpos. A suíte está em **~2.931 testes**; toda entrega registra o saldo (de X para Y).

## Regras que não se negociam

- **Zero rede em runtime.** Nenhuma fonte, textura, ícone ou dado vem por download. Imagem ou dado externo só entra por arquivo local que o usuário escolhe.
- **Sem assets externos para geometria.** Boneco e objetos de cena são gerados em código a partir de primitivas 3D. Sem `.glb`, `.fbx` ou biblioteca de terceiros para a malha.
- **TDD.** Teste que falha primeiro, implementação mínima, verde. Vale para tudo, inclusive UI de painel.
- **Nenhuma string de UI hardcoded.** Toda string nasce como chave de i18n em `src/i18n/locales/pt-BR.json` **e** `en.json` — há teste automatizado de paridade de chaves entre os dois. pt-BR é o padrão.
- **Documentação e comentários em português.** É a língua do projeto.
- **Arrasto de gizmo não é testável por unit test.** Quando a entrega depende disso, registre "falta a conferência visual no navegador" — o usuário confere. (Playwright alcança o arrasto; ver `DECISOES.md` #31.5.)

## Mapa do código

```
src/figure/       modelo do boneco: skeleton.ts (32 juntas), poses, IK/arrasto,
                  espelho, travas, figureFormat.ts (leitor único do boneco)
src/animation/    keyframes, amostrador, trechos prontos, remapeamento, MP4
src/props/        objetos de cena (6 primitivas + kit de armas, tamanho em metros,
                  vértice livre, amarração a junta em propAttachment.ts)
src/scene/        viewport, câmera, gizmos, renderização
src/layout/       os painéis da UI (é onde mora quase toda a superfície visível)
src/poses/        módulo de poses: a casca de toque (item 44) — escolha de casca,
                  vistas ortográficas, painel em abas, sessão própria (#92)
src/store/        zustand — figuresStore (com zundo/undo), animation, camera, ui…
src/persistence/  arquivos do workspace, autosave, serialização
src/pose-import/  landmarks/marcas → boneco: retarget (#109), marcação manual (#111)
src/i18n/         dicionários pt-BR e en
```

## Invariantes conquistadas a duras penas

Coisas que parecem detalhe e custaram uma decisão inteira. Quebrá-las por descuido desfaz trabalho já feito:

- **Um leitor só de boneco:** `src/figure/figureFormat.ts` (#86). Antes eram quatro, com cópias divergentes de sanitização. Não escreva parser novo de boneco — use este. Tudo grava `{x,y,z}`, nunca tupla (a leitura de tupla permanece, só para compatibilidade).
- **Cena é JSON, não glTF** (#85). `GLTFExporter`/`GLTFLoader` foram removidos; a pasta do workspace é inteiramente `.json` e tem **nomes reservados** (`poses.json`, `joint-limits.json`, `animations.json`, `clips.json`) — uma cena não pode gerar arquivo com esses nomes.
- **Um caminho só para boneco em arquivo** (#87): "Pose em arquivo", no painel de Propriedades. O "Exportar/Importar boneco" do painel de Bonecos foi removido de propósito.
- **`CollapsibleSection` ≠ `CollapsiblePanel`** (#83). O primeiro recolhe um *assunto dentro* de um painel; o segundo recolhe a *coluna inteira*. Seção nova exige chave em `SECTION_KEYS` (`src/persistence/uiPreferences.ts`), e nasce recolhida — as exceções são `poses` e `cameraFraming`.
- **Botões seguem duas classes** (#88): `.panel-action` para ação sozinha (largura cheia) e `.panel-actions` para conjunto entre o qual se escolhe (grade de duas colunas). A escolha descreve o conteúdo, não a aparência.
- **Ação que depende de decisão do usuário confirma em MODAL** (#100): `ConfirmDialog`/`ModalDialog` de `src/layout/` (`<dialog>` nativo — Esc cancela, atalhos globais calados), nunca confirm inline em dois passos nem `window.confirm`. Precedentes: regravar keyframe (#69), remover keyframe, copiar do keyframe vizinho (#136, #137) e a pose média dos vizinhos (#137), novo workspace e trazer sessão da outra casca. **Onde já existe diálogo de escolha, ele É a confirmação** (#137): o de caixas de "quem recebe a cópia" não ganha um `ConfirmDialog` na frente — duas telas para uma ação ensinam a clicar sem ler. O botão que abre fica sempre visível; o modal é renderizado condicionalmente ao lado dele.
- **Um gesto é UM passo de undo** (#118). Todo controle contínuo — gizmo, arrasto do módulo de poses, slider — abre um lote com `beginUndoBatch` no `pointerdown` e o fecha com `endUndoBatch` no `pointerup` (`src/store/undoBatch.ts`); o histórico guarda o estado de quando o botão foi solto. Controle contínuo novo tem de fazer o mesmo, ou volta a empilhar um passo por pixel. O recorte do histórico é `undoPartialize`/`undoEquality`/`UNDO_LIMIT`, exportados do `figuresStore` — o lote e o `zundo` usam os mesmos.
- **Marca de foto só informa o que a projeção move** (#119). A marca do tronco é a **base do tórax** (junta `chest`), não a cintura: a junta `spine` é filha direta da raiz e rotação de tronco nenhuma a move — marcar ali daria zero. E um ponto SOBRE o eixo do tronco diz inclinação, jamais torção (girar em torno do eixo não move quem está nele) — a torção vem da linha dos ombros (#115). Mesma lógica na raiz: sem profundidade nos quadris, a correção gira só em torno do eixo de visão, porque o giro em profundidade a foto não mostra.
- **A suíte tem dois projetos** (#120): `unidade` (node, todos os `*.test.ts`) e `interface` (jsdom, os `*.test.tsx` mais oito `.test.ts` nominais que usam `localStorage`/`document`). A regra é a EXTENSÃO — teste novo de lógica nasce `.ts` e cai no rápido sozinho. `setup-comum.ts` vale para os dois; `setup.ts` é só do jsdom.
- **Módulo puro e componente NUNCA diferem só na caixa** (#122). O Windows tem sistema de arquivos insensível a caixa e o Vite tenta `.ts` antes de `.tsx`: `gestureLines.ts` + `GestureLines.tsx` faz o import do componente resolver para o módulo puro, e o erro sai como "Element type is invalid" de dentro do react-three-fiber. Os pares do projeto são `frameMask.ts`/`FrameMaskOverlay.tsx`, `depthMap.ts`/`DepthPreview.tsx`, `gestureLines.ts`/`GestureLinesOverlay.tsx`.
- **`fieldset` em painel precisa de `min-inline-size: 0`** (#125). Todo `<fieldset>` nasce com `min-inline-size: min-content` por folha do navegador, e o mínimo de uma linha com slider é a largura INTRÍNSECA do `<input type=range>` (129 px no Chrome) — o `min-width: 0` do slider não cobre isso, porque só age depois que a largura do contêiner está resolvida. Sem a regra, o painel ganha barra de rolagem horizontal (o `overflow-y: auto` de `.panel` faz o `overflow-x` deixar de ser `visible`). Vale para grupo novo em painel estreito. **Largura se confere no Playwright** (`e2e/paineis-largura.spec.ts`, #126), nunca no jsdom, que não calcula layout nenhum.
- **Callback de `ref` de junta é ESTÁVEL, sempre** (#132). O React reexecuta um `ref` quando a IDENTIDADE da função muda — o anterior com `null`, o novo com o objeto. O `onJointRef` vira o `ref` das 32 juntas de cada boneco e cada registro é um `setState` no `Viewport`, que re-renderiza os bonecos: uma seta inline em qualquer elo da corrente (`Viewport` → `SceneFigures` → `Figure` → `JointNode`) fecha um laço de re-render, e foi o estouro de memória de andar quadro a quadro. Daí o componente `SceneFigure`, que existe só para ter um `useCallback` por boneco. Os testes de `Figure`/`SceneFigures` contam registros e falham se a contagem crescer com uma pose nova.
- **Geometria criada em `useMemo` precisa de `dispose()` no `useEffect`** (#132). É recurso de GPU: o coletor de lixo não a devolve, e nenhuma medição de heap JS a enxerga. Precedentes: `SceneProps.tsx` e `GestureLinesOverlay.tsx`.
- **Navegar pela linha do tempo é procurar ou parar** (#133, #134). `preview` é desenhado NO LUGAR da bancada pelo `SceneFigures` — com ele na tela, editar acontece invisível por trás, e o app parece travado. Só **arrastar a régua**, a reprodução e a exportação podem tê-lo. Todo o resto (setas de quadro, ⏮/⏭, soltar a régua, pausar, inserir keyframe) leva o instante para a bancada por `goToFrameWithStash`: guarda do #127, **fora do undo** (`withoutUndo` — são cliques às dezenas, e um passo por clique estouraria o `UNDO_LIMIT` com navegação) e marca do item 40 só em cima de keyframe. A rede que fecha o assunto é o `previewGuard.ts`: **mexeu na cena de trabalho, a pré-visualização sai da frente**. Controle de navegação novo herda isso de graça — mas confira no `e2e/edicao-apos-navegar.spec.ts`, que é onde "a edição aparece na tela" se mede (jsdom só alcança o `preview` nulo).
- **Junta travada não muda por NADA automático** (#42): slider, gizmo, teclado, IK, sorteio, espelho e aplicar pose — todos respeitam a trava.
- **Tamanho de objeto de cena é metro por eixo, nunca `scale` de nó** (#80). A contagem de pontos de controle soldados por forma é **contrato de arquivo**, travada por teste.
- **O `package-lock.json` é gerado no Linux, nunca no Windows** (#103.1). `@napi-rs/wasm-runtime` declara peers que o npm no Windows não hoista, e o `npm ci` do GitHub Actions recusa o lock — sem nenhum aviso local, porque `npm install` é tolerante. Sempre que o lock mudar: `docker run --rm -v "$PWD:/app" -w /app node:24 npm install --package-lock-only`, e confira que as entradas `binding-win32` continuam lá.
- **Todo arquivo EXPORTADO leva `_AAAA-MM-DD-HHmm`** (#135), em hora local, como último sufixo antes da extensão — `withExportTimestamp` de `src/persistence/exportTimestamp.ts`. Vale para as sete saídas (cena, pose de boneco, animação nas duas cascas, bookmarks, PNG, MP4); saída nova usa a mesma função. A pasta do workspace NÃO carimba: os nomes reservados (#85) precisam ser reencontrados ao reabrir. O `_snapNNN` do instantâneo continua — a data diz quando, o contador diz qual veio antes dentro do mesmo minuto.
- **Persistência é aditiva.** Campo novo em `SceneExtras` entra sem subir `SCENE_EXTRAS_VERSION` — arquivo antigo tem de continuar abrindo (precedentes: `sceneCamera`, `snapshotCounter`, `props`).
- **Estado de ferramenta fica fora do undo e fora do arquivo:** travas, papel-cebola, casca do boneco, régua, máscara de enquadramento, preferências de painel, mapa de profundidade.
- **Mapa de profundidade: três escolhas independentes** (#91) — tela, PNG e MP4. Uma saída normal **força** o normal (`suspendDepthMaterial`), mesmo com a tela em profundidade. O material original de cada objeto fica em marcas de `userData`, e não numa closure: é o que permite a um passe desfazer o que outro fez. E o fundo tem **um dono só**: na tela é o `Viewport`, por React; nos arquivos é o passe. Dois donos deixam a vista presa no preto ao desligar o modo.

## Como o usuário quer trabalhar

1. **Perguntar antes de implementar.** Levante as decisões de desenho em aberto e as inconsistências e pergunte — ele responde rápido, e prefere decidir antes a refazer depois. Avaliação antes de código é pedido recorrente ("avalie o custo, depois eu decido").
2. **Implementar por TDD**, rodando os três comandos no fim.
3. **Documentar ao terminar**, sempre nos dois lugares:
   - `DECISOES.md` — uma entrada `## N. Título`, narrativa do porquê, no tom das anteriores;
   - `HISTORICO.md` — um bloco `### Título ✅ (concluído em AAAA-MM-DD)` com bullets do que mudou, o saldo de testes e o status de `tsc -b`, `eslint .` e `npm run build`.
   - Se a entrega fechou um item da lista do `PLANO.md`, marque-o ✅ lá **sem renumerar nada** — os números são citados em dezenas de lugares e nunca são reaproveitados.
