import { Button, DatePicker, Input, InputNumber, Select, Space } from "antd";
import type { CrudFilters } from "@refinedev/core";
import { useState } from "react";
import type { Dayjs } from "dayjs";
import { useI18n } from "../i18n/useI18n";
import type { FilterColumnDef } from "./filtering";

export type SetFilters = (
  filters: CrudFilters,
  behavior?: "merge" | "replace",
) => void;

interface ColumnFilterControlProps {
  def: FilterColumnDef;
  filters: CrudFilters;
  setFilters: SetFilters;
  setCurrentPage?: (page: number) => void;
  close: () => void;
}

export function ColumnFilterControl({
  def,
  filters,
  setFilters,
  setCurrentPage,
  close,
}: ColumnFilterControlProps) {
  const { t } = useI18n();
  const [value, setValue] = useState<unknown>(() => def.fromFilters(filters));

  const others = filters.filter(
    (filter) => !("field" in filter) || filter.field !== def.key,
  );

  const apply = (next: unknown) => {
    setFilters([...others, ...def.toFilters(next)], "replace");
    setCurrentPage?.(1);
    close();
  };

  return (
    <Space direction="vertical" style={{ padding: 8, width: 240 }}>
      <FilterValueControl
        def={def}
        value={value}
        onChange={setValue}
        onSubmit={() => apply(value)}
      />
      <Space>
        <Button type="primary" size="small" onClick={() => apply(value)}>
          {t("filters.filter")}
        </Button>
        <Button
          size="small"
          onClick={() => {
            setFilters(others, "replace");
            setCurrentPage?.(1);
            close();
          }}
        >
          {t("filters.clear")}
        </Button>
      </Space>
    </Space>
  );
}

interface FilterValueControlProps {
  def: FilterColumnDef;
  value: unknown;
  onChange: (value: unknown) => void;
  onSubmit: () => void;
}

export function FilterValueControl({
  def,
  value,
  onChange,
  onSubmit,
}: FilterValueControlProps) {
  const { t } = useI18n();

  if (def.type === "text") {
    return (
      <Input
        style={{ width: 220 }}
        allowClear
        placeholder={def.placeholderKey ? t(def.placeholderKey) : undefined}
        value={(value as string) ?? ""}
        onChange={(event) => onChange(event.target.value)}
        onPressEnter={onSubmit}
      />
    );
  }

  if (def.type === "select") {
    return (
      <Select
        style={{ minWidth: 160 }}
        allowClear
        mode={def.multiple ? "multiple" : undefined}
        showSearch={def.multiple}
        optionFilterProp="label"
        placeholder={def.placeholderKey ? t(def.placeholderKey) : t("common.any")}
        options={def.options?.map((option) => ({
          label:
            option.label ??
            (option.labelKey ? t(option.labelKey) : String(option.value)),
          value: option.value,
        }))}
        value={
          value as string | number | boolean | (string | number | boolean)[] | undefined
        }
        onChange={onChange}
      />
    );
  }

  if (def.type === "numberRange") {
    const [min, max] = (value as [number | null, number | null]) ?? [
      null,
      null,
    ];
    return (
      <Space>
        <InputNumber
          min={0}
          placeholder={t("common.min")}
          style={{ width: 110 }}
          value={min ?? null}
          onChange={(next) => onChange([next ?? null, max ?? null])}
        />
        <InputNumber
          min={0}
          placeholder={t("common.max")}
          style={{ width: 110 }}
          value={max ?? null}
          onChange={(next) => onChange([min ?? null, next ?? null])}
        />
      </Space>
    );
  }

  return (
    <DatePicker.RangePicker
      value={(value as [Dayjs, Dayjs] | null) ?? null}
      onChange={(next) => onChange(next)}
    />
  );
}
