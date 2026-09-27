"use strict";

// Sierpinski Carpet
// 정사각형을 3x3(9칸)으로 나누고 가운데만 빼고 8칸에 재귀 호출하는 방식.
// 3주차에 배운 Gasket이랑 원리는 똑같은데, 삼각형 4등분 대신 사각형 9등분,
// 3개 재귀 대신 8개 재귀라는 점만 다름.

var gl;
var program;
var uColorLoc;

var points = [];      // 그릴 삼각형들의 정점 목록 (사각형 하나 = 정점 6개)
var currentLevel = 3; // 분할 횟수, 슬라이더 초기값이랑 맞춰둠


// points 배열([x,y] 쌍들)을 GPU 버퍼에 넣을 수 있는 형태로 바꿔줌
function flatten(arrayOfArrays) {
    var result = [];
    arrayOfArrays.forEach(function (pair) {
        result.push(pair[0], pair[1]);
    });
    return new Float32Array(result);
}


// shader 컴파일
function compileShader(gl, scriptId, type) {
    var source = document.getElementById(scriptId).text;
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("shader 컴파일 오류:", gl.getShaderInfoLog(shader));
    }
    return shader;
}

function createProgram(gl, vertexShaderId, fragmentShaderId) {
    var vertShader = compileShader(gl, vertexShaderId, gl.VERTEX_SHADER);
    var fragShader = compileShader(gl, fragmentShaderId, gl.FRAGMENT_SHADER);

    var prog = gl.createProgram();
    gl.attachShader(prog, vertShader);
    gl.attachShader(prog, fragShader);
    gl.linkProgram(prog);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        console.error("program 링크 오류:", gl.getProgramInfoLog(prog));
    }
    return prog;
}


// 정사각형 하나를 삼각형 2개로 쪼개서 points에 추가.
// WebGL은 삼각형만 그릴 수 있어서 이렇게 해야 함.
// (x,y)가 왼쪽 아래, size가 한 변 길이
function drawSquare(x, y, size) {
    var x2 = x + size;
    var y2 = y + size;

    points.push([x, y], [x2, y], [x, y2]);   // 삼각형 1 (왼쪽 아래)
    points.push([x2, y], [x2, y2], [x, y2]); // 삼각형 2 (오른쪽 위)
}


// 재귀 함수
// count가 0이 될 때까지 계속 9등분해서 가운데만 빼고 재귀 호출
function divideSquare(x, y, size, count) {

    if (count === 0) {
        // 더 안 쪼개도 되면 그냥 그리기
        drawSquare(x, y, size);
        return;
    }

    var newSize = size / 3;

    for (var i = 0; i < 3; i++) {
        for (var j = 0; j < 3; j++) {

            if (i === 1 && j === 1) continue; // 가운데는 뚫려야 함

            divideSquare(x + i * newSize, y + j * newSize, newSize, count - 1);
        }
    }
}


// 슬라이더 값 바뀔 때마다 호출됨. points 다시 채우고 버퍼도 새로 보냄
function rebuildCarpet(level) {
    points = [];

    // -1~1 범위 전체를 채우는 정사각형에서 시작
    divideSquare(-1, -1, 2, level);

    gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);

    // 사각형 몇 개 그려졌는지 화면에 표시 (8^level이랑 맞는지 확인용)
    var squareCount = points.length / 6;
    document.getElementById("infoText").textContent =
        "분할 횟수: " + level + " / 사각형 개수: " + squareCount +
        " (이론값 8^" + level + " = " + Math.pow(8, level) + ")";
}


// 색상 피커에서 나오는 "#rrggbb" 문자열을 0~1 사이 숫자로 변환
function hexToRGBA(hex) {
    var r = parseInt(hex.substring(1, 3), 16) / 255;
    var g = parseInt(hex.substring(3, 5), 16) / 255;
    var b = parseInt(hex.substring(5, 7), 16) / 255;
    return [r, g, b, 1.0];
}


function render() {
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, points.length);
}


function init() {
    var canvas = document.getElementById("gl-canvas");
    gl = canvas.getContext("webgl");
    if (!gl) {
        alert("이 브라우저는 WebGL을 지원하지 않습니다.");
        return;
    }

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(1.0, 1.0, 1.0, 1.0);

    program = createProgram(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);

    var vBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);

    var vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    uColorLoc = gl.getUniformLocation(program, "uColor");

    // 처음 색은 컬러피커 기본값으로
    var colorPicker = document.getElementById("colorPicker");
    gl.uniform4fv(uColorLoc, hexToRGBA(colorPicker.value));

    // 슬라이더 움직이면 분할 횟수 다시 계산
    var levelSlider = document.getElementById("levelSlider");
    levelSlider.addEventListener("input", function (event) {
        currentLevel = Number(event.target.value);
        document.getElementById("levelValue").textContent = currentLevel;
        rebuildCarpet(currentLevel);
        render();
    });

    // 색 바뀌면 uniform만 갱신 (점 다시 만들 필요 없음)
    colorPicker.addEventListener("input", function (event) {
        gl.uniform4fv(uColorLoc, hexToRGBA(event.target.value));
        render();
    });

    rebuildCarpet(currentLevel);
    render();
}