import { Edit, useForm } from "@refinedev/antd";
import type { HttpError } from "@refinedev/core";
import { Form, Input } from "antd";
import { CATEGORY_LIMITS, toUpdate, type Category, type CategoryFormValues } from "../category.schema";

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
        <Form.Item
          label="Name"
          name="name"
          rules={[
            { required: true, message: "Name is required." },
            {
              max: CATEGORY_LIMITS.name,
              message: `Name must be ${CATEGORY_LIMITS.name} characters or fewer.`,
            },
          ]}
        >
          <Input placeholder="Category name" />
        </Form.Item>
      </Form>
    </Edit>
  );
}
