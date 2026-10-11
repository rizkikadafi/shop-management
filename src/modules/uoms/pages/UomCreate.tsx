import { Create, useForm } from "@refinedev/antd";
import type { HttpError } from "@refinedev/core";
import { Form, Input, Select } from "antd";
import { useI18n } from "../../../i18n/useI18n";
import {
  UOM_LIMITS,
  UOM_TYPES,
  toInsert,
  type Uom,
  type UomFormValues,
} from "../uom.schema";

export function UomCreate() {
  const { t } = useI18n();
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
        <Form.Item
          label={t("uoms.form.name")}
          name="name"
          rules={[
            { required: true, message: t("uoms.validation.nameRequired") },
            {
              max: UOM_LIMITS.name,
              message: t("uoms.validation.nameMax", { max: UOM_LIMITS.name }),
            },
          ]}
        >
          <Input placeholder={t("uoms.form.namePlaceholder")} />
        </Form.Item>

        <Form.Item
          label={t("uoms.form.symbol")}
          name="symbol"
          rules={[
            { required: true, message: t("uoms.validation.symbolRequired") },
            {
              max: UOM_LIMITS.symbol,
              message: t("uoms.validation.symbolMax", { max: UOM_LIMITS.symbol }),
            },
          ]}
        >
          <Input placeholder={t("uoms.form.symbolPlaceholder")} />
        </Form.Item>

        <Form.Item
          label={t("uoms.form.type")}
          name="uom_type"
          rules={[{ required: true, message: t("uoms.validation.typeRequired") }]}
        >
          <Select
            options={UOM_TYPES.map((type) => ({
              value: type.value,
              label: t(type.labelKey),
            }))}
          />
        </Form.Item>
      </Form>
    </Create>
  );
}
