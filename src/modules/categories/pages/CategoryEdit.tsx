import { Edit, useForm } from "@refinedev/antd";
import type { HttpError } from "@refinedev/core";
import { Form } from "antd";
import { toUpdate, type Category, type CategoryFormValues } from "../category.schema";
import { CategoryFormFields } from "../components/CategoryFormFields";

export function CategoryEdit() {
  const { formProps, saveButtonProps, onFinish } = useForm<
    Category,
    HttpError,
    CategoryFormValues
  >({
    resource: "categories",
    action: "edit",
    redirect: "list",
  });

  const handleFinish = (values: CategoryFormValues) => {
    return onFinish(toUpdate(values) as unknown as CategoryFormValues);
  };

  return (
    <Edit saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical" onFinish={handleFinish}>
        <CategoryFormFields />
      </Form>
    </Edit>
  );
}
