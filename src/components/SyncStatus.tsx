import { useState } from "react";
import { Badge, Button, Popover, Space, Tag, Typography } from "antd";
import { CloudSyncOutlined, ReloadOutlined } from "@ant-design/icons";

import { useI18n } from "../i18n/useI18n";
import { syncService } from "../data/sync/sync.service";
import { useSyncStatus } from "../data/sync/useSyncStatus";

/**
 * Connectivity and synchronization indicator.
 *
 * Shows the browser's online state plus how many local changes are waiting to
 * sync or have failed, with a manual retry action.
 */
export function SyncStatus({ compact = false }: { compact?: boolean }) {
  const { t, formatDateTime } = useI18n();
  const { online, syncing, hydrating, pending, failed, lastSyncedAt, lastError } =
    useSyncStatus();
  const [retrying, setRetrying] = useState(false);

  const color = !online
    ? "orange"
    : failed > 0
      ? "red"
      : pending > 0
        ? "blue"
        : "green";

  const label = !online
    ? t("sync.offline")
    : hydrating || syncing
      ? t("sync.syncing")
      : failed > 0
        ? t("sync.failedCount", { count: failed })
        : pending > 0
          ? t("sync.pendingCount", { count: pending })
          : t("sync.synced");

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await syncService.retryFailed();
    } finally {
      setRetrying(false);
    }
  };

  const details = (
    <Space direction="vertical" size={4} style={{ maxWidth: 260 }}>
      <Typography.Text>
        {online ? t("sync.online") : t("sync.offline")}
      </Typography.Text>
      {!online && (
        <Typography.Text type="secondary">
          {t("sync.offlineHint")}
        </Typography.Text>
      )}
      {pending > 0 && (
        <Typography.Text type="secondary">
          {t("sync.pendingHint", { count: pending })}
        </Typography.Text>
      )}
      {failed > 0 && (
        <Typography.Text type="danger">
          {t("sync.failedHint", { count: failed })}
        </Typography.Text>
      )}
      {lastError && (
        <Typography.Text type="danger" style={{ wordBreak: "break-word" }}>
          {lastError}
        </Typography.Text>
      )}
      {lastSyncedAt && (
        <Typography.Text type="secondary">
          {t("sync.lastSynced", { time: formatDateTime(lastSyncedAt) })}
        </Typography.Text>
      )}
      {(pending > 0 || failed > 0) && online && (
        <Button
          size="small"
          icon={<ReloadOutlined />}
          loading={retrying}
          onClick={() => void handleRetry()}
        >
          {t("sync.retry")}
        </Button>
      )}
    </Space>
  );

  return (
    <Popover content={details} trigger="click" placement="bottomRight">
      <Tag
        color={color}
        style={{ margin: 0, cursor: "pointer", userSelect: "none" }}
      >
        <Space size={4}>
          <CloudSyncOutlined spin={online && (syncing || hydrating)} />
          {!compact && label}
          {(pending > 0 || failed > 0) && (
            <Badge
              count={pending + failed}
              size="small"
              color={failed > 0 ? "red" : "blue"}
            />
          )}
        </Space>
      </Tag>
    </Popover>
  );
}
