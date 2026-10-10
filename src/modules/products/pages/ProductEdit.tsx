import { Edit, useForm } from "@refinedev/antd";
import type { HttpError } from "@refinedev/core";
import { Form, Input, InputNumber, Switch } from "antd";
import { toUpdate, type Product, type ProductFormValues } from "../product.schema";

export function ProductEdit() {
  const { formProps, saveButtonProps, onFinish } = useForm<
    Product,
    HttpError,
    ProductFormValues
  >({
    resource: "products",
    action: "edit",
    redirect: "list",
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

        <Form.Item label="Active" name="is_active" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </Edit>
  );
}
