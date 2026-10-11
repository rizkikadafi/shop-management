import { AuthPage } from "@refinedev/antd";
import { useI18n } from "../i18n/useI18n";

export function Login() {
  const { t } = useI18n();

  return (
    <AuthPage type="login" title={t("auth.brand")} registerLink={false} />
  );
}
