/*
 * vdiff.js - JavaScript-based visual differencing tool
 * http://codh.rois.ac.jp/software/vdiffjs/
 *
 * Copyright 2021 Center for Open Data in the Humanities, Research Organization of Information and Systems
 * Released under the MIT license
 *
 * Core contributor: Jun HOMMA (@2SC1815J)
 *
 * Licenses of open source libraries, see acknowledgements.md
 */
var VDiffExample = function(conf) {
    var dataLocalCompareMode = {
        img1: 'http://codh.rois.ac.jp/pmjt/iiif/200019661/200019661_00005.tif/full/pct:15/0/default.jpg',
        img2: 'http://codh.rois.ac.jp/pmjt/iiif/200019662/200019662_00004.tif/full/pct:15/0/default.jpg',
        'img1_label': '昇栄武鑑（嘉永６）',
        'img2_label': '昇栄武鑑（安政３）',
        'corr_pts': {
            img1: {
                size: { w: 5616, h: 3744 },
                pts: [{ x: 2817, y: 1257 }, { x: 4800, y: 1216 }, { x: 4812, y: 2608 }, { x: 2828, y: 2601 }]
            },
            img2: {
                size: { w: 5616, h: 3744 },
                pts: [{ x: 2840, y: 1250 }, { x: 4815, y: 1273 }, { x: 4785, y: 2661 }, { x: 2811, y: 2592 }]
            }
        },
        annotations: [
            {
                '@context': 'http://www.w3.org/ns/anno.jsonld',
                'type': 'Annotation',
                'body': [
                    {
                        'type': 'TextualBody',
                        'value': '書院御番頭→留守居',
                        'purpose': 'commenting'
                    }
                ],
                'target': {
                    'selector': {
                        'type': 'FragmentSelector',
                        'conformsTo': 'http://www.w3.org/TR/media-frags/',
                        'value': 'xywh=pixel:620,236,23,95'
                    }
                },
                'id': '#01480690-5aae-486b-b64e-32f0e9e9bc44'
            }
        ]
    };
    var dataGlobalCompareMode = {
        img1: 'http://dsr.nii.ac.jp/memory-hunting/photo/9/ing/n/02D7BBAA-89B4-11E4-B77D-C99759FF962C.jpg',
        img2: 'http://dsr.nii.ac.jp/memory-hunting/photo/9/ed/n/0219F564-8B0A-11E4-85A1-312F59FF962C',
        'img1_label': 'Before',
        'img2_label': 'After',
        'corr_pts': {
            img1: {
                size: {w: 640, h: 480 },
                pts: [{x: 190, y: 163}, {x: 488, y: 162}, {x: 490, y: 346}, {x: 186, y: 345}]
            },
            img2: {
                size: {w: 640, h: 480 },
                pts: [{x: 196, y: 170 }, {x: 482, y: 156}, {x: 485, y: 341}, {x: 195, y: 340}]
            }
        },
        annotations: [
            {
                '@context': 'http://www.w3.org/ns/anno.jsonld',
                'type': 'Annotation',
                'body': [
                    {
                        'type': 'TextualBody',
                        'value': '葱花形？',
                        'purpose': 'commenting'
                    }
                ],
                'target': {
                    'selector': {
                        'type': 'FragmentSelector',
                        'conformsTo': 'http://www.w3.org/TR/media-frags/',
                        'value': 'xywh=pixel:310,45,60,55'
                    }
                },
                'id': '#3da4afe7-c24b-46d7-9517-be9834573a27'
            }
        ],
        mode: true
    };
    var viewerId = 'viewer_01';
    var editorId = 'editor_01';
    var _viewerId = '#' + viewerId;
    var _editorId = '#' + editorId;
    var viewer;
    var editor;
    var isEditorMode = false;
    var enableAnnotator = ($.isPlainObject(conf) && conf.enableAnnotator);
    var mode = ($.isPlainObject(conf) && conf.mode);
    var data = mode ? dataGlobalCompareMode : dataLocalCompareMode;

    function updateVE(option) {
        var isEditorMode_ = isEditorMode;
        isEditorMode = !(isEditorMode);
        if (isEditorMode_) {
            //編集モード
            if (viewer) {
                //viewerがあれば、viewerから編集後のパラメータを取得
                var vdata = viewer.getParameters();
                if ($.isPlainObject(vdata) && vdata.img1) {
                    data = vdata;
                }
            }
            $(_editorId).removeAttr('class').removeAttr('style').empty().show();
            $(_viewerId).hide();
            editor = VDiffEditor({
                id: editorId,
                data: data,
                showSaveParametersButton: true,
                showDeleteParametersButton: true
            });
        } else {
            //比較表示モード
            if (editor) {
                //editorがあれば、editorから編集後のパラメータを取得
                var edata = editor.getParameters();
                if ($.isPlainObject(edata) && edata.img1) {
                    data = edata;
                }
                if (option && $.isPlainObject(option)) {
                    if (option.deleteParam) {
                        delete data.corr_pts;
                    }
                }
            }
            $(_viewerId).removeAttr('class').removeAttr('style').empty().show();
            $(_editorId).hide();
            viewer = VDiff({
                id: viewerId,
                data: data,
                editorUrl: '#',
                enableAnnotator: enableAnnotator
            });
        }
    }

    $(_viewerId).on('click', _viewerId + '-editor_link', updateVE);
    $(_editorId).on('click', _editorId + '-save_param', updateVE);
    $(_editorId).on('click', _editorId + '-delete_param', function() {
        updateVE({ deleteParam: true });
    });

    updateVE();
};