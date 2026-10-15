import { Alert } from "antd";

import { useI18n } from "../i18n/useI18n";
import { useOnline } from "../data/sync/useSyncStatus";

/**
 * Banner shown on online-only screens (user management) while offline.
 * Renders nothing when the device is online.
 */
export function OfflineNotice() {
  const { t } = useI18n();
  const online = useOnline();

  if (online) {
    return null;
  }

  return (
    <Alert
      type="warning"
      showIcon
      style={{ marginBottom: 16 }}
      message={t("sync.usersOffline")}
      description={t("sync.usersOfflineDescription")}
    />
  );
}
