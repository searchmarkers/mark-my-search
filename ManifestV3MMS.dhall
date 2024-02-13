let Prelude = https://prelude.dhall-lang.org/package.dhall
let Manifest = ./ManifestV3.dhall

let CommandEntry = Manifest.CommandEntry

let processionText = \(next : Bool) -> if next then "next" else "previous"

let firefox = True --env:

let buildSelectCommand
		: Bool -> Natural -> CommandEntry
		=
		let Hotkey = Manifest.Hotkey
		let build = Manifest.buildCommandEntry
		in \(next : Bool) -> \(i : Natural) ->
			let index = Natural/show i
			let index1 = Natural/show (i + 1)
			let hotkeys =
				{ default = if next then "Alt+Shift+${index1}" else "Ctrl+Shift+${index1}"
				, windows = if next then "Alt+${index1}" else "Alt+Shift+${index1}"
				}
			in build "select-term-${index}"
				{ description =
					"Jump to ${processionText next} (${index1}th keyword)"
				, suggested_key = if firefox
					then Some
						{ default = Some hotkeys.default
						, mac = None Hotkey
						, linux = None Hotkey
						, windows = Some hotkeys.windows
						, chromeos = None Hotkey
						, android = None Hotkey
						, ios = None Hotkey
						}
					else None Manifest.PlatformHotkeys
				}

let buildSelectCommands
		: Bool -> List CommandEntry
		= \(next: Bool) ->
			Prelude.List.generate
				10 CommandEntry
				(\(i : Natural) -> buildSelectCommand next i)

in  { buildSelectCommands = buildSelectCommands
	}
