# OBS Resize

Resize your windows to prevent your OBS Webcam from blocking it.

## Permissions

- This Raycast plugin requires that Raycast has Accessibility permissions in System Settings, enable `Privacy & Security > Accessibility > +/Raycast`

## Usage

To use the Resize OBS Window Raycast Plugin:

### 1. Setup WebSocket Connection

Make sure you enable the WebSocket server option in OBS Studio. To figure out how to do this, follow the instructions in the form for the `Setup OBS Websocket Server` command.

### 2. Use Resize OBS Window

Whenever you have your OBS Websocket server running open in the background, you can run the `Resize OBS Window` command on any visible window, to resize it so that your webcam doesn't block the window's view for your viewers. This plugin recognizes cameras with any video capture devices or another source that includes `#cam#` in its name. Currently only the screen capture source is supported for the screen as this is extension built for local OBS usage.

If you would like to configure the padding between windows and your camera, you can use the `Configure Raycast Plugin` command.

As of now, you have to resize each window one by one, this may change in the future with a different command.

## Compatability

As Raycast only supports Mac, this plugin is built on top of Mac's AppleScript to allow the resizing and manipulation of windows.
