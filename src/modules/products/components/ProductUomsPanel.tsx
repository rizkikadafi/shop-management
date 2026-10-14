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
  Popconfirm,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useMemo, useState } from "react";
import { useI18n } from "../../../i18n/useI18n";
import type { Database } from "../../../data/remote/database.types";
import type { Uom, UomType } from "../../uoms/uom.schema";
import {
  descendantIds,
  factorToBaseMap,
  formatQuantity,
} from "../uomConversion";

type ProductUom = Database["public"]["Tables"]["product_uoms"]["Row"];

type ProductUomRow = ProductUom & {
  uom?: { name?: string | null; symbol?: string | null } | null;
};

interface UomFormValues {
  uom_id: string;
  parent_product_uom_id: string | null;
  quantity_in_parent: number;
}

type FactorDirection = "unitToParent" | "parentToUnit";

interface UnitSubmit {
  uom_id: string;
  parent: string | null;
  quantity: number;
}

interface ProductUomsPanelProps {
  productId: string;
  baseUomId: string;
  /** Called after the product's base unit changes so callers can refresh. */
  onBaseUomChange?: () => void;
}

function rowLabel(row: ProductUomRow | undefined, fallback: string): string {
  return row?.uom?.symbol || row?.uom?.name || fallback;
}

interface UnitFormModalProps {
  editing: ProductUomRow | null;
  baseUomId: string;
  rows: ProductUomRow[];
  uomRecords: Uom[];
  onCancel: () => void;
  onSubmit: (payload: UnitSubmit) => void;
}

/**
 * Mounted only while open, so the form instance and its `Form` element are
 * created together and start from clean initial values each time.
 */
