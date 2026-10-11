import { useEffect, useState } from "react";
import { Tag } from "antd";
import { useI18n } from "../i18n/useI18n";

/**
 * Connectivity indicator.
 *
 * Phase 1 only reports the browser's online/offline state. In Phase 3 this
 * component will also surface pending/failed sync counts from the queue.
 */
export function SyncStatus() {
  const { t } = useI18n();
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <Tag color={online ? "green" : "orange"} style={{ margin: 0 }}>
      {online ? t("sync.online") : t("sync.offline")}
    </Tag>
  );
}
