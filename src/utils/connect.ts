import { Toast, showToast } from "@raycast/api";
import OBSWebSocket from "obs-websocket-js";

export async function connect(
  obs: OBSWebSocket,
  { password, ip, port }: { password: string; ip: string; port: string }
) {
  try {
    await obs.connect(`ws://${ip}:${port}`, password, { rpcVersion: 1 });
    showToast({
      title: "Successfully Connected to OBS Studio",
      style: Toast.Style.Success,
    });
    return true;
  } catch (error) {
    showToast({
      title: "Failed to Connect to OBS Studio",
      message: error instanceof Error ? error.message : undefined,
      style: Toast.Style.Failure,
    });
    return false;
  }
}
