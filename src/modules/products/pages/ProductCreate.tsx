import { Create, useForm, useSelect } from "@refinedev/antd";
import { useCan, useGetIdentity, type HttpError } from "@refinedev/core";
import { Form, Input, InputNumber, Switch } from "antd";
import { useI18n } from "../../../i18n/useI18n";
import { QuickCreateSelect } from "../../../components/QuickCreateSelect";
import {
  toInsert as toCategoryInsert,
  type CategoryFormValues,
} from "../../categories/category.schema";
import { CategoryFormFields } from "../../categories/components/CategoryFormFields";
import {
  toInsert as toUomInsert,
  type UomFormValues,
} from "../../uoms/uom.schema";
import { UomFormFields } from "../../uoms/components/UomFormFields";
import {
  PRODUCT_LIMITS,
  toInsert,
  type Product,
  type ProductFormValues,
} from "../product.schema";

export function ProductCreate() {
  const { t, currencySymbol } = useI18n();
  const { formProps, saveButtonProps, onFinish } = useForm<
    Product,
    HttpError,
    ProductFormValues
  >({
    resource: "products",
    action: "create",
    redirect: "show",
  });
  const { data: identity } = useGetIdentity<{ id: string }>();
  const { selectProps: categorySelectProps, query: categoryQuery } = useSelect({
    resource: "categories",
    optionLabel: "name",
    optionValue: "id",
  });
  const { selectProps: uomSelectProps, query: uomQuery } = useSelect({
    resource: "uoms",
    optionLabel: "name",
    optionValue: "id",
  });
  const { data: categoryCanCreate } = useCan({
    resource: "categories",
    action: "create",
  });
  const { data: uomCanCreate } = useCan({
    resource: "uoms",
    action: "create",
  });

  const handleFinish = (values: ProductFormValues) => {
    if (!identity?.id) {
      return;
    }
    // The insert payload adds server-owned fields (id, user_id); the form's
    // variable type only describes the editable fields.
    return onFinish(toInsert(values, identity.id) as unknown as ProductFormValues);
  };

  return (
    <Create saveButtonProps={saveButtonProps}>
      <Form
        {...formProps}
        layout="vertical"
        initialValues={{ is_active: true, price: 0 }}
        onFinish={handleFinish}
      >
        <Form.Item
          label={t("products.form.name")}
          name="name"
          rules={[
            { required: true, message: t("products.validation.nameRequired") },
            {
              max: PRODUCT_LIMITS.name,
              message: t("products.validation.nameMax", {
                max: PRODUCT_LIMITS.name,
              }),
            },
          ]}
        >
          <Input placeholder={t("products.form.namePlaceholder")} />
        </Form.Item>

        <Form.Item
          label={t("products.form.sku")}
          name="sku"
          rules={[
            {
              max: PRODUCT_LIMITS.sku,
              message: t("products.validation.skuMax", { max: PRODUCT_LIMITS.sku }),
            },
          ]}
        >
          <Input placeholder={t("products.form.skuPlaceholder")} />
        </Form.Item>

        <Form.Item
          label={t("products.form.description")}
          name="description"
          rules={[
            {
              max: PRODUCT_LIMITS.description,
              message: t("products.validation.descriptionMax", {
                max: PRODUCT_LIMITS.description,
              }),
            },
          ]}
        >
          <Input.TextArea
            rows={3}
            placeholder={t("products.form.descriptionPlaceholder")}
          />
        </Form.Item>

        <Form.Item
          label={t("products.form.price")}
          name="price"
          rules={[
            { required: true, message: t("products.validation.priceRequired") },
            {
              type: "number",
              min: 0,
              message: t("products.validation.priceMin"),
            },
          ]}
        >
          <InputNumber
            min={0}
            step={0.01}
            precision={2}
            style={{ width: "100%" }}
            addonBefore={currencySymbol}
          />
        </Form.Item>

        <Form.Item label={t("products.form.category")} name="category_id">
          <QuickCreateSelect<CategoryFormValues>
            {...categorySelectProps}
            allowClear
            placeholder={t("products.form.categoryPlaceholder")}
            resource="categories"
            fieldName="category_id"
            canCreate={categoryCanCreate?.can ?? false}
            modalTitle={t("categories.create")}
            createLabel={t("categories.quickCreate")}
            fields={<CategoryFormFields />}
            prefill={(search) => ({ name: search })}
            toValues={(values) => toCategoryInsert(values)}
            onRefetch={categoryQuery.refetch}
          />
        </Form.Item>

        <Form.Item
          label={t("products.form.baseUom")}
          name="base_uom_id"
          rules={[
            { required: true, message: t("products.validation.baseUomRequired") },
          ]}
        >
          <QuickCreateSelect<UomFormValues>
            {...uomSelectProps}
            placeholder={t("products.form.baseUomPlaceholder")}
            resource="uoms"
            fieldName="base_uom_id"
            canCreate={uomCanCreate?.can ?? false}
            modalTitle={t("uoms.create")}
            createLabel={t("uoms.quickCreate")}
            fields={<UomFormFields />}
            defaults={{ uom_type: "unit" }}
            prefill={(search) => ({ name: search })}
            toValues={(values) => toUomInsert(values)}
            onRefetch={uomQuery.refetch}
          />
        </Form.Item>

        <Form.Item
          label={t("products.form.active")}
          name="is_active"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
      </Form>
    </Create>
  );
}
