// The MIT License
//
// Copyright (c) 2016 Shigeyuki Fukushima
//
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files 
// (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge,
// publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do 
// so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF 
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE 
// FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION 
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

(function (mediaPlayer) {
    "use strict";
    
    mediaPlayer.plugin('fecedetection', function (options) {
        var player = this;
        var playerContainer = player.el();
        
        // Create drawing area
        var paper = null;
        var faceJson = null;
        var faceArray = {};
        var videoResolution = {};
        videoResolution["width"] = 0;
        videoResolution["height"] = 0;
        
        // options
        var faceJsonUrl = null;
        var faceColors = {
            "neutral": [169, 169, 169],
            "happiness": [0, 255, 0],
            "surprise": [255, 130, 25],
            "sadness": [0, 180, 255],
            "anger": [255, 0, 0],
            "disgust": [204, 204, 0],
            "fear": [0, 0, 0],
            "contempt": [150, 0, 150]
        };
        var faceDefaultColor = faceColors.neutral;
        var displayUpdateInterval = 5; // 5ms
        
        if (!!options && !!options.faceJsonUrl) {
            faceJsonUrl = options.faceJsonUrl;
        }
        if (!!options && !!options.displayUpdateInterval) {
            displayUpdateInterval = options.displayUpdateInterval;
        }
        if (!!options && !!options.faceDefaultColor) {
            faceDefaultColor = options.faceDefaultColor;
        }
        if (!!options && !!options.faceColors) {
            faceColors = options.faceColors;
        }
        
        player.addEventListener(amp.eventName.loadedmetadata, function () {
            console.log("fecedetection: AMP Event - loadedmetadata");
            if (faceJsonUrl == null) {
                console.warn("fecedetection [WARN]: No Face JSON data provided.");
                return;
            }
            player.loadFaceJson(faceJsonUrl);
        });
        
        player.setFaceJson = function(jsonUrl) {
            faceJsonUrl = jsonUrl;
        };
        
        player.loadFaceJson = function (jsonUrl) {
            function loadJSON(file, callback) {
                var xhrobj = new XMLHttpRequest();
                xhrobj.overrideMimeType("application/json");
                xhrobj.open('GET', file, true);
                xhrobj.onreadystatechange = function () {
                    if (xhrobj.readyState == 4 && xhrobj.status == "200") {
                        callback(xhrobj.responseText);
                    }
                };
                xhrobj.send(null);
            }
            loadJSON(jsonUrl, function(response) {
                for (var face in faceArray) {
                    if (faceArray.hasOwnProperty(face)) {
                        console.debug(faceArray[face]);
                        if (faceArray[face] != null && faceArray[face].hasOwnProperty("paper")) {
                            console.debug("fecedetection [DEBUG]: faceArea for face id [" + face + "] removed");
                            faceArray[face].remove();
                        }
                    }
                }
                faceArray = {};
                videoResolution["width"] = 0;
                videoResolution["height"] = 0;
                faceJson = JSON.parse(response);
                console.log("fecedetection: Face Detection JSON loaded - " + jsonUrl);
            });
        };
        
        player.ready(function () {
            paper = Raphael(playerContainer, "100%", "100%");
            console.log("fecedetection: Plugin ready");
            setInterval(displayFaceAreas, displayUpdateInterval);
        });
        
        // displayFaceAreas
        function displayFaceAreas() {
            if (myPlayer.paused()) {
                return;
            }

            if (faceJson == null) {
                console.log("fecedetection: Face Detection JSON is not loaded yet.");
                return;
            }
            
            var curTime = player.currentTime();
            var timescale = faceJson.timescale;
            videoResolution["width"] = faceJson.width;
            videoResolution["height"] = faceJson.height;
            console.log("fecedetection: currentTime = " + curTime);
            
            for (var i = 0; i < faceJson.fragments.length; i++) {
                var frag = faceJson.fragments[i];
                var fragStartTime = (frag.start) / timescale;
                var fragEndTime = fragStartTime + ((frag.duration) / timescale);
                
                if (curTime < fragEndTime && curTime >= fragStartTime) {
                    for (var face in faceArray) {
                        if (faceArray.hasOwnProperty(face)) {
                            console.debug(faceArray[face]);
                            if (faceArray[face] != null && faceArray[face].hasOwnProperty("paper")) {
                                console.debug("fecedetection [DEBUG]: faceArea for face id [" + face + "] removed");
                                faceArray[face].remove();
                            }
                        }                        
                        //if (faceArray[face] != null) {
                        //    console.debug("fecedetection [DEBUG]: faceArea for face id [" + face + "] removed");
                        //    faceArray[face].remove();
                        //}
                        faceArray[face] = null;
                    }
                    if (frag.hasOwnProperty("events")) {
                        var index = Math.floor((curTime - fragStartTime) / (frag.interval / timescale));
                        for (var n = 0, tmpIdList = {}; n < frag.events[index].length; n++) {
                            var id = frag.events[index][n].id;
                            var idindex = "face" + id;
                            var scores = frag.events[index][n].scores;
                            var emotionScore = 0;
                            var emotionColor = faceDefaultColor;
                            for (var emotion in scores) {
                                if (scores[emotion] > emotionScore) {
                                    emotionScore = scores[emotion];
                                    emotionColor = faceColors[emotion];
                                }
                            }
                            
                            // Redactor Analyze mode bug
                            if (tmpIdList.hasOwnProperty(idindex)) {
                                idindex = idindex + "-" + n;
                            }
                            tmpIdList[idindex] = 1;
                            
                            faceArray[idindex] = addFace(frag.events[index][n].x, frag.events[index][n].y, frag.events[index][n].width, frag.events[index][n].height, emotionColor);
                            console.log("fecedetection: face info [" + idindex + "] { id = " + id + ", x = " + frag.events[index][n].x + ", y = " + frag.events[index][n].y + ", width = " + frag.events[index][n].width + ", height = " + frag.events[index][n].height + " }");
                        }
                        console.debug("fecedetection [DEBUG]: fragment[" + i + "].events[" + index + "] selected");
                        console.log("fecedetection: face list - " + Object.keys(faceArray));
                    }
                    break;
                }
            }
            console.debug("fecedetection [DEBUG]: display faces");
        };
        
        // addFace
        function addFace(x, y, dx, dy, rgbColor) {
            var x1 = x, x2 = x1 + dx, y1 = y, y2 = y1 + dy;
            //console.log("fecedetection: face location = [[" + x1 + ", " + y1 + "], [" + x2 + ", " + y1 + "], [" + x2 + ", " + y2 + "], [" + x1 + ", " + y2 + "]]");
            var loc = coordinateTransformation(x1, x2, y1, y2);
            var path = createPath(loc);
            console.debug("fecedetection [DEBUG]: face location = " + path);
            
            var faceSvgPath = paper.path(path);
            faceSvgPath.attr("fill", "rgba(" + rgbColor.join(",") + ",.1)");
            faceSvgPath.attr("stroke", "rgba(" + rgbColor.join(",") + ",.8)");
            faceSvgPath.attr("stroke-width", 3);            
            paper.add(faceSvgPath);
            
            return faceSvgPath;
        };
        
        // createPath
        function createPath(loc) {
            var path = null;
            path = "M" + loc["x1"] + "," + loc["y1"];
            path = path + " L" + loc["x2"] + "," + loc["y1"];
            path = path + " L" + loc["x2"] + "," + loc["y2"];
            path = path + " L" + loc["x1"] + "," + loc["y2"];
            path = path + " Z";
            return path;
        }
        
        // coordinateTransformation
        function coordinateTransformation(x1, x2, y1, y2) {
            var loc = {};
            loc["x1"] = 0, loc["x2"] = 0, loc["y1"] = 0, loc["y2"] = 0;
            var w = playerContainer.clientWidth;
            var h = playerContainer.clientHeight;
            var wRatio = w / videoResolution["width"];
            var hRatio = h / videoResolution["height"];
            
            if (wRatio > hRatio) {
                var xpad = (w - videoResolution["width"] * hRatio) / 2;
                loc["x1"] = Math.floor(xpad + videoResolution["width"] * hRatio * x1);
                loc["x2"] = Math.ceil(xpad + videoResolution["width"] * hRatio * x2);
                loc["y1"] = Math.floor(videoResolution["height"] * hRatio * y1);
                loc["y2"] = Math.ceil(videoResolution["height"] * hRatio * y2);
            } else {
                var ypad = (h - videoResolution["height"] * wRatio) / 2;
                loc["x1"] = Math.floor(videoResolution["width"] * wRatio * x1);
                loc["x2"] = Math.ceil(videoResolution["width"] * wRatio * x2);
                loc["y1"] = Math.floor(ypad + videoResolution["height"] * wRatio * y1);
                loc["y2"] = Math.ceil(ypad + videoResolution["height"] * wRatio * y2);
            }
            return loc;
        };
        
    });
}(window.amp));