function UnitFormModal({
  editing,
  baseUomId,
  rows,
  uomRecords,
  onCancel,
  onSubmit,
}: UnitFormModalProps) {
  const { t } = useI18n();
  const { open } = useNotification();
  const [form] = Form.useForm<UomFormValues>();
  const [factorDirection, setFactorDirection] =
    useState<FactorDirection>("unitToParent");
  const [selectedUomId, setSelectedUomId] = useState<string | undefined>(
    editing?.uom_id,
  );
  const [selectedParentId, setSelectedParentId] = useState<string | null>(
    editing?.parent_product_uom_id ?? null,
  );
  const [quantityValue, setQuantityValue] = useState<number | undefined>(
    editing ? Number(editing.quantity_in_parent) : undefined,
  );

  const rowsById = useMemo(
    () => new Map(rows.map((row) => [row.id, row])),
    [rows],
  );
  const uomById = useMemo(
    () => new Map(uomRecords.map((uom) => [uom.id, uom])),
    [uomRecords],
  );
  const assignedUomIds = useMemo(
    () => new Set(rows.map((row) => row.uom_id)),
    [rows],
  );

  const availableUomOptions = useMemo(() => {
    const options = uomRecords.map((uom) => ({
      value: uom.id,
      label: `${uom.name} (${uom.symbol})`,
    }));
    return editing
      ? options.filter(
          (option) =>
            option.value === editing.uom_id ||
            !assignedUomIds.has(option.value),
        )
      : options.filter((option) => !assignedUomIds.has(option.value));
  }, [uomRecords, editing, assignedUomIds]);

  const parentOptions = useMemo(() => {
    const blocked = editing ? descendantIds(rows, editing.id) : new Set<string>();
    const selectedType = selectedUomId
      ? (uomById.get(selectedUomId)?.uom_type as UomType | undefined)
      : undefined;

    return rows
      .filter((row) => {
        if (editing && row.id === editing.id) {
          return false;
        }
        // Never allow a unit to become a child of one of its own descendants.
        if (blocked.has(row.id)) {
          return false;
        }
        // Conversions only make sense within one measurement family.
        if (selectedType && uomById.get(row.uom_id)?.uom_type !== selectedType) {
          return false;
        }
        return true;
      })
      .map((row) => ({
        value: row.id,
        label: row.uom ? `${row.uom.name} (${row.uom.symbol ?? ""})` : row.id,
      }));
  }, [rows, editing, selectedUomId, uomById]);

  const handleDirectionChange = (next: FactorDirection) => {
    if (next === factorDirection) {
      return;
    }
    // Keep the underlying conversion constant while the user reads it the
    // other way around (e.g. "1 pcs = 0.1 pack" <-> "10 pcs = 1 pack").
    if (quantityValue && quantityValue > 0) {
      const flipped = Number((1 / quantityValue).toFixed(6));
      form.setFieldsValue({ quantity_in_parent: flipped });
      setQuantityValue(flipped);
    }
    setFactorDirection(next);
  };

  const handleFinish = (values: UomFormValues) => {
    const isBase = values.uom_id === baseUomId;
    const parent = isBase ? null : (values.parent_product_uom_id ?? null);

    if (!isBase && !parent) {
      open?.({
        type: "error",
        message: t("productUnits.parentRequired"),
        description: t("productUnits.parentRequiredDescription"),
      });
      return;
    }

    const raw = Number(values.quantity_in_parent);
    const quantity = isBase
      ? 1
      : factorDirection === "unitToParent"
        ? raw
        : 1 / raw;

    onSubmit({ uom_id: values.uom_id, parent, quantity });
  };

  const unitSymbol =
    (selectedUomId ? uomById.get(selectedUomId)?.symbol : undefined) ??
    t("productUnits.unit");
  const parentRow = selectedParentId ? rowsById.get(selectedParentId) : undefined;
  const parentSymbol = parentRow
    ? rowLabel(parentRow, t("productUnits.unit"))
    : t("productUnits.parent");
  const factorExtra =
    quantityValue && Number.isFinite(quantityValue) && quantityValue > 0
      ? factorDirection === "unitToParent"
        ? `1 ${unitSymbol} = ${formatQuantity(quantityValue)} ${parentSymbol}`
        : `1 ${parentSymbol} = ${formatQuantity(quantityValue)} ${unitSymbol}`
      : undefined;

  return (
    <Modal
      title={editing ? t("productUnits.edit") : t("productUnits.add")}
      open
      onCancel={onCancel}
      onOk={() => form.submit()}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={
          editing
            ? {
                uom_id: editing.uom_id,
                parent_product_uom_id: editing.parent_product_uom_id ?? null,
                quantity_in_parent: Number(editing.quantity_in_parent),
              }
            : {}
        }
        onFinish={handleFinish}
      >
        <Form.Item
          label={t("productUnits.unit")}
          name="uom_id"
          rules={[{ required: true }]}
        >
          <Select
            showSearch
            disabled={Boolean(editing)}
            placeholder={t("productUnits.unitPlaceholder")}
            options={availableUomOptions}
            onChange={(value: string) => {
              setSelectedUomId(value);
              // Drop a parent that no longer matches the new unit's family.
              const nextType = uomById.get(value)?.uom_type;
              if (
                selectedParentId &&
                uomById.get(rowsById.get(selectedParentId)?.uom_id ?? "")
                  ?.uom_type !== nextType
              ) {
                setSelectedParentId(null);
                form.setFieldsValue({ parent_product_uom_id: null });
              }
            }}
          />
        </Form.Item>
        <Form.Item
          label={t("productUnits.parentUnit")}
          name="parent_product_uom_id"
          extra={t("productUnits.parentHint")}
        >
          <Select
            allowClear
            placeholder={
              editing?.uom_id === baseUomId
                ? t("productUnits.basePlaceholder")
                : t("productUnits.optionalPlaceholder")
            }
            options={parentOptions}
            onChange={(value: string | null | undefined) =>
              setSelectedParentId(value ?? null)
            }
          />
        </Form.Item>
        <Form.Item label={t("productUnits.factorDirection")}>
          <Segmented<FactorDirection>
            value={factorDirection}
            onChange={handleDirectionChange}
            options={[
              {
                label: t("productUnits.factorModeUnitToParent"),
                value: "unitToParent",
              },
              {
                label: t("productUnits.factorModeParentToUnit"),
                value: "parentToUnit",
              },
            ]}
          />
        </Form.Item>
        <Form.Item
          label={t("productUnits.quantityInParent")}
          name="quantity_in_parent"
          extra={factorExtra}
          rules={[
            { required: true, message: t("productUnits.quantityRequired") },
            {
              type: "number",
              min: 0.000001,
              message: t("productUnits.quantityMin"),
            },
          ]}
        >
          <InputNumber
            min={0.000001}
            step={1}
            precision={6}
            style={{ width: "100%" }}
            onChange={(value) =>
              setQuantityValue(typeof value === "number" ? value : undefined)
            }
          />
        </Form.Item>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          {factorDirection === "unitToParent"
            ? t("productUnits.factorHintUnitToParent")
            : t("productUnits.factorHintParentToUnit")}
        </Typography.Paragraph>
      </Form>
    </Modal>
  );
}

