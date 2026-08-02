# WebPoser — histórico de entregas

As **91 entregas** do projeto, uma por sessão de trabalho, em ordem cronológica de conclusão — de 2026-07-22 a 2026-08-02.

Saiu do `PLANO.md` em 2026-07-31, onde crescia em quatro blocos separados, dois deles no meio da lista de propostas. **O conteúdo das entradas não foi alterado**: só a ordem (a data de conclusão do título) e o arquivo em que moram. O que o app é e o que falta fazer continua no `PLANO.md`; o porquê de cada escolha, no `DECISOES.md`.

Entrada nova entra no fim, no padrão `### Título ✅ (concluído em AAAA-MM-DD)`: bullets do que mudou, o saldo de testes e o status de `tsc -b`, `eslint .` e `npm run build`.

## Índice

- `2026-07-22` — [Fase 1 — Fundação](#fase-1--fundação--concluída-em-2026-07-22)
- `2026-07-22` — [Fase 2 — Boneco](#fase-2--boneco--concluída-em-2026-07-22)
- `2026-07-22` — [Adendo à Fase 2 — refinamento visual do boneco](#adendo-à-fase-2--refinamento-visual-do-boneco--concluído-em-2026-07-22-revisado-em-2026-07-22)
- `2026-07-22` — [Ajustes ao plano (sem código) — pedidos pelo usuário, aplicados antes da fase 3](#ajustes-ao-plano-sem-código--pedidos-pelo-usuário-aplicados-antes-da-fase-3)
- `2026-07-22` — [Segundo adendo à Fase 2 — pivô da cabeça e elipse de sombra no chão](#segundo-adendo-à-fase-2--pivô-da-cabeça-e-elipse-de-sombra-no-chão--concluído-em-2026-07-22)
- `2026-07-22` — [Fase 3 — Pose FK](#fase-3--pose-fk--concluída-em-2026-07-22)
- `2026-07-23` — [Correção pós-fase 3 — gizmo de translação "arrancava" o boneco do chão](#correção-pós-fase-3--gizmo-de-translação-arrancava-o-boneco-do-chão--corrigido-em-2026-07-23)
- `2026-07-23` — [Ajuste pós-fase 3 — translação livre em Y, sombra presa ao chão](#ajuste-pós-fase-3--translação-livre-em-y-sombra-presa-ao-chão--concluído-em-2026-07-23)
- `2026-07-23` — [Fase 4 — Câmera](#fase-4--câmera--concluída-em-2026-07-23)
- `2026-07-23` — [Correção pós-fase 4 — `sceneStore` incorporado ao histórico de undo](#correção-pós-fase-4--scenestore-incorporado-ao-histórico-de-undo--concluída-em-2026-07-23)
- `2026-07-23` — [Fase 5 — Keyframes](#fase-5--keyframes--concluída-em-2026-07-23)
- `2026-07-23` — [Fase 6 — Persistência e PWA](#fase-6--persistência-e-pwa--concluída-em-2026-07-23)
- `2026-07-23` — [Fase 7 — IK](#fase-7--ik--concluída-em-2026-07-23)
- `2026-07-23` — [Fase 8 — Polimento](#fase-8--polimento--concluída-em-2026-07-23)
- `2026-07-24` — [Ajuste de proporções e visual do boneco (revisita a fase 2)](#ajuste-de-proporções-e-visual-do-boneco-revisita-a-fase-2--concluído-em-2026-07-24)
- `2026-07-24` — [Segundo ajuste de modelo — junta `upperChest`, mãos com 3 falanges, polegar cilíndrico](#segundo-ajuste-de-modelo--junta-upperchest-mãos-com-3-falanges-polegar-cilíndrico--concluído-em-2026-07-24)
- `2026-07-24` — [Ferramentas de teste + 2 correções visuais](#ferramentas-de-teste--2-correções-visuais--concluído-em-2026-07-24)
- `2026-07-24` — [Correção do polegar na T-pose + remodelagem do tronco (imagem de referência)](#correção-do-polegar-na-t-pose--remodelagem-do-tronco-imagem-de-referência--concluído-em-2026-07-24)
- `2026-07-24` — [Novo modelo visual — "manequim de madeira" (`skeleton2.ts`/`Figure2.tsx`)](#novo-modelo-visual--manequim-de-madeira-skeleton2tsfigure2tsx--concluído-em-2026-07-24)
- `2026-07-24` — [Revisão das mãos — torção neutra do antebraço, bug real no lado R, marcador do dorso](#revisão-das-mãos--torção-neutra-do-antebraço-bug-real-no-lado-r-marcador-do-dorso--concluído-em-2026-07-24)
- `2026-07-24` — [Correção do braço direito — bug de quiralidade na verificação, não um limite real](#correção-do-braço-direito--bug-de-quiralidade-na-verificação-não-um-limite-real--concluído-em-2026-07-24)
- `2026-07-24` — [Palma exatamente paralela ao chão na T-pose — ajuste na modelagem](#palma-exatamente-paralela-ao-chão-na-t-pose--ajuste-na-modelagem--concluído-em-2026-07-24)
- `2026-07-24` — [Remodelagem completa da mão — alinhada aos eixos, torção neutra ±90°, proporções humanas](#remodelagem-completa-da-mão--alinhada-aos-eixos-torção-neutra-90-proporções-humanas--concluído-em-2026-07-24)
- `2026-07-24` — [Braços mais curtos, ombros mais próximos e chest mais baixo](#braços-mais-curtos-ombros-mais-próximos-e-chest-mais-baixo--concluído-em-2026-07-24)
- `2026-07-24` — [Revisão da ligação chest/upperChest → neck — pescoço engrossado](#revisão-da-ligação-chestupperchest--neck--pescoço-engrossado--concluído-em-2026-07-24)
- `2026-07-24` — [Verificação de cabeça e pernas — pernas re-ancoradas nos marcos](#verificação-de-cabeça-e-pernas--pernas-re-ancoradas-nos-marcos--concluído-em-2026-07-24)
- `2026-07-24` — [Workspace: limites articulares customizáveis (`joint-limits.json`)](#workspace-limites-articulares-customizáveis-joint-limitsjson--concluído-em-2026-07-24)
- `2026-07-24` — [Poses de mão, poses de corpo com colocação no chão e simetria E/D](#poses-de-mão-poses-de-corpo-com-colocação-no-chão-e-simetria-ed--concluído-em-2026-07-24)
- `2026-07-25` — [Poses de luta em par e pose aleatória](#poses-de-luta-em-par-e-pose-aleatória--concluído-em-2026-07-25)
- `2026-07-25` — [Catálogo de poses, 1ª entrega: apontar, apoios no chão e A-pose](#catálogo-de-poses-1ª-entrega-apontar-apoios-no-chão-e-a-pose--concluído-em-2026-07-25)
- `2026-07-25` — [Fase 9 — Refinamentos de UX e workspace](#fase-9--refinamentos-de-ux-e-workspace--planejada-em-2026-07-23-concluída-em-2026-07-25)
- `2026-07-26` — [Catálogo de poses, 2ª entrega: expressivas, ação e 13 poses em par](#catálogo-de-poses-2ª-entrega-expressivas-ação-e-13-poses-em-par--concluído-em-2026-07-26)
- `2026-07-26` — [Catálogo de poses, 3ª entrega: meditação, postura, "deitado em X" e mata-leão sentado](#catálogo-de-poses-3ª-entrega-meditação-postura-deitado-em-x-e-mata-leão-sentado--concluído-em-2026-07-26)
- `2026-07-26` — [Cor livre para os bonecos](#cor-livre-para-os-bonecos--concluído-em-2026-07-26)
- `2026-07-26` — [Mata-leão deitado e correção dos braços do "deitado em X"](#mata-leão-deitado-e-correção-dos-braços-do-deitado-em-x--concluído-em-2026-07-26)
- `2026-07-26` — [Poses em dupla aplicadas automaticamente no segundo boneco](#poses-em-dupla-aplicadas-automaticamente-no-segundo-boneco--concluído-em-2026-07-26)
- `2026-07-26` — [Biblioteca de poses do usuário e travamento de juntas](#biblioteca-de-poses-do-usuário-e-travamento-de-juntas--concluído-em-2026-07-26)
- `2026-07-26` — [Mistura entre duas poses](#mistura-entre-duas-poses--concluído-em-2026-07-26)
- `2026-07-26` — [Giro do cotovelo/joelho no IK](#giro-do-cotovelojoelho-no-ik--concluído-em-2026-07-26)
- `2026-07-27` — [Câmera de fotógrafo: lente em mm, enquadramento, ângulo e movimento](#câmera-de-fotógrafo-lente-em-mm-enquadramento-ângulo-e-movimento--concluído-em-2026-07-27)
- `2026-07-27` — [Dedo indicador separado, e a adução do polegar](#dedo-indicador-separado-e-a-adução-do-polegar--concluído-em-2026-07-27)
- `2026-07-27` — [Fase 10 — Mini animador](#fase-10--mini-animador--planejada-e-concluída-em-2026-07-27)
- `2026-07-27` — [Máscara de enquadramento e caixa da pose em dupla](#máscara-de-enquadramento-e-caixa-da-pose-em-dupla--concluído-em-2026-07-27)
- `2026-07-28` — [Fim da reprodução e keyframe intermediário](#fim-da-reprodução-e-keyframe-intermediário--concluído-em-2026-07-28)
- `2026-07-28` — [Correção do vídeo exportado, cópias de câmera e de pose, e novos padrões](#correção-do-vídeo-exportado-cópias-de-câmera-e-de-pose-e-novos-padrões--concluído-em-2026-07-28)
- `2026-07-28` — [Redutor/acelerador global da animação](#redutoracelerador-global-da-animação--concluído-em-2026-07-28)
- `2026-07-28` — [Ferramentas de criação de poses padrão](#ferramentas-de-criação-de-poses-padrão--concluído-em-2026-07-28)
- `2026-07-28` — [Apoiar no chão e espelho ao vivo](#apoiar-no-chão-e-espelho-ao-vivo--concluído-em-2026-07-28)
- `2026-07-28` — [Zerar por grupo e copiar só um membro](#zerar-por-grupo-e-copiar-só-um-membro--concluído-em-2026-07-28)
- `2026-07-28` — [Trechos de animação prontos (solo e em dupla)](#trechos-de-animação-prontos-solo-e-em-dupla--concluído-em-2026-07-28)
- `2026-07-28` — [Poses e trechos de dança pop (K-pop)](#poses-e-trechos-de-dança-pop-k-pop--concluído-em-2026-07-28)
- `2026-07-28` — [Joelhada na barriga com cambalhota](#joelhada-na-barriga-com-cambalhota--concluído-em-2026-07-28)
- `2026-07-29` — [Chave de braço sentada (empurrão/puxão)](#chave-de-braço-sentada-empurrãopuxão--concluído-em-2026-07-29)
- `2026-07-29` — [Nove itens de animação: bancada, régua no rodapé, grupos e biblioteca de trechos](#nove-itens-de-animação-bancada-régua-no-rodapé-grupos-e-biblioteca-de-trechos--concluído-em-2026-07-29)
- `2026-07-29` — [Rolagem horizontal nos painéis e a ordem de Animação e Instantâneos](#rolagem-horizontal-nos-painéis-e-a-ordem-de-animação-e-instantâneos--concluído-em-2026-07-29)
- `2026-07-29` — [Botões do card, captura fixa no topo e papel-cebola](#botões-do-card-captura-fixa-no-topo-e-papel-cebola--concluído-em-2026-07-29)
- `2026-07-29` — [Área de transferência de poses](#área-de-transferência-de-poses--concluído-em-2026-07-29)
- `2026-07-29` — [Confirmação ao regravar, "Inserir" na barra e o nome da animação junto da biblioteca](#confirmação-ao-regravar-inserir-na-barra-e-o-nome-da-animação-junto-da-biblioteca--concluído-em-2026-07-29)
- `2026-07-29` — [Espelho completo do boneco](#espelho-completo-do-boneco--concluído-em-2026-07-29)
- `2026-07-29` — [Barra da linha do tempo em duas fileiras](#barra-da-linha-do-tempo-em-duas-fileiras--concluído-em-2026-07-29)
- `2026-07-29` — [Duas poses de balé e a pirueta](#duas-poses-de-balé-e-a-pirueta--concluído-em-2026-07-29)
- `2026-07-29` — [O keyframe que está na bancada: destaque no card e marca na régua](#o-keyframe-que-está-na-bancada-destaque-no-card-e-marca-na-régua--concluído-em-2026-07-29)
- `2026-07-29` — [Papel-cebola com escolha de lado](#papel-cebola-com-escolha-de-lado--concluído-em-2026-07-29)
- `2026-07-29` — [Marca do playhead no card do keyframe](#marca-do-playhead-no-card-do-keyframe--concluído-em-2026-07-29)
- `2026-07-30` — [Fase 11 — Câmera de cena separada do viewport, gizmo estilo Blender e preset 9:16](#fase-11--câmera-de-cena-separada-do-viewport-gizmo-estilo-blender-e-preset-916--concluída-em-2026-07-30)
- `2026-07-30` — [Fase 12 — Exportar/importar animação em JSON, com remapeamento de elenco](#fase-12--exportarimportar-animação-em-json-com-remapeamento-de-elenco--concluída-em-2026-07-30)
- `2026-07-30` — [Gizmo de translação de junta (arrasto de cadeia) — substitui o IK de 2 ossos](#gizmo-de-translação-de-junta-arrasto-de-cadeia--substitui-o-ik-de-2-ossos--concluído-em-2026-07-30)
- `2026-07-30` — [Destaque de juntas travadas com o gizmo de mover ativo](#destaque-de-juntas-travadas-com-o-gizmo-de-mover-ativo--concluído-em-2026-07-30)
- `2026-07-30` — [Objetos de cena 3D redimensionáveis, com vértice livre](#objetos-de-cena-3d-redimensionáveis-com-vértice-livre--concluído-em-2026-07-30)
- `2026-07-31` — [Enxertar animação importada, carimbar a câmera atual e regravar em `<dialog>`](#enxertar-animação-importada-carimbar-a-câmera-atual-e-regravar-em-dialog--concluído-em-2026-07-31)
- `2026-07-31` — [Reorganização do painel de Animação](#reorganização-do-painel-de-animação--concluído-em-2026-07-31)
- `2026-07-31` — [Reorganização dos painéis de Propriedades e Câmera](#reorganização-dos-painéis-de-propriedades-e-câmera--concluído-em-2026-07-31)
- `2026-07-31` — [Remoção do glTF: a cena passa a ser um `.json`](#remoção-do-gltf-a-cena-passa-a-ser-um-json--concluído-em-2026-07-31)
- `2026-07-31` — [Unificar as codificações de boneco](#unificar-as-codificações-de-boneco--concluído-em-2026-07-31)
- `2026-07-31` — [Um caminho só para boneco em arquivo](#um-caminho-só-para-boneco-em-arquivo--concluído-em-2026-07-31)
- `2026-07-31` — [Convenção de botão nos painéis](#convenção-de-botão-nos-painéis--concluído-em-2026-07-31)
- `2026-07-31` — [Ajustes de layout e régua numerada na linha do tempo](#ajustes-de-layout-e-régua-numerada-na-linha-do-tempo--concluído-em-2026-07-31)
- `2026-07-31` — [Consolidação da documentação: `CLAUDE.md`, `HISTORICO.md` e dois índices](#consolidação-da-documentação-claudemd-historicomd-e-dois-índices--concluído-em-2026-07-31)
- `2026-07-31` — [Fase 13 — Mapa de profundidade](#fase-13--mapa-de-profundidade--concluída-em-2026-07-31)
- `2026-07-31` — [Módulo de poses — a casca de toque (item 44)](#módulo-de-poses--a-casca-de-toque-item-44--concluído-em-2026-07-31)
- `2026-07-31` — [Lote de acabamento do módulo de poses (itens 45–51, 56 e 59)](#lote-de-acabamento-do-módulo-de-poses-itens-4551-56-e-59--concluído-em-2026-07-31)
- `2026-08-01` — [Smoke de Playwright do módulo de poses (item 57)](#smoke-de-playwright-do-módulo-de-poses-item-57--concluído-em-2026-08-01)
- `2026-08-01` — [Rotação por eixo, anéis gimbal e reset por eixo no módulo de poses (itens 60 e 61)](#rotação-por-eixo-anéis-gimbal-e-reset-por-eixo-no-módulo-de-poses-itens-60-e-61--concluído-em-2026-08-01)
- `2026-08-01` — [Âncora de junta e raiz rotacionável no arrasto (itens 62 e 63)](#âncora-de-junta-e-raiz-rotacionável-no-arrasto-itens-62-e-63--concluído-em-2026-08-01)
- `2026-08-01` — [Trazer a sessão da outra casca (item 54)](#trazer-a-sessão-da-outra-casca-item-54--concluído-em-2026-08-01)
- `2026-08-01` — [Trava por eixo na rotação da raiz (item 64)](#trava-por-eixo-na-rotação-da-raiz-item-64--concluído-em-2026-08-01)
- `2026-08-01` — [Confirmação da troca de sessão em modal (refino do item 54)](#confirmação-da-troca-de-sessão-em-modal-refino-do-item-54--concluído-em-2026-08-01)
- `2026-08-01` — [Remessa da sessão por QR code — item 65](#remessa-da-sessão-por-qr-code--item-65--concluído-em-2026-08-01)
- `2026-08-02` — [Rename: Virtual Mockup vira WebPoser](#rename-virtual-mockup-vira-webposer--concluído-em-2026-08-02)
- `2026-08-02` — [Publicação automática no GitHub Pages](#publicação-automática-no-github-pages--concluído-em-2026-08-02)
- `2026-08-02` — [Licença MIT](#licença-mit--concluído-em-2026-08-02)

---

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

### Ajuste de proporções e visual do boneco (revisita a fase 2) ✅ (concluído em 2026-07-24)

A pedido do usuário, 4 ajustes ao modelo do boneco, fora da lista da fase 9: (1) encurtar o espaço entre `chest` e `neck`; (2) encurtar o espaço entre `chest` e `spine`, ajustando os braços em consequência; (3) geometria visível na ponta de `fingers.*`/`thumb2.*` (hoje dobrar essas juntas não tem nenhum efeito visual); (4) referência geométrica da frente do rosto (nariz/olhos/boca/orelhas).

**Investigação:** em vez de "diminuir" por tentativa, calculei as proporções de um corpo real médio de 1,70m a partir de frações antropométricas padrão (Drillis & Contini) e comparei com `skeleton.ts`. Achado: o diagnóstico original estava invertido — o tronco (`spine`+`chest`, 0,40m) estava **curto** demais (ideal ≈0,49m), e o pescoço (`chest`→`neck`, 0,24m) estava **~3× mais longo** que o real (≈0,088m); braços e pernas já batiam com a antropometria e não precisavam de ajuste. Apresentei a tabela de números e as opções ao usuário antes de mexer no código; ele confirmou seguir a proporção real (cresce o tronco, encolhe o pescoço — a soma preserva ~1,70m sem precisar compensar em outro lugar) e confirmou geometria (não textura) para o rosto. Detalhe completo, com a tabela antropométrica, em `DECISOES.md` #15.

**Entregue:**
- `skeleton.ts`: `spine` `[0,0.14,0]`→`[0,0.17,0]`; `chest` `[0,0.26,0]`→`[0,0.32,0]`; `neck` `[0,0.24,0]`→`[0,0.08,0]`. Nenhum limite/DOF mudou, só os offsets de posição.
- `Figure.tsx`: `TIP_CAPS` — paralelepípedo na ponta de `fingers.L/R` (bloco dos 4 dedos) e um menor em `thumb2.L/R` (ponta do polegar), como geometria estática filha do próprio grupo da junta (sem criar juntas novas no `skeleton.ts` — mantém as 27 juntas documentadas), então herdam a rotação automaticamente. `FaceFeatures` — nariz, olhos, boca e orelhas em geometria simples (mesma cor do boneco, sem textura), na esfera da cabeça.
- 3 novos testes em `Figure.test.tsx` (marcas faciais presentes; blocos de ponta presentes nas 4 juntas; posar `fingers.L` move o bloco no mundo — trava de regressão do bug relatado). Suíte completa em 381 testes, todos verdes; `tsc -b`, `eslint .` e `npm run build` continuam limpos.
- **Validação manual no navegador:** pescoço visivelmente curto (cabeça encostada nos ombros), tronco com proporção mais natural, nariz/olhos/orelha visíveis por relevo na cabeça (câmera aproximada via janela redimensionada, já que o zoom padrão não dava resolução suficiente), bloco dos dedos visível e se movendo ao rotacionar `fingers.L` — antes, girar essa junta não tinha nenhum efeito visual. Sem erros no console.

### Segundo ajuste de modelo — junta `upperChest`, mãos com 3 falanges, polegar cilíndrico ✅ (concluído em 2026-07-24)

O usuário testou o resultado acima e pediu 3 mudanças adicionais (avaliadas antes de implementar, com imagem de referência para as mãos): (1) uma junta entre `chest` e `neck` (clavículas passam a ser filhas dela), diagnosticando que a falta dela deixava o pescoço invisível; (2) mãos refeitas com 3 juntas de falange para o grupo dos 4 dedos (mantendo a simplificação "dedos em bloco" da fase 2) e polegar em geometria cilíndrica, com proporções corrigidas; (3) conectores `chest↔spine↔root` mais robustos, em vez de um cilindro fino.

**Investigação:** o pescoço invisível tinha a causa errada no diagnóstico do usuário — não era falta de junta, e sim `TORSO_BLOCKS.chest` (não recalibrado no ajuste anterior) continuar alcançando/escondendo a posição do `neck`; mesma causa-raiz do item 3 (offsets de `spine`/`chest` cresceram mas os blocos torneados não acompanharam, sobrando um trecho longo só do osso conector fino entre eles). Apresentei essa análise ao usuário antes de mexer no código — a junta `upperChest` ainda foi implementada como pedida (dá uma capacidade real nova, não é só workaround), mas o ajuste de `TORSO_BLOCKS` era necessário de qualquer forma. Detalhe completo em `DECISOES.md` #16.

**Entregue:**
- `skeleton.ts`: **27 → 32 juntas.** Nova junta `upperChest` (filha de `chest`, só eixo X, ±15°) — `neck` e `clavicle.L/R` passam a ser filhas dela em vez de `chest` (hierarquia continua transitiva: dobrar o `chest` ainda move os ombros). `fingers.L/R` (1 junta cada) viram uma cadeia de 3 (`fingersBase`/`fingersMid`/`fingersTip`, aproximando MCP/PIP/DIP, faixas 0-90°/0-110°/0-90°) — continuam dobrando os 4 dedos juntos, em bloco. `thumb1`/`thumb2` com offsets maiores (proporção corrigida).
- `Figure.tsx`: `TORSO_BLOCKS` recalibrado (`root`/`spine` crescem para se sobrepor sem vão; `chest` encolhe de propósito para não alcançar mais `upperChest`/`neck` — resolve a visibilidade do pescoço). `Bone` ganhou um modo de geometria cilíndrico (polegar) além dos já existentes paralelepípedo (agora toda a cadeia de dedos, não só 1 segmento) e perfil torneado orgânico (demais ossos).
- Testes de contagem/hierarquia atualizados (`skeleton.test.ts`, `jointFrames.test.ts`, `figureObject3D.test.ts`) e testes de `Figure.tsx` para os novos nomes de junta, mais 2 novos (polegar em cilindro; posar `fingersBase.L` move a ponta do dedo — trava de regressão). Suíte completa em 384 testes, todos verdes; `tsc -b`, `eslint .` e `npm run build` continuam limpos.
- **Validação manual no navegador:** pescoço agora visível (antes escondido dentro do bloco do `chest`), tronco sem vão/"palito" entre os blocos, cadeia de dedos dobrando visivelmente em 3 pontos ao posar `fingersBase.L`, polegar com segmentos cilíndricos distinguíveis do resto do braço. Sem erros no console.

**Correção (mesmo dia) — conector `chest`↔`spine` ainda fino:** o usuário testou de novo e reportou que esse conector especificamente continuava com cara de cilindro fino. Recalculando: o `chest` menor (item 3 acima) abriu um vão de 0,15m entre os blocos, maior do que antes do ajuste. Corrigido crescendo `spine` mais (sem risco de esconder nada, seu próximo filho `chest` está longe) e adicionando `TORSO_BONE_RADIUS` — um raio fixo para o osso conector `spine→chest`, em vez do cálculo automático (pensado para membros finos, não para tronco). Suíte em 384 testes, todos verdes; validado visualmente (tronco inteiro como forma contínua, sem trecho fino em nenhuma transição). Detalhe completo em `DECISOES.md` #17.

**Ajuste (mesmo dia) — `chest` em trapézio, mais largo em cima:** o usuário pediu o `chest` mais alto e com a parte de cima (ombros) mais larga que a de baixo (cintura) — trapézio regular visto de frente — com o offset `spine`→`chest` encolhido para compensar, e pediu para eu confirmar se a mudança visual estava atrelada a mudança de juntas. Confirmado: sim, nos dois sentidos — o aumento de altura só podia ir para baixo (crescer para cima re-esconderia o pescoço, mesmo bug do #16/#17) e o próprio pedido de encolher `spine`→`chest` já é uma mudança de junta. `Figure.tsx` ganhou `trapezoidProfile` (perfil assimétrico, ao contrário do barril simétrico usado no resto do tronco) para o `chest`; `skeleton.ts` com o offset `spine`→`chest` reduzido de 0,32 para 0,24m. Suíte em 384 testes, todos verdes; validado visualmente (silhueta em V nítida, transições continuam sem "palito", pescoço continua visível). Detalhe completo em `DECISOES.md` #18.

### Ferramentas de teste + 2 correções visuais ✅ (concluído em 2026-07-24)

Para facilitar as próximas rodadas de ajuste fino no boneco, o usuário pediu 4 itens: (1) T-pose (braços na horizontal, palmas para baixo) como pose padrão ao criar um boneco; (2) botão para voltar à T-pose; (3) combo box com todas as juntas posáveis, agrupadas por optgroup (tronco/cabeça/braço direito/braço esquerdo/perna direita/perna esquerda), para alcançar juntas encobertas por outras partes do corpo; (4) fechar o topo aberto/oco do `chest` e fixar os olhos em preto, independente da cor do boneco.

**Entregue:**
- **T-pose (itens 1-2):** valor de `elbow.*.y` para "palma para baixo" confirmado numericamente (`buildJointFrames`, varrendo candidatos, não deduzido) — `shoulder.{L,R}.z=∓90` (abdução completa) sozinho não vira a palma, precisa também `elbow.L.y=-90`/`elbow.R.y=+90` (sinais opostos entre os lados, mesmo padrão de espelhamento Y/Z já documentado). Exigiu alargar o limite de `elbow.*.y` de ±80° para ±90° (ainda dentro da faixa real de pronação/supinação). Novo preset `tpose` em `posePresets.ts`, usado como pose inicial em `figuresStore.addFigure` (antes era `{}`) e disponível como botão na lista de poses predefinidas (já generalizada, só precisou do rótulo).
- **Combo box de junta (item 3):** novo `src/figure/jointGroups.ts` com o agrupamento das 31 juntas posáveis em 6 categorias, testado para cobrir exatamente `JOINT_NAMES` (menos `root`) sem faltar/duplicar — trava de regressão para quando novas juntas forem adicionadas. `PropertiesPanel.tsx` ganhou o `<select>` com `<optgroup>`, sempre visível com um boneco selecionado.
- **Olhos pretos + topo do chest (item 4):** `Figure.tsx` — cor fixa para as 2 esferas dos olhos (nariz/boca/orelhas continuam na cor do boneco); `trapezoidProfile` do `chest` ganhou `closeTop` (ponto de raio ~0 na mesma altura da ponta, fechando o `LatheGeometry` com uma "tampa" em vez de deixar aberto/oco).
- 7 novos testes automatizados (`jointGroups.test.ts`: 3; `Figure.test.tsx`: 2, olhos pretos e topo fechado; `PropertiesPanel.test.tsx`: 2, botão T-pose e combo box) + ajustes em `figuresStore.test.ts`/`posePresets.test.ts`/`skeleton.test.ts` para a nova pose inicial e o limite alargado — suíte completa em 392 testes, todos verdes; `tsc -b`, `eslint .` e `npm run build` continuam limpos.
- **Validação manual no navegador:** boneco criado já nasce em T-pose, braços na horizontal com o polegar apontando para a frente em ambos os lados (confirma palma para baixo); olhos pretos, resto do rosto na cor do boneco; topo do `chest` sem abertura visível vista de cima; combo box lista as juntas certas por grupo e seleciona corretamente até `fingersTip.R` (ponta do dedo, praticamente impossível de clicar no viewport). Sem erros no console.

Detalhe completo (incluindo a investigação numérica da T-pose) em `DECISOES.md` #19.

### Correção do polegar na T-pose + remodelagem do tronco (imagem de referência) ✅ (concluído em 2026-07-24)

O usuário testou a T-pose e reportou que o polegar ficava virado para trás (confirmou que a pose "em pé" normal continuava correta) — a métrica usada no #19 (normal abstrata do pulso) não era um proxy confiável, já que o offset de `thumb1.*` tem componentes em mais de um eixo local. Refeita a varredura numérica medindo a posição real de `thumb1.*`: `elbow.L.y=45`/`elbow.R.y=-45` (não mais ±90) deixam o polegar apontando para a frente e nivelado nos dois lados.

Junto, o usuário trouxe uma imagem de referência para remodelar o tronco: `chest` = dois trapézios ligados pela base maior; cilindro achatado ligando `chest` ao `spine`; `spine`/`chest`/`pivô` já bem modelados, só a ligação `spine`↔`pivô` (root) precisava ficar mais larga vista de frente. Implementado como pedido: `chest` agora é `CHEST_SHAPE.upper`+`lower` (dois trapézios com um raio intermediário compartilhado, dando a silhueta em "dois degraus" da imagem); o osso `chest`→`spine` passou a renderizar como cilindro (`CYLINDER_JOINTS`), com uma nova prop `depthRatio` em `Bone` para achatá-lo; `TORSO_BONE_RADIUS` virou `TORSO_CONNECTORS` (raio + achatamento opcional por junta-filha), com uma entrada nova para `root`→`spine` (antes só existia para `spine`→`chest`).

Suíte completa em 393 testes, todos verdes (1 novo, trava de regressão do polegar usando a posição real da junta); `tsc -b`, `eslint .` e `npm run build` continuam limpos. Validado visualmente no navegador: polegares para a frente nas duas mãos; `chest` com a silhueta em dois degraus da imagem de referência, sem abertura no topo; transição `chest`→cilindro→`spine`→`root` contínua, sem trecho fino em nenhum ponto. Detalhe completo em `DECISOES.md` #20.

### Novo modelo visual — "manequim de madeira" (`skeleton2.ts`/`Figure2.tsx`) ✅ (concluído em 2026-07-24)

Trocado o renderer ativo do boneco por um novo par de arquivos que reproduz visualmente um manequim articulado de madeira (cabeça em ovo, pescoço em carretel, tronco em blocos entalhados com a bola da cintura exposta, membros torneados com bolas de junta expostas em ombro/cotovelo/punho/quadril/joelho/tornozelo, mãos em lâmina chata e pés em cunha). `skeleton2.ts` reexporta `skeleton.ts` sem alterar nada da cinemática (mesmas 32 juntas, offsets, limites e hierarquia) e só acrescenta a camada visual (`JOINT_PARTS`/`BONE_STYLES`, por nome de junta); `Figure2.tsx` espelha a API de `Figure.tsx` (mesmos nomes de mesh, seleção, refs de junta, sombra). `Viewport.tsx` troca com uma linha de import (`Figure2 as Figure`), com o import antigo comentado ao lado para reverter facilmente.

Como a cinemática não mudou, todas as correções numéricas já documentadas (sinais de eixo #13/#14, T-pose com polegar para a frente #20) continuam válidas por construção no novo renderer — não foi preciso reinvestigar. Suíte completa em 426 testes, todos verdes (`skeleton2.test.ts` e `Figure2.test.tsx` cobrem reexport idêntico, cobertura completa de peças/ossos por junta, simetria L/R, validade geométrica e ancoragem no mundo na pose de descanso); `tsc -b`, `eslint .` e `npm run build` continuam limpos. Validado visualmente no navegador (bundle conferido pelo hash do build): boneco nasce em T-pose com a nova geometria, seleção de junta por clique/combo box, botões de pose predefinida e gizmo da raiz continuam funcionando normalmente com o novo renderer. Sem erros no console. Detalhe completo em `DECISOES.md` #21.

### Revisão das mãos — torção neutra do antebraço, bug real no lado R, marcador do dorso ✅ (concluído em 2026-07-24)

O usuário reportou os dedos "aparentam estar errados" e pediu 3 ajustes: (1) a mão não deve se mexer ao baixar o braço da T-pose para a posição normal — só o ombro —, com a palma para baixo na T-pose e paralela à lateral da coxa quando abaixado; (2) limites para os dedos não virarem para trás; (3) algo visual para identificar o dorso da mão.

**Item 1:** o #19/#20 tratavam a torção do antebraço (`elbow.*.y`) como exclusiva da T-pose (`45`/`-45`), com a pose "em pé" usando `elbow.y=0` — a mão "pulava" de torção entre as poses, exatamente o bug relatado. Investigação numérica (medindo o PLANO real da mão via produto vetorial, não só a posição do polegar) confirmou: a mesma torção que deixa a palma para baixo na T-pose também deixa a palma para a coxa com o braço abaixado, porque abduzir o ombro gira o antebraço+mão como corpo rígido sem alterar sua torção interna. `elbow.L.y=45` continua correto, mas a varredura revelou um **bug real** no lado R: o valor espelhado ingenuamente (`-45`) deixava a palma para CIMA na T-pose, não para baixo — o teste antigo (só polegar-para-frente) não pegava isso. O valor certo é `elbow.R.y=135` (não um espelho de sinal — 180° de diferença, não só o sinal), com um efeito colateral aceito: o polegar de R fica ligeiramente para trás nessa configuração (palma para baixo foi priorizada, pedido explícito do usuário). `posePresets.ts` ganhou `NEUTRAL_ELBOW_TWIST`, aplicado como default em todo preset que não declare `elbow.*.y` — `standing`/`tpose`/`walking`/`running`/`sitting` agora usam a mesma torção neutra; `tpose` não precisa mais declarar o eixo. `skeleton.ts`: limite de `elbow.*.y` alargado para ±150 (necessário para 135).

**Item 2:** já estava correto — `fingersBase`/`fingersMid`/`fingersTip` já tinham `min:0` (sem hiperextensão para trás) desde a fase anterior. O que fazia os dedos parecerem errados era a orientação da mão inteira (item 1), não os limites.

**Item 3:** novo pino de latão (`HAND_BACK_MARKER_L`/`_R`, cor fixa independente da cor do boneco) adicionado a `wrist.L`/`wrist.R`, posicionado numericamente no lado oposto da normal do plano da mão — sempre no dorso, em qualquer pose.

Suíte completa em 432 testes, todos verdes (novas travas: normal do plano da mão para os dois lados em `posePresets.test.ts`, posição do marcador em `skeleton2.test.ts`, cor fixa em `Figure2.test.tsx`); `tsc -b`, `eslint .` e `npm run build` continuam limpos. Validado visualmente no navegador: T-pose e "em pé" sem "pulo" na mão; pino de latão visível nas costas das duas mãos vistas de cima; dedos dobrando para dentro da palma corretamente. Detalhe completo em `DECISOES.md` #22.

**⚠️ Correção (mesmo dia) — o `elbow.R.y=135` acima estava errado, revertido para `-45`:** ver a entrada seguinte.

### Correção do braço direito — bug de quiralidade na verificação, não um limite real ✅ (concluído em 2026-07-24)

O usuário testou o braço direito e reportou o polegar visualmente para trás, pedindo para lembrar a decisão de usar ângulos espelhados. Uma primeira tentativa de correção (`shoulder.R.y=120` somado a `elbow.R.y=135`) foi descartada ANTES de ir ao ar — media a posição real de `elbow.R`/`wrist.R` e descobri que essa combinação entorta o braço inteiro para a frente (a composição de rotações do Three.js não comuta como parecia quando `shoulder.z` e `shoulder.y` são não-nulos ao mesmo tempo).

O usuário então redirecionou: tratar a T-pose como o estado zero do esqueleto, com todas as outras poses derivadas dela. Investigando essa reconstrução, a álgebra revelou que o "conflito" (palma para baixo e polegar para a frente nunca batendo juntos no lado R) era **estrutural em qualquer pose testada**, não específico da T-pose — apontando para um bug na própria métrica de verificação, não no esqueleto. A causa: o produto vetorial usado para medir "para onde a palma aponta" (`cross(dedos, polegar)`) é um pseudovetor, e a ORDEM dos operandos que dá "para fora da palma" se inverte entre mão esquerda e direita (quiralidade — mão direita é a imagem espelhada da esquerda, e pseudovetores não respeitam reflexão como vetores de posição comuns). Usar a mesma ordem para os dois lados — o que a verificação do #22 fazia — cria um "conflito" que não existe de verdade.

Com a ordem corrigida (invertida no lado R), `elbow.R.y=-45` — o espelho de sinal simples, exatamente o que o usuário pedia — já dá palma para baixo e polegar para a frente na T-pose, com a MESMA qualidade do lado L. `elbow.R.y=135` (o valor do #22), sob a métrica corrigida, na verdade dava palma para CIMA e polegar para trás — a "correção" anterior estava duplamente errada. Revertido: `NEUTRAL_ELBOW_TWIST` volta a `{L:45, R:-45}`; preset `tpose` volta a só declarar os ombros; limites de `elbow.*.y`/`shoulder.*.y` voltam de ±150 para ±90. Bug adicional encontrado com a mesma causa: o pino de latão do dorso da mão (`HAND_BACK_MARKER_R`) também tinha sido posicionado com a métrica de quiralidade errada, ficando do lado da palma em vez do dorso — corrigido negando o offset.

Suíte completa em 432 testes, todos verdes; `tsc -b`, `eslint .` e `npm run build` continuam limpos. Validado visualmente no navegador: vista de topo confirma os dois braços perfeitamente retos e simétricos na T-pose, polegares para a frente nos dois lados, "em pé" com braços simétricos ao lado do corpo. Detalhe completo em `DECISOES.md` #23.

### Palma exatamente paralela ao chão na T-pose — ajuste na modelagem ✅ (concluído em 2026-07-24)

O usuário pediu, na T-pose, para deixar a palma EXATAMENTE paralela ao plano horizontal (o #23 chegava perto, mas não exato). Uma varredura de rotações de punho mostrou que dava para reduzir a inclinação de ~4° para ~2°, mas não zerar (o punho não tem eixo de torção). Perguntei a preferência entre essa melhoria parcial e adicionar um eixo novo ao punho — o usuário respondeu para **ajustar na modelagem do boneco, não nos valores e ângulos de ajuste**.

Investigando a modelagem, o resíduo vinha de dois offsets brutos em `skeleton.ts`: `fingersBase.*` tinha uma leve componente fora do plano horizontal, e `thumb1.*` não estava exatamente na direção que zera o produto vetorial da normal da mão. Recalculados numericamente (via `buildJointFrames`, achatando `fingersBase` e resolvendo `thumb1` para a normal exata, preservando o comprimento original dos offsets): com os novos valores, a normal da mão fica exatamente `(0,-1,0)` na T-pose (erro `<1e-7`) — e, pela mesma rotação rígida do ombro já estabelecida no #22/#23, a pose "em pé" também fica com a normal exatamente lateral `(∓1,0,0)`, sem precisar de nenhum ajuste separado.

Suíte completa em 432 testes, todos verdes (os dois testes de plano da mão em `posePresets.test.ts` apertados de limiar para `toBeCloseTo(...,5)`, travando a exatidão); `tsc -b`, `eslint .` e `npm run build` continuam limpos. Validado visualmente no navegador: vista de frente na T-pose mostra as duas mãos com perfil fino e achatado, sem inclinação visível. Detalhe completo em `DECISOES.md` #24.

### Remodelagem completa da mão — alinhada aos eixos, torção neutra ±90°, proporções humanas ✅ (concluído em 2026-07-24)

O usuário pediu para refazer toda a geometria da mão (de `wrist` até os dedos) com proporções humanas, mantendo 2 juntas de polegar + 3 de dedos em bloco, simplificando a malha (juntar nó+dedo), com palma para baixo e polegares para a frente na posição inicial — anexando captura dos defeitos (paralelepípedos entortados, juntas mal modeladas, palma não aparentando ficar paralela ao chão) e o esquema de referência `maos.jpg`.

Causa raiz encontrada: a mão inteira estava modelada 45° fora dos eixos locais do punho (compensada pela torção neutra `elbow.y=±45` do #22/#23) — as juntas estavam certas (#24), mas as peças renderizavam giradas, a lâmina da palma tinha rolamento arbitrário E os eixos de dobra dos dedos ficavam 45° tortos (curvar os dedos os movia na diagonal). Com confirmação do usuário (via pergunta direta), aplicada a correção completa: torção neutra passou a ±90 (o único valor que alinha o eixo de dobra dos dedos à fileira dos nós) e a mão foi remodelada alinhada aos eixos locais (dedos -Y, polegar ∓X, palma -Z), com proporções antropométricas (18,4 cm punho→ponta). Palma para baixo/polegar para a frente ficam exatos POR CONSTRUÇÃO; `elbow.y` agora tem faixa `[0,180]`/`[-180,0]` centrada no neutro; `thumb2` trocou o DOF de X para Y (a dobra real da ponta); nós dos dedos viraram elipses de dobradiça (como no esquema de referência); pino de latão do dorso passou a um único offset para os dois lados. `Figure2.tsx` não precisou de nenhuma mudança.

Suíte completa em 435 testes, todos verdes (3 travas novas de eixo de dobra em `jointSignConvention.test.ts`; os testes de exatidão do plano da mão do #24 passaram sem alteração); `tsc -b`, `eslint .` e `npm run build` limpos. Validado visualmente no navegador real (Chrome headless via Playwright): palma como lâmina fina perfeitamente horizontal na T-pose, polegares para a frente nos dois lados, dedos curvando reto em direção à palma pelos sliders. Efeito colateral aceito: poses salvas com `thumb2.x` são zeradas ao recarregar e `elbow.y` antigo exibe a mão com outra torção (precedente do #13). Detalhe completo em `DECISOES.md` #25.

### Braços mais curtos, ombros mais próximos e chest mais baixo ✅ (concluído em 2026-07-24)

O usuário pediu 3 ajustes de proporção (braços compridos, ombros afastados, chest mais para baixo), pedindo confirmação fisionômica ANTES de aplicar. A verificação numérica (Drillis & Contini + envergadura ≈1,04×altura) confirmou os três: cotovelo/punho/dedos ficavam 5-6,5 cm abaixo dos marcos reais (os comprimentos do #15 tinham sido calibrados com o ombro mais alto, antes das mudanças de tronco do #16/#18), as juntas dos ombros estavam a 0,48 m entre si (real ~0,39 m — centros articulares ficam ~3 cm mediais ao acrômio) e a base do bloco do peito terminava em 0,735H (borda costal real ~0,70H).

Aplicado com confirmação do usuário: úmero 0,32→0,27, antebraço 0,26→0,245, offset X do ombro 0,14→0,095 (`skeleton.ts`) — cotovelo 1,07 m, punho 0,825 m, dedos 0,642 m (0,377H exato) e envergadura 1,79 m ≈ 1,05H; base do `CHEST_PROFILE` estendida de -0,06 para -0,115 (~1,195 m ≈ 0,70H, opção "esticar a base" escolhida pelo usuário — a linha dos ombros do bloco, correta em 0,82H, não muda), com o cone do abdômen alargado (0,10→0,104) para cobrir o arco de ~5 cm que a base varre na flexão máxima (meio-termo consciente com o bug do #17). Suíte em 435 testes verdes (só o comprimento do úmero em `Figure2.test.tsx` mudou — os alvos de IK dos testes são relativos às juntas); `tsc`/`eslint`/`build` limpos; validado visualmente no navegador real (T-pose proporcional, dedos na altura da coxa em pé, flexão máxima do tronco sem buraco na base do bloco). Detalhe completo em `DECISOES.md` #26.

### Revisão da ligação chest/upperChest → neck — pescoço engrossado ✅ (concluído em 2026-07-24)

O usuário pediu para rever a proporção do tamanho da ligação entre `chest`/`upperChest` e o `neck`, ajustando se necessário. A revisão numérica mostrou que a cinemática estava correta (base do pescoço em 1,39 m = 0,818H, queixo em ~1,485 m ✓), mas a camada visual não: das peças da ligação, só o osso `neck→head` fica visível (o resto está enterrado no topo do bloco do peito), e ele tinha diâmetro de ~0,05-0,06 m contra uma cabeça de 0,154 m — razão 0,39, quando humanos ficam em ~0,7 e manequins de madeira em ~0,55-0,65 ("palito" entre volumes largos, mesmo padrão de defeito do #16/#17).

Ajuste aplicado só em `skeleton2.ts` (nenhuma junta mudou): carretel visível engrossado para r 0,034-0,047 (⌀ ~0,55 da largura da cabeça, com cintura de carretel e topo afinando para entrar no queixo do ovo), bola do `neck` alargada para `[0,05, 0,042, 0,05]` (assento do carretel despontando do platô do bloco; cobre o pivô na flexão máxima de 50° sem abrir vão) e osso enterrado `upperChest→neck` engrossado junto (nada fino aparece quando o `upperChest` inclina). Suíte em 435 testes verdes sem nenhuma mudança de teste; `tsc`/`eslint`/`build` limpos; validado visualmente no navegador real antes/depois (frente, lado e pescoço flexionado ao máximo). Detalhe completo em `DECISOES.md` #27.

### Verificação de cabeça e pernas — pernas re-ancoradas nos marcos ✅ (concluído em 2026-07-24)

O usuário pediu para verificar se o tamanho da cabeça e o comprimento das pernas/tornozelos estão proporcionais. **Cabeça: proporcional, sem ajuste** — altura 0,215 m vs 0,221 (−2,7%), largura +4%, profundidade −7%, razão 7,9 cabeças de altura (faixa adulta 7,5-7,7); todos os desvios abaixo do limiar visual e o topo do ovo já fecha 1,70 m por teste. **Pernas: ~4% curtas, com causa identificada** — o `root` está na altura certa do quadril (0,90 m = 0,530H), mas os offsets de `hip.*` desciam mais 3 cm, tirando esse espaço do orçamento das pernas (joelho 1,5 cm baixo, coxa/canela 4% curtas). É o mesmo "pernas ~4% curtas" registrado sem investigação no #15.

Corrigido com confirmação do usuário: `hip.L/R` y −0,03→0 e coxa/canela 0,40→0,415 (`skeleton.ts`) — quadril em 0,90 m e joelho em 0,485 m, exatos nos marcos; tornozelo mantido em 0,07 m (4 mm acima do real, garantindo a sola no chão) e pé intocado. Suíte em 435 testes verdes sem nenhuma mudança de teste; `tsc`/`eslint`/`build` limpos; validado visualmente no navegador real (pernas mais longas, joelho na altura certa, pés no chão, transição pelve→coxa contínua). Efeito colateral visual aceito: as bolas `hip.*` subiram 3 cm e ficaram embutidas no bloco da pelve. Detalhe completo em `DECISOES.md` #28.

### Workspace: limites articulares customizáveis (`joint-limits.json`) ✅ (concluído em 2026-07-24)

O usuário pediu para avaliar onde os limites de movimentação de `skeleton.ts` são usados e permitir customizá-los por JSON gravado no workspace, sem alterar os valores do código. A avaliação mostrou um único ponto de imposição (`clampJointRotation`) e mais quatro consumidores derivados de `JOINTS[].limits` (`getJointAxes` → DOFs de sliders/gizmo/atalhos, faixa dos sliders no `PropertiesPanel`, sentido da dobra no `ikSolver`, clamp de poses ao carregar cena) — todos alcançáveis por uma camada efetiva atrás de `getJoint`.

Quatro definições foram confirmadas com o usuário antes de implementar: arquivo **separado** `joint-limits.json` (apontado pelo `workspace.json`), o JSON pode mudar **só min/max de eixos que já existem** (nunca criar/remover DOF), poses fora da faixa nova são **grampeadas** ao abrir, e os limites entram no **autosave** com um botão "Restaurar limites padrão" no painel de Cenas (sem editor na UI — a edição é no próprio JSON).

Implementado: camada de overrides no próprio `skeleton.ts` (`sanitizeJointLimitOverrides`/`setJointLimitOverrides`/`resetJointLimitOverrides`, com `getJoint` devolvendo a definição efetiva e `getDefaultJointLimits` guardando o padrão), `persistence/jointLimitsFile.ts` para montar/ler o arquivo (com `leiame` embutido), gravação/leitura em `workspaceFolder.ts` e espelho `jointLimits` no `figuresStore` (dentro do autosave, fora do histórico de undo). Ponto crítico: os limites são instalados **antes** de reconstruir as cenas, porque é na leitura das poses que o clamp acontece. Suíte em 472 testes verdes (37 novos); `tsc`/`eslint`/`build` limpos; validado no navegador real (slider de `knee.L` indo a 45° com o workspace customizado, pose de 150° restaurada como 45°, aviso e botão de restaurar funcionando ao vivo). Detalhe completo em `DECISOES.md` #29.

### Poses de mão, poses de corpo com colocação no chão e simetria E/D ✅ (concluído em 2026-07-24)

O usuário pediu 4 poses de mão por lado (aberta, relaxada, fechada, thumbs-up), 5 poses de corpo (deitado com as mãos atrás da cabeça, fetal, luta, voo do Superman, modelo de revista) e as operações de simetria: copiar um lado espelhado para o outro e inverter os dois lados.

Antes de perguntar qualquer coisa, dois fatos foram estabelecidos numericamente: a reflexão sagital é `(x, y, z) → (x, −y, −z)` na junta pareada e é **exata** (erro 0,000 m contra a cinemática direta; a cópia ingênua erra até 0,95 m), e `clavicle.R.z` era o **único** par do esqueleto cujos limites não eram espelho um do outro (`[0, 20]` nos dois lados) — o que deixava a clavícula direita só abaixando e quebrava o espelhamento. Quatro definições foram confirmadas com o usuário: corrigir `clavicle.R.z` para `[-20, 0]` (única alteração de limite do código), permitir que um preset ajuste também a rotação e a altura do boneco, restringir a simetria às juntas `.L`/`.R`, e oferecer as poses de mão no contexto do braço selecionado com a simetria no painel da raiz.

Implementado: `poseMirror.ts` (regra do espelho, cópia de lado e troca involutiva), `handPresets.ts` (poses parciais das 5 juntas da mão, sem o punho) e `posePresets.ts` estendido com colocação no chão (`PosePresetPlacement`) e pose de mão por preset. Num segundo passo o usuário definiu a mão de cada pose: relaxada em sentado, andando, deitado, fetal e modelo; punho fechado em correndo, luta e Superman; **"Em pé" e T-pose mantidas com a mão aberta** por serem as poses de referência do esqueleto (a T-pose é como um boneco nasce, então curvar dedos ali viraria o novo neutro do modelo). Tudo o que é espelhável vem de uma tabela só — a mão direita é gerada da esquerda, e o lado direito das poses simétricas também —, o que transforma a convenção do #14 em propriedade verificada por teste. Os ângulos das poses novas foram resolvidos por busca em grade contra alvos geométricos (2-3 cm de erro final), não estimados; a pose fetal exigiu reclinar a pelve 30°, sem o que o pé fura o chão. A colocação preserva onde o boneco está e, nas poses que não inclinam, a direção que ele encara. Suíte em 580 testes verdes (108 novos); `tsc`/`eslint`/`build` limpos; validado no Chrome real (as 5 poses conferem visualmente, mãos independentes por lado, espelho transformando pose assimétrica em figura simétrica). Detalhe completo em `DECISOES.md` #30.

- **Ajuste posterior (2026-07-25, pedido do usuário): espelho e inversão parciais.** As duas operações deixaram de valer sempre o boneco inteiro e passam a valer **da junta selecionada para baixo** — com `shoulder.R` selecionado, só o braço direito e seu par mudam; as pernas ficam intactas. O escopo vem da própria hierarquia (`getJointSubtree`, novo no `skeleton.ts`) interseção com as juntas pareadas, então o tronco alcança os dois braços (as pernas nascem na raiz) e a raiz reproduz o comportamento antigo como caso particular. O bloco "Simetria" saiu do painel exclusivo da raiz e aparece em qualquer junta com par embaixo, com a dica dizendo até onde vale; some onde o escopo é vazio (pescoço, cabeça). Verificado numericamente: com o escopo na clavícula, o braço inteiro cai na posição de mundo espelhada com erro 0,000 m enquanto o joelho, fora do escopo, fica a mais de 5 cm dela. Ver `DECISOES.md` #34.

### Poses de luta em par e pose aleatória ✅ (concluído em 2026-07-25)

O usuário pediu três pares de poses pensadas para dois bonecos em cena — soco, chute e gravata por trás, cada golpe com a pose de quem dá e a de quem recebe — e um botão de pose aleatória "dentro dos limites". Duas definições foram confirmadas antes de começar: quem recebe o golpe fica **de pé, no instante do impacto** (não caído), e o sorteio cobre **só as juntas do corpo** (mãos abertas, boneco no lugar).

O que faz de um par um par é geométrico, e foi resolvido numericamente contra a cinemática direta, como no #30: punho × rosto a 1,500 m nos dois (o "rosto" é o ponto do nariz/olhos, não a junta da cabeça), pé × barriga a 1,043 m (0,1 mm de erro) e punhos × pescoço a 1,9 cm. Daí saem as distâncias de encaixe medidas — **0,63 m** (soco), **0,94 m** (chute) e **0,33 m** (gravata, corpo a corpo) —, todas travadas em teste. Foi esse cálculo que expôs o problema da primeira versão de "Soco (levando)": com o tronco arqueado para trás o rosto recuava 21 cm atrás do quadril e o par só encaixava a 0,41 m, com os corpos atravessados; inclinando o tronco para a frente e deixando o recuo por conta do pescoço, o par passou a encaixar a 0,63 m. A altura do quadril de cada pose vem da restrição do chão (relação linear), não de um número chutado. A pose aleatória é módulo próprio (`randomPose.ts`) com gerador injetável, sorteando cada eixo dentro da faixa da própria junta — inclusive dos limites customizados do workspace (#29). Suíte em 709 testes verdes (50 novos); `tsc`/`eslint`/`build` limpos; validado no Chrome real com os três pares montados nas distâncias medidas. Detalhe completo em `DECISOES.md` #35.

### Catálogo de poses, 1ª entrega: apontar, apoios no chão e A-pose ✅ (concluído em 2026-07-25)

Depois de um levantamento de poses úteis, o usuário pediu para implementá-las todas, agrupadas num combo box. Entrega em duas etapas (escolha dele): esta traz **18 poses** — 8 de apontar, 9 de apoio no chão e a A-pose — mais o combo agrupado; a próxima traz pares, ação e expressivas.

Antes de posar qualquer coisa, duas convenções foram MEDIDAS: a direção da palma é o -Z local do punho (e é `elbow.y` que decide o sentido do gesto — a torção neutra já dá a mão-faca, `0` dá palma para baixo e `-180` palma para cima), e cada rotação de raiz (`x=90` de bruços, `z=90` de lado). Apontar usa a **mão aberta** porque os quatro dedos do modelo são uma cadeia só — só o polegar é independente, e por isso "Polegar para trás" é a única pose de apontar com dedo de verdade.

Três limitações reais do modelo apareceram e foram documentadas na dica de cada pose em vez de escondidas: o boneco **não alcança os próprios pés** (a pose virou "Alongamento à frente"), agachar de pé chapado **e** com o pé sob o corpo é impossível (ficou com o calcanhar erguido, como quem tem tornozelo rígido), e o braço é mais longo que a coxa (daí o cotovelo dobrado no "de quatro"). Também se descobriu o limite da heurística de altura do quadril: ela vale para apoios em pé/joelho/mão, mas não quando quem encosta é o bloco do tronco — aí a altura vem da meia-espessura da pelve ou da meia-largura do ombro. O combo tem 34 poses em 6 grupos, e `POSE_PRESET_KEYS` passou a ser derivado dos grupos (com teste travando os dois sentidos). Suíte em 798 testes verdes (89 novos); `tsc`/`eslint`/`build` limpos; validado no Chrome real pose a pose. Detalhe completo em `DECISOES.md` #36.

### Fase 9 — Refinamentos de UX e workspace ✅ (planejada em 2026-07-23, concluída em 2026-07-25)

Sugestões de refinamento de UX levantadas ao final da fase 8 (com base na experiência de construir as fases 1-7), mais pedidos do usuário — registradas como fase própria e implementadas de uma vez, na ordem "bug primeiro, depois UI, depois viewport" escolhida pelo usuário.

**Quatro definições confirmadas com o usuário antes de começar** (três delas marcadas nesta própria lista como "confirmar antes de implementar"): escopo = fase inteira com o bug primeiro; boneco oculto = **totalmente inerte ao mouse**, limpando a seleção ao ser ocultado; pivô do gizmo de rotação da raiz = **o próprio root/quadril**; painéis recolhíveis = **estado persistido**. Detalhe completo em `DECISOES.md` #31.

**Entregue** (numeração dos itens abaixo): **1** botão `?` na Toolbar; **2** indicador de autosave ("Ainda não salvo" / "Salvando…" / "Salvo às HH:MM" / "Falha ao salvar" — `saveWorkspaceToLocalStorage` passou a devolver `boolean` para o indicador não mentir quando a gravação falha); **3** botões de desfazer/refazer, desabilitados nas pontas do histórico; **4** `SceneFileError` com mensagem por causa (`unreadable` / `missingAppData`) nos três pontos de importação e na abertura de workspace — inclusive para o `.glb` válido **sem** o bloco do app, que antes substituía a cena por uma vazia em silêncio; **5** badge "IK" na linha do boneco, com os membros ativos no tooltip; **6** "Resetar esta junta", tendo a pose "Em pé" como neutro (não zero cru — `elbow.*.y` tem torção neutra); **7** "Novo workspace" com confirmação em dois passos, que limpa tudo e zera o histórico de undo; **8** os cinco painéis recolhíveis (`CollapsiblePanel`), com o estado numa chave `localStorage` própria; **9** cores dos eixos do `TransformControls` (X vermelho, Y verde, Z azul, em `axisColors.ts`) nos sliders, botões de eixo e campos de posição/alvo de IK; **10** destaque da linha da grade sob a posição arrastada (indicador, **sem** snapping); **11** régua vertical de 2,5 m, com traços maiores no espaçamento da grade e finos a cada 10 cm, ligável pela Toolbar; **13** gizmo de rotação da raiz alternável com o de translação, girando em torno do quadril, e a rotação da raiz convertida de campos numéricos livres para sliders; **14** o bug do boneco oculto capturando cliques.

**58 novos testes automatizados** — suíte completa em **639 testes**, todos verdes; `tsc -b`, `eslint .` e `npm run build` limpos. **Validação manual no navegador** (Chrome headless via Playwright, sobre `npm run preview`), sem nenhum erro de console: todos os itens acima exercitados de ponta a ponta, incluindo o bug do item 14 reproduzido no cenário exato relatado (boneco oculto em primeiro plano; o clique atravessa e seleciona o boneco visível atrás) e o indicador de grade acendendo durante um arrasto real do gizmo. **Achado colateral:** o arrasto de gizmo, tido como não testável por automação desde a fase 1 (`DECISOES.md` #3), funciona com Playwright — a limitação era da ferramenta de automação anterior, não do gizmo (ver `DECISOES.md` #31.5).

Lista original dos itens, para referência:

1. ✅ **Botão de ajuda visível na Toolbar** (`Toolbar.tsx`) — hoje o painel de atalhos (`ShortcutsHelpPanel.tsx`) só abre pelo atalho `?`; quem não souber que existe nunca descobre.
2. ✅ **Indicador de "salvo"** (`Toolbar.tsx` + `uiStore.ts`) — o autosave (`useWorkspaceAutosave.ts`) é silencioso; um indicador discreto ("Salvo às HH:MM") na Toolbar daria confiança de que nada foi perdido.
3. ✅ **Botões de Desfazer/Refazer na Toolbar** — hoje só via teclado (Ctrl+Z/Ctrl+Shift+Z); útil para quem prefere mouse.
4. ✅ **Feedback de erro ao importar um `.glb` inválido/corrompido** (`SceneFileError` + `fileFeedback.ts`) — hoje as funções de importação (`sceneFile.ts`) falham silenciosamente sem avisar o usuário.
5. ✅ **Indicador de quais membros estão com IK ativo** (badge na linha do boneco) — fácil esquecer que um braço ficou em IK (`ikStore.ts`), já que hoje só aparece no painel de Propriedades ao selecionar uma junta daquele membro especificamente.
6. ✅ **Botão "resetar pose" por junta individual** (`resetJointRotation`) — hoje só é possível resetar a pose inteira via preset "Em pé" (`posePresets.ts`); zerar só uma junta exige ajustar cada eixo manualmente.
7. ✅ **Botão "novo workspace"** (pedido do usuário): limpa e reseta todo o ambiente — todos os bonecos, o catálogo de cenas salvas, bookmarks de câmera e configuração do ambiente, voltando ao estado inicial (equivalente a começar do zero, sem precisar dar reload na página/apagar o `localStorage` manualmente). Precisa de confirmação do usuário antes de executar (ação destrutiva e irreversível — diferente de remover um boneco, que o Ctrl+Z desfaz; limpar o workspace inteiro reseta também o próprio histórico de undo).
8. ✅ **Painéis de controle recolhíveis** (pedido do usuário; estado persistido, conforme confirmado): opção de recolher cada painel lateral (Bonecos, Propriedades, Câmera, Keyframes, Cenas) para liberar espaço de trabalho no viewport — útil em telas menores ou ao focar só na visualização 3D. Precisa decidir se o estado recolhido/expandido de cada painel persiste (localStorage/autosave) ou reseta a cada sessão.
9. ✅ **Cores dos gizmos nas caixas de texto** (pedido do usuário; `axisColors.ts`): os campos numéricos de posição/rotação (root, alvo de IK) e os sliders de rotação de junta ganham a mesma cor do eixo correspondente no gizmo (convenção já usada pelo `TransformControls`: X=vermelho, Y=verde, Z=azul), tanto para translação quanto para rotação — facilita associar visualmente qual campo controla qual seta/anel do gizmo no viewport.
10. ✅ **Indicador visual de alinhamento com a grade** (pedido do usuário; `gridAlignment.ts` + `GridAlignmentIndicator.tsx`, sem snapping): ao arrastar o gizmo de translação do root (ou o alvo de IK), destacar quando a posição está exatamente sobre uma linha da grade do chão (`SceneContent.tsx`) — facilita posicionar o boneco alinhado à grade sem precisar digitar valores exatos nos campos numéricos. Não implica snapping automático (o plano não pede isso), só o indicador visual; se fizer sentido, avaliar snapping como extensão posterior.
11. ✅ **Régua/escala vertical no viewport** (pedido do usuário; `VerticalRuler.tsx`, ligável pela Toolbar): uma régua no eixo Y, com o mesmo espaçamento da grade do chão (`GRID_DIVISIONS`/`GROUND_SIZE` em `src/scene/constants.ts`), para dar noção de altura/escala ao levantar um boneco do chão (poses de salto/voo) ou comparar alturas entre bonecos.
    - **Ajuste posterior (2026-07-25, pedido do usuário):** a régua deixou de ficar num canto fixo da grade e passa a ser **ancorada no boneco selecionado**, no mesmo ponto do gizmo de translação — atravessa o corpo e é desenhada por cima dele. Sem boneco selecionado, não aparece. Ver `DECISOES.md` #33.
12. ✅ **Auditoria completa de sinal/direção das juntas** (concluída em 2026-07-24, ver `DECISOES.md` #14) — mesmo método numérico do #13 aplicado a `spine`/`chest`/`neck`/`head`, `clavicle.*`, `wrist.*`, `ankle.*`, e aos eixos `y`/`z` de `hip`/`shoulder`. Achados e correções: `spine.x`/`chest.x`/`ankle.x` tinham a faixa grande do lado anatômico errado (mesmo padrão do #13) — corrigido em `skeleton.ts`; `elbow.x` só permitia hiperestender, nunca a flexão real do cotovelo — corrigido (faixa invertida para `{min:-150,max:0}`), com ajuste correspondente em `ikSolver.ts` (sinal da flexão aplicada à junta intermediária, derivado da própria faixa da junta) e em `posePresets.ts` (sinal de `elbow.x` em `walking`/`running`). Achado adicional, documentado mas não "corrigido" na origem: os eixos Y/Z de toda junta pareada L/R (`clavicle`, `shoulder`, `hip`, `wrist`, `ankle`) têm sentido anatômico oposto para o mesmo sinal numérico (espelhamento de posição, não de rotação) — comportamento comum em rigs 3D, documentado no docblock de `skeleton.ts` e travado por teste de regressão, não reescrito. Suíte em 378 testes, todos verdes.
13. ✅ **Pivô do root: gizmo de rotação além de translação, com sliders no painel de Propriedades** (pedido do usuário): hoje o gizmo do `root` só oferece translação (`SelectionGizmo.tsx`, `mode` fixo em `'translate'` quando `isRoot`) — a rotação de colocação do boneco (`figure.rotation`) só é ajustável pelos campos numéricos livres do painel de Propriedades, sem gizmo próprio nem sliders. Adicionar um gizmo de rotação para o root (alternável com o de translação, ex. como translate/rotate dos softwares 3D) e trocar os campos numéricos de rotação do root, no painel de Propriedades, pelos mesmos controles de slider já usados nas demais juntas — para consistência de interação. **Ponto esclarecido antes de implementar:** o usuário confirmou girar **em torno do próprio root/quadril**. O gizmo de rotação é anexado ao grupo INTERNO da raiz (o que carrega `figure.rotation`), não ao externo usado pela translação — ver `DECISOES.md` #31.2.
14. ✅ **Bug relatado pelo usuário: boneco oculto continua capturando cliques** (registrado e corrigido em 2026-07-25 — ver `DECISOES.md` #31.1). Sintoma: ao clicar no viewport, juntas de um boneco **oculto** (o olho fechado no painel de Bonecos, `figure.visible = false`) são selecionadas quando ele está em primeiro plano, na frente do boneco visível que se queria clicar — ou seja, o boneco invisível "rouba" o clique de quem está atrás dele.
    - **Causa raiz (a hipótese abaixo estava só metade certa — ver `DECISOES.md` #31.1):** o `Raycaster` realmente ignora `visible`, mas o sistema de eventos do R3F nem chega a percorrer a cena: ele testa diretamente cada objeto que tenha handler de ponteiro registrado. A correção foi não registrar o handler quando o boneco está oculto, o que tira a peça da lista de objetos interativos (clique e hover). Somado a isso, ocultar o boneco selecionado limpa a seleção.
    - **Hipótese original, mantida como registro:** `Figure2.tsx` aplica a visibilidade só como `visible={figure.visible}` no grupo externo (linhas 348 e 361). Em Three.js, `visible = false` remove o objeto da *renderização*, mas o `Raycaster` **não** testa essa flag ao percorrer a cena — os meshes continuam sendo alvos válidos de intersecção. Se for isso, o clique acerta o mesh invisível mais próximo da câmera e o `onClick` de `PartMesh` chama `event.stopPropagation()`, impedindo que o evento chegue ao boneco visível atrás.
    - **Verificar também:** se o mesmo vale para o *hover*/cursor, para o gizmo de alvo de IK (`IKTargetGizmo`) e para a sombra no chão (`FigureShadow`, que também é só `visible={figure.visible}`); e se um boneco oculto pode ficar selecionado/posável sem o usuário perceber.
    - **Decidido com o usuário:** boneco oculto é **completamente inerte ao mouse**. Coberto por teste de regressão (nenhuma malha do boneco oculto registra evento de ponteiro) e validado no navegador real com um boneco oculto interposto.

### Catálogo de poses, 2ª entrega: expressivas, ação e 13 poses em par ✅ (concluído em 2026-07-26)

Fecha o catálogo combinado na 1ª entrega: **26 poses novas** — 7 expressivas (braços cruzados, mãos na cintura, acenando, comemorando, mão no queixo, cabeça baixa, assustado), 6 de ação (salto, arremesso, chute de bola, carregando caixa, escalando, subindo degrau) e 13 em par (aperto de mão, abraço, dança, cavalinho, colo, puxar para levantar, empurrão, clinche). Duas categorias novas no combo, "Expressivas" e "Em par"; o total vai para **60 poses em 8 grupos**.

O encaixe dos pares é EXATO, não aproximado: como a rotação do preset é aplicada na junta `root` e o deslocamento vertical fica fora dela, girar o segundo boneco 180° e afastá-lo `D` em Z leva um ponto `(x, y, z)` para `(-x, y, D - z)`. Cada par foi resolvido numericamente contra esse mapeamento, e a distância virou parte do resultado — está na dica da pose no painel: 0,755 m no aperto de mão (o dobro do alcance da mão, porque o encontro é no meio), 0,26 no abraço, 0,36 na dança, 0,40 no clinche, 0,467 no empurrão, 0,69 no puxão, 0,16 atrás no cavalinho. Três poses servem aos DOIS bonecos (aperto de mão, abraço, clinche), o que foi verificado aplicando a própria pose espelhada.

Duas limitações medidas fixaram distâncias: o abraço **não pode ter os peitos colados** (a cabeça do modelo só gira, nunca se desloca — a 0,20 m os dois crânios se atravessam, a 0,26 ficam livres, travado em teste como desigualdade elipsoidal) e braços cruzados **não chegam a agarrar o braço oposto** (a adução do ombro vai só a 20°). Três erros só apareceram no print, com custo numérico baixo: clinche com os cotovelos altos (parecia rendição — o que faz a pose ler é o cotovelo, não a mão), "carregado no colo" com as pernas para o alto, e mãos caindo dentro do corpo do parceiro. Também ficou a regra de que a **altura vem antes do alcance**: resolver o braço com o boneco em pé e só depois baixá-lo ao chão deixou uma mão 49 cm fora do alvo. Suíte em 945 testes verdes (20 novos); `tsc`/`eslint`/`build` limpos; validado no Chrome real, poses de um boneco de frente e de lado e os 8 pares montados. Detalhe completo em `DECISOES.md` #37.

### Catálogo de poses, 3ª entrega: meditação, postura, "deitado em X" e mata-leão sentado ✅ (concluído em 2026-07-26)

Lista nominal do usuário: **9 poses** (o "deitado em X" virou duas, de costas e de bruços), levando o catálogo a **69 poses em 8 grupos**. Três dúvidas foram levantadas antes de construir — as duas poses de postura quase repetiam "Braços cruzados" e "Mãos na cintura" (decisão: criar à parte), o X (decisão: as duas faces) e a posição de quem aplica o mata-leão (decisão: ajoelhado atrás).

O que separa "empresário" e "herói" das poses neutras é a CLAVÍCULA: `clavicle.y` positivo no lado L recua a junta do ombro 2,5 cm, e o tronco em extensão põe a junta do peito à frente da linha dos ombros — o inverso de em pé neutro, e é isso que o teste trava. Efeito colateral medido e registrado: ombro para trás encurta o alcance cruzado, então as mãos do "empresário" param ainda mais perto da linha média que as de "Braços cruzados".

Três descobertas geométricas ficaram: **de bruços a cabeça tem de virar** (o ponto do rosto cai 9,5 cm abaixo da junta da cabeça e atravessaria o piso de cara reta); **"sola no chão" são duas alturas, não uma** (só o tornozelo deixa o pé na ponta, só a ponta enterra o pé inteiro 5 cm — e o teste de juntas não pega isso, porque quem afunda é a malha); e **a pelve reclinada é o que torna "sentado com joelhos dobrados" possível** — o quadril flexiona no máximo 120° em relação à pelve, então com a pelve reta o pé para a 0,70 m à frente; reclinando 25° sobram 145° efetivos, o joelho sobe para 0,46 m, e a reclinação é literalmente o "tronco levemente para trás" pedido. No mata-leão, inclinação e distância brigam (inclinar alcança a garganta mas enfia o peito na cabeça do outro): varrendo 3 inclinações × 4 distâncias, 12°/8° a 0,45 m deixa o punho a 3,6 cm do alvo e o peito encostado na nuca, contra 6 cm de interpenetração com 30°. Suíte em 997 testes verdes (52 novos); `tsc`/`eslint`/`build` limpos; validado no Chrome real de frente, de lado e de cima. Detalhe completo em `DECISOES.md` #38.

### Cor livre para os bonecos ✅ (concluído em 2026-07-26)

Pedido do usuário: escolher qualquer cor, em vez das 5 predefinidas. O "swatch" da lista deixou de ser um botão que ciclava pela paleta e virou um `<input type="color">` nativo — ele já é o indicador da cor atual, abre o seletor do sistema e não traz dependência (só CSS para caber no mesmo círculo de 1,1 rem).

A validação mudou de **lista** para **formato**, e isso passou a ser obrigatório: a cor vai direto para o material do three.js e para o `style` do painel, e não vem só do seletor — vem também de `.glb` importado e do autosave em `localStorage`, que antes eram filtrados de graça pela checagem de pertencimento à paleta. As duas portas usam agora o mesmo `normalizeFigureColor` (normaliza para minúsculas, expande `#rgb`). A unicidade entre bonecos caiu, porque um seletor livre que às vezes não faz nada é um botão quebrado; a paleta continua, como cor padrão em rodízio para bonecos novos.

Um **bug latente** apareceu ao soltar a unicidade: `addFigure` devolvia `null` quando a paleta acabava, o que só não travava o app porque `MAX_FIGURES` e o tamanho da paleta eram iguais E as cores únicas. Com cor repetida, sobraria cor na paleta e o app recusaria acrescentar bonecos com o limite longe. Corrigido desacoplando as duas coisas, com teste. Suíte em 1001 testes verdes (4 novos, 3 reescritos); `tsc`/`eslint`/`build` limpos; validado no Chrome real. Detalhe completo em `DECISOES.md` #39.

### Mata-leão deitado e correção dos braços do "deitado em X" ✅ (concluído em 2026-07-26)

Dois pedidos na mesma leva. **Correção:** os braços das duas poses "deitado em X" apontavam para os PÉS. Deitado, o corpo fica no plano do chão e `shoulder.z` gira o braço DENTRO dele sem mudar de altura — a escala é 0 = para os pés, 90 = para o lado, 180 = para a cabeça. Os 52° herdados eram um valor pensado para o boneco em pé. Foi para 90 de costas (braços para o lado) e 145 de bruços (para o alto, sem virar flecha). O teste passou a comparar o punho com o próprio ombro: a métrica antiga (distância entre os dois punhos) não distingue "para o lado" de "para os pés" e por isso aprovava o defeito.

**Pose nova:** mata-leão deitado, os dois de barriga para cima, quem aplica por baixo com as pernas em volta do tronco. Deitado de costas inverte três coisas: levantar a cabeça é `neck.x` positivo (o negativo enterra o crânio no chão — foi o que a primeira tentativa fez), envolver o outro com as pernas é flexão de quadril (que fica cravada no limite de -120°), e os alvos das pernas precisam estar a um comprimento de coxa do quadril, senão o joelho para a meio caminho com custo baixo e resultado errado. O empilhamento é conta: 0,20 m entre os dois quadris = a soma das duas meias-espessuras de peito. Suíte em 1010 testes verdes; `tsc`/`eslint`/`build` limpos; validado no Chrome real. Detalhe completo em `DECISOES.md` #40.

### Poses em dupla aplicadas automaticamente no segundo boneco ✅ (concluído em 2026-07-26)

Pedido do usuário: com dois bonecos na cena, aplicar uma pose de par põe o outro na pose correspondente. A tabela nova (`posePairs.ts`) é a dica do painel virando dado — as mesmas distâncias que os testes de geometria já travavam, agora executadas pelo store em vez de instruídas ao usuário. Vale para exatamente dois bonecos (com três não há como saber qual é o parceiro) e deixa de fora a "guarda de luta", que é pose solo. A armadilha foi a rotação: o par é um corpo rígido girado pelo giro de encenação de quem recebe a pose, e somar graus em `rotation.y` funciona só enquanto a pose do parceiro é em pé — nas poses que já impõem rotação (colo, mata-leão deitado) isso ROLA o corpo em vez de mudar a direção, e a composição tem de ser por matriz. As duas metades saem de um `set` só, então um Ctrl+Z desfaz o par inteiro. Suíte em 1043 testes verdes (33 novos); `tsc`/`eslint`/`build` limpos; validado no Chrome real. Detalhe completo em `DECISOES.md` #41.

### Biblioteca de poses do usuário e travamento de juntas ✅ (concluído em 2026-07-26)

Pedido do usuário: os itens A.1 e A.5 da seção de ideias abaixo. Três decisões confirmadas antes de começar — inclusive a que estava marcada com ❓ no item A.5.

**Biblioteca (A.1).** Uma pose salva guarda as juntas MAIS o assentamento (inclinação e altura do quadril), escolha do usuário: sem isso, uma pose deitada voltaria em pé e atravessando o chão. O que ela nunca guarda é onde o boneco está, a altura, a cor e o nome. A biblioteca é do WORKSPACE, não da cena — é o que permite montar a pose numa cena e reaplicá-la em qualquer boneco de qualquer outra —, e persiste pelo padrão do #29: `poses.json` próprio na pasta, apontado pelo manifesto e sanitizado na leitura, mais o autosave. Na UI, as poses do usuário entram no MESMO combo das de fábrica, num grupo "Minhas poses".

**Travamento (A.5).** Uma regra só, escolhida pelo usuário: junta travada não muda por nada automático — slider, gizmo, teclado, IK, sorteio, espelho e aplicar pose. A trava é estado de trabalho (a decisão ❓): vive na sessão e no autosave, não entra no `.glb` nem no histórico de undo. Com uma junta da cadeia travada o IK para o membro inteiro em vez de aplicar meia solução — o solver é analítico de dois ossos e não sabe resolver com um preso. Suíte em 1122 testes verdes (79 novos); `tsc`/`eslint`/`build` limpos; validado no Chrome real, inclusive a sobrevivência a recarregar a página. Detalhe completo em `DECISOES.md` #42.

### Mistura entre duas poses ✅ (concluído em 2026-07-26)

Pedido do usuário: o item A.6, "de maneira simples". Um slider de 0 a 100% entre a pose do boneco e a escolhida no combo (de fábrica ou da biblioteca); o resultado é uma pose estática, não uma animação.

**A ressalva técnica do item foi validada numericamente — e reprovou o método que ela recomendava.** O plano previa quatérnio, temendo que o Euler passasse por orientações estranhas. Medido: interpolar por eixo **nunca** sai dos limites articulares (correção do clamp = 0,000000° em 6 pares × 41 passos × todas as juntas), porque uma faixa `[min, max]` é convexa; já o quatérnio sai — `elbow.R` em +99° com limite `[-150, 0]` —, e o clamp então estica o braço no meio da mistura, com salto de 0,562 m contra 0,033 m do método por eixo. A ressalva valeria para um rig de orientações livres, não para este, onde a pose É um conjunto de ângulos por eixo. O item foi corrigido abaixo.

Duas coisas que a implementação amarrou: **100% é exatamente "Aplicar pose"** (as pontas são resolvidas para o boneco antes de misturar), e a mistura **não enterra o boneco no chão** — a altura do quadril interpola em linha reta mas a geometria das pernas não, e sem correção o boneco afunda 17 cm no meio do caminho de "em pé" para "ajoelhado". Suíte em 1153 testes verdes (31 novos); `tsc`/`eslint`/`build` limpos; validado no Chrome real. Detalhe completo em `DECISOES.md` #43.

### Giro do cotovelo/joelho no IK ✅ (concluído em 2026-07-26)

Saiu da avaliação de um pedido do usuário: "travar o punho e posicionar o braço a partir do cotovelo, com o tronco e o punho travados". A avaliação mostrou que **metade já existia** — o alvo do IK já é o punho preso no espaço, e o solver nunca escreve no tronco — e que o que faltava era **um grau de liberdade só**: com as duas pontas paradas, o cotovelo percorre uma circunferência em torno do eixo ombro→mão. Esse ângulo o solver já decidia sozinho desde o #12; agora ele pode vir de um controle.

O verbo, porém, ficou separado de propósito: "travar" continua significando *não escreva nesta junta*, e quem prende a mão é o alvo do IK. **A volta inteira não é alcançável** (medido: faixa contígua de 85° a 220° de arco no braço, 25° a 105° na perna; fora dela o efetuador escapa até 88 cm), então o controle só aplica se a mão continuar no alvo — ele para na borda em vez de arrancar a mão do lugar. Na mesma leva, corrigido o aviso "Alvo fora de alcance — aproximação mais próxima aplicada", que aparecia junto com o da trava e mentia: com a cadeia travada nada é aplicado. Suíte em 1169 testes verdes (16 novos); `tsc`/`eslint`/`build` limpos; validado no Chrome real. Detalhe completo em `DECISOES.md` #44.

### Câmera de fotógrafo: lente em mm, enquadramento, ângulo e movimento ✅ (concluído em 2026-07-27)

Pedido do usuário, com duas tabelas de referência (faixas de distância focal e seus efeitos; tamanhos de plano e ângulos de câmera), para facilitar o registro de keyframes. Entrega o item 11 abaixo e vai além dele.

**A inconsistência resolvida antes de implementar:** o `fov` do three.js é vertical e a captura troca o `aspect` da câmera para o da resolução escolhida — converter milímetros pela largura do sensor (padrão do Blender) faria a mesma lente enquadrar diferente na tela e no PNG. A conversão é ancorada na ALTURA do sensor full-frame (24 mm), então "50 mm" é sempre o mesmo enquadramento vertical e capturar em quadrado recorta as laterais, como um recorte quadrado numa foto full-frame.

São três controles independentes que se compõem: a **lente** decide a distorção, o **tamanho do plano** decide o recorte (medido nos marcos do boneco — a cintura no plano médio, os ombros no primeiro plano, a junta selecionada no plano detalhe) e o **ângulo** decide de que altura se olha, preservando o lado de onde a câmera já olhava. Com um plano ativo, trocar a lente reenquadra sozinho: 24 mm e 200 mm no mesmo primeiro plano mudam a distorção do rosto, não o recorte. Entram também o ângulo holandês (com o `up` guardado no bookmark e aviso de que a órbita fica torta) e o por cima do ombro. O **movimento A→B** segue o desenho da mistura de poses (#43): as pontas guardam a câmera inteira — inclusive a lente, o que permite montar um dolly zoom — e a interpolação é feita nas coordenadas do controle (alvo em reta, direção por arco, distância e lente em progressão geométrica), para a câmera não cortar a corda numa órbita. Suíte em 1253 testes verdes (62 novos); `tsc`/`eslint`/`build` limpos; validado no Chrome real. Detalhe completo em `DECISOES.md` #46.

**Ajuste posterior (2026-07-27, pedido do usuário):** os botões desse vocabulário passaram a mostrar o TERMO EM INGLÊS — o texto que se digita num gerador de imagem, e a razão de as tabelas de referência terem uma coluna em inglês — com a tradução como legenda embaixo. Os termos ficam fora do i18n de propósito, travados por teste contra a tabela. Na sequência, corrigido um defeito relatado pelo usuário: os botões de enquadramento ficavam habilitados com um boneco na cena e nenhum selecionado, e o clique morria em silêncio — agora dependem da seleção e a dica diz qual passo falta. Ver `DECISOES.md` #47.

**Enquadramento do conjunto (2026-07-27, pedido do usuário):** sem boneco selecionado, os planos abertos (geral extremo, geral e médio) miram no ponto médio de TODOS os bonecos da cena; primeiro plano, plano detalhe e por cima do ombro continuam exigindo seleção, porque um close no meio do grupo é um close no ar. A distância passou a ser conferida contra o tronco de visão em perspectiva (`fitDistance`): medir a largura no plano do alvo deixava de fora quem estava mais perto da câmera — apareceu no navegador, com o boneco da ponta cortado. O plano médio usa a coluna do tronco (largura de ombro a ombro, medida) em vez da caixa do corpo, senão braços abertos o transformavam num plano geral. Com um boneco só, o resultado é idêntico ao do boneco selecionado. Ver `DECISOES.md` #48.

**Vocabulário de câmera completo (2026-07-27, pedido do usuário depois de uma rodada de sugestões):** seis famílias novas. **Lado relativo ao boneco** (`Front / Three-Quarter Front / Profile / Three-Quarter Back / Back`) — a lacuna maior, porque até então todo plano herdava o azimute de onde a câmera estivesse e os presets ortográficos são do mundo; é isto que torna um *turnaround* reproduzível (itens 12 e 13 abaixo). **Três degraus novos na escada de planos** (`Full Shot`, `Cowboy Shot`, `Medium Close-Up`), com `Wide Shot` passando a significar o boneco NO ambiente e `Full Shot` herdando o corpo justo. **Altura de câmera** (`Ground / Knee / Hip / Shoulder Level`), família distinta do ângulo: inclinação depende da distância, altura não. **Worm's-Eye View**, que saiu de graça do limite do chão. **Composição** (`Rule of Thirds`, `Lead Room`). **Vistas** (`POV Shot`, `Two Shot`, `Reverse Angle`) e dois movimentos (`Dolly Zoom`, `Crane`). Três defeitos só apareceram no navegador: o two shot punha um boneco atrás do outro, a câmera na altura do joelho ia parar dentro da pelve com a lente padrão de 26 mm, e o painel precisou de rótulos de família. Ver `DECISOES.md` #50.

**Enquadramento por combo (2026-07-27, pedido do usuário):** o vocabulário do #50 tinha virado trinta botões num painel estreito. Passaram a quatro combos (plano, altura/ângulo, lado, composição) com um botão "Aplicar enquadramento" que compromete tudo de uma vez, mais um combo separado para as vistas da cena — o mesmo mecanismo do combo de poses, em que escolher não aplica. Ângulo e altura foram para o mesmo combo, o que torna a exclusão mútua entre eles evidente por construção. Ver `DECISOES.md` #51.

**Contra-picado limitado pelo chão (2026-07-27, pedido do usuário):** os 30° da tabela desciam a câmera abaixo do piso nos planos abertos — quanto mais longe ela está, mais fundo o mesmo ângulo a leva. Agora a INCLINAÇÃO é limitada (não a posição corrigida depois, o que desmancharia o enquadramento): a câmera desce só até o chão, mantendo os 30° inteiros onde cabem. Ver `DECISOES.md` #49.

### Dedo indicador separado, e a adução do polegar ✅ (concluído em 2026-07-27)

Pedido do usuário: modelar polegar e indicador individualmente, deixando os três dedos restantes no bloco. A medição feita antes de implementar partiu o trabalho em dois: com a adução do polegar limitada a 40°, a menor distância possível entre a ponta dele e a linha do indicador era **2,61 cm** — o indicador separado não produziria pinça nenhuma. A mesma medição mostrou que no punho fechado o polegar parava **2,4 cm fora da borda da mão**, fechando ao lado do punho e não sobre ele, apesar do comentário do preset dizer o contrário desde a fase 2. Daí a faixa ir a 80° e o punho fechado ser reajustado com valores medidos.

O indicador é uma cadeia de 3 juntas com um grau de liberdade (flexão), ocupando o quarto radial da fileira dos nós; o bloco fica com os outros três quartos, deslocado só no DESENHO — o pivô continua na linha do punho, o que é exato porque a flexão gira em torno da própria fileira. Duas poses de mão novas (**apontando** e **pinça**) e as cinco poses de corpo que apontam trocaram a "mão-faca" do #36 por um dedo de verdade, só na mão do gesto. Poses gravadas antes disto ganham o indicador copiado do bloco na leitura, reproduzindo o gesto antigo exatamente. Esqueleto de 32 para 38 juntas; suíte em 1192 testes verdes (26 novos); `tsc`/`eslint`/`build` limpos; validado no Chrome real. Detalhe completo em `DECISOES.md` #45.

### Fase 10 — Mini animador ✅ (planejada e concluída em 2026-07-27)

Pedido do usuário. Antes de planejar, quatro ambiguidades entre o pedido e o código foram levadas a ele e decididas (colisão do nome "keyframe", correção de chão da mistura de poses, onde a animação vive, e o destaque de junta que saía no PNG) — ver `DECISOES.md` #52. A fase mudou o escopo declarado do projeto: "geração de animações" saiu de "fora de escopo".

**Entregue:**

- **Renomeação `keyframe` → `snapshot`/"instantâneo"** (passo 0, para destravar a palavra): `src/snapshot/`, `SnapshotCapture.tsx`, `snapshotCaptureStore.ts`, `SnapshotPanel.tsx`, `formatSnapshotFilename`, `nextSnapshotNumber`/`consumeSnapshotNumber`, as chaves `panels.snapshots.*` nos dois idiomas e a descrição do atalho `Espaço`. O formato da cena passou a gravar `snapshotCounter` **lendo também o `keyframeCounter` antigo** (adição de campo, sem subir `SCENE_EXTRAS_VERSION`), e o prefixo do arquivo foi de `kf###` para `snap###` continuando a mesma contagem por cena.
- **`src/animation/animation.ts`**: o modelo — `Animation`/`AnimationKeyframe` (retrato completo da cena + `CameraViewState` + duração da transição que CHEGA ao keyframe), grampeamento de duração, duração total, instantes de cada keyframe, nome do arquivo de vídeo e a sanitização de dado não confiável (autosave e `animations.json`).
- **`src/animation/animationSampler.ts`**: `sampleAnimation(animation, timeMs)`. Câmera pelo `interpolateCameraView` (#46) sem alteração; pose pelo cálculo por eixo do `blendPoses` (#43) **com a correção de chão desligada**; posição INTEIRA interpolada (a mistura de poses só carregava `positionY`, porque acontece parada no lugar); nome, cor, visibilidade e altura em degrau, com o valor da partida; conjunto de bonecos do trecho vindo do keyframe de partida; pontas devolvendo o keyframe idêntico.
- **`src/animation/frameTimeline.ts`**: `round(total/1000 × fps)` intervalos **mais o quadro final** — 1 s a 30 fps são 31 quadros, do instante 0 ao 1,0 inclusive.
- **`src/animation/videoExport.ts`**: o laço (`exportFrames`) separado da ponte com a `mediabunny` (`createMp4Sink`, `pickVideoCodec`, `toEvenDimension`). O laço não sabe o que é MP4 nem WebCodecs, e por isso é testado sem GPU.
- **`src/scene/sceneCapture.ts`** (extraído do `SnapshotCapture.tsx` e compartilhado com o vídeo): esconder overlays, **apagar o destaque emissivo da junta selecionada**, ajustar a proporção de saída e renderizar na resolução escolhida. É esta peça única que faz o MP4 mostrar exatamente o que sai no PNG.
- **`src/scene/AnimationPlayer.tsx`**: dentro do `<Canvas>`, executa os comandos (capturar, regravar, ir para, exportar), toca a animação por `requestAnimationFrame` publicando um estado de PRÉ-VISUALIZAÇÃO — a cena de trabalho nunca é tocada — e roda a exportação quadro a quadro.
- **Estado e persistência**: as animações são conteúdo do WORKSPACE no `figuresStore` (undo + autosave, como a biblioteca de poses) e vão para um `animations.json` na pasta do workspace, apontado pelo manifesto; `animationStore.ts` guarda o que é ferramenta (animação aberta, linha do tempo, fps, resolução, andamento da exportação), fora do undo. Desde a fase 12, esse mesmo formato é também o **arquivo avulso** que o painel exporta e importa, sem depender de workspace em pasta.
- **`AnimationPanel`** (sétima coluna, **nasce recolhido**): combo de animações, criar/renomear/remover, capturar keyframe, lista de keyframes com duração editável (confirma ao sair do campo), ir para/regravar/reordenar/remover, linha do tempo que **navega de verdade** (arrastar mostra aquele instante na tela) com tocar/parar, fps, resolução, exportar MP4 com progresso e cancelamento, e mensagens próprias para cada bloqueio.
- **`mediabunny` 1.51.0** (MPL-2.0, zero dependências de runtime) — peso medido: **+159,84 kB no bundle (+41,45 kB comprimido)**.

**95 novos testes automatizados** — suíte completa em **1.411 testes**, todos verdes; `tsc -b`, `eslint .` e `npm run build` limpos.

**Validação no navegador** (Chrome headless via Playwright, sobre `npm run preview`), sem nenhum erro de console: três keyframes capturados com poses e enquadramentos diferentes, "ir para" devolvendo a cena ao retrato, reprodução na tela, e um **MP4 real gerado** — 265.512 bytes, caixa `ftypisom`, 15 quadros a 24 fps a 1080×1080. **Medição obrigatória do plano, feita:** com 5 bonecos, a reprodução não acrescentou nenhum intervalo de vsync ao tempo por quadro (166,7 ms parado × 166,6 ms tocando), ou seja, o custo do commit de React ficou abaixo dos 16,7 ms de resolução da medição — muito abaixo do limite de ~30 ms que mandaria trocar pelo caminho imperativo. Detalhes, achados e correções em `DECISOES.md` #52.1.

**Não entregue, de propósito:** suavização de entrada/saída da interpolação (o pedido era usar o mecanismo existente, que é linear) e a máscara de *letterbox* no viewport para a proporção de saída — as duas ficaram como ideias, dependendo de decisão do usuário. *(A máscara foi pedida e construída em seguida, ainda em 2026-07-27 — ver a entrega logo abaixo e `DECISOES.md` #53.)*

### Máscara de enquadramento e caixa da pose em dupla ✅ (concluído em 2026-07-27)

Duas coisas pedidas logo depois da fase 10 — a primeira era um item que aquela fase deixou anotado e não construiu. Ver `DECISOES.md` #53; duas escolhas de desenho foram confirmadas com o usuário antes de começar.

- **Máscara de enquadramento (letterbox) no viewport.** Um seletor na Toolbar com três estados — sem máscara / do instantâneo / da animação —, porque as duas saídas têm resoluções independentes. O retângulo claro é o que a saída vai conter; o resto fica escurecido, com contorno fino. **Não é só um desenho:** a câmera se afasta (por `setViewOffset`, sem tocar no `camera.zoom`, que já é do `CameraRig` na projeção ortográfica) até o quadro inteiro caber na janela — sem isso o retângulo mentiria sempre que a saída fosse mais larga que a área de desenho, que é o caso comum com sete painéis abertos. `applyOutputAspect` suspende o afastamento na hora de exportar, então PNG e MP4 saem intactos. As barras são DOM, e por isso não têm como vazar para o arquivo. O arrasto de deslocamento é compensado por `panSpeed = 1/fit`, senão a cena andaria mais devagar que o cursor.
- **Caixa "Posar também o outro boneco"** no painel de Propriedades, ligada de fábrica (o comportamento do #41) e persistida. Aparece só quando há um par para montar — pose em dupla e exatamente dois bonecos. Desmarcada, aplicar a pose deixa o outro boneco intocado e o aviso passa a dizer que a montagem é manual. `applyPosePreset` ganhou um parâmetro opcional; o padrão continua montando o par.

**23 testes novos**, suíte em **1.434 testes**, todos verdes; `tsc -b`, `eslint .` e `npm run build` limpos (**+4,13 kB** no bundle). Validado no Chrome real sem erro de console, numa área de desenho quase quadrada de 1166×1186: proporções da máscara medidas (1,7778 e 1,0000, centradas), **o PNG exportado saiu byte a byte idêntico com e sem máscara**, a silhueta do boneco dentro do retângulo e no arquivo de 1920×1080 difere no máximo **0,12% do quadro**, o arrasto andou 176,4 px sem máscara × 174,7 px com (seriam ~97,5 px sem a compensação), e a pose em dupla pôs o parceiro a 0,755 m só com a caixa marcada.

### Fim da reprodução e keyframe intermediário ✅ (concluído em 2026-07-28)

Dois ajustes no animador pedidos pelo usuário. Ver `DECISOES.md` #54.

- **Chegar ao fim da linha do tempo larga a pré-visualização.** A reprodução já parava (conferido no Chrome antes de mexer); o que faltava era soltar o retrato da animação, que enquanto está na tela esconde a cena de trabalho e faz qualquer edição não aparecer — era preciso apertar "Parar". Agora a câmera e a linha do tempo ficam no instante final, e só os bonecos voltam a ser os da cena. Pausar e navegar continuam segurando a pré-visualização de propósito: ali o usuário pediu para ver aquele instante.
- **Botão "Inserir keyframe aqui"**, que corta o trecho no instante da linha do tempo. O keyframe novo guarda o que já se via ali e a duração se reparte entre as duas metades, então **a animação continua exatamente a mesma** — é um ponto de ajuste, não uma edição. Desabilitado em cima de um keyframe, nas pontas e durante a reprodução; depois de inserir, navega até o keyframe criado.
- **`splitCameraView`** (novo, em `animationSampler.ts`): a câmera que o keyframe do corte guarda. Igual ao `interpolateCameraView` exceto pelo topo da tela, guardado **antes** de ser reendireitado — sem isso a inclinação lateral divergiria no meio do trecho (medido: 1,46° num par comum, 3,29° com ângulo holandês). Como os dois vetores geram o mesmo plano com a direção de visão, a imagem é idêntica.

**20 testes novos**, suíte em **1.454 testes**, todos verdes; `tsc -b`, `eslint .` e `npm run build` limpos. Validado no Chrome real sem erro de console: editar logo após o fim da animação passou a mudar a tela; inserir a 600 ms de um trecho de 1000 ms deu 600 + 400 com o total intacto (e 300 + 300 + 400 ao inserir de novo); e os quadros em 200, 400, 600 e 800 ms saíram **pixel a pixel idênticos** antes e depois da inserção.

### Correção do vídeo exportado, cópias de câmera e de pose, e novos padrões ✅ (concluído em 2026-07-28)

Quatro pedidos do usuário na mesma leva. Ver `DECISOES.md` #55.

- **O vídeo exportado não era a animação** — o sintoma relatado ("o último quadro aparece rápido no início") era a ponta disso. O `<Canvas>` do `@react-three/fiber` entrega os filhos por um reconciliador próprio, com um `root.render()` chamado dentro de uma função **assíncrona**: o `flushSync` do `react-dom` não esvazia aquela fila, e nem o `flushSync` do próprio R3F alcança o que chega pela prop `children`. O laço de exportação renderizava a cena do quadro anterior. Corrigido em duas partes: usar o `flushSync` do `@react-three/fiber` e — a estrutural — mover os bonecos para dentro do `<Canvas>` (**`SceneFigures.tsx`**, que assina as lojas lá dentro), de modo que a pré-visualização vire trabalho direto no root do R3F.
- **Copiar a câmera do keyframe vizinho**, dois botões por card: leva só a câmera, deixando pose e duração intactas.
- **Copiar a pose de um boneco para outro**, no painel de Propriedades: combo de destino mais botão. Reusa `captureFigurePose` + `withPose`, então herda todas as regras da biblioteca de poses (leva o assentamento, não leva lugar/altura/cor/nome, respeita juntas travadas).
- **Padrões novos:** lente **35 mm** (37,849° verticais, contra 26,991° dos 50 mm anteriores), **60 fps** de padrão com o seletor mantido, e **720p** acrescentado à lista de resoluções — padrão só do vídeo; o instantâneo continua em Full HD.

**17 testes novos**, suíte em **1.471 testes**, todos verdes; `tsc -b`, `eslint .` e `npm run build` limpos. Validado no Chrome real sem erro de console, com uma medição comparável ponto a ponto (PNG exportado pelo app × quadros do MP4, mesma resolução): antes, o primeiro quadro do arquivo era a cena de trabalho e o resto avançava aos saltos; depois, o vídeo bate com a referência em todos os quadros, com diferença máxima de **0,0009** (ruído de compressão). Copiar pose e copiar câmera conferidos pelos valores nos campos do painel.

### Redutor/acelerador global da animação ✅ (concluído em 2026-07-28)

Pedido do usuário: um multiplicador de velocidade preenchido à mão, para toda a linha do tempo. Ver `DECISOES.md` #56; a inconsistência do enunciado ("uma casa decimal" contra o exemplo `1.15`) e mais duas escolhas foram confirmadas com o usuário antes de começar — duas casas de 0,05 em 0,05, faixa de 0,1 a 5,0, e o valor guardado **na animação**.

- **Campo "Velocidade (×)"** no painel de Animação, com a dica mostrando quanto o vídeo vai durar. Vale para a reprodução na tela **e** para o vídeo: o que se vê tocando é o que sai no arquivo. Confirmado ao sair do campo, como a duração do trecho.
- **A linha do tempo não se mexe.** Os keyframes continuam nos mesmos instantes e as durações digitadas continuam valendo o que dizem — a velocidade é a taxa com que se anda pela linha do tempo, não uma reescrita dela. Voltar a 1,00 devolve exatamente o que havia.
- **Propriedade da animação, não do painel:** entra no undo, no autosave e no `animations.json` (com linha própria no leiame). Ajuste de ferramenta voltaria a 1,00 a cada recarregamento e o vídeo sairia diferente sem ninguém ter mexido nele.
- **Novas funções puras:** `clampAnimationSpeed` (grade de 0,05, faixa grampeada, valor exato de duas casas), `animationOutputDurationMs` (`linha do tempo ÷ velocidade`) e `sampleAnimationOutput` (converte o relógio do arquivo para o da animação). A exportação passou a gerar os quadros sobre a duração de saída.

**19 testes novos**, suíte em **1.490 testes**, todos verdes; `tsc -b`, `eslint .` e `npm run build` limpos. Validado no Chrome real sem erro de console, medindo o centroide da silhueta em cada quadro do MP4: a 0,50 o arquivo tem **41 quadros e 1,64 s** (contra 21 e 0,84 s a 1,00, e 11 e 0,44 s a 2,00), e os quadros **pares** do vídeo a 0,50 repetem a rampa inteira da velocidade normal com diferença máxima de **0,0005**. A reprodução na tela foi medida pela taxa (duas linhas do tempo, custo fixo cancelado): 4 s a mais levaram 3.831 ms a 1,00, 7.981 ms a 0,50 e 1.959 ms a 2,00. A velocidade sobrevive a Ctrl+Z e a recarregar a página.

### Ferramentas de criação de poses padrão ✅ (concluído em 2026-07-28)

Os itens 1, 3 e 4 do levantamento sobre como otimizar a criação de poses (pedido do usuário). Ver `DECISOES.md` #57. O ritual de arquivos já era seguro — o custo estava em **inventar os números às cegas**.

- **`seatOnGround`** (`src/figure/poseGround.ts`): a busca numérica de assentamento, que era refeita à mão a cada pose, virou função. A referência de "encostado no chão" é **medida da pose neutra** (a junta mais baixa do boneco em pé está a 0,0100 m do chão, não em zero), então a pose em pé assenta em zero por construção. Levanta **e baixa**, ao contrário da correção do `poseBlend` (#43), que só levanta de propósito. Confrontada com as 71 poses afinadas à mão: mediana de **3,4 mm**, **59 dentro de 1 cm**, e as 9 que divergem mais de 5 cm são exatamente as que não pisam no chão (voando, no ar, carregadas por outro boneco) — o que a torna também um detector de pose flutuando.
- **`poseCodegen` + `npm run pose:preset`** (`src/figure/poseCodegen.ts`, `tools/pose-para-preset.mjs`): posar no app, salvar na biblioteca e colher o bloco de preset pronto. `SavedPose` já carregava exatamente o que um preset precisa; faltava a tradução, que sabe as cinco coisas que uma cópia crua perderia (preset parcial, torção neutra do cotovelo, poses de mão, `hipHeightM`, e o `rotation` que define o `preservesHeading`). **Ida e volta travada por teste nas 71 poses**, com uma reexpansão escrita independentemente no teste. Emite avisos (pose flutuando, pose atravessando o chão, mão sem preset) e a lista do que só a mão faz.
- **`npm run poses:folha`** (`tools/folha-de-contato.mjs`): folha de contato com todas as poses num PNG só, em duas vistas — a padrão (plano geral, já um 3/4 de frente) e a mesma girada 40°, perto do perfil, que é a que mostra a profundidade das poses. Cada célula é um **instantâneo do app** (que já esconde grade, gizmos e destaque de junta — captura de tela poria o gizmo de seleção em todas), com a câmera em **perspectiva "plano geral", fixa**: as duas alternativas ortográficas foram renderizadas e descartadas por medição (a de frente vira borrão nas poses deitadas, a de 3/4 não enquadra). O Playwright continua fora do `package.json`, com `--playwright=<caminho>` para quem já o tem.

**163 testes novos** (11 do assentamento, 152 do gerador — dos quais 142 são a ida e volta pose a pose), suíte em **1.653 testes**, todos verdes; `tsc -b`, `eslint .` e `npm run build` limpos.

### Apoiar no chão e espelho ao vivo ✅ (concluído em 2026-07-28)

Os itens **33** e **3** da lista de propostas, pedidos pelo usuário junto com o lembrete da referência invertida dos lados. Ver `DECISOES.md` #58.

- **Botão "Apoiar no chão"**: sobe ou desce o boneco até a pose encostar no solo, sem tocar na pose nem no lugar dele, usando o `seatOnGround` do #57. Entra no undo. Aparece nas **duas** seções do painel — a validação no navegador mostrou na hora por quê: depois de dobrar um joelho quem está posando tem uma junta selecionada, e voltar à raiz só para apoiar seria atrito no pior momento.
- **Caixa "Espelhar edições ao vivo"**: cada ajuste numa junta pareada escreve no par a **reflexão sagital `(x, −y, −z)`**, reusando `mirrorRotation` — a referência dos lados é invertida (as juntas pareadas são espelhadas só em posição), então copiar o valor cru erraria até 0,95 m, e no polegar cairia fora da faixa do outro lado e seria grampeado a zero. Intercepta `setJointRotation`, o caminho de toda edição de junta (slider, gizmo, teclado, IK). Espelha a rotação inteira, não o eixo mexido; junta travada ganha do espelho (#42); é modo de trabalho, fora do undo, e não sobrevive a recarregar a página.

**18 testes novos**, suíte em **1.671 testes**, todos verdes; `tsc -b`, `eslint .` e `npm run build` limpos. Validado no Chrome real sem erro de console: apoiar devolveu ao chão um boneco erguido a 0,5 m e **baixou** para −0,355 m o boneco com os dois joelhos dobrados (o mesmo valor do teste de unidade); o espelho levou `shoulder.L z = 35` para `shoulder.R z = −35`, respeitou a trava do lado direito e parou de agir ao ser desligado.

### Zerar por grupo e copiar só um membro ✅ (concluído em 2026-07-28)

Os itens **4** e o resto do **2** da lista de propostas. Ver `DECISOES.md` #59.

- **Zerar por grupo:** seis botões (tronco, cabeça, dois braços, duas pernas) com os rótulos dos mesmos grupos do combo de seleção de junta, nas duas seções do painel. Devolve à pose **neutra**, não a zeros literais — `elbow.*.y` tem torção neutra de ±90 (#25), e escrever zero deixaria o antebraço com a palma para trás. Junta travada sobrevive; grupo inteiro travado deixa o botão desabilitado, sem sequer empilhar undo. A mão vai junto com o braço (é assim que `JOINT_GROUPS` já a agrupa), e um "zerar só as mãos" seria redundante com a pose de mão "aberta".
- **Copiar só um membro:** combo "O que copiar" ao lado do destino, com "Pose inteira" mais os seis grupos. Com grupo, vão só aquelas juntas e a **colocação de quem recebe não é tocada** — o assentamento é propriedade da pose inteira, e aplicá-lo por causa de um braço tiraria o boneco do chão onde ele estava.

**14 testes novos**, suíte em **1.685 testes**, todos verdes; `tsc -b`, `eslint .` e `npm run build` limpos. Validado no Chrome real sem erro de console: zerar o braço direito levou `shoulder.R.x` de −55 a 0 e `elbow.R.x` de −80 a 0 mantendo `elbow.R.y = −90`, com a perna esquerda intacta em 45°; o botão "Cabeça" ficou desabilitado com pescoço e cabeça travados; e copiar só o braço esquerdo levou `shoulder.L.x = −70` sem mexer no joelho do destino nem tirá-lo de X=2.

### Trechos de animação prontos (solo e em dupla) ✅ (concluído em 2026-07-28)

Pedido do usuário: trechos de animação predefinidos, análogos às poses de fábrica. Ver `DECISOES.md` #60, com as decisões tomadas em conjunto (entra no **final** da linha do tempo; papéis por **combos**; andar/correr **deslocam** no espaço; **câmera atual congelada** em todos os keyframes).

- **`src/animation/animationClips.ts`**: 14 trechos — andando, correndo e pulando (individuais); dança, aperto de mão, **empurrar e girar** (a entrada para golpes por trás, complemento pedido na mesma conversa), cavalinho, pegando no colo, clinche, soco, chute e mata-leão em pé/sentado/deitado (duplas, com os mata-leões **começando em pé, B de costas**). De 5 a 15 passos por trecho (89 no total), cada passo declarado como pose de fábrica + desvios, com os contatos usando as poses em par **nas distâncias medidas de `posePairs.ts`** (travado por teste) e o assentamento das fases novas calculado pelo `poseGround` (#57) em vez de estimado.
- **`appendAnimationClip`** (figuresStore): um keyframe por passo, ancorado na posição e no heading do boneco do papel A, quem não participa parado em todos os passos, tudo numa única edição de undo — a cena de trabalho não muda.
- **Painel**: fieldset "Trechos prontos" com combo agrupado, dica por trecho, combos de papel A/B (B não lista o boneco de A) e botão com as mesmas condições da captura.

**51 testes novos**, suíte em **1.726 testes**, todos verdes; `tsc -b`, `eslint .` e `npm run build` limpos. Validado no Chrome real sem erro de console: 9/15/22 keyframes acumulados por três trechos, papéis nos combos, reprodução, **um** Ctrl+Z removendo o trecho inteiro, e capturas conferindo o impacto do soco, a chave sentada e o mata-leão no chão.

### Poses e trechos de dança pop (K-pop) ✅ (concluído em 2026-07-28)

Pedido do usuário: poses e trechos de animação para posições comuns de dança do K-pop, seguindo o processo de `CRIACAO-PRESETS.md`. Ver `DECISOES.md` #62.

- **4 poses novas** (grupo "Dança pop" em `posePresets.ts`): `kpopFingerHeart` (coração com os dedos, mão `pinch`), `kpopBoxArms` (braços de robô em ângulo reto, resolvido com custo numérico zero), `kpopPointDance` (quadril deslocado, reaproveitando a base de `model` e o braço de `pointUp`) e `kpopShoulderWave` (isolamento de ombro pela clavícula). Todas resolvidas por varredura numérica, sem ângulo estimado.
- **4 trechos solo novos** (`animationClips.ts`): um por pose, 5 a 7 passos, sem deslocar o boneco no chão. `kpopPointDance` e `kpopShoulderWave` usam `mirror: true` para a própria troca de lado ser o passo de dança; `kpopBoxArms` alterna qual braço recolhe ao neutro (o "pêndulo" do robô).

**12 testes novos**, suíte em **1.764 testes**, todos verdes; `tsc -b`, `eslint .` e `npm run build` limpos. Validado no Chrome real sem erro de console: as 4 poses aplicadas e capturadas pelo combo, e os 4 trechos somando exatamente 25 keyframes numa animação nova.

### Joelhada na barriga com cambalhota ✅ (concluído em 2026-07-28)

Pedido do usuário, com foto de referência: poses em dupla de uma joelhada e um trecho em que os dois começam em repouso, A crava o joelho e B dá uma cambalhota no ar em torno do joelho, caindo sentado de costas para A. Ver `DECISOES.md` #63.

- **Par de poses `kneeStrikeGiving`/`kneeStrikeTaking`** (grupo `fight`): resolvido pela mesma ordem do soco/chute — primeiro a reação (dobrada, mais fechada que `kickTaking`), depois a perna varrida até o JOELHO (não o pé) bater na altura da barriga. Encaixe a 0,3653 m — bem mais perto que soco/chute, golpe de clinche.
- **Trecho `kneeStrike`**: repouso → guarda → clinche (reaproveitado) → joelhada → cambalhota → pouso sentado de costas. A cambalhota exigiu uma correção de codificação de rotação (`rotation` por extenso em vez de compor com `turnDeg`) para não rasgar um giro espúrio na interpolação eixo a eixo do player — verificado por matriz que é a mesma rotação física, só reescrita numa forma que interpola limpo.

Suíte crescendo de 1.764 para **1.786 testes**, todos verdes; `tsc -b`, `eslint .` e `npm run build` limpos. Validado no Chrome real sem erro de console: o par encaixando automaticamente com dois bonecos em cena, e as capturas dos 3 keyframes-chave do trecho (contato, pico invertido sobre A, pouso sentado atrás dele) confirmando a sequência inteira.

### Chave de braço sentada (empurrão/puxão) ✅ (concluído em 2026-07-29)

Pedido do usuário, descrito por texto (a leitura inicial da foto de referência estava errada — corrigida pelo usuário): A agachado atrás de B sentado, uma perna travando a perna direita dele e o joelho nas costas, prendendo o braço direito de B e segurando o punho — empurra com o peso do corpo e depois puxa rapidamente para trás, no limite da articulação. Ver `DECISOES.md` #64.

- **4 poses novas** (grupo `fight`): `armLockPushGiving`/`Taking` (instante do empurrão) e `armLockPullGiving`/`Taking` (instante do puxão final). Pernas de A resolvidas por varredura para o joelho chegar à altura da coluna de B; braço da chave de B e braço que segura o punho de A resolvidos contra alvos numéricos (behind-the-back e o próprio punho preso). Encaixe do par: **gapM = 0,238 m**, `facing: false` (A atrás, mesma família de `rearChokeKneeling`).
- **Trecho `armLock`**: repouso em pé → A se aproxima (B senta) → os dois no lugar → a chave fecha (empurrão) → puxão final. B fica parado; quem se desloca é A, vindo de trás — mesmo padrão de `rearChokeSeated`.
- **Lição da sessão**: a primeira validação visual (vista 3/4 padrão) pareceu mostrar A sentado em cima da cabeça de B — mas trocando para as vistas ortográficas do painel de câmera (lateral/topo/frente), a pose se mostrou correta; o ângulo padrão é que enganava. Ajustado ainda assim o braço "prende" de A para tirar o efeito de laço acima das cabeças.

Suíte crescendo de 1.786 para **1.815 testes**, todos verdes; `tsc -b`, `eslint .` e `npm run build` limpos. Validado no Chrome/dev real sem erro de console: o par encaixando automaticamente nos dois instantes, o trecho somando 5 keyframes, e capturas em 4 vistas (3/4, lateral, topo, frente) confirmando a leitura correta da pose.

### Nove itens de animação: bancada, régua no rodapé, grupos e biblioteca de trechos ✅ (concluído em 2026-07-29)

Pedido do usuário: implementar os itens **27, 28, 29, 30, 34, 36, 37, 38 e 39**, na ordem que a avaliação de conflitos deste documento indicou — 36 (a base) → 34 → 28 → 27 → 29 → 38 → 37 → 39 → 30. Ver `DECISOES.md` #65.

- **Bancada única (36):** a animação de trabalho nasce da primeira captura, no MESMO passo de undo; nomear e guardar faz uma cópia na biblioteca, e abrir uma salva substitui a bancada (contrato dos snapshots de cena). `activeAnimationId` saiu do `animationStore` — com uma bancada só, a pergunta deixou de existir.
- **Barra da linha do tempo no rodapé (29 + 27):** `TimelineBar.tsx`, largura inteira, recolhível e nascendo recolhida; marcas dos keyframes, passo de exatamente 1/fps, pular keyframe, transporte e a caixa **Repetir**. No painel ficou o que é edição; na barra, o que é navegação.
- **Grupos rotulados (38):** rótulo por keyframe, consecutivos iguais colapsando, cabeçalho recolhível e faixas na régua; o trecho pronto já entra rotulado, e o sufixo resolve a segunda inserção sozinho.
- **Trechos em vários bonecos (37) e trechos do usuário (39):** o papel A dos trechos individuais aceita uma lista de bonecos; e `clips.json` guarda faixas da linha do tempo como trechos reutilizáveis — keyframes literais **sem câmera**, papéis em vez de bonecos, reancorados na posição e no heading de quem os recebe.
- **Pausa, ciclo, pose do vizinho, movimento de câmera e miniaturas (28, 27, 34, 30):** duplicar keyframe, fechar o ciclo, copiar a pose do vizinho, "gerar keyframes deste movimento" no painel de câmera, e um retrato pequeno por keyframe guardado só em memória.

**+132 testes**, suíte de 1.815 para **1.947**, todos verdes; `tsc -b`, `eslint .` e `npm run build` limpos. Validado no Chrome real sobre o `preview`, sem erro de console: captura criando a animação sozinha, biblioteca salvando/reabrindo, trecho aplicado a dois bonecos de uma vez (+9 keyframes) virando os grupos "Andando 1" e "Andando 2", recolher escondendo os 9 cards, 20 marcas e as faixas na régua, o passo de um quadro medido (1000 → 1017 ms a 60 fps), trecho salvo de 2 papéis reaplicado e reancorado, 17 miniaturas geradas, o movimento A→B virando 2 keyframes e a reprodução em laço.

### Rolagem horizontal nos painéis e a ordem de Animação e Instantâneos ✅ (concluído em 2026-07-29)

Pedido do usuário: tirar a rolagem horizontal do painel de Propriedades ("Copiar pose para" e "O que copiar" na mesma linha) e do painel de Animação (os botões da biblioteca na mesma linha), pondo cada controle em sua própria linha; e posicionar **Animação antes de Instantâneos** da esquerda para a direita. Ver `DECISOES.md` #66.

- **A causa comum:** `.panel` tem `overflow-y: auto`, e pelo CSS um `overflow-x: visible` não sobrevive a isso — computa para `auto`. Todo painel já era um contêiner de rolagem horizontal à espera de um filho largo demais, e ~13,5 rem úteis não comportam nem dois selects rotulados nem quatro botões lado a lado.
- **Copiar pose em coluna**, mais `min-width: 0` no `<select>` (que não tinha regra e não encolhe abaixo da opção mais comprida — voltaria a empurrar o painel na primeira lista longa).
- **Botões da biblioteca empilhados**, com padding e fonte de volta ao tamanho normal: dois por linha deixavam ~95 px e cortavam "Regravar a salva" — era o que obrigava o padding apertado de antes. A classe virou `animation-panel__buttons`, porque um seletor chamado "row" que renderiza coluna engana o próximo leitor.
- **Ordem trocada no `AppShell`** e travada por teste sobre os `aria-label` dos painéis; `.panel--animation` entrou na lista dos que se separam pela borda esquerda, tirando a linha dupla contra o vizinho.

Suíte de 1.947 para **1.948**, todos verdes; `tsc -b`, `eslint .` e `npm run build` limpos. Medido no Chrome real: `scrollWidth - clientWidth` em **0** nos dois painéis (era positivo), ordem lida do DOM conferida e nenhum erro de console. **Fica aberto** um estouro de 19 px no painel de **Câmera** (um `<fieldset>` do bloco "Enquadramento") — mesmo defeito, painel que o pedido não citava.

### Botões do card, captura fixa no topo e papel-cebola ✅ (concluído em 2026-07-29)

Pedido do usuário, em duas partes: arrumar os botões de cada card de keyframe em quatro linhas fixas, deixar "Capturar keyframe" mais largo, destacado e **grudado no topo** ("a rolagem só ocorre depois dele"); e implementar o **item 31 (papel-cebola)**. Ver `DECISOES.md` #67.

- **Quatro linhas declaradas no JSX** — `Ir para / Regravar`, `Câm ↑ / Câm ↓`, `Pose ↑ / Pose ↓`, `↑ / ↓ / Duplicar / ×` — em vez da fila única que quebrava sozinha com um `nth-child` decidindo larguras. Cada linha vira um assunto: keyframe, câmera, pose, ordem da lista.
- **Barra de captura `sticky`** antes de tudo, com margens negativas anulando o padding do painel, botão em cor sólida e o aviso de "por que não dá para capturar" viajando junto — desabilitado no topo com o motivo fora da vista não explicaria nada.
- **Papel-cebola (31):** `onionSkin.ts` (leitura, sem WebGL) + `OnionSkin.tsx` (desenho) + o `ghost` do `Figure.tsx`, que além de translúcido/sem sombra/sem gizmo **suprime os nomes de cena** — `getObjectByName('figure-<id>')` do `CameraRig` devolve o primeiro da travessia e enquadraria um fantasma. Grupo em `OVERLAY_NAMES`: fora do PNG e do MP4 pela regra que já existia. Some enquanto toca ou exporta.
- **Bug corrigido no caminho:** "Ir para" carregava o retrato do keyframe na cena mas não movia o playhead — a régua do rodapé marcava 0,0s mostrando o keyframe 3, e o papel-cebola ancorava no keyframe errado (os fantasmas caíam em cima do boneco e a cena só ficava "lavada").

**+25 testes**, suíte de 1.947 para **1.972**, todos verdes; `tsc -b`, `eslint .` e `npm run build` limpos. Validado no Chrome real: as quatro linhas lidas do DOM na ordem pedida, rolagem horizontal em 0, o botão de captura continuando no topo depois de rolar 600 px, e o papel-cebola medido por contagem de pixels (no keyframe do meio, frios 479 → 15.435 e quentes 50.460 → 67.043 ao ligar; tocando, volta à linha de base).

### Área de transferência de poses ✅ (concluído em 2026-07-29)

Pedido do usuário: copiar temporariamente uma pose para replicar em outra cena ou boneco, **só em memória**, no rodapé do painel de Bonecos e com cada pose capturada apagável. Ver `DECISOES.md` #68.

- **`poseClipboardStore` à parte, e isso é o recurso:** carregar uma cena substitui figuras, animações e biblioteca de poses de uma vez — dentro do `figuresStore` a lista seria apagada justamente no gesto que ela serve. Fora dele, sobrevive à troca de cena e fica naturalmente fora do undo, do autosave e dos arquivos.
- **Cada entrada é uma `SavedPose`** da mesma `captureFigurePose` da biblioteca (#42): juntas mais assentamento, com a altura do quadril desfeita da escala de origem e refeita na de quem recebe. Deitado volta deitado; 1,50 m e 1,90 m assentam igual.
- **`pasteFigurePose`** é o único acréscimo ao `figuresStore` — mesmo `withPose` de `applySavedPose`, mesmas juntas travadas, um passo de undo. Colar altera conteúdo; a lista é ferramenta.
- **No painel de Bonecos, não em Propriedades:** a lista é da sessão, não do boneco selecionado — em Propriedades sumiria a cada troca de seleção, que é o gesto entre copiar e colar. Nomes repetidos ganham sufixo `(2)`, e sem seleção os botões desabilitam **dizendo por quê**.

**+18 testes**, suíte de 1.972 para **1.990**, todos verdes; `tsc -b`, `eslint .` e `npm run build` limpos. Validado no Chrome real: duas cópias virando "Boneco 1"/"Boneco 1 (2)", apagar só uma, a entrada sobrevivendo a trocar de cena e a carregar um snapshot, colar mudando o cotovelo de 0° para −60°, recarregar a página esvaziando a lista (a decisão do usuário) e rolagem horizontal do painel em 0.

### Confirmação ao regravar, "Inserir" na barra e o nome da animação junto da biblioteca ✅ (concluído em 2026-07-29)

Pedido do usuário: confirmar antes de regravar um keyframe (por cliques indevidos); mover "Inserir keyframe aqui" para a barra da linha do tempo, com o mesmo destaque de "Capturar keyframe"; e tirar o nome da animação do início do painel, aproximando-o do combo de animação salva. Ver `DECISOES.md` #69.

- **Regravar em dois passos:** aviso em vermelho mais `Confirmar`/`Cancelar` no lugar da primeira linha do card — o padrão do "novo workspace" (#31), a outra ação que um clique não desfaz. Um id em confirmação por vez: abrir a de outro card fecha a anterior, senão seriam duas chances de clicar na errada. Só "Regravar" confirma; os demais botões do card são reversíveis à vista ou não perdem nada, e confirmação em tudo vira ruído que se clica no automático.
- **"Inserir keyframe aqui" na barra:** ele corta o trecho no instante do playhead, e o playhead mora lá — no painel, a decisão ficava numa ponta da tela e a ação na outra. A aparência de destaque virou uma regra só para os dois botões; duplicá-la faria os destaques divergirem no primeiro ajuste de tema.
- **Nome da animação dentro da biblioteca:** é o que vira o nome do MP4 e o padrão de "Nome para guardar", logo abaixo. No topo ele separava capturar da lista de keyframes sem relação com nenhum dos dois.

**+3 testes**, suíte de 1.990 para **1.993**, todos verdes; `tsc -b`, `eslint .` e `npm run build` limpos. Validado no Chrome real: confirmação aparecendo, cancelando e confirmando; "Inserir" com zero ocorrências no painel e uma na barra, estilo computado idêntico ao de "Capturar keyframe", desabilitado em cima de um keyframe e levando a lista de 2 para 3; e o campo do nome dentro do `fieldset` da biblioteca, a 164 px do combo "Animação salva".

### Espelho completo do boneco ✅ (concluído em 2026-07-29)

Pedido do usuário: espelhar o boneco inteiro, e não só braços e pernas — as juntas sem par devem ter o ângulo invertido, mantendo o espelhamento dos membros com direita e esquerda. Ver `DECISOES.md` #70.

- **A regra já existia; faltava aplicá-la onde não há par.** A reflexão sagital `(x, y, z) → (x, -y, -z)` vale para qualquer junta: nas pareadas ela é aplicada ao TROCAR de lado, e numa central se aplica sobre ela mesma. `mirrorPoseFull` = `swapPoseSides` + as cinco centrais (`spine`, `chest`, `upperChest`, `neck`, `head`).
- **A raiz fica de fora:** ela não é pose, é colocação. Espelhar o heading giraria o boneco na cena e negar X o mudaria de lugar — isso é refletir a cena, não o boneco. Ele continua onde está e encarando para onde encarava.
- **Sem `scopeJoint`**, ao contrário das três operações de lado: "o boneco todo" é o que o botão promete. Isso obrigou a separar o guarda do bloco de Simetria, que escondia tudo quando não havia junta pareada no escopo — o espelho completo sumiria justamente onde continua válido. De quebra, o espelho AO VIVO parou de sumir conforme a seleção, o que já contrariava a própria documentação dele.
- **Prova numérica, não dedução:** com a cinemática direta, cada junta cai na posição de mundo da correspondente com X negado (as pareadas na do par, as centrais na delas mesmas), erro nulo a 9 casas; o controle negativo mostra que só trocar os lados deixa as centrais a mais de 2 cm do espelho. Continua involução.

**+10 testes**, suíte de 1.993 para **2.003**, todos verdes; `tsc -b`, `eslint .` e `npm run build` limpos. Validado no Chrome real sobre uma pose de corrida com a cabeça a 25° e o tronco a 12°: "Inverter lados" deixa a cabeça em 25° (o buraco relatado), o espelho completo leva a −25°/−12° e troca os ombros, aplicar de novo devolve 25°, e com a cabeça selecionada o botão continua na tela.

### Barra da linha do tempo em duas fileiras ✅ (concluído em 2026-07-29)

Pedido do usuário: pôr os botões da barra em duas fileiras, com "Inserir keyframe aqui" acima dos de tocar. Ver `DECISOES.md` #71.

`timeline-bar__controls` vira uma coluna de duas linhas ao lado da régua, que continua crescendo com a janela (2.060 px de régua contra 304 px de controles). A divisão também diz o que cada fileira é: eram sete controles numa fila só, e o único que EDITA a animação ficava colado no ▶ de andar um quadro. Sem mudança de comportamento — mesma regra de `disabled`, mesmos testes.

Suíte em **2.003**, todos verdes; `tsc -b`, `eslint .` e `npm run build` limpos. Validado no Chrome real por caixa delimitadora: inserir acima de "Tocar", mesma coluna, dois topos distintos, sem erro de console.

### Duas poses de balé e a pirueta ✅ (concluído em 2026-07-29)

Pedido do usuário: duas poses e uma animação de uma bailarina girando com uma perna levantada, girando sobre a outra. Ver `DECISOES.md` #72.

- **`balletPirouette`** (passé/retiré) e **`balletPreparation`** (demi-plié), no grupo "ação". Ângulos resolvidos por varredura sobre a cinemática direta: o pé levantado a 6,9 cm do joelho de apoio **e** o joelho aberto de lado (x = −0,315 m) — sem a segunda exigência sai um coupé de rua, não um passé. Altura do quadril medida com `seatedHipHeightM` (0,967 na meia-ponta; 0,811 no plié).
- **Trecho `balletPirouette`** (11 keyframes): plié → sobe em retiré → seis degraus de **120°** → plié. O degrau é restrição, não estética: `lerpAngle` toma o caminho mais curto e resolve 180° como −180, girando ao contrário. Teste trava `< 180` por degrau.
- **Armadilha registrada:** clavícula com o mesmo sinal nos dois lados é grampeada em zero pelo limite espelhado do lado direito, e a assimetria se propaga pelo braço inteiro — por isso os braços passam pelo `symmetric()`.

**+20 testes**, suíte de 2.003 para **2.023**, todos verdes; `tsc -b`, `eslint .` e `npm run build` limpos. Validado no Chrome real: as duas poses conferidas em imagem (inclusive na vista frontal, onde o en dehors se lê), o trecho gerando 11 keyframes e seis instantes mostrando o giro sempre no mesmo sentido, sem erro de console.

### O keyframe que está na bancada: destaque no card e marca na régua ✅ (concluído em 2026-07-29)

Itens 40 e 41, pedidos pelo usuário. Depois de um "Ir para", nada na tela dizia em qual keyframe a cena de trabalho tinha sido carregada — a informação que falta na hora de clicar "Regravar" no card certo. Ver `DECISOES.md` #73.

- **O ❓ do item 40 foi resolvido pela recomendação:** o destaque segue **só** o "Ir para", e não o playhead. Por isso é estado próprio (`visitedKeyframeId` no `animationStore`, fora do undo e do arquivo) e não derivação do instante: arrastar a régua mexe só na pré-visualização, e uma marca que andasse com ela apontaria para um keyframe que não é o que se está editando.
- **Quem limpa:** capturar (o keyframe novo vai para o fim) e `resetTimeline` (abrir da biblioteca / apagar a de trabalho — ids são únicos dentro de uma animação). **Regravar não limpa:** reescreve o keyframe em que se está. Mover, duplicar e remover não pediram código: o casamento é por id.
- **Card:** `aria-current="true"` mais realce por `box-shadow` interno — engrossar a borda faria a lista dar um pulo a cada "Ir para". **Régua:** faixa fina própria abaixo do controle, porque o `<datalist>` das marcas é nativo e não aceita estilo por opção, e porque em cima disputaria espaço com o polegar.

**+10 testes**, suíte de 2.023 para **2.033**, todos verdes; `tsc -b`, `eslint .` e `npm run build` limpos. Validado no Chrome real: "Ir para" no keyframe 2 destaca só o card 2 e põe a marca a 0,500 da régua com o título certo, regravar mantém e capturar larga — conferido ampliado nos dois temas, sem erro de console.

### Papel-cebola com escolha de lado ✅ (concluído em 2026-07-29)

Pedido do usuário: poder mostrar o keyframe anterior e o seguinte separadamente ou os dois juntos. Extensão do item 31. Ver `DECISOES.md` #74.

- **Por que importa:** com os dois fantasmas ligados, a pose do meio fica cercada de corpo dos dois lados. Isolando o anterior lê-se de onde ela veio; isolando o seguinte, para onde vai. O modo escolhe **quem aparece, não o que cada um significa** — papéis e cores continuam os mesmos nos três casos, e há teste travando isso.
- **Dois campos, não um de quatro valores:** `onionSkin` continua sendo a liga/desliga e `onionSkinMode` guarda o lado. Um campo só faria desligar e religar perder a escolha.
- **Na ponta do lado escolhido, nada:** cair no outro vizinho "para não ficar vazio" mostraria exatamente o que quem escolheu um lado pediu para não ver.
- **Onde mexeu:** `onionSkinFrames` ganhou um terceiro parâmetro (padrão `both`) e virou um filtro de papel; o combo só aparece com o papel-cebola ligado, para não ocupar inerte a linha acima da lista de keyframes.

**+11 testes**, suíte de 2.033 para **2.044**, todos verdes; `tsc -b`, `eslint .` e `npm run build` limpos. Validado no Chrome real por contagem de pixels (boneco de trabalho pintado de verde, porque o vermelho de fábrica se confunde com o fantasma quente): frios caem de 17.932 para 410 em "só o anterior", quentes de 13.322 para 492 em "só o seguinte", e no keyframe 1 com "só o anterior" os dois ficam na linha de base. Sem erro de console e sem rolagem horizontal no painel.

### Marca do playhead no card do keyframe ✅ (concluído em 2026-07-29)

Pedido do usuário: ao clicar em ⏮/⏭ na linha do tempo, destacar em qual keyframe ele parou. Complemento do item 40. Ver `DECISOES.md` #75.

- **Duas marcas, e não uma.** A do item 40 diz "a bancada mostra este keyframe" e responde onde "Regravar" escreve; o ⏮/⏭ não carrega nada na bancada, só move o playhead. Reaproveitar a mesma marca faria o card apontar "é este que você edita" sobre um keyframe que não foi carregado — o acidente que o próprio item 40 e a confirmação do #69 existem para evitar. A do playhead é de propósito mais fraca: tarja na borda esquerda e um `▶` no título, contra o contorno inteiro da bancada. Juntas no mesmo card (o que acontece a cada "Ir para"), somam-se e continuam legíveis.
- **Sem estado novo:** `keyframeIndexAtTimeMs` lê o instante, então a marca vale igual para arrastar a régua e para as setas de quadro. **No meio de um trecho não há card marcado** — é o que separa esta leitura do âncora do papel-cebola, que ali devolve o keyframe de trás.

**+7 testes**, suíte de 2.044 para **2.051**, todos verdes; `tsc -b`, `eslint .` e `npm run build` limpos. Validado no Chrome real: ⏭ levando a marca de 0 a 3 junto com o relógio da barra, ⏮ voltando, nenhum card marcado a 1,5s, e depois de um "Ir para" no keyframe 2 o ⏭ deixando bancada e playhead em cards diferentes. Sem erro de console.

### Fase 11 — Câmera de cena separada do viewport, gizmo estilo Blender e preset 9:16 ✅ (concluída em 2026-07-30)

Pedido do usuário: a câmera deixar de ser o próprio viewport — trabalhar as poses navegando livre, sem mover o enquadramento — com um elemento visual mostrando onde a câmera está e uma "máscara vertical estilo TikTok/Instagram". Cinco decisões de desenho foram respondidas pelo usuário antes de começar, e duas propostas de borda aprovadas — ver `DECISOES.md` #78.

**Entregue:**

- **`figuresStore.sceneCamera`** (`CameraViewState` — o mesmo formato dos keyframes): a câmera de cena como conteúdo persistido da cena (autosave, snapshots do catálogo, `.glb` via campo aditivo `sceneCamera` nos extras, sem subir `SCENE_EXTRAS_VERSION`; leitura sanitizada em `sceneCameraFromExtras`, com recusa de câmera degenerada), **fora do histórico de undo** — mover a câmera é enquadrar, como a navegação.
- **`sceneCameraObject.ts`**: o `THREE.PerspectiveCamera` vivo (singleton de módulo), espelho do store. O `CameraRig` sincroniza estado → objeto; a reprodução de animação escreve no objeto (imperativo, sem um `set` de store por quadro) e devolve ao store ao parar.
- **`SceneCameraGizmo.tsx`**: representação estilo Blender (corpo + tronco de pirâmide do FOV real na proporção da SAÍDA + triângulo do topo). Clicável (seleção exclusiva com o boneco), arrastável (W: posição e alvo juntos) e girável (E: alvo reorientado à distância constante) pelo mesmo `TransformControls` das juntas. Segue o objeto vivo por `useFrame` — acompanha a animação tocando. Registrado em `OVERLAY_NAMES`: nunca sai no PNG/MP4, e some no modo visão-câmera.
- **Modo visão-câmera** (`cameraStore.viewMode`): botão no painel de Câmera e tecla `0` (comum ou numpad, convenção Blender). O `CameraRig` troca a câmera ativa do R3F para o objeto da câmera de cena; o viewport fica TRAVADO no quadro (órbita desligada; ajustes pelo painel ou de volta na edição). Badge de modo no viewport ("Modo edição" discreto / "Visão da câmera" destacado). A **máscara de enquadramento só existe neste modo** — no modo edição o viewport não é o quadro de nada.
- **Painel cinematográfico redirecionado:** planos/enquadramento, POV, over-the-shoulder, two shot, contracampo, ângulo holandês, movimento A→B, lente e bookmarks **perspectivos** calculam a partir da câmera de cena e gravam nela (o executor continua no `CameraRig`, agora `commitSceneView` → store). A proporção usada pelos planos passou a ser a da **saída** (`outputAspect.ts`, mesma escolha da máscara), não a da janela. Vistas ortográficas, "voltar à perspectiva" e enquadrar (`F`) continuam sendo navegação do viewport e **voltam ao modo edição**; bookmarks ortográficos idem. Botão novo **"Posicionar na vista atual"** (comando `placeCameraAtView`) fotografa a vista de trabalho para a câmera.
- **Animador pela câmera de cena:** capturar/regravar keyframe e inserir trechos leem `sceneCamera` (sempre disponível, em qualquer projeção do viewport); "ir para" e a navegação da linha do tempo movem a câmera de cena de verdade (store); a reprodução move o objeto vivo e comita ao parar. **A órbita fica LIVRE durante a reprodução** — o objetivo original do pedido: a animação move a câmera de cena (o gizmo passeia), não mais a vista de trabalho. Exportação de MP4 e miniaturas renderizam por uma câmera **descartável** montada de cada quadro — o viewport não é mais sequestrado. O PNG (`SnapshotCapture`) também sai da câmera de cena: a foto é da câmera, não da bancada, o mesmo contrato do vídeo.
- **Preset de resolução "Vertical 9:16 (1080×1920)"** para instantâneo e vídeo — com a máscara apontada para a saída, escolhê-lo já desenha o recorte 9:16 na tela; não existe máscara à parte.

**Números:** 17 testes novos/ajustados (suíte em **2.037**, toda verde); `tsc -b`, `eslint .` e `npm run build` limpos.

**Correção e complemento (2026-07-30, `DECISOES.md` #78.1):** o "Ver pela câmera" torcia a câmera para baixo — o `<OrbitControls>` do drei rebindava na câmera padrão nova e o `update()` a puxava para o alvo antigo da órbita; corrigido com as câmeras de navegação como singletons (`viewportCameras.ts`) passadas EXPLICITAMENTE na prop `camera` dos controles. E o painel de Câmera ganhou **Posição (m)** e **Rotação (°)** numéricas no desenho dos controles de colocação do boneco, em mão dupla com o gizmo (`sceneCameraTransform.ts`, Euler YXZ preservando a distância ao alvo), mais os botões **Mover/Girar** que alternam o gizmo da câmera (mesmo `gizmoMode` global dos W/E, selecionando a câmera ao apertar — `DECISOES.md` #78.2). A máscara de enquadramento ganhou a fonte **"Vertical 9:16"** — o formato fixo direto no seletor, sem trocar resolução de painel; muda junto a máscara, os planos e o frustum do gizmo (`frameMaskResolution`, `DECISOES.md` #78.3). Em seguida (`DECISOES.md` #78.4) a máscara passou a ser SÓ proporção (sem máscara / 16:9 / 9:16 / 1:1 — "do instantâneo"/"da animação" saíram: as duas saídas veem a mesma câmera de cena) e as resoluções de exportação viraram **proporção × qualidade** (16:9, 9:16 e 1:1, todas em 1080p e 720p; 4K removido; `outputResolutionFor` é a tabela única). Suíte em **2.053**.

**Validação no navegador: pendente** — o arrasto/giro do gizmo, a troca de câmera ativa do modo visão e a exportação pela câmera descartável são imperativos sobre objetos vivos (as partes que, como sempre, os testes não cobrem) e precisam da conferência visual do usuário.

### Fase 12 — Exportar/importar animação em JSON, com remapeamento de elenco ✅ (concluída em 2026-07-30)

Pedido do usuário: exportar e importar um JSON com todos os dados de uma animação; e, na sequência, avaliar remapear as posições para os bonecos que já estão em cena em vez de recriar os gravados. Seis decisões de desenho respondidas pelo usuário antes de começar — ver `DECISOES.md` #79.

**Entregue:**

- **Arquivo = o `animations.json` de sempre** (`serializeAnimationFile`/`parseImportedAnimation` em `animationsFile.ts`): exportar leva a animação **de trabalho** inteira num JSON com uma entrada; importar aceita qualquer `animations.json` e lê **todos os keyframes como UMA linha do tempo**. Mesma sanitização do workspace; arquivo sem keyframe aproveitável vira mensagem, não diálogo.
- **Importar não mexe na biblioteca:** um `<dialog>` nativo pergunta se o arquivo **substitui** a animação de trabalho ou é **anexado ao final** dela. Um `set` só nos dois casos — **um passo de undo**; rótulos de grupo repetidos ganham sufixo (`freeKeyframeLabel`), como os trechos.
- **`animationRemap.ts` — remapeamento para os bonecos da cena (padrão):** a animação é uma coreografia, e quem a executa são os bonecos que já estão ali. Eles mantêm id, nome, cor e altura, e recebem pose, giro, colocação e visibilidade de cada keyframe. Substituir usa as colocações **absolutas** gravadas (a câmera do arquivo segue valendo); anexar **reancora** no boneco do papel 0 e aplica à câmera de cada keyframe o **mesmo transporte rígido**, para o enquadramento acompanhar a ação. Altura vertical sempre corrigida pela escala do boneco que executa.
- **"Recriar os bonecos gravados" como saída:** único modo fiel a nomes, cores e alturas de origem, e o que resta quando a cena tem menos bonecos do que a animação usa — o diálogo avisa com os números e desabilita o remapeamento.
- **`uiStore.modalOpen`**: com o diálogo aberto, os atalhos globais ficam suspensos (mesma proteção do painel de ajuda). O `<dialog>` é o nativo, com `showModal()` chamado só onde ele existe — o jsdom 29 não o implementa.

**Números:** 37 testes novos (suíte em **2.090**, toda verde); `tsc -b`, `eslint .` e `npm run build` limpos.

**Validação no navegador: pendente** — o diálogo modal de verdade (backdrop, foco, Esc), o download do JSON e a conferência visual de uma animação anexada remapeada precisam da conferência do usuário.

### Gizmo de translação de junta (arrasto de cadeia) — substitui o IK de 2 ossos ✅ (concluído em 2026-07-30)

Pedido do usuário: gizmo de translação em todas as juntas — arrastar uma junta puxa/empurra as juntas ACIMA dela (até a raiz, que é a única totalmente fixa) sem ultrapassar os limites articulares; no limite de todas, o movimento trava; ao final, tudo é convertido para o padrão usual de pose (nenhum formato novo de persistência). Quatro decisões confirmadas com o usuário antes de implementar: W/E alterna mover/girar na junta selecionada (mesma convenção da raiz, modo único global); o gizmo vale para todas as juntas EXCETO mão/dedos; o novo arrasto **substitui** o IK de 2 ossos da fase 7; junta travada fica rígida mas NÃO interrompe a cadeia. Ver `DECISOES.md` #76.

- **Solver** (`dragSolver.ts`, puro): CCD com **recrutamento progressivo** — resolve primeiro só com a junta mais próxima e só expande em direção à raiz quando o resíduo passa de 5 mm (saturação real, não ruído numérico). É a prioridade do pedido de forma literal: o ombro absorve tudo o que os limites dele permitem antes de clavícula/tronco entrarem. Não conflita com a proibição de CCD do #12: aquele era um CCD de alvo distante numa chamada única; aqui cada evento de mouse parte da pose atual para um alvo a milímetros dela.
- **Gizmo** (`JointDragGizmo.tsx`): `TransformControls` preso a um PROXY efêmero (o `Group` real da junta carrega o offset fixo do esqueleto e não pode ser arrastado); a cada mudança o solver resolve, grava a pose e o proxy volta para a posição efetivamente alcançada — é esse snap-back que faz o gizmo "travar" no limite.
- **Conversão exata:** o resultado são as mesmas rotações Euler por junta de sempre, gravadas via `setJointRotations` (ação em lote nova no `figuresStore` — um passo de undo por evento de arrasto, com o mesmo clamp/trava/espelho da escrita unitária). Teste trava que reconstruir o boneco com as rotações devolvidas reproduz a posição alcançada com erro < 1e-6 m.
- **O que saiu junto:** `ikSolver`/`ikActions`/`ikStore`/`IKTargetGizmo`, o atalho R, o badge "IK" do painel de Bonecos, o toggle/alvo/giro de cotovelo do painel de Propriedades. O controle numérico de giro do cotovelo (#44) não tem substituto direto — o gesto equivalente agora é arrastar o próprio cotovelo, perda aceita na decisão de substituir.
- **Sem gizmo de arrasto** (caem no de rotação em qualquer modo): mão/dedos (decisão do usuário) e `spine`/`hip.*` — o único ancestral delas é a raiz, que é fixa, então o gizmo nasceria morto.

**Saldo de −35 testes** (os do IK antigo saíram, 22 novos entraram: solver com convergência/prioridade/travas, ação com undo em passo único, fiação do gizmo, lote do store), suíte de 2.051 para **2.016**, todos verdes; `tsc -b`, `eslint .` e `npm run build` limpos. A interação de arrastar em si não é testável por automação (mesma ressalva de sempre dos gizmos, ver DECISOES.md) — **arrasto validado manualmente pelo usuário no navegador em 2026-07-30: funcionamento OK**.

### Destaque de juntas travadas com o gizmo de mover ativo ✅ (concluído em 2026-07-30)

Pedido do usuário: identificar no boneco selecionado as juntas travadas durante o movimento de translação (ex.: cor diferenciada) — complemento imediato do arrasto de cadeia. Duas decisões confirmadas com o usuário: o destaque aparece **sempre que o gizmo de translação de junta está visível** (antes e durante o arrasto, para avisar ANTES de puxar o que vai ficar rígido) e cobre **todas as juntas travadas do boneco selecionado** (regra simples, mesma semântica do cadeado em todo lugar). Ver `DECISOES.md` #77.

- **Emissivo avermelhado** (`#ef4444`, intensidade 0,5) nas peças da junta travada — mesmo mecanismo do destaque amarelo de seleção, um degrau mais fraco; **a seleção vence** quando a junta selecionada também está travada. Olhos e fantasmas ficam de fora, como na seleção.
- **Fiação em `SceneFigures`**: a condição de "gizmo de mover ativo" é a MESMA que o `Viewport` usa para montar o `JointDragGizmo` (junta arrastável selecionada + modo mover); só o boneco selecionado recebe a lista (`getLockedJoints`). `Figure` ganhou a prop `lockedJointNames`, cortada no fantasma junto com seleção/clique/refs.
- Sem i18n nem estado novo — é leitura de `jointLocks` + `gizmoMode` que já existiam.

**+4 testes** (emissivo só nas travadas, seleção > trava, sem lista = sem tom, fantasma imune), suíte de 2.016 para **2.020**, todos verdes; `tsc -b`, `eslint .` e `npm run build` limpos. **Conferência visual feita pelo usuário no navegador em 2026-07-30, junto com a do arrasto: funcionamento OK.**

### Objetos de cena 3D redimensionáveis, com vértice livre ✅ (concluído em 2026-07-30)

Entrega do item 42 da lista de propostas do `PLANO.md`. Não rompe a decisão de topo "manequim construído por primitivas, **sem assets externos**": as seis formas são geradas em código, como o boneco.

- **`props/sceneProp.ts`** (modelo puro) e **`props/propGeometry.ts`** (geometria): primitiva unitária → tamanho em metros → vértices movidos. A geometria é construída **já no tamanho real**, sem `scale` de nó — é o que permite o desvio de vértice ser metro absoluto. A rampa é uma `BufferGeometry` própria (8 triângulos), porque o three não tem prisma triangular.
- **Pontos de controle soldados:** o `BoxGeometry` tem 24 vértices, não 8; arrastar "um canto" mexendo num só rasgaria a malha. Vértices coincidentes viram um ponto de controle (caixa 8, plano 4, rampa 6, cone 18, cilindro 34, esfera 114) e movem-se juntos. **A contagem é contrato de arquivo** e está travada por teste — mudar a subdivisão remapearia deformações já salvas para vértices errados.
- **Persistência aditiva:** `props`/`nextPropSeq` em `SceneExtras`, **sem subir `SCENE_EXTRAS_VERSION`** (precedente do `sceneCamera` e do `snapshotCounter`). Como `sceneToExtras`/`sceneFromExtras` é funil único, uma adição cobriu `.glb`, autosave e catálogo de cenas de uma vez. Arquivo antigo abre com lista vazia. No `.glb` o objeto sai com a malha **real** (deformação assada), diferente do boneco, que vai simplificado.
- **"Ocultar na bancada" exigiu mecanismo novo:** `revealEditorHidden` em `sceneCapture.ts`, chamado **lado a lado** com `hideSceneOverlays` (e não dentro dele) — reacender o cenário não pode depender da opção "ocultar grade/gizmos", que o usuário controla.
- **Seleção:** `store/selection.ts` com `selectTarget`/`useSelection` como ponto único; o estado continua onde estava (mover para um store novo tocaria ~15 arquivos sem mudar comportamento, e a seleção já está fora do undo nos dois lugares).
- **Undo:** objetos entram no histórico como os bonecos, com `updateProp` devolvendo o array original quando a edição foi barrada pela trava — assim uma ação inerte não empilha passo vazio.

**Ajuste em 2026-07-30, logo depois:** os vértices estavam difíceis de acertar com o mouse. A alça passou a ter DUAS esferas — a visível (3 cm) e um alvo de clique de 7,5 cm, filho dela, com material transparente em vez de `visible={false}` (objeto invisível não é alcançado pelo raycast, e o alvo maior não existiria). O `onClick` continua sendo um só, porque o evento do R3F borbulha para o pai.

**Correção em 2026-07-30:** o gizmo de vértice aparecia deslocado do vértice. Causa: o drei renderiza o próprio `TransformControls` como nó da árvore (`<primitive object={controls} />`), e o gizmo se coloca na posição de MUNDO do objeto anexado — estando dentro do grupo que carrega a colocação do objeto, essa posição ainda era multiplicada pela matriz do grupo, e o deslocamento era exatamente a colocação. O controle passou para FORA do grupo (pai = raiz da cena, identidade — a situação em que `SelectionGizmo` e `JointDragGizmo` sempre estiveram, por serem renderizados no `Viewport`); as alças continuam dentro dele, então `handle.position` segue em espaço local e a conta de `setPropVertex` não mudou.

**Sombra mais clara em 2026-07-30** (pedido do usuário, depois de ver os objetos em cena): `SHADOW_INTENSITY = 0.45` em `constants.ts`, aplicado como `shadow-intensity` na `directionalLight` do `SceneContent` (`light.shadow.intensity`, do three r165+). A escuridão da sombra é propriedade da LUZ, não de quem projeta — então clareia junto a sombra dos bonecos, o que é coerente: mesma luz, mesmo chão. Não confundir com a elipse de contato (`FigureShadow`), que é um *mesh* com opacidade própria. +1 teste (`SceneContent.test.tsx`), travando que o valor chega mesmo à luz — `shadow-intensity` é prop aninhada, e um erro de digitação nela passaria em silêncio.

**+77 testes** (geometria e soldagem: 21; store: 27; serialização e `.glb`: 14; captura: 3; painel: 13), suíte de 2.090 para **2.167**, todos verdes; `tsc -b`, `eslint .` e `npm run build` limpos. Os arrastos (mover/girar/medir/vértice) não são testáveis por automação, mesma ressalva de sempre dos gizmos — **falta a conferência visual do usuário no navegador**.

### Enxertar animação importada, carimbar a câmera atual e regravar em `<dialog>` ✅ (concluído em 2026-07-31)

Pedido do usuário em três partes, com quatro decisões de desenho respondidas antes de escrever código. Ver `DECISOES.md` #82 (e #79, de quem esta entrega reaproveita o remapeamento, e #69, de quem ela move a confirmação).

- **Terceiro modo de importação, `substitute`:** o arquivo é ENXERTADO na bancada a partir de um keyframe escolhido, trocando as poses dos bonecos de destino e — se a caixa estiver marcada — as câmeras. Sobrevivem: os keyframes anteriores, os bonecos sem papel, as durações, os rótulos de grupo, o nome e a velocidade da animação de trabalho. Os papéis do diálogo (#79) já respondiam "de quem para quem": papel em "— ninguém —" é o boneco de ORIGEM que fica de fora, e o combo escolhe o de DESTINO.
- **Decisões do usuário:** excedente vai para o fim da linha do tempo (com as durações gravadas); caixa marcada por padrão para trocar também as câmeras; colocação **absoluta**, como no modo "Substituir"; e o carimbo de câmera com **faixa escolhível** (1..n por padrão), confirmado em diálogo.
- **`remapPosedKeyframes` extraído:** o miolo de #79 passou a ser compartilhado — `remapImportedKeyframes` monta o retrato a partir da cena, `substituteImportedKeyframes` a partir do keyframe da bancada. É a única diferença entre os dois modos, e agora está num lugar só.
- **`applySceneCameraToKeyframes`:** carimba a câmera de cena viva numa faixa de keyframes, só a câmera — poses e durações intactas. Vive no store (a câmera de cena já está lá, sincronizada por gizmo, painel e "Ir para"), então é testável sem GPU e entra num passo de undo. Desabilitado **tocando**, com o motivo à vista: durante a reprodução o store guarda o enquadramento de antes do play.
- **`ModalDialog.tsx`:** a dança de `showModal`/`close`/Escape/`modalOpen` num lugar só, usada pelos três diálogos do painel. A confirmação de "Regravar" saiu do card (onde ficava colada nos botões dos keyframes vizinhos, que seguiam clicáveis) e diz por extenso qual keyframe será reescrito.

**+25 testes**, suíte de 2.218 para **2.243**, todos verdes; `tsc -b`, `eslint .` e `npm run build` limpos. **Falta a conferência visual no navegador** — as três caixas modais e o botão novo do painel.

### Reorganização do painel de Animação ✅ (concluído em 2026-07-31)

Pedido do usuário: revisar a ordem dos controles, aproximar o que é do mesmo assunto e achar redundâncias e coisa sem uso. Ver `DECISOES.md` #83.

- **A lista de keyframes ganhou teto e rolagem própria** (`max-height: 45vh`). Era o problema de fundo: sem limite, quinze keyframes empurravam para fora da tela tudo o que vinha depois — velocidade, "Fechar o ciclo", "Gerar miniaturas", vídeo, `Exportar MP4` e a biblioteca inteira. Mesmo efeito que obrigou a fixar o `Capturar` no topo (#69), nunca tratado para o resto do painel.
- **Nova ordem:** capturar (fixo) → papel-cebola + lista → **Ações da linha do tempo** (fieldset novo) → ▸ Trechos prontos → ▸ Vídeo → ▸ Biblioteca e arquivos.
- **`CollapsibleSection.tsx`:** seção recolhível DENTRO de um painel, com estado persistido junto das preferências (`ANIMATION_SECTION_KEYS` em `uiPreferences.ts`). Nasce fechada. Não é `<details>` (o jsdom não esconde o conteúdo fechado, e os testes veriam botões que o usuário não vê) nem o `CollapsiblePanel` (aquele encolhe a COLUNA).
- **"Ações da linha do tempo"** junta o que age sobre a lista inteira: fechar o ciclo, aplicar a câmera, gerar miniaturas e salvar faixa como trecho — este último tirado de dentro de "Trechos prontos", onde era saída disfarçada de entrada (ele lê a lista). A velocidade fecha o bloco.
- **Redundâncias:** leitura de tempo duplicada com a barra do rodapé (removida), faixas com rótulos ambíguos ("Salvar até…" × "Aplicar de/até…"), "Regravar a salva" → **"Atualizar a salva"**, `Limpar` agora confirma em diálogo (apagava a linha do tempo inteira sem pedir nada, enquanto regravar um keyframe confirmava), arquivo JSON em fieldset próprio, `KeyframeUpdateDialog` → `ConfirmDialog` genérico, e a classe `animation-panel__insert` (que vestia três botões que não inserem nada) → `animation-panel__wide`.
- **Sem uso:** a chave `repeatHint` saiu. `createAnimation`, `loadAnimationLibrary` e `loadClipLibrary` ficaram — só os testes os chamam, mas apagá-los custaria reescrever ~35 pontos de `animationsStore.test.ts` mudando o que eles exercitam; o risco de alguém religar `createAnimation` a um botão (ressuscitando o "criar antes de capturar" que o item 36 matou) está registrado no comentário da ação. `Câm ↑`/`Câm ↓` também ficaram: perderam o caso comum para o carimbo em faixa, mas continuam sendo a única forma de copiar a câmera de um vizinho.

**+4 testes** e ~45 pontos ajustados aos rótulos e ao estado inicial das seções, suíte de 2.243 para **2.247**, todos verdes; `tsc -b`, `eslint .` e `npm run build` limpos. **Falta a conferência visual no navegador** — a rolagem da lista, as três seções e os dois fieldsets novos.

### Reorganização dos painéis de Propriedades e Câmera ✅ (concluído em 2026-07-31)

Pedido do usuário, na sequência da reorganização do animador. Ver `DECISOES.md` #84 (e #83, de quem esta entrega generaliza o mecanismo de seções).

- **`SECTION_KEYS` no lugar de `ANIMATION_SECTION_KEYS`**, com prefixo por painel e onze chaves. As seções nascem recolhidas **menos duas** — `poses` e `cameraFraming` —, que são o motivo de aqueles painéis existirem: recolher o que se usa o tempo todo trocaria rolagem por cliques.
- **Propriedades — raiz:** gizmo W/E + Posição + Rotação sobem para logo abaixo do combo de junta (estavam no fim, atrás de cinco blocos de pose, e o gizmo era a versão arrastável daqueles mesmos números). O fieldset "Poses predefinidas", que tinha 193 linhas e cinco assuntos, virou ▸**Poses** (escolher e aplicar) e ▸**Guardar e copiar** (salvar, copiar para outro boneco, arquivo `.json`). Renomear/remover ficaram com o combo, que é o que elas miram.
- **Propriedades — junta:** a rotação sobe (é O controle da junta); presets de mão e gizmo vêm depois. As duas vistas passam a terminar na mesma ordem — ▸Simetria e depois "Zerar por grupo" —, que antes apareciam invertidas entre elas.
- **`Renomear` pose salva:** a ação existia no store desde #42, testada, e nunca tinha ganhado botão. O formulário de nome virou `PoseNameForm`, um componente só para salvar e renomear.
- **Câmera:** a inclinação holandesa sai do bloco de enquadramento (era o único controle AO VIVO num bloco que espera o "Aplicar") e vai para o da lente, agora "Lente e inclinação"; ▸**Vistas prontas** ganham bloco próprio (eram o segundo "Aplicar" do mesmo fieldset); ▸**Bancada: vistas ortográficas** diz no título o que o comentário do arquivo avisava; ▸Movimento e ▸Bookmarks recolhem, e a lista de bookmarks ganhou teto e rolagem própria.
- **Limpezas:** `setViewMode` removida do `cameraStore` (só `toggleViewMode` era usada), rótulos do gizmo em `common.*` (o painel de Câmera puxava a chave do de Propriedades), `loadPoseLibrary` e `renameSceneSnapshot` documentadas como ações sem porta, e dois recuos tortos corrigidos no `PropertiesPanel`.

- **Ajuste no mesmo dia, depois de o usuário ver o painel:** "Guardar e copiar" foi para o rodapé da vista da raiz (é o fim de uma sessão, não o meio); "Aleatória" desceu para depois da mistura (a fila de cima é a da pose escolhida no combo, e o sorteio não olha para ela); e o gizmo Mover/Girar subiu para antes da rotação também na vista de junta, igualando as duas vistas.

**+12 testes**, suíte de 2.247 para **2.259**, todos verdes; `tsc -b`, `eslint .` e `npm run build` limpos. **Falta a conferência visual no navegador** — as sete seções novas, a lista de bookmarks rolando e a ordem dos blocos nas duas vistas de Propriedades.

### Remoção do glTF: a cena passa a ser um `.json` ✅ (concluído em 2026-07-31)

Pedido do usuário: avaliar uma limpeza para remover todas as funcionalidades de exportação/importação de `.glb`. Ver `DECISOES.md` #85.

O levantamento mostrou que o `.glb` não era acessório — **era o formato de arquivo das cenas do workspace**. E que ele carregava, além do bloco JSON que o app de fato lia, uma geometria glTF que só o Blender usava: **~99,5% de cada arquivo** (245 KB contra 1,2 KB para um boneco, medido antes de decidir).

- **`sceneFile.ts` reescrito** como I/O de JSON (cena, boneco avulso, bookmarks), no padrão dos outros arquivos da pasta: `version`, `leiame` embutido, sanitização na leitura.
- **Apagados:** `gltfIO.ts`, `figureObject3D.ts`, `propObject3D.ts` e dois arquivos de teste. `three-stdlib` continua como dependência (OrbitControls, TransformControls), mas `GLTFExporter`/`GLTFLoader` saem do bundle.
- **`sceneSerialization.ts` não mudou uma linha** — ele já era JSON puro e já era o formato do autosave em `localStorage`. Trocou-se o envelope, não o conteúdo.
- **A pasta do workspace é hoje inteiramente JSON**, e por isso ganhou nomes reservados: uma cena chamada "Poses" geraria `poses.json` e apagaria a biblioteca de poses do usuário.
- **Consequências aceitas:** workspaces `.glb` já salvos em disco não abrem mais (decisão explícita do usuário: remoção total imediata, sem conversor), e não há ponte com o Blender até o módulo de rigging existir.

**Suíte em 2.251**, toda verde; `tsc -b` e `eslint .` limpos.

### Unificar as codificações de boneco ✅ (concluído em 2026-07-31)

Adiado de propósito na remoção do glTF e retomado na sequência. Ver `DECISOES.md` #86.

O levantamento achou **quatro** leitores de boneco, não dois — cena, animação, trechos e biblioteca de poses —, com três cópias privadas de `asRecord`/`sanitizeRotation`/`sanitizeVec3` que já tinham divergido entre si (só uma delas recusava `NaN` na colocação).

- **`src/figure/figureFormat.ts`** é o leitor único. Mora em `figure/` porque o formato do boneco é do modelo, ao lado do `skeleton.ts` — antes, `persistence/figurePoseFile.ts` importava a leitura de `animation/animation.ts`.
- **Tudo grava `{x,y,z}`**: cena, animação, trechos, pose avulsa e o `poses.json`, que era o último com tuplas. `FigureExtras` virou alias de `Figure` — o arquivo de cena guarda o objeto do store verbatim.
- **Leitura tolerante permanente**: `joints` é lido como sinônimo de `pose`, e tupla como sinônimo de objeto. Sem bump de versão e sem conversor — o autosave que todo usuário tem no navegador continua abrindo.
- **Duas políticas de rotação mantidas de propósito**: estrita (descarta) para pose salva, tolerante (zera) para boneco. O `poseLibrary` guardou o laço próprio pela mesma razão, compartilhando só o parser.

**+17 testes**, suíte de 2.251 para **2.268**, toda verde; `tsc -b`, `eslint .` e `npm run build` limpos.

### Um caminho só para boneco em arquivo ✅ (concluído em 2026-07-31)

Pedido do usuário depois de uma avaliação comparativa das duas funcionalidades. Ver `DECISOES.md` #87.

Depois da unificação do formato do boneco (#86), o "Exportar/Importar boneco" do painel de Bonecos e o "Pose em arquivo" do painel de Propriedades tinham virado quase o mesmo artefato — diferiam pela chave de embrulho e pelo X/Z —, com duas rotinas de leitura, dois módulos, cinco chaves de mensagem de erro (duas delas a mesma frase escrita duas vezes) e uma falha silenciosa própria.

- **O arquivo de pose passou a gravar `figures` no plural**, alinhado a cena, animação, trechos e autosave — era o único formato do projeto a destoar. `figure` singular continua sendo lido.
- **Exportar/importar boneco saiu do painel de Bonecos**, junto com `serializeFigureFile`/`parseFigureFile`, as ações de store `applyImportedPose` e `importFigureAsNew`, quatro chaves i18n e duas regras de CSS. O `FiguresPanel.test.tsx` não mocka mais persistência nenhuma — o painel deixou de fazer I/O de arquivo.
- **Um defeito silencioso morreu junto:** `parseFigureFile` exigia só `version`, que TODO arquivo do workspace tem. Escolher `poses.json` (ou o próprio arquivo de pose) em "Importar boneco" apagava a pose do boneco selecionado sem aviso nenhum. A guarda que o lado da pose já tinha desde o #81 passou a ser a única regra.
- **Capacidade perdida, aceita:** não há mais "carregar como boneco novo". Compensar seria barato — o JSON da pose já carrega nome, cor, visibilidade e colocação, só não os aplica.

**Suíte de 2.268 para 2.260** (−7 testes de código removido, +2 de compatibilidade), toda verde; `tsc -b`, `eslint .` e `npm run build` limpos.

### Convenção de botão nos painéis ✅ (concluído em 2026-07-31)

Pedido do usuário, com captura de tela de um rótulo quebrado em três linhas. Ver `DECISOES.md` #88.

Cada painel tinha a sua regra de largura/padding — sete ao todo —, e o botão que ninguém tinha lembrado de estilizar ficava do tamanho do texto no meio de uma coluna de 220 px.

- **`.panel-action`** (ação sozinha, largura cheia) e **`.panel-actions`** (conjunto entre o qual se escolhe, grade de duas colunas). A escolha entre as duas descreve o conteúdo, não a aparência — e é o que impede de repetir o "Travar junta" sozinho numa grade de dois, saindo com metade da largura.
- **Caixa de marcar consertada nos quatro painéis com campos:** a regra `__field input { width: 100% }`, feita para campos de texto, alcançava as caixas e comia a linha do rótulo.
- **Layout:** combo de forma numa linha com o botão embaixo (Objetos de cena); "Aplicar pose", "Aleatória", "Travar junta", "Resetar esta junta", "Apoiar no chão", "Inverter lados", "Posicionar na vista atual" e "Gerar keyframes do movimento" em largura cheia; velocidade abrindo o bloco de ações da linha do tempo; separador entre snapshot e arquivo no painel de Cenas.

**Suíte em 2.260**, toda verde; `tsc -b`, `eslint .` e `npm run build` limpos. **Falta a conferência visual no navegador.**

### Ajustes de layout e régua numerada na linha do tempo ✅ (concluído em 2026-07-31)

Pedido do usuário, quatro itens na sequência da convenção de botão. Ver `DECISOES.md` #89.

- **Propriedades:** "Selecionar junta" e o combo em linhas separadas — novo modificador `.properties-panel__field--stacked`, que devolve o campo ao desenho padrão dos outros painéis. A linha continua sendo a exceção do painel, para os rótulos de uma letra dos eixos.
- **Câmera:** o slider do dutch angle ficou sozinho na linha e "Endireitar" virou `.panel-action` em largura cheia.
- **Animação:** "Salvar trecho" (faixa, nome e botão) saiu de "Ações da linha do tempo" para "Trechos prontos" — das quatro ações do bloco, era a única que não mexia na linha do tempo. Junto do "Renomear trecho", o "Nome do trecho" agora aparece uma vez acima dos dois botões que compartilham o mesmo estado.
- **Linha do tempo:** o número de cada keyframe abaixo do slider. O `<datalist>` já traz o `label` de cada marca e nenhum navegador o desenha; a faixa própria devolve o número, recuada por meio polegar de cada lado (`--range-thumb`) para o `0%–100%` dela ser o do slider. Sem traços próprios — os do `datalist` bastam —, e o keyframe que está na bancada se destaca por cor e peso.

**Suíte de 2.260 para 2.262**, toda verde; `tsc -b`, `eslint .` e `npm run build` limpos. **Falta a conferência visual no navegador**, em especial o recuo da régua.


### Consolidação da documentação: `CLAUDE.md`, `HISTORICO.md` e dois índices ✅ (concluído em 2026-07-31)

Pergunta do usuário sobre como consolidar as doze sessões do projeto. Ver `DECISOES.md` #90. Mudança só de documentação — nenhuma linha de `src/` foi tocada.

- **`CLAUDE.md` novo** (~120 linhas): comandos reais, as regras que não se negociam, o mapa das pastas, as invariantes das decisões #42, #80, #83, #85, #86, #87 e #88, e o fluxo de trabalho esperado (perguntar antes, TDD, documentar depois).
- **`HISTORICO.md` novo:** as 77 entregas saíram do `PLANO.md`, onde cresciam em quatro blocos separados, e voltaram em ordem cronológica de conclusão, com índice. Ordenação estável — mesma data preserva a ordem relativa.
- **`PLANO.md` de 1.565 para 680 linhas**, com a lista de propostas contígua pela primeira vez: os itens 40 e 41 voltaram para o grupo H (estavam separados dele por vinte entregas) e a proposta de rigging para o Blender ficou no fim, marcada como proposta sem número. **Nada foi renumerado.**
- **Índice no `DECISOES.md`:** 93 entradas para 89 números, com âncora — os subnúmeros (#31.5, #78.1–78.4) ficaram visíveis como convenção.
- **Três referências de posição corrigidas** ("no fim deste documento", "item 42 acima", "a ponte removida acima") — as únicas que quebravam com a mudança de arquivo.

**Conferido por contagem de linhas não-vazias antes e depois do corte: zero perdidas**, e as 84 acrescentadas são exatamente o cabeçalho e o índice do `HISTORICO.md`. Suíte, `tsc -b`, `eslint .` e `npm run build` não foram afetados — nenhum arquivo de código mudou.

### Fase 13 — Mapa de profundidade ✅ (concluída em 2026-07-31)

A fase estava no `PLANO.md` com cinco decisões em aberto e uma escolha de rota; as oito perguntas foram respondidas pelo usuário **antes** de qualquer linha de código. Ver `DECISOES.md` #91.

Perto claro, longe escuro, a partir da câmera de cena — como uma forma **alternativa** de visualizar e de exportar a mesma cena. **Nenhuma funcionalidade existente mudou de comportamento.**

- **`src/scene/depthMap.ts` (novo):** `ShaderMaterial` próprio com rampa **linear** em espaço de vista (rota B), faixa a partir da caixa envolvente do conteúdo visível, e quatro passes no molde `RestoreScene` de `sceneCapture.ts` — `attachDepthMaterial` (tela), `applyDepthPass` (vídeo, material reaproveitado), `applyDepthMaterial` (PNG) e `suspendDepthMaterial`, que força o modo normal numa saída normal mesmo com a tela em profundidade.
- **`Box3.setFromObject` trocado por varredura própria:** o do three ignora a visibilidade, e um boneco desligado no painel esticaria a faixa por algo que nem aparece na imagem.
- **`src/store/depthStore.ts` (novo):** as três escolhas — ver na tela, gerar o PNG, exportar o MP4 — e a faixa que todas compartilham. Fora do undo, fora dos arquivos e sem persistência.
- **`src/scene/DepthPreview.tsx` (novo):** a vista na tela, dentro do `<Canvas>`, no molde do `CameraRig`. Vale posando, navegando e tocando. O fundo preto é do `Viewport`, por React — uma propriedade, um dono.
- **O chão entra desenhado, mas fora da conta da faixa**; a elipse de contato **sai sempre** no modo profundidade, independente de "ocultar grade/gizmos".
- **Sufixo `_depth`** em `formatSnapshotFilename` e `formatAnimationFilename`: como profundidade é modo alternativo (um arquivo por geração), sem ele o MP4 sobrescreveria o vídeo normal da mesma animação.
- **UI:** caixa "Profundidade" na Toolbar (ao lado da régua e da casca), "Gerar o PNG em profundidade" no painel de Instantâneos, "Exportar o MP4 em profundidade" na seção de vídeo do painel de Animação, e a faixa (automática ou travada, perto/longe em metros) na seção **"Configurações"** nova do painel de Cenas — chave `sceneSettings` em `SECTION_KEYS`, nascendo recolhida pela regra do #83. Todas as strings nos dois dicionários.
- **As miniaturas de keyframe continuam sempre normais** — elas existem para dizer qual keyframe é qual.

**Falta a conferência visual no navegador** — é onde se vê se a faixa automática acerta o enquadramento típico.

#### Adendo do mesmo dia: o chão

Pedido do usuário logo em seguida — "alteração no chão para evitar conflito com a profundidade dos bonecos". O diagnóstico: com a câmera padrão, o chão entra no quadro a ~2,5 m e a faixa começa a ~5 m, então **dois metros e meio de chão saíam em branco chapado** na metade de baixo da imagem, no mesmo valor da superfície mais próxima do boneco — que se dissolvia no piso.

- **Seletor de três valores** em Configurações: `recortado pela faixa` (padrão), `fora do mapa`, `rampa cheia` (o comportamento anterior). O recorte é **por profundidade**, no shader — a borda do "tapete" em volta dos pés acompanha a distância, e não um retângulo no mundo.
- **O material do conteúdo nunca recorta**, só o do chão: com a faixa travada mais curta que o boneco, ele tem de clarear ou escurecer nas pontas, e não sumir.
- **`scene.overrideMaterial` saiu:** o chão precisa de um material diferente do resto, e o override é um só para a cena. A troca virou material a material, com os originais em marcas de `userData` em vez de numa closure — é o que permite a um passe desfazer o que outro fez (que é a função inteira do `suspendDepthMaterial`) e o que torna a aplicação **idempotente**, reaplicada a cada quadro na vista da tela para alcançar boneco ou objeto criado depois.
- **Sem folga na faixa**, também decidido aqui: a escala inteira continua sendo usada.

**Suíte de 2.262 para 2.309** (+29 de `depthMap`, +7 do store, +4 de nomenclatura, +7 de painel), toda verde; `tsc -b`, `eslint .` e `npm run build` limpos.

### Módulo de poses — a casca de toque (item 44) ✅ (concluído em 2026-07-31)

O item 44 inteiro, com o nome de uso "Módulo de poses" ("Lite" era o apelido de projeto) e as decisões em aberto todas respondidas pelo usuário antes do código — escopo (keyframes de animação), sessão própria, undo por botões, torção por painel E gesto, gestão completa da linha do tempo, abre e exporta JSON, altura e X/Z liberados, vista livre com a cena toda, painel embaixo (vertical) / à direita (horizontal). O porquê de cada escolha está em `DECISOES.md` #92.

- **Escolha de casca** (`src/poses/shellChoice.ts`): ponteiro grosso + menor dimensão ≤ 1024 px abre o módulo; override persistido (`webposer:shell:v1`) vence a detecção, com botão de ida na Toolbar do desktop e de volta na barra do módulo — trocar de casca grava a sessão e recarrega a página. `App.tsx` escolhe entre `AppShell` e `PosesShell`.
- **Sessão própria**: `webposer:poses:v1`, mesma serialização do workspace; as chaves e `resolveAutosaveKey` moram no `shellChoice.ts` (módulo-folha) por causa do ciclo de import do init do `figuresStore` — ver #92. `autosave.ts` ganhou só o parâmetro opcional `key`.
- **Seis vistas, uma por vez** (`posesViews.ts`): cinco ortográficas travando um eixo cada + livre (navegação, manequim completo). Base de tela derivada da base da câmera — "trás" e "lado direito" espelham sem caso especial. Câmera ortográfica/perspectiva trocada por vista num `<Canvas>` próprio (`PosesViewport.tsx`); um dedo edita, dois são da câmera (`OrbitControls` sem rotação nas ortográficas).
- **Edição por um caminho só** (`posesEdit.ts`): arrasto projeta o toque no plano da junta e resolve com o `solveJointDrag` de sempre; as setas do painel são o mesmo arrasto em passos de 2 cm; raiz translada (X/Z na vista de cima, com Y travado). Torção = DOF `y` (`jointTwist.ts`), por slider e por giro de dois dedos (o gesto só vence a câmera após 10° acumulados). Vibração ao saturar limite (onde a API existe).
- **Painel em abas** (`PosesPanel.tsx` + cinco abas): Junta (trava, reset, setas, torção), Simetria (copiar lados, inverter, espelhar, ao vivo), Bonecos (1–5, escolha explícita, altura, "mostrar só o boneco em edição" — filtro de TELA, não o `visible`), Keyframes (ir para/regravar/mover/apagar + papel-cebola ancorado no keyframe corrente), Arquivo (abrir substituindo/anexando, exportar, Web Share). Botão flutuante captura keyframe com câmera padrão; regravar PRESERVA a câmera gravada.
- **Aditivo no compartilhado**: `Figure.tsx` ganhou `touchTargetRadius` (esfera invisível de toque por junta) e `onJointPointerDown`, opcionais com default no comportamento de hoje; nenhum teste existente mudou.
- **CSS próprio** sob `.poses-shell` (alvos ≥ 44 px, `touch-action: none` no canvas, grid por `orientation`); i18n `poses.*` + 2 chaves de Toolbar nos dois dicionários; Wake Lock de melhor esforço.

**Suíte de 2.309 para 2.376** (+67: escolha de casca 9, vistas 18, torção 4, edição 10, store da casca 4, chave de autosave 4, painel 15, barra/captura 3); toda verde; `tsc -b`, `eslint .` e `npm run build` limpos. **Falta a conferência visual no navegador** (arrasto, gesto de torção, pinça, Web Share — aparelho de toque real).

#### Adendo do mesmo dia: ajustes de UI após teste em tela de celular (ver `DECISOES.md` #92)

- **Botões menores** (mínimos de 44 → 36 px; ações de keyframe 32; captura 52) — os alvos de 44 px somados estouravam a tela.
- **Barras de vistas e de abas roláveis**: botão não encolhe, o excesso rola — antes o que não coubesse ficava inalcançável.
- **Reordenação**: vistas em Lado dir., Frente, Lado esq., Trás, Cima, Livre (um giro em volta do boneco); abas em **Boneco, Junta, Simetria, Keyframes, Arquivos**, com a inicial na primeira.
- **Combo de juntas do desktop na aba Junta**: o mesmo `<select>` com `<optgroup>` do painel de Propriedades, ligado ao mesmo `selectJoint`; substituiu o botão de raiz e o rótulo da junta. O mapa de rótulos mudou-se para `layout/jointGroupLabels.ts` (exportar constante de arquivo de componente derruba o fast refresh — o lint barrou).

**Suíte de 2.376 para 2.377** (+1, o combo de juntas); `tsc -b`, `eslint .` e `npm run build` limpos. A conferência visual em aparelho de toque continua pendente.

#### Segundo adendo do mesmo dia: estouro horizontal e câmera de trabalho (ver `DECISOES.md` #92)

- **Correção do estouro horizontal**: a coluna implícita `auto` do grid da casca assumia o max-content da barra de vistas e alargava a página inteira — `grid-template-columns: minmax(0, 1fr)` nos dois layouts resolve.
- **Seta › colada nas vistas** (a linha de vistas deixou de ter `flex: 1`; as ações foram para a direita por `margin-left: auto`).
- **Rotação da raiz por três sliders livres** (X/Y/Z, `setRootRotation`) no lugar do slider de torção quando a raiz está selecionada.
- **Pan e zoom nas vistas de edição**: um dedo/botão esquerdo em espaço vazio desloca, pinça/roda aproxima; sobre a junta continua sendo arrasto de pose.

**Suíte de 2.377 para 2.378** (+1, sliders da raiz); `tsc -b`, `eslint .` e `npm run build` limpos. A conferência visual em aparelho de toque continua pendente.

#### Terceiro adendo do mesmo dia: vista Livre com edição destravável (ver `DECISOES.md` #93)

Avaliação pedida pelo usuário ("a Livre aceitar edição, com translação livre, sem rotação"), levada com custo/poréns e respondida com um desenho melhor que as variantes oferecidas:

- **Cadeado na barra** (só na vista Livre): travada, a vista continua a de conferência do item 44 — manequim completo, navegação pura; destravada, mostra o **palito** e edita.
- **Arrasto no plano paralelo à tela** (normal = direção da câmera no momento do toque) + **gizmo de três setas de eixo** com haste invisível gorda para o dedo — o alvo da seta é o ponto da reta do eixo mais próximo do raio do toque (`closestPointOnAxisToRay`, pura). Rotação segue de fora; setas do painel não existem na Livre (decisão do usuário — o gizmo faz o papel).
- Vistas ortográficas intactas; estado do cadeado é ferramenta (fora do undo/arquivo, não persiste — volta travada).

**Suíte de 2.378 para 2.386** (+8: projeção em plano arbitrário 3, arrasto por eixo 3, cadeado no store 1, cadeado na barra 1); `tsc -b`, `eslint .` e `npm run build` limpos. Falta a conferência visual do arrasto e do gizmo no navegador.

#### Quarto adendo do mesmo dia: papel-cebola por dois checkboxes (ver `DECISOES.md` #92, terceiro adendo)

- O liga/desliga geral + três botões de modo viraram **dois checkboxes** (Anterior/Posterior) na aba Keyframes, com o estado inferido da combinação — nenhum marcado desliga.
- O modelo `(onionSkin, onionSkinMode)` do `animationStore` não mudou: os checkboxes são derivação, e o teste do painel cobre as quatro combinações.

**Suíte estável em 2.386** (o teste do papel-cebola foi reescrito, sem saldo); `tsc -b`, `eslint .` e `npm run build` limpos.

### Lote de acabamento do módulo de poses (itens 45–51, 56 e 59) ✅ (concluído em 2026-07-31)

O usuário pediu sugestões de melhoria; as quinze levantadas viraram os itens 45–59 do grupo J no `PLANO.md`, e nove foram implementadas no mesmo dia (decisão dele). Narrativa completa em `DECISOES.md` #94.

- **45** — arrasto e gesto de torção com `pointermove`/`pointerup` na **window**: o dedo saindo do canvas não deixa mais o arrasto "grudado".
- **46** — Wake Lock re-pedido no `visibilitychange` (o pedido único morria na primeira troca de aba).
- **47** — arrasto coalescido por `requestAnimationFrame`: um solve por quadro, não por evento.
- **48** — gizmo da vista Livre com tamanho constante em tela (reescalado pela distância da câmera, com grampo).
- **49** — botão **"Enquadrar boneco"** na barra: contador de comando no `posesShellStore` consumido pelo viewport; ortográficas repõem câmera/zoom da vista, a Livre mantém a direção de órbita.
- **50** — duplo toque na junta trava/destrava (previsto no item 44; raiz de fora).
- **51** — botões **±1°/±5°** nos sliders de torção e da raiz, grampeados pelos limites.
- **56** — atalho do PWA (`shortcuts` no manifest → `./?shell=poses`); a URL vence o override, e `switchShell` remove o parâmetro ao trocar de casca — sem isso o app aberto pelo atalho ficaria preso à casca da URL.
- **59** — seletor de **alcance** na aba Simetria (boneco inteiro / da junta selecionada), com o mesmo `scopeJoint` do desktop (#34) e a opção desabilitada quando a junta não tem par.
- Ficaram registrados para depois: 52 (poses de partida), 53 (badge de autosave), 54 (sessão entre cascas), 55 (pose avulsa na aba Arquivos), 57 (Playwright), 58 (extração da lógica de arrasto).

**Suíte de 2.386 para 2.394** (+8: `?shell=` na URL 3, comando de enquadrar 2, ajuste fino 1, alcance da simetria 2); toda verde; `tsc -b`, `eslint .` e `npm run build` limpos. **Falta a conferência visual no navegador** (duplo toque, gizmo reescalado, enquadrar, arrasto na window e o atalho do PWA instalado).

### Smoke de Playwright do módulo de poses (item 57) ✅ (concluído em 2026-08-01)

A dívida registrada no item 57: automatizar o que o unit test não alcança. Narrativa e fronteiras em `DECISOES.md` #95.

- **Infra**: `@playwright/test` como devDependency + Chromium, `playwright.config.ts` (viewport 425×900, dev server subido sozinho, 1 worker), specs em `e2e/`, comando **`npm run test:e2e`**. `e2e/**` excluído do vitest; artefatos no `.gitignore`.
- **Quatro smokes**, todos exigindo console limpo (`pageerror` + `console.error` vazios):
  1. casca por `?shell=poses` e troca pelos botões, conferindo que a volta **limpa o parâmetro da URL** (#94);
  2. **arrasto real da raiz** na vista de frente — coordenadas derivadas das constantes do viewport, asserção pelo **autosave do módulo** (X/Y mudam, Z travado pela vista) — e captura de keyframe aparecendo na aba;
  3. pan de um dedo no vazio é câmera, não pose;
  4. vista Livre: cadeado alterna, órbita travada não toca na pose.
- **Lição**: o primeiro run falhou na troca de casca porque o dev server compila os módulos da outra casca na primeira visita (>5 s) — timeouts pós-navegação folgados, com comentário.
- A ressalva "falta a conferência visual" **encolheu**: arrasto, pan, órbita, troca de casca e captura agora rodam em navegador real a cada `test:e2e`. Continuam manuais: gesto de torção, duplo toque, dedo nas setas do gizmo, Web Share e o atalho do PWA instalado.

**Suíte do vitest estável em 2.394** (o e2e é ferramenta à parte: **4 smokes** verdes em ~1 min); `tsc -b`, `eslint .` e `npm run build` limpos.

### Rotação por eixo, anéis gimbal e reset por eixo no módulo de poses (itens 60 e 61) ✅ (concluído em 2026-08-01)

Execução do plano registrado nos itens 60–61 do `PLANO.md`. Narrativa e decisões em `DECISOES.md` #96.

- **Sliders por eixo (item 60)**: a aba Junta trocou o slider único de torção por um bloco por eixo de DOF (`getJointAxes`), no estilo dos da raiz — limites efetivos, `setJointRotation` (clamp e trava valem). O joelho mostra um slider só; o caso "sem torção" desapareceu. O gesto de dois dedos continua no `y`.
- **Cores por eixo unificadas**: novo `src/poses/gizmoStyle.ts` (X `#e04040`, Y `#40a840`, Z `#4060e0` + escala por distância do item 48), lido pelas setas do gizmo, pelos anéis e pelos sliders (rótulo e `accent-color`). Chaves de i18n `twist*`/`rootRotation*` unificadas em `rotation*`.
- **Anéis gimbal de leitura**: `jointAxisFrames.ts` (matemática pura, fiel ao Euler XYZ — anel X no frame do pai, Y após X, Z após X e Y; raiz nos eixos do mundo) + componente `JointAxisRings` (toros não interativos, `raycast` nulo, tamanho constante em tela), em todas as vistas de edição.
- **⟲ por eixo (item 61)**: linha fina virou `[−5°, −1°, ⟲, +1°, +5°]`; a referência é a MESMA do `resetJointRotation` (`resolvePosePreset('standing')` — cotovelo volta a y=90; raiz a 0); desabilitado com a junta travada.
- **Bug latente corrigido, achado pelo e2e**: o `handleUp` do arrasto descartava o `pendingMove` coalescido por rAF — a compilação de shader dos anéis no meio do gesto tornava o descarte fatal (arrasto inteiro engolido). Agora soltar o dedo DESPACHA o movimento pendente. No smoke: poll que não aceita mais autosave vazio como sucesso, e espera de dois rAF entre criar o boneco e arrastá-lo (o Canvas é raiz React própria).

**Saldo: de 2.394 para 2.404 testes** (7 de `jointAxisFrames`, +3 líquidos na aba Junta); e2e com **4 smokes** verdes (rodada tripla limpa); `tsc -b`, `eslint .` e `npm run build` limpos.

### Âncora de junta e raiz rotacionável no arrasto (itens 62 e 63) ✅ (concluído em 2026-08-01)

Execução do plano registrado nos itens 62–63 do `PLANO.md`, desenhados com o usuário antes de qualquer código. Narrativa e decisões em `DECISOES.md` #97.

- **Âncora (item 62)**: novo `src/figure/jointPins.ts` espelhando `jointLocks.ts` + as derivações puras `frozenJointsByPins` (união das cadeias de ancestrais) e `isPlacementPinned`. A junta ancorada fica com a posição fixa no mundo: ancestrais e colocação congelam, a rotação dela própria segue livre; várias âncoras se somam; mesmo regime de persistência da trava (sessão/autosave, fora do undo e do arquivo de cena; duplicar copia, remover/poda limpam).
- **Um funil só**: `effectiveLockedJoints` (travas ∪ congeladas ∪ `root` de boneco ancorado) substituiu a leitura direta de `jointLocks` em todos os consumidores do #42 — sliders, gizmo, teclado, IK, sorteio, espelho, aplicar/copiar/misturar/importar pose. Colocação congelada: recusa no store (`setPosition`, `setRootRotation`, assentar, reset da raiz) + `keepPinnedPlacement` nas poses aplicadas + supressão do `TransformControls` do desktop (mutaria a cena antes de o store recusar).
- **Raiz rotacionável (item 63)**: no `dragSolver`, a raiz virou o ÚLTIMO elo recrutável do CCD — mesmo passo das juntas, sem clamp, pivô no quadril, três eixos (decisão do usuário) — e nunca translada. Alvo alcançável pela cadeia se comporta como antes; fora de alcance, o corpo gira atrás dele. Resultado em campo próprio `rootRotation`, gravado com as juntas **num passo de undo só** (`setJointRotations(id, rotations, rootRotation)`) nos dois caminhos de arrasto.
- **UI nas duas cascas**: botão "Fixar posição" ao lado do cadeado (agora um conjunto de duas colunas, #88) no painel de Propriedades e na aba Junta; avisos distintos para ancorada, congelada por âncora e colocação congelada; sliders/setas/resets desabilitados com o porquê; contagem de âncoras + "soltar todas"; destaque AZUL na junta ancorada (sempre visível no desktop, diferente do vermelho da trava).
- Dois testes antigos do solver mudaram de contrato de propósito: "todos os ancestrais travados" agora termina com o corpo girando (e ganhou a variante com `root` travado = âncora), e o replay de FK inclui a rotação da raiz.

**Saldo: de 2.404 para 2.441 testes** (11 de `jointPins`, 14 do store de âncoras, +3 no solver, +2 no arrasto, +1 no autosave, +3 na aba Junta, +3 no painel de Propriedades); `tsc -b`, `eslint .` e `npm run build` limpos. Falta a conferência visual no navegador: giro de corpo no arrasto, supressão do gizmo e o destaque azul.

### Trazer a sessão da outra casca (item 54) ✅ (concluído em 2026-08-01)

Execução do item 54 do `PLANO.md`, com três decisões confirmadas antes do código (workspace inteiro; gesto "trazer"; painel de Cenas + aba Arquivos). Narrativa em `DECISOES.md` #98.

- **Ação nova no store**: `loadRestoredWorkspace` aplica um `RestoredWorkspace` inteiro ao store vivo — o mesmo mapa de campos que o init consome do autosave, passando pelo mesmo funil de sanitização (`loadWorkspaceFromLocalStorage`); limpa a seleção e zera o undo, como o `resetWorkspace` (a troca de sessão não é desfazível).
- **Desktop**: botão "Trazer sessão do módulo de poses" no painel de Cenas, com a confirmação em dois passos do "novo workspace"; ao trazer, a linha do tempo reseta (`resetTimeline` — o keyframe visitado pertencia à sessão que saiu). Sem sessão salva na outra chave, aviso e nada muda.
- **Módulo de poses**: botão "Trazer sessão do desktop" na aba Arquivos, mesma confirmação; ao trazer, `currentKeyframeId` zera. A sessão trazida se grava sozinha na chave da casca atual, pelo assinante de sempre do autosave.
- Chaves de i18n novas nos dois dicionários (`panels.scenes.bringPosesSession*` e `poses.file.bringSession*`).

**Saldo: de 2.441 para 2.448 testes** (3 de `sessionTransfer`, +2 no painel de Cenas, +2 na aba Arquivos); `tsc -b`, `eslint .` e `npm run build` limpos.

### Trava por eixo na rotação da raiz (item 64) ✅ (concluído em 2026-08-01)

Nasceu de um bug relatado pelo usuário — o cadeado da raiz "não funcionava" e, na verdade, nunca existiu funcionalmente. Desenho decidido com ele antes do código (vale para tudo; cadeado por slider; sem cadeado geral na raiz). Narrativa em `DECISOES.md` #99.

- **Tokens no mapa do #42**: `root.x`/`root.y`/`root.z` entram pelo próprio `toggleJointLock` (`rootAxisLockToken`/`getLockedRootAxes` em `jointLocks.ts`; `root` crua segue recusada) — persistência, cópia, poda e sanitização herdadas, e o trânsito até o solver pelo `effectiveLockedJoints` que já existia.
- **Solver**: no passo da raiz do CCD (item 63), o eixo travado volta ao valor de partida a cada varredura — mesmo regime do clamp de limites. X+Z travados = corpo só gira de pé; os três = raiz fora do recrutamento.
- **Store**: `setRootRotation` filtra os eixos travados (slider, fino, teclado e gesto de torção num caminho só); reset da raiz zera só os destravados; `keepPinnedPlacement` (62) generalizou-se em `keepGuardedPlacement` — âncora congela a colocação inteira, eixo travado preserva só aquele eixo — cobrindo preset/par, biblioteca, cópia, colagem, mistura e pose importada; a parte da raiz de `setJointRotations` filtra também.
- **UI**: cadeado por eixo ao lado de cada slider da raiz (desktop: botão na linha do `AxisSlider`; módulo: sexta coluna da linha fina `[−5°, −1°, ⟲, +1°, +5°, 🔒]`); o botão geral de travar sumiu da raiz nas duas cascas ("Destravar todas" ficou); no gizmo do desktop o anel do eixo travado não aparece (`showX/Y/Z`); a contagem "N juntas travadas" desconta os tokens.
- Um teste antigo do módulo mudou de contrato de propósito ("a raiz não trava" → "a raiz trava por eixo").
- De quebra, o smoke de troca de casca do e2e ganhou `exact: true` no localizador "Módulo de poses": o botão "Trazer sessão do módulo de poses" (item 54) passou a casar com a busca por substring e o modo estrito acusava dois elementos.

**Saldo: de 2.448 para 2.468 testes** (4 de `jointLocks`, +3 no solver, 7 de `rootAxisLocks`, +2 no `SelectionGizmo`, +2 no painel de Propriedades, +2 na aba Junta); `tsc -b`, `eslint .` e `npm run build` limpos. Falta a conferência visual no navegador: o giro só-de-pé no arrasto e o anel oculto no gizmo.

### Confirmação da troca de sessão em modal (refino do item 54) ✅ (concluído em 2026-08-01)

Pedido do usuário: a confirmação do "trazer sessão da outra casca" em elemento `<dialog>`, no lugar do bloco inline em dois passos. Narrativa em `DECISOES.md` #100.

- Reuso do **`ConfirmDialog`/`ModalDialog` que já existiam** (confirmação de Regravar keyframe): `showModal` real no navegador, Esc cancela, atalhos globais calados, caminho degradado do jsdom já resolvido.
- Painel de Cenas (desktop) e aba Arquivos (módulo de poses) renderizam o modal condicionalmente; o botão de trazer fica sempre visível. Primeiro componente de `layout/` montado pelo módulo de poses.
- Chave órfã `poses.file.bringSessionCancel` removida dos dois dicionários (o "Cancelar" é o do próprio diálogo).
- Testes ajustados para exigir `role="dialog"` (aparece ao abrir, some ao confirmar/cancelar) + um novo de cancelamento sem efeito.
- Na sequência, a pedido do usuário, o **"Novo workspace" foi para o mesmo modal** — o painel de Cenas ficou sem nenhum confirm inline; os dois testes dele passaram a exigir o `role="dialog"` (saldo estável).

**Saldo: de 2.468 para 2.469 testes** (+1 no painel de Cenas); `tsc -b`, `eslint .` e `npm run build` limpos.

### Remessa da sessão por QR code — item 65 ✅ (concluído em 2026-08-01)

Pedido do usuário: trazer a animação do desktop para um celular DIFERENTE — onde as chaves de `localStorage` do item 54 não alcançam — sem app externo. Avaliação antes do código (QR único não carrega uma animação; arquivo por cabo é malabarismo; rede local feriria o zero-rede) e três decisões confirmadas na recomendação: sequência de QRs, sessão inteira, leitor nativo com fallback. Narrativa em `DECISOES.md` #101.

- **`src/persistence/qrTransfer.ts`** (novo): deflate nativo (`CompressionStream`) → base64 → fatias `VMQR1|id|índice|total|payload` de 800 chars; id FNV-1a separa remessas, o Adler-32 do zlib denuncia corrupção. Coletor aceita fatias em qualquer ordem, ignora repetição, QR alheio e fatia de outra remessa; remontagem corrompida devolve `null`.
- **`autosave.ts` refatorado**: `serializeWorkspacePayload`/`parseWorkspacePayload` extraídos do par de `localStorage` — a remessa usa EXATAMENTE o payload e a sanitização do autosave, nenhum formato novo.
- **Desktop** (`SessionQrSendDialog`, painel de Cenas): "Enviar sessão por QR code" abre modal que cicla os quadros (SVG do `qrcode`, 600 ms cada, fundo branco fixo — QR invertido não escaneia); a sessão é fotografada na abertura.
- **Módulo de poses** (`PosesQrReceiveDialog` + `qrFrameReader.ts`, aba Arquivo): "Receber sessão por QR code" abre a câmera (`getUserMedia`), decodifica com `BarcodeDetector` nativo ou `jsQR` empacotado, mostra o progresso ("N de M quadros") e confirma "Substituir tudo" DENTRO do modal (#100) antes de aplicar via `loadRestoredWorkspace` (keyframe corrente zerado, undo limpo — regime do item 54).
- Dependências novas empacotadas: `qrcode` (+`@types/qrcode`) e `jsqr`; `npm audit` zerado na sequência (bump do `brace-expansion`).
- i18n: 5 chaves em `panels.scenes` + 8 em `poses.file`, nos dois dicionários.

**Saldo: de 2.469 para 2.487 testes** (11 do protocolo `qrTransfer`, 4 do `qrFrameReader`, +2 no painel de Cenas, +1 no módulo de poses); `tsc -b`, `eslint .` e `npm run build` limpos. Falta a conferência visual com dois aparelhos: a coleta com câmera de verdade (foco, moiré, cadência do ciclo).

### Rename: Virtual Mockup vira WebPoser ✅ (concluído em 2026-08-02)

Decisão do usuário, na esteira do levantamento de publicação (o nome antigo era genérico e o rename tinha de vir antes do primeiro endereço público). O diretório local fica como está, a pedido. Narrativa em `DECISOES.md` #102.

- **Migração das chaves de `localStorage`** (`migrateLegacyLocalStorage`, em `shellChoice.ts`, TDD com 4 testes novos): `virtual-mockup:{shell,workspace,poses,ui}:v1` → prefixo `webposer:`, copiando a legada só se a nova não existe e removendo a antiga (cota). Roda no escopo do módulo-folha, e o `main.tsx` o importa como primeira linha — sem a migração, o rename apagaria o autosave das duas cascas.
- Renomeados: `package.json`/lock (`webposer`), manifest da PWA e `<title>` ("WebPoser"), as 2 strings de i18n com o nome à mostra (nos dois dicionários), as chaves literais nos testes e as referências nos quatro documentos canônicos.
- Mantidos de propósito: as menções históricas a `extras["virtual-mockup"]` (o bloco do tempo do `.glb` — renomeá-las falsearia a história) e o prefixo legado dentro da migração.
- Nenhum contrato de arquivo mudou — o formato de cena/animação não carrega o nome do app em campo nenhum.

**Saldo: de 2.487 para 2.491 testes** (+4 da migração de chaves); `tsc -b`, `eslint .` e `npm run build` limpos; e2e 4/4.

### Publicação automática no GitHub Pages ✅ (concluído em 2026-08-02)

Pedido do usuário na esteira do levantamento de publicação e do rename (#102): um GitHub Actions que compila e publica sozinho. Três decisões confirmadas antes do código (manter o `base` relativo; a suíte como portão; push na `main` mais disparo manual). Narrativa em `DECISOES.md` #103.

- **`.github/workflows/pages.yml`** (novo, o primeiro workflow do repositório): job `build` com `npm ci` → `npx vitest run` → `npm run lint` → `npm run build` → `upload-pages-artifact`, e job `deploy` com `needs: build` usando `deploy-pages@v4`. Node 24 com cache do npm.
- **Nenhuma mudança em código ou configuração de build.** O `base: './'` da fase 1 já entrega o app em qualquer subcaminho — `/web-poser/` (o padrão do repositório atual), `/webposer/` ou domínio próprio — sem variável de ambiente. A alternativa de fixar o caminho foi avaliada e descartada por trocar uma propriedade por uma configuração, e por exigir renomear o repositório.
- **Permissões mínimas do Pages por artefato** (`contents: read`, `pages: write`, `id-token: write`): sem token pessoal, sem branch `gh-pages`, `dist/` segue fora do versionamento. `concurrency: pages` com `cancel-in-progress: false`, para não publicar um estado parcial.
- **`README.md` reescrito em inglês** no mesmo dia, a pedido do usuário: o que o app faz (posar, cenário, exportar, animar), as duas cascas e a ponte por QR, tabela de suporte por navegador, comandos, stack, mapa do código, persistência, as cinco regras inegociáveis e os apontadores para os quatro documentos canônicos. É o único documento do projeto em inglês, e diz isso no topo.
- O smoke de Playwright ficou **fora** do workflow, coerente com o lugar dele no projeto (à parte da suíte).

**Duas correções depois das primeiras rodadas** (ver `DECISOES.md` #103.1 e #103.2):

- **`package-lock.json` regenerado no Linux.** O `npm ci` do runner recusou o lock (`Missing: @emnapi/core@1.11.3`, `@emnapi/runtime@1.11.3`) — peers de `@napi-rs/wasm-runtime`, que entra pelo fallback wasm do rolldown e que o npm no Windows nunca hoista. Regerar no Windows reproduzia o mesmo defeito; os flags `--os/--cpu/--libc` não resolvem (trocam binário, não peer). Lock gerado em container `node:24`, validado dos dois lados (`npm ci` no Linux: 598 pacotes, exit 0; `npm ci --dry-run` no Windows: up to date). Diff de 112 linhas restritas ao canto `emnapi`/`fsevents`, mais `@napi-rs/wasm-runtime` 1.1.6 → 1.2.2; **nenhuma dependência da aplicação mudou**.
- **`enablement: true` no `configure-pages`.** A rodada seguinte parou em "Get Pages site failed / Not Found" — o Pages não estava habilitado no repositório. A ação passa a ligá-lo pela API na primeira execução, em vez de exigir uma visita a `Settings > Pages`.

**Saldo: 2.491 testes, estável** (entrega de infraestrutura e documentação, sem código de aplicação); `tsc -b`, `eslint .` e `npm run build` limpos — e confirmados **no runner**, que atravessou instalação, suíte, lint e build antes de parar no passo do Pages. Falta a decisão de licença (o repositório ainda não tem `LICENSE`), apontada no levantamento como pré-requisito de qualquer publicação.

### Licença MIT ✅ (concluído em 2026-08-02)

Decisão do usuário, fechando a última pendência que o levantamento de publicação apontava como pré-requisito de qualquer endereço público. Narrativa em `DECISOES.md` #104.

- **`LICENSE`** (novo, o repositório não tinha nenhum): texto MIT padrão, `Copyright (c) 2026 Fernando Tsuda`.
- **`package.json`** ganhou `"license": "MIT"`; o `"private": true` ficou, para seguir impedindo publicação acidental no npm.
- **Compatibilidade das doze dependências de runtime conferida no lock**, não presumida: 10 MIT, `jsqr` Apache-2.0 e `mediabunny` MPL-2.0 (copyleft fraco por arquivo, usada sem modificação — a mesma leitura que aprovou a biblioteca na fase 10).
- **`README.md`** ganhou seção de licença com esse quadro; o pré-requisito no `PLANO.md` foi marcado ✅.
- Registrado no #104 o custo honesto da escolha (a MIT autoriza fork comercial sem contrapartida) e por que ela não briga com a monetização levantada: cinco dos seis modelos não vendem acesso ao software, e os packs de conteúdo são JSON, fora do alcance da licença do código.

**Saldo: 2.491 testes, estável** (entrega de licenciamento e documentação, sem código de aplicação).
