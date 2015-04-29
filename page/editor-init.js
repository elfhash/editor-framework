(function () {

var Remote = require('remote');
var Ipc = require('ipc');
var Util = require('util');
var Path = require('fire-path');
var Url = require('fire-url');
var Async = require('async');

window.Editor = window.Editor || {};

// init argument list sending from core by url?queries
// format: '?foo=bar&hell=world'
// skip '?'
var queryString = decodeURIComponent(location.search.substr(1));
var queryList = queryString.split('&');
var queries = {};
for ( var i = 0; i < queryList.length; ++i ) {
    var pair = queryList[i].split('=');
    if ( pair.length === 2) {
        queries[pair[0]] = pair[1];
    }
}
Editor.argv = queries;

// init & cache remote
Editor.remote = Remote.getGlobal('Editor');
Editor.cwd = Editor.remote.url('editor://');
Editor.isDev = Editor.remote.isDev;

// url
Editor.url = function (url) {
    // NOTE: we cache editor:// protocol to get rid of ipc-sync function calls
    var urlInfo = Url.parse(url);
    if ( urlInfo.protocol === 'editor:' ) {
        if ( urlInfo.pathname ) {
            return Path.join( Editor.cwd, urlInfo.host, urlInfo.pathname );
        }
        return Path.join( Editor.cwd, urlInfo.host );
    }

    // try ipc-sync function
    return Editor.remote.url(url);
};

require( Editor.url('editor://share/platform'));
Editor.JS = require( Editor.url('editor://share/js-utils'));
require( Editor.url('editor://page/ipc-init'));

// ==========================
// console log API
// ==========================

Editor.log = function ( text ) {
    'use strict';

    if ( arguments.length <= 1 ) {
        text = '' + text;
    } else {
        text = Util.format.apply(Util, arguments);
    }
    console.log(text);
    Editor.sendToCore('console:log', text);
};

Editor.success = function ( text ) {
    'use strict';

    if ( arguments.length <= 1 ) {
        text = '' + text;
    } else {
        text = Util.format.apply(Util, arguments);
    }
    console.log('%c' + text, 'color: green');
    Editor.sendToCore('console:success', text);
};

Editor.failed = function ( text ) {
    'use strict';

    if ( arguments.length <= 1 ) {
        text = '' + text;
    } else {
        text = Util.format.apply(Util, arguments);
    }
    console.log('%c' + text, 'color: red');
    Editor.sendToCore('console:failed', text);
};

Editor.info = function ( text ) {
    'use strict';

    if ( arguments.length <= 1 ) {
        text = '' + text;
    } else {
        text = Util.format.apply(Util, arguments);
    }
    console.info(text);
    Editor.sendToCore('console:info', text);
};

Editor.warn = function ( text ) {
    'use strict';

    if ( arguments.length <= 1 ) {
        text = '' + text;
    } else {
        text = Util.format.apply(Util, arguments);
    }
    console.warn(text);
    Editor.sendToCore('console:warn', text);
};

Editor.error = function ( text ) {
    'use strict';

    if ( arguments.length <= 1 ) {
        text = '' + text;
    } else {
        text = Util.format.apply(Util, arguments);
    }
    console.error(text);
    Editor.sendToCore('console:error', text);
};

// ==========================
// Layout API
// ==========================

Editor.loadLayout = function ( anchorEL, cb ) {
    Editor.sendRequestToCore( 'window:query-layout', Editor.requireIpcEvent, function (layout) {
        if ( !layout ) {
            cb();
            return;
        }

        Editor.resetLayout( anchorEL, layout, cb );
    });
};

Editor.resetLayout = function ( anchorEL, layoutInfo, cb ) {
    var importList = EditorUI.createLayout( anchorEL, layoutInfo );
    Async.each( importList, function ( item, done ) {
        Editor.Panel.load (item.panelID, function ( err, viewEL ) {
            if ( err ) {
                done();
                return;
            }

            var dockAt = item.dockEL;
            dockAt.add(viewEL);
            if ( item.active ) {
                dockAt.select(viewEL);
            }
            done();
        });
    }, function ( err ) {
        // close error panels
        EditorUI.DockUtils.flushWithCollapse();
        Editor.saveLayout();
        if ( cb ) cb ();
    } );
};

Editor.saveLayout = function () {
    window.requestAnimationFrame ( function () {
        Editor.sendToCore('window:save-layout', Editor.Panel.dumpLayout(), Editor.requireIpcEvent);
    });
};

// ==========================
// Ipc events
// ==========================

Ipc.on( 'editor:reset-layout', function ( layoutInfo ) {
    var anchorEL = document.body;
    if ( EditorUI.DockUtils.root ) {
        anchorEL = Polymer.dom(EditorUI.DockUtils.root).parentNode;
    }

    Editor.resetLayout( anchorEL, layoutInfo );
});

Ipc.on( 'ipc-debugger:query', function ( reply ) {
    var ipcInfos = [];
    for ( var p in Ipc._events ) {
        ipcInfos.push({
            name: p,
            level: 'page',
        });
    }
    reply(ipcInfos);
});

// ==========================
// load modules
// ==========================

Editor.Panel = require( Editor.url('editor://page/editor-panel'));
Editor.Menu = require( Editor.url('editor://page/editor-menu'));
Editor.MainMenu = require( Editor.url('editor://page/main-menu'));

})();