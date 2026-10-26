import {
  useCan,
  useCreate,
  useDelete,
  useList,
  useNotification,
  useUpdate,
} from "@refinedev/core";
import {
  Button,
  Form,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import {
  CalculatorOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { useMemo, useState } from "react";
import { RowActions } from "../../../components/RowActions";
import { useI18n } from "../../../i18n/useI18n";
import type { Database } from "../../../data/remote/database.types";
import { useUomGlobalFactors } from "../../uoms/useUomGlobalFactors";
import {
  derivePriceBetween,
  derivePurchasePrices,
  roundCurrency,
} from "../uomConversion";

type ProductPurchasePrice =
  Database["public"]["Tables"]["product_purchase_prices"]["Row"];

type ProductUomRow = Database["public"]["Tables"]["product_uoms"]["Row"] & {
  uom?: {
    name?: string | null;
    symbol?: string | null;
  } | null;
};

interface PurchasePriceFormValues {
  product_uom_id: string;
  purchase_price: number;
}

interface ProductPurchasePricesPanelProps {
  productId: string;
}

function labelOf(row: ProductUomRow | undefined, fallback = ""): string {
  if (!row) {
    return fallback;
  }
  return row.uom ? `${row.uom.name} (${row.uom.symbol ?? ""})` : row.id;
}

export function ProductPurchasePricesPanel({
  productId,
}: ProductPurchasePricesPanelProps) {
  const { t, formatCurrency, currencySymbol } = useI18n();
  const { open } = useNotification();
  const { data: canWriteData } = useCan({
    resource: "product_purchase_prices",
    action: "create",
  });
  const canWrite = canWriteData?.can ?? false;
  const {
    globalFactors,
    isLoading: uomsLoading,
  } = useUomGlobalFactors();

  const uomQuery = useList<ProductUomRow>({
    resource: "product_uoms",
    filters: [{ field: "product_id", operator: "eq", value: productId }],
    sorters: [{ field: "created_at", order: "asc" }],
    pagination: { pageSize: 1000 },
    meta: {
      select:
        "id, product_id, uom_id, parent_product_uom_id, quantity_in_parent, conversion_mode, created_at, updated_at, uom:uom_id(name, symbol)",
    },
  });
  const units = useMemo(
    () => uomQuery.result.data ?? [],
    [uomQuery.result.data],
  );

  const { query, result } = useList<ProductPurchasePrice>({
    resource: "product_purchase_prices",
    filters: [{ field: "product_id", operator: "eq", value: productId }],
    sorters: [{ field: "created_at", order: "asc" }],
    pagination: { pageSize: 1000 },
    meta: {
      select:
        "id, product_id, product_uom_id, purchase_price, created_at, updated_at",
    },
  });
  const prices = useMemo(() => result.data ?? [], [result.data]);
  const isLoading = query.isLoading || uomQuery.query.isLoading || uomsLoading;
  const refetch = query.refetch;

  const { mutate: createMutation, mutateAsync: createAsync } = useCreate({
    resource: "product_purchase_prices",
  });
  const { mutate: updateMutation } = useUpdate({
    resource: "product_purchase_prices",
  });
  const { mutate: deleteMutation } = useDelete();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProductPurchasePrice | null>(null);
  const [targetUomId, setTargetUomId] = useState<string | undefined>(undefined);
  const [form] = Form.useForm<PurchasePriceFormValues>();

  const unitById = useMemo(
    () => new Map(units.map((unit) => [unit.id, unit])),
    [units],
  );
  const priceByUom = useMemo(
    () => new Map(prices.map((price) => [price.product_uom_id, price])),
    [prices],
  );
  const recordedPrices = useMemo(
    () =>
      new Map(
        prices.map((price) => [
          price.product_uom_id,
          Number(price.purchase_price),
        ]),
      ),
    [prices],
  );

  const infoByUnit = useMemo(
    () => derivePurchasePrices(units, recordedPrices, globalFactors),
    [units, recordedPrices, globalFactors],
  );

  const availableUnits = useMemo(
    () => units.filter((unit) => !priceByUom.has(unit.id)),
    [units, priceByUom],
  );

  const unitOptions = useMemo(
    () =>
      editing
        ? [
          {
            value: editing.product_uom_id,
            label: labelOf(
              unitById.get(editing.product_uom_id),
              editing.product_uom_id,
            ),
          },
        ]
        : availableUnits.map((unit) => ({
          value: unit.id,
          label: labelOf(unit, unit.id),
        })),
    [editing, availableUnits, unitById],
  );

  const anchorOptions = useMemo(
    () =>
      units
        .filter((unit) => priceByUom.has(unit.id) && unit.id !== targetUomId)
        .map((unit) => ({ value: unit.id, label: labelOf(unit, unit.id) })),
    [units, priceByUom, targetUomId],
  );

  const derivedTargets = useMemo(
    () =>
      units.filter((unit) => {
        const info = infoByUnit.get(unit.id);
        return info?.source === "derived" && info.price !== null;
      }),
    [units, infoByUnit],
  );

  const openCreate = () => {
    setEditing(null);
    setTargetUomId(undefined);
    form.resetFields();
    setModalOpen(true);
  };

  const openRecord = (uomId: string) => {
    setEditing(null);
    setTargetUomId(uomId);
    form.resetFields();
    form.setFieldsValue({
      product_uom_id: uomId,
      purchase_price: infoByUnit.get(uomId)?.price ?? undefined,
    });
    setModalOpen(true);
  };

  const openEdit = (row: ProductPurchasePrice) => {
    setEditing(row);
    setTargetUomId(row.product_uom_id);
    form.resetFields();
    form.setFieldsValue({
      product_uom_id: row.product_uom_id,
      purchase_price: Number(row.purchase_price),
    });
    setModalOpen(true);
  };

  const handleUnitChange = (uomId: string) => {
    setTargetUomId(uomId);
    form.setFieldsValue({
      purchase_price: infoByUnit.get(uomId)?.price ?? undefined,
    });
  };

  const handleCalculateFrom = (anchorId: string | undefined) => {
    if (!anchorId || !targetUomId) {
      return;
    }
    const anchorPrice = recordedPrices.get(anchorId);
    if (anchorPrice === undefined) {
      return;
    }
    const price = derivePriceBetween(
      units,
      anchorId,
      targetUomId,
      anchorPrice,
      globalFactors,
    );
    if (price !== null) {
      form.setFieldsValue({ purchase_price: price });
    }
  };

  const handleFinish = (values: PurchasePriceFormValues) => {
    const price = roundCurrency(Number(values.purchase_price));

    if (editing) {
      updateMutation(
        {
          id: editing.id,
          values: { purchase_price: price },
          invalidates: ["list"],
          successNotification: {
            type: "success",
            message: t("purchasePrices.updated"),
            description: t("purchasePrices.updatedDescription"),
          },
        },
        { onSuccess: () => setModalOpen(false) },
      );
      return;
    }

    createMutation(
      {
        values: {
          id: crypto.randomUUID(),
          product_id: productId,
          product_uom_id: values.product_uom_id,
          purchase_price: price,
        },
        invalidates: ["list"],
        successNotification: {
          type: "success",
          message: t("purchasePrices.added"),
          description: t("purchasePrices.addedDescription"),
        },
      },
      {
        onSuccess: () => setModalOpen(false),
        onError: () => refetch(),
      },
    );
  };

  const handleDelete = (row: ProductPurchasePrice) => {
    deleteMutation(
      {
        resource: "product_purchase_prices",
        id: row.id,
        invalidates: ["list"],
        successNotification: {
          type: "success",
          message: t("purchasePrices.removed"),
          description: t("purchasePrices.removedDescription"),
        },
      },
      { onError: () => refetch() },
    );
  };

  const handleAutoFill = async () => {
    if (!derivedTargets.length) {
      return;
    }
    try {
      await Promise.all(
        derivedTargets.map((unit) =>
          createAsync({
            values: {
              id: crypto.randomUUID(),
              product_id: productId,
              product_uom_id: unit.id,
              purchase_price: infoByUnit.get(unit.id)?.price ?? 0,
            },
            successNotification: false,
          }),
        ),
      );
      open?.({
        type: "success",
        message: t("purchasePrices.autoFilled"),
        description: t("purchasePrices.autoFilledDescription"),
      });
      refetch();
    } catch {
      open?.({
        type: "error",
        message: t("purchasePrices.autoFillError"),
        description: t("purchasePrices.autoFillErrorDescription"),
      });
      refetch();
    }
  };

  return (
    <>
      <Table<ProductUomRow>
        rowKey="id"
        loading={isLoading}
        dataSource={units}
        pagination={false}
        scroll={{ x: "max-content" }}
        title={() => (
          <Space style={{ width: "100%", justifyContent: "space-between" }}>
            <span>{t("purchasePrices.title")}</span>
            {canWrite && (
              <Space>
                {derivedTargets.length > 0 && (
                  <Button
                    size="small"
                    icon={<CalculatorOutlined />}
                    onClick={handleAutoFill}
                  >
                    {t("purchasePrices.autoFill")}
                  </Button>
                )}
                <Button
                  type="primary"
                  size="small"
                  icon={<PlusOutlined />}
                  disabled={availableUnits.length === 0}
                  onClick={openCreate}
                >
                  {t("purchasePrices.add")}
                </Button>
              </Space>
            )}
          </Space>
        )}
      >
        <Table.Column<ProductUomRow>
          title={t("purchasePrices.unit")}
          render={(_, unit) => labelOf(unit, unit.id)}
        />
        <Table.Column<ProductUomRow>
          title={t("purchasePrices.price")}
          render={(_, unit) => {
            const info = infoByUnit.get(unit.id);
            if (!info || info.price === null) {
              return t("common.none");
            }
            return info.source === "derived" ? (
              <Typography.Text type="secondary">
                {formatCurrency(info.price)}
              </Typography.Text>
            ) : (
              formatCurrency(info.price)
            );
          }}
        />
        <Table.Column<ProductUomRow>
          title={t("purchasePrices.source")}
          render={(_, unit) => {
            const info = infoByUnit.get(unit.id);
            if (!info || info.source === "none") {
              return <Tag>{t("purchasePrices.sourceNone")}</Tag>;
            }
            if (info.source === "manual") {
              return (
                <Tag color="green">{t("purchasePrices.sourceManual")}</Tag>
              );
            }
            return <Tag color="blue">{t("purchasePrices.sourceDerived")}</Tag>;
          }}
        />
        <Table.Column<ProductUomRow>
          title={t("purchasePrices.basedOn")}
          render={(_, unit) => {
            const info = infoByUnit.get(unit.id);
            const anchor = info?.anchorId
              ? unitById.get(info.anchorId)
              : undefined;
            return anchor ? labelOf(anchor, anchor.id) : t("common.none");
          }}
        />
        <Table.Column<ProductUomRow>
          title={t("purchasePrices.actions")}
          width={80}
          align="center"
          render={(_, unit) => {
            if (!canWrite) {
              return null;
            }
            const row = priceByUom.get(unit.id);
            if (row) {
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
                    {
                      key: "remove",
                      label: t("common.remove"),
                      icon: <DeleteOutlined />,
                      danger: true,
                      confirm: {
                        title: t("purchasePrices.removeConfirm"),
                        okText: t("common.remove"),
                      },
                      onClick: () => handleDelete(row),
                    },
                  ]}
                />
              );
            }
            return (
              <RowActions
                moreLabel={t("common.moreActions")}
                actions={[
                  {
                    key: "record",
                    label: t("purchasePrices.record"),
                    icon: <PlusOutlined />,
                    onClick: () => openRecord(unit.id),
                  },
                ]}
              />
            );
          }}
        />
      </Table>

      <Modal
        title={editing ? t("purchasePrices.edit") : t("purchasePrices.add")}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={handleFinish}>
          <Form.Item
            label={t("purchasePrices.unit")}
            name="product_uom_id"
            rules={[
              { required: true, message: t("purchasePrices.unitRequired") },
            ]}
          >
            <Select
              showSearch
              disabled={Boolean(editing)}
              placeholder={t("purchasePrices.unitPlaceholder")}
              options={unitOptions}
              onChange={handleUnitChange}
            />
          </Form.Item>
          {!editing && anchorOptions.length > 0 && (
            <Form.Item
              label={t("purchasePrices.calculateFrom")}
              extra={t("purchasePrices.calculateFromHint")}
            >
              <Select
                allowClear
                disabled={!targetUomId}
                placeholder={t("purchasePrices.calculateFromPlaceholder")}
                options={anchorOptions}
                onChange={handleCalculateFrom}
              />
            </Form.Item>
          )}
          <Form.Item
            label={t("purchasePrices.price")}
            name="purchase_price"
            rules={[
              { required: true, message: t("purchasePrices.priceRequired") },
              {
                type: "number",
                min: 0,
                message: t("purchasePrices.priceMin"),
              },
            ]}
          >
            <InputNumber
              min={0}
              step={0.01}
              precision={2}
              style={{ width: "100%" }}
              addonBefore={currencySymbol}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
