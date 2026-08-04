# WebPoser — guia para o agente

App frontend 3D **totalmente offline** para posar manequins de desenhista (bonecos articulados de 32 juntas), montar cenas, animar entre poses-chave e exportar PNG/MP4 de referência para desenho.

Este arquivo é a porta de entrada. O detalhe mora em três documentos, e **todos os três são registro canônico do projeto**:

| Arquivo | O que é |
|---|---|
| `PLANO.md` | O que o app é, arquitetura, modelo do boneco e **a lista única de propostas de melhoria** (itens numerados 1–65, grupos A–J) |
| `DECISOES.md` | As **129 decisões** numeradas (de #1 a #119, com subnúmeros), com a narrativa do porquê. É onde se descobre *por que* algo é como é. Tem índice no topo |
| `HISTORICO.md` | O log de **106 entregas**, em ordem cronológica — uma entrada por sessão de trabalho. Tem índice no topo |

Ao citar uma decisão, use o número (`DECISOES.md` #86); os três documentos se referenciam assim.

## Comandos

```bash
npx vitest run          # a suíte — NÃO existe script `npm test`
npx vitest run <padrão> # um arquivo só
npm run build           # tsc -b && vite build
npm run lint            # eslint .
npm run dev             # servidor de desenvolvimento
npm run preview         # build servido, para conferência no navegador
npm run pose:preset     # converte pose salva da biblioteca em bloco de preset
npm run poses:folha     # folha de contato das poses
npm run pose:model      # baixa (uma vez) o modelo do MediaPipe para tools/models/
npm run pose:from-image # foto → arquivo(s) de pose do app (retargeting em src/pose-import/)
npm run test:e2e        # smoke de Playwright do módulo de poses (item 57) — à parte da suíte
```

**Antes de dar qualquer trabalho por concluído:** `npx vitest run`, `npm run build` e `npm run lint`, os três limpos. A suíte está em **~2.690 testes**; toda entrega registra o saldo (de X para Y).

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
- **Ação que depende de decisão do usuário confirma em MODAL** (#100): `ConfirmDialog`/`ModalDialog` de `src/layout/` (`<dialog>` nativo — Esc cancela, atalhos globais calados), nunca confirm inline em dois passos nem `window.confirm`. Precedentes: regravar keyframe (#69), novo workspace e trazer sessão da outra casca. O botão que abre fica sempre visível; o modal é renderizado condicionalmente ao lado dele.
- **Um gesto é UM passo de undo** (#118). Todo controle contínuo — gizmo, arrasto do módulo de poses, slider — abre um lote com `beginUndoBatch` no `pointerdown` e o fecha com `endUndoBatch` no `pointerup` (`src/store/undoBatch.ts`); o histórico guarda o estado de quando o botão foi solto. Controle contínuo novo tem de fazer o mesmo, ou volta a empilhar um passo por pixel. O recorte do histórico é `undoPartialize`/`undoEquality`/`UNDO_LIMIT`, exportados do `figuresStore` — o lote e o `zundo` usam os mesmos.
- **Marca de foto só informa o que a projeção move** (#119). A marca do tronco é a **base do tórax** (junta `chest`), não a cintura: a junta `spine` é filha direta da raiz e rotação de tronco nenhuma a move — marcar ali daria zero. E um ponto SOBRE o eixo do tronco diz inclinação, jamais torção (girar em torno do eixo não move quem está nele) — a torção vem da linha dos ombros (#115). Mesma lógica na raiz: sem profundidade nos quadris, a correção gira só em torno do eixo de visão, porque o giro em profundidade a foto não mostra.
- **Junta travada não muda por NADA automático** (#42): slider, gizmo, teclado, IK, sorteio, espelho e aplicar pose — todos respeitam a trava.
- **Tamanho de objeto de cena é metro por eixo, nunca `scale` de nó** (#80). A contagem de pontos de controle soldados por forma é **contrato de arquivo**, travada por teste.
- **O `package-lock.json` é gerado no Linux, nunca no Windows** (#103.1). `@napi-rs/wasm-runtime` declara peers que o npm no Windows não hoista, e o `npm ci` do GitHub Actions recusa o lock — sem nenhum aviso local, porque `npm install` é tolerante. Sempre que o lock mudar: `docker run --rm -v "$PWD:/app" -w /app node:24 npm install --package-lock-only`, e confira que as entradas `binding-win32` continuam lá.
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
