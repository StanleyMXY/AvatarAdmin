import { useIntl } from '@umijs/max';
import { Checkbox, Tree, Typography } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { useMemo } from 'react';
import type { PermissionNode } from '../../services/system';
import {
  buildIndex,
  isSelectable,
  nodeName,
  stateOf,
  type TreeIndex,
  toggleCode,
} from './permissionTree';

type Props = {
  nodes: PermissionNode[];
  /** The complete list of the codes that are checked. */
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  /**
   * The codes the signed-in administrator holds, when they are not a super administrator: a node
   * outside it is shown but cannot be changed (the backend refuses a role with a code they do not hold).
   * Missing means every node may be changed.
   */
  grantable?: ReadonlySet<string> | null;
};

function treeData(index: TreeIndex, codes: string[]): DataNode[] {
  return codes.map((code) => ({
    key: code,
    title: code,
    children: treeData(index, index.childrenOf.get(code) ?? []),
  }));
}

/**
 * The tree of permissions with a check box on every node, for the permissions of a role. Checking a
 * node checks everything below it and every page above it; a parent with only some of its
 * descendants checked shows half checked and is not in the value; the value is always the complete list of codes (the rules are in
 * permissionTree.ts). Names follow the interface language (the other language, then the code, when
 * a name is missing). A node whose code the application does not know cannot be chosen.
 */
export function PermissionTreeSelect({ nodes, value, onChange, disabled, grantable }: Props) {
  const intl = useIntl();
  const index = useMemo(() => buildIndex(nodes), [nodes]);
  const data = useMemo(() => treeData(index, index.roots), [index]);

  return (
    <fieldset
      aria-label={intl.formatMessage({ id: 'system.tree.label' })}
      style={{ maxHeight: 360, overflow: 'auto', border: 0, margin: 0, padding: 0, minWidth: 0 }}
    >
      <Tree
        treeData={data}
        defaultExpandAll
        selectable={false}
        blockNode
        titleRender={(item) => {
          const code = String(item.key);
          const node = index.byCode.get(code) as PermissionNode;
          const state = stateOf(index, value, code);
          return (
            <Checkbox
              checked={state === 'checked'}
              indeterminate={state === 'half'}
              disabled={disabled || !isSelectable(node) || (!!grantable && !grantable.has(code))}
              onChange={() => onChange(toggleCode(index, value, code, grantable))}
            >
              <span dir="auto" style={{ overflowWrap: 'anywhere' }}>
                {nodeName(node, intl.locale)}
              </span>{' '}
              <Typography.Text type="secondary" code style={{ overflowWrap: 'anywhere' }}>
                {code}
              </Typography.Text>
            </Checkbox>
          );
        }}
      />
    </fieldset>
  );
}
