import { Create, useForm } from "@refinedev/antd";
import type { HttpError } from "@refinedev/core";
import { Form, Input } from "antd";
import { useI18n } from "../../../i18n/useI18n";
import { CATEGORY_LIMITS, toInsert, type Category, type CategoryFormValues } from "../category.schema";

export function CategoryCreate() {
  const { t } = useI18n();
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
          label={t("categories.form.name")}
          name="name"
          rules={[
            { required: true, message: t("categories.validation.nameRequired") },
            {
              max: CATEGORY_LIMITS.name,
              message: t("categories.validation.nameMax", {
                max: CATEGORY_LIMITS.name,
              }),
            },
          ]}
        >
          <Input placeholder={t("categories.form.namePlaceholder")} />
        </Form.Item>
      </Form>
    </Create>
  );
}
