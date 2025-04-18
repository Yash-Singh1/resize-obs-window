use framework "Foundation"
use framework "AppKit"
use framework "CoreGraphics"
use scripting additions

on convertCFArrayToList(theCFArray)
	-- Use NSArray to bridge the CoreGraphics CFArray
	set theNSArray to current application's NSArray's arrayWithArray:theCFArray
	
	-- Convert to a standard AppleScript list
	set theList to {}
	repeat with anItem in theNSArray
		set end of theList to anItem
	end repeat
	
	return theList
end convertCFArrayToList

-- Helper function to get the bounds of the frontmost application window
on getWindowBoundsOfFrontmostApp()
	-- Get the frontmost application
	set workspace to current application's NSWorkspace's sharedWorkspace()
	set frontApp to workspace's frontmostApplication()
	set frontAppPID to frontApp's processIdentifier() -- Get the PID of the app
	
	-- Query the system for window information using Core Graphics
	set options to (current application's kCGWindowListOptionOnScreenOnly) & (current application's kCGWindowListExcludeDesktopElements) as list
	set windowList to current application's convertCFArrayToList(CGWindowListCopyWindowInfo(current application's kCGWindowListExcludeDesktopElements, -1))
	
	-- Loop through the window list to find the one matching the frontmost app
	repeat with windowInfo in windowList
		set ownerPID to (windowInfo's valueForKey:"kCGWindowOwnerPID") as integer
		if ownerPID = frontAppPID then
			set bounds to (windowInfo's valueForKey:"kCGWindowBounds")
			return bounds -- Return the first matching window's bounds
		end if
	end repeat
	return "No windows found for frontmost application"
end getWindowBoundsOfFrontmostApp

-- Get the window bounds
set windowBounds to getWindowBoundsOfFrontmostApp()

-- Return the result
return windowBounds