export function ProductUomsPanel({
  productId,
  baseUomId,
  onBaseUomChange,
}: ProductUomsPanelProps) {
  const { t } = useI18n();
  const { data: canWriteData } = useCan({
    resource: "product_uoms",
    action: "create",
  });
  const canWrite = canWriteData?.can ?? false;
  const { query, result } = useList<ProductUomRow>({
    resource: "product_uoms",
    filters: [{ field: "product_id", operator: "eq", value: productId }],
    sorters: [{ field: "created_at", order: "asc" }],
    meta: {
      select:
        "id, product_id, uom_id, parent_product_uom_id, quantity_in_parent, created_at, updated_at, uom:uom_id(name, symbol)",
    },
  });
  const { mutate: createUnitMutation } = useCreate({
    resource: "product_uoms",
  });
  const { mutate: updateUnitMutation } = useUpdate({
    resource: "product_uoms",
  });
  const { mutate: deleteUnitMutation } = useDelete();
  const { mutate: setBaseMutation } = useUpdate({ resource: "products" });

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProductUomRow | null>(null);

  const rows = useMemo(() => result.data ?? [], [result.data]);
  const isLoading = query.isLoading;
  const refetch = query.refetch;

  const rowsById = useMemo(
    () => new Map(rows.map((row) => [row.id, row])),
    [rows],
  );

  const factorMap = useMemo(() => factorToBaseMap(rows), [rows]);

  const baseRow = useMemo(
    () => rows.find((row) => row.uom_id === baseUomId),
    [rows, baseUomId],
  );
  const baseSymbol = rowLabel(baseRow, t("productUnits.unit"));

  const uomsQuery = useList<Uom>({
    resource: "uoms",
    pagination: { pageSize: 1000 },
  });
  const uomRecords = useMemo(
    () => uomsQuery.result.data ?? [],
    [uomsQuery.result.data],
  );

  const isBaseRow = (row: ProductUomRow) => row.uom_id === baseUomId;

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (row: ProductUomRow) => {
    setEditing(row);
    setModalOpen(true);
  };

  const handleSubmit = (payload: UnitSubmit) => {
    if (editing) {
      updateUnitMutation(
        {
          id: editing.id,
          values: {
            parent_product_uom_id: payload.parent,
            quantity_in_parent: payload.quantity,
          },
          invalidates: ["list"],
          successNotification: {
            type: "success",
            message: t("productUnits.updated"),
            description: t("productUnits.updatedDescription"),
          },
        },
        { onSuccess: () => setModalOpen(false) },
      );
      return;
    }

    createUnitMutation(
      {
        values: {
          id: crypto.randomUUID(),
          product_id: productId,
          uom_id: payload.uom_id,
          parent_product_uom_id: payload.parent,
          quantity_in_parent: payload.quantity,
        },
        invalidates: ["list"],
        successNotification: {
          type: "success",
          message: t("productUnits.added"),
          description: t("productUnits.addedDescription"),
        },
      },
      {
        onSuccess: () => setModalOpen(false),
        onError: () => {
          refetch();
        },
      },
    );
  };

  const handleDelete = (row: ProductUomRow) => {
    deleteUnitMutation(
      {
        resource: "product_uoms",
        id: row.id,
        invalidates: ["list"],
        successNotification: {
          type: "success",
          message: t("productUnits.removed"),
          description: t("productUnits.removedDescription"),
        },
      },
      { onError: () => refetch() },
    );
  };

  const handleSetBase = (row: ProductUomRow) => {
    setBaseMutation(
      {
        id: productId,
        values: { base_uom_id: row.uom_id },
        invalidates: ["list", "detail"],
        successNotification: {
          type: "success",
          message: t("productUnits.baseChanged"),
          description: t("productUnits.baseChangedDescription"),
        },
      },
      {
        onSuccess: () => {
          refetch();
          onBaseUomChange?.();
        },
        onError: () => refetch(),
      },
    );
  };

  return (
    <>
      <Table<ProductUomRow>
        rowKey="id"
        loading={isLoading}
        dataSource={rows}
        pagination={false}
        scroll={{ x: "max-content" }}
        title={() => (
          <Space style={{ width: "100%", justifyContent: "space-between" }}>
            <span>{t("productUnits.title")}</span>
            {canWrite && (
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={openCreate}
              >
                {t("productUnits.add")}
              </Button>
            )}
          </Space>
        )}
      >
        <Table.Column<ProductUomRow>
          title={t("productUnits.unit")}
          render={(_, row) => (
            <Space>
              {row.uom ? `${row.uom.name} (${row.uom.symbol ?? ""})` : row.uom_id}
              {isBaseRow(row) && (
                <Tag color="green">{t("productUnits.base")}</Tag>
              )}
            </Space>
          )}
        />
        <Table.Column<ProductUomRow>
          title={t("productUnits.parent")}
          render={(_, row) => {
            const parent = row.parent_product_uom_id
              ? rowsById.get(row.parent_product_uom_id)
              : undefined;
            return parent?.uom
              ? `${parent.uom.name} (${parent.uom.symbol ?? ""})`
              : t("common.none");
          }}
        />
        <Table.Column<ProductUomRow>
          title={t("productUnits.quantityInParent")}
          align="right"
          render={(_, row) =>
            isBaseRow(row) ? "1" : formatQuantity(row.quantity_in_parent)
          }
        />
        <Table.Column<ProductUomRow>
          title={t("productUnits.conversion")}
          align="right"
          render={(_, row) => {
            if (isBaseRow(row)) {
              return t("common.none");
            }
            const factor = factorMap.get(row.id) ?? 1;
            return `1 ${rowLabel(row, t("productUnits.unit"))} = ${formatQuantity(
              factor,
            )} ${baseSymbol}`;
          }}
        />
        <Table.Column<ProductUomRow>
          title={t("productUnits.actions")}
          render={(_, row) =>
            isBaseRow(row) || !canWrite ? null : (
              <Space>
                <Button size="small" onClick={() => openEdit(row)}>
                  {t("common.edit")}
                </Button>
                <Popconfirm
                  title={t("productUnits.setAsBaseConfirm")}
                  description={t("productUnits.setAsBaseConfirmDescription")}
                  onConfirm={() => handleSetBase(row)}
                >
                  <Button size="small">{t("productUnits.setAsBase")}</Button>
                </Popconfirm>
                <Popconfirm
                  title={t("productUnits.removeConfirm")}
                  onConfirm={() => handleDelete(row)}
                >
                  <Button size="small" danger>
                    {t("common.remove")}
                  </Button>
                </Popconfirm>
              </Space>
            )
          }
        />
      </Table>

      {modalOpen && (
        <UnitFormModal
          editing={editing}
          baseUomId={baseUomId}
          rows={rows}
          uomRecords={uomRecords}
          onCancel={() => setModalOpen(false)}
          onSubmit={handleSubmit}
        />
      )}
    </>
  );
}
