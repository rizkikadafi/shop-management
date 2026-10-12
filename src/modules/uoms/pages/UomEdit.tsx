import { Edit, useForm } from "@refinedev/antd";
import type { HttpError } from "@refinedev/core";
import { Form } from "antd";
import { toUpdate, type Uom, type UomFormValues } from "../uom.schema";
import { UomFormFields } from "../components/UomFormFields";

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
        <UomFormFields />
      </Form>
    </Edit>
  );
}
