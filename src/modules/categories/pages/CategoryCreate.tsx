import { Create, useForm } from "@refinedev/antd";
import type { HttpError } from "@refinedev/core";
import { Form, Input } from "antd";
import { CATEGORY_LIMITS, toInsert, type Category, type CategoryFormValues } from "../category.schema";

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
    </Create>
  );
}
