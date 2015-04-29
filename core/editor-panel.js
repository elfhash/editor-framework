var Ipc = require('ipc');
var BrowserWindow = require('browser-window');

/**
 * Redirect panel messages to its registered windows.
 */
var Panel = {};
var _panel2windows = {};
var _panel2argv = {};

Panel.templateUrl = 'editor://static/window.html';

_dock = function ( panelID, win ) {
    // Editor.info('%s dock to %s', panelID, win.name ); // DEBUG

    var editorWin = _panel2windows[panelID];

    // if we found same panel dock in different place
    if ( editorWin && editorWin !== win ) {
        // TODO: should we report error ????
    }

    _panel2windows[panelID] = win;
};

_undock = function ( panelID ) {
    var editorWin = _panel2windows[panelID];
    // Editor.info('%s undock from %s', panelID, editorWin.name ); // DEBUG

    if ( editorWin ) {
        editorWin.sendToPage( 'panel:undock', panelID );
        delete _panel2windows[panelID];
        return editorWin;
    }
    return null;
};

//
Panel.open = function ( panelID, openNew, argv ) {
    var panelInfo = Editor.Package.panelInfo(panelID);
    if ( !panelInfo ) {
        Editor.error('Failed to open panel %s, panel info not found.', panelID);
        return;
    }

    _panel2argv[panelID] = argv;

    var editorWin = Panel.findWindow(panelID);
    if ( editorWin ) {
        if ( openNew ) {
            Editor.error('Can not open panel %s in a new window, it already exists.', panelID);
            return;
        }

        // if we found the window, send panel:open to it
        Editor.sendToPanel( panelID, 'panel:open', argv );
        editorWin.show();
        editorWin.focus();
        return;
    }

    //
    var windowName = 'editor-window-' + new Date().getTime();
    var options = {
        'use-content-size': true,
        'width': parseInt(panelInfo.width),
        'height': parseInt(panelInfo.height),
        'min-width': parseInt(panelInfo['min-width']),
        'min-height': parseInt(panelInfo['min-height']),
        'max-width': parseInt(panelInfo['max-width']),
        'max-height': parseInt(panelInfo['max-height']),
    };

    // load layout-settings, and find windows by name
    var layoutProfile = Editor.loadProfile('layout.' + panelID, 'local' );
    if ( layoutProfile ) {
        if ( !openNew && layoutProfile.window ) {
            windowName = layoutProfile.window;
        }

        // find window by name
        editorWin = Editor.Window.find(windowName);
        if ( editorWin ) {
            // TODO: use the panelInfo.position to dock it to the exists window
            _dock( panelID, editorWin );
            return;
        }

        options.x = parseInt(layoutProfile.x);
        options.y = parseInt(layoutProfile.y);
        options.width = parseInt(layoutProfile.width);
        options.height = parseInt(layoutProfile.height);
    }

    // create new window
    // DISABLE: currently, I don't want to support page
    // if ( panelInfo.page ) {
    //     url = panelInfo.page;
    // }

    var winType = panelInfo.type || 'dockable';
    switch ( panelInfo.type ) {
    case 'dockable':
        options.resizable = true;
        options['always-on-top'] = false;
        break;

    case 'float':
        options.resizable = true;
        options['always-on-top'] = true;
        break;

    case 'fixed-size':
        options.resizable = false;
        options['always-on-top'] = true;
        // NOTE: fixed-size window always use package.json settings
        options.width = parseInt(panelInfo.width);
        options.height = parseInt(panelInfo.height);
        break;

    case 'quick':
        options.resizable = true;
        options['always-on-top'] = true;
        options['close-when-blur'] = true;
        break;
    }

    if ( isNaN(options.width) ) {
        options.width = 800;
    }
    if ( isNaN(options.height) ) {
        options.height = 600;
    }

    //
    editorWin = new Editor.Window(windowName, options);
    _dock( panelID, editorWin );

    // BUG: https://github.com/atom/atom-shell/issues/1321
    editorWin.nativeWin.setContentSize( options.width, options.height );
    editorWin.nativeWin.setMenuBarVisibility(false);
    editorWin.load(Panel.templateUrl, {
        panelID: panelID
    });
    editorWin.focus();
};

