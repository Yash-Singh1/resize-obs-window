import OBSWebSocket from "obs-websocket-js";
import { Action, ActionPanel, Form, LocalStorage, Toast, showToast, useNavigation } from "@raycast/api";
import { connect } from "./utils/connect";

const obs = new OBSWebSocket();

export default function Command() {
  const navigation = useNavigation();

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Setup Extension"
            onSubmit={async (values) => {
              const data = {
                password: String(values.password),
                ip: String(values.ip),
                port: String(values.port),
              };
              await LocalStorage.setItem("server-password", data.password);
              await LocalStorage.setItem("server-ip", data.ip);
              await LocalStorage.setItem("server-port", data.port);
              showToast({
                title: "Testing Websocket Connection",
                style: Toast.Style.Animated,
              });
              if (await connect(obs, data)) {
                navigation.pop();
              }
            }}
          />
        </ActionPanel>
      }
    >
      <Form.Description text="1. Open up OBS Studio (Version 28 or above)" />
      <Form.Description text="2. Select Tools > WebSocket Server Settings" />
      <Form.Description text="3. Enable the checkmark next to Enable WebSocket Server" />
      <Form.Description text="3. Click on Show Connect Info and enter the information in this form" />
      <Form.PasswordField
        id="password"
        title="OBS Websocket Password"
        info="Password to OBS Websocket (empty if authentication is disabled)"
      />
      <Form.TextField
        id="ip"
        defaultValue="localhost"
        title="Server IP Address"
        info="Leave set to localhost if you are only testing on your computer"
      />
      <Form.TextField
        id="port"
        defaultValue="4455"
        title="Server Port"
        info="Default 4455 unless you changed it in OBS Studio"
      />
    </Form>
  );
}
