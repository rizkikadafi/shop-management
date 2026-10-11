import { useCan, useUpdate } from "@refinedev/core";
import { Button, Popconfirm } from "antd";
import { DeleteOutlined } from "@ant-design/icons";

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
        message: "Product removed",
        description: "The product was removed from the list.",
      },
    });
  };

  return (
    <Popconfirm
      title="Remove this product?"
      description="The product will be hidden from the list."
      onConfirm={confirmDelete}
    >
      <Button danger type="text" size={size} icon={<DeleteOutlined />}>
        {!hideText && "Delete"}
      </Button>
    </Popconfirm>
  );
}