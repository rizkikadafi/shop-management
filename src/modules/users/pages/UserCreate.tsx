import { Create } from "@refinedev/antd";
import { useNotification } from "@refinedev/core";
import { Form, Input, Select } from "antd";
import { useState } from "react";
import { useNavigate } from "react-router";
import { userService } from "../user.service";
import { ROLES, type CreateUserValues } from "../user.schema";

export function UserCreate() {
  const [form] = Form.useForm<CreateUserValues>();
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { open } = useNotification();

  const handleFinish = async (values: CreateUserValues) => {
    setSaving(true);
    try {
      await userService.create(values);
      open?.({ type: "success", message: "User created." });
      navigate("/users");
    } catch (error) {
      open?.({
        type: "error",
        message: "Could not create user.",
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Create
      title="Create user"
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
          label="Email"
          rules={[
            { required: true, message: "Email is required." },
            { type: "email", message: "Enter a valid email." },
          ]}
        >
          <Input autoComplete="off" />
        </Form.Item>

        <Form.Item name="full_name" label="Full name">
          <Input />
        </Form.Item>

        <Form.Item
          name="role"
          label="Role"
          rules={[{ required: true, message: "Role is required." }]}
        >
          <Select options={ROLES} />
        </Form.Item>

        <Form.Item
          name="password"
          label="Initial password"
          rules={[
            { required: true, message: "Password is required." },
            { min: 6, message: "At least 6 characters." },
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
      </Form>
    </Create>
  );
}
