// Ghostty 自定义着色器：光标彗星流光拖尾（丝滑不晃眼）
// 兼容 Ghostty 1.2+ / 1.4+（Metal & OpenGL）

const float DURATION = 0.22;
const float OPACITY = 0.65;

vec2 normCoord(vec2 v, float isPos) {
    return (v * 2.0 - iResolution.xy * isPos) / iResolution.y;
}

float sdSegment(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
    return length(pa - ba * h);
}

float easeOutCubic(float x) {
    return 1.0 - pow(1.0 - x, 3.0);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec4 base = texture(iChannel0, uv);
    fragColor = base;

    float dt = iTime - iTimeCursorChange;
    if (dt < 0.0 || dt > DURATION) {
        return;
    }

    vec2 p = normCoord(fragCoord, 1.0);

    vec2 curPos = normCoord(iCurrentCursor.xy, 1.0);
    vec2 curSize = normCoord(iCurrentCursor.zw, 0.0);
    vec2 prevPos = normCoord(iPreviousCursor.xy, 1.0);
    vec2 prevSize = normCoord(iPreviousCursor.zw, 0.0);

    // Ghostty iCurrentCursor.xy 为左上角 (-X, +Y)，zw 为宽高
    vec2 curCenter = vec2(curPos.x + curSize.x * 0.5, curPos.y - curSize.y * 0.5);
    vec2 prevCenter = vec2(prevPos.x + prevSize.x * 0.5, prevPos.y - prevSize.y * 0.5);

    float moveDist = length(curCenter - prevCenter);
    if (moveDist < 0.002) {
        return;
    }

    float t = clamp(dt / DURATION, 0.0, 1.0);
    float eased = easeOutCubic(t);

    // 拖尾起点随时间快速追上当前光标，形成彗星收缩感
    vec2 tailStart = mix(prevCenter, curCenter, eased);
    float d = sdSegment(p, tailStart, curCenter);

    // 拖尾粗细沿路径向头部微增，向尾部收细
    vec2 ba = curCenter - tailStart;
    float proj = clamp(dot(p - tailStart, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
    float radius = max(curSize.y * 0.42, 0.006) * mix(0.28, 0.95, proj);

    float core = smoothstep(radius, radius * 0.15, d);
    float glow = exp(-d / max(radius * 1.45, 0.004)) * 0.42;
    float fade = (1.0 - eased) * smoothstep(0.0, 0.25, proj);

    vec3 cursorCol = iCurrentCursorColor.rgb;
    if (length(cursorCol) < 0.12) {
        cursorCol = vec3(0.48, 0.72, 1.0);
    }
    vec3 brightTip = mix(cursorCol, vec3(1.0), 0.35 * proj);

    float alpha = clamp((core * 0.75 + glow) * fade * OPACITY, 0.0, 0.85);
    fragColor = vec4(mix(base.rgb, brightTip, alpha) + cursorCol * glow * fade * 0.28, base.a);
}
