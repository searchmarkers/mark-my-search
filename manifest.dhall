let Prelude = https://prelude.dhall-lang.org/package.dhall
let Manifest = ./ManifestV3.dhall
let ManifestMMS = ./ManifestV3MMS.dhall

--== Profile ==--

let name = "Mark My Search"
let version = Manifest.buildVersion [2,0,0]
let description = "Highlight searched keywords. Find matches instantly."

--== Icons ==--

let icons = Manifest.buildIcons [ 16, 32, 48, 128 ]
let actionIcons = Manifest.buildIcons [ 16, 32 ]

--== Permissions ==--

let permissions =
        [ "tabs"
        , "scripting"
        , "storage"
        , "search"
        , "contextMenus"
        ]
let permittedURLs = [ "*://*/*" ]
let webAccessibleResources =
        [ "/icons/*.svg"
        , "/dist/paint.js"
        , "/dist/modules/*.mjs"
        ]

--== Keyboard Commands ==--

let standardCommands : List Manifest.CommandEntry =
        let Hotkey = Manifest.Hotkey
        let PlatformHotkeys = Manifest.PlatformHotkeys
        let build = Manifest.buildCommandEntry
        in
        [ build "open-popup"
            { description = "Open the popup"
            , suggested_key = None PlatformHotkeys
            }
        , build "open-options"
            { description = "Open the options page"
            , suggested_key = None PlatformHotkeys
            }
        , build "toggle-research-tab"
            { description = "Find in current tab"
            , suggested_key = Some
                { default = Some "Alt+M"
                , mac = None Hotkey
                , linux = None Hotkey
                , windows = None Hotkey
                , chromeos = None Hotkey
                , android = None Hotkey
                , ios = None Hotkey
                }
            }
        , build "toggle-research-global"
            { description = "Enable/disable automatic web search marking"
            , suggested_key = None PlatformHotkeys
            }
        , build "toggle-bar"
            { description = "Show/hide toolbar"
            , suggested_key = None PlatformHotkeys
            }
        --, build "toggle-highlights"
        --    { description = "Show/hide highlighting"
        --    , suggested_key = { default = "Alt+Shift+D" }
        --    }
        , build "toggle-select"
            { description = "Enable/disable sticky keyword jumping mode"
            , suggested_key = None PlatformHotkeys
            }
        , build "focus-term-append"
            { description = "Focus input for appending a keyword"
            , suggested_key = None PlatformHotkeys
            }
        , build "terms-replace"
            { description = "Replace keywords with detected search keywords"
            , suggested_key = None PlatformHotkeys
            }
        , build "step-global"
            { description = "Step to and select next highlight"
            , suggested_key = None PlatformHotkeys
            }
        , build "step-global-reverse"
            { description = "Step to and select previous highlight"
            , suggested_key = None PlatformHotkeys
            }
        --, build "advance-global"
        --    { description = "Jump to next highlight block"
        --    , suggested_key = { default = "Alt+Space" }
        --    }
        --, build "advance-global-reverse"
        --    { description = "Jump to previous highlight block"
        --    , suggested_key = { default = "Alt+Shift+Space" }
        --    }
        ]

let commands : List Manifest.CommandEntry
        = standardCommands
        # ManifestMMS.buildSelectCommands True
        # ManifestMMS.buildSelectCommands False

--== Result ==--

in  { manifest_version = 3
    , name = name
    , version = version
    , description = description
    , icons = icons
    , permissions = permissions
    , host_permissions = permittedURLs
    , background =
        { service_worker = "/dist/background.js"
        }
    , content_scripts = [
        { matches = permittedURLs
        , js =
            [ "/dist/include/utility.js"
            , "/dist/include/pattern-stem.js"
            , "/dist/include/pattern-diacritic.js"
            , "/dist/content.js"
            ]
        , run_at = "document_start"
        } ]
    , options_ui =
        { page = "/pages/options.html"
        , browser_style = False
        }
    , action =
        { default_icon = actionIcons
        , default_title = name
        , default_popup = "/pages/popup.html"
        }
    , web_accessible_resources = [
        { resources = webAccessibleResources
        , matches = permittedURLs
        } ]
    , commands = commands
    }
