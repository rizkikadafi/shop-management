import { Create, useForm } from "@refinedev/antd";
import type { HttpError } from "@refinedev/core";
import { Form } from "antd";
import { toInsert, type Category, type CategoryFormValues } from "../category.schema";
import { CategoryFormFields } from "../components/CategoryFormFields";

export function CategoryCreate() {
  const { formProps, saveButtonProps, onFinish } = useForm<
    Category,
    HttpError,
    CategoryFormValues
  >({
    resource: "categories",
    action: "create",
    redirect: "list",
  });

  const handleFinish = (values: CategoryFormValues) => {
    return onFinish(toInsert(values) as unknown as CategoryFormValues);
  };

  return (
    <Create saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical" onFinish={handleFinish}>
        <CategoryFormFields />
      </Form>
    </Create>
  );
}
