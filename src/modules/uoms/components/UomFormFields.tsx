import { Form, Input, InputNumber, Select } from "antd";
import { useMemo } from "react";

import { useI18n } from "../../../i18n/useI18n";
import { UOM_LIMITS, UOM_TYPES, type UomType } from "../uom.schema";
import { globalDescendantIds } from "../uomGlobalConversion";
import { useUomGlobalFactors } from "../useUomGlobalFactors";

interface UomFormFieldsProps {
  /** Current UoM id when editing, so it cannot become its own ancestor. */
  currentUomId?: string;
}

/**
 * UoM form fields shared by the full create/edit pages and the
 * quick-create modal, so validation stays in one place.
 */
export function UomFormFields({ currentUomId }: UomFormFieldsProps = {}) {
  const { t, formatNumber } = useI18n();
  const form = Form.useFormInstance();
  const { uoms, uomById } = useUomGlobalFactors();

  const uomType = Form.useWatch("uom_type", form) as UomType | undefined;
  const globalParentId = Form.useWatch("global_parent_uom_id", form) as
    | string
    | null
    | undefined;
  const globalQuantity = Form.useWatch("global_quantity_in_parent", form) as
    | number
    | null
    | undefined;
  const symbol = Form.useWatch("symbol", form) as string | undefined;

  const blockedIds = useMemo(
    () =>
      currentUomId
        ? globalDescendantIds(uoms, currentUomId)
        : new Set<string>(),
    [uoms, currentUomId],
  );

  const hasGlobalChildren = useMemo(
    () =>
      Boolean(
        currentUomId &&
          uoms.some((uom) => uom.global_parent_uom_id === currentUomId),
      ),
    [uoms, currentUomId],
  );

  const parentOptions = useMemo(
    () =>
      uoms
        .filter(
          (uom) =>
            uom.uom_type === uomType &&
            uom.id !== currentUomId &&
            !blockedIds.has(uom.id),
        )
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((uom) => ({
          value: uom.id,
          label: `${uom.name} (${uom.symbol})`,
        })),
    [uoms, uomType, currentUomId, blockedIds],
  );

  const globalParent = globalParentId
    ? uomById.get(globalParentId)
    : undefined;
  const conversionSummary =
    globalParent &&
    globalQuantity &&
    Number(globalQuantity) > 0
      ? `1 ${symbol || t("uoms.form.symbol")} = ${formatNumber(
          Number(globalQuantity),
        )} ${globalParent.symbol}`
      : t("uoms.form.globalQuantityHint");

  return (
    <>
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
        extra={
          hasGlobalChildren ? t("uoms.form.typeLockedByChildren") : undefined
        }
        rules={[{ required: true, message: t("uoms.validation.typeRequired") }]}
      >
        <Select
          disabled={hasGlobalChildren}
          onChange={() =>
            form.setFieldsValue({
              global_parent_uom_id: null,
              global_quantity_in_parent: null,
            })
          }
          options={UOM_TYPES.map((type) => ({
            value: type.value,
            label: t(type.labelKey),
          }))}
        />
      </Form.Item>

      <Form.Item
        label={t("uoms.form.globalParent")}
        name="global_parent_uom_id"
        extra={t("uoms.form.globalParentHint")}
      >
        <Select
          allowClear
          showSearch
          placeholder={t("uoms.form.globalParentPlaceholder")}
          options={parentOptions}
          onChange={(value: string | null | undefined) => {
            const nextParentId = value ?? null;
            if (nextParentId === null) {
              form.setFieldsValue({ global_quantity_in_parent: null });
              return;
            }
            const existing = form.getFieldValue(
              "global_quantity_in_parent",
            );
            if (existing === null || existing === undefined) {
              form.setFieldsValue({ global_quantity_in_parent: 1 });
            }
          }}
        />
      </Form.Item>

      {globalParentId && (
        <Form.Item
          label={t("uoms.form.globalQuantity", {
            parent: globalParent?.symbol ?? t("uoms.form.parentFallback"),
          })}
          name="global_quantity_in_parent"
          extra={
            <>
              <div>{conversionSummary}</div>
              <div>{t("uoms.form.globalConversionHint")}</div>
            </>
          }
          rules={[
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!getFieldValue("global_parent_uom_id")) {
                  return Promise.resolve();
                }
                if (value === null || value === undefined) {
                  return Promise.reject(
                    new Error(t("uoms.validation.globalQuantityRequired")),
                  );
                }
                if (Number(value) <= 0) {
                  return Promise.reject(
                    new Error(t("uoms.validation.globalQuantityMin")),
                  );
                }
                return Promise.resolve();
              },
            }),
          ]}
        >
          <InputNumber
            min={0.000001}
            step={1}
            precision={6}
            style={{ width: "100%" }}
            addonAfter={globalParent?.symbol}
            placeholder={t("uoms.form.globalQuantityPlaceholder")}
          />
        </Form.Item>
      )}
    </>
  );
}
