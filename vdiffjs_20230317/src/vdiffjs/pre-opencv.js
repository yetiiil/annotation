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
// OpenCV.jsを読み込む前に以下を読み込むこと
// Before loading OpenCV.js, the following must be loaded.
var Module = {
    onRuntimeInitialized: function() {
        var event = new Event('opencvRuntimeInitialized');
        window.dispatchEvent(event);
        Module.runtimeInitialized = true;
    }
};