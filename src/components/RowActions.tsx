import { MoreOutlined } from "@ant-design/icons";
import {
  App,
  Button,
  Dropdown,
  Space,
  Tooltip,
  type MenuProps,
} from "antd";
import type { ReactNode } from "react";

export interface RowAction {
  key: string;
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  dividerBefore?: boolean;
  confirm?: {
    title: ReactNode;
    description?: ReactNode;
    okText?: ReactNode;
    cancelText?: ReactNode;
  };
  onClick: () => void | Promise<void>;
}

interface RowActionsProps {
  actions: RowAction[];
  moreLabel: string;
  /** How many actions to show inline before moving the rest into an overflow menu. */
  maxInline?: number;
}

export function RowActions({
  actions,
  moreLabel,
  maxInline = 1,
}: RowActionsProps) {
  const { modal } = App.useApp();

  const runAction = (action: RowAction) => {
    if (action.disabled) {
      return;
    }

    if (!action.confirm) {
      void action.onClick();
      return;
    }

    modal.confirm({
      title: action.confirm.title,
      content: action.confirm.description,
      okText: action.confirm.okText ?? action.label,
      cancelText: action.confirm.cancelText,
      okButtonProps: { danger: action.danger },
      onOk: () => action.onClick(),
    });
  };

  if (actions.length === 0) {
    return null;
  }

  const inlineActions = actions.slice(0, maxInline);
  const overflowActions = actions.slice(maxInline);

  const menuItems: MenuProps["items"] = [];
  for (const action of overflowActions) {
    if (action.dividerBefore && menuItems.length > 0) {
      menuItems.push({ type: "divider" });
    }
    menuItems.push({
      key: action.key,
      label: action.label,
      icon: action.icon,
      danger: action.danger,
      disabled: action.disabled,
    });
  }

  const handleMenuClick: MenuProps["onClick"] = ({ key }) => {
    const action = overflowActions.find((item) => item.key === key);
    if (action) {
      runAction(action);
    }
  };

  return (
    <Space size={2} wrap={false}>
      {inlineActions.map((action) => (
        <Tooltip key={action.key} title={action.label}>
          <Button
            type="text"
            size="small"
            icon={action.icon}
            danger={action.danger}
            disabled={action.disabled}
            aria-label={action.label}
            onClick={() => runAction(action)}
          >
            {action.icon ? undefined : action.label}
          </Button>
        </Tooltip>
      ))}
      {overflowActions.length > 0 && (
        <Dropdown
          trigger={["click"]}
          placement="bottomRight"
          menu={{ items: menuItems, onClick: handleMenuClick }}
        >
          <Tooltip title={moreLabel}>
            <Button
              type="text"
              size="small"
              icon={<MoreOutlined />}
              aria-label={moreLabel}
            />
          </Tooltip>
        </Dropdown>
      )}
    </Space>
  );
}
