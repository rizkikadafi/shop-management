import { Edit, useForm } from "@refinedev/antd";
import type { HttpError } from "@refinedev/core";
import { Form, Input, Select } from "antd";
import {
  UOM_LIMITS,
  UOM_TYPES,
  toUpdate,
  type Uom,
  type UomFormValues,
} from "../uom.schema";

export function UomEdit() {
  const { formProps, saveButtonProps, onFinish } = useForm<
    Uom,
    HttpError,
    UomFormValues
  >({
    resource: "uoms",
    action: "edit",
    redirect: "list",
  });

  const handleFinish = (values: UomFormValues) => {
    return onFinish(toUpdate(values) as unknown as UomFormValues);
  };

  return (
    <Edit saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical" onFinish={handleFinish}>
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
    </Edit>
  );
}
