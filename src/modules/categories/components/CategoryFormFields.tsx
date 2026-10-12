import { Form, Input } from "antd";

import { useI18n } from "../../../i18n/useI18n";
import { CATEGORY_LIMITS } from "../category.schema";

/**
 * Category form fields shared by the full create/edit pages and the
 * quick-create modal, so validation stays in one place.
 */
export function CategoryFormFields() {
  const { t } = useI18n();

  return (
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
  );
}
