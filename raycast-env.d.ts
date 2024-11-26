/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `setup` command */
  export type Setup = ExtensionPreferences & {}
  /** Preferences accessible in the `resize` command */
  export type Resize = ExtensionPreferences & {}
  /** Preferences accessible in the `configure` command */
  export type Configure = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `setup` command */
  export type Setup = {}
  /** Arguments passed to the `resize` command */
  export type Resize = {}
  /** Arguments passed to the `configure` command */
  export type Configure = {}
}

