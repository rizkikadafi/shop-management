import {
  useCan,
  useCreate,
  useDelete,
  useList,
  useNotification,
  useUpdate,
} from "@refinedev/core";
import { Button, Form, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useMemo, useState } from "react";
import type { Database } from "../../../data/remote/database.types";
import type { Uom } from "../../uoms/uom.schema";

type ProductUom = Database["public"]["Tables"]["product_uoms"]["Row"];

type ProductUomRow = ProductUom & {
  uom?: { name?: string | null; symbol?: string | null } | null;
};

interface UomFormValues {
  uom_id: string;
  parent_product_uom_id: string | null;
  quantity_in_parent: number;
}

interface ProductUomsPanelProps {
  productId: string;
  baseUomId: string;
}

export function ProductUomsPanel({ productId, baseUomId }: ProductUomsPanelProps) {
  const { open } = useNotification();
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
      select: "id, product_id, uom_id, parent_product_uom_id, quantity_in_parent, created_at, updated_at, uom:uom_id(name, symbol)",
    },
  });
  const { mutate: createMutation } = useCreate({ resource: "product_uoms" });
  const { mutate: updateMutation } = useUpdate({ resource: "product_uoms" });
  const { mutate: deleteMutation } = useDelete();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProductUomRow | null>(null);
  const [form] = Form.useForm<UomFormValues>();

  const rows = result.data ?? [];
  const isLoading = query.isLoading;
  const refetch = query.refetch;

  const assignedUomIds = useMemo(
    () => new Set(rows.map((row) => row.uom_id)),
    [rows],
  );

  const rowsById = useMemo(
    () => new Map(rows.map((row) => [row.id, row])),
    [rows],
  );

  const uomsQuery = useList<Uom>({
    resource: "uoms",
    pagination: { pageSize: 1000 },
  });
  const uomRecords = uomsQuery.result.data ?? [];

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
    return rows
      .filter((row) => !editing || row.id !== editing.id)
      .map((row) => ({
        value: row.id,
        label: row.uom ? `${row.uom.name} (${row.uom.symbol ?? ""})` : row.id,
      }));
  }, [rows, editing]);

  const isBaseRow = (row: ProductUomRow) => row.uom_id === baseUomId;

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (row: ProductUomRow) => {
    setEditing(row);
    form.setFieldsValue({
      uom_id: row.uom_id,
      parent_product_uom_id: row.parent_product_uom_id ?? null,
      quantity_in_parent: Number(row.quantity_in_parent),
    });
    setModalOpen(true);
  };

  const handleFinish = (values: UomFormValues) => {
    const isBase =
      editing?.uom_id === baseUomId || values.uom_id === baseUomId;
    const parent = isBase ? null : (values.parent_product_uom_id ?? null);

    if (!isBase && !parent) {
      open?.({
        type: "error",
        message: "Parent unit required",
        description: "A non-base unit needs at least one parent unit.",
      });
      return;
    }

    if (editing) {
      updateMutation(
        {
          id: editing.id,
          values: {
            parent_product_uom_id: parent,
            quantity_in_parent: Number(values.quantity_in_parent),
          },
          invalidates: ["list"],
          successNotification: {
            type: "success",
            message: "Unit updated",
            description: "The product unit was updated.",
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
          uom_id: values.uom_id,
          parent_product_uom_id: parent,
          quantity_in_parent: Number(values.quantity_in_parent),
        },
        invalidates: ["list"],
        successNotification: {
          type: "success",
          message: "Unit added",
          description: "The product unit was added.",
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
    deleteMutation(
      {
        resource: "product_uoms",
        id: row.id,
        invalidates: ["list"],
        successNotification: {
          type: "success",
          message: "Unit removed",
          description: "The product unit was removed.",
        },
      },
      { onError: () => refetch() },
    );
  };

  return (
    <>
      <Table<ProductUomRow>
        rowKey="id"
        loading={isLoading}
        dataSource={rows}
        pagination={false}
        title={() => (
          <Space style={{ width: "100%", justifyContent: "space-between" }}>
            <span>Units of Measure</span>
            {canWrite && (
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={openCreate}
              >
                Add unit
              </Button>
            )}
          </Space>
        )}
      >
        <Table.Column<ProductUomRow>
          title="Unit"
          render={(_, row) => (
            <Space>
              {row.uom ? `${row.uom.name} (${row.uom.symbol ?? ""})` : row.uom_id}
              {isBaseRow(row) && <Tag color="green">Base</Tag>}
            </Space>
          )}
        />
        <Table.Column<ProductUomRow>
          title="Parent"
          render={(_, row) => {
            const parent = row.parent_product_uom_id
              ? rowsById.get(row.parent_product_uom_id)
              : undefined;
            return parent?.uom
              ? `${parent.uom.name} (${parent.uom.symbol ?? ""})`
              : "—";
          }}
        />
        <Table.Column<ProductUomRow>
          title="Quantity in parent"
          align="right"
          dataIndex="quantity_in_parent"
        />
        <Table.Column<ProductUomRow>
          title="Actions"
          render={(_, row) =>
            isBaseRow(row) || !canWrite ? null : (
              <Space>
                <Button size="small" onClick={() => openEdit(row)}>
                  Edit
                </Button>
                <Popconfirm
                  title="Remove this unit?"
                  onConfirm={() => handleDelete(row)}
                >
                  <Button size="small" danger>
                    Remove
                  </Button>
                </Popconfirm>
              </Space>
            )
          }
        />
      </Table>

      <Modal
        title={editing ? "Edit unit" : "Add unit"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={handleFinish}>
          <Form.Item label="Unit" name="uom_id" rules={[{ required: true }]}>
            <Select
              showSearch
              disabled={Boolean(editing)}
              placeholder="Select a unit"
              options={availableUomOptions}
            />
          </Form.Item>
          <Form.Item label="Parent unit" name="parent_product_uom_id">
            <Select
              allowClear
              placeholder={
                editing?.uom_id === baseUomId ? "Base unit has no parent" : "Optional"
              }
              options={parentOptions}
            />
          </Form.Item>
          <Form.Item
            label="Quantity in parent"
            name="quantity_in_parent"
            rules={[
              { required: true, message: "Quantity is required." },
              {
                type: "number",
                min: 0.000001,
                message: "Quantity must be greater than zero.",
              },
            ]}
          >
            <InputNumber
              min={0.000001}
              step={1}
              precision={6}
              style={{ width: "100%" }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}