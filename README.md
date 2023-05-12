# OBS Resize

Resize and move your windows to prevent your OBS Webcam from blocking it.

## Permissions

- This Raycast plugin requires that Raycast has Accessibility permissions in System Settings, enable `Privacy & Security > Accessibility > +/Raycast`

## Usage

To use the Resize OBS Window Raycast Plugin:

### 1. Setup WebSocket Connection

Make sure you enable the WebSocket server option in OBS Studio. To figure out how to do this, follow the instructions in the form for the `Setup OBS Websocket Server` command.

### 2. Use Resize OBS Window

Whenever you have OBS Studio open in the background, you can run the `Resize OBS Window` command on any visible window, to resize it so that your webcam doesn't block the window's view for your users. OBS Studio recognizes cameras with any video capure devices or another source that includes `#cam#` in its name.

## Compatability

As Raycast only supports Mac, this plugin is built on top of Mac's AppleScript to allow the resizing and manipulation of windows.
