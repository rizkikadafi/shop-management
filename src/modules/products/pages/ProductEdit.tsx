import { Edit, useForm, useSelect } from "@refinedev/antd";
import type { HttpError } from "@refinedev/core";
import { Divider, Form, Input, InputNumber, Select, Space, Switch } from "antd";
import { toUpdate, type Product, type ProductFormValues } from "../product.schema";
import { ProductUomsPanel } from "../components/ProductUomsPanel";
import { ProductPricesPanel } from "../components/ProductPricesPanel";

export function ProductEdit() {
  const { formProps, saveButtonProps, onFinish, query } = useForm<
    Product,
    HttpError,
    ProductFormValues
  >({
    resource: "products",
    action: "edit",
    redirect: "list",
  });
  const record = query?.data?.data;
  const { selectProps: categorySelectProps } = useSelect({
    resource: "categories",
    optionLabel: "name",
    optionValue: "id",
  });
  const { selectProps: uomSelectProps } = useSelect({
    resource: "uoms",
    optionLabel: "name",
    optionValue: "id",
  });

  const handleFinish = (values: ProductFormValues) => {
    return onFinish(toUpdate(values) as unknown as ProductFormValues);
  };

  return (
    <Edit saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical" onFinish={handleFinish}>
        <Form.Item
          label="Name"
          name="name"
          rules={[
            { required: true, message: "Name is required." },
            { max: 200, message: "Name must be 200 characters or fewer." },
          ]}
        >
          <Input placeholder="Product name" />
        </Form.Item>

        <Form.Item
          label="SKU"
          name="sku"
          rules={[{ max: 64, message: "SKU must be 64 characters or fewer." }]}
        >
          <Input placeholder="Optional stock keeping unit" />
        </Form.Item>

        <Form.Item
          label="Description"
          name="description"
          rules={[
            { max: 2000, message: "Description must be 2000 characters or fewer." },
          ]}
        >
          <Input.TextArea rows={3} placeholder="Optional description" />
        </Form.Item>

        <Form.Item
          label="Price"
          name="price"
          rules={[
            { required: true, message: "Price is required." },
            {
              type: "number",
              min: 0,
              message: "Price must be zero or greater.",
            },
          ]}
        >
          <InputNumber
            min={0}
            step={0.01}
            precision={2}
            style={{ width: "100%" }}
            addonBefore="$"
          />
        </Form.Item>

        <Form.Item label="Category" name="category_id">
          <Select allowClear placeholder="Select a category" {...categorySelectProps} />
        </Form.Item>

        <Form.Item
          label="Base Unit of Measure"
          name="base_uom_id"
          rules={[{ required: true, message: "Base unit is required." }]}
        >
          <Select showSearch placeholder="Select the base unit" {...uomSelectProps} />
        </Form.Item>

        <Form.Item label="Active" name="is_active" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
      {record && (
        <>
          <Divider />
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <ProductUomsPanel
              productId={record.id}
              baseUomId={record.base_uom_id}
            />
            <ProductPricesPanel productId={record.id} />
          </Space>
        </>
      )}
    </Edit>
  );
}
