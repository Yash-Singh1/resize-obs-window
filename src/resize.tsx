import { LocalStorage, Toast, closeMainWindow, getFrontmostApplication, showToast } from "@raycast/api";
import { runAppleScript } from "run-applescript";
import OBSWebSocket from "obs-websocket-js";
import { connect } from "./utils/connect";

const obs = new OBSWebSocket();

interface SceneItemTransform {
  alignment: number;
  boundsAlignment: number;
  boundsHeight: number;
  boundsType: string;
  boundsWidth: number;
  cropBottom: number;
  cropLeft: number;
  cropRight: number;
  cropTop: number;
  height: number;
  positionX: number;
  positionY: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  sourceHeight: number;
  sourceWidth: number;
  width: number;
}

interface SceneItem {
  inputKind: string;
  isGroup: boolean | null;
  sceneItemBlendMode: string;
  sceneItemEnabled: boolean;
  sceneItemId: number;
  sceneItemIndex: number;
  sceneItemLocked: boolean;
  sceneItemTransform: SceneItemTransform;
  sourceName: string;
  sourceType: string;
}

export default async function Command() {
  const ip: string = (await LocalStorage.getItem("server-ip")) || "localhost";
  const port: string = (await LocalStorage.getItem("server-port")) || "4455";
  const password: string = (await LocalStorage.getItem("server-password")) || "";
  const paddingX: number = Number(await LocalStorage.getItem("paddingX")) || 0;
  const paddingY: number = Number(await LocalStorage.getItem("paddingY")) || 0;

  console.debug("Padding", paddingX, paddingY);

  if (!(await connect(obs, { ip, port, password }))) {
    return;
  }

  const { currentProgramSceneName } = await obs.call("GetSceneList");
  const { sceneItems } = (await obs.call("GetSceneItemList", { sceneName: currentProgramSceneName })) as unknown as {
    sceneItems: SceneItem[];
  };

  // We have tons of rectangle geometry here

  // 1. Get the scene items we are targeting

  const screen = sceneItems.find((item) => {
    return (item.inputKind === "screen_capture" || item.sourceName.includes("#screen#")) && item.sceneItemEnabled;
  });

  if (!screen) {
    await showToast(Toast.Style.Failure, "No screen share found");
    return;
  }

  const cams = sceneItems.filter((item) => {
    return (item.inputKind === "av_capture_input_v2" || item.sourceName.includes("#cam#")) && item.sceneItemEnabled;
  });

  // There are several different rectangles available to us, we pick the horizontal one

  const screenDims = {
    x: screen.sceneItemTransform.positionX,
    y: screen.sceneItemTransform.positionY,
    x2: screen.sceneItemTransform.positionX + screen.sceneItemTransform.width,
    y2: screen.sceneItemTransform.positionY + screen.sceneItemTransform.height,
  };

  console.debug("OBS Screen Dims", screenDims);

  /**
   * We need three config props for this
   * 1. Padding
   * 2. Scale x or y or both
   * 3. Prefer left or right (factor at which)
   */
  for (const cam of cams) {
    if (
      cam.sceneItemTransform.positionX + cam.sceneItemTransform.width < screenDims.x ||
      cam.sceneItemTransform.positionX > screenDims.x2
    ) {
      continue;
    }
    if (
      cam.sceneItemTransform.positionY + cam.sceneItemTransform.height < screenDims.y ||
      cam.sceneItemTransform.positionY > screenDims.y2
    ) {
      continue;
    }
    // Merge cam and screen on x
    const mxX = Math.max(cam.sceneItemTransform.positionX, screenDims.x);
    const mnX = Math.min(cam.sceneItemTransform.positionX + cam.sceneItemTransform.width, screenDims.x2);
    if (mxX - screenDims.x < screenDims.x2 - mnX) {
      screenDims.x = mxX;
    } else {
      screenDims.x2 = Math.min(cam.sceneItemTransform.positionX, screenDims.x2);
    }
  }

  if (screenDims.x !== screen.sceneItemTransform.positionX) {
    screenDims.x += paddingX;
  }

  if (screenDims.x2 !== screen.sceneItemTransform.positionX + screen.sceneItemTransform.width) {
    screenDims.x2 -= paddingX;
  }

  if (screenDims.y !== screen.sceneItemTransform.positionY) {
    screenDims.y += paddingY;
  }

  if (screenDims.y2 !== screen.sceneItemTransform.positionY + screen.sceneItemTransform.height) {
    screenDims.y2 -= paddingY;
  }

  console.debug("New OBS Screen Dims", screenDims);

  const frontmostApp = await getFrontmostApplication();

  try {
    await runAppleScript(`
tell application "Finder"
    set screenResolution to bounds of window of desktop
end tell

tell application "System Events" to tell process "${frontmostApp.name}"
    -- default debugging fullscreen
    -- set position of window 1 to {0, 0}
    -- set size of window 1 to {item 3 of screenResolution, item 4 of screenResolution}
    set m_pos to position of window 1
    set m_sz to size of window 1
    set position of window 1 to {${
      ((screenDims.x - screen.sceneItemTransform.positionX) / 2) * screen.sceneItemTransform.scaleX
    } + (item 1 of m_pos), ${
      ((screenDims.y - screen.sceneItemTransform.positionY) / 2) * screen.sceneItemTransform.scaleY
    } + (item 2 of m_pos)}
    set size of window 1 to {${((screenDims.x2 - screenDims.x) / 2) * screen.sceneItemTransform.scaleX} - (item 1 of m_pos), ${
      ((screenDims.y2 - screenDims.y) / 2) * screen.sceneItemTransform.scaleY
    } - (item 2 of m_pos)}
end tell
`);
  } catch (e) {
    if ((e as Error).toString().includes("is not allowed assistive access")) {
      await showToast(Toast.Style.Failure, "Please enable assistive access for Raycast in System Preferences");
      throw new Error("Assistive access not enabled");
    }
    console.error("Error failed", e);
  }

  await closeMainWindow();
}
