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
  let paddingX: number = Number(await LocalStorage.getItem("paddingX")) || 0;
  let paddingY: number = Number(await LocalStorage.getItem("paddingY")) || 0;

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

  // screenDims is now a rectangle relative to the OBS canvas, we now need to make it relative to the source
  [screenDims.x, screenDims.x2] = [screenDims.x, screenDims.x2].map((xCoord) =>
    Math.ceil((xCoord - screen.sceneItemTransform.positionX) / screen.sceneItemTransform.scaleX)
  );
  [screenDims.y, screenDims.y2] = [screenDims.y, screenDims.y2].map((yCoord) =>
    Math.ceil((yCoord - screen.sceneItemTransform.positionY) / screen.sceneItemTransform.scaleY)
  );

  // Add the padding if needed
  paddingX /= screen.sceneItemTransform.scaleX;
  paddingY /= screen.sceneItemTransform.scaleY;
  if (screenDims.x !== 0) {
    screenDims.x += paddingX;
  }

  if (screenDims.x2 !== screen.sceneItemTransform.sourceWidth) {
    screenDims.x2 -= paddingX;
  }

  if (screenDims.y !== 0) {
    screenDims.y += paddingY;
  }

  if (screenDims.y2 !== screen.sceneItemTransform.sourceHeight) {
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
  // Something like: `/usr/sbin/system_profiler SPDisplaysDataType | awk '/Resolution:/{ printf "%s %s %s\\n", $2, $4, ($5 == "Retina" ? 2 : 1) }'` would give resolutions, we want pixels
  // Our best bet is to use AppKit's NSScreen class

  console.debug("OBS Source width", screen.sceneItemTransform.sourceWidth, screen.sceneItemTransform.sourceHeight);

  await closeMainWindow();

  try {
    // TODO: Change this to use applescript arguments instead
    await runAppleScript(`
-- use framework "Foundation"
use framework "AppKit"
use scripting additions

-- Get screen pos relative to desktop first
tell application "System Events" to tell process "${frontmostApp.name}"
    -- Note: m_pos is relative to the desktop's origin (all monitor's in one rectangle), while screenDims is relative to (0, 0)
    set m_pos to position of window 1
    set windowX to item 1 of m_pos
    set windowY to item 2 of m_pos
end tell

-- https://developer.apple.com/documentation/appkit/nsscreen, https://forum.latenightsw.com/t/get-sizes-of-monitor-s-via-applescript/1351/4
set screens to (current application's NSScreen's screens()'s valueForKey:"frame") as list
set matchedScreen to missing value
repeat with oScreen in screens
    set originX to item 1 of item 1 of oScreen
    set originY to item 2 of item 1 of oScreen
    set width to item 1 of item 2 of oScreen
    set height to item 2 of item 2 of oScreen
    if windowX ≥ originX and windowX ≤ (originX + width) and windowY ≥ originY and windowY ≤ (originY + height) then
        set matchedScreen to oScreen
        exit repeat
    end if
end repeat

-- https://stackoverflow.com/questions/4845507/the-equivalent-of-minx-y-in-applescript/4848097#4848097
on min(x, y)
    if x ≤ y then
        return x
    else
        return y
    end if
end min

-- scalex is respect to xfake, we have xreal and wan to apply a scale to that scalexreal
-- scalex * xfake = scalexreal * xreal
-- scalexreal = scalex * xfake / xreal
set scalexreal to ${screen.sceneItemTransform.sourceWidth} / (item 1 of item 2 of matchedScreen)
set scaleyreal to ${screen.sceneItemTransform.sourceHeight} / (item 2 of item 2 of matchedScreen)

tell application "System Events" to tell process "${frontmostApp.name}"
    set m_sz to size of window 1
    set position of window 1 to {(${screenDims.x}) / scalexreal + windowX, (${screenDims.y}) / scaleyreal + windowY}
    set calculatedWidth to ((${screenDims.x2 - screenDims.x}) / scalexreal)
    set size of window 1 to {my min(calculatedWidth - windowX + (item 1 of item 1 of matchedScreen), (item 1 of m_sz)), item 2 of m_sz} -- we leave height as is in case it's offscreen
end tell
`);
  } catch (e) {
    if ((e as Error).toString().includes("is not allowed assistive access")) {
      await showToast(Toast.Style.Failure, "Please enable assistive access for Raycast in System Preferences");
      throw new Error("Assistive access not enabled");
    }
    console.error("Error failed", e);
  }
}
