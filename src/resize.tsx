import { LocalStorage, Toast, closeMainWindow, getFrontmostApplication, showToast } from "@raycast/api";
import { runAppleScript } from "run-applescript";
import OBSWebSocket from "obs-websocket-js";
import { connect } from "./utils/connect";
import { execSync } from "child_process";

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
   * 2. Scale x or y or both; TODO: support y scaling low priority
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
      // This is the case where the camera is on the left hand side
      screenDims.x = mxX;
    } else {
      // This is the case where the camera is on the right hand side
      screenDims.x2 = Math.min(cam.sceneItemTransform.positionX, screenDims.x2);
    }
  }

  // Add the padding if needed
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

  console.debug(
    "New OBS Screen Dims",
    screenDims,
    "scale x",
    screen.sceneItemTransform.scaleX,
    "scale y",
    screen.sceneItemTransform.scaleY
  );

  const frontmostApp = await getFrontmostApplication();

  // Note: the sourceWidth and sourceHeight properties don't seem to reflect the screen's resolution
  // We can't use the Window Management API since it requires Raycast Pro
  // const windows = await WindowManagement.getWindowsOnActiveDesktop();
  // TODO: figure out multi-monitor setups

  // let resolutions: { width: number; height: number; type: number }[] = [];
  // try {
  //   // Execute the system_profiler command and parse the output
  //   // https://stackoverflow.com/a/19594339/13514657
  //   const shellOutput = execSync(
  //     `/usr/sbin/system_profiler SPDisplaysDataType | awk '/Resolution:/{ printf "%s %s %s\\n", $2, $4, ($5 == "Retina" ? 2 : 1) }'`,
  //     { shell: process.env.SHELL || "bash" }
  //   ).toString();

  //   // Parse resolutions from the shell output
  //   resolutions = shellOutput
  //     .trim()
  //     .split("\n")
  //     .map((line: string) => {
  //       const [width, height, type] = line.split(" ").map(Number);
  //       return { width, height, type };
  //     });

  //   // Check if resolutions were retrieved
  //   if (resolutions.length === 0) {
  //     throw new Error("No resolutions found. Please check your display settings.");
  //   }

  //   console.debug(resolutions);
  // } catch (error) {
  //   if (error instanceof Error) console.error("Error:", error.message);
  //   else console.error("Error:", error);
  // }

  console.log(
    screen.sceneItemTransform.scaleX * screen.sceneItemTransform.sourceWidth,
    screen.sceneItemTransform.scaleY * screen.sceneItemTransform.sourceHeight
  );

  try {
    await runAppleScript(`
-- use framework "Foundation"
use framework "AppKit"
use scripting additions

-- https://developer.apple.com/documentation/appkit/nsscreen, https://forum.latenightsw.com/t/get-sizes-of-monitor-s-via-applescript/1351/4
-- set screenList to (current application's NSScreen's screens()'s valueForKey:"frame") as list
set screen to (item 2 of (current application's NSScreen's screens()'s valueForKey:"frame") as list)

-- Groups all monitors into one rectangle
-- tell application "Finder"
--     set screenResolution to bounds of window of desktop
-- end tell

-- adjust scaling using frame info
-- scalex is respect to xfake, we have xreal and wan to apply a scale to that scalexreal
-- scalex * xfake = target
-- scalexreal * xreal = target
-- scalexreal = scalex * xfake / xreal
set scalexreal to ${screen.sceneItemTransform.scaleX} * ${
      screen.sceneItemTransform.sourceWidth
    } / (item 1 of item 2 of screen)
set scaleyreal to ${screen.sceneItemTransform.scaleY} * ${
      screen.sceneItemTransform.sourceHeight
    } / (item 2 of item 2 of screen)

tell application "System Events" to tell process "${frontmostApp.name}"
    -- default debugging fullscreen
    -- set position of window 1 to {0, 0}
    -- set size of window 1 to {item 3 of screenResolution, item 4 of screenResolution}
    set m_pos to position of window 1
    set m_sz to size of window 1
    display dialog item 1 of m_pos
    set position of window 1 to {(${
      screenDims.x - screen.sceneItemTransform.positionX
    }) / scalexreal + (item 1 of m_pos), (${
      screenDims.y - screen.sceneItemTransform.positionY
    }) / scaleyreal + (item 2 of m_pos)}
    set size of window 1 to {(${
      screenDims.x2 - screenDims.x
    }) / scalexreal - (item 1 of m_pos), item 2 of m_sz} -- we leave y as is in case it's offscreen
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
