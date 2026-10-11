import { Create, useForm } from "@refinedev/antd";
import type { HttpError } from "@refinedev/core";
import { Form, Input, Select } from "antd";
import {
  UOM_LIMITS,
  UOM_TYPES,
  toInsert,
  type Uom,
  type UomFormValues,
} from "../uom.schema";

export function UomCreate() {
  const { formProps, saveButtonProps, onFinish } = useForm<
    Uom,
    HttpError,
    UomFormValues
  >({
    resource: "uoms",
    action: "create",
    redirect: "list",
  });

  const handleFinish = (values: UomFormValues) => {
    return onFinish(toInsert(values) as unknown as UomFormValues);
  };

  return (
    <Create saveButtonProps={saveButtonProps}>
      <Form
        {...formProps}
        layout="vertical"
        initialValues={{ uom_type: "unit" }}
        onFinish={handleFinish}
      >
        <Form.Item
          label="Name"
          name="name"
          rules={[
            { required: true, message: "Name is required." },
            {
              max: UOM_LIMITS.name,
              message: `Name must be ${UOM_LIMITS.name} characters or fewer.`,
            },
          ]}
        >
          <Input placeholder="e.g. Kilogram" />
        </Form.Item>

        <Form.Item
          label="Symbol"
          name="symbol"
          rules={[
            { required: true, message: "Symbol is required." },
            {
              max: UOM_LIMITS.symbol,
              message: `Symbol must be ${UOM_LIMITS.symbol} characters or fewer.`,
            },
          ]}
        >
          <Input placeholder="e.g. kg" />
        </Form.Item>

        <Form.Item
          label="Type"
          name="uom_type"
          rules={[{ required: true, message: "Type is required." }]}
        >
          <Select options={UOM_TYPES.map((type) => ({ ...type }))} />
        </Form.Item>
      </Form>
    </Create>
  );
}
