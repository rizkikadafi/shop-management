import { Edit, useForm } from "@refinedev/antd";
import type { HttpError } from "@refinedev/core";
import { Form, Input } from "antd";
import { useI18n } from "../../../i18n/useI18n";
import { CATEGORY_LIMITS, toUpdate, type Category, type CategoryFormValues } from "../category.schema";

export function CategoryEdit() {
  const { t } = useI18n();
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
    </Edit>
  );
}
