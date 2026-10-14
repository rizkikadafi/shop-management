import { useEffect } from "react";
import { App, Button } from "antd";
import { useRegisterSW } from "virtual:pwa-register/react";

import { useI18n } from "../i18n/useI18n";

/**
 * Surfaces service-worker lifecycle events.
 *
 * Registers the service worker and shows a non-blocking prompt when a new
 * version is available, so in-progress work is never discarded by a silent
 * reload. Also reports when the app shell has been cached for offline use.
 */
export function ReloadPrompt() {
  const { t } = useI18n();
  const { notification } = App.useApp();
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true });

  useEffect(() => {
    if (!offlineReady) {
      return;
    }
    notification.success({
      message: t("pwa.offlineReady"),
      duration: 4,
    });
    setOfflineReady(false);
  }, [offlineReady, setOfflineReady, notification, t]);

  useEffect(() => {
    if (!needRefresh) {
      return;
    }
    const key = "pwa-update";
    notification.info({
      key,
      message: t("pwa.updateAvailable"),
      description: t("pwa.updateDescription"),
      duration: 0,
      btn: (
        <Button
          type="primary"
          size="small"
          onClick={() => {
            notification.destroy(key);
            setNeedRefresh(false);
            void updateServiceWorker(true);
          }}
        >
          {t("pwa.reload")}
        </Button>
      ),
    });
  }, [
    needRefresh,
    setNeedRefresh,
    updateServiceWorker,
    notification,
    t,
  ]);

  return null;
}
