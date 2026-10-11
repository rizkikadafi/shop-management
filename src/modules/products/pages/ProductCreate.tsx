import { Create, useForm, useSelect } from "@refinedev/antd";
import { useGetIdentity, type HttpError } from "@refinedev/core";
import { Form, Input, InputNumber, Select, Switch } from "antd";
import { toInsert, type Product, type ProductFormValues } from "../product.schema";

export function ProductCreate() {
  const { formProps, saveButtonProps, onFinish } = useForm<
    Product,
    HttpError,
    ProductFormValues
  >({
    resource: "products",
    action: "create",
    redirect: "show",
  });
  const { data: identity } = useGetIdentity<{ id: string }>();
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
    if (!identity?.id) {
      return;
    }
    // The insert payload adds server-owned fields (id, user_id); the form's
    // variable type only describes the editable fields.
    return onFinish(toInsert(values, identity.id) as unknown as ProductFormValues);
  };

  return (
    <Create saveButtonProps={saveButtonProps}>
      <Form
        {...formProps}
        layout="vertical"
        initialValues={{ is_active: true, price: 0 }}
        onFinish={handleFinish}
      >
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
    </Create>
  );
}
