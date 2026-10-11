import { Create } from "@refinedev/antd";
import { useNotification } from "@refinedev/core";
import { Form, Input, Select } from "antd";
import { useState } from "react";
import { useNavigate } from "react-router";
import { useI18n } from "../../../i18n/useI18n";
import { userService } from "../user.service";
import { ROLES, type CreateUserValues } from "../user.schema";

export function UserCreate() {
  const { t } = useI18n();
  const [form] = Form.useForm<CreateUserValues>();
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { open } = useNotification();

  const handleFinish = async (values: CreateUserValues) => {
    setSaving(true);
    try {
      await userService.create(values);
      open?.({ type: "success", message: t("users.notifications.created") });
      navigate("/users");
    } catch (error) {
      open?.({
        type: "error",
        message: t("users.notifications.createError"),
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Create
      title={t("users.create")}
      saveButtonProps={{
        onClick: () => form.submit(),
        loading: saving,
        disabled: saving,
      }}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        initialValues={{ role: "cashier" }}
      >
        <Form.Item
          name="email"
          label={t("users.form.email")}
          rules={[
            { required: true, message: t("users.validation.emailRequired") },
            { type: "email", message: t("users.validation.emailValid") },
          ]}
        >
          <Input autoComplete="off" />
        </Form.Item>

        <Form.Item name="full_name" label={t("users.form.fullName")}>
          <Input />
        </Form.Item>

        <Form.Item
          name="role"
          label={t("users.form.role")}
          rules={[{ required: true, message: t("users.validation.roleRequired") }]}
        >
          <Select
            options={ROLES.map((role) => ({
              value: role.value,
              label: t(role.labelKey),
            }))}
          />
        </Form.Item>

        <Form.Item
          name="password"
          label={t("users.form.password")}
          rules={[
            { required: true, message: t("users.validation.passwordRequired") },
            { min: 6, message: t("users.validation.passwordMin") },
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
      </Form>
    </Create>
  );
}
