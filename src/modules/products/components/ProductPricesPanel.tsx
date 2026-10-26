import {
  useCan,
  useCreate,
  useDelete,
  useInvalidate,
  useList,
  useUpdate,
} from "@refinedev/core";
import {
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { useMemo, useState } from "react";
import { RowActions } from "../../../components/RowActions";
import { useI18n } from "../../../i18n/useI18n";
import type { Database } from "../../../data/remote/database.types";
import {
  BASE_PRICE_LIST,
  BASE_PRICE_MIN_QUANTITY,
  isBasePriceRule,
  samePriceRuleIdentity,
} from "../basePrice";

type ProductPrice = Database["public"]["Tables"]["product_prices"]["Row"];

type PriceRow = ProductPrice;

interface PriceFormValues {
  product_uom_id: string;
  price_list: string;
  min_quantity: number;
  package_price: number;
}

interface ProductPricesPanelProps {
  productId: string;
  baseUomId: string;
  onBasePriceChange?: (price: number) => void;
}

export function ProductPricesPanel({
  productId,
  baseUomId,
  onBasePriceChange,
}: ProductPricesPanelProps) {
  const { t, formatCurrency } = useI18n();
  const invalidate = useInvalidate();
  const { data: canWriteData } = useCan({
    resource: "product_prices",
    action: "create",
  });
  const canWrite = canWriteData?.can ?? false;

  const uomQuery = useList<{
    id: string;
    uom_id: string;
    uom?: { name?: string | null; symbol?: string | null } | null;
  }>({
    resource: "product_uoms",
    filters: [{ field: "product_id", operator: "eq", value: productId }],
    pagination: { pageSize: 1000 },
    meta: { select: "id, uom_id, uom:uom_id(name, symbol)" },
  });
  const uomRecords = useMemo(
    () => uomQuery.result.data ?? [],
    [uomQuery.result.data],
  );
  const baseProductUomId = useMemo(
    () => uomRecords.find((uom) => uom.uom_id === baseUomId)?.id,
    [uomRecords, baseUomId],
  );

  const { query, result } = useList<PriceRow>({
    resource: "product_prices",
    filters: [{ field: "product_id", operator: "eq", value: productId }],
    sorters: [{ field: "created_at", order: "asc" }],
    pagination: { pageSize: 1000 },
    meta: {
      select: "id, product_id, product_uom_id, price_list, min_quantity, package_quantity, package_price, created_at, updated_at",
    },
  });
  const rows = result.data ?? [];
  const isLoading = query.isLoading;
  const refetch = query.refetch;

  const { mutate: createMutation } = useCreate({ resource: "product_prices" });
  const { mutate: updateMutation } = useUpdate({ resource: "product_prices" });
  const { mutate: deleteMutation } = useDelete();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PriceRow | null>(null);
  const [form] = Form.useForm<PriceFormValues>();

  const uomOptions = useMemo(
    () =>
      uomRecords.map((uom) => ({
        value: uom.id,
        label: uom.uom ? `${uom.uom.name} (${uom.uom.symbol ?? ""})` : uom.id,
      })),
    [uomRecords],
  );

  const uomById = useMemo(
    () => new Map(uomRecords.map((uom) => [uom.id, uom])),
    [uomRecords],
  );

  const editingIsBasePrice = editing
    ? isBasePriceRule(editing, baseProductUomId)
    : false;

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      price_list: BASE_PRICE_LIST,
      min_quantity: BASE_PRICE_MIN_QUANTITY,
      package_price: 0,
    });
    setModalOpen(true);
  };

  const openEdit = (row: PriceRow) => {
    setEditing(row);
    form.setFieldsValue({
      product_uom_id: row.product_uom_id,
      price_list: row.price_list,
      min_quantity: Number(row.min_quantity),
      package_price: Number(row.package_price),
    });
    setModalOpen(true);
  };

  const handleFinish = (values: PriceFormValues) => {
    const price = Number(values.package_price);
    const identity = {
      product_uom_id: values.product_uom_id,
      price_list: values.price_list,
      min_quantity: Number(values.min_quantity),
    };
    const duplicate = rows.find(
      (row) => row.id !== editing?.id && samePriceRuleIdentity(row, identity),
    );
    if (duplicate && !editingIsBasePrice) {
      form.setFields([
        {
          name: "price_list",
          errors: [t("productPrices.duplicate")],
        },
      ]);
      return;
    }

    const linkedAfter = isBasePriceRule(identity, baseProductUomId);
    const applyBasePrice = () => {
      if (!linkedAfter) {
        return;
      }
      onBasePriceChange?.(price);
      invalidate({ resource: "products", invalidates: ["list"] });
    };

    if (editing) {
      updateMutation(
        {
          id: editing.id,
          values: {
            price_list: values.price_list.trim(),
            min_quantity: Number(values.min_quantity),
            ...(linkedAfter ? { package_quantity: 1 } : {}),
            package_price: price,
          },
          invalidates: ["list"],
          successNotification: {
            type: "success",
            message: t("productPrices.updated"),
            description: t("productPrices.updatedDescription"),
          },
        },
        {
          onSuccess: () => {
            setModalOpen(false);
            applyBasePrice();
          },
        },
      );
      return;
    }

    createMutation(
      {
        values: {
          id: crypto.randomUUID(),
          product_id: productId,
          product_uom_id: values.product_uom_id,
          price_list: values.price_list.trim(),
          min_quantity: Number(values.min_quantity),
          package_quantity: 1,
          package_price: price,
        },
        invalidates: ["list"],
        successNotification: {
          type: "success",
          message: t("productPrices.added"),
          description: t("productPrices.addedDescription"),
        },
      },
      {
        onSuccess: () => {
          setModalOpen(false);
          applyBasePrice();
        },
        onError: () => refetch(),
      },
    );
  };

  const handleDelete = (row: PriceRow) => {
    if (isBasePriceRule(row, baseProductUomId)) {
      return;
    }

    deleteMutation(
      {
        resource: "product_prices",
        id: row.id,
        invalidates: ["list"],
        successNotification: {
          type: "success",
          message: t("productPrices.removed"),
          description: t("productPrices.removedDescription"),
        },
      },
      { onError: () => refetch() },
    );
  };

  return (
    <>
      <Table<PriceRow>
        rowKey="id"
        loading={isLoading}
        dataSource={rows}
        pagination={false}
        scroll={{ x: "max-content" }}
        title={() => (
          <Space style={{ width: "100%", justifyContent: "space-between" }}>
            <span>{t("productPrices.title")}</span>
            {canWrite && (
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={openCreate}
              >
                {t("productPrices.add")}
              </Button>
            )}
          </Space>
        )}
      >
        <Table.Column<PriceRow>
          title={t("productPrices.unit")}
          render={(_, row) => {
            const productUom = uomById.get(row.product_uom_id);
            const label = productUom?.uom
              ? `${productUom.uom.name} (${productUom.uom.symbol ?? ""})`
              : row.product_uom_id;
            return (
              <Space size={4}>
                {label}
                {isBasePriceRule(row, baseProductUomId) && (
                  <Tag color="green">{t("productPrices.base")}</Tag>
                )}
              </Space>
            );
          }}
        />
        <Table.Column<PriceRow>
          title={t("productPrices.priceList")}
          dataIndex="price_list"
        />
        <Table.Column<PriceRow>
          title={t("productPrices.minQty")}
          dataIndex="min_quantity"
        />
        <Table.Column<PriceRow>
          title={t("productPrices.price")}
          render={(_, row) => formatCurrency(row.package_price)}
        />
        <Table.Column<PriceRow>
          title={t("productPrices.actions")}
          width={80}
          align="center"
          render={(_, row) => {
            if (!canWrite) {
              return null;
            }

            const linked = isBasePriceRule(row, baseProductUomId);
            return (
              <RowActions
                moreLabel={t("common.moreActions")}
                maxInline={2}
                actions={[
                  {
                    key: "edit",
                    label: t("common.edit"),
                    icon: <EditOutlined />,
                    onClick: () => openEdit(row),
                  },
                  ...(linked
                    ? []
                    : [
                      {
                        key: "remove",
                        label: t("common.remove"),
                        icon: <DeleteOutlined />,
                        danger: true,
                        confirm: {
                          title: t("productPrices.removeConfirm"),
                          okText: t("common.remove"),
                        },
                        onClick: () => handleDelete(row),
                      },
                    ]),
                ]}
              />
            );
          }}
        />
      </Table>

      <Modal
        title={editing ? t("productPrices.edit") : t("productPrices.add")}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={handleFinish}>
          {editingIsBasePrice && (
            <Typography.Paragraph type="secondary">
              {t("productPrices.baseLinked")}
            </Typography.Paragraph>
          )}
          <Form.Item
            label={t("productPrices.unit")}
            name="product_uom_id"
            rules={[
              { required: true, message: t("productPrices.unitRequired") },
            ]}
          >
            <Select
              showSearch
              disabled={editingIsBasePrice}
              placeholder={t("productPrices.unitPlaceholder")}
              options={uomOptions}
            />
          </Form.Item>
          <Form.Item
            label={t("productPrices.priceList")}
            name="price_list"
            rules={[
              { required: true, message: t("productPrices.priceListRequired") },
            ]}
          >
            <Input
              disabled={editingIsBasePrice}
              placeholder={t("productPrices.priceListPlaceholder")}
            />
          </Form.Item>
          <Form.Item
            label={t("productPrices.minQuantity")}
            name="min_quantity"
            rules={[
              {
                required: true,
                message: t("productPrices.minQuantityRequired"),
              },
              {
                type: "number",
                min: 0.000001,
                message: t("productPrices.minQuantityMin"),
              },
            ]}
          >
            <InputNumber
              min={0.000001}
              step={1}
              precision={6}
              style={{ width: "100%" }}
              disabled={editingIsBasePrice}
            />
          </Form.Item>
          <Form.Item
            label={t("productPrices.price")}
            name="package_price"
            rules={[
              { required: true, message: t("productPrices.priceRequired") },
              {
                type: "number",
                min: 0,
                message: t("productPrices.priceMin"),
              },
            ]}
          >
            <InputNumber
              min={0}
              step={0.01}
              precision={2}
              style={{ width: "100%" }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
