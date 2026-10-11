import { useCan, useUpdate } from "@refinedev/core";
import { Button, Popconfirm } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import { useI18n } from "../../../i18n/useI18n";

interface ProductSoftDeleteButtonProps {
  recordItemId: string;
  hideText?: boolean;
  size?: "small" | "middle" | "large";
}

export function ProductSoftDeleteButton({
  recordItemId,
  hideText,
  size,
}: ProductSoftDeleteButtonProps) {
  const { t } = useI18n();
  const { data: canDeleteData } = useCan({
    resource: "products",
    action: "delete",
  });
  const { mutate } = useUpdate({ resource: "products" });

  if (canDeleteData?.can === false) {
    return null;
  }

  const confirmDelete = () => {
    mutate({
      id: recordItemId,
      values: { deleted_at: new Date().toISOString() },
      invalidates: ["list", "detail"],
      successNotification: {
        type: "success",
        message: t("products.remove.success"),
        description: t("products.remove.successDescription"),
      },
    });
  };

  return (
    <Popconfirm
      title={t("products.remove.confirm")}
      description={t("products.remove.confirmDescription")}
      onConfirm={confirmDelete}
    >
      <Button danger type="text" size={size} icon={<DeleteOutlined />}>
        {!hideText && t("common.delete")}
      </Button>
    </Popconfirm>
  );
}