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
var VDiffWrapper = function(conf) {
    'use strict';

    var lng = getLang(conf);
    function getLang(config) {
        function getLangFromObject(obj) {
            if ($.isPlainObject(obj)) {
                if (obj.lang) { //表示言語指定
                    // lang: undefined などの場合は、ここでは決定しない。
                    if (obj.lang !== 'ja') {
                        return 'en'; //ja以外は全てenにfallback
                    } else {
                        return 'ja';
                    }
                }
            }
            return null;
        }
        //第1優先：GETパラメータ
        var params_ = getParams(location.search);
        var lang = getLangFromObject(params_);
        //第2優先：設定ファイル
        if (!lang) {
            lang = getLangFromObject(config);
        }
        //第3優先：ブラウザの言語設定
        if (!lang) {
            lang = (String(window.navigator.language || window.navigator.userLanguage || 'ja').substring(0, 2) !== 'ja' ? 'en' : 'ja');
        }
        return lang;
    }
    function getParams(search) {
        var query = search.substring(1);
        if (query !== '') {
            var params = query.split('&');
            var paramsObj = {};
            for (var i = 0; i < params.length; i++) {
                var elems = params[i].split('=');
                if (elems.length > 1) {
                    var key = decodeURIComponent(elems[0].replace(/\+/g, ' '));
                    var val = decodeURIComponent(elems[1].replace(/\+/g, ' '));
                    paramsObj[key] = val;
                }
            }
            return paramsObj;
        } else {
            return null;
        }
    }
    function parseBoolean(arg, prop) {
        var tgt = arg;
        if ($.isPlainObject(arg) && typeof prop === 'string' && prop in arg) {
            tgt = arg[prop];
        }
        if (typeof tgt === 'string') {
            //簡易的判定
            return (tgt === '' || tgt === 'false' || tgt === 'undefined' || tgt === 'null' || tgt === '0') ? false : true;
        } else {
            return (tgt) ? true : false;
        }
    }
    function setupForm(formId_, params_) {
        var p = params_ || {};

        $form = $(formId_).addClass('vdiffjs-form-container').addClass('vdiffjs-form-container-local').hide();

        var $img1Div = $('<div>');
        if (fileMode) {
            $img1Div.addClass('local-form-file');
            var $img1FileLabel = $('<div>').text((lng !== 'ja') ? 'Image #1 File: ' : '画像1 ファイル：');
            var $img1File = $('<input>').attr('type', 'file');
            var $img1Data = $('<input>').attr('type', 'hidden').attr('name', 'img1');
            $img1Div.append($img1FileLabel.append($img1File).append($img1Data));
        } else {
            var $img1Url = $('<input>').attr('type', 'text').attr('name', 'img1').addClass('form-url');
            $img1Url.attr('placeholder', (lng !== 'ja') ? 'Image #1 URL' : '画像1 URL').val(('img1' in p) ? p.img1 : '');
            $img1Div.append($img1Url);
        }
        var $img1Label = $('<input>').attr('type', 'text').attr('name', 'img1_label').addClass('form-label');
        $img1Label.attr('placeholder', (lng !== 'ja') ? 'Image #1 Label (Optional)' : '画像1 ラベル（任意）').val(('img1_label' in p) ? p.img1_label : '');
        $img1Div.append($img1Label);

        var $img2Div = $('<div>');
        if (fileMode) {
            $img2Div.addClass('local-form-file');
            var $img2FileLabel = $('<div>').text((lng !== 'ja') ? 'Image #2 File: ' : '画像2 ファイル：');
            var $img2File = $('<input>').attr('type', 'file');
            var $img2Data = $('<input>').attr('type', 'hidden').attr('name', 'img2');
            $img2Div.append($img2FileLabel.append($img2File).append($img2Data));
        } else {
            var $img2Url = $('<input>').attr('type', 'text').attr('name', 'img2').addClass('form-url');
            $img2Url.attr('placeholder', (lng !== 'ja') ? 'Image #2 URL' : '画像2 URL').val(('img2' in p) ? p.img2 : '');
            $img2Div.append($img2Url);
        }
        var $img2Label = $('<input>').attr('type', 'text').attr('name', 'img2_label').addClass('form-label');
        $img2Label.attr('placeholder', (lng !== 'ja') ? 'Image #2 Label (Optional)' : '画像2 ラベル（任意）').val(('img2_label' in p) ? p.img2_label : '');
        $img2Div.append($img2Label);

        var p_;
        if ('mode' in p) {
            p_ = p;
        } else if ('mode' in conf) {
            p_ = conf;
        }
        var mode = parseBoolean(p_, 'mode');
        var $modeDiv = $('<div>');
        var $mode = $('<input>').attr('type', 'hidden').attr({ 'name': 'mode', 'value': mode.toString() });
        $modeDiv.append($mode);

        var $jsonDiv = $('<div>').addClass('local-form-file');
        var $jsonLabel = $('<div>').text((lng !== 'ja') ? 'Parameters File (Optional): ' : 'パラメータファイル（任意）：');
        var $jsonFile = $('<input>').attr('type', 'file');
        var $jsonData = $('<input>').attr('type', 'hidden').attr('name', 'json');
        $jsonDiv.append($jsonLabel.append($jsonFile).append($jsonData));

        var $submit = $('<button>').attr('type', 'submit').addClass('form-submit').text((lng !== 'ja') ? 'Compare' : '比較する');

        $form.append($img1Div).append($img2Div).append($modeDiv).append($jsonDiv).append($submit);
        $('.vdiffjs-form-container input:text,.form-submit').button();

        if (fileMode) {
            $img1File.off('change.vdiffjs');
            $img1File.on('change.vdiffjs', function(e) {
                var reader = new FileReader();
                reader.readAsDataURL(e.target.files[0]);
                reader.onload = function(){
                    $img1Data.val(reader.result);
                };
            });
            $img2File.off('change.vdiffjs');
            $img2File.on('change.vdiffjs', function(e) {
                var reader = new FileReader();
                reader.readAsDataURL(e.target.files[0]);
                reader.onload = function(){
                    $img2Data.val(reader.result);
                };
            });
        }
        $jsonFile.off('change.vdiffjs');
        $jsonFile.on('change.vdiffjs', function(e) {
            var reader = new FileReader();
            reader.readAsDataURL(e.target.files[0]);
            reader.onload = function(){
                $jsonData.val(reader.result);
            };
        });
        $submit.off('click.vdiffjs');
        $submit.on('click.vdiffjs', function() {
            $form.hide();
            try {
                var jsonVal = $jsonData.val(); // data:[<mediatype>][;base64],<data>
                var jsonData;
                var elems = jsonVal.split(',');
                if (elems.length > 1) {
                    var firstElem = elems.shift();
                    var data_ = elems.join(',');
                    if (firstElem.match(/;base64$/)) {
                        // base64-encoded
                        data_ = decodeURIComponent(escape(window.atob(data_)));
                    } else {
                        // percent-encoded
                        data_ = decodeURIComponent(data_);
                    }
                    if (data_) {
                        jsonData = JSON.parse(data_);
                    }
                }
                if ($.isPlainObject(jsonData)) {
                    data = jsonData;
                }
            } catch(error) {
                //
            }
            var img1Url;
            var img2Url;
            if (fileMode) {
                img1Url = $img1Data.val();
                img2Url = $img2Data.val();
            } else {
                img1Url = $img1Url.val();
                img2Url = $img2Url.val();
            }
            if (img1Url) {
                data.img1 = img1Url;
            }
            if (img2Url) {
                data.img2 = img2Url;
            }
            var img1Label = $img1Label.val();
            var img2Label = $img2Label.val();
            if (img1Label) {
                data['img1_label'] = img1Label;
            }
            if (img2Label) {
                data['img2_label'] = img2Label;
            }
            var mode = $mode.val();
            data.mode = parseBoolean(mode);
            updateVE();
        });

        $form.show();
    }

    var $wrapper = $('#' + conf.id);
    var viewerId = conf.id + '_vdiffjs_viewer';
    var editorId = conf.id + '_vdiffjs_editor';
    var formId   = conf.id + '_vdiffjs_form';
    var _viewerId = '#' + viewerId;
    var _editorId = '#' + editorId;
    var _formId   = '#' + formId;
    $wrapper.addClass('vdiffjs-wrapper-container').append($('<div>').attr('id', viewerId)).append($('<div>').attr('id', editorId)).append($('<div>').attr('id', formId));
    var fileMode = conf.fileMode;

    var viewer;
    var editor;
    var isEditorMode = false;
    var $form;

    var params = getParams(location.search);

    var data = {};
    var viewerConfig = {
        id: viewerId,
        size: {
            'max-size': 1500
        },
        lang: lng,
        editorUrl: 'javascript:void(0);',
        enableAnnotator: (conf.enableAnnotator),
        doneCallback: function() {
            if ($form) {
                $form.hide();
            }
            if (data && data.img1_label && data.img2_label) {
                $('title').text((lng !== 'ja') ?
                    'vdiff.js - comparison of ' + data.img1_label + ' and ' + data.img2_label :
                    'vdiff.js - ' + data.img1_label + 'と' + data.img2_label + 'の比較');
            }
            $(_viewerId + '-save_annotations').attr({ title: (lng !== 'ja') ? 'Donwload Parametets' : 'パラメータをダウンロード' }).on('click', function() {
                if (viewer) {
                    var data = viewer.getParameters();
                    var blob = new Blob([JSON.stringify(data, null, '\t')], { type: 'text/plain' });
                    var filename = 'vdiffjs_params.json';
                    var anchorElem = document.createElement('a');
                    anchorElem.href = window.URL.createObjectURL(blob);
                    anchorElem.download = filename;
                    document.body.appendChild(anchorElem);
                    anchorElem.click();
                    document.body.removeChild(anchorElem);
                }
            });
        },
        failCallback: function() {
            isEditorMode = false;
            var userAgent = window.navigator.userAgent.toLowerCase();
            if (userAgent.indexOf('msie') != -1 || userAgent.indexOf('trident') != -1 || typeof WebAssembly !== 'object') {
                //
            } else {
                if (!$form) {
                    setupForm(_formId, params);
                }
                $form.show();
            }
        },
        alwaysCallback: function() {
            if ($.fn.spin) {
                $(_viewerId).spin(false);
            }
        }
    };
    var editorConfig = {
        id: editorId,
        size: {
            'max-size': 1500
        },
        lang: lng,
        showSaveParametersButton: true,
        layout: 'horizontal',
        doneCallback: function() {
            if ($form) {
                $form.hide();
            }
            if (data && data.img1_label && data.img2_label) {
                $('title').text((lng !== 'ja') ?
                    'vdiff.js - comparison of ' + data.img1_label + ' and ' + data.img2_label :
                    'vdiff.js - ' + data.img1_label + 'と' + data.img2_label + 'の比較');
            }
            $(_editorId + '-save_param').attr({ title: (lng !== 'ja') ? 'Back to image comparison' : '画像比較に戻る' });
            var $jsonDownloadButton = $('<button>').addClass('ui-button ui-widget ui-corner-all').attr({ title: (lng !== 'ja') ? 'Donwload Parametets' : 'パラメータをダウンロード' }).html($('<i>').addClass('fas fa-download'));
            $(_editorId + ' .edit-buttons-container .left-block').append($jsonDownloadButton);
            $jsonDownloadButton.on('click', function() {
                if (editor) {
                    var data = editor.getParameters();
                    var blob = new Blob([JSON.stringify(data, null, '\t')], { type: 'text/plain' });
                    var filename = 'vdiffjs_params.json';
                    var anchorElem = document.createElement('a');
                    anchorElem.href = window.URL.createObjectURL(blob);
                    anchorElem.download = filename;
                    document.body.appendChild(anchorElem);
                    anchorElem.click();
                    document.body.removeChild(anchorElem);
                }
            });
        },
        failCallback: function() {
            isEditorMode = false;
            var userAgent = window.navigator.userAgent.toLowerCase();
            if (userAgent.indexOf('msie') != -1 || userAgent.indexOf('trident') != -1 || typeof WebAssembly !== 'object') {
                //
            } else {
                if (!$form) {
                    setupForm(_formId, params);
                }
                $form.show();
            }
        },
        alwaysCallback: function() {
            if ($.fn.spin) {
                $(_editorId).spin(false);
            }
        }
    };


    function updateHistory() {
        if (history.replaceState && history.state !== undefined) {
            var newUrl = getPageLink();
            history.replaceState(null, document.title, newUrl);
        }
    }
    function getPageLink() {
        var newUrl = location.protocol + '//' + location.host + location.pathname;
        if ($.isPlainObject(data)) {
            var params_ = [];
            params_.push('img1=' + encodeURIComponentForQuery(data.img1));
            params_.push('img2=' + encodeURIComponentForQuery(data.img2));
            if (data.img1_label) {
                params_.push('img1_label=' + encodeURIComponentForQuery(data.img1_label));
            }
            if (data.img2_label) {
                params_.push('img2_label=' + encodeURIComponentForQuery(data.img2_label));
            }
            if (data.corr_pts) {
                if ($.isPlainObject(data.corr_pts)) {
                    params_.push('corr_pts=' + encodeURIComponentForQuery(JSON.stringify(data.corr_pts)));
                } else if (typeof data.corr_pts === 'string') {
                    params_.push('corr_pts=' + encodeURIComponentForQuery(data.corr_pts));
                }
            }
            if (data.img1_roi_xywh) {
                params_.push('img1_roi_xywh=' + encodeURIComponentForQuery(data.img1_roi_xywh));
            }
            if (data.mode) {
                params_.push('mode=' + encodeURIComponentForQuery(data.mode));
            }
            if (data.show_img1_right) {
                params_.push('show_img1_right=' + encodeURIComponentForQuery(data.show_img1_right));
            }
            if (params) {
                if (params.lang) {
                    params_.push('lang=' + params.lang);
                }
            }
        }
        if (params_.length > 0) {
            newUrl += '?' + params_.join('&');
        }
        return newUrl;
    }
    function encodeURIComponentForQuery(str) {
        //encodeURIComponentでエスケープされる文字の一部をアンエスケープする
        /*
            URI           = scheme ":" hier-part [ "?" query ] [ "#" fragment ]
            query         = *( pchar / "/" / "?" )
            pchar         = unreserved / pct-encoded / sub-delims / ":" / "@"
            unreserved    = ALPHA / DIGIT / "-" / "." / "_" / "~"
            sub-delims    = "!" / "$" / "&" / "'" / "(" / ")" / "*" / "+" / "," / ";" / "="
            https://www.ietf.org/rfc/rfc3986.txt
        */
        //query部分では、":", "@", "/", "?" と sub-delimsは許されている
        //可読性のため、ここでは ":", "/", "," はアンエスケープする
        var result = encodeURIComponent(str).replace(/%(?:3A|2F|2C)/g, function(c) {
            return decodeURIComponent(c);
        });
        return result;
    }

    function updateVE() {
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
            $(_viewerId).removeAttr('class').removeAttr('style').empty().hide();
            if ($.fn.spin) {
                $(_editorId).spin();
            }
            editorConfig.data = data;
            editor = VDiffEditor(editorConfig);
        } else {
            //比較表示モード
            if (editor) {
                //editorがあれば、editorから編集後のパラメータを取得
                var edata = editor.getParameters();
                if ($.isPlainObject(edata) && edata.img1) {
                    data = edata;
                }
            }
            $(_viewerId).removeAttr('class').removeAttr('style').empty().show();
            $(_editorId).removeAttr('class').removeAttr('style').empty().hide();
            if ($.fn.spin) {
                $(_viewerId).spin();
            }
            viewerConfig.data = data;
            viewer = VDiff(viewerConfig);
            if (data.img1.startsWith('data:') || data.img2.startsWith('data:')) {
                //ローカルファイルのときはURLに反映させない
            } else {
                updateHistory();
            }
        }
    }

    $(_viewerId).on('click', _viewerId + '-editor_link', updateVE);
    $(_editorId).on('click', _editorId + '-save_param', updateVE);

    if (params && params.img1 && params.img2) {
        data.img1 = params.img1;
        data.img2 = params.img2;
        if (params['img1_label']) {
            data['img1_label'] = params['img1_label'];
        }
        if (params['img2_label']) {
            data['img2_label'] = params['img2_label'];
        }
        if (params['corr_pts']) {
            try {
                data['corr_pts'] = JSON.parse(params['corr_pts']);
            } catch(e) {
                //有効なJSONでない（'corners'指定などの場合も含む）
                data['corr_pts'] = params['corr_pts'];
            }
        }
        if (params['img1_roi_xywh']) {
            data['img1_roi_xywh'] = params['img1_roi_xywh'];
        }
        if ('mode' in params) {
            data['mode'] = parseBoolean(params, 'mode');
        }
        if ('show_img1_right' in params) {
            data['show_img1_right'] = parseBoolean(params, 'show_img1_right');
        }
        updateVE();
    } else if (!$form) {
        setupForm(_formId, params);
    }
};