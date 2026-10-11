import { Button, DatePicker, Input, InputNumber, Select, Space } from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import type { Dayjs } from "dayjs";
import { useI18n } from "../i18n/useI18n";
import type { FilterColumnDef, FilterCondition } from "./filtering";

interface ColumnFilterBarProps {
  columns: FilterColumnDef[];
  value: FilterCondition[];
  onChange: (conditions: FilterCondition[]) => void;
  onSubmit: () => void;
  onClear: () => void;
}

function createCondition(column: FilterColumnDef): FilterCondition {
  return {
    id: crypto.randomUUID(),
    column: column.key,
    value: column.type === "numberRange" ? [null, null] : (undefined as unknown),
  };
}

export function ColumnFilterBar({
  columns,
  value,
  onChange,
  onSubmit,
  onClear,
}: ColumnFilterBarProps) {
  const { t } = useI18n();
  const usedColumns = new Set(value.map((condition) => condition.column));
  const nextAvailable = columns.find((column) => !usedColumns.has(column.key));

  const addCondition = () => {
    if (!nextAvailable) return;
    onChange([...value, createCondition(nextAvailable)]);
  };

  const removeCondition = (id: string) => {
    onChange(value.filter((condition) => condition.id !== id));
  };

  const changeColumn = (id: string, columnKey: string) => {
    const def = columns.find((column) => column.key === columnKey);
    if (!def) return;
    onChange(
      value.map((condition) =>
        condition.id === id ? createCondition(def) : condition,
      ),
    );
  };

  const setValue = (id: string, newValue: unknown) => {
    onChange(
      value.map((condition) =>
        condition.id === id ? { ...condition, value: newValue } : condition,
      ),
    );
  };

  return (
    <Space direction="vertical" style={{ width: "100%", marginBottom: 16 }}>
      {value.map((condition) => {
        const def = columns.find((column) => column.key === condition.column);
        if (!def) return null;

        return (
          <Space key={condition.id} align="start" wrap>
            <Select
              value={condition.column}
              style={{ minWidth: 150 }}
              onChange={(columnKey) => changeColumn(condition.id, columnKey)}
              options={columns.map((column) => ({
                value: column.key,
                label: t(column.labelKey),
                disabled:
                  column.key !== condition.column &&
                  usedColumns.has(column.key),
              }))}
            />
            <FilterValueControl
              def={def}
              value={condition.value}
              onChange={(newValue) => setValue(condition.id, newValue)}
              onSubmit={onSubmit}
            />
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => removeCondition(condition.id)}
            />
          </Space>
        );
      })}

      <Space>
        <Button
          icon={<PlusOutlined />}
          onClick={addCondition}
          disabled={!nextAvailable}
        >
          {t("filters.add")}
        </Button>
        <Button type="primary" onClick={onSubmit}>
          {t("filters.filter")}
        </Button>
        <Button onClick={onClear}>{t("filters.clear")}</Button>
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

function FilterValueControl({
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
        placeholder={def.placeholderKey ? t(def.placeholderKey) : t("common.any")}
        options={def.options?.map((option) => ({
          label: t(option.labelKey),
          value: option.value,
        }))}
        value={value as string | number | boolean | undefined}
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
