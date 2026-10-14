import { Edit, useForm, useSelect } from "@refinedev/antd";
import { useCan, useList, type HttpError } from "@refinedev/core";
import { Divider, Form, Input, InputNumber, Space, Switch } from "antd";
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
  toUpdate,
  type Product,
  type ProductFormValues,
} from "../product.schema";
import { ProductUomsPanel } from "../components/ProductUomsPanel";
import { ProductPricesPanel } from "../components/ProductPricesPanel";

export function ProductEdit() {
  const { t, currencySymbol } = useI18n();
  const { formProps, saveButtonProps, onFinish, query } = useForm<
    Product,
    HttpError,
    ProductFormValues
  >({
    resource: "products",
    action: "edit",
    redirect: "list",
  });
  const record = query?.data?.data;
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

  // The base unit can only be edited while the product has no other units.
  // Once conversions exist, use "Set as base" in the Units panel so the tree
  // can be re-rooted safely (conversions and price rules are preserved).
  const { query: unitsQuery, result: unitsResult } = useList<{
    id: string;
    parent_product_uom_id: string | null;
  }>({
    resource: "product_uoms",
    filters: [{ field: "product_id", operator: "eq", value: record?.id }],
    pagination: { pageSize: 1000 },
    meta: { select: "id, parent_product_uom_id" },
    queryOptions: { enabled: Boolean(record?.id) },
  });
  const hasOtherUnits = (unitsResult.data ?? []).some(
    (unit) => unit.parent_product_uom_id !== null,
  );

  const handleFinish = (values: ProductFormValues) => {
    return onFinish(toUpdate(values) as unknown as ProductFormValues);
  };

  return (
    <Edit saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical" onFinish={handleFinish}>
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
          extra={hasOtherUnits ? t("products.form.baseUomLocked") : undefined}
          rules={[
            { required: true, message: t("products.validation.baseUomRequired") },
          ]}
        >
          <QuickCreateSelect<UomFormValues>
            {...uomSelectProps}
            disabled={hasOtherUnits}
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

      {record && (
        <>
          <Divider />
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <ProductUomsPanel
              productId={record.id}
              baseUomId={record.base_uom_id}
              onBaseUomChange={() => unitsQuery.refetch()}
            />
            <ProductPricesPanel productId={record.id} />
          </Space>
        </>
      )}
    </Edit>
  );
}
