import { GlobalOutlined } from "@ant-design/icons";
import { Button, Dropdown, Grid, type MenuProps } from "antd";

import { LOCALE_CONFIG, LOCALES, type Locale } from "../i18n/config";
import { useI18n } from "../i18n/useI18n";

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.lg;

  const items: MenuProps["items"] = LOCALES.map((value) => ({
    key: value,
    label: LOCALE_CONFIG[value].label,
  }));

  return (
    <Dropdown
      trigger={["click"]}
      menu={{
        items,
        selectable: true,
        selectedKeys: [locale],
        onClick: ({ key }) => setLocale(key as Locale),
      }}
    >
      <Button type="text" icon={<GlobalOutlined />}>
        {isMobile ? null : LOCALE_CONFIG[locale].label}
      </Button>
    </Dropdown>
  );
}
