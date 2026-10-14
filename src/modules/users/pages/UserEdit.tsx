import { useGetIdentity, useNotification, useOne } from "@refinedev/core";
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Select,
  Space,
  Spin,
  Switch,
  Typography,
} from "antd";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useI18n } from "../../../i18n/useI18n";
import { OfflineNotice } from "../../../components/OfflineNotice";
import { useOnline } from "../../../data/sync/useSyncStatus";
import { ROLES, type AppRole, type Profile } from "../user.schema";
import { userService } from "../user.service";

interface RoleFormValues {
  role: AppRole;
  is_active: boolean;
}

export function UserEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useI18n();
  const online = useOnline();
  const { open } = useNotification();
  const [form] = Form.useForm<RoleFormValues>();
  const [passwordForm] = Form.useForm<{ password: string }>();
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const { data: identity } = useGetIdentity<{ id: string }>();
  const { query } = useOne<Profile>({
    resource: "profiles",
    id,
    queryOptions: { enabled: Boolean(id) },
  });
  const profile = query.data?.data;
  const isSelf = Boolean(id) && identity?.id === id;

  useEffect(() => {
    if (profile) {
      form.setFieldsValue({
        role: profile.role,
        is_active: profile.is_active,
      });
    }
  }, [profile, form]);

  const handleSave = async (values: RoleFormValues) => {
    if (!id) {
      return;
    }
    setSaving(true);
    try {
      await userService.updateRole(id, values.role);
      await userService.setActive(id, values.is_active);
      open?.({ type: "success", message: t("users.notifications.updated") });
      navigate("/users");
    } catch (error) {
      open?.({
        type: "error",
        message: t("users.notifications.updateError"),
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async ({ password }: { password: string }) => {
    if (!id) {
      return;
    }
    setResetting(true);
    try {
      await userService.resetPassword(id, password);
      passwordForm.resetFields();
      open?.({ type: "success", message: t("users.notifications.passwordUpdated") });
    } catch (error) {
      open?.({
        type: "error",
        message: t("users.notifications.passwordError"),
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setResetting(false);
    }
  };

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Space>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {t("users.editTitle")}
        </Typography.Title>
        <Button onClick={() => navigate("/users")}>{t("users.back")}</Button>
      </Space>

      {isSelf && (
        <Alert type="info" showIcon message={t("users.selfWarning")} />
      )}

      {!online && <OfflineNotice />}

      {query.isLoading ? (
        <Spin />
      ) : (
        <>
          <Card title={profile?.email ?? t("users.userFallback")}>
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSave}
              style={{ maxWidth: 420 }}
            >
              <Form.Item name="full_name" label={t("users.form.fullName")}>
                <Input disabled value={profile?.full_name ?? undefined} />
              </Form.Item>
              <Form.Item
                name="role"
                label={t("users.form.role")}
                rules={[
                  { required: true, message: t("users.validation.roleRequired") },
                ]}
              >
                <Select
                  options={ROLES.map((role) => ({
                    value: role.value,
                    label: t(role.labelKey),
                  }))}
                  disabled={isSelf}
                />
              </Form.Item>
              <Form.Item
                name="is_active"
                label={t("users.form.active")}
                valuePropName="checked"
              >
                <Switch disabled={isSelf} />
              </Form.Item>
              <Button
                type="primary"
                loading={saving}
                disabled={isSelf || saving || !online}
                onClick={() => form.submit()}
              >
                {t("common.save")}
              </Button>
            </Form>
          </Card>

          <Card title={t("users.resetPassword")}>
            <Form
              form={passwordForm}
              layout="vertical"
              onFinish={handleResetPassword}
              style={{ maxWidth: 420 }}
            >
              <Form.Item
                name="password"
                label={t("users.newPassword")}
                rules={[
                  {
                    required: true,
                    message: t("users.validation.passwordRequired"),
                  },
                  { min: 6, message: t("users.validation.passwordMin") },
                ]}
              >
                <Input.Password autoComplete="new-password" />
              </Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={resetting}
                disabled={!online || resetting}
              >
                {t("users.setPassword")}
              </Button>
            </Form>
          </Card>
        </>
      )}
    </Space>
  );
}
