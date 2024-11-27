import { Action, ActionPanel, Form, LocalStorage, Toast, showToast, useNavigation } from "@raycast/api";

export default function Command() {
  const navigation = useNavigation();

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Save Configuration"
            onSubmit={async (values) => {
              await LocalStorage.setItem("paddingX", values.paddingX);
              await LocalStorage.setItem("paddingY", values.paddingY);
              showToast({
                title: "Configuration Saved",
                style: Toast.Style.Success,
              });
              navigation.pop();
            }}
          />
        </ActionPanel>
      }
    >
      <Form.Description text="Padding sizes are relative to the size of your OBS Canvas" />
      <Form.TextField
        id="paddingX"
        defaultValue="0"
        title="Horizontal Padding"
        info="The offset on the horizontal axis on either side (pixels)"
      />
      <Form.TextField
        id="paddingY"
        defaultValue="0"
        title="Vertical Padding (WIP)"
        info="The offset on the vertical axis on either side (pixels)"
      />
    </Form>
  );
}
