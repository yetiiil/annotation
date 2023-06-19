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
var VDiff = function(config) {
    'use strict';

    var $ = window.$;

    var APP_NAME = 'vdiff.js';
    var VERSION  = '1.5.1+20230317';
    if (window.console) {
        console.log(APP_NAME + ' ' + VERSION); // eslint-disable-line no-console
    }

    //リテラルはさほど多くないので、i18n用のフレームワークは用いず、直接記述する。
    var lng = getLang(config);

    //IEはWebAssembly未対応（WebAssembly以外にも未対応のCSSなどがあるため動作対象外とする）
    var userAgent = window.navigator.userAgent.toLowerCase();
    if (userAgent.indexOf('msie') != -1 || userAgent.indexOf('trident') != -1) {
        showError((lng !== 'ja') ? 'Internet Explorer is not supported.' : 'Internet Explorerは未対応です。');
        return;
    } else if (typeof WebAssembly !== 'object') {
        showError((lng !== 'ja') ? 'WebAssembly is not supported by your browser.' : 'お使いのブラウザはWebAssembly未対応です。');
        return;
    }

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
    function showError(msg) {
        if ($.isPlainObject(config)) {
            if (config.id) {
                $('#' + config.id).text(msg);
            }
            if ($.isFunction(config.failCallback)) {
                config.failCallback();
            }
            if ($.isFunction(config.alwaysCallback)) {
                config.alwaysCallback();
            }
        }
    }

    function showComparedImages(config_, params_) {
        var config__ = $.isPlainObject(config_) ? config_ : {};
        var containerId = '#' + config__.id;
        var limitSize = config__.size;
        var editorUrl = config__.editorUrl;
        var layoutPattern = (function(confLayout, paramLayout) {
            var LAYOUT_PATTERN_DEFAULT = 1;
            var LAYOUT_PATTERNS_NUM = 4;
            var layoutPattern = LAYOUT_PATTERN_DEFAULT;
            var layoutPattern_ = parseInt(paramLayout, 10) || parseInt(confLayout, 10);
            if (!isNaN(layoutPattern_) && layoutPattern_ > 0 && layoutPattern_ <= LAYOUT_PATTERNS_NUM) {
                layoutPattern = layoutPattern_;
            }
            return layoutPattern;
        }(config__.layout, (getParams(location.search) || {}).layout));
        var enableAnnotator = config__.enableAnnotator;

        var params__ = $.isPlainObject(params_) ? params_ : {};
        var img1Url = params__.img1;
        var img2Url = params__.img2;
        var img1Label = params__.img1_label;
        var img2Label = params__.img2_label;
        var corrPts = params__.corr_pts;
        var img1RoiFragment = params__.img1_roi_xywh;
        var isGlobalCompareMode = (params__.mode) ? true : false; //true: 全体変化比較モード, false: 局所強調比較モード
        if ('mode' in params__ && typeof params__.mode === 'string') {
            if (params__.mode === 'false' || params__.mode === '0') {
                isGlobalCompareMode = false;
            }
        }
        var showImg1onRightSide = (params__.show_img1_right) ? true : false;
        if ('show_img1_right' in params__ && typeof params__.mode === 'string') {
            if (params__.show_img1_right === 'false' || params__.show_img1_right === '0') {
                showImg1onRightSide = false;
            }
        }
        var annotations = $.isArray(params__.annotations) ? params__.annotations : null;

        $(containerId).addClass('vdiffjs-container');
        if (isGlobalCompareMode) {
            $(containerId).addClass('vdiffjs-global-compare-mode');
        }

        //ブラウザのキャッシュから読み込まれると、crossOrigin: 'anonymous'が反映されずセキュリティエラーになるため再取得
        function getUrlWithTimeStamp(url, opt) {
            var url_ = url.toString();
            if (url_.toLowerCase().indexOf('data:') === 0 || url_.toLowerCase().indexOf('blob:') === 0 || opt.no_ts) {
                return url_;
            } else {
                return url_ + (url_.indexOf('?') !== -1 ? '&' : '?') + new Date().getTime();
            }
        }
        var img1Url_ = getUrlWithTimeStamp(img1Url, params__);
        var img2Url_ = getUrlWithTimeStamp(img2Url, params__);
        function setCrossOriginProp(attr, opt) {
            var crossOrigin = 'anonymous';
            if ('crossOrigin' in opt) {
                switch (opt.crossOrigin.toLowerCase()) {
                case 'use-credentials':
                    crossOrigin = 'use-credentials';
                    break;
                case 'false':
                    crossOrigin = undefined; //crossOrigin属性は付加しない
                    //ただし、tainted扱いとなるため、OpenCV.jsのimread()で読み込む際、以下のエラーになる。
                    //Uncaught DOMException: The operation is insecure.
                    break;
                }
            }
            var attr_ = $.isPlainObject(attr) ? attr : {};
            if (crossOrigin !== undefined) {
                attr_.crossOrigin = crossOrigin;
            }
            return attr_;
        }
        var $img1 = $('<img>').attr(setCrossOriginProp({ src: img1Url_ }, params__));
        var $img2 = $('<img>').attr(setCrossOriginProp({ src: img2Url_ }, params__));

        //jQuery Images Compareコンテナ
        var $div1 = $('<div>').css({ display: 'none' }).append($img1);
        var $div2 = $('<div>').append($img2);
        var $imagesCompareContainer = $('<div>').append($div1).append($div2);
        $(containerId).append($imagesCompareContainer);
        var imagesCompare = $imagesCompareContainer.imagesCompare().data('imagesCompare');
        $imagesCompareContainer.hide();

        //キャンバスなど
        var containerId_ = containerId.slice(1) + '-';
        var canvasPrefix = containerId_ + 'canvas';
        //局所強調比較モード・全体変化比較モード両用
        var $canvasToSave = null;
        //  左右表示
        var $canvasNormal1 = $('<canvas>').attr({ id: canvasPrefix + '_1_normal' });
        var $canvasNormal2 = $('<canvas>').attr({ id: canvasPrefix + '_2_normal' });
        //  並列表示
        var $canvasSideBySide = $('<canvas>').attr({ id: canvasPrefix + '_side_by_side' });
        //  アノテーションレイヤー
        var $canvasAnnotations = $('<canvas>').attr({ id: canvasPrefix + '_annotations' }).addClass('annotation-marker');
        //局所強調比較モード
        //  左右表示＋強調表示
        var $canvasHighlighted1 = $('<canvas>').attr({ id: canvasPrefix + '_1_highlighted' });
        var $canvasHighlighted2 = $('<canvas>').attr({ id: canvasPrefix + '_2_highlighted' });
        var $canvasOverlay = $('<canvas>').attr({ id: canvasPrefix + '_overlay' });
        //  強調表示
        var $canvasHighlighted = $('<canvas>').attr({ id: canvasPrefix + '_merged_highlighted' });
        //  赤青表示
        var $canvasAnaglyph = $('<canvas>').attr({ id: canvasPrefix + '_merged_anaglyph' });
        //全体変化比較モード
        //  透明表示
        var $canvasDissolve1 = $('<canvas>').attr({ id: canvasPrefix + '_1_dissolve' });
        var $canvasDissolve2 = $('<canvas>').attr({ id: canvasPrefix + '_2_dissolve' });
        var $canvasDissolved = $('<canvas>').attr({ id: canvasPrefix + '_merged_dissolve' });

        if (annotations || enableAnnotator) {
            $(containerId).append($canvasAnnotations);
        }
        if (isGlobalCompareMode) {
            var $dissolveContainer = $('<div>').addClass('dissolve-container');
            $dissolveContainer.append($canvasDissolve1).append($canvasDissolve2).append($canvasDissolved);
            $(containerId).append($dissolveContainer).append($canvasSideBySide);
        } else {
            $(containerId).append($canvasHighlighted).append($canvasAnaglyph).append($canvasSideBySide);
        }

        //ツールバー
        var $toolbarContainer = $('<div>').addClass('toolbar-container');

        //比較手法選択ラジオボタン
        var $compareMethodsSelecterContainer = $('<div>').addClass('compare-methods-selecter-container');
        var radioPrefix = containerId_ + 'radio';
        var radioSelecter = containerId + ' input[name="' + radioPrefix + '"]';
        var radioButtonsNum = (isGlobalCompareMode) ? 3 : 4;
        var radioInitVal = (isGlobalCompareMode) ? 0 : 1;
        var radioLabels = [];
        for (var i = 0; i < radioButtonsNum; i++) {
            var radioTitle;
            var radioClass;
            switch (i) {
            case 0:
                radioTitle = (lng !== 'ja') ? 'Juxtapose' : '左右';
                radioClass = 'fas fa-exchange-alt';
                break;
            case 1:
                if (isGlobalCompareMode) {
                    radioTitle = (lng !== 'ja') ? 'Dissolve' : '透明';
                    radioClass = 'fas fa-adjust';
                } else {
                    radioTitle = (lng !== 'ja') ? 'Highlight' : '強調';
                    radioClass = 'fas fa-highlighter';
                }
                break;
            case 2:
                if (isGlobalCompareMode) {
                    radioTitle = (lng !== 'ja') ? 'Side-by-Side' : '並列';
                    radioClass = 'fas fa-columns';
                } else {
                    radioTitle = (lng !== 'ja') ? 'Bicolor' : '赤青';
                    radioClass = 'fas fa-layer-group';
                }
                break;
            case 3:
                if (isGlobalCompareMode) {
                    radioTitle = '4';
                    radioClass = '';
                } else {
                    radioTitle = (lng !== 'ja') ? 'Side-by-Side' : '並列';
                    radioClass = 'fas fa-columns';
                }
                break;
            }
            var radioLabel = $('<i>').addClass(radioClass).attr('title', radioTitle).prop('outerHTML');
            radioLabels.push(radioLabel);
            $compareMethodsSelecterContainer.append($('<input>').attr({ type: 'radio', name: radioPrefix, id: radioPrefix + i, value: i }));
            $compareMethodsSelecterContainer.append($('<label>').attr({ for: radioPrefix + i, title: radioTitle }).html(radioLabel));
        }
        var $compareMethodsAdditionalSettingContainer = $('<div>').addClass('compare-methods-additional-setting-container');
        if (isGlobalCompareMode) {
            //重ね合わせ透明度スライダ
            var $sliderOpacity = $('<input>').attr({ type: 'range', min: 0, max: 1, value: 0.5, step: 'any' });
            $compareMethodsAdditionalSettingContainer.append($sliderOpacity);
        } else {
            //強調チェックボックス
            var checkboxPrefix = containerId_ + 'enable_highlight';
            var $checkboxHighlight = $('<input>').attr({ type: 'checkbox', id: checkboxPrefix }).prop('checked', true);
            $compareMethodsAdditionalSettingContainer.append($checkboxHighlight).
                append($('<label>').attr({ for: checkboxPrefix }).html(radioLabels[1]));
        }
        $compareMethodsSelecterContainer.append($compareMethodsAdditionalSettingContainer);
        $toolbarContainer.append($compareMethodsSelecterContainer);
        $compareMethodsSelecterContainer.hide();

        //その他ボタン
        var $buttonsContainer = $('<div>').addClass('buttons-container clearfix');
        var $toggleAnnotation = (annotations || enableAnnotator) ? $('<input>').attr({ id: containerId_ + 'toggle_annotations', type: 'checkbox' }).prop('checked', true) : null;
        var $toggleAnnotationLabel = (annotations || enableAnnotator) ? $('<label>').attr({ for: containerId_ + 'toggle_annotations' }).html($('<i>').addClass('fas fa-comment-alt')).attr({ title: (lng !== 'ja') ? 'Toggle Annotations Display' : 'アノテーション表示／非表示を切り替え' }) : null;
        var $saveAnnotationsLink = (enableAnnotator) ? $('<button>').attr({ id: containerId_ + 'save_annotations', type: 'button' }).addClass('ui-button ui-widget ui-corner-all').attr({ title: (lng !== 'ja') ? 'Save Annotations' : 'アノテーションを保存' }).html($('<i>').addClass('fas fa-save')) : null;
        var $editorLink = (editorUrl) ? $('<a>').addClass('ui-button ui-widget ui-corner-all').attr({ id: containerId_ + 'editor_link', title: (lng !== 'ja') ? 'Edit image transformation' : '画像比較を修正', href: editorUrl }).html($('<i>').addClass('fas fa-edit')) : null;
        var $saveImageLink = $('<a>').addClass('ui-button ui-widget ui-corner-all').attr({ id: containerId_ + 'save_image_link', title: (lng !== 'ja') ? 'Save image' : '画像を保存' }).html($('<i>').addClass('fas fa-file-download'));
        var $helpLink = $('<a>').addClass('ui-button ui-widget ui-corner-all').attr({ title: (lng !== 'ja') ? 'Help about vdiff.js' : 'vdiff.jsヘルプ', href: 'http://codh.rois.ac.jp/software/vdiffjs/', target: '_blank' }).html($('<i>').addClass('fas fa-question'));
        $buttonsContainer.append($toggleAnnotation).append($toggleAnnotationLabel).append($saveAnnotationsLink).append($editorLink).append($saveImageLink).append($helpLink);
        $toolbarContainer.append($buttonsContainer);
        $buttonsContainer.hide();
        if (annotations || enableAnnotator) {
            $toggleAnnotation.button();
        }

        //凡例
        var $legendContainer = $('<div>').addClass('legend-container clearfix');
        var $legendMarkerL = $('<span>').addClass('left-marker').text('');
        var $legendMarkerR = $('<span>').addClass('right-marker').text('');
        var $legendLabelL = $('<div>').addClass('left-label');
        var $legendLabelR = $('<div>').addClass('right-label');
        if (showImg1onRightSide) {
            $legendLabelL.text(img2Label ? img2Label : ((lng !== 'ja') ? 'Image 2' : '画像2'));
            $legendLabelR.text(img1Label ? img1Label : ((lng !== 'ja') ? 'Image 1' : '画像1'));
        } else {
            $legendLabelL.text(img1Label ? img1Label : ((lng !== 'ja') ? 'Image 1' : '画像1'));
            $legendLabelR.text(img2Label ? img2Label : ((lng !== 'ja') ? 'Image 2' : '画像2'));
        }
        var $legendBlockL = $('<div>').addClass('left-block').append($legendMarkerL).append($legendLabelL);
        var $legendBlockR = $('<div>').addClass('right-block').append($legendLabelR).append($legendMarkerR);
        $legendContainer.append($legendBlockL).append($legendBlockR);
        $legendContainer.hide();
        function updateLegendVisibilty(isJuxtaposeSelected, imagesCompareRatio) {
            if (isJuxtaposeSelected) {
                // 左右表示
                if (imagesCompareRatio <= 0) {
                    $legendBlockL.css({ visibility: 'hidden' });
                } else {
                    $legendBlockL.css({ visibility: 'visible' });
                }
                if (imagesCompareRatio >= 1) {
                    $legendBlockR.css({ visibility: 'hidden' });
                } else {
                    $legendBlockR.css({ visibility: 'visible' });
                }
            } else {
                // 左右表示以外では、常に両者とも表示
                $legendBlockL.css({ visibility: 'visible' });
                $legendBlockR.css({ visibility: 'visible' });
            }
        }

        //レイアウト
        switch(layoutPattern) {
        case 1:
            $toolbarContainer.addClass('top');
            $legendContainer.addClass('bottom');
            $(containerId).prepend($toolbarContainer);
            $(containerId).append($legendContainer);
            break;
        case 2:
            $legendContainer.addClass('top');
            $toolbarContainer.addClass('bottom');
            $(containerId).prepend($legendContainer);
            $(containerId).append($toolbarContainer);
            break;
        case 3:
            $toolbarContainer.addClass('top');
            $legendContainer.addClass('middle');
            $(containerId).prepend($toolbarContainer);
            $toolbarContainer.after($legendContainer);
            break;
        case 4:
            $legendContainer.addClass('bottom');
            $toolbarContainer.addClass('bottom');
            $(containerId).append($legendContainer);
            $(containerId).append($toolbarContainer);
            break;
        }
        $(radioSelecter).checkboxradio({ icon: false });
        //jQuery UIのデザイン調整
        $('.compare-methods-selecter-container > label').removeClass('ui-corner-all');
        $('.compare-methods-selecter-container > label:first-of-type').addClass('ui-corner-tl ui-corner-bl');
        $('.compare-methods-selecter-container > label:last-of-type').addClass('ui-corner-tr ui-corner-br');

        //アノテーションのポップアップ
        var $annotationPopupContainer = $('<div>').addClass('annotation-popup-container clearfix leaflet-popup');
        $(containerId).append($annotationPopupContainer);
        $annotationPopupContainer.hide();

        function showComparedImagesCore() {
            var instances = [];

            //画像サイズの関係：
            //フルサイズ（オリジナル）座標系 →（'max-size'設定）→ リサイズ（読み込みサイズ）座標系 →（'max-width'/'max-height'設定）→ 表示座標系

            //画像サイズ制限（'max-size'設定）
            var MAX_SIZE_DEFAULT = 2000; //px
            var maxSize = (limitSize && $.isPlainObject(limitSize) && $.isNumeric(limitSize['max-size'])) ? limitSize['max-size'] : MAX_SIZE_DEFAULT;
            if (maxSize <= 0) {
                maxSize = MAX_SIZE_DEFAULT;
            }
            function getSizeLimitInfo(img, maxSize) {
                var ratio = 1;
                if (img.naturalWidth > img.naturalHeight) {
                    if (img.naturalWidth > maxSize) {
                        ratio = maxSize / img.naturalWidth;
                        return { css: { width: maxSize }, ratio: ratio, resized: { width: maxSize, height: img.naturalHeight * ratio } };
                    }
                } else {
                    if (img.naturalHeight > maxSize) {
                        ratio = maxSize / img.naturalHeight;
                        return { css: { height: maxSize }, ratio: ratio, resized: { width: img.naturalWidth * ratio, height: maxSize } };
                    }
                }
                return { css: {}, ratio: ratio, resized: { width: img.naturalWidth * ratio, height: img.naturalHeight * ratio} };
            }
            var img1SizeLimit = getSizeLimitInfo($img1[0], maxSize);
            var img2SizeLimit = getSizeLimitInfo($img2[0], maxSize);
            $img1.css(img1SizeLimit.css);
            $img2.css(img2SizeLimit.css);

            //'max-size'設定を反映したサイズで画像を読み込むため、いったん移動する
            var $img1Wrapper = $('<div>').css({ width: $img1[0].naturalWidth, height: $img1[0].naturalHeight, padding: 0 });
            var $img2Wrapper = $('<div>').css({ width: $img2[0].naturalWidth, height: $img2[0].naturalHeight, padding: 0 });
            $(containerId).append($img1Wrapper).append($img2Wrapper);
            $img1.appendTo($img1Wrapper);
            $img2.appendTo($img2Wrapper);
            //cv.imreadは画像の表示サイズに左右される（ただし、読み込み画像が非表示状態のときは、naturalWidth, naturalHeightサイズとなる）
            var img1 = cv.imread($img1[0]); instances.push(img1); //リサイズ座標系
            var img2 = cv.imread($img2[0]); instances.push(img2); //リサイズ座標系
            $img1Wrapper.hide();
            $img2Wrapper.hide();

            var dispW = $img1[0].width;  //フルサイズ座標系 → ... → 表示座標系（'max-size', 'max-width'または'max-height'設定の影響を受けうる）
            var dispH = $img1[0].height; //フルサイズ座標系 → ... → 表示座標系（'max-size', 'max-width'または'max-height'設定の影響を受けうる）
            var dispRatio = 1; //cv.imreadで読み込んだサイズから表示サイズへの倍率（縮小率）
            var dispSizeCss;
            //フルサイズ座標系 →（'max-size'設定）→ リサイズ座標系
            if (dispW > maxSize || dispH > maxSize) {
                //dispRatioの設定は不要
                dispW = img1SizeLimit.resized.width;
                dispH = img1SizeLimit.resized.height;
                dispSizeCss = { width: dispW, height: dispH, 'max-width': dispW, 'max-height': dispH };
            }
            //リサイズ座標系 →（'max-width'/'max-height'設定）→ 表示座標系
            if (limitSize && $.isPlainObject(limitSize)) {
                var dispRatio_;
                if ($.isNumeric(limitSize['max-width']) && limitSize['max-width'] > 0 && dispW > 0) {
                    dispRatio_ = limitSize['max-width'] / dispW;
                    if (dispRatio_ < 1) {
                        dispRatio = dispRatio_;
                        dispW = limitSize['max-width'];
                        dispH *= dispRatio;
                        dispSizeCss = { width: dispW, height: dispH, 'max-width': dispW, 'max-height': dispH };
                    }
                } else if ($.isNumeric(limitSize['max-height']) && limitSize['max-height'] > 0 && dispH > 0) {
                    dispRatio_ = limitSize['max-height'] / dispH;
                    if (dispRatio_ < 1) {
                        dispRatio = dispRatio_;
                        dispH = limitSize['max-height'];
                        dispW *= dispRatio;
                        dispSizeCss = { width: dispW, height: dispH, 'max-width': dispW, 'max-height': dispH };
                    }
                }
            }
            $(containerId).css({ width: dispW });
            if (dispSizeCss) {
                $imagesCompareContainer.css(dispSizeCss);
            }

            function getRectFromFragment(fragment) {
                var rect = { x: 0, y: 0, width: 100, height: 100, xywhUnit: 'percent' };
                if (fragment) {
                    //https://www.w3.org/TR/media-frags/#naming-space
                    //Media Fragmentsでは「pixel:」「percent:」（省略時はpixel扱い）、値は整数
                    var match = fragment.match(/^(pixel:|percent:)?([0-9]+),([0-9]+),([0-9]+),([0-9]+)/);
                    if (!match) {
                        //https://iiif.io/api/image/2.1/#region
                        //IIIF Image APIのregion指定では「pct:」または省略、「pct:」指定時の値は正の浮動小数点数または整数
                        //https://www.wikidata.org/wiki/Property:P2677
                        //pct:((100|[1-9]?\d(\.\d+)?),){3}(100|[1-9]?\d(\.\d+)?)
                        match = fragment.match(/^(pct:)(100|[1-9]?\d(?:\.\d+)?),(100|[1-9]?\d(?:\.\d+)?),(100|[1-9]?\d(?:\.\d+)?),(100|[1-9]?\d(?:\.\d+)?)/);
                    }
                    if (match) {
                        var x, y, w, h, xywhUnit;
                        if (match[1] === 'percent:' || match[1] === 'pct:') {
                            xywhUnit = 'percent';
                        }
                        if (xywhUnit === 'percent') {
                            x = parseFloat(match[2]);
                            y = parseFloat(match[3]);
                            w = parseFloat(match[4]);
                            h = parseFloat(match[5]);
                        } else {
                            x = parseInt(match[2], 10);
                            y = parseInt(match[3], 10);
                            w = parseInt(match[4], 10);
                            h = parseInt(match[5], 10);
                        }
                        rect = { x: x, y: y, width: w, height: h, xywhUnit: xywhUnit };
                    }
                }
                return rect;
            }
            function getIntersectRect(width, height, rect, unit) {
                var intersectRect;
                var x = rect.x;
                var y = rect.y;
                var w = rect.width;
                var h = rect.height;
                var xmin, xmax;
                var ymin, ymax;
                var swap;
                if (unit === 'percent') {
                    xmin = Math.min(Math.max(0, x), 100);
                    xmax = Math.max(Math.min(100, x + w), 0);
                    ymin = Math.min(Math.max(0, y), 100);
                    ymax = Math.max(Math.min(100, y + h), 0);
                } else {
                    xmin = Math.min(Math.max(0, x), width);
                    xmax = Math.max(Math.min(width, x + w), 0);
                    ymin = Math.min(Math.max(0, y), height);
                    ymax = Math.max(Math.min(height, y + h), 0);
                }
                if (xmin > xmax) {
                    swap = xmin;
                    xmin = xmax;
                    xmax = swap;
                }
                if (ymin > ymax) {
                    swap = ymin;
                    ymin = ymax;
                    ymax = swap;
                }
                if (unit === 'percent') {
                    intersectRect = {
                        x: xmin / 100 * width,
                        y: ymin / 100 * height,
                        width: (xmax - xmin) / 100 * width,
                        height: (ymax - ymin)  / 100 * height
                    };
                } else {
                    intersectRect = {
                        x: xmin,
                        y: ymin,
                        width: (xmax - xmin),
                        height: (ymax - ymin)
                    };
                }
                return intersectRect;
            }
            var dsize = new cv.Size(img1.cols, img1.rows); //出力画像はimg1と同サイズ（リサイズ座標系）
            var drect = new cv.Rect(0, 0, img1.cols, img1.rows); //ROI矩形（リサイズ座標系）
            if (img1RoiFragment) {
                var rectRoi = getRectFromFragment(img1RoiFragment); //フルサイズ座標系または相対値
                if (img1SizeLimit.ratio < 1 && rectRoi.xywhUnit !== 'percent') {
                    //'max-size'設定により、img1が縮小されている場合、img1_roi_xywhに縮小率を反映させる
                    //フルサイズ座標系 → リサイズ座標系
                    rectRoi.x *= img1SizeLimit.ratio;
                    rectRoi.y *= img1SizeLimit.ratio;
                    rectRoi.width *= img1SizeLimit.ratio;
                    rectRoi.height *= img1SizeLimit.ratio;
                }
                drect = getIntersectRect(img1.cols, img1.rows, rectRoi, rectRoi.xywhUnit);
                if (drect.x === 0 && drect.y === 0 && drect.width === 0 & drect.height === 0) {
                    drect.width = img1.cols;
                    drect.height = img1.rows;
                }
            }

            //---
            //img2を射影変換
            //---
            var img2Warped = new cv.Mat(); instances.push(img2Warped);
            var img2WarpedMask = new cv.Mat(); instances.push(img2WarpedMask);
            (function() {
                function validateCorrespondingPointsInput(data_) {
                    try {
                        var data;
                        if ($.isPlainObject(data_)) {
                            data = data_;
                        } else {
                            data = JSON.parse(data_);
                        }
                        if ($.isPlainObject(data) &&
                            $.isPlainObject(data.img1) && $.isPlainObject(data.img2) &&
                            $.isPlainObject(data.img1.size) && $.isPlainObject(data.img2.size) &&
                            Number.isFinite(data.img1.size.w) && Number.isFinite(data.img1.size.h) &&
                            Number.isFinite(data.img2.size.w) && Number.isFinite(data.img2.size.h) &&
                            data.img1.size.w > 0 && data.img1.size.h > 0 &&
                            data.img2.size.w > 0 && data.img2.size.h > 0 &&
                            $.isArray(data.img1.pts) && $.isArray(data.img2.pts) &&
                            data.img1.pts.length === data.img2.pts.length &&
                            data.img1.pts.length > 3) {
                            for (var i; i < data.img1.pts.length; i++) {
                                var pt1 = data.img1.pts[i];
                                var pt2 = data.img2.pts[i];
                                if ($.isPlainObject(pt1) && $.isPlainObject(pt2) &&
                                    Number.isFinite(pt1.x) && Number.isFinite(pt1.y) &&
                                    Number.isFinite(pt2.x) && Number.isFinite(pt2.y)) {
                                    //OK
                                } else {
                                    return false;
                                }
                            }
                            return data;
                        }
                    } catch(e) {
                        //有効なJSONでない
                    }
                    return false;
                }
                function getCornerPts(imgMat) {
                    var pts = [];
                    pts.push({ x: 0, y: 0 });
                    pts.push({ x: imgMat.cols, y: 0 });
                    pts.push({ x: imgMat.cols, y: imgMat.rows });
                    pts.push({ x: 0, y: imgMat.rows });
                    return pts;
                }
                var transMatrix;
                var corrPts_ = validateCorrespondingPointsInput(corrPts);
                if (corrPts_ || corrPts === 'corners') {
                    transMatrix = (function() {
                        var pts1 = []; //リサイズ座標系
                        var pts2 = []; //リサイズ座標系
                        if (corrPts_) {
                            //与えられた対応点情報を用いる
                            var size1 = corrPts_.img1.size;
                            var size2 = corrPts_.img2.size;
                            var pts1_ = corrPts_.img1.pts;
                            var pts2_ = corrPts_.img2.pts;
                            for (var i = 0; i < pts1_.length; i++) {
                                //リサイズ座標系
                                pts1.push({
                                    x: pts1_[i].x / size1.w * img1.cols,
                                    y: pts1_[i].y / size1.h * img1.rows,
                                });
                                pts2.push({
                                    x: pts2_[i].x / size2.w * img2.cols,
                                    y: pts2_[i].y / size2.h * img2.rows,
                                });
                            }
                        } else if (corrPts === 'corners') {
                            //各画像の四隅を対応点として用いる
                            //リサイズ座標系
                            pts1 = getCornerPts(img1);
                            pts2 = getCornerPts(img2);
                        }
                        var quad1 = cv.matFromArray(4, 1, cv.CV_32FC2,
                            [pts1[0].x, pts1[0].y, pts1[1].x, pts1[1].y, pts1[2].x, pts1[2].y, pts1[3].x, pts1[3].y]);
                        var quad2 = cv.matFromArray(4, 1, cv.CV_32FC2,
                            [pts2[0].x, pts2[0].y, pts2[1].x, pts2[1].y, pts2[2].x, pts2[2].y, pts2[3].x, pts2[3].y]);
                        if (!img1RoiFragment) {
                            //ROIが明示的に指定されていなければ、画像1の対応点列の外接矩形をROIとする
                            var boundingRect = cv.boundingRect(quad1); //リサイズ座標系
                            drect = getIntersectRect(img1.cols, img1.rows, boundingRect); //リサイズ座標系
                            if (drect.x === 0 && drect.y === 0 && drect.width === 0 & drect.height === 0) {
                                drect.width = img1.cols;
                                drect.height = img1.rows;
                            }
                        }
                        var perspectiveMatrix = cv.getPerspectiveTransform(quad2, quad1);
                        quad1.delete(); quad2.delete();
                        return perspectiveMatrix;
                    }());
                } else {
                    transMatrix = (function() {
                        //対応点を自動推定する
                        var instances_ = [];
                        var mask1 = new cv.Mat(); instances_.push(mask1);
                        var mask2 = new cv.Mat(); instances_.push(mask2);

                        var roi = new cv.Mat(drect.height, drect.width, cv.CV_8UC1, new cv.Scalar(255)); instances_.push(roi);
                        var transMat = cv.matFromArray(2, 3, cv.CV_64FC1, [1, 0, drect.x, 0, 1, drect.y]); instances_.push(transMat);
                        cv.warpAffine(roi, mask1, transMat, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT); //リサイズ座標系

                        var akaze = new cv.AKAZE(); instances_.push(akaze);
                        var kp1 = new cv.KeyPointVector(); instances_.push(kp1);
                        var kp2 = new cv.KeyPointVector(); instances_.push(kp2);
                        var descriptors1 = new cv.Mat(); instances_.push(descriptors1);
                        var descriptors2 = new cv.Mat(); instances_.push(descriptors2);
                        akaze.detectAndCompute(img1, mask1, kp1, descriptors1, false); //リサイズ座標系
                        akaze.detectAndCompute(img2, mask2, kp2, descriptors2, false); //リサイズ座標系

                        var matches = new cv.DMatchVectorVector(); instances_.push(matches);
                        var matcher = new cv.BFMatcher(cv.NORM_HAMMING); instances_.push(matcher);
                        matcher.knnMatch(descriptors1, descriptors2, matches, 2);

                        var RATIO_TEST_THRESHOLD = 0.5;
                        var matchPoint1 = [];
                        var matchPoint2 = [];
                        for (var i = 0; i < matches.size(); i++) {
                            var m = matches.get(i).get(0);
                            var n = matches.get(i).get(1);
                            if (m.distance < RATIO_TEST_THRESHOLD * n.distance) {
                                var kpt1 = kp1.get(m.queryIdx).pt;
                                var kpt2 = kp2.get(m.trainIdx).pt;
                                //リサイズ座標系
                                matchPoint1.push(kpt1.x);
                                matchPoint1.push(kpt1.y);
                                matchPoint2.push(kpt2.x);
                                matchPoint2.push(kpt2.y);
                            }
                        }

                        var srcPoints = cv.matFromArray(matchPoint1.length / 2, 1, cv.CV_32FC2, matchPoint1); instances_.push(srcPoints);
                        var dstPoints = cv.matFromArray(matchPoint2.length / 2, 1, cv.CV_32FC2, matchPoint2); instances_.push(dstPoints);
                        var homographyMatrix; //リサイズ座標系
                        if (matchPoint1.length / 2 >= 4 && matchPoint2.length / 2 >= 4) {
                            homographyMatrix = cv.findHomography(dstPoints, srcPoints, cv.RANSAC, 3.0);
                        } else {
                            //各画像の四隅を対応点として用いる
                            //リサイズ座標系
                            var pts1 = getCornerPts(img1);
                            var pts2 = getCornerPts(img2);
                            var quad1 = cv.matFromArray(4, 1, cv.CV_32FC2,
                                [pts1[0].x, pts1[0].y, pts1[1].x, pts1[1].y, pts1[2].x, pts1[2].y, pts1[3].x, pts1[3].y]);
                            var quad2 = cv.matFromArray(4, 1, cv.CV_32FC2,
                                [pts2[0].x, pts2[0].y, pts2[1].x, pts2[1].y, pts2[2].x, pts2[2].y, pts2[3].x, pts2[3].y]);
                            homographyMatrix = cv.getPerspectiveTransform(quad2, quad1);
                            quad1.delete(); quad2.delete();
                        }
                        instances_.forEach(function(m) { m.delete(); });
                        return homographyMatrix;
                    }());
                }
                var img2Flat = new cv.Mat(img2.rows, img2.cols, cv.CV_8UC1, new cv.Scalar(255)); //img2と同じ大きさ
                cv.warpPerspective(img2, img2Warped, transMatrix, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT); //img1の大きさに合わせる
                cv.warpPerspective(img2Flat, img2WarpedMask, transMatrix, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT); //img1の大きさに合わせる
                transMatrix.delete(); img2Flat.delete();
            }());

            //unsharp処理
            var img2WarpedUnsharped = new cv.Mat(); instances.push(img2WarpedUnsharped);
            var work1 = new cv.Mat(); instances.push(work1);
            cv.GaussianBlur(img2Warped, work1, new cv.Size(3, 3), 1);
            cv.addWeighted(img2Warped, 1.5, work1, -0.5, 0, img2WarpedUnsharped);

            //Side-by-Side画像
            var imgSideBySide = new cv.Mat(); instances.push(imgSideBySide);
            var sideBySideImages = new cv.MatVector(); instances.push(sideBySideImages);
            if (showImg1onRightSide) {
                sideBySideImages.push_back(img2WarpedUnsharped);
                sideBySideImages.push_back(img1);
            } else {
                sideBySideImages.push_back(img1);
                sideBySideImages.push_back(img2WarpedUnsharped);
            }
            cv.hconcat(sideBySideImages, imgSideBySide);
            //並列表示出力
            cv.imshow($canvasSideBySide[0].id, imgSideBySide);

            //jQuery Images Compareコンテナ内に表示（元のimg表示と差し替え）
            //before側
            if (showImg1onRightSide) {
                $(containerId + ' .images-compare-before').prepend($canvasNormal2);
                cv.imshow($canvasNormal2[0].id, img2WarpedUnsharped);
            } else {
                $(containerId + ' .images-compare-before').prepend($canvasNormal1);
                cv.imshow($canvasNormal1[0].id, img1);
            }
            $img1.off('load'); //jQuery Images Compare内で再初期化が発生することを防ぐ
            $img1.prependTo(containerId + ' .images-compare-before'); //元の位置に戻す
            $img1Wrapper.remove();
            $(containerId + ' .images-compare-before > img').hide();
            //after側
            if (showImg1onRightSide) {
                $(containerId + ' .images-compare-after').prepend($canvasNormal1);
                cv.imshow($canvasNormal1[0].id, img1);
            } else {
                $(containerId + ' .images-compare-after').prepend($canvasNormal2);
                cv.imshow($canvasNormal2[0].id, img2WarpedUnsharped);
            }
            $img1.clone().prependTo(containerId + ' .images-compare-after'); //intentionally
            $img2Wrapper.remove();
            $(containerId + ' .images-compare-after > img').hide();
            //beforeとafterに配置する<img>について
            //画像1を左右どちらに表示するにしても、射影変換の結果は画像1のサイズに合わせている。
            //一方、jQuery Images Compareでは、after側divの最初の<img>サイズを用いて、
            //各種divのサイズが自動設定されるため、画像1を左右どちらに表示する場合であっても、
            //非表示の「つっかえ棒」として、before側にも画像1をクローンした<img>を配置している。
            //表示上は、各種変換を行ったあとのCanvasが用いられ、<img>は非表示としているため、
            //before/after内の<img>が画像1または2のどちらあるかは表示内容には影響しない。

            if (isGlobalCompareMode) {
                //全体変化比較モード
                $legendMarkerL.addClass('legend-gray');
                $legendMarkerR.addClass('legend-gray');
                $legendContainer.show();

                cv.imshow($canvasDissolve1[0].id, img1);
                cv.imshow($canvasDissolve2[0].id, img2WarpedUnsharped);
                $canvasDissolve1.hide();
                $canvasDissolve2.hide();
                $sliderOpacity.on('input change', function() {
                    var opacity = parseFloat(this.value);
                    var inst = [];
                    var img1 = cv.imread($canvasDissolve1[0]); inst.push(img1);
                    var img2 = cv.imread($canvasDissolve2[0]); inst.push(img2);
                    var imgMerged = new cv.Mat(); inst.push(imgMerged);
                    cv.addWeighted(img1, 1 - opacity, img2, opacity, 0, imgMerged);
                    cv.imshow($canvasDissolved[0].id, imgMerged);
                    inst.forEach(function(m) { m.delete(); });
                });
                $sliderOpacity.val(0.5);
                $sliderOpacity.change();
            } else {
                //局所強調比較モード

                //----------
                //ハイライト画像の作成
                //---

                //二値化した入力画像を用いてノイズを削減するオプション
                var nrbi = true; //noise reduction using binarized input images
                if ('nrbi' in params__) {
                    nrbi = (params__.nrbi === '1' || params__.nrbi.toLowerCase() === 'true');
                }

                //半透明重ね合わせ
                var imgMerged = new cv.Mat(); instances.push(imgMerged);
                cv.addWeighted(img1, 0.5, img2WarpedUnsharped, 0.5, 0, work1); //同じサイズでなければならない
                cv.cvtColor(work1, imgMerged, cv.COLOR_RGB2RGBA, 0); //RGBA

                var work2 = new cv.Mat(); instances.push(work2);
                var work3 = new cv.Mat(); instances.push(work3);
                var work4 = new cv.Mat(); instances.push(work4);
                var work5 = new cv.Mat(); instances.push(work5);
                var work6 = new cv.Mat(); instances.push(work6);
                var work7 = new cv.Mat(); instances.push(work7);

                //グレイスケールに変換
                cv.cvtColor(img1,       work1, cv.COLOR_RGBA2GRAY, 0);
                cv.cvtColor(img2Warped, work2, cv.COLOR_RGBA2GRAY, 0);

                //二値化（入力画像は白地に黒文字を想定）
                cv.threshold(work1, work3, 0, 255, cv.THRESH_OTSU);
                cv.threshold(work2, work4, 0, 255, cv.THRESH_OTSU);
                if (nrbi) {
                    //マスクを作成（二値化入力画像の共通部分は黒、相違部分は白になる）
                    cv.bitwise_xor(work3, work4, work7);
                }
                if (work3.rows * work3.cols > 0 && work4.rows * work4.cols > 0) {
                    //二値化入力画像に基づき、入力画像と強調表示色の対応関係を推測
                    var WHITE_RATE_THRESHOLD = 0.5;
                    var whiteRate1 = cv.countNonZero(work3) / (work3.rows * work3.cols); //img1
                    var whiteRate2 = cv.countNonZero(work4) / (work4.rows * work4.cols); //img2
                    if (whiteRate1 >= WHITE_RATE_THRESHOLD && whiteRate2 >= WHITE_RATE_THRESHOLD) {
                        //どちらの画像も白地に黒文字であるとき、
                        //画像1にはあって画像2にはない文字部分が青 → 青は画像1
                        //画像2にはあって画像1にはない文字部分が赤 → 赤は画像2
                        if (showImg1onRightSide) {
                            $legendMarkerR.addClass('legend-blue'); //青は画像1（右側画像）
                            $legendMarkerL.addClass('legend-red');  //赤は画像2（左側画像）
                        } else {
                            $legendMarkerL.addClass('legend-blue'); //青は画像1（左側画像）
                            $legendMarkerR.addClass('legend-red');  //赤は画像2（右側画像）
                        }
                    } else if (whiteRate1 < WHITE_RATE_THRESHOLD && whiteRate2 < WHITE_RATE_THRESHOLD) {
                        //どちらの画像も黒地に白文字であるとき、
                        //画像1にはあって画像2にはない文字部分が赤 → 赤は画像1
                        //画像2にはあって画像1にはない文字部分が青 → 青は画像2
                        if (showImg1onRightSide) {
                            $legendMarkerR.addClass('legend-red');  //赤は画像1（右側画像）
                            $legendMarkerL.addClass('legend-blue'); //青は画像2（左側画像）
                        } else {
                            $legendMarkerL.addClass('legend-red');  //赤は画像1（左側画像）
                            $legendMarkerR.addClass('legend-blue'); //青は画像2（右側画像）
                        }
                    } else {
                        $legendMarkerL.addClass('legend-gray');
                        $legendMarkerR.addClass('legend-gray');
                    }
                    $legendContainer.show();
                }

                //差分（元画像の黒文字が白、白地が黒になった状態）
                cv.subtract(work1, work2, work3);
                cv.subtract(work2, work1, work4);
                cv.absdiff(work1, work2, work5);

                //ノイズ除去（メディアンフィルタ）
                cv.medianBlur(work3, work1, 3);
                cv.medianBlur(work4, work2, 3);
                cv.medianBlur(work5, work6, 3);

                //二値化
                cv.threshold(work1, work3, 0, 255, cv.THRESH_OTSU);
                cv.threshold(work2, work4, 0, 255, cv.THRESH_OTSU);
                cv.threshold(work6, work5, 0, 255, cv.THRESH_OTSU);

                if (nrbi) {
                    //二値化された入力画像で共通している部分はマスクする
                    cv.bitwise_and(work3, work7, work3);
                    cv.bitwise_and(work4, work7, work4);
                    cv.bitwise_and(work5, work7, work5);
                }

                //ROI矩形外部は黒で塗りつぶし
                var roiWork3 = work3.roi(drect); instances.push(roiWork3);
                var roiWork4 = work4.roi(drect); instances.push(roiWork4);
                var roiWork5 = work5.roi(drect); instances.push(roiWork5);
                var transMat = cv.matFromArray(2, 3, cv.CV_64FC1, [1, 0, drect.x, 0, 1, drect.y]); instances.push(transMat);
                cv.warpAffine(roiWork3, work1, transMat, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT);
                cv.warpAffine(roiWork4, work2, transMat, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT);
                cv.warpAffine(roiWork5, work6, transMat, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT);

                //img2を射影変換した外側の領域についてはマスクする
                cv.bitwise_and(work1, img2WarpedMask, work3);
                cv.bitwise_and(work2, img2WarpedMask, work4);
                cv.bitwise_and(work6, img2WarpedMask, work5);

                //ノイズ除去（メディアンフィルタ）
                cv.medianBlur(work3, work1, 3);
                cv.medianBlur(work4, work2, 3);
                cv.medianBlur(work5, work6, 3);

                //ノイズ除去（モルフォロジー変換）
                var ksize = 3;
                var iterations = 3;
                var kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(ksize, ksize)); instances.push(kernel);
                cv.morphologyEx(work1, work3, cv.MORPH_OPEN , kernel); //OPEN: 縮めて拡大（白点ノイズ除去）
                cv.dilate(work3, work1, kernel, new cv.Point(-1, -1), iterations);
                cv.morphologyEx(work2, work4, cv.MORPH_OPEN , kernel); //OPEN: 縮めて拡大（白点ノイズ除去）
                cv.dilate(work4, work2, kernel, new cv.Point(-1, -1), iterations);
                cv.morphologyEx(work6, work5, cv.MORPH_OPEN , kernel); //OPEN: 縮めて拡大（白点ノイズ除去）
                cv.dilate(work5, work6, kernel, new cv.Point(-1, -1), iterations);

                //感度を下げる
                cv.bitwise_and(work6, work1, work3);
                cv.bitwise_and(work6, work2, work4);

                //ガウスぼかしで広げる
                cv.GaussianBlur(work3, work1, new cv.Size(3, 3), 1);
                cv.GaussianBlur(work4, work2, new cv.Size(3, 3), 1);

                //差分ハイライトマスク
                var rgbaPlanes1 = new cv.MatVector(); instances.push(rgbaPlanes1);
                var rgbaPlanes2 = new cv.MatVector(); instances.push(rgbaPlanes2);
                var plane0 = new cv.Mat(img1.rows, img1.cols, cv.CV_8UC1, new cv.Scalar(0)); instances.push(plane0);
                rgbaPlanes1.push_back(work1);
                rgbaPlanes1.push_back(plane0);
                rgbaPlanes1.push_back(plane0);
                rgbaPlanes1.push_back(work1);
                cv.merge(rgbaPlanes1, work3); //RGBA
                rgbaPlanes2.push_back(plane0);
                rgbaPlanes2.push_back(plane0);
                rgbaPlanes2.push_back(work2);
                rgbaPlanes2.push_back(work2);
                cv.merge(rgbaPlanes2, work4); //RGBA
                cv.addWeighted(work3, 1, work4, 1, 0, work5); //RGBA

                //差分ハイライトオーバーレイ画像
                cv.add(img1,                 work3, work1); //RGBA
                cv.add(img2WarpedUnsharped,  work4, work2); //RGBA
                cv.addWeighted(imgMerged, 1, work5, 1, 0, work6); //RGBA

                if (showImg1onRightSide) {
                    $(containerId + ' .images-compare-before').prepend($canvasHighlighted2);
                    $(containerId + ' .images-compare-after').prepend($canvasHighlighted1);
                } else {
                    $(containerId + ' .images-compare-before').prepend($canvasHighlighted1);
                    $(containerId + ' .images-compare-after').prepend($canvasHighlighted2);
                }

                //左右表示出力
                cv.imshow($canvasHighlighted1[0].id, work1);
                cv.imshow($canvasHighlighted2[0].id, work2);
                //強調表示出力
                cv.imshow($canvasHighlighted[0].id, work6);

                //----------
                //赤青重ね合わせ画像の作成
                //---

                //いったんグレイスケールに変換してからRGBへ変換
                cv.cvtColor(img1,                work1, cv.COLOR_RGBA2GRAY, 0);
                cv.cvtColor(img2WarpedUnsharped, work2, cv.COLOR_RGBA2GRAY, 0);
                cv.cvtColor(work1, work3, cv.COLOR_GRAY2RGB, 0);
                cv.cvtColor(work2, work4, cv.COLOR_GRAY2RGB, 0);

                var flatBlue = new cv.Mat(img1.rows, img1.cols, cv.CV_8UC3, new cv.Scalar(0, 0, 255)); instances.push(flatBlue);
                var flatRed  = new cv.Mat(img1.rows, img1.cols, cv.CV_8UC3, new cv.Scalar(255, 0, 0)); instances.push(flatRed);
                cv.addWeighted(work3, 1, flatBlue, 1, 0, work1);
                cv.addWeighted(work4, 1, flatRed , 1, 0, work2);

                //赤青重ね合わせ
                cv.multiply(work1, work2, work3, 1/255); //RGB

                //赤青重ね合わせ画像（はめ込み）
                var imgAnaglyph = imgMerged.clone(); instances.push(imgAnaglyph);
                var roiWork1 = work3.roi(drect); instances.push(roiWork1);
                cv.cvtColor(roiWork1, work4, cv.COLOR_RGB2RGBA, 0);
                cv.warpAffine(work4, imgAnaglyph, transMat, dsize, cv.INTER_LINEAR, cv.BORDER_TRANSPARENT); //RGBA
                //赤青表示出力
                cv.imshow($canvasAnaglyph[0].id, imgAnaglyph);

                //-----
                //左右表示におけるマウス周囲の強調パススルー表示
                $imagesCompareContainer.prepend($canvasOverlay);
                cv.imshow($canvasOverlay[0].id, imgMerged); //clearRectで消してしまうのでimg1サイズなら何でも良い
                var canvasNormal1 = document.getElementById($canvasNormal1[0].id);
                var canvasNormal2 = document.getElementById($canvasNormal2[0].id);
                var canvasOverlay = document.getElementById($canvasOverlay[0].id);
                var contextOverlay = canvasOverlay.getContext('2d'); //リサイズ座標系
                contextOverlay.clearRect(0, 0, canvasOverlay.width, canvasOverlay.height);
                canvasOverlay.addEventListener('mousemove', function(evt) {
                    if ($checkboxHighlight && $checkboxHighlight.prop('checked')) {
                        var ratio = (dispRatio > 0) ? dispRatio : 1;
                        var canvasRect = canvasOverlay.getBoundingClientRect();
                        var X_OFFSET = -10 * ratio;
                        var Y_OFFSET = -10 * ratio;
                        var x = evt.clientX - canvasRect.left + X_OFFSET; //表示座標系
                        var y = evt.clientY - canvasRect.top + Y_OFFSET;  //表示座標系
                        var r = 25 * ratio;
                        contextOverlay.clearRect(0, 0, canvasOverlay.width, canvasOverlay.height);
                        if (x + r < drect.x * ratio || x - r > (drect.x + drect.width) * ratio ||
                            y + r < drect.y * ratio || y - r > (drect.y + drect.height) * ratio) {
                            //表示座標系同士にして比較
                            //ROI範囲外
                        } else {
                            //表示座標系 → リサイズ座標系
                            var sliderPos = imagesCompare.getValue() * canvasRect.width;
                            var srcCanvas;
                            if (showImg1onRightSide) {
                                srcCanvas = (x < sliderPos) ? canvasNormal2 : canvasNormal1;
                            } else {
                                srcCanvas = (x < sliderPos) ? canvasNormal1 : canvasNormal2;
                            }
                            contextOverlay.save();
                            contextOverlay.beginPath();
                            contextOverlay.arc(x / ratio, y / ratio, r / ratio, 0, Math.PI * 2, true);
                            contextOverlay.closePath();
                            contextOverlay.strokeStyle = 'rgba(128, 128, 128, 128)';
                            contextOverlay.stroke();
                            contextOverlay.clip();
                            contextOverlay.drawImage(srcCanvas,
                                (x - r) / ratio, (y - r) / ratio, r * 2 / ratio, r * 2 / ratio,
                                (x - r) / ratio, (y - r) / ratio, r * 2 / ratio, r * 2 / ratio);
                            contextOverlay.restore();
                        }
                    }
                });
                canvasOverlay.addEventListener('mouseleave', function() {
                    contextOverlay.clearRect(0, 0, canvasOverlay.width, canvasOverlay.height);
                });
            }

            // アノテーションの当たり判定
            // x, y: 表示座標系
            function checkAnnotationHit(x, y, ratio, $contents, allowHtml) {
                var hit = false;
                if (annotations && !enableAnnotator) {
                    $contents.empty();
                    for (var i = 0; i < annotations.length; i++) {
                        var annot = annotations[i];
                        if ($.isPlainObject(annot) && $.isArray(annot.body) && $.isPlainObject(annot.target) &&
                            $.isPlainObject(annot.target.selector) && annot.target.selector.value) {
                            var annotOn = String(annot.target.selector.value).replace(/^xywh=/i, '');
                            var annotRect = getRectFromFragment(annotOn);
                            if (img1SizeLimit.ratio < 1 && rectRoi.xywhUnit !== 'percent') {
                                //'max-size'設定により、img1が縮小されている場合、アノテーション対象領域指定に縮小率を反映させる
                                //フルサイズ座標系 → リサイズ座標系
                                annotRect.x *= img1SizeLimit.ratio;
                                annotRect.y *= img1SizeLimit.ratio;
                                annotRect.width *= img1SizeLimit.ratio;
                                annotRect.height *= img1SizeLimit.ratio;
                            }
                            annotRect = getIntersectRect(dsize.width, dsize.height, annotRect, annotRect.xywhUnit);
                            if (annotRect.x === 0 && annotRect.y === 0 && annotRect.width === 0 & annotRect.height === 0) {
                                annotRect.width = img1.cols;
                                annotRect.height = img1.rows;
                            }
                            if (x < annotRect.x * ratio || x > (annotRect.x + annotRect.width) * ratio ||
                                y < annotRect.y * ratio || y > (annotRect.y + annotRect.height) * ratio) {
                                //表示座標系同士にして比較
                                //範囲外
                            } else {
                                //表示座標系 → リサイズ座標系
                                hit = true;
                                if ($.isArray(annot.body)) {
                                    for (var j = 0; j < annot.body.length; j++) {
                                        var body_ = annot.body[j];
                                        if ($.isPlainObject(body_)) {
                                            if (body_.value) {
                                                var $annotLable;
                                                if (allowHtml) {
                                                    $annotLable = $('<div>').html(body_.value);
                                                } else {
                                                    var doc = new DOMParser().parseFromString(body_.value, 'text/html');
                                                    $annotLable = $('<div>').text(doc.body.textContent);
                                                }
                                                $contents.append($annotLable);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                return hit;
            }
            // アノテーション表示
            if (annotations && !enableAnnotator) {
                // アノテーションのマーカー
                cv.imshow($canvasAnnotations[0].id, img1); //clearRectで消してしまうのでimg1サイズなら何でも良い
                var canvasAnnotations = document.getElementById($canvasAnnotations[0].id);
                var contextAnnotations = canvasAnnotations.getContext('2d'); //リサイズ座標系
                contextAnnotations.clearRect(0, 0, canvasAnnotations.width, canvasAnnotations.height);
                for (i = 0; i < annotations.length; i++) {
                    var annot = annotations[i];
                    if ($.isPlainObject(annot) && $.isArray(annot.body) && $.isPlainObject(annot.target) &&
                        $.isPlainObject(annot.target.selector) && annot.target.selector.value) {
                        var annotOn = String(annot.target.selector.value).replace(/^xywh=/i, '');
                        var annotRect = getRectFromFragment(annotOn);
                        if (img1SizeLimit.ratio < 1 && rectRoi.xywhUnit !== 'percent') {
                            //'max-size'設定により、img1が縮小されている場合、アノテーション対象領域指定に縮小率を反映させる
                            //フルサイズ座標系 → リサイズ座標系
                            annotRect.x *= img1SizeLimit.ratio;
                            annotRect.y *= img1SizeLimit.ratio;
                            annotRect.width *= img1SizeLimit.ratio;
                            annotRect.height *= img1SizeLimit.ratio;
                        }
                        annotRect = getIntersectRect(img1.cols, img1.rows, annotRect, annotRect.xywhUnit);
                        if (annotRect.x === 0 && annotRect.y === 0 && annotRect.width === 0 & annotRect.height === 0) {
                            annotRect.width = img1.cols;
                            annotRect.height = img1.rows;
                        }
                        contextAnnotations.strokeStyle = '#00BFFF';
                        contextAnnotations.save();
                        contextAnnotations.beginPath();
                        contextAnnotations.strokeRect(annotRect.x, annotRect.y, annotRect.width, annotRect.height);
                        contextAnnotations.restore();
                    }
                }
                // アノテーションのツールチップ
                var $annotationTooltip = $('<div>').addClass('annotation-tooltip').hide();
                $imagesCompareContainer.after($annotationTooltip);
                canvasAnnotations.addEventListener('mousemove', function(evt) {
                    var ratio = (dispRatio > 0) ? dispRatio : 1;
                    var canvasRect = canvasAnnotations.getBoundingClientRect();
                    var X_OFFSET = 0 * ratio;
                    var Y_OFFSET = 0 * ratio;
                    var X_OFFSET_DISP = 15;
                    var Y_OFFSET_DSIP = 15;
                    var x = evt.clientX - canvasRect.left + X_OFFSET; //表示座標系
                    var y = evt.clientY - canvasRect.top + Y_OFFSET;  //表示座標系
                    var hit = checkAnnotationHit(x, y, ratio, $annotationTooltip, false);
                    if (hit) {
                        var canvasAnnotationsOffest = $canvasAnnotations.offset(); //getBoundingClientRect()とは原点が異なる
                        $annotationTooltip.css({
                            left: x + canvasAnnotationsOffest.left + X_OFFSET_DISP,
                            top: y + canvasAnnotationsOffest.top + Y_OFFSET_DSIP
                        });
                        $annotationTooltip.show();
                    } else {
                        $annotationTooltip.hide();
                    }
                });
                canvasAnnotations.addEventListener('mouseleave', function() {
                    $annotationTooltip.hide();
                });
                //アノテーションのポップアップ
                canvasAnnotations.addEventListener('click', function(evt) {
                    var ratio = (dispRatio > 0) ? dispRatio : 1;
                    var canvasRect = canvasAnnotations.getBoundingClientRect();
                    var x = evt.clientX - canvasRect.left; //表示座標系
                    var y = evt.clientY - canvasRect.top;  //表示座標系
                    var $annotationContents = $('<div>');
                    $annotationPopupContainer.empty();
                    var hit = checkAnnotationHit(x, y, ratio, $annotationContents, true);
                    if (hit) {
                        var $wrapper = $('<div>').addClass('leaflet-popup-content-wrapper');
                        var $content = $('<div>').addClass('leaflet-popup-content');
                        $wrapper.append($content);
                        $annotationPopupContainer.append($wrapper);

                        var $tipContainer = $('<div>').addClass('leaflet-popup-tip-container');
                        var $tip = $('<div>').addClass('leaflet-popup-tip');
                        $tipContainer.append($tip);
                        $annotationPopupContainer.append($tipContainer);

                        var $closeButton = $('<a>').addClass('leaflet-popup-close-button')
                            .attr({'role': 'button', 'aria-label': 'Close popup', 'href': '#close'})
                            .html('<span aria-hidden="true">&#215;</span>');
                        $annotationPopupContainer.append($closeButton);
                        $closeButton.on('click', function (ev) {
                            ev.preventDefault();
                            $annotationPopupContainer.hide();
                        });

                        $content.append($annotationContents);
                        $annotationPopupContainer.show();

                        var canvasAnnotationsOffest = $canvasAnnotations.offset(); //getBoundingClientRect()とは原点が異なる
                        $annotationPopupContainer.css({
                            left: x + canvasAnnotationsOffest.left - $annotationPopupContainer.outerWidth(true) / 2,
                            top: y + canvasAnnotationsOffest.top - $annotationPopupContainer.outerHeight(true)
                        });
                    } else {
                        $annotationPopupContainer.hide();
                    }
                });
            }
            var anno;
            if (enableAnnotator) {
                cv.imshow($canvasAnnotations[0].id, img1); //clearRectで消してしまうのでimg1サイズなら何でも良い
                var canvasAnnotations_ = document.getElementById($canvasAnnotations[0].id);
                var contextAnnotations_ = canvasAnnotations_.getContext('2d'); //リサイズ座標系
                contextAnnotations_.clearRect(0, 0, canvasAnnotations_.width, canvasAnnotations_.height);
                anno = Annotorious.init({
                    image: $canvasAnnotations.attr('id'),
                    fragmentUnit: (dispRatio < 1) ? 'percent' : 'pixel', //縮小表示されているときは比率で記録、それ以外はピクセル単位で
                    locale: lng
                });
                //Annotoriousによって、$canvasAnnotationsをwrapするdivが追加される
                $canvasAnnotations.parent().addClass('annotation-annotorious-container').css({ position: 'absolute', width: dispW, height: dispH });
                if (annotations) {
                    anno.setAnnotations(annotations);
                }
                $saveAnnotationsLink.on('click', function() {
                    var annots = getAnnotations();
                    if (window.console) {
                        console.log(JSON.stringify(annots)); // eslint-disable-line no-console
                    }
                });
            }
            function updateAnnotationsData() {
                if (anno) {
                    annotations = anno.getAnnotations();
                }
                return annotations;
            }
            function getAnnotations() {
                return updateAnnotationsData();
            }
            function getExportData() {
                var data = params_ || {};
                var annots = getAnnotations();
                if (annots !== null) {
                    data.annotations = annots;
                }
                return data;
            }

            if (dispSizeCss) {
                $(containerId + ' canvas').css(dispSizeCss);
                //並列表示は例外（横幅を2倍にする）
                $canvasSideBySide.css({
                    width: dispSizeCss.width * 2,
                    height: dispSizeCss.height,
                    'max-width': dispSizeCss['max-width'] * 2,
                    'max-height': dispSizeCss['max-height']
                });
            }

            //--- OpenCVの後始末
            instances.forEach(function(m) { m.delete(); });

            //-----
            //--- 比較手法ごとの表示の切り替え
            $compareMethodsSelecterContainer.show();
            var imagesCompareRatio = 0.5;
            $(radioSelecter).change(function() {
                var val = parseInt($(this).val(), 10);

                //jQuery UIのデザイン調整
                $('.compare-methods-selecter-container > label').css({ 'z-index': 'auto' });
                $('.compare-methods-selecter-container > label:nth-of-type(' + (val + 1) + ')').css({ 'z-index': 1000 });

                var elems;
                var elemsSub;
                if (isGlobalCompareMode) {
                    elems    = [$imagesCompareContainer, $dissolveContainer, $canvasSideBySide];
                    elemsSub = [null, $compareMethodsAdditionalSettingContainer, null];
                } else {
                    elems    = [$imagesCompareContainer, $canvasHighlighted, $canvasAnaglyph, $canvasSideBySide];
                    elemsSub = [$compareMethodsAdditionalSettingContainer, null, null, null];
                }
                $.each(elems, function(index) {
                    if (index === val) {
                        $.each(this, function() { $(this).show(); });
                    } else {
                        $.each(this, function() { $(this).hide(); });
                    }
                });
                $.each(elemsSub, function(index) {
                    if (index === val) {
                        $.each(this, function() { $(this).css({ visibility: 'visible' }); });
                    } else {
                        $.each(this, function() { $(this).css({ visibility: 'hidden' }); });
                    }
                });
                var isJuxtaposeSelected = (val === 0);
                if (isJuxtaposeSelected) {
                    $imagesCompareContainer.off('imagesCompare:resized.vdiffjs');
                    $imagesCompareContainer.on('imagesCompare:resized.vdiffjs', function() {
                        //jQuery Images Compareにより、after側divの最初の<img>サイズ（width, height, 
                        //naturalWidth, naturalHeight）を用いて、各種divのサイズが自動設定されるので、
                        //自前で表示座標系のサイズにセットし直す
                        $(containerId + ' .images-compare-container').css({ width: dispW, height: dispH, 'max-width': dispW, 'max-height': dispH });
                        $(containerId + ' .images-compare-after').css({ width: dispW, height: dispH });
                        $(containerId + ' .images-compare-before').css({ width: dispW, height: dispH });
                        imagesCompareRatio = imagesCompare.getValue();
                        imagesCompare.setValue(imagesCompareRatio); //サイズ変更によりスライダ位置がズレるので修正
                    });
                    $(window).trigger('resize'); //コンテナをshowしてからでないとスライダが左端に張りつくので注意

                    $imagesCompareContainer.off('imagesCompare:changed.vdiffjs');
                    $imagesCompareContainer.on('imagesCompare:changed.vdiffjs', function(event) {
                        updateLegendVisibilty(true, event.ratio);
                    });
                    updateLegendVisibilty(true, imagesCompare.getValue());
                } else {
                    updateLegendVisibilty(false);
                }
                var isSidebySide = (isGlobalCompareMode && val === 2) || (!isGlobalCompareMode && val === 3);
                if (isSidebySide) {
                    $(containerId).css({ width: dispW * 2 });
                } else {
                    $(containerId).css({ width: dispW });
                }

                if ($toggleAnnotation) {
                    $toggleAnnotation.change();
                    if (isJuxtaposeSelected || isSidebySide) {
                        $toggleAnnotation.checkboxradio('disable');
                    } else {
                        $toggleAnnotation.checkboxradio('enable');
                    }
                }

                $canvasToSave = null;
                var saveTargets;
                if (isGlobalCompareMode) {
                    saveTargets = [$canvasNormal2, $canvasDissolved, $canvasSideBySide];
                } else {
                    saveTargets = [$canvasNormal2, $canvasHighlighted, $canvasAnaglyph, $canvasSideBySide];
                }
                $.each(saveTargets, function(index) {
                    if (index === val) {
                        $canvasToSave = this;
                    }
                });
                if ($canvasToSave) {
                    $saveImageLink.attr('disabled', false).removeClass('ui-state-disabled');
                } else {
                    $saveImageLink.attr('disabled', true).addClass('ui-state-disabled');
                }
            });
            function updateRadio(val) {
                $(radioSelecter).val([val]);
                $(radioSelecter + ':checked').change();
            }
            updateRadio(radioInitVal);
            if ($checkboxHighlight) {
                $checkboxHighlight.change(function() {
                    if ($checkboxHighlight.prop('checked')) {
                        $canvasNormal1.hide();
                        $canvasNormal2.hide();
                        $canvasHighlighted1.show();
                        $canvasHighlighted2.show();
                    } else {
                        $canvasNormal1.show();
                        $canvasNormal2.show();
                        $canvasHighlighted1.hide();
                        $canvasHighlighted2.hide();
                    }
                });
                $checkboxHighlight.change();
            }

            //--- 各種ボタン
            //--- アノテーション表示トグル
            if ($toggleAnnotation) {
                $toggleAnnotation.change(function() {
                    var checked = $(this).prop('checked');
                    var val = parseInt($(radioSelecter + ':checked').val(), 10);
                    var isJuxtaposeSelected = (val === 0);
                    var isSidebySide = (isGlobalCompareMode && val === 2) || (!isGlobalCompareMode && val === 3);
                    if (annotations) {
                        if (isJuxtaposeSelected || isSidebySide) {
                            $canvasAnnotations.hide();
                            $annotationPopupContainer.hide();
                        } else {
                            if (checked) {
                                $canvasAnnotations.show();
                            } else {
                                $canvasAnnotations.hide();
                            }
                        }
                    }
                    if (enableAnnotator) {
                        //Annotoriousによって、$canvasAnnotationsをwrapするdivが追加されている
                        if (isJuxtaposeSelected || isSidebySide) {
                            $canvasAnnotations.hide();
                            $canvasAnnotations.parent().hide();
                        } else {
                            if (checked) {
                                $canvasAnnotations.show();
                                $canvasAnnotations.parent().show();
                            } else {
                                $canvasAnnotations.hide();
                                $canvasAnnotations.parent().hide();
                            }
                        }
                    }
                });
                $toggleAnnotation.change();
            }
            //--- 画像を保存
            $saveImageLink.on('click', function() {
                if ($canvasToSave) {
                    //IEは考慮しなくて良い
                    var filename = 'vdiffjs_' + (parseInt($(radioSelecter + ':checked').val(), 10) + 1) + '.png';
                    var anchorElem = document.createElement('a');
                    anchorElem.href = $canvasToSave[0].toDataURL('image/png');
                    anchorElem.download = filename;
                    document.body.appendChild(anchorElem);
                    anchorElem.click();
                    document.body.removeChild(anchorElem);
                }
            });
            $buttonsContainer.show();

            //--- コンテキストメニュー
            var bindings = {};
            function updateRadios(i) {
                return function() {
                    updateRadio(i);
                };
            }
            for (var i = 0; i < radioButtonsNum; i++) {
                bindings[radioLabels[i]] = updateRadios(i);
            }
            var contextmenuTargets;
            if (isGlobalCompareMode) {
                contextmenuTargets = [$imagesCompareContainer, $dissolveContainer, $canvasSideBySide];
            } else {
                contextmenuTargets = [$imagesCompareContainer, $canvasHighlighted, $canvasAnaglyph, $canvasSideBySide];
            }
            if (annotations) {
                contextmenuTargets.push($canvasAnnotations);
            }
            contextmenuTargets.forEach(function(el) { el.haloContext({ bindings: bindings }); });

            //正常完了
            if ($.isFunction(config.doneCallback)) {
                config.doneCallback();
            }
            if ($.isFunction(config.alwaysCallback)) {
                config.alwaysCallback();
            }

            return {
                getParameters: getExportData
            };
        }
        var exportFunctions;
        //比較画像の取得後に処理
        function waitForLoading(index, img) {
            var d = $.Deferred();
            if (img.complete) {
                d.resolve();
            } else {
                $(img).on('load', function() { d.resolve(); });
                $(img).on('error', function() { d.reject(); });
            }
            return d;
        }
        $.when.apply($, $(containerId + ' img').map(waitForLoading))
            .done(function() {
                exportFunctions = showComparedImagesCore();
            })
            .fail(function() {
                showError((lng !== 'ja') ? 'Image could not be loaded.' : '画像を読み込めませんでした。');
            });

        return {
            getParameters: function() {
                return (exportFunctions) ? exportFunctions.getParameters() : {};
            }
        };
    }
    function init() {
        var params = {};
        if ($.isPlainObject(config)) {
            if ($.isPlainObject(config.data)) {
                params = config.data;
            } else {
                params = getParams(location.search) || {};
            }
        } else {
            config = {};
        }
        if (config.id) {
            if (params.img1 && params.img2) {
                viewer = showComparedImages(config, params);
            } else {
                showError((lng !== 'ja') ? 'Specify the images to compare.' : '比較する画像を指定してください。');
            }
        } else {
            showError((lng !== 'ja') ? 'Specify where to display.' : '表示先を指定してください。');
        }
    }

    if (typeof cv !== 'undefined' && cv.runtimeInitialized) {
        init();
    } else {
        $(window).on('opencvRuntimeInitialized', init);
    }

    var viewer;
    return {
        getParameters: function() {
            return (viewer) ? viewer.getParameters() : {};
        }
    };
};