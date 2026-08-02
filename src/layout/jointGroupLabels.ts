import type { JointGroupKey } from '../figure/jointGroups'

/**
 * Rótulos de i18n dos grupos de junta do combo de seleção. Num arquivo
 * próprio (e não em `PropertiesPanel.tsx`, onde nasceu) porque o combo é
 * usado por DUAS cascas — o painel de Propriedades do desktop e a aba Junta
 * do módulo de poses (item 44) — e exportar constante de arquivo de
 * componente quebra o fast refresh (`react-refresh/only-export-components`).
 */
export const JOINT_GROUP_LABEL_KEYS: Record<JointGroupKey, string> = {
  trunk: 'panels.properties.jointGroupTrunk',
  head: 'panels.properties.jointGroupHead',
  armRight: 'panels.properties.jointGroupArmRight',
  armLeft: 'panels.properties.jointGroupArmLeft',
  legRight: 'panels.properties.jointGroupLegRight',
  legLeft: 'panels.properties.jointGroupLegLeft',
}
