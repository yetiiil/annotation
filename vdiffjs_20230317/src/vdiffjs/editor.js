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
var VDiffEditor = function(config) {
    'use strict';

    var $ = window.$;

    var APP_NAME = 'vdiff.js editor';
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
        var viewerUrl = config__.viewerUrl;
        var layout = config__.layout; //'horizontal'/'vertical'

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

        $(containerId).addClass('vdiffjs-editor-container');

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
        var $imagesContainer = $('<div>').append($img1).append($img2);
        $(containerId).append($imagesContainer);
        $imagesContainer.hide();

        //キャンバスなど
        var containerId_ = containerId.slice(1) + '-';
        var canvasPrefix = containerId_ + 'canvas';
        var $canvasDissolve = $('<canvas>').attr({ id: canvasPrefix + '_dissolve' }).addClass('preview-dissolve');
        //プレビュー
        var $previewHeaderLink = $('<span>').addClass('preview-header-link').attr({ id: containerId_ + 'link' });
        var $previewHeader = $('<div>').addClass('preview-header').text((lng !== 'ja') ? 'Preview' : 'プレビュー').append($previewHeaderLink);
        var $previewContainer = $('<div>').addClass('preview-container').append($previewHeader).append($canvasDissolve);
        if (layout === 'horizontal') {
            $(containerId).addClass('horizontal');
            $previewContainer.resizable({ handles: 'e' });
        }

        //対応点の編集
        var $editHeader = $('<div>').addClass('edit-header').text((lng !== 'ja') ? 'Edit the corresponding points (drag the red circle or move it by arrow keys)' : '対応点を修正（赤丸をドラッグまたは矢印キーで移動）');
        var $leaflet1 = $('<div>').attr({ id: containerId_ + 'leaflet1' }).addClass('edit-leaflet');
        var $leaflet2 = $('<div>').attr({ id: containerId_ + 'leaflet2' }).addClass('edit-leaflet');
        var $leafletsRow = $('<tr>');
        if (showImg1onRightSide) {
            $leafletsRow
                .append($('<td>').addClass('edit-leaflet-left').append($leaflet2))
                .append($('<td>').addClass('edit-leaflet-right').append($leaflet1));
        } else {
            $leafletsRow
                .append($('<td>').addClass('edit-leaflet-left').append($leaflet1))
                .append($('<td>').addClass('edit-leaflet-right').append($leaflet2));
        }
        var $legendRow = $('<tr>').addClass('edit-legend');
        var $legendLabelL = $('<div>').addClass('edit-legend-left-label');
        var $legendLabelR = $('<div>').addClass('edit-legend-right-label');
        if (showImg1onRightSide) {
            $legendLabelL.text(img2Label ? img2Label : ((lng !== 'ja') ? 'Image 2' : '画像2'));
            $legendLabelR.text(img1Label ? img1Label : ((lng !== 'ja') ? 'Image 1' : '画像1'));
        } else {
            $legendLabelL.text(img1Label ? img1Label : ((lng !== 'ja') ? 'Image 1' : '画像1'));
            $legendLabelR.text(img2Label ? img2Label : ((lng !== 'ja') ? 'Image 2' : '画像2'));
        }
        $legendRow
            .append($('<td>').addClass('edit-legend-left').append($legendLabelL))
            .append($('<td>').addClass('edit-legend-right').append($legendLabelR));
        var $editLeafletContainer = $('<table>').addClass('edit-leaflet-container').append($leafletsRow).append($legendRow);

        //各種ボタン
        //左ブロック
        var $editCorrPtsSave = $('<button>').attr({ id: containerId_ + 'save_param', type: 'button' }).addClass('ui-button ui-widget ui-corner-all').attr({ title: (lng !== 'ja') ? 'Save the corresponding points' : '対応点を保存' }).html($('<i>').addClass('fas fa-save'));
        var $editCorrPtsDetele = $('<button>').attr({ id: containerId_ + 'delete_param', type: 'button' }).addClass('ui-button ui-widget ui-corner-all edit-buttons-delete-param').attr({ title: (lng !== 'ja') ? 'Delete the corresponding points' : '対応点を削除' }).html($('<i>').addClass('fas fa-trash-alt'));
        var $editCorrPtsCorners = $('<button>').attr({ id: containerId_ + 'corr_pts_corners', type: 'button' }).addClass('ui-button ui-widget ui-corner-all').attr({ title: (lng !== 'ja') ? 'Set the corners as the corresponding points' : '対応点を四隅に設定' }).html($('<i>').addClass('fas fa-vector-square'));
        var $editCorrPtsAuto = $('<button>').attr({ id: containerId_ + 'corr_pts_auto', type: 'button' }).addClass('ui-button ui-widget ui-corner-all').attr({ title: (lng !== 'ja') ? 'Estimate the correspondence points' : '対応点を自動推定' }).html($('<i>').addClass('fas fa-magic'));
        var $buttonsLeftBlock = $('<div>').addClass('left-block');
        if (config__.showSaveParametersButton) {
            $buttonsLeftBlock.append($editCorrPtsSave);
        }
        $buttonsLeftBlock.append($editCorrPtsCorners).append($editCorrPtsAuto);
        if (config__.showDeleteParametersButton) {
            $buttonsLeftBlock.append($editCorrPtsDetele);
        }
        //右ブロック
        var $toggleLayout = $('<button>').attr({ id: containerId_ + 'toggle_layout', type: 'button' }).addClass('ui-button ui-widget ui-corner-all').attr({ title: (lng !== 'ja') ? 'Toggle layout' : '縦横レイアウト切り替え' }).html($('<i>').addClass('fas fa-retweet'));
        var $helpLink = $('<a>').addClass('ui-button ui-widget ui-corner-all').attr({ title: (lng !== 'ja') ? 'Help about vdiff.js editor' : 'vdiff.js editorヘルプ', href: 'http://codh.rois.ac.jp/software/vdiffjs/editor.html', target: '_blank' }).html($('<i>').addClass('fas fa-question'));
        var $buttonsRightBlock = $('<div>').addClass('right-block').append($toggleLayout).append($helpLink);
        //
        var $editButtonsContainer = $('<div>').addClass('edit-buttons-container clearfix').append($buttonsLeftBlock).append($buttonsRightBlock).hide();

        var $editContainer = $('<div>').addClass('edit-container').append($editHeader).append($editLeafletContainer).append($editButtonsContainer);

        $(containerId).append($previewContainer).append($editContainer);

        function showComparedImagesCore() {
            var instances = [];

            //画像サイズの関係：
            //フルサイズ（オリジナル）座標系 →（'max-size'設定）→ リサイズ（読み込みサイズ）座標系

            //画像サイズ制限（'max-size'設定）
            var MAX_SIZE_DEFAULT = 500; //px
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
            $imagesContainer.remove();
            //cv.imreadは画像の表示サイズに左右される（ただし、読み込み画像が非表示状態のときは、naturalWidth, naturalHeightサイズとなる）
            var img1 = cv.imread($img1[0]); instances.push(img1); //リサイズ座標系
            var img2 = cv.imread($img2[0]); instances.push(img2); //リサイズ座標系
            $img1Wrapper.hide();
            $img2Wrapper.hide();

            //updateDissolve()用にリサイズ状態の画像を持っておく
            var $canvasResized1 = $('<canvas>').attr({ id: canvasPrefix + '_1_resized' });
            var $canvasResized2 = $('<canvas>').attr({ id: canvasPrefix + '_2_resized' });
            var $resizedImagesContainer = $('<div>').append($canvasResized1).append($canvasResized2);
            $(containerId).append($resizedImagesContainer);
            cv.imshow($canvasResized1[0].id, img1);
            cv.imshow($canvasResized2[0].id, img2);
            $resizedImagesContainer.hide();

            //フルサイズ座標系
            var img1SizeNatural = {
                width:  $img1[0].width,
                height: $img1[0].height
            };
            var img2SizeNatural = {
                width:  $img2[0].width,
                height: $img2[0].height
            };
            $img1Wrapper.remove();
            $img2Wrapper.remove();

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

            //--- 対応点ペアを求める
            var img1Points = []; //フルサイズ座標系
            var img2Points = []; //フルサイズ座標系
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
                function getCornerPts(size) {
                    var pts = [];
                    pts.push({ x: 0, y: 0 });
                    pts.push({ x: size.width, y: 0 });
                    pts.push({ x: size.width, y: size.height });
                    pts.push({ x: 0, y: size.height });
                    return pts;
                }
                var corrPts_ = validateCorrespondingPointsInput(corrPts);
                if (corrPts_ || corrPts === 'corners') {
                    (function() {
                        if (corrPts_) {
                            //与えられた対応点情報を用いる
                            var size1 = corrPts_.img1.size;
                            var size2 = corrPts_.img2.size;
                            var pts1_ = corrPts_.img1.pts;
                            var pts2_ = corrPts_.img2.pts;
                            img1Points = [];
                            img2Points = [];
                            for (var i = 0; i < pts1_.length; i++) {
                                //フルサイズ座標系
                                img1Points.push({
                                    x: pts1_[i].x / size1.w * img1SizeNatural.width,
                                    y: pts1_[i].y / size1.h * img1SizeNatural.height,
                                });
                                img2Points.push({
                                    x: pts2_[i].x / size2.w * img2SizeNatural.width,
                                    y: pts2_[i].y / size2.h * img2SizeNatural.height,
                                });
                            }
                        } else if (corrPts === 'corners') {
                            //各画像の四隅を対応点として用いる
                            //フルサイズ座標系
                            img1Points = getCornerPts(img1SizeNatural);
                            img2Points = getCornerPts(img2SizeNatural);
                        }
                    }());
                } else {
                    (function() {
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
                        var dispRatio1 = img1SizeLimit.ratio || 1;
                        var dispRatio2 = img2SizeLimit.ratio || 1;
                        for (var i = 0; i < matches.size(); i++) {
                            var m = matches.get(i).get(0);
                            var n = matches.get(i).get(1);
                            if (m.distance < RATIO_TEST_THRESHOLD * n.distance) {
                                var kpt1 = kp1.get(m.queryIdx).pt;
                                var kpt2 = kp2.get(m.trainIdx).pt;
                                //リサイズ座標系 → フルサイズ座標系
                                matchPoint1.push(kpt1.x / dispRatio1);
                                matchPoint1.push(kpt1.y / dispRatio1);
                                matchPoint2.push(kpt2.x / dispRatio2);
                                matchPoint2.push(kpt2.y / dispRatio2);
                            }
                        }

                        var srcPoints = cv.matFromArray(matchPoint1.length / 2, 1, cv.CV_32FC2, matchPoint1); instances_.push(srcPoints);
                        var dstPoints = cv.matFromArray(matchPoint2.length / 2, 1, cv.CV_32FC2, matchPoint2); instances_.push(dstPoints);
                        var homographyMatrix; //フルサイズ座標系
                        if (matchPoint1.length / 2 >= 4 && matchPoint2.length / 2 >= 4) {
                            homographyMatrix = cv.findHomography(dstPoints, srcPoints, cv.RANSAC, 3.0); instances_.push(homographyMatrix);
                            //リサイズ座標系 → フルサイズ座標系
                            var drectNatural = {
                                x: drect.x / dispRatio1,
                                y: drect.y / dispRatio1,
                                width: drect.width / dispRatio1,
                                height: drect.height / dispRatio1
                            };
                            var drectNaturalPts = cv.matFromArray(4, 1, cv.CV_32FC2, [ //フルサイズ座標系
                                drectNatural.x, drectNatural.y,
                                drectNatural.x + drectNatural.width, drectNatural.y,
                                drectNatural.x + drectNatural.width, drectNatural.y + drectNatural.height,
                                drectNatural.x, drectNatural.y + drectNatural.height
                            ]); instances_.push(drectNaturalPts);
                            var homographyMatrixInv = new cv.Mat(); instances_.push(homographyMatrixInv);
                            cv.invert(homographyMatrix, homographyMatrixInv);
                            var drectNaturalPtsTransformed = new cv.Mat(); instances_.push(drectNaturalPtsTransformed);
                            cv.perspectiveTransform(drectNaturalPts, drectNaturalPtsTransformed, homographyMatrixInv);
                            img1Points = [];
                            img2Points = [];
                            for (var j = 0; j < drectNaturalPtsTransformed.rows; j++) {
                                var pt1 = drectNaturalPts.floatPtr(j, 0);
                                img1Points.push({ x: pt1[0], y: pt1[1] }); //フルサイズ座標系
                                var pt2 = drectNaturalPtsTransformed.floatPtr(j, 0);
                                img2Points.push({ x: pt2[0], y: pt2[1] }); //フルサイズ座標系
                            }
                        } else {
                            //各画像の四隅を対応点として用いる
                            //フルサイズ座標系
                            img1Points = getCornerPts(img1SizeNatural);
                            img2Points = getCornerPts(img2SizeNatural);
                        }
                        instances_.forEach(function(m) { m.delete(); });
                    }());
                }
            }());

            //--- 白黒画像であるか推定する（彩度を得る）
            var work1 = new cv.Mat(); instances.push(work1);
            var work2 = new cv.Mat(); instances.push(work2);
            cv.resize(img1, work1, new cv.Size(1, 1));
            cv.cvtColor(work1, work2, cv.COLOR_RGB2HSV, 0);
            var img1Saturation = (work2.ucharPtr(0, 0))[1];
            cv.resize(img2, work1, new cv.Size(1, 1));
            cv.cvtColor(work1, work2, cv.COLOR_RGB2HSV, 0);
            var img2Saturation = (work2.ucharPtr(0, 0))[1];

            //--- OpenCVの後始末
            instances.forEach(function(m) { m.delete(); });

            function updateDissolve() {
                var inst = [];
                var ratio1 = img1SizeLimit.ratio || 1;
                var ratio2 = img2SizeLimit.ratio || 1;
                //フルサイズ座標系 → リサイズ座標系
                var quad1 = cv.matFromArray(4, 1, cv.CV_32FC2, [
                    img1Points[0].x * ratio1, img1Points[0].y * ratio1,
                    img1Points[1].x * ratio1, img1Points[1].y * ratio1,
                    img1Points[2].x * ratio1, img1Points[2].y * ratio1,
                    img1Points[3].x * ratio1, img1Points[3].y * ratio1]);
                var quad2 = cv.matFromArray(4, 1, cv.CV_32FC2, [
                    img2Points[0].x * ratio2, img2Points[0].y * ratio2,
                    img2Points[1].x * ratio2, img2Points[1].y * ratio2,
                    img2Points[2].x * ratio2, img2Points[2].y * ratio2,
                    img2Points[3].x * ratio2, img2Points[3].y * ratio2]);
                inst.push(quad1); inst.push(quad2);
                var perspectiveMatrix = cv.getPerspectiveTransform(quad2, quad1); inst.push(perspectiveMatrix);

                var img1 = cv.imread($canvasResized1[0]); inst.push(img1); //リサイズ座標系
                var img2 = cv.imread($canvasResized2[0]); inst.push(img2); //リサイズ座標系
                var img2Warped = new cv.Mat(); inst.push(img2Warped);
                var img1Size = new cv.Size(img1.cols, img1.rows); //リサイズ座標系
                cv.warpPerspective(img2, img2Warped, perspectiveMatrix, img1Size, cv.INTER_LINEAR, cv.BORDER_CONSTANT); //img1の大きさに合わせる

                //unsharp処理
                var img2WarpedUnsharped = new cv.Mat(); inst.push(img2WarpedUnsharped);
                var work1 = new cv.Mat(); inst.push(work1);
                cv.GaussianBlur(img2Warped, work1, new cv.Size(3, 3), 1);
                cv.addWeighted(img2Warped, 1.5, work1, -0.5, 0, img2WarpedUnsharped);

                //半透明重ね合わせ
                var imgMerged = new cv.Mat(); inst.push(imgMerged);
                cv.addWeighted(img1, 0.5, img2WarpedUnsharped, 0.5, 0, imgMerged); //同じサイズでなければならない
                cv.imshow($canvasDissolve[0].id, imgMerged);

                //後処理
                inst.forEach(function(m) { m.delete(); });
            }
            function getExportData() {
                var data = params_ || {};
                data.img1 = img1Url;
                data.img2 = img2Url;
                if (img1Label) {
                    data['img1_label'] = img1Label;
                }
                if (img2Label) {
                    data['img2_label'] = img2Label;
                }
                data['corr_pts'] = {
                    //フルサイズ座標系
                    img1: {
                        size: {w: img1SizeNatural.width, h: img1SizeNatural.height},
                        pts: img1Points
                    },
                    img2: {
                        size: {w: img2SizeNatural.width, h: img2SizeNatural.height},
                        pts: img2Points
                    }
                };
                if (data.img1_roi_xywh) {
                    data['img1_roi_xywh'] = undefined;
                }
                if (isGlobalCompareMode) {
                    data.mode = isGlobalCompareMode;
                }
                if (showImg1onRightSide) {
                    data['show_img1_right'] = true;
                }
                return data;
            }
            function updateLink() {
                //「新しいタブで開く」リンクを表示したくない場合を考慮し、!viewerUrlであれば表示しない
                if (viewerUrl) {
                    var data = getExportData();
                    data['corr_pts'] = JSON.stringify(data.corr_pts);
                    var link = viewerUrl + ((String(viewerUrl).indexOf('?') > -1) ? '&' : '?') + $.param(data, true);
                    var $newTabLink = $('<a>').attr({ href: link, target: '_blank'}).text((lng !== 'ja') ? 'Check with vdiff.js' : '画像比較ツールで確認');
                    var newTabLink = $newTabLink.prop('outerHTML');
                    newTabLink = (lng !== 'ja') ? ' (' + newTabLink + ')' : '（' + newTabLink + '）';
                    $previewHeaderLink.html(newTabLink);
                }
            }
            updateDissolve();
            updateLink();

            //--- Leafletによる対応点編集
            function setupLeaflet(index) {
                var zoom = 0;
                var mapOptions = {
                    crs: L.CRS.Simple,
                    boxZoom: false,
                    center: [0, 0],
                    zoom: zoom,
                    fitBounds: true,
                    keyboard: false
                };
                var map = L.map(containerId_ + 'leaflet' + index, mapOptions);
                var srcHeight, srcWidth; //フルサイズ座標系
                var srcUrl;
                var srcSaturation;
                var imgPoints;
                if (index === 1) {
                    srcHeight = img1SizeNatural.height;
                    srcWidth = img1SizeNatural.width;
                    srcUrl = img1Url;
                    srcSaturation = img1Saturation;
                    imgPoints = img1Points;
                } else {
                    srcHeight = img2SizeNatural.height;
                    srcWidth = img2SizeNatural.width;
                    srcUrl = img2Url;
                    srcSaturation = img2Saturation;
                    imgPoints = img2Points;
                }
                var mapSize = map.getSize();
                var zoomX = srcWidth !== 0 ? Math.log(mapSize.x / srcWidth) * Math.LOG2E : 0;
                var zoomY = srcHeight !== 0 ? Math.log(mapSize.y / srcHeight) * Math.LOG2E : 0;
                var initZoom = Math.floor(Math.min(zoomX, zoomY));
                map.setMinZoom((initZoom < 0) ? initZoom : 0);
                map.setZoom(initZoom);
                if (map.attributionControl) {
                    map.attributionControl.setPrefix('');
                }
                var sw = map.options.crs.pointToLatLng(L.point(0, srcHeight), zoom);
                var ne = map.options.crs.pointToLatLng(L.point(srcWidth, 0), zoom);
                var imageBounds = L.latLngBounds(sw, ne);
                var im = L.imageOverlay(srcUrl, imageBounds);
                map.addLayer(im);
                map.fitBounds(im.getBounds());

                var coordinates = [];
                for (var i = 0; i < 4; i++) {
                    coordinates.push([-imgPoints[i].y, imgPoints[i].x]);
                }
                var polygonOptions = {
                    color: (srcSaturation < 3) ? '#3388ff' : 'white',
                    weight: 1,
                    fill: false
                };
                var polygon = L.polygon(coordinates, polygonOptions).addTo(map);

                function updateMarker(e) {
                    var latlngs = polygon.getLatLngs();
                    if ($.isArray(latlngs) && latlngs.length > 0 && $.isArray(latlngs[0]) && latlngs[0].length === 4) {
                        latlngs[0][e.target.options.index] = e.latlng;
                        polygon.setLatLngs(latlngs);
                        var x = e.latlng.lng;
                        var y = -e.latlng.lat;
                        imgPoints[e.target.options.index] = { x: x, y: y }; //フルサイズ座標系
                        updateDissolve();
                        updateLink();
                    }
                }
                function markerKeydown(e) {
                    var latlng = e.target.getLatLng();
                    var zoom = map.getZoom();
                    var scale = Math.pow(2, zoom);
                    var delta = 1 / scale; //px; 画面表示上でのdeltaを一定にする（高倍率にすれば細かい調整ができる）
                    switch (e.originalEvent.keyCode) {
                    case 37: //left
                        latlng.lng -= delta;
                        break;
                    case 39: //right
                        latlng.lng += delta;
                        break;
                    case 40: //down
                        latlng.lat -= delta;
                        break;
                    case 38: //up
                        latlng.lat += delta;
                        break;
                    default:
                        return;
                    }
                    e.target.setLatLng(latlng);
                    e.latlng = latlng;
                    updateMarker(e);
                    e.originalEvent.preventDefault(); //ページ自体のスクロールを防止
                }
                var iconUrls = [
                    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAPCAYAAAA71pVKAAAA/klEQVQokZ2TS04CQRiEv8xJBCO44jqgyzkAIS45DpG4BT2FPMIRWI0JjwOAmpSb+rHTTsjETjqd1F/1vxuSIygEj4I3wYfg0++r4EFQUHcEt4KNQL5bwcpvYGtBu064N2EiuMvsHcHU9r2glaYaEYe1af06GZm3EhS4Rgkm14SJg8hggJujPNUr4q75c9zNbQNRT1D6HgQVgrPgvYF4nHT9S3D6b+RjRI6aOw1rvjd/hjdHgueaSGNBL8NfzO/HnNcGRgmpNFYm2JOx5WVVBS3Bzoapx3ERO9WIuBPc5LW0vTnR0YPg280JbPFHmDgoBAPBXFB5jJVgJujnv+oHKqDTdpNjxD4AAAAASUVORK5CYII=',
                    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAPCAYAAAA71pVKAAABAklEQVQokZ2TSWpCQRiEP95JohLjSvA0GpcuXAbJRshxJOJWk1s44BHUxQs4HMAMUG6qTdN5yCMNTUP9Vf/cEB1BJugK3gUfgi+/b4JHQUbREdQEa4F8N4Kl34CtBNUi4cGEkeA+sdcFY9sPgkqcaoj4VJjWr5OBeUtBhmuUYHRLGDkIGXRwc5SmekP8YP4Md/Mo6Pu2SjjYCnIEn4LvqKMvJcRzwfm/kXchcqi5XrLmhvlTvDkSvCakpmAoaCb4xPx2mPPKwCAi9Yz1IuzZ2OK6qoKKYG/D2OO4ip1qiLgX3KW1VL05oetHwY/gFGHzP8LIQSboCGaC3GPMBVNBO/1VFxTb04ydFqHtAAAAAElFTkSuQmCC',
                    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAPCAYAAAA71pVKAAABAElEQVQokZ2TQWoCQRBFH3OSaFCzEnIaTZYusgySTcDjSCRbTW6hkVxBFxMwuYDGwMumWppxIEMamqb/1P9V9bsGsiUUwq3wKnwI33G+CDdCQd0SLoV3wdifwk+cCVsL7TpiCpoKHWEU95HQFWaZaCsvNWW8zwRP5AwbB/YmFESPCtNKNX3hUehX8FTBkDBHoVNrxrk3vYhfEG5+CXexrxsIbIQS4SAcM0cnDchLYf/fzNuUOfXcbdjzVcTPiclReGpIfo74QXrndQDjP4gPEbc6jarQEnbxYSb0akpNGXfCRVW1HZOTXN/EfZthyzNiJlAIQ2EhlPGMpTAXBtW/6hexadOM3oTRGQAAAABJRU5ErkJggg==',
                    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAPCAYAAAA71pVKAAAA/klEQVQokaWTS0oDQRRFD70SE0niKOBqEjPMwGEITgSXEwxOE12FJiFLMA5aiLgAf3CcvApFp8EGC4qibt/7PrdeQ7aEQhgJD8Kr8BXnvXAhFNQt4VTYCsZ+E37iTNhGaNcJE2kmdIRx3MdCV5hnQVt5qSnjJAt4EGfYNLC1UBA9Kswq1fSFa6FfwVMFQ8IchU6tGcfe9IK/JNx8biA6Fy5jvwslwqfw2EB8k7n+LXz8O3Pquduw57PgL4jJUbhtKL4L/iC98yaA6R/Cq+CtDqMqtIR9fJgLvZpSU8a9cFKN2o7JSY7u4v6SYU9HwixAIQyFpVDGM5bCQhhU/6pf67DTisCdVBcAAAAASUVORK5CYII='
                ];
                for (i = 0; i < 4; i++) {
                    var markerOptions = {
                        icon: L.icon({ iconUrl: iconUrls[i], iconSize: [15, 15], iconAnchor: [8, 8], className: 'edit-leaflet-marker' }),
                        draggable: true,
                        index: i
                    };
                    L.marker(coordinates[i], markerOptions).on('drag', updateMarker).on('keydown', markerKeydown).addTo(map);
                }
                return map;
            }
            var map1 = setupLeaflet(1);
            var map2 = setupLeaflet(2);

            //--- 各種ボタン
            //--- 対応点を四隅に設定
            $editCorrPtsCorners.on('click', function() {
                $(containerId).empty();
                init({ 'corr_pts': 'corners' });
            });
            //--- 対応点を自動推定
            $editCorrPtsAuto.on('click', function() {
                $(containerId).empty();
                init({ 'corr_pts': 'auto' });
            });
            //--- 縦横レイアウト切り替え
            $toggleLayout.on('click', function() {
                if (layout === 'horizontal') {
                    layout = 'vertical';
                } else {
                    layout = 'horizontal';
                }
                if (layout === 'horizontal') {
                    $(containerId).addClass('horizontal');
                    $previewContainer.resizable({ handles: 'e' });
                } else {
                    $(containerId).removeClass('horizontal');
                    $previewContainer.resizable('destroy');
                }
                if (map1) {
                    map1.invalidateSize(true);
                }
                if (map2) {
                    map2.invalidateSize(true);
                }
            });
            $editButtonsContainer.show();

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
    function init(overwriteParams) {
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
        if ($.isPlainObject(overwriteParams)) {
            if (overwriteParams.corr_pts) {
                params['corr_pts'] = overwriteParams.corr_pts;
            }
        }
        if (config.id) {
            if (params.img1 && params.img2) {
                editor = showComparedImages(config, params);
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

    var editor;
    return {
        getParameters: function() {
            return (editor) ? editor.getParameters() : {};
        }
    };
};