import { PlusOutlined } from "@ant-design/icons";
import { useCreate } from "@refinedev/core";
import {
  Button,
  Divider,
  Form,
  Modal,
  Select,
  type SelectProps,
} from "antd";
import { useState, type ReactNode } from "react";

export interface QuickCreateSelectProps<TValues extends object>
  extends Omit<SelectProps, "onSearch"> {
  /** Refine resource to create the record in (e.g. "categories"). */
  resource: string;
  /** Name of the parent form field to set with the new record's id. */
  fieldName: string;
  /** Whether the current user may create records in the resource. */
  canCreate: boolean;
  /** Modal title, e.g. "Create category". */
  modalTitle: string;
  /** Dropdown footer button label, e.g. "Create new category". */
  createLabel: string;
  /** Shared form fields rendered inside the modal form. */
  fields: ReactNode;
  /** Default values applied when the modal opens. */
  defaults?: Partial<TValues>;
  /** Derive initial values from the text typed into the select. */
  prefill?: (search: string) => Partial<TValues>;
  /** Build the create payload from the modal form values. */
  toValues: (values: TValues) => Record<string, unknown>;
  /** Called after a successful create (e.g. to refetch options). */
  onRefetch?: () => void;
  /** Optional success notification message. */
  createdMessage?: string;
  onSearch?: SelectProps["onSearch"];
}

interface QuickCreateModalProps<TValues extends object> {
  resource: string;
  modalTitle: string;
  fields: ReactNode;
  initialValues: Partial<TValues>;
  toValues: (values: TValues) => Record<string, unknown>;
  createdMessage?: string;
  onCancel: () => void;
  onCreated: (id: string | number) => void;
}

/**
 * Mounted only while open, so the form instance and its `Form` element are
 * created in the same commit (avoids antd's "not connected" warning).
 */
function QuickCreateModal<TValues extends object>({
  resource,
  modalTitle,
  fields,
  initialValues,
  toValues,
  createdMessage,
  onCancel,
  onCreated,
}: QuickCreateModalProps<TValues>) {
  const [form] = Form.useForm<TValues>();
  const { mutateAsync, mutation } = useCreate();

  const handleFinish = async (values: TValues) => {
    try {
      const response = await mutateAsync({
        resource,
        values: toValues(values),
        invalidates: ["list"],
        successNotification: createdMessage
          ? { type: "success", message: createdMessage }
          : undefined,
      });
      const record = response?.data;
      if (record?.id !== undefined && record?.id !== null) {
        onCreated(record.id);
      }
      onCancel();
    } catch {
      // Errors are surfaced by Refine's default error notification.
    }
  };

  return (
    <Modal
      title={modalTitle}
      open
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={mutation.isPending}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={initialValues}
        onFinish={handleFinish}
      >
        {fields}
      </Form>
    </Modal>
  );
}

/**
 * A many2one Select that lets the user create the related record inline,
 * from a button in the dropdown footer, without leaving the current form.
 */
export function QuickCreateSelect<TValues extends object>({
  resource,
  fieldName,
  canCreate,
  modalTitle,
  createLabel,
  fields,
  defaults,
  prefill,
  toValues,
  onRefetch,
  createdMessage,
  onSearch,
  ...selectProps
}: QuickCreateSelectProps<TValues>) {
  const parentForm = Form.useFormInstance();
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");

  const initialValues = {
    ...defaults,
    ...(prefill ? prefill(search) : {}),
  } as Partial<TValues>;

  return (
    <>
      <Select
        {...selectProps}
        onSearch={(value) => {
          setSearch(value);
          onSearch?.(value);
        }}
        popupRender={(menu) =>
          canCreate ? (
            <>
              {menu}
              <Divider style={{ margin: "4px 0" }} />
              <Button
                type="text"
                icon={<PlusOutlined />}
                style={{ width: "100%", textAlign: "left" }}
                onClick={() => setModalOpen(true)}
              >
                {createLabel}
              </Button>
            </>
          ) : (
            menu
          )
        }
      />
      {modalOpen && (
        <QuickCreateModal<TValues>
          resource={resource}
          modalTitle={modalTitle}
          fields={fields}
          initialValues={initialValues}
          toValues={toValues}
          createdMessage={createdMessage}
          onCancel={() => setModalOpen(false)}
          onCreated={(id) => {
            parentForm.setFieldValue(fieldName, id);
            onRefetch?.();
          }}
        />
      )}
    </>
  );
}
