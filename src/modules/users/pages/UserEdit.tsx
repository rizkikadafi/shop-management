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
import { ROLES, type AppRole, type Profile } from "../user.schema";
import { userService } from "../user.service";

interface RoleFormValues {
  role: AppRole;
  is_active: boolean;
}

export function UserEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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
      open?.({ type: "success", message: "User updated." });
      navigate("/users");
    } catch (error) {
      open?.({
        type: "error",
        message: "Could not update user.",
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
      open?.({ type: "success", message: "Password updated." });
    } catch (error) {
      open?.({
        type: "error",
        message: "Could not reset password.",
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
          Edit user
        </Typography.Title>
        <Button onClick={() => navigate("/users")}>Back</Button>
      </Space>

      {isSelf && (
        <Alert
          type="info"
          showIcon
          message="You cannot change your own role or active status."
        />
      )}

      {query.isLoading ? (
        <Spin />
      ) : (
        <>
          <Card title={profile?.email ?? "User"}>
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSave}
              style={{ maxWidth: 420 }}
            >
              <Form.Item name="full_name" label="Name">
                <Input disabled value={profile?.full_name ?? undefined} />
              </Form.Item>
              <Form.Item
                name="role"
                label="Role"
                rules={[{ required: true, message: "Role is required." }]}
              >
                <Select options={ROLES} disabled={isSelf} />
              </Form.Item>
              <Form.Item name="is_active" label="Active" valuePropName="checked">
                <Switch disabled={isSelf} />
              </Form.Item>
              <Button
                type="primary"
                loading={saving}
                disabled={isSelf || saving}
                onClick={() => form.submit()}
              >
                Save
              </Button>
            </Form>
          </Card>

          <Card title="Reset password">
            <Form
              form={passwordForm}
              layout="vertical"
              onFinish={handleResetPassword}
              style={{ maxWidth: 420 }}
            >
              <Form.Item
                name="password"
                label="New password"
                rules={[
                  { required: true, message: "Password is required." },
                  { min: 6, message: "At least 6 characters." },
                ]}
              >
                <Input.Password autoComplete="new-password" />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={resetting}>
                Set password
              </Button>
            </Form>
          </Card>
        </>
      )}
    </Space>
  );
}