Panel.close = function ( panelID ) {
    var editorWin = _undock(panelID);
    if ( editorWin ) {
        // check if we have other panels in the same window
        // if no panels left, we close the window
        var found = false;
        for ( var id in _panel2windows ) {
            if ( editorWin === _panel2windows[id] ) {
                found = true;
                break;
            }
        }

        // if not panel exists in this window, and it is not the main window, close it.
        if ( !found && !editorWin.isMainWindow ) {
            editorWin.close();
        }
    }
};

Panel.findWindow = function ( panelID ) {
    return _panel2windows[panelID];
};

Panel.findWindows = function (packageName) {
    var wins = [];

    for ( var p in _panel2windows ) {
        var pair = p.split('@');
        if ( pair.length !== 2 ) {
            continue;
        }

        var name = pair[1];
        if ( name === packageName ) {
            var editorWin = _panel2windows[p];
            if ( wins.indexOf (editorWin) === -1 )
                wins.push(editorWin);
        }
    }

    return wins;
};

Panel.findPanels = function ( packageName ) {
    var panels = [];
    for ( var p in _panel2windows ) {
        var pair = p.split('@');
        if ( pair.length !== 2 ) {
            continue;
        }

        var name = pair[1];
        if ( name === packageName ) {
            panels.push(pair[0]);
        }
    }

    return panels;
};

// TODO: we need to check if the windows panel only have that panel so that we can close the window
Panel.closeAll = function (packageName) {
    Editor.warn('TODO: @Johnny please implement Panel.closeAll');

    // var wins = Panel.findWindows(packageName);
    // for (var i = 0; i < wins.length; i++) {
    //     var win = wins[i];
    //     win.close();
    // }
    // delete _panel2windows[...];
};

// NOTE: this only invoked in fire-window on-closed event
Panel._onWindowClosed = function ( editorWin ) {
    for ( var id in _panel2windows ) {
        var win = _panel2windows[id];
        if ( win === editorWin ) {
            delete _panel2windows[id];
        }
    }
};

// ========================================
// Ipc
// ========================================

Ipc.on('panel:query-info', function ( reply, panelID ) {
    if ( !panelID ) {
        Editor.error( 'Empty panelID' );
        reply();
        return;
    }

    // get panelInfo
    var panelInfo = Editor.Package.panelInfo(panelID);
    if ( panelInfo ) {
        // load profiles
        for ( var type in panelInfo.profiles ) {
            var profile = panelInfo.profiles[type];
            profile = Editor.loadProfile( panelID, type, profile );
            panelInfo.profiles[type] = profile;
        }
    }

    //
    reply(panelInfo);
});

Ipc.on('panel:ready', function ( panelID ) {
    var argv = _panel2argv[panelID];
    Editor.sendToPanel( panelID, 'panel:open', argv );
});

Ipc.on('panel:open', function ( panelID, argv ) {
    Panel.open( panelID, false, argv );
});

Ipc.on('panel:new', function ( panelID, argv ) {
    Panel.open( panelID, true, argv );
});

Ipc.on('panel:dock', function ( event, panelID ) {
    var browserWin = BrowserWindow.fromWebContents( event.sender );
    var editorWin = Editor.Window.find(browserWin);
    _dock( panelID, editorWin );
});

Ipc.on('panel:close', function ( panelID ) {
    Panel.close( panelID );
});

//
Ipc.on('panel:save-profile', function ( panelID, type, panelProfile ) {
    var profile = Editor.loadProfile( panelID, type );
    if ( profile ) {
        profile.clear();
        Editor.JS.mixin(profile, panelProfile);
        profile.save();
    }
});

module.exports = Panel;