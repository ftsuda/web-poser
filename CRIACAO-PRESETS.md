# Criação e validação de presets — poses e trechos de animação

Processo consolidado a partir do que foi aprendido montando os catálogos
atuais: 71 poses (`src/figure/posePresets.ts`, DECISOES.md #35–#38, #40, #57)
e 14 trechos de animação (`src/animation/animationClips.ts`, DECISOES.md #60).

Os dois catálogos seguem os mesmos princípios:

1. **Declarar o mínimo.** Pose é parcial (só o que sai do neutro); trecho é
   pose de fábrica + desvios. O que não é declarado vem do neutro — e o neutro
   nem sempre é zero (torção do cotovelo, ver adiante).
2. **Nenhum número estimado.** Altura, distância e ângulo de contato saem de
   medição ou busca numérica contra a cinemática direta, nunca de chute. O
   comentário do preset registra o alvo, o método e o erro medido.
3. **Tudo travado por teste.** Geometria resolvida vira asserção — se alguém
   mexer na pose, o teste acusa em milímetros.

---

## Parte 1 — Nova pose de fábrica

### 1.1 Arquivos a CONSULTAR (não mudam ao criar uma pose)

| Arquivo | O que buscar nele |
| --- | --- |
| `src/figure/skeleton.ts` | A fonte única do esqueleto: as 32 juntas, os offsets e os **limites por eixo** (ângulo fora da faixa é grampeado em silêncio — conferir a faixa ANTES de declarar). O docblock do topo documenta as convenções de sinal. |
| `src/figure/posePresets.ts` (docblock + poses vizinhas) | As convenções na prática: sinal do X (tronco flexiona com **positivo**, membros com **negativo**; `knee`/`ball` invertidos; `ankle` positivo = flexão plantar), o helper `symmetric()`, `NEUTRAL_ELBOW_TWIST` (`elbow.L.y=90` / `elbow.R.y=−90` é o neutro — "zerar" o Y deixa a palma para trás), e o formato dos comentários (alvo + método + erro). Uma pose parecida com a nova é o melhor molde. |
| `src/figure/poseMirror.ts` | A **referência invertida L/R** (#14): o mesmo valor em Y/Z faz o movimento anatômico oposto nos dois lados; o espelho sagital exato é `(x, −y, −z)`. Pose simétrica → usar `symmetric()`; assimétrica → declarar os dois lados à mão com sinais opostos em Y/Z. |
| `src/figure/handPresets.ts` | As chaves de pose de mão (`fist`, `relaxed`, `point`...). Nunca declarar dedos junta a junta num preset de corpo — usar `hands:`. Regra do catálogo de luta: fecha a mão quem golpeia ou agarra; quem leva fica relaxado. |
| `src/figure/poseGround.ts` | `seatedHipHeightM(pose, rotation)` dá o `hipHeightM` que assenta a pose; `lowestJointY` mede afundamento/flutuação. A referência de "no chão" é **0,010 m** (folga da pose neutra), não zero. |
| `src/figure/jointFrames.ts` | `buildJointFrames(figure)` monta a cinemática direta — é com ele que se mede posição de junta no mundo nos scripts de busca numérica. |
| `src/figure/posePairs.ts` | Se a pose for de dupla: o formato de `POSE_PAIRINGS` (`counterpart`, `gapM` medido ao longo do Z de quem recebe, `facing`) e a convenção "de frente" (ponto `(x,y,z)` de um cai em `(−x, y, D−z)` no outro). |
| `src/figure/__tests__/posePresets.test.ts` | Como as poses existentes travam geometria (lista `GROUNDED`, alvos de contato, plano da palma) — a asserção nova segue o mesmo padrão. |
| `DECISOES.md` #13, #14, #25, #30, #35–#38, #61 | O porquê de cada convenção e os erros já cometidos (para não repeti-los). |

### 1.2 Como criar

**Caminho A (preferido): posar no app e colher o código** (#57)

1. Posar o boneco no app (sliders, gizmo, IK, espelho ao vivo, "Apoiar no
   chão") e salvar na **biblioteca de poses** com nome descritivo.
2. Exportar o workspace — a biblioteca vira `poses.json`.
3. Rodar `npm run pose:preset -- caminho/poses.json --pose="Nome" --key=chaveNova`.
4. Colar o bloco impresso em `POSE_PRESETS` e seguir os passos manuais que o
   gerador lista. Ele já resolve preset parcial, torção neutra, `hands:`,
   `hipHeightM` e o `rotation`/`preservesHeading`; e **avisa** pose flutuando,
   atravessando o chão ou mão sem preset. A ida e volta é travada por teste
   (`poseCodegen.test.ts`) sobre o catálogo inteiro.

**Caminho B: declarar à mão** (poses com alvo geométrico, ex.: "punho na
altura do rosto do outro")

1. Declarar o alvo em metros no mundo.
2. Medir e ajustar por **varredura numérica**: passos de 5° nos eixos
   relevantes, refino de 1° em volta do melhor (ver 1.4 para o script).
3. Se o resultado bate o alvo mas fica errado de olhar, **o alvo estava
   incompleto** — acrescentar penalidades explícitas, não retocar na mão
   (clinche #37 e guarda #61: "cotovelo ≥ 18 cm abaixo do punho e ≤ 26 cm da
   linha média"). Punho no alvo ≠ braço certo.
4. A ordem importa: **assentar a altura ANTES de resolver alcance** — no
   `beingPulledUp` (#37), resolver o braço antes de baixar o boneco deixou a
   mão 49 cm fora do alvo.
5. Colocação: `hipHeightM` calculado com `seatedHipHeightM`, nunca a olho;
   `rotation` **só** quando a pose inclina o boneco (declará-la faz a pose
   impor a direção — `preservesHeading = false`). Deitado de costas é
   `rotation: { x: -90 }`; orientações compostas (deitado atravessado) saem de
   montar a base ortonormal e extrair o Euler, nunca de somar graus.

### 1.3 Arquivos a ALTERAR (checklist)

| Arquivo | Onde exatamente | O quê |
| --- | --- | --- |
| `src/figure/posePresets.ts` | Tipo `PosePresetKey` | Acrescentar a chave nova (camelCase). |
| | Tabela `POSE_PRESETS` | O bloco da pose, com comentário registrando alvo, método e erro medido, e as limitações assumidas do modelo (ex.: "o quadril só abduz 45°"). |
| | Tabela `POSE_PRESET_GROUPS` | A chave no grupo certo (é a ordem do combo). Teste trava os dois sentidos: pose sem grupo não passa. |
| `src/i18n/locales/pt-BR.json` **e** `en.json` | `panels.properties` | `posePreset<Key>` (rótulo) e `posePreset<Key>Hint` (dica). Pose em par: a dica diz a distância e com quem encaixa. Sempre nos **dois** idiomas — o teste de locales compara as árvores. |
| `src/layout/PropertiesPanel.tsx` | Mapas `POSE_PRESET_LABEL_KEYS` / `POSE_PRESET_HINT_KEYS` | A entrada da chave nova. O de rótulos é `Record` completo (esquecer não compila); o de dicas é `Partial` — a dica é opcional, mas o padrão do catálogo é ter. |
| `src/figure/posePairs.ts` (só pose de dupla) | Tabela `POSE_PAIRINGS` | `counterpart`, `gapM` **medido** (o encontro dos pontos de contato) e `facing`. As DUAS metades (a pose e a contraparte apontando de volta) — teste de consistência mútua trava. |
| `src/figure/__tests__/posePresets.test.ts` | Bloco da pose / lista `GROUNDED` | A asserção que trava a geometria resolvida; pose plantada entra em `GROUNDED`. |
| `DECISOES.md` | Final do arquivo | Entrada numerada nova (ver 3.2). |
| `PLANO.md` | Seção de progresso | Só se a pose fizer parte de um item planejado. |

### 1.4 Arquivos a CRIAR

- **Script de medição/varredura** — descartável, no diretório temporário da
  sessão (nunca no repositório; o repo só recebe ferramenta reutilizável em
  `tools/` + entrada em `scripts` do `package.json`, como
  `pose-para-preset.mjs`). O esqueleto usa o loader do Vite para importar o
  TypeScript do projeto sem build nem dependência nova:

  ```js
  import { createServer } from 'vite'
  const server = await createServer({
    configFile: false, root: process.cwd(), appType: 'custom',
    logLevel: 'error', server: { middlewareMode: true },
  })
  const { resolvePosePreset } = await server.ssrLoadModule('/src/figure/posePresets.ts')
  const { buildJointFrames } = await server.ssrLoadModule('/src/figure/jointFrames.ts')
  const { clampJointRotation } = await server.ssrLoadModule('/src/figure/skeleton.ts')
  // montar a pose candidata (sempre via clampJointRotation), medir
  // getWorldPosition das juntas de interesse, varrer, imprimir os melhores.
  await server.close()
  ```

  Rodar de dentro da raiz do projeto (`node script.mjs`); se o script morar
  fora dela, importar o Vite pelo caminho absoluto de `node_modules`.

- **Sonda Playwright** — também descartável e fora do repo. O Playwright é
  deliberadamente **não-dependência** do projeto (instalado à parte, ver
  `tools/folha-de-contato.mjs --playwright=`).

### 1.5 Validação (nesta ordem)

1. `npx vitest run src/figure` — geometria nova + ida e volta do codegen.
2. **Folha de contato**: `npm run poses:folha` — a pose nas duas vistas
   (padrão e girada 40°). É aqui que "bateu o alvo mas parece errado" aparece.
3. Navegador real: `npm run build && npm run preview`, sonda Playwright
   aplicando a pose pelo combo (`#pose-preset-select` + "Aplicar pose"),
   captura de frente e de lado, **zero erros de console**.
4. `npx tsc -b`, `npx eslint .`, `npm run build`, suíte completa.

---

## Parte 2 — Novo trecho de animação (keyframes predefinidos)

### 2.1 Arquivos a CONSULTAR

| Arquivo | O que buscar nele |
| --- | --- |
| `src/animation/animationClips.ts` (docblock + trechos vizinhos) | O modelo inteiro: `ClipFigureSpec` (campos abaixo), o referencial (papel A na origem olhando +Z), os helpers `gaitSteps`/`rotatedPair` e os overrides nomeados como molde. |
| `src/figure/posePresets.ts` + `src/figure/posePairs.ts` | Quais poses de fábrica servem de base a cada passo, e as **distâncias medidas** dos pares — o instante de contato de um golpe/carga usa o par pronto, nunca uma distância nova. |
| `src/figure/poseGround.ts` | O assentamento (`seat: true` chama `seatOnGround` por baixo) — fases novas de contato nunca usam altura chutada. |
| `src/figure/poseMirror.ts` | O espelho da passada oposta (`mirror: true` espelha a pose inteira). |
| `src/figure/poseBlend.ts` (`lerpAngle`) | A rotação do boneco interpola pelo **menor arco** — giros grandes precisam andar em passos < 180° por keyframe. |
| `src/animation/animation.ts` | O contrato do keyframe: a duração é da transição que **chega** ao passo; a do 1º é ignorada com a linha do tempo vazia. |
| `src/animation/__tests__/animationClips.test.ts` | O que os testes já cobrem sozinhos e as duas tabelas a atualizar (`NO_AR` e encaixes). |
| `DECISOES.md` #60 | As decisões de produto do mecanismo (entra no final da linha do tempo, papéis por combos, câmera congelada, deslocamento no espaço). |

Campos de `ClipFigureSpec` (um por papel, por passo):

| Campo | Uso |
| --- | --- |
| `preset` | Pose de fábrica que serve de base ao passo |
| `overrides` | Desvios parciais por junta, por cima da base |
| `mirror` | Espelho sagital da pose inteira (passada oposta) |
| `at` | Posição `[x, z]` no referencial do trecho |
| `turnDeg` | Giro no chão, composto com a rotação da pose |
| `rotation` | Rotação imposta no lugar da do preset (fases de tombar/rolar) |
| `hipHeightM` | Altura explícita (no ar / empilhado no outro) — vence tudo |
| `seat` | Assentamento numérico pelo `poseGround` |
| `liftM` | Folga acima do assentamento (fases aéreas) — só com `seat` |

### 2.2 Como criar (regras de ouro)

1. **Roteirizar em passos** (5 a 15 — faixa travada por teste): quais são os
   keyframes PRINCIPAIS? Interpolação atravessando o próprio corpo ou o do
   outro é aceitável (decidido com o usuário) — não criar passo só para
   desviar de colisão.
2. **Contato = pose em par na distância medida.** `b.at[1] − a.at[1] = gapM`
   do `POSE_PAIRINGS` no passo do encaixe.
3. **Fases novas usam `seat: true`.** Fica no ar de propósito quem tem
   `hipHeightM` explícito ou `liftM` — e entra na lista `NO_AR` do teste.
4. **Passada oposta = `mirror: true`.** Exceção deliberada: quem CARREGA
   alguém espelha só as PERNAS, declaradas nos dois lados à mão — espelhar o
   corpo inteiro trocaria os braços de lado e desfaria a pegada.
5. **Ciclo emendável**: andar/correr/dança terminam NA pose do primeiro passo
   (adicionar o trecho duas vezes emenda sem solavanco — travado por teste).
6. **Giros grandes em passos < 180°**, sempre no mesmo sentido (60°/keyframe
   no "empurrar e girar" e na dança; 360° embrulha para 0 sozinho).
7. **Durações**: golpe rápido 200–350 ms; aproximação/carga 400–600 ms.
8. Overrides viram **constantes nomeadas** com comentário do que representam
   (`JUMP_CROUCH`, `CHOKE_STAND_SAG_B`...), nunca objetos anônimos no meio dos
   passos.

Lembrete de anatomia que já causou erro (#60): sentado com a perna horizontal
(`hip.x = −90`), ERGUER a perna é flexionar MAIS (−105); −75 baixa a perna
para dentro do chão.

### 2.3 Arquivos a ALTERAR (checklist)

| Arquivo | Onde exatamente | O quê |
| --- | --- | --- |
| `src/animation/animationClips.ts` | Tipo `AnimationClipKey` | A chave nova. |
| | Lista `ANIMATION_CLIP_KEYS` | A chave na posição desejada (é a ordem do combo do painel, individuais antes das duplas). |
| | Tabela `ANIMATION_CLIPS` | O trecho: `kind: 'solo' \| 'duo'` e os passos. Dupla tem `b` em **todos** os passos; solo em nenhum (travado por teste). |
| `src/i18n/locales/pt-BR.json` **e** `en.json` | `panels.animation` | `clip<Key>` (rótulo) e `clipHint<Key>` (a dica diz o que A e B fazem). |
| `src/layout/AnimationPanel.tsx` | Mapa `CLIP_LABEL_KEYS` | A entrada nova (mapa tipado por `AnimationClipKey`: esquecer não compila). |
| `src/animation/__tests__/animationClips.test.ts` | Lista `NO_AR` | Os passos aéreos de propósito do trecho novo (`'k4 a'`, `'k5 b'`...). |
| | Tabela de encaixes (`it.each`) | Se houver contato de dupla: `[chave, índice do passo, presetA, presetB, gapM]`. |
| `DECISOES.md` | Final do arquivo | Entrada numerada nova (ver 3.2). |
| `PLANO.md` | Seção de progresso | Se fizer parte de um item planejado. |

**O que NÃO muda** para um trecho novo: `figuresStore.appendAnimationClip`, o
comando do `animationStore`, o `AnimationPlayer` e o restante do painel — o
mecanismo é genérico; um trecho novo é só dados + i18n + testes.

### 2.4 Arquivos a CRIAR

- **Script de medição de chão** (descartável, fora do repo — mesma regra e
  mesmo loader da Parte 1). Rodar sobre TODOS os passos ANTES de escrever
  asserção — foi o que pegou o carregador do cavalinho afundando 5,4 cm e a
  perna do mata-leão sentado atravessando 34 cm (#60):

  ```js
  const { ANIMATION_CLIPS, resolveClipFigure } = await server.ssrLoadModule('/src/animation/animationClips.ts')
  const { lowestJointY } = await server.ssrLoadModule('/src/figure/poseGround.ts')
  // para cada passo/papel:
  const r = resolveClipFigure(spec, 0)
  const maisBaixo = lowestJointY(r.pose, r.rotation) + r.groundOffsetM
  // ~0,010 = contato perfeito; < −0,02 afunda; > 0,12 está no ar
  ```

  Quando um passo afunda/flutua sem intenção, corrigir os ângulos por
  varredura numérica (alvo: o assentamento do preset base), não a olho.

- **Sonda Playwright** (descartável, fora do repo) cobrindo, no mínimo:
  contagem de keyframes após adicionar, "Ir para" nos passos-chave +
  screenshot do canvas, reprodução da linha do tempo, **um** Ctrl+Z removendo
  o trecho inteiro, zero erros de console. Controles: `#animation-clip`,
  `#animation-clip-role-a`, `#animation-clip-role-b`, botão "Adicionar ao
  final da linha do tempo". Atenção ao painel de animação, que **nasce
  recolhido** ("Expandir painel Animação") — e à lição do #59: sonda que não
  acha um controle novo pode estar olhando uma **build velha** (a sonda roda
  sobre `npm run preview`, que serve a última build).

### 2.5 Validação (nesta ordem)

1. Medição de chão de todos os passos (2.4).
2. `npx vitest run src/animation src/store src/layout src/i18n`.
3. Navegador real (sonda de 2.4) sobre `npm run build && npm run preview`.
4. `npx tsc -b`, `npx eslint .`, `npm run build`, suíte completa.

---

## Parte 3 — Regras comuns de registro

### 3.1 Idioma e comentários

- Rótulos e dicas **sempre nos dois idiomas** (`pt-BR.json` e `en.json`) — o
  teste de locales compara as árvores de chaves.
- Comentários de código e documentação em **pt-BR**, registrando alvo, método
  e erro medido (o comentário é o registro permanente da busca numérica; o
  script descartável morre com a sessão).

### 3.2 DECISOES.md — como registrar

Entrada numerada no final do arquivo, com:

- o pedido do usuário e a data;
- as decisões tomadas (e as alternativas descartadas, com o motivo medido);
- os **números**: alvos, erros em cm/mm, o que a medição pegou antes dos
  testes;
- seção "Verificação": quantos testes novos, o total da suíte,
  `tsc`/`eslint`/`build`, e o que a sonda de navegador conferiu (sempre com
  "sem erro de console").

### 3.3 Critério de pronto (os dois catálogos)

- [ ] Números resolvidos/medidos, nunca estimados — registrados em comentário.
- [ ] Testes novos travando a geometria; suíte **completa** verde.
- [ ] `npx tsc -b`, `npx eslint .` e `npm run build` limpos.
- [ ] Validação em navegador real sobre a build nova, sem erro de console.
- [ ] i18n nos dois idiomas; mapas tipados do painel atualizados.
- [ ] `DECISOES.md` atualizado (e `PLANO.md`, se for item planejado).

---

## Referências

- `DECISOES.md` #13/#14 (convenções de sinal e referência invertida L/R), #25
  (mão alinhada e torção neutra), #30 (colocação e espelho sagital), #35–#38 e
  #40 (o método das poses resolvidas numericamente), #57 (assentamento,
  codegen e folha de contato), #59 (lição da sonda vs build velha), #60
  (trechos de animação), #61 (penalidades explícitas > retoque manual).
- Ferramentas do repo: `npm run pose:preset` (`tools/pose-para-preset.mjs`),
  `npm run poses:folha` (`tools/folha-de-contato.mjs`).
