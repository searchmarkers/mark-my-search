let Prelude = https://prelude.dhall-lang.org/package.dhall

let Entry = \(Key: Type) -> \(Value: Type) -> { mapKey: Key, mapValue: Value }

let buildVersion = \(numbers : List Natural) -> Prelude.List.fold
      Natural numbers Text
      (\(a: Natural) -> \(b: Text) -> Natural/show a ++ "." ++ b) ""

let Icon : Type = Text
let IconEntry : Type = Entry Text Icon

let buildIconEntry
        : Natural -> IconEntry
        = \(resolution : Natural) ->
            Prelude.Map.keyValue
              Text
              (Natural/show resolution)
              "/icons/dist/mms-${Natural/show resolution}.png"

let buildIcons
        : List Natural -> List IconEntry
        = \(resolutions : List Natural) ->
            Prelude.List.map Natural IconEntry buildIconEntry resolutions

let Hotkey : Type = Text

--let build_hotkey =
--        \(keys : List Text) -> Prelude.List.fold Text keys Text (\(a) -> \(b) -> b ++ a) ""

let Platform = < default | mac | linux | windows | chromeos | android | ios >
let PlatformHotkeys =
        { default : Optional Hotkey
        , mac : Optional Hotkey
        , linux : Optional Hotkey
        , windows : Optional Hotkey
        , chromeos : Optional Hotkey
        , android : Optional Hotkey
        , ios : Optional Hotkey
        }

let platformHotkeys : PlatformHotkeys =
        { default = None Hotkey
        , mac = None Hotkey
        , linux = None Hotkey
        , windows = None Hotkey
        , chromeos = None Hotkey
        , android = None Hotkey
        , ios = None Hotkey
        }

let Command : Type =
        { description : Text
        , suggested_key : Optional PlatformHotkeys
        }
let CommandEntry : Type = Entry Text Command

let buildCommandEntry =
        \(name : Text) -> \(command : Command) -> Prelude.Map.keyValue Command name command

in  { buildVersion = buildVersion
    , buildIcons = buildIcons
    , CommandEntry = CommandEntry
    , Hotkey = Hotkey
    , PlatformHotkeys = PlatformHotkeys
    , buildCommandEntry = buildCommandEntry
    }
