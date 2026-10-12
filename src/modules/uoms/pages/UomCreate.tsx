import { Create, useForm } from "@refinedev/antd";
import type { HttpError } from "@refinedev/core";
import { Form } from "antd";
import { toInsert, type Uom, type UomFormValues } from "../uom.schema";
import { UomFormFields } from "../components/UomFormFields";

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
        <UomFormFields />
      </Form>
    </Create>
  );
}